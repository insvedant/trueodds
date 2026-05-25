"""
models/train.py
────────────────────────────────────────────────────────────────────────────
All ML models for TrueOdds — training and saving.

Models:
  1. CLV Predictor         — predicts closing line value
  2. Sharp Money Detector  — detects sharp money signals
  3. Arb Window Predictor  — predicts how long arb will last
  4. EV Confidence Score   — confidence score for +EV bets

Run: python -m ml.models.train
"""

import os
import joblib
import numpy as np
import pandas as pd
from datetime import datetime, timezone
from loguru import logger
from pymongo import MongoClient
from sklearn.model_selection import train_test_split, cross_val_score
from sklearn.preprocessing import StandardScaler
from sklearn.pipeline import Pipeline
from sklearn.metrics import mean_absolute_error, accuracy_score, roc_auc_score
from sklearn.ensemble import RandomForestClassifier, GradientBoostingRegressor
import xgboost as xgb

import sys
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(__file__))))
from ml.config import (
    MONGODB_URI, DB_NAME, MODEL_DIR, MIN_TRAINING_ROWS,
    MODEL_CLV, MODEL_SHARP, MODEL_ARB_WINDOW, MODEL_EV_CONF,
    COL_ODDS_SNAPSHOTS, COL_LINE_MOVEMENTS, COL_ARB_HISTORY,
)
from ml.features import build_features_for_event, build_training_dataset, american_to_decimal


os.makedirs(MODEL_DIR, exist_ok=True)

# ── CI fast mode — fewer estimators when running on GitHub Actions ────────
CI_MODE = os.environ.get('CI_TRAINING', '').lower() == 'true'
N_ESTIMATORS_LARGE  = 50  if CI_MODE else 200
N_ESTIMATORS_MEDIUM = 40  if CI_MODE else 150
logger.info(f"Training mode: {'CI-FAST (n_estimators reduced)' if CI_MODE else 'FULL'}")


def get_db():
    client = MongoClient(MONGODB_URI)
    return client[DB_NAME]


def save_model(model, name: str, metadata: dict = None):
    """Save model + metadata to disk AND MongoDB for persistence across deployments."""
    path = os.path.join(MODEL_DIR, f"{name}.joblib")
    payload = {
        "model":      model,
        "metadata":   metadata or {},
        "trained_at": datetime.now(timezone.utc).isoformat(),
        "version":    "1.0",
    }
    # Save to disk
    joblib.dump(payload, path)
    logger.success(f"Model saved: {path}")

    # Also save to MongoDB as binary so GitHub Actions can persist models
    try:
        import io
        from pymongo import MongoClient
        from ml.config import MONGODB_URI, DB_NAME
        buf = io.BytesIO()
        joblib.dump(payload, buf)
        buf.seek(0)
        client = MongoClient(MONGODB_URI)
        db = client[DB_NAME]
        db["ml_models"].replace_one(
            {"name": name},
            {
                "name": name,
                "data": buf.read(),
                "trained_at": datetime.now(timezone.utc).isoformat(),
                "metadata": metadata or {},
            },
            upsert=True
        )
        client.close()
        logger.success(f"Model also saved to MongoDB: {name}")
    except Exception as e:
        logger.warning(f"Could not save model to MongoDB: {e}")

    return path


def load_model(name: str):
    """Load model from disk, falling back to MongoDB if not on disk."""
    path = os.path.join(MODEL_DIR, f"{name}.joblib")

    # Try disk first
    if os.path.exists(path):
        return joblib.load(path)

    # Fall back to MongoDB (for GitHub Actions / cloud deployments)
    try:
        import io
        from pymongo import MongoClient
        from ml.config import MONGODB_URI, DB_NAME
        client = MongoClient(MONGODB_URI)
        db = client[DB_NAME]
        doc = db["ml_models"].find_one({"name": name})
        client.close()
        if doc and "data" in doc:
            buf = io.BytesIO(doc["data"])
            payload = joblib.load(buf)
            # Cache to disk for future use
            joblib.dump(payload, path)
            logger.info(f"Model loaded from MongoDB: {name}")
            return payload
    except Exception as e:
        logger.warning(f"Could not load model from MongoDB: {e}")

    return None


