"""
models/predict.py
────────────────────────────────────────────────────────────────────────────
Real-time prediction engine.
Called by the scheduler and FastAPI server to generate predictions.
Saves all predictions to MongoDB → Node.js backend reads them.
"""

import numpy as np
import pandas as pd
from datetime import datetime, timezone
from loguru import logger
from pymongo import MongoClient

import sys, os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(__file__))))
from ml.config import (
    MONGODB_URI, DB_NAME,
    MODEL_CLV, MODEL_SHARP, MODEL_ARB_WINDOW, MODEL_EV_CONF,
    COL_ODDS_SNAPSHOTS, COL_ML_PREDICTIONS, COL_ARB_HISTORY,
    SHARP_BOOKS,
)
from ml.features import (
    build_features_for_event,
    build_cross_book_features,
    build_line_movement_features,
    american_to_decimal,
    minutes_to_game,
)
from ml.models.train import load_model


def get_db():
    client = MongoClient(MONGODB_URI)
    return client[DB_NAME]


def get_feature_row(features: dict) -> pd.DataFrame:
    """Convert feature dict to single-row DataFrame for prediction."""
    row = {k: v for k, v in features.items()
           if isinstance(v, (int, float, bool)) and k not in ["event_id", "computed_at"]}
    return pd.DataFrame([row]).fillna(0)


def predict_clv(features: dict) -> dict:
    """
    Predict closing line value.
    Returns: { value: float, direction: 'better'|'worse'|'stable', confidence: float }
    """
    payload = load_model(MODEL_CLV)
    if not payload:
        return {"available": False, "reason": "model_not_trained"}

    model = payload["model"]
    X     = get_feature_row(features)

    # Align columns with training features
    trained_cols = getattr(model, "feature_names_in_", None)
    if trained_cols is not None:
        for col in trained_cols:
            if col not in X.columns:
                X[col] = 0
        X = X[trained_cols]

    try:
        pred = float(model.predict(X)[0])
    except Exception as e:
        logger.error(f"CLV prediction error: {e}")
        return {"available": False, "reason": str(e)}

    if pred > 0.05:
        direction = "worse"      # odds will shorten (less valuable)
        advice    = "Bet now — odds likely to get worse"
    elif pred < -0.05:
        direction = "better"     # odds will drift (more valuable)
        advice    = "Wait — odds may improve"
    else:
        direction = "stable"
        advice    = "Odds likely stable — bet when ready"

    return {
        "available":    True,
        "value":        round(pred, 4),
        "direction":    direction,
        "advice":       advice,
        "confidence":   min(1.0, abs(pred) * 10),
    }


def predict_sharp_money(features: dict) -> dict:
    """
    Predict if sharp money is behind current line movement.
    Returns: { is_sharp: bool, probability: float, signal_strength: str }
    """
    payload = load_model(MODEL_SHARP)
    if not payload:
        return {"available": False, "reason": "model_not_trained"}

    model = payload["model"]

    # Sharp money features only
    sharp_features = {
        "n_sharp_moves":    features.get("sharp_movements", 0),
        "avg_prob_change":  features.get("avg_prob_change", 0),
        "max_prob_change":  features.get("max_prob_change", 0),
        "total_moves":      features.get("total_movements", 0),
        "sharp_ratio":      features.get("sharp_movements", 0) / max(features.get("total_movements", 1), 1),
        "moved_up_ratio":   0.5,
        "velocity":         features.get("movement_velocity", 0),
    }

    X = pd.DataFrame([sharp_features]).fillna(0)

    try:
        prob     = float(model.predict_proba(X)[0][1])
        is_sharp = prob >= 0.6
    except Exception as e:
        return {"available": False, "reason": str(e)}

    if prob >= 0.75:
        strength = "strong"
        emoji    = "🔴"
    elif prob >= 0.55:
        strength = "moderate"
        emoji    = "🟡"
    else:
        strength = "weak"
        emoji    = "🟢"

    return {
        "available":       True,
        "is_sharp":        is_sharp,
        "probability":     round(prob, 3),
        "signal_strength": strength,
        "emoji":           emoji,
        "label":           f"{emoji} {'Sharp money detected' if is_sharp else 'No sharp signal'} ({strength})",
    }


