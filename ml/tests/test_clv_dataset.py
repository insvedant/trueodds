import random
from datetime import datetime, timedelta, timezone

import numpy as np
import pandas as pd
import pytest

import ml.models.train as T
from ml.features import american_to_decimal, clean_h2h, CLV_FEATURE_COLUMNS

UTC = timezone.utc
NOW = datetime(2026, 10, 8, 12, 0, tzinfo=UTC)
START = NOW - timedelta(days=2)                      # the game started two days ago


def mkt(home_pin, away_pin, home_dk=None, away_dk=None):
    """A two-way market: pinnacle (sharp) and, optionally, draftkings (soft)."""
    h = {"Home": {"pinnacle": home_pin}, "Away": {"pinnacle": away_pin}}
    if home_dk is not None:
        h["Home"]["draftkings"], h["Away"]["draftkings"] = home_dk, away_dk
    return h


def hours_before(h):
    return START - timedelta(hours=h)


def funnel():
    return {"events_seen": 0, "events_not_started": 0, "events_too_short": 0, "events_no_usable_slice": 0, "events_used": 0}


def slices(acc, now=NOW):
    f = funnel()
    return list(acc.slices(now, f)), f


def event(acc, eid="E1", commence=START, rows=(), watched=None):
    """rows = real snapshots (time, odds); watched = (first, last) times the event was observed, markers included."""
    c = commence.isoformat().replace("+00:00", "Z")
    for ts, odds in rows:
        acc.add(eid, ts, c, odds)
    if watched:
        acc.observe(eid, watched[0], watched[1], c)


class TestTimeline:
    """Which market state and which closing line pair up, at each lead time."""

    def test_state_is_the_last_price_at_or_before_each_lead_time_and_close_is_the_last_before_kickoff(self):
        acc = T._ClvEventAccumulator()
        p0, p1, p2, close = mkt(-105, -105), mkt(-115, -100), mkt(-130, 110), mkt(-150, 125)
        event(acc, rows=[(hours_before(60), p0), (hours_before(30), p1), (hours_before(3), p2), (hours_before(0.17), close)])
        out, f = slices(acc)
        got = {lead: (clean_h2h(state), clean_h2h(c)) for _, lead, state, c in out}
        # as of 48h out: the 60h-old price | 24h: the 30h price | 6h: still the 30h price (the 3h one came later) | 1h: the 3h price
        assert got == {2880: (clean_h2h(p0), clean_h2h(close)), 1440: (clean_h2h(p1), clean_h2h(close)),
                       360: (clean_h2h(p1), clean_h2h(close)), 60: (clean_h2h(p2), clean_h2h(close))}
        assert f["events_seen"] == 1

    def test_a_quiet_stretch_with_no_price_change_still_gives_a_slice_at_every_lead_time(self):
        """With true de-duplication a game that never moves has ONE real snapshot; the earlier
        'first snapshot inside each band' rule found nothing for the bands it never changed in."""
        acc = T._ClvEventAccumulator()
        event(acc, rows=[(hours_before(50), mkt(-110, -110)), (hours_before(0.1), mkt(-125, 105))], watched=(hours_before(50), hours_before(0.1)))
        out, _ = slices(acc)
        assert sorted(lead for _, lead, _, _ in out) == [60, 360, 1440, 2880]

    def test_a_price_that_never_changed_is_still_a_slice(self):
        acc = T._ClvEventAccumulator()
        p = mkt(-110, -110)
        event(acc, rows=[(hours_before(50), p)], watched=(hours_before(50), hours_before(0.1)))
        out, _ = slices(acc)
        assert len(out) == 4 and all(clean_h2h(s) == clean_h2h(c) for _, _, s, c in out)

    def test_slices_stop_where_tracking_stopped(self):
        acc = T._ClvEventAccumulator()
        event(acc, rows=[(hours_before(50), mkt(-110, -110))], watched=(hours_before(50), hours_before(30)))
        out, _ = slices(acc)
        assert [lead for _, lead, _, _ in out] == [2880]       # watched at 48h out, but gone before the 24h/6h/1h marks

    def test_arrival_order_does_not_matter(self):
        rows = [(hours_before(h), mkt(-110 - int(h), -110 + int(h))) for h in (50, 30, 8, 3, 0.2)]
        results = []
        for seed in range(5):
            shuffled = rows[:]
            random.Random(seed).shuffle(shuffled)
            acc = T._ClvEventAccumulator()
            event(acc, rows=shuffled, watched=(hours_before(50), hours_before(0.2)))
            out, _ = slices(acc)
            results.append(sorted((lead, str(clean_h2h(s)), str(clean_h2h(c))) for _, lead, s, c in out))
        assert all(r == results[0] for r in results) and len(results[0]) == 4

    def test_a_game_split_across_mongo_and_parquet_is_one_event_with_its_true_open_and_close(self):
        acc = T._ClvEventAccumulator()
        c = START.isoformat()
        for ts, o in [(hours_before(60), mkt(-105, -105)), (hours_before(40), mkt(-115, -100))]:        # older, from parquet
            acc.add("E1", ts, c, o)
        for ts, o in [(hours_before(5), mkt(-130, 105)), (hours_before(0.1), mkt(-160, 135))]:           # newer, from mongo
            acc.add("E1", ts, c, o)
        out, f = slices(acc)
        assert f["events_seen"] == 1
        earliest = [x for x in out if x[1] == 2880][0]
        assert clean_h2h(earliest[2]) == clean_h2h(mkt(-105, -105)) and clean_h2h(earliest[3]) == clean_h2h(mkt(-160, 135))

    def test_upcoming_games_are_excluded_because_they_have_no_closing_line_yet(self):
        acc = T._ClvEventAccumulator()
        future = NOW + timedelta(hours=6)
        event(acc, commence=future, rows=[(NOW - timedelta(hours=30), mkt(-110, -110)), (NOW - timedelta(hours=1), mkt(-120, 100))],
              watched=(NOW - timedelta(hours=30), NOW - timedelta(minutes=5)))
        out, f = slices(acc)
        assert out == [] and f["events_not_started"] == 1

    def test_closing_line_is_the_last_price_before_the_game_not_an_in_play_price(self):
        acc = T._ClvEventAccumulator()
        event(acc, rows=[(hours_before(10), mkt(-110, -110)), (hours_before(0.33), mkt(-140, 120)), (START + timedelta(minutes=45), mkt(-900, 500))],
              watched=(hours_before(10), START + timedelta(minutes=45)))
        out, _ = slices(acc)
        assert out and all(clean_h2h(c) == clean_h2h(mkt(-140, 120)) for _, _, _, c in out)

    def test_events_watched_for_under_an_hour_are_dropped(self):
        acc = T._ClvEventAccumulator()
        event(acc, rows=[(hours_before(0.8), mkt(-110, -110)), (hours_before(0.1), mkt(-130, 110))])
        out, f = slices(acc)
        assert out == [] and f["events_too_short"] == 1


