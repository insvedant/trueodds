import json
import os

import numpy as np
import pandas as pd
import pytest

import ml.models.train as T


def clv_dataset(signal: bool, n_events=60, per_event=4, seed=0):
    rng = np.random.RandomState(seed)
    n = n_events * per_event
    X = pd.DataFrame({"minutes_to_game": rng.uniform(10, 4000, n), "avg_odds_spread": rng.uniform(0, 1, n), "vig_estimate": rng.uniform(0, 0.1, n)})
    y = pd.Series((X["avg_odds_spread"] * 0.8 - 0.4 + rng.normal(0, 0.02, n)) if signal else rng.normal(0, 0.2, n))
    groups = pd.Series(np.repeat([f"e{i}" for i in range(n_events)], per_event))
    info = {"samples": n, "events_used": n_events, "window_days": 90, "needed_samples": 1, "needed_events": 1}
    return X, y, groups, info


@pytest.fixture()
def saved(isolated_models):
    return lambda name: os.path.exists(os.path.join(str(isolated_models), name + ".joblib"))


def test_clv_with_real_signal_beats_the_baseline_and_is_saved(monkeypatch, saved):
    monkeypatch.setattr(T, "build_clv_dataset", lambda db: clv_dataset(signal=True))
    r = T.train_clv_model(None)
    assert r["success"] and r["mae"] < r["baseline_mae"] and r["events"] == 60 and saved("clv_predictor")


def test_clv_with_no_signal_is_not_saved_and_says_so(monkeypatch, saved):
    monkeypatch.setattr(T, "build_clv_dataset", lambda db: clv_dataset(signal=False))
    r = T.train_clv_model(None)
    assert r["success"] is False and r["reason"] == "no_signal" and "not better than simply guessing" in r["detail"]
    assert not saved("clv_predictor")                                    # a useless model must not replace a working one


def test_the_gate_can_be_overridden(monkeypatch, saved):
    monkeypatch.setattr(T, "ALLOW_WEAK_MODELS", True)
    monkeypatch.setattr(T, "build_clv_dataset", lambda db: clv_dataset(signal=False))
    assert T.train_clv_model(None)["success"] and saved("clv_predictor")


def sharp_dataset(signal: bool, n=600, seed=1):
    rng = np.random.RandomState(seed)
    X = pd.DataFrame({"n_sharp_moves": rng.randint(1, 20, n), "avg_prob_change": rng.normal(0, 0.01, n), "max_prob_change": rng.uniform(0, 0.05, n),
                      "total_moves": rng.randint(2, 60, n), "sharp_ratio": rng.uniform(0, 1, n), "moved_up_ratio": rng.uniform(0, 1, n), "velocity": rng.uniform(0, 5, n)})
    y = pd.Series((X["sharp_ratio"] + rng.normal(0, 0.15, n) > 0.5).astype(int) if signal else rng.randint(0, 2, n))
    return X, y, {"samples": n, "ties_skipped": 3}


def test_sharp_with_signal_trains_and_reports_the_baseline(monkeypatch, saved):
    monkeypatch.setattr(T, "build_sharp_money_dataset", lambda db: sharp_dataset(True))
    r = T.train_sharp_money_model(None)
    assert r["success"] and r["cv_auc"] > 0.75 and r["accuracy"] < 1.0 and 0 < r["auc"] < 1 and "baseline_accuracy" in r and saved("sharp_money_detector")


def test_sharp_without_signal_is_not_saved(monkeypatch, saved):
    monkeypatch.setattr(T, "build_sharp_money_dataset", lambda db: sharp_dataset(False))
    r = T.train_sharp_money_model(None)
    assert r["success"] is False and r["reason"] == "no_signal" and "Cross-validated AUC" in r["detail"] and not saved("sharp_money_detector")


def test_dashboard_warning_conditions_are_gone_for_a_healthy_run(monkeypatch):
    """The admin page flags auc == 0 and accuracy == 1. A real run must trigger neither."""
    monkeypatch.setattr(T, "build_sharp_money_dataset", lambda db: sharp_dataset(True))
    r = T.train_sharp_money_model(None)
    assert r["auc"] != 0 and r["accuracy"] != 1


class TestOrchestrator:
    def test_a_crashing_model_does_not_stop_the_others_or_the_record(self, monkeypatch):
        import mongomock
        db = mongomock.MongoClient()["t"]
        monkeypatch.setattr(T, "get_db", lambda: db)
        def boom(_db): raise MemoryError("simulated out-of-memory in CLV")
        monkeypatch.setattr(T, "train_clv_model", boom)
        monkeypatch.setattr(T, "train_sharp_money_model", lambda _db: {"success": True, "accuracy": np.float32(0.61), "auc": np.float64(0.64)})
        monkeypatch.setattr(T, "train_arb_window_model", lambda _db: {"success": False, "reason": "insufficient_data"})
        monkeypatch.setattr(T, "train_ev_confidence_model", lambda _db: {"success": True, "accuracy": 0.86})
        res = T.train_all_models()
        assert res["clv"]["success"] is False and res["clv"]["reason"] == "error" and "MemoryError" in res["clv"]["detail"]
        assert res["sharp"]["success"] and res["ev_conf"]["success"]
        logged = db["ml_training_log"].find_one()
        assert logged is not None and set(logged["results"]) == {"clv", "sharp", "arb_window", "ev_conf"}   # the night is on record
        assert isinstance(logged["results"]["sharp"]["accuracy"], float)                                      # numpy values stored as plain numbers

    def test_log_write_failure_does_not_lose_the_results(self, monkeypatch):
        class Broken:
            def __getitem__(self, name): raise RuntimeError("mongo down")
        monkeypatch.setattr(T, "get_db", lambda: Broken())
        for name in ("train_clv_model", "train_sharp_money_model", "train_arb_window_model", "train_ev_confidence_model"):
            monkeypatch.setattr(T, name, lambda _db: {"success": True})
        assert all(r["success"] for r in T.train_all_models().values())
