"""
models/predict.py
────────────────────────────────────────────────────────────────────────────
Real-time prediction engine.
Called by the scheduler and FastAPI server to generate predictions.
Saves all predictions to MongoDB → Node.js backend reads them.
"""

import numpy as np
import pandas as pd
import time
from datetime import datetime, timedelta, timezone
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
from ml.features import parse_utc, clv_market_rows, CLV_FEATURE_COLUMNS, decimal_to_american

# Events whose odds haven't changed are re-predicted at most this often (the only thing that drifts
# for them is the time left before the game).
PREDICTION_REFRESH_MINUTES = float(os.environ.get("PREDICTION_REFRESH_MINUTES", 15))

_MODEL_CACHE: dict = {}


def _cached_load(name: str):
    """
    load_model() read the model file from disk on EVERY call: four loads per event, so 250 events
    meant ~1,000 file reads per run. Keep each model in memory instead, and reload it automatically
    when its file changes (i.e. after a retrain), so a long-running process still picks up new models.
    """
    from ml.models import train as _train
    path = os.path.join(_train.MODEL_DIR, f"{name}.joblib")
    try:
        stamp = os.stat(path).st_mtime_ns
    except OSError:
        return load_model(name)                       # not on disk (yet): let load_model fall back to MongoDB; don't cache
    hit = _MODEL_CACHE.get(name)
    if hit is not None and hit[0] == stamp:
        return hit[1]
    payload = load_model(name)
    if payload is not None:
        _MODEL_CACHE[name] = (stamp, payload)
    return payload


def get_db():
    client = MongoClient(MONGODB_URI)
    return client[DB_NAME]


def get_feature_row(features: dict) -> pd.DataFrame:
    """Convert feature dict to single-row DataFrame for prediction."""
    row = {k: v for k, v in features.items()
           if isinstance(v, (int, float, bool)) and k not in ["event_id", "computed_at"]}
    return pd.DataFrame([row]).fillna(0)


CLV_MOVE_THRESHOLD = 0.01        # a 1% change in decimal odds before kickoff counts as a real move


def _american_str(price) -> str:
    price = int(round(price))
    return f"+{price}" if price > 0 else str(price)


def predict_clv(features: dict) -> dict:
    """
    Will the best soft-book price in this game move toward or away from the sharp line before kickoff?

    Scores every soft-book price (see features.clv_market_rows) and reports the one a bettor would
    target: the highest value against the sharp books' fair price. `value` is the predicted change in
    that price relative to the fair price. If the sharp line is fair, betting now is worth today's edge,
    and waiting only pays when the edge is expected to GROW: negative = the edge is expected to shrink as
    the soft book catches up (bet now), positive = it is expected to grow (waiting is better). It says
    nothing about news that moves the sharp line itself, which nobody can predict.
    """
    payload = _cached_load(MODEL_CLV)
    if not payload:
        return {"available": False, "reason": "model_not_trained"}
    meta = payload.get("metadata") or {}
    if meta.get("target") != "soft_price_relative_shift":
        # A model saved by the earlier version predicted something different (and leaked its own
        # answer). Serving its output as advice would be misleading, so it is refused until retrained.
        return {"available": False, "reason": "model_outdated"}
    model = payload["model"]

    rows = clv_market_rows(features.get("_h2h"), features.get("minutes_to_game"))
    if not rows:
        return {"available": False, "reason": "no_comparable_prices"}
    X = pd.DataFrame(rows)[meta.get("features") or CLV_FEATURE_COLUMNS]
    try:
        preds = np.asarray(model.predict(X), dtype=float)
    except Exception as e:
        logger.error(f"CLV prediction error: {e}")
        return {"available": False, "reason": str(e)}

    best = int(np.argmax([r["value_vs_fair"] for r in rows]))
    row, pred = rows[best], float(preds[best])
    if pred > CLV_MOVE_THRESHOLD:
        direction, advice = "better", "Wait — this price may become more attractive"
        outlook = f"expected to improve by about {abs(pred) * 100:.1f}% relative to the sharp line"
    elif pred < -CLV_MOVE_THRESHOLD:
        direction, advice = "worse", "Bet now — this price is likely to move toward the sharp line"
        outlook = f"expected to move about {abs(pred) * 100:.1f}% toward the sharp line"
    else:
        direction, advice = "stable", "Price likely stable — bet when ready"
        outlook = "expected to hold its value relative to the sharp line"
    ev_pct = row["value_vs_fair"] * 100
    return {
        "available":  True,
        "value":      round(pred, 4),
        "direction":  direction,
        "advice":     advice,
        "confidence": min(1.0, abs(pred) / (5 * CLV_MOVE_THRESHOLD)),
        "best_book":  row["_book"],
        "selection":  row["_selection"],
        "book_odds":  _american_str(row["_american"]),
        "fair_odds":  _american_str(decimal_to_american(1.0 / row["fair_prob"])),
        "ev_pct":     round(ev_pct, 2),
        "reason":     f"{row['_book']} on {row['_selection']} is {ev_pct:+.1f}% vs the sharp books' fair price; {outlook}.",
    }


