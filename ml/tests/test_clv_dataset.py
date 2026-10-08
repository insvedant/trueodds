import random
from datetime import datetime, timedelta, timezone

import numpy as np
import pandas as pd
import pytest

import ml.models.train as T
from ml.features import american_to_decimal

UTC = timezone.utc
NOW = datetime(2026, 10, 8, 12, 0, tzinfo=UTC)
START = NOW - timedelta(days=2)                      # the game started two days ago


def h2h(a_home, a_away, book="pinnacle"):
    return {"Home": {book: a_home}, "Away": {book: a_away}}


def dec_avg(h):
    return float(np.mean([american_to_decimal(list(b.values())[0]) for b in h.values()]))


def hours_before(h):
    return START - timedelta(hours=h)


def funnel():
    return {"events_seen": 0, "events_not_started": 0, "events_too_short": 0, "events_no_usable_slice": 0, "events_used": 0}


def samples(acc, now=NOW):
    f = funnel()
    return list(acc.samples(now, f)), f


def event(acc, eid="E1", commence=START, rows=(), watched=None):
    """rows = real snapshots (time, odds); watched = (first, last) times the event was observed, markers included."""
    c = commence.isoformat().replace("+00:00", "Z")
    for ts, odds in rows:
        acc.add(eid, ts, c, odds)
    if watched:
        acc.observe(eid, watched[0], watched[1], c)


class TestAccumulator:
    def test_label_is_the_closing_price_minus_the_price_as_of_each_lead_time(self):
        acc = T._ClvEventAccumulator()
        p0, p1, p2, close = h2h(-105, -105), h2h(-115, -100), h2h(-130, 110), h2h(-150, 125)
        event(acc, rows=[(hours_before(60), p0), (hours_before(30), p1), (hours_before(3), p2), (hours_before(0.17), close)])
        out, f = samples(acc)
        got = {round(s[0]["minutes_to_game"]): s[1] for s in out}
        c = dec_avg(close)
        # as of 48h out: the 60h-old price | 24h: the 30h price | 6h: still the 30h price (the 3h one came later) | 1h: the 3h price
        assert got == {2880: pytest.approx(c - dec_avg(p0)), 1440: pytest.approx(c - dec_avg(p1)),
                       360: pytest.approx(c - dec_avg(p1)), 60: pytest.approx(c - dec_avg(p2))}
        assert f["events_used"] == 1

    def test_a_quiet_stretch_with_no_price_change_still_gives_samples(self):
        """With true de-duplication a game that never moves has ONE real snapshot; the old
        'first snapshot inside each band' rule found nothing for the bands it never changed in."""
        acc = T._ClvEventAccumulator()
        opening, close = h2h(-110, -110), h2h(-125, 105)
        event(acc, rows=[(hours_before(50), opening), (hours_before(0.1), close)], watched=(hours_before(50), hours_before(0.1)))
        out, _ = samples(acc)
        assert sorted(round(s[0]["minutes_to_game"]) for s in out) == [60, 360, 1440, 2880]
        assert all(s[1] == pytest.approx(dec_avg(close) - dec_avg(opening)) for s in out)

    def test_a_price_that_never_changed_is_a_zero_move_sample_not_a_missing_one(self):
        acc = T._ClvEventAccumulator()
        p = h2h(-110, -110)
        event(acc, rows=[(hours_before(50), p)], watched=(hours_before(50), hours_before(0.1)))
        out, _ = samples(acc)
        assert len(out) == 4 and all(s[1] == pytest.approx(0.0) for s in out)

    def test_samples_stop_where_tracking_stopped(self):
        acc = T._ClvEventAccumulator()
        event(acc, rows=[(hours_before(50), h2h(-110, -110))], watched=(hours_before(50), hours_before(30)))
        out, _ = samples(acc)
        assert [round(s[0]["minutes_to_game"]) for s in out] == [2880]    # watched at 48h out, but gone before the 24h/6h/1h marks

    def test_arrival_order_does_not_matter(self):
        rows = [(hours_before(h), h2h(-110 - int(h), -110 + int(h))) for h in (50, 30, 8, 3, 0.2)]
        results = []
        for seed in range(5):
            shuffled = rows[:]
            random.Random(seed).shuffle(shuffled)
            acc = T._ClvEventAccumulator()
            event(acc, rows=shuffled, watched=(hours_before(50), hours_before(0.2)))
            out, _ = samples(acc)
            results.append(sorted((round(s[0]["minutes_to_game"]), round(s[1], 9)) for s in out))
        assert all(r == results[0] for r in results) and len(results[0]) == 4

    def test_a_game_split_across_mongo_and_parquet_is_one_event_with_its_true_open_and_close(self):
        acc = T._ClvEventAccumulator()
        c = START.isoformat()
        for ts, o in [(hours_before(60), h2h(-105, -105)), (hours_before(40), h2h(-115, -100))]:        # older, from parquet
            acc.add("E1", ts, c, o)
        for ts, o in [(hours_before(5), h2h(-130, 105)), (hours_before(0.1), h2h(-160, 135))]:           # newer, from mongo
            acc.add("E1", ts, c, o)
        out, f = samples(acc)
        assert f["events_seen"] == 1 and f["events_used"] == 1
        earliest = [s for s in out if round(s[0]["minutes_to_game"]) == 2880]
        assert earliest[0][1] == pytest.approx(dec_avg(h2h(-160, 135)) - dec_avg(h2h(-105, -105)))

    def test_upcoming_games_are_excluded_because_they_have_no_closing_line_yet(self):
        acc = T._ClvEventAccumulator()
        future = NOW + timedelta(hours=6)
        event(acc, commence=future, rows=[(NOW - timedelta(hours=30), h2h(-110, -110)), (NOW - timedelta(hours=1), h2h(-120, 100))],
              watched=(NOW - timedelta(hours=30), NOW - timedelta(minutes=5)))
        out, f = samples(acc)
        assert out == [] and f["events_not_started"] == 1

    def test_closing_line_is_the_last_price_before_the_game_not_an_in_play_price(self):
        acc = T._ClvEventAccumulator()
        event(acc, rows=[(hours_before(10), h2h(-110, -110)), (hours_before(0.33), h2h(-140, 120)), (START + timedelta(minutes=45), h2h(-900, 500))],
              watched=(hours_before(10), START + timedelta(minutes=45)))
        out, _ = samples(acc)
        assert all(s[1] == pytest.approx(dec_avg(h2h(-140, 120)) - dec_avg(h2h(-110, -110))) for s in out if s[0]["minutes_to_game"] >= 360)

    def test_events_watched_for_under_an_hour_are_dropped(self):
        acc = T._ClvEventAccumulator()
        event(acc, rows=[(hours_before(0.8), h2h(-110, -110)), (hours_before(0.1), h2h(-130, 110))])
        out, f = samples(acc)
        assert out == [] and f["events_too_short"] == 1

    def test_snapshots_without_comparable_books_yield_nothing(self):
        acc = T._ClvEventAccumulator()
        event(acc, rows=[(hours_before(10), h2h(-110, -110, "draftkings")), (hours_before(0.1), h2h(-130, 110, "fanduel"))])
        out, f = samples(acc)
        assert out == [] and f["events_no_usable_slice"] == 1


