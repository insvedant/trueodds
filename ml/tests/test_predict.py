import numpy as np
import pandas as pd
import pytest
from sklearn.ensemble import HistGradientBoostingClassifier

import ml.models.predict as P


from ml.features import CLV_FEATURE_COLUMNS, clv_market_rows


class FakeModel:
    def __init__(self, values):
        self.values = values

    def predict(self, X):
        return np.full(len(X), float(self.values)) if np.isscalar(self.values) else np.asarray(self.values, dtype=float)[:len(X)]


def clv_payload(model, target="soft_price_relative_shift"):
    meta = {"features": CLV_FEATURE_COLUMNS}
    if target:
        meta["target"] = target
    return {"model": model, "metadata": meta}


# Pinnacle is the 50/50 reference. draftkings Home +105 pays MORE than fair (a +2.5% edge): the best price on offer.
MARKET = {"Home": {"pinnacle": -110, "draftkings": 105, "fanduel": -115}, "Away": {"pinnacle": -110, "draftkings": -125, "fanduel": -105}}


def live(h2h=MARKET):
    return {"_h2h": h2h, "minutes_to_game": 600.0, "sport": "x", "home": "h", "away": "a"}


@pytest.mark.parametrize("pred, direction, advice_start", [
    (-0.03, "worse", "Bet now"),          # the edge is expected to SHRINK as the soft book catches up with the sharp line
    (+0.03, "better", "Wait"),            # the edge is expected to GROW
    (0.002, "stable", "Price likely stable"),
])
def test_clv_advice_points_the_right_way(monkeypatch, pred, direction, advice_start):
    monkeypatch.setattr(P, "load_model", lambda name: clv_payload(FakeModel(pred)))
    out = P.predict_clv(live())
    assert out["available"] and out["direction"] == direction and out["advice"].startswith(advice_start) and out["value"] == pytest.approx(pred)


def test_the_advice_is_about_the_best_value_price_and_carries_what_the_insights_page_shows(monkeypatch):
    rows = clv_market_rows(MARKET, 600.0)
    best = max(range(len(rows)), key=lambda i: rows[i]["value_vs_fair"])
    preds = [0.0] * len(rows)
    preds[best] = -0.04                                    # only the best price is expected to decay
    monkeypatch.setattr(P, "load_model", lambda name: clv_payload(FakeModel(preds)))
    out = P.predict_clv(live())
    assert (out["best_book"], out["selection"], out["book_odds"], out["fair_odds"]) == ("draftkings", "Home", "+105", "+100")
    assert out["ev_pct"] == pytest.approx(2.5) and out["direction"] == "worse"
    assert "draftkings" in out["reason"] and "toward the sharp line" in out["reason"]


def test_a_model_saved_by_the_old_version_is_refused_not_used(monkeypatch):
    """The old model predicted a different quantity (and leaked its own answer): its advice would be misleading."""
    monkeypatch.setattr(P, "load_model", lambda name: clv_payload(FakeModel(-0.5), target=None))
    assert P.predict_clv(live()) == {"available": False, "reason": "model_outdated"}


def test_clv_is_unavailable_without_a_model_or_without_prices(monkeypatch):
    monkeypatch.setattr(P, "load_model", lambda name: None)
    assert P.predict_clv(live())["reason"] == "model_not_trained"
    monkeypatch.setattr(P, "load_model", lambda name: clv_payload(FakeModel(0.1)))
    assert P.predict_clv({"minutes_to_game": 60})["reason"] == "no_comparable_prices"
    assert P.predict_clv(live({"Home": {"pinnacle": -110}}))["reason"] == "no_comparable_prices"


def test_a_model_that_raises_is_reported_not_propagated(monkeypatch):
    class Broken:
        def predict(self, X): raise ValueError("shape mismatch")
    monkeypatch.setattr(P, "load_model", lambda name: clv_payload(Broken()))
    out = P.predict_clv(live())
    assert out["available"] is False and "shape mismatch" in out["reason"]


def test_end_to_end_a_model_trained_where_soft_books_lag_the_sharp_line_says_bet_now_on_a_price_above_fair(world, monkeypatch):
    """Train on the production-shaped synthetic archive, then ask about two live markets. In this market the soft books
    follow the sharp line with a delay by construction, so a price above fair should be called as shrinking and one
    below fair as growing. (This proves the pipeline end to end; it says nothing about your real market.)"""
    import ml.models.train as T
    db = world[0]
    monkeypatch.setattr(T, "MIN_TRAINING_ROWS", 80)
    monkeypatch.setattr(T, "CLV_MIN_EVENTS", 40)
    result = T.train_clv_model(db)
    assert result["success"], result
    P._MODEL_CACHE.clear()
    above = {"Home": {"pinnacle": -110, "bookA": 125}, "Away": {"pinnacle": -110, "bookA": -150}}        # bookA pays +8% over fair on Home
    below = {"Home": {"pinnacle": -110, "bookA": -135}, "Away": {"pinnacle": -110, "bookA": 115}}        # bookA pays well under fair on Home
    hi, lo = P.predict_clv(live(above)), P.predict_clv(live(below))
    assert hi["available"] and lo["available"]
    assert hi["selection"] == "Home" and hi["value"] < 0 and hi["direction"] == "worse"
    assert lo["value"] > hi["value"]


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