# ─────────────────────────────────────────────────────────────────────────
# MODEL 1: CLV PREDICTOR
# Predicts closing line value — whether current odds will be better or
# worse at game time. Helps users decide when to bet.
#
# Target: float — closing line shift (positive = odds got better)
# Input:  cross-book features + line movement + time to game
# ─────────────────────────────────────────────────────────────────────────

def build_clv_dataset(db) -> tuple[pd.DataFrame, pd.Series] | None:
    """
    Build CLV training data.
    Label: difference between opening and closing odds (decimal).
    Positive = odds shortened (market agreed with opening), negative = drifted.
    """
    logger.info("Building CLV training dataset...")

    pipeline = [
        {"$group": {
            "_id":   "$event_id",
            "count": {"$sum": 1},
            "first": {"$first": "$fetched_at"},
            "last":  {"$last":  "$fetched_at"},
        }},
        {"$match": {"count": {"$gte": 5}}},
    ]
    events = list(db[COL_ODDS_SNAPSHOTS].aggregate(pipeline))
    logger.info(f"Found {len(events)} events for CLV training")

    X_rows, y_vals = [], []

    for ev in events:
        eid = ev["_id"]

        opening = db[COL_ODDS_SNAPSHOTS].find_one({"event_id": eid}, sort=[("fetched_at", 1)])
        closing = db[COL_ODDS_SNAPSHOTS].find_one({"event_id": eid}, sort=[("fetched_at", -1)])
        middle  = db[COL_ODDS_SNAPSHOTS].find_one(
            {"event_id": eid, "fetched_at": {"$gt": ev["first"]}},
            sort=[("fetched_at", 1)]
        )

        if not all([opening, closing, middle]):
            continue

        # Features from middle snapshot (simulate mid-betting state)
        from ml.features import build_features_for_event
        features = build_features_for_event(eid, db)
        if not features:
            continue

        # Label: average odds shift from middle to closing
        shifts = []
        open_h2h  = opening.get("book_odds", {}).get("h2h", {})
        close_h2h = closing.get("book_odds", {}).get("h2h", {})

        for sel in open_h2h:
            if sel in close_h2h:
                open_books  = open_h2h[sel]
                close_books = close_h2h[sel]
                common = set(open_books) & set(close_books)
                if common:
                    open_avg  = np.mean([american_to_decimal(open_books[b])  for b in common])
                    close_avg = np.mean([american_to_decimal(close_books[b]) for b in common])
                    shifts.append(close_avg - open_avg)

        if not shifts:
            continue

        label = np.mean(shifts)

        # Remove non-numeric fields
        row = {k: v for k, v in features.items()
               if isinstance(v, (int, float, bool)) and k not in ["event_id"]}
        X_rows.append(row)
        y_vals.append(label)

    if len(X_rows) < MIN_TRAINING_ROWS:
        logger.warning(f"CLV: only {len(X_rows)} samples (need {MIN_TRAINING_ROWS})")
        return None

    X = pd.DataFrame(X_rows).fillna(0)
    y = pd.Series(y_vals)
    return X, y


def train_clv_model(db) -> dict:
    """Train CLV predictor using XGBoost regression."""
    result = build_clv_dataset(db)
    if not result:
        return {"success": False, "reason": "insufficient_data"}

    X, y = result
    X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, random_state=42)

    model = xgb.XGBRegressor(
        n_estimators=N_ESTIMATORS_LARGE,
        max_depth=5,
        learning_rate=0.05,
        subsample=0.8,
        colsample_bytree=0.8,
        random_state=42,
        verbosity=0,
    )
    model.fit(
        X_train, y_train,
        eval_set=[(X_test, y_test)],
        verbose=False,
    )

    preds = model.predict(X_test)
    mae   = mean_absolute_error(y_test, preds)

    # Feature importance
    fi = dict(zip(X.columns, model.feature_importances_))
    top_features = sorted(fi.items(), key=lambda x: x[1], reverse=True)[:10]

    metadata = {
        "mae":          round(mae, 6),
        "n_samples":    len(X),
        "n_features":   len(X.columns),
        "top_features": top_features,
    }

    save_model(model, MODEL_CLV, metadata)
    logger.success(f"CLV model trained — MAE: {mae:.6f}")
    return {"success": True, "mae": mae, "samples": len(X)}