class TestLabels:
    """Hand-calculated. Pinnacle -110/-110 is a 50/50 fair price; draftkings quotes +100 (Home) and -120 (Away)."""

    STATE = mkt(-110, -110, home_dk=100, away_dk=-120)
    CLOSE = mkt(-130, 110, home_dk=-125, away_dk=105)

    def rows(self):
        return {(f["value_vs_fair"] > -0.01): (f, n, a) for f, n, a in T.label_clv_rows(self.STATE, self.CLOSE, 1440)}

    def test_one_row_per_soft_price_with_hand_calculated_labels(self):
        out = T.label_clv_rows(self.STATE, self.CLOSE, 1440)
        assert len(out) == 2                                     # Home@draftkings and Away@draftkings; pinnacle itself is the reference
        by_value = sorted(out, key=lambda r: -r[0]["value_vs_fair"])
        home, away = by_value                                   # Home: +100 vs a 50% fair price = 0% edge; Away: -120 = a 8.3% negative edge

        # Home: draftkings 2.0 -> 1.8 (-10.0%). The fair Home price went 50% -> 54.275% (decimal 2.0 -> 1.8425, -7.876%). Net = -2.124%.
        fair_close_home = (1 / (1 + 100 / 130)) / ((1 / (1 + 100 / 130)) + (1 / 2.1))
        assert home[0]["fair_prob"] == pytest.approx(0.5) and home[0]["value_vs_fair"] == pytest.approx(0.0, abs=1e-9)
        assert home[2] == pytest.approx(1.8 / 2.0 - 1)
        assert home[1] == pytest.approx((1.8 / 2.0 - 1) - (0.5 / fair_close_home - 1))
        # Away: draftkings 1.8333 -> 2.05 (+11.82%). Fair Away 50% -> 45.725%. Net = +2.469%.
        fair_close_away = (1 / 2.1) / ((1 / (1 + 100 / 130)) + (1 / 2.1))
        assert away[0]["value_vs_fair"] == pytest.approx(0.5 * (1 + 100 / 120) - 1)
        assert away[2] == pytest.approx(2.05 / (1 + 100 / 120) - 1)
        assert away[1] == pytest.approx((2.05 / (1 + 100 / 120) - 1) - (0.5 / fair_close_away - 1))

    def test_a_price_no_longer_quoted_at_the_close_is_skipped(self):
        close_without_dk = mkt(-130, 110)
        assert T.label_clv_rows(self.STATE, close_without_dk, 1440) == []

    def test_labels_are_clipped_so_one_stale_quote_cannot_dominate(self):
        wild_close = mkt(-130, 110, home_dk=-900, away_dk=2000)
        for _, net, absolute in T.label_clv_rows(self.STATE, wild_close, 1440):
            assert abs(net) <= T.CLV_LABEL_CLIP and abs(absolute) <= T.CLV_LABEL_CLIP

    def test_features_use_the_documented_columns_and_contain_no_team_names(self):
        feats = T.label_clv_rows(self.STATE, self.CLOSE, 1440)[0][0]
        assert list(feats) == CLV_FEATURE_COLUMNS and feats["minutes_to_game"] == 1440

    def test_a_market_that_cannot_be_de_vigged_gives_no_rows(self):
        assert T.label_clv_rows({"Home": {"draftkings": 100}, "Away": {"fanduel": -120}}, self.CLOSE, 60) == []


