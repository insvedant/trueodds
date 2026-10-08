import random
from datetime import datetime, timedelta, timezone

import numpy as np
import pandas as pd
import pytest

import ml.models.train as T
from ml.features import american_to_decimal

UTC = timezone.utc
NOW = datetime(2026, 10, 8, 12, 0, tzinfo=UTC)


def h2h(a_home, a_away, book="pinnacle"):
    return {"Home": {book: a_home}, "Away": {book: a_away}}


def dec_avg(h):
    return float(np.mean([american_to_decimal(list(b.values())[0]) for b in h.values()]))


class TestAccumulator:
    START = NOW - timedelta(days=2)          # game started two days ago

    def _event(self, acc, eid="E1", commence=None, rows=()):
        commence = commence or self.START
        for ts, odds in rows:
            acc.add(eid, ts, commence.isoformat().replace("+00:00", "Z"), odds)

    def _samples(self, acc):
        funnel = {"events_seen": 0, "events_not_started": 0, "events_too_short": 0, "events_no_usable_slice": 0, "events_used": 0}
        return list(acc.samples(NOW, funnel)), funnel

    def test_label_is_closing_price_minus_price_at_that_moment(self):
        acc = T._ClvEventAccumulator()
        c = self.START
        self._event(acc, rows=[(c - timedelta(hours=30), h2h(-110, -110)),    # 24-48h band
                               (c - timedelta(hours=3), h2h(-130, 110)),      # 1-6h band
                               (c - timedelta(minutes=10), h2h(-150, 125))])  # closing line
        samples, f = self._samples(acc)
        close = dec_avg(h2h(-150, 125))
        by_minutes = {round(s[0]["minutes_to_game"]): s for s in samples}
        assert set(by_minutes) == {30 * 60, 3 * 60}
        assert by_minutes[30 * 60][1] == pytest.approx(close - dec_avg(h2h(-110, -110)))
        assert by_minutes[3 * 60][1] == pytest.approx(close - dec_avg(h2h(-130, 110)))
        assert f["events_used"] == 1

    def test_arrival_order_does_not_matter(self):
        c = self.START
        rows = [(c - timedelta(hours=h), h2h(-110 - h, -110 + h)) for h in (50, 30, 8, 3, 0.2)]
        results = []
        for seed in range(5):
            shuffled = rows[:]
            random.Random(seed).shuffle(shuffled)
            acc = T._ClvEventAccumulator()
            self._event(acc, rows=shuffled)
            samples, _ = self._samples(acc)
            results.append(sorted((round(s[0]["minutes_to_game"], 3), round(s[1], 9)) for s in samples))
        assert all(r == results[0] for r in results) and len(results[0]) == 4

    def test_a_game_split_across_mongo_and_parquet_is_one_event_with_its_true_open_and_close(self):
        """The old code scored it twice, each from a partial timeline."""
        c = self.START
        parquet_part = [(c - timedelta(hours=60), h2h(-105, -105)), (c - timedelta(hours=40), h2h(-115, -100))]
        mongo_part = [(c - timedelta(hours=5), h2h(-130, 105)), (c - timedelta(minutes=5), h2h(-160, 135))]
        acc = T._ClvEventAccumulator()
        for ts, o in parquet_part:
            acc.add("E1", ts, c.isoformat(), o)
        for ts, o in mongo_part:
            acc.add("E1", ts, c.isoformat(), o)
        samples, f = self._samples(acc)
        assert f["events_seen"] == 1 and f["events_used"] == 1
        close = dec_avg(h2h(-160, 135))
        earliest = [s for s in samples if round(s[0]["minutes_to_game"]) == 60 * 60]
        assert len(earliest) == 1 and earliest[0][1] == pytest.approx(close - dec_avg(h2h(-105, -105)))

    def test_upcoming_games_are_excluded_because_they_have_no_closing_line_yet(self):
        acc = T._ClvEventAccumulator()
        future = NOW + timedelta(hours=6)
        self._event(acc, commence=future, rows=[(NOW - timedelta(hours=30), h2h(-110, -110)), (NOW - timedelta(hours=1), h2h(-120, 100))])
        samples, f = self._samples(acc)
        assert samples == [] and f["events_not_started"] == 1

    def test_closing_line_is_the_last_price_before_the_game_not_an_in_play_price(self):
        c = self.START
        acc = T._ClvEventAccumulator()
        self._event(acc, rows=[(c - timedelta(hours=10), h2h(-110, -110)), (c - timedelta(minutes=20), h2h(-140, 120)),
                               (c + timedelta(minutes=45), h2h(-900, 500))])          # live betting after kickoff
        samples, _ = self._samples(acc)
        assert samples[0][1] == pytest.approx(dec_avg(h2h(-140, 120)) - dec_avg(h2h(-110, -110)))

    def test_events_watched_for_under_an_hour_are_dropped(self):
        c = self.START
        acc = T._ClvEventAccumulator()
        self._event(acc, rows=[(c - timedelta(minutes=50), h2h(-110, -110)), (c - timedelta(minutes=5), h2h(-130, 110))])
        samples, f = self._samples(acc)
        assert samples == [] and f["events_too_short"] == 1

    def test_one_sample_per_lead_time_band_taking_the_earliest_in_each(self):
        c = self.START
        acc = T._ClvEventAccumulator()
        # bands: <1h | 1-6h | 6-24h | 24-48h | >48h. The last row (0.2h) is the closing line itself.
        self._event(acc, rows=[(c - timedelta(hours=h), h2h(-110 - int(h), -110)) for h in (20, 18, 12, 7, 5, 4, 2, 0.8, 0.2)])
        samples, _ = self._samples(acc)
        # one sample per band, the earliest in each: 20h (6-24h), 5h (1-6h), 0.8h (<1h); never the closing row
        assert sorted(round(s[0]["minutes_to_game"] / 60, 2) for s in samples) == [0.8, 5.0, 20.0]

    def test_snapshots_without_comparable_books_yield_nothing(self):
        c = self.START
        acc = T._ClvEventAccumulator()
        self._event(acc, rows=[(c - timedelta(hours=10), h2h(-110, -110, "draftkings")), (c - timedelta(minutes=5), h2h(-130, 110, "fanduel"))])
        samples, f = self._samples(acc)
        assert samples == [] and f["events_no_usable_slice"] == 1