def reference_dataset(all_snaps, now):
    """A deliberately plain re-implementation, from raw documents (real snapshots AND markers)."""
    rows = []
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
            state = before.iloc[-1]
            shifts = []
            for sel, books in state["h2h"].items():
                cb = close["h2h"].get(sel)
                common = set(books) & set(cb or {})
                if common:
                    shifts.append(np.mean([american_to_decimal(cb[b]) for b in common]) - np.mean([american_to_decimal(books[b]) for b in common]))
            if shifts:
                rows.append((eid, lead, round(float(np.mean(shifts)), 5)))
    return sorted(rows)


class TestAgainstIndependentImplementation:
    """Build the dataset from real archiver output + mongomock, then recompute the answer a different way."""

    def test_dataset_matches_a_straightforward_computation_from_the_raw_documents(self, world, monkeypatch):
        db, meta, all_snaps, _ = world
        monkeypatch.setattr(T, "MIN_TRAINING_ROWS", 10)
        monkeypatch.setattr(T, "CLV_MIN_EVENTS", 5)
        X, y, groups, info = T.build_clv_dataset(db)
        assert X is not None
        want = reference_dataset(all_snaps, datetime.now(UTC))
        got = sorted(zip(groups, X["minutes_to_game"].round().astype(int), y.round(5)))
        assert len(got) == len(want) > 100, (len(got), len(want))
        for a, b in zip(got, want):
            assert a[0] == b[0] and a[1] == b[1] and abs(a[2] - b[2]) < 1e-3, (a, b)

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
        assert f["parquet"]["files_read"] > 0 and f["parquet"]["rows_odds_lost"] == 0 and f["parquet"]["obs_rows"] > 0
        assert f["events_seen"] == f["events_not_started"] + f["events_too_short"] + f["events_no_usable_slice"] + f["events_used"]