# ─────────────────────────────────────────────────────────────────────────
# MODEL 2: SHARP MONEY DETECTOR
# Binary classifier: is this line movement caused by sharp money?
# Features: line movement velocity, sharp book direction, steam patterns
# ─────────────────────────────────────────────────────────────────────────

def build_sharp_money_dataset(db) -> tuple | None:
    """
    Build sharp money detection training data.
    Label: 1 if sharp books moved before soft books (sharp money signal)
           0 otherwise
    """
    logger.info("Building sharp money dataset...")

    movements = list(db[COL_LINE_MOVEMENTS].find(
        {"is_sharp_book": True},
        sort=[("timestamp", 1)]
    ).limit(50000))

    if len(movements) < MIN_TRAINING_ROWS:
        logger.warning(f"Sharp: only {len(movements)} movements (need {MIN_TRAINING_ROWS})")
        return None

    df = pd.DataFrame(movements)

    # Group by event + selection
    X_rows, y_vals = [], []

    for (event_id, selection), group in df.groupby(["event_id", "selection"]):
        sharp_group = group[group["is_sharp_book"] == True]
        if sharp_group.empty:
            continue

        # Features
        row = {
            "n_sharp_moves":    len(sharp_group),
            "avg_prob_change":  float(group["prob_change"].mean()),
            "max_prob_change":  float(group["prob_change"].abs().max()),
            "total_moves":      len(group),
            "sharp_ratio":      len(sharp_group) / max(len(group), 1),
            "moved_up_ratio":   float((group["moved_up"] == True).mean()),
            "velocity":         len(group) / max(group["seconds_since_prev"].mean() / 60, 1),
        }

        # Label: sharp moved first AND soft followed
        if len(group) >= 2:
            sharp_times = sharp_group["timestamp"].min() if not sharp_group.empty else None
            soft_group  = group[group["is_sharp_book"] == False]
            soft_times  = soft_group["timestamp"].min() if not soft_group.empty else None

            if sharp_times and soft_times:
                label = int(sharp_times < soft_times)  # sharp moved first
            else:
                label = int(not sharp_group.empty)
        else:
            label = 0

        X_rows.append(row)
        y_vals.append(label)

    if len(X_rows) < MIN_TRAINING_ROWS:
        return None

    X = pd.DataFrame(X_rows).fillna(0)
    y = pd.Series(y_vals)
    return X, y


def train_sharp_money_model(db) -> dict:
    """Train sharp money detector using XGBoost classifier."""
    result = build_sharp_money_dataset(db)
    if not result:
        return {"success": False, "reason": "insufficient_data"}

    X, y = result
    X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, random_state=42)

    model = xgb.XGBClassifier(
        n_estimators=N_ESTIMATORS_LARGE,
        max_depth=4,
        learning_rate=0.05,
        scale_pos_weight=len(y[y == 0]) / max(len(y[y == 1]), 1),
        random_state=42,
        verbosity=0,
        use_label_encoder=False,
        eval_metric="logloss",
    )
    model.fit(X_train, y_train, eval_set=[(X_test, y_test)], verbose=False)

    preds  = model.predict(X_test)
    acc    = accuracy_score(y_test, preds)
    try:
        auc = roc_auc_score(y_test, model.predict_proba(X_test)[:, 1])
    except Exception:
        auc = 0.0

    metadata = {
        "accuracy": round(acc, 4),
        "auc":      round(auc, 4),
        "n_samples": len(X),
        "positive_rate": float(y.mean()),
    }

    save_model(model, MODEL_SHARP, metadata)
    logger.success(f"Sharp money model — accuracy: {acc:.4f}, AUC: {auc:.4f}")
    return {"success": True, "accuracy": acc, "auc": auc}