def predict_sharp_money(features: dict) -> dict:
    """
    Predict if sharp money is behind current line movement.
    Returns: { is_sharp: bool, probability: float, signal_strength: str }
    """
    payload = _cached_load(MODEL_SHARP)
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

    # Line up with the columns the model was trained on (as predict_clv does), so a
    # change to the training features can't turn into a silent prediction error.
    trained_cols = getattr(model, "feature_names_in_", None)
    if trained_cols is not None:
        X = X.reindex(columns=list(trained_cols), fill_value=0)

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
    payload = _cached_load(MODEL_ARB_WINDOW)
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
    payload = _cached_load(MODEL_EV_CONF)
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


def _events_needing_prediction(db, event_ids: list, since, now) -> list:
    """
    Which events need a fresh prediction: no prediction yet, an open arbitrage, a new real snapshot
    since the last prediction (odds changed), or a prediction older than PREDICTION_REFRESH_MINUTES.
    Three bulk queries instead of one per event.
    """
    if not event_ids:
        return []
    existing = {d["event_id"]: parse_utc(d.get("generated_at")) for d in
                db[COL_ML_PREDICTIONS].find({"event_id": {"$in": event_ids}}, {"event_id": 1, "generated_at": 1})}
    latest_real = {g["_id"]: parse_utc(g["last"]) for g in db[COL_ODDS_SNAPSHOTS].aggregate([
        {"$match": {"event_id": {"$in": event_ids}, "fetched_at": {"$gte": since}, "is_duplicate": {"$ne": True}}},
        {"$group": {"_id": "$event_id", "last": {"$max": "$fetched_at"}}},
    ])}
    open_arbs = {d["event_id"] for d in db[COL_ARB_HISTORY].find({"event_id": {"$in": event_ids}, "resolved_at": None}, {"event_id": 1})}
    refresh = timedelta(minutes=PREDICTION_REFRESH_MINUTES)
    needed = []
    for event_id in event_ids:
        last = existing.get(event_id)
        changed = latest_real.get(event_id) is not None and last is not None and latest_real[event_id] > last
        if last is None or event_id in open_arbs or changed or now - last >= refresh:
            needed.append(event_id)
    return needed


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

    started = time.time()
    day_start = now.replace(hour=0, minute=0, second=0, microsecond=0)
    needed = _events_needing_prediction(db, recent_events, day_start, now)
    skipped = len(recent_events) - len(needed)
    logger.info(f"Generating predictions for {len(needed)} of {len(recent_events)} events ({skipped} unchanged, skipped)")

    for event_id in needed:
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

    elapsed = time.time() - started
    logger.success(f"Saved {stored} predictions to MongoDB in {elapsed:.0f}s ({skipped} unchanged events skipped"
                   + (f", {1000 * elapsed / max(len(needed), 1):.0f} ms per event)" if needed else ")"))
    return stored


if __name__ == "__main__":
    count = generate_all_predictions()
    print(f"Generated {count} predictions")
