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