# ─────────────────────────────────────────────────────────────────────────
# MODEL 3: ARB WINDOW PREDICTOR
# Predicts how long an arb will last in minutes.
# Helps users prioritize which arbs to act on first.
# ─────────────────────────────────────────────────────────────────────────

def build_arb_window_dataset(db) -> tuple | None:
    """
    Build arb window training data from resolved arb history.
    Label: duration in minutes
    """
    logger.info("Building arb window dataset...")

    resolved_arbs = list(db[COL_ARB_HISTORY].find(
        {"resolved_at": {"$ne": None}, "detected_at": {"$ne": None}},
        {"event_id": 1, "sport": 1, "profit_pct": 1,
         "detected_at": 1, "resolved_at": 1, "legs": 1}
    ).limit(20000))

    if len(resolved_arbs) < MIN_TRAINING_ROWS:
        logger.warning(f"Arb window: only {len(resolved_arbs)} resolved arbs")
        return None

    X_rows, y_vals = [], []

    for arb in resolved_arbs:
        detected = arb.get("detected_at")
        resolved = arb.get("resolved_at")
        if not detected or not resolved:
            continue

        duration_min = (resolved - detected).total_seconds() / 60
        if duration_min < 0 or duration_min > 1440:  # skip invalid/stale
            continue

        # Features about the arb
        legs = arb.get("legs", [])
        books = [l.get("book", "") for l in legs]

        has_pinnacle = int(any("pinnacle" in b for b in books))
        has_dk       = int(any("draftkings" in b for b in books))
        has_fd       = int(any("fanduel" in b for b in books))
        profit       = arb.get("profit_pct", 0)

        sport_enc = {
            "americanfootball_nfl": 1, "basketball_nba": 2,
            "baseball_mlb": 3, "icehockey_nhl": 4,
            "soccer_epl": 5, "mma_mixed_martial_arts": 6,
        }

        row = {
            "profit_pct":      profit,
            "has_pinnacle":    has_pinnacle,
            "has_draftkings":  has_dk,
            "has_fanduel":     has_fd,
            "n_books":         len(legs),
            "sport_enc":       sport_enc.get(arb.get("sport", ""), 0),
            "high_profit":     int(profit >= 2.0),
        }

        X_rows.append(row)
        y_vals.append(min(duration_min, 120))  # cap at 2 hours

    if len(X_rows) < MIN_TRAINING_ROWS:
        return None

    X = pd.DataFrame(X_rows).fillna(0)
    y = pd.Series(y_vals)
    return X, y


def train_arb_window_model(db) -> dict:
    """Train arb window predictor."""
    result = build_arb_window_dataset(db)
    if not result:
        return {"success": False, "reason": "insufficient_data"}

    X, y = result
    X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, random_state=42)

    model = GradientBoostingRegressor(
        n_estimators=N_ESTIMATORS_MEDIUM, max_depth=4,
        learning_rate=0.08, random_state=42,
    )
    model.fit(X_train, y_train)

    preds = model.predict(X_test)
    mae   = mean_absolute_error(y_test, preds)

    metadata = {
        "mae_minutes": round(mae, 2),
        "n_samples":   len(X),
        "avg_duration_min": float(y.mean()),
    }

    save_model(model, MODEL_ARB_WINDOW, metadata)
    logger.success(f"Arb window model — MAE: {mae:.2f} minutes")
    return {"success": True, "mae_minutes": mae}


# ─────────────────────────────────────────────────────────────────────────
# MODEL 4: EV CONFIDENCE SCORE
# Adds a confidence score to +EV bets based on:
# - Historical accuracy of the book on this market
# - Sharp book agreement with the EV signal
# - Line movement supporting the EV direction
# ─────────────────────────────────────────────────────────────────────────

