from datetime import datetime, timedelta, timezone

import mongomock
import numpy as np
import pandas as pd
import pytest

import ml.models.train as T

BASE = datetime.now(timezone.utc).replace(tzinfo=None) - timedelta(days=3)


def mv(eid, sel, book, minute, sharp, up=True, prob=0.01, market="h2h"):
    return {"event_id": eid, "market": market, "selection": sel, "book": book, "is_sharp_book": sharp,
            "timestamp": BASE + timedelta(minutes=minute), "prob_change": prob if up else -prob, "moved_up": up, "seconds_since_prev": 300.0}


def db_with(moves):
    db = mongomock.MongoClient()["t"]
    db["line_movements"].insert_many(moves)
    return db


def test_labels_follow_who_moved_first_and_same_poll_ties_are_skipped(monkeypatch):
    monkeypatch.setattr(T, "MIN_TRAINING_ROWS", 1)
    monkeypatch.setattr(T, "SHARP_MIN_PER_CLASS", 1)
    db = db_with([
        mv("e1", "A", "pinnacle", 0, True), mv("e1", "A", "draftkings", 10, False),           # sharp first  -> 1
        mv("e2", "A", "draftkings", 0, False), mv("e2", "A", "pinnacle", 10, True),           # soft first   -> 0
        mv("e3", "A", "pinnacle", 5, True), mv("e3", "A", "fanduel", 5, False),               # same poll    -> skipped
        mv("e4", "A", "pinnacle", 0, True),                                                    # no soft move -> not a sample
        mv("e5", "A", "fanduel", 0, False),                                                    # no sharp move -> not a sample
    ])
    X, y, info = T.build_sharp_money_dataset(db)
    assert sorted(y) == [0, 1]
    assert info["ties_skipped"] == 1 and info["groups_with_both"] == 3 and info["samples"] == 2


def test_regression_the_label_is_no_longer_a_constant(monkeypatch):
    """The original code produced y == 1 for every row because it never loaded a soft-book movement."""
    monkeypatch.setattr(T, "MIN_TRAINING_ROWS", 1)
    monkeypatch.setattr(T, "SHARP_MIN_PER_CLASS", 1)
    moves = []
    for i in range(40):
        sharp_first = i % 3 != 0
        moves += [mv(f"e{i}", "A", "pinnacle", 0 if sharp_first else 20, True), mv(f"e{i}", "A", "draftkings", 20 if sharp_first else 0, False)]
    X, y, info = T.build_sharp_money_dataset(db_with(moves))
    assert y.nunique() == 2 and 0.5 < y.mean() < 0.8


def test_features_keep_the_names_predict_py_supplies(monkeypatch):
    monkeypatch.setattr(T, "MIN_TRAINING_ROWS", 1); monkeypatch.setattr(T, "SHARP_MIN_PER_CLASS", 1)
    db = db_with([mv("e1", "A", "pinnacle", 0, True, prob=0.02), mv("e1", "A", "pinnacle", 5, True, up=False, prob=0.01),
                  mv("e1", "A", "draftkings", 10, False, prob=0.03), mv("e2", "A", "draftkings", 0, False), mv("e2", "A", "pinnacle", 9, True)])
    X, y, _ = T.build_sharp_money_dataset(db)
    assert list(X.columns) == ["n_sharp_moves", "avg_prob_change", "max_prob_change", "total_moves", "sharp_ratio", "moved_up_ratio", "velocity"]
    r = X.iloc[0] if y.iloc[0] == 1 else X.iloc[1]                     # e1: sharp led
    assert r["n_sharp_moves"] == 2 and r["total_moves"] == 3 and r["sharp_ratio"] == pytest.approx(2 / 3)
    assert r["max_prob_change"] == pytest.approx(0.03) and r["moved_up_ratio"] == pytest.approx(2 / 3)


def test_old_window_movements_are_excluded(monkeypatch):
    monkeypatch.setattr(T, "MIN_TRAINING_ROWS", 1); monkeypatch.setattr(T, "SHARP_MIN_PER_CLASS", 1)
    old = BASE - timedelta(days=60)
    stale = [dict(mv("old", "A", "pinnacle", 0, True), timestamp=old), dict(mv("old", "A", "fanduel", 9, False), timestamp=old)]
    X, y, info = T.build_sharp_money_dataset(db_with(stale + [mv("e1", "A", "pinnacle", 0, True), mv("e1", "A", "fanduel", 9, False)]))
    assert info["samples"] == 1


def test_one_sided_data_is_reported_instead_of_trained(monkeypatch):
    monkeypatch.setattr(T, "MIN_TRAINING_ROWS", 10)
    moves = []
    for i in range(30):                                                   # sharp always first
        moves += [mv(f"e{i}", "A", "pinnacle", 0, True), mv(f"e{i}", "A", "fanduel", 9, False)]
    r = T.train_sharp_money_model(db_with(moves))
    assert r["success"] is False and r["reason"] == "single_class" and "30" in r["detail"]


def test_too_little_data_says_how_much(monkeypatch):
    moves = [mv("e1", "A", "pinnacle", 0, True), mv("e1", "A", "fanduel", 9, False), mv("e2", "A", "fanduel", 0, False), mv("e2", "A", "pinnacle", 9, True)]
    r = T.train_sharp_money_model(db_with(moves))
    assert r["success"] is False and r["reason"] == "insufficient_data" and "needs 500" in r["detail"]


def test_pipeline_matches_independent_pandas_on_a_production_shaped_world(world):
    db, meta, snaps, moves = world
    db["line_movements"].insert_many([dict(m) for m in moves])
    got = [g for g in db["line_movements"].aggregate(T._sharp_group_pipeline(T.cutoff_date()), allowDiskUse=True)
           if g["first_sharp"] < T._NEVER and g["first_soft"] < T._NEVER]        # groups where both kinds moved
    df = pd.DataFrame(moves)
    df = df[df["timestamp"] >= T.cutoff_date().replace(tzinfo=None)]
    ref = {}
    for (e, m, s), g in df.groupby(["event_id", "market", "selection"]):
        sh, so = g[g.is_sharp_book == True], g[g.is_sharp_book == False]
        if sh.empty or so.empty:
            continue
        ref[(e, m, s)] = (len(g), len(sh), sh.timestamp.min().floor("ms"), so.timestamp.min().floor("ms"), int((g.moved_up == True).sum()))
    assert len(got) == len(ref) > 20
    for g in got:
        k = (g["_id"]["event_id"], g["_id"]["market"], g["_id"]["selection"])
        assert (g["n_total"], g["n_sharp"], g["first_sharp"], g["first_soft"], g["n_up"]) == ref[k]
