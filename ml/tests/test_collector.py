"""The real collect_snapshot() driven by a scripted odds feed with KNOWN price changes."""
import asyncio
import copy
import random
import time
from datetime import datetime, timedelta, timezone

import mongomock
import pytest

import ml.collect_data as C


def game(prices):
    def book(key):
        return {"key": key, "markets": [{"key": "h2h", "outcomes": [{"name": "Home", "price": prices[key][0]}, {"name": "Away", "price": prices[key][1]}]}]}
    return {"id": "g1", "home_team": "Home", "away_team": "Away", "commence_time": "2099-01-01T00:00:00Z", "sport_title": "NBA",
            "bookmakers": [book("pinnacle"), book("draftkings")]}


def scripted(cycles=80, seed=4, p_change=0.2):
    rng, state, seq = random.Random(seed), {"pinnacle": [-110, -110], "draftkings": [-115, -105]}, []
    for _ in range(cycles):
        if rng.random() < p_change:
            b = rng.choice(["pinnacle", "draftkings"]); step = rng.choice([-5, 5])
            state[b] = [state[b][0] + step, state[b][1] - step]
        seq.append(copy.deepcopy(state))
    return seq


@pytest.fixture()
def collector(monkeypatch):
    db = mongomock.MongoClient()["t"]
    monkeypatch.setattr(C, "get_db", lambda: db)
    monkeypatch.setattr(C, "TRACKED_SPORTS", ["basketball_nba"])
    monkeypatch.setattr(C, "TRACKED_BOOKS", list(set(C.TRACKED_BOOKS) | {"pinnacle", "draftkings"}))

    def play(seq, pause=0.004):
        it = iter(seq)
        async def fake_fetch(sport, client): return [game(next(it))]
        monkeypatch.setattr(C, "fetch_odds_for_sport", fake_fetch)
        for _ in seq:
            asyncio.run(C.collect_snapshot()); time.sleep(pause)
    return db, play


def test_unchanged_cycles_store_a_marker_never_a_second_full_copy(collector):
    db, play = collector
    seq = scripted()
    play(seq)
    docs = sorted(db["odds_snapshots"].find(), key=lambda d: d["fetched_at"])
    real = [d for d in docs if not d["is_duplicate"]]
    changes = sum(1 for a, b in zip(seq, seq[1:]) if a != b)
    assert len(real) == changes + 1                                       # the first sighting plus one per genuine change
    assert all(a["book_odds"] != b["book_odds"] for a, b in zip(real, real[1:]))     # (the old collector stored 25 exact copies)
    assert len(docs) == len(seq)


def test_markers_always_point_straight_at_a_real_snapshot(collector):
    db, play = collector
    play(scripted())
    ids = {d["_id"]: d for d in db["odds_snapshots"].find()}
    markers = [d for d in ids.values() if d["is_duplicate"]]
    assert markers and all(not ids[m["duplicate_of"]]["is_duplicate"] for m in markers)       # no marker -> marker chains


def test_every_price_move_is_recorded_as_a_line_movement(collector):
    db, play = collector
    seq = scripted()
    play(seq)
    truth = sum(2 for a, b in zip(seq, seq[1:]) if a != b)                # each change moves one book's two selections
    assert db["line_movements"].count_documents({}) == truth             # the old collector recorded 22 of 40


def test_the_first_move_after_a_quiet_spell_is_not_lost(collector):
    db, play = collector
    s0 = {"pinnacle": [-110, -110], "draftkings": [-115, -105]}
    s1 = {"pinnacle": [-120, 100], "draftkings": [-115, -105]}
    play([s0, s0, s0, s1])                                                # three identical cycles, then pinnacle moves
    moved = list(db["line_movements"].find())
    assert len(moved) == 2 and {m["book"] for m in moved} == {"pinnacle"} and all(m["is_sharp_book"] for m in moved)


def test_seconds_since_prev_is_time_since_the_last_observation_not_since_the_old_snapshot(collector):
    db, play = collector
    s0 = {"pinnacle": [-110, -110], "draftkings": [-115, -105]}
    s1 = {"pinnacle": [-120, 100], "draftkings": [-115, -105]}
    play([s0, s0, s0, s1], pause=0.3)
    gaps = [m["seconds_since_prev"] for m in db["line_movements"].find()]
    assert gaps and all(0.15 < g < 0.55 for g in gaps), gaps               # one 0.3s poll gap, not the ~0.9s since the real snapshot


def test_when_the_referenced_snapshot_is_gone_the_collector_stores_a_fresh_full_snapshot(collector):
    db, play = collector
    s0 = {"pinnacle": [-110, -110], "draftkings": [-115, -105]}
    play([s0, s0])
    real = db["odds_snapshots"].find_one({"is_duplicate": False})
    db["odds_snapshots"].delete_one({"_id": real["_id"]})                  # archived away
    play([s0])
    newest = max(db["odds_snapshots"].find(), key=lambda d: d["fetched_at"])
    assert newest["is_duplicate"] is False and "book_odds" in newest


class TestStorageGuardSwitch:
    def test_paused_collection_writes_nothing(self, collector):
        db, play = collector
        db["ml_stats"].insert_one({"_id": "storage_guard", "paused": True, "reason": "MongoDB at 95%"})
        play([{"pinnacle": [-110, -110], "draftkings": [-115, -105]}] * 3)
        assert db["odds_snapshots"].count_documents({}) == 0 and db["line_movements"].count_documents({}) == 0

    def test_resumes_as_soon_as_the_flag_clears(self, collector):
        db, play = collector
        db["ml_stats"].insert_one({"_id": "storage_guard", "paused": True})
        play([{"pinnacle": [-110, -110], "draftkings": [-115, -105]}])
        db["ml_stats"].update_one({"_id": "storage_guard"}, {"$set": {"paused": False}})
        play([{"pinnacle": [-110, -110], "draftkings": [-115, -105]}])
        assert db["odds_snapshots"].count_documents({}) == 1