def train_ev_confidence_model(db) -> dict:
    """
    Train EV confidence scorer.
    Uses historical data to score how reliable a +EV signal is.
    """
    logger.info("Building EV confidence dataset...")

    snapshots = list(db[COL_ODDS_SNAPSHOTS].find(
        {"book_odds.h2h": {"$exists": True}},
        sort=[("fetched_at", -1)],
        limit=20000,
    ))

    if len(snapshots) < MIN_TRAINING_ROWS:
        return {"success": False, "reason": "insufficient_data"}

    X_rows, y_vals = [], []

    for snap in snapshots:
        h2h   = snap.get("book_odds", {}).get("h2h", {})
        eid   = snap.get("event_id", "")

        for selection, books in h2h.items():
            if not books:
                continue

            # Get Pinnacle as sharp reference
            pinnacle_odds = books.get("pinnacle")
            if not pinnacle_odds:
                continue

            pin_dec  = american_to_decimal(pinnacle_odds)
            pin_prob = 1 / pin_dec

            for book, odds in books.items():
                if book == "pinnacle":
                    continue
                if not odds:
                    continue

                book_dec  = american_to_decimal(odds)
                ev_pct    = (pin_prob * book_dec - 1) * 100

                if ev_pct < 1.0:
                    continue

                # Feature: how much do other sharp books agree?
                other_probs = []
                for b2, o2 in books.items():
                    if b2 != book:
                        other_probs.append(1 / american_to_decimal(o2))

                avg_other_prob = np.mean(other_probs) if other_probs else pin_prob

                # Movement features
                mvt_count = db[COL_LINE_MOVEMENTS].count_documents({
                    "event_id":  eid,
                    "selection": selection,
                })

                row = {
                    "ev_pct":            ev_pct,
                    "pin_prob":          pin_prob,
                    "book_dec":          book_dec,
                    "sharp_agreement":   float(abs(avg_other_prob - pin_prob)),
                    "n_books":           len(books),
                    "has_movements":     int(mvt_count > 0),
                    "movement_count":    min(mvt_count, 20),
                    "high_ev":           int(ev_pct >= 5.0),
                }

                # Label: is the EV signal reliable?
                # For now, label based on magnitude + sharp agreement as proxy
                # (improves significantly with more outcome data)
                is_confident = int(
                    ev_pct >= 3.0 and
                    abs(avg_other_prob - pin_prob) < 0.05 and
                    len(books) >= 3
                )

                X_rows.append(row)
                y_vals.append(is_confident)

    if len(X_rows) < MIN_TRAINING_ROWS:
        return {"success": False, "reason": "insufficient_data"}

    X = pd.DataFrame(X_rows).fillna(0)
    y = pd.Series(y_vals)

    X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, random_state=42)

    model = xgb.XGBClassifier(
        n_estimators=N_ESTIMATORS_MEDIUM, max_depth=4,
        learning_rate=0.05, random_state=42,
        verbosity=0, use_label_encoder=False,
        eval_metric="logloss",
    )
    model.fit(X_train, y_train, eval_set=[(X_test, y_test)], verbose=False)

    preds = model.predict(X_test)
    acc   = accuracy_score(y_test, preds)

    metadata = {
        "accuracy":  round(acc, 4),
        "n_samples": len(X),
    }

    save_model(model, MODEL_EV_CONF, metadata)
    logger.success(f"EV confidence model — accuracy: {acc:.4f}")
    return {"success": True, "accuracy": acc}


# ─────────────────────────────────────────────────────────────────────────
# TRAIN ALL
# ─────────────────────────────────────────────────────────────────────────

def train_all_models():
    """Train all models. Called by scheduler every 24 hours."""
    db      = get_db()
    results = {}

    logger.info("=" * 60)
    logger.info("Starting ML model training")
    logger.info("=" * 60)

    results["clv"]        = train_clv_model(db)
    results["sharp"]      = train_sharp_money_model(db)
    results["arb_window"] = train_arb_window_model(db)
    results["ev_conf"]    = train_ev_confidence_model(db)

    success = sum(1 for r in results.values() if r.get("success"))
    logger.info(f"Training complete — {success}/{len(results)} models trained successfully")

    # Save training run to MongoDB
    db["ml_training_log"].insert_one({
        "results":    results,
        "trained_at": datetime.now(timezone.utc),
    })

    return results


if __name__ == "__main__":
    train_all_models()