def reference_slices(all_snaps, now):
    """A deliberately plain re-implementation of the timeline from raw documents (real snapshots AND markers)."""
    out = []
    df = pd.DataFrame([{"eid": s["event_id"], "ts": s["fetched_at"].replace(tzinfo=UTC), "real": not s.get("is_duplicate"), "h2h": (s.get("book_odds") or {}).get("h2h"),
                        "commence": datetime.fromisoformat(s["commence_time"].replace("Z", "+00:00"))} for s in all_snaps])
    for eid, g in df.groupby("eid"):
        g = g.sort_values("ts")
        commence = g["commence"].iloc[-1]
        real = g[g["real"]]
        if commence > now or real.empty or (g["ts"].iloc[-1] - g["ts"].iloc[0]).total_seconds() < 3600:
            continue
        pre = real[real["ts"] <= commence]
        close = (pre if len(pre) else real).iloc[-1]
        for lead in T.CLV_LEAD_MINUTES:
            at = commence - timedelta(minutes=lead)
            before = real[real["ts"] <= at]
            if before.empty or g["ts"].iloc[-1] < at:
                continue
            out.append((eid, lead, before.iloc[-1]["h2h"], close["h2h"]))
    return out


class TestAgainstIndependentTimeline:
    """Build the dataset from real archiver output + mongomock, then recompute the pairing a different way."""

    def test_dataset_matches_an_independent_reconstruction_of_the_timeline(self, world, monkeypatch):
        db, meta, all_snaps, _ = world
        monkeypatch.setattr(T, "MIN_TRAINING_ROWS", 10)
        monkeypatch.setattr(T, "CLV_MIN_EVENTS", 5)
        monkeypatch.setattr(T, "CLV_ROWS_PER_SLICE", 10**6)              # no per-slice sampling, so the two sides are comparable
        X, y, groups, info = T.build_clv_dataset(db)
        assert X is not None
        want = []
        for eid, lead, state, close in reference_slices(all_snaps, datetime.now(UTC)):
            for feats, net, _ in T.label_clv_rows(state, close, lead):
                want.append((eid, lead, round(net, 5), round(feats["value_vs_fair"], 5)))
        got = [(g, int(m), round(v, 5), round(x, 5)) for g, m, v, x in zip(groups, X["minutes_to_game"], y, X["value_vs_fair"])]
        assert len(got) == len(want) > 500, (len(got), len(want))
        assert sorted(got) == sorted(want)

    def test_columns_are_exactly_the_documented_ones(self, world, monkeypatch):
        db = world[0]
        monkeypatch.setattr(T, "MIN_TRAINING_ROWS", 10)
        monkeypatch.setattr(T, "CLV_MIN_EVENTS", 5)
        X, y, groups, info = T.build_clv_dataset(db)
        assert list(X.columns) == CLV_FEATURE_COLUMNS and not any("team" in c.lower() for c in X.columns)
        assert len(info["_y_abs"]) == len(X)

    def test_one_game_cannot_dominate_through_sheer_number_of_prices(self, world, monkeypatch):
        db = world[0]
        monkeypatch.setattr(T, "MIN_TRAINING_ROWS", 10)
        monkeypatch.setattr(T, "CLV_MIN_EVENTS", 5)
        X, y, groups, info = T.build_clv_dataset(db)
        assert groups.value_counts().max() <= T.CLV_ROWS_PER_SLICE * len(T.CLV_LEAD_MINUTES)

    def test_funnel_explains_where_data_went(self, world, monkeypatch):
        db = world[0]
        monkeypatch.setattr(T, "MIN_TRAINING_ROWS", 10**6)          # force a shortfall
        r = T.train_clv_model(db)
        assert r["success"] is False and r["reason"] == "insufficient_data"
        assert "samples" in r["detail"] and "finished games" in r["detail"]
        f = r["funnel"]
        assert f["parquet"]["files_read"] > 0 and f["parquet"]["rows_odds_lost"] == 0 and f["parquet"]["obs_rows"] > 0
        assert f["events_seen"] == f["events_not_started"] + f["events_too_short"] + f["events_no_usable_slice"] + f["events_used"]
