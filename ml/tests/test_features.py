from datetime import datetime, timezone, timedelta

import numpy as np
import pandas as pd
import pytest

from ml.features import (parse_utc, clean_h2h, build_event_level_features, build_cross_book_features,
                         clv_market_rows, decimal_to_american, CLV_FEATURE_COLUMNS)


class TestParseUtc:
    def test_naive_datetime_is_treated_as_utc(self):          # what pymongo returns
        assert parse_utc(datetime(2026, 10, 1, 12, 0)) == datetime(2026, 10, 1, 12, 0, tzinfo=timezone.utc)

    def test_aware_datetime_is_converted(self):
        ist = timezone(timedelta(hours=5, minutes=30))
        assert parse_utc(datetime(2026, 10, 1, 17, 30, tzinfo=ist)) == datetime(2026, 10, 1, 12, 0, tzinfo=timezone.utc)

    def test_iso_strings_as_written_by_the_archiver(self):
        want = datetime(2026, 10, 1, 12, 0, 5, tzinfo=timezone.utc)
        assert parse_utc("2026-10-01T12:00:05") == want
        assert parse_utc("2026-10-01T12:00:05Z") == want
        assert parse_utc("2026-10-01T12:00:05+00:00") == want

    def test_pandas_and_numpy_timestamps_from_parquet(self):
        want = datetime(2026, 10, 1, 12, 0, tzinfo=timezone.utc)
        assert parse_utc(pd.Timestamp("2026-10-01 12:00")) == want
        assert parse_utc(np.datetime64("2026-10-01T12:00")) == want

    def test_garbage_is_none_not_an_exception(self):
        for bad in (None, "", "   ", "not a date", 12345, float("nan"), object()):
            assert parse_utc(bad) is None


class TestCleanH2h:
    def test_drops_empty_selections_and_bad_prices(self):
        raw = {
            "Yankees": {"pinnacle": -150, "draftkings": -145, "fanduel": None, "betmgm": float("nan"), "bovada": True, "x": 50},
            "Mets": None,                      # a team that only appears elsewhere in the parquet file
            "Red Sox": {"pinnacle": None},     # present but nothing priced
            "Dodgers": {"pinnacle": +130},
        }
        assert clean_h2h(raw) == {"Yankees": {"pinnacle": -150, "draftkings": -145}, "Dodgers": {"pinnacle": 130}}

    def test_non_dict_input(self):
        assert clean_h2h(None) == {} and clean_h2h("x") == {} and clean_h2h([]) == {}


class TestEventLevelFeatures:
    H2H = {"A": {"pinnacle": -110, "draftkings": -120}, "B": {"pinnacle": 100, "draftkings": 110}}

    def test_values(self):
        f = build_event_level_features({"h2h": self.H2H})
        assert f["n_selections"] == 2 and f["pinnacle_present"] == 1 and f["avg_book_count"] == 2
        best = [1 / (100 / 110 + 1), 1 / 2.1]                       # best price per selection
        assert abs(f["combined_implied_prob"] - sum(best)) < 1e-9
        assert abs(f["vig_estimate"] - max(0, sum(best) - 1)) < 1e-9

    def test_names_do_not_depend_on_the_teams(self):
        renamed = {"Zebras": self.H2H["A"], "Lions": self.H2H["B"]}
        assert build_event_level_features({"h2h": self.H2H}) == build_event_level_features({"h2h": renamed})

    def test_empty_market_gives_neutral_zeros(self):
        f = build_event_level_features({})
        assert f["n_selections"] == 0 and f["combined_implied_prob"] == 1.0 and f["arb_present"] == 0

    def test_live_prediction_supplies_the_same_columns_the_model_trains_on(self):
        """predict_clv aligns to the trained column names; they must all exist at inference."""
        live = build_cross_book_features({"h2h": self.H2H})
        for col in build_event_level_features({"h2h": self.H2H}):
            assert col in live