def predict_arb_window(arb: dict) -> dict:
    """
    Predict how long an arb will last.
    Returns: { minutes: float, urgency: str, advice: str }
    """
    payload = load_model(MODEL_ARB_WINDOW)
    if not payload:
        return {"available": False, "reason": "model_not_trained"}

    model = payload["model"]
    legs  = arb.get("legs", [])
    books = [l.get("book", "") for l in legs]

    sport_enc = {
        "americanfootball_nfl": 1, "basketball_nba": 2,
        "baseball_mlb": 3, "icehockey_nhl": 4,
        "soccer_epl": 5, "mma_mixed_martial_arts": 6,
    }

    features = {
        "profit_pct":      arb.get("profit_pct", 0),
        "has_pinnacle":    int(any("pinnacle" in b for b in books)),
        "has_draftkings":  int(any("draftkings" in b for b in books)),
        "has_fanduel":     int(any("fanduel" in b for b in books)),
        "n_books":         len(legs),
        "sport_enc":       sport_enc.get(arb.get("sport", ""), 0),
        "high_profit":     int(arb.get("profit_pct", 0) >= 2.0),
    }

    X = pd.DataFrame([features]).fillna(0)

    try:
        minutes = max(0.5, float(model.predict(X)[0]))
    except Exception as e:
        return {"available": False, "reason": str(e)}

    if minutes <= 5:
        urgency = "critical"
        advice  = f"⚡ Act immediately — ~{int(minutes)}min left"
    elif minutes <= 15:
        urgency = "high"
        advice  = f"🔥 Act soon — ~{int(minutes)}min estimated"
    elif minutes <= 30:
        urgency = "medium"
        advice  = f"⏰ ~{int(minutes)} minutes estimated"
    else:
        urgency = "low"
        advice  = f"✅ ~{int(minutes)} minutes — no rush"

    return {
        "available": True,
        "minutes":   round(minutes, 1),
        "urgency":   urgency,
        "advice":    advice,
    }


def predict_ev_confidence(ev_bet: dict) -> dict:
    """
    Predict confidence score for a +EV bet.
    Returns: { confidence: float, grade: str, recommendation: str }
    """
    payload = load_model(MODEL_EV_CONF)
    if not payload:
        return {"available": False, "reason": "model_not_trained"}

    model = payload["model"]

    features = {
        "ev_pct":           ev_bet.get("ev", 0),
        "pin_prob":         1 / american_to_decimal(ev_bet.get("fair_odds_int", 0) or 200),
        "book_dec":         american_to_decimal(ev_bet.get("book_odds_int", 0) or 200),
        "sharp_agreement":  ev_bet.get("sharp_agreement", 0.03),
        "n_books":          ev_bet.get("n_books", 3),
        "has_movements":    ev_bet.get("has_movements", 0),
        "movement_count":   ev_bet.get("movement_count", 0),
        "high_ev":          int(ev_bet.get("ev", 0) >= 5.0),
    }

    X = pd.DataFrame([features]).fillna(0)

    try:
        prob = float(model.predict_proba(X)[0][1])
    except Exception as e:
        return {"available": False, "reason": str(e)}

    if prob >= 0.75:
        grade          = "A"
        recommendation = "High confidence — strong edge detected"
    elif prob >= 0.55:
        grade          = "B"
        recommendation = "Good edge — bet within Kelly sizing"
    elif prob >= 0.35:
        grade          = "C"
        recommendation = "Moderate edge — use smaller stake"
    else:
        grade          = "D"
        recommendation = "Low confidence — skip or bet minimum"

    return {
        "available":       True,
        "confidence":      round(prob, 3),
        "grade":           grade,
        "recommendation":  recommendation,
        "badge":           f"Grade {grade}",
    }


def generate_all_predictions():
    """
    Generate predictions for all current events and save to MongoDB.
    Called by scheduler every 5 minutes.
    """
    db     = get_db()
    now    = datetime.now(timezone.utc)
    stored = 0

    # Get recent events (last 24 hours)
    recent_events = db[COL_ODDS_SNAPSHOTS].distinct(
        "event_id",
        {"fetched_at": {"$gte": now.replace(hour=0, minute=0)}}
    )

    logger.info(f"Generating predictions for {len(recent_events)} events")

    for event_id in recent_events:
        features = build_features_for_event(event_id, db)
        if not features:
            continue

        # Get current arb for this event
        arb = db[COL_ARB_HISTORY].find_one(
            {"event_id": event_id, "resolved_at": None},
            sort=[("profit_pct", -1)]
        )

        # Generate all predictions
        predictions = {
            "event_id":    event_id,
            "sport":       features.get("sport", ""),
            "home":        features.get("home", ""),
            "away":        features.get("away", ""),
            "clv":         predict_clv(features),
            "sharp_money": predict_sharp_money(features),
            "arb_window":  predict_arb_window(arb) if arb else {"available": False},
            "generated_at": now,
        }

        # Upsert prediction
        db[COL_ML_PREDICTIONS].update_one(
            {"event_id": event_id},
            {"$set": predictions},
            upsert=True
        )
        stored += 1

    logger.success(f"Saved {stored} predictions to MongoDB")
    return stored


if __name__ == "__main__":
    count = generate_all_predictions()
    print(f"Generated {count} predictions")