class TestAgainstIndependentImplementation:
    """Build the dataset from real archiver output + mongomock, then recompute the answer a different way."""

    def test_dataset_matches_a_straightforward_pandas_computation(self, world, monkeypatch):
        db, meta, all_snaps, _ = world
        monkeypatch.setattr(T, "MIN_TRAINING_ROWS", 10)
        monkeypatch.setattr(T, "CLV_MIN_EVENTS", 5)
        X, y, groups, info = T.build_clv_dataset(db)
        assert X is not None

        now = datetime.now(UTC)
        rows = []
        for eid, g in pd.DataFrame([{"eid": s["event_id"], "ts": s["fetched_at"].replace(tzinfo=UTC), "h2h": s["book_odds"]["h2h"],
                                     "commence": datetime.fromisoformat(s["commence_time"].replace("Z", "+00:00"))}
                                    for s in all_snaps if not s.get("is_duplicate")]).groupby("eid"):
            g = g.sort_values("ts")
            commence = g["commence"].iloc[-1]
            if commence > now or len(g) < 2:
                continue
            pre = g[g["ts"] <= commence]
            close = (pre if len(pre) else g).iloc[-1]
            if (close["ts"] - g["ts"].iloc[0]).total_seconds() < 3600:
                continue
            seen = {}
            for _, r in g.iterrows():
                mtg = (commence - r["ts"]).total_seconds() / 60
                if mtg < 0 or r["ts"] >= close["ts"]:
                    continue
                band = T._lead_band(mtg)
                seen.setdefault(band, (mtg, r["h2h"]))
            for band, (mtg, h) in seen.items():
                shifts = []
                for sel, books in h.items():
                    cb = close["h2h"].get(sel)
                    common = set(books) & set(cb or {})
                    if common:
                        shifts.append(np.mean([american_to_decimal(cb[b]) for b in common]) - np.mean([american_to_decimal(books[b]) for b in common]))
                if shifts:
                    rows.append((eid, round(mtg, 1), round(float(np.mean(shifts)), 5)))
        got = sorted(zip(groups, X["minutes_to_game"].round(1), y.round(5)))
        assert len(got) == len(rows) > 50
        for a, b in zip(got, sorted(rows)):
            assert a[0] == b[0] and abs(a[1] - b[1]) < 0.1 and abs(a[2] - b[2]) < 1e-3, (a, b)

    def test_no_team_named_columns_and_no_column_is_a_copy_of_the_label(self, world, monkeypatch):
        db = world[0]
        monkeypatch.setattr(T, "MIN_TRAINING_ROWS", 10)
        monkeypatch.setattr(T, "CLV_MIN_EVENTS", 5)
        X, y, groups, info = T.build_clv_dataset(db)
        assert len(X.columns) <= 15 and not any("team" in c.lower() for c in X.columns)
        for c in X.columns:
            if X[c].std() > 0:
                assert abs(np.corrcoef(X[c], y)[0, 1]) < 0.5, f"{c} tracks the label too closely"

    def test_funnel_explains_where_data_went(self, world, monkeypatch):
        db = world[0]
        monkeypatch.setattr(T, "MIN_TRAINING_ROWS", 10**6)          # force a shortfall
        r = T.train_clv_model(db)
        assert r["success"] is False and r["reason"] == "insufficient_data"
        assert "samples" in r["detail"] and "finished games" in r["detail"]
        f = r["funnel"]
        # An archive written by the FIXED archiver loses nothing: no real snapshot is missing its odds.
        assert f["parquet"]["files_read"] > 0 and f["parquet"]["rows_odds_lost"] == 0
        assert f["events_seen"] == f["events_not_started"] + f["events_too_short"] + f["events_no_usable_slice"] + f["events_used"]
