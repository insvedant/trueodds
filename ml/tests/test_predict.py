import numpy as np
import pandas as pd
import pytest
from sklearn.ensemble import HistGradientBoostingClassifier

import ml.models.predict as P


class FakeClv:
    def __init__(self, value): self.value = value
    def predict(self, X): return np.array([self.value])


@pytest.mark.parametrize("pred, direction, advice_start", [
    (+0.20, "better", "Wait"),        # decimal odds expected to LENGTHEN (pay more) -> waiting is better
    (-0.20, "worse", "Bet now"),      # decimal odds expected to SHORTEN -> bet now
    (0.01, "stable", "Odds likely stable"),
])
def test_clv_advice_points_the_right_way(monkeypatch, pred, direction, advice_start):
    monkeypatch.setattr(P, "load_model", lambda name: {"model": FakeClv(pred)})
    out = P.predict_clv({"combined_implied_prob": 1.02})
    assert out["available"] and out["direction"] == direction and out["advice"].startswith(advice_start)


def test_clv_advice_matches_the_sign_of_the_training_label():
    """label = closing decimal odds - earlier decimal odds. If the price lengthened, the label is positive and waiting was right."""
    from ml.features import american_to_decimal
    earlier, closing = american_to_decimal(-130), american_to_decimal(-110)
    assert closing - earlier > 0           # -130 -> -110 pays more: price lengthened, label positive


def test_sharp_prediction_survives_a_different_set_of_trained_columns(monkeypatch):
    rng = np.random.RandomState(0)
    cols = ["n_sharp_moves", "avg_prob_change", "total_moves", "sharp_ratio"]          # a model trained without two of the usual columns
    X = pd.DataFrame(rng.rand(200, 4), columns=cols); y = (X["sharp_ratio"] > 0.5).astype(int)
    model = HistGradientBoostingClassifier(max_iter=10).fit(X, y)
    monkeypatch.setattr(P, "load_model", lambda name: {"model": model})
    out = P.predict_sharp_money({"sharp_movements": 3, "total_movements": 5, "avg_prob_change": 0.01, "max_prob_change": 0.02, "movement_velocity": 1.0})
    assert out.get("available", True) is not False, out


# ---------------------------------------------------------------------------------------------
# Speed: models are cached between calls, and unchanged events are not re-predicted every cycle
# ---------------------------------------------------------------------------------------------
import os
from datetime import datetime, timedelta, timezone

import mongomock


class TestModelCache:
    def test_a_model_file_is_read_once_not_once_per_event(self, isolated_models, monkeypatch):
        P._MODEL_CACHE.clear()
        (isolated_models / "demo.joblib").write_bytes(b"x")
        loads = []
        monkeypatch.setattr(P, "load_model", lambda name: loads.append(name) or {"model": object()})
        first = P._cached_load("demo")
        for _ in range(300):
            assert P._cached_load("demo") is first
        assert loads == ["demo"]

    def test_a_retrained_model_is_picked_up_without_restarting(self, isolated_models, monkeypatch):
        P._MODEL_CACHE.clear()
        path = isolated_models / "demo.joblib"
        path.write_bytes(b"x")
        monkeypatch.setattr(P, "load_model", lambda name: {"model": object()})
        old = P._cached_load("demo")
        stat = path.stat()
        os.utime(path, ns=(stat.st_atime_ns, stat.st_mtime_ns + 5_000_000_000))        # the file is rewritten by a training run
        assert P._cached_load("demo") is not old

    def test_a_model_that_is_not_on_disk_is_never_cached(self, isolated_models, monkeypatch):
        P._MODEL_CACHE.clear()
        loads = []
        monkeypatch.setattr(P, "load_model", lambda name: loads.append(name) or None)
        P._cached_load("absent"); P._cached_load("absent")
        assert loads == ["absent", "absent"]


FIXED_NOW = datetime(2026, 10, 8, 15, 0, tzinfo=timezone.utc)


class _Frozen(datetime):
    @classmethod
    def now(cls, tz=None):
        return FIXED_NOW if tz else FIXED_NOW.replace(tzinfo=None)


def naive(minutes_ago):
    return (FIXED_NOW - timedelta(minutes=minutes_ago)).replace(tzinfo=None)


class TestSkipUnchangedEvents:
    def build(self, monkeypatch):
        db = mongomock.MongoClient()["t"]
        monkeypatch.setattr(P, "get_db", lambda: db)
        monkeypatch.setattr(P, "datetime", _Frozen)
        computed = []
        monkeypatch.setattr(P, "build_features_for_event", lambda eid, d: computed.append(eid) or {"sport": "x", "home": "h", "away": "a"})
        monkeypatch.setattr(P, "predict_clv", lambda f: {"available": True})
        monkeypatch.setattr(P, "predict_sharp_money", lambda f: {"available": True})
        monkeypatch.setattr(P, "predict_arb_window", lambda a: {"available": True})

        def event(eid, snapshot_age, predicted_age=None, marker_age=None):
            db["odds_snapshots"].insert_one({"event_id": eid, "fetched_at": naive(snapshot_age), "is_duplicate": False, "book_odds": {"h2h": {}}})
            if marker_age is not None:
                db["odds_snapshots"].insert_one({"event_id": eid, "fetched_at": naive(marker_age), "is_duplicate": True})
            if predicted_age is not None:
                db["ml_predictions"].insert_one({"event_id": eid, "generated_at": naive(predicted_age)})
        return db, computed, event

    def test_only_events_that_need_it_are_recomputed(self, monkeypatch):
        db, computed, event = self.build(monkeypatch)
        event("same",    snapshot_age=5,  predicted_age=1)                       # nothing new since the last prediction
        event("changed", snapshot_age=1,  predicted_age=3)                       # a new real snapshot since
        event("stale",   snapshot_age=40, predicted_age=20)                      # unchanged, but older than the 15-minute refresh
        event("arb",     snapshot_age=5,  predicted_age=1)                       # has an open arbitrage
        event("new",     snapshot_age=2)                                         # never predicted
        event("marker",  snapshot_age=10, predicted_age=3, marker_age=1)         # only an "unchanged" marker arrived
        db["arb_history"].insert_one({"event_id": "arb", "resolved_at": None, "profit_pct": 1.2})
        stored = P.generate_all_predictions()
        assert sorted(computed) == ["arb", "changed", "new", "stale"] and stored == 4
        assert db["ml_predictions"].count_documents({}) == 6                     # every event still has a prediction

    def test_a_second_run_straight_after_does_no_work(self, monkeypatch):
        db, computed, event = self.build(monkeypatch)
        for eid in ("a", "b", "c"):
            event(eid, snapshot_age=30)
        assert P.generate_all_predictions() == 3
        computed.clear()
        assert P.generate_all_predictions() == 0 and computed == []

    def test_a_resolved_arbitrage_does_not_force_recomputation(self, monkeypatch):
        db, computed, event = self.build(monkeypatch)
        event("x", snapshot_age=5, predicted_age=1)
        db["arb_history"].insert_one({"event_id": "x", "resolved_at": naive(2), "profit_pct": 1.0})
        assert P.generate_all_predictions() == 0
