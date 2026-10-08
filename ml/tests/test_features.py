from datetime import datetime, timezone, timedelta

import numpy as np
import pandas as pd

from ml.features import parse_utc, clean_h2h, build_event_level_features, build_cross_book_features


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