class TestClvMarketRows:
    """Pinnacle -110/-110 is a 50/50 fair price. draftkings quotes +100 on Home and -120 on Away."""

    H2H = {"Home": {"pinnacle": -110, "draftkings": 100}, "Away": {"pinnacle": -110, "draftkings": -120}}

    def rows(self, h2h=None, mtg=600.0):
        return {(r["_selection"], r["_book"]): r for r in clv_market_rows(h2h or self.H2H, mtg)}

    def test_one_row_per_soft_price_and_the_sharp_book_is_only_the_reference(self):
        rows = self.rows()
        assert set(rows) == {("Home", "draftkings"), ("Away", "draftkings")}

    def test_hand_calculated_values(self):
        rows = self.rows()
        home, away = rows[("Home", "draftkings")], rows[("Away", "draftkings")]
        assert home["fair_prob"] == pytest.approx(0.5) and home["soft_prob"] == pytest.approx(0.5)
        assert home["gap"] == pytest.approx(0.0, abs=1e-12) and home["value_vs_fair"] == pytest.approx(0.0, abs=1e-12)
        assert away["soft_prob"] == pytest.approx(1 / (1 + 100 / 120)) and away["gap"] == pytest.approx(1 / (1 + 100 / 120) - 0.5)
        assert away["value_vs_fair"] == pytest.approx(0.5 * (1 + 100 / 120) - 1)           # paying less than fair: a negative edge
        assert home["sharp_vig"] == pytest.approx(2 / (1 + 100 / 110) - 1) and home["has_sharp"] == 1
        assert home["n_selections"] == 2 and home["n_books"] == 2 and home["minutes_to_game"] == 600.0
        assert home["is_favorite"] == 0                                                      # exactly 50% is not a favourite

    def test_every_row_has_exactly_the_documented_columns(self):
        for r in clv_market_rows(self.H2H, 60):
            assert [k for k in r if not k.startswith("_")] == CLV_FEATURE_COLUMNS

    def test_a_price_above_fair_has_a_positive_edge_and_a_price_below_it_a_negative_one(self):
        market = {"Home": {"pinnacle": -110, "bookA": 120, "bookB": -130}, "Away": {"pinnacle": -110, "bookA": -150, "bookB": 110}}
        rows = self.rows(market)
        assert rows[("Home", "bookA")]["value_vs_fair"] > 0 > rows[("Home", "bookB")]["value_vs_fair"]
        assert rows[("Home", "bookA")]["gap"] < 0 < rows[("Home", "bookB")]["gap"]            # gap is in probability: a longer price is a smaller probability

    def test_consensus_gap_compares_a_book_with_the_other_soft_books(self):
        market = {"Home": {"pinnacle": -110, "bookA": 120, "bookB": -130}, "Away": {"pinnacle": -110, "bookA": -150, "bookB": 110}}
        rows = self.rows(market)
        assert rows[("Home", "bookA")]["consensus_gap"] == pytest.approx(-rows[("Home", "bookB")]["consensus_gap"])

    def test_three_way_market_fair_probabilities_sum_to_one(self):
        market = {"Home": {"pinnacle": 150, "bookA": 160}, "Draw": {"pinnacle": 230, "bookA": 240}, "Away": {"pinnacle": 190, "bookA": 200}}
        rows = self.rows(market)
        assert sum(r["fair_prob"] for r in rows.values()) == pytest.approx(1.0) and rows[("Draw", "bookA")]["n_selections"] == 3

    def test_without_a_sharp_book_it_falls_back_to_consensus_and_says_so(self):
        market = {"Home": {"bookA": -110, "bookB": -105}, "Away": {"bookA": -110, "bookB": -115}}
        rows = clv_market_rows(market, 60)
        assert rows and all(r["has_sharp"] == 0 for r in rows) and sum(r["fair_prob"] for r in rows if r["_book"] == "bookA") == pytest.approx(1.0)

    def test_markets_that_cannot_be_de_vigged_give_nothing(self):
        assert clv_market_rows({"Home": {"pinnacle": -110, "bookA": 100}}, 60) == []                                   # one selection
        assert clv_market_rows({"Home": {"bookA": -110}, "Away": {"bookB": -110}}, 60) == []                           # no book prices both sides
        assert clv_market_rows(None, 60) == [] and clv_market_rows({}, 60) == []

    def test_selections_priced_by_a_book_that_does_not_cover_the_whole_market_still_get_rows(self):
        market = {"Home": {"pinnacle": -110, "bookA": 100, "bookC": 105}, "Away": {"pinnacle": -110, "bookA": -120}}
        assert ("Home", "bookC") in self.rows(market)

    def test_decimal_to_american_round_trips(self):
        for american in (-300, -200, -110, 100, 150, 400):
            assert decimal_to_american(1 + 100 / abs(american) if american < 0 else 1 + american / 100) == american
