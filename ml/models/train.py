"""
models/train.py
────────────────────────────────────────────────────────────────────────────
All ML models for TrueOdds — training and saving.

Optimizations:
  - 30-day rolling window: only train on recent data (most relevant)
  - 50k sample cap: random sample if data exceeds limit (fast + accurate)
  - n_jobs=-1: use all CPU cores on the runner
  - HistGradientBoosting: 10-50x faster than GradientBoosting on large data
  - CI fast mode: even fewer estimators on GitHub Actions free runners

Models:
  1. CLV Predictor         — predicts closing line value
  2. Sharp Money Detector  — detects sharp money signals
  3. Arb Window Predictor  — predicts how long arb will last
  4. EV Confidence Score   — confidence score for +EV bets
"""

import os
import joblib
import numpy as np
import pandas as pd
from datetime import datetime, timezone, timedelta
from loguru import logger
from pymongo import MongoClient
from sklearn.model_selection import train_test_split
from sklearn.metrics import mean_absolute_error, accuracy_score, roc_auc_score
from sklearn.ensemble import HistGradientBoostingRegressor, HistGradientBoostingClassifier
import xgboost as xgb

import sys
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(__file__))))
from ml.config import (
    MONGODB_URI, DB_NAME, MODEL_DIR, MIN_TRAINING_ROWS,
    MODEL_CLV, MODEL_SHARP, MODEL_ARB_WINDOW, MODEL_EV_CONF,
    COL_ODDS_SNAPSHOTS, COL_LINE_MOVEMENTS, COL_ARB_HISTORY,
)
from ml.features import build_features_for_event, american_to_decimal

os.makedirs(MODEL_DIR, exist_ok=True)

# ── Scaling constants ─────────────────────────────────────────────────────
ROLLING_DAYS    = 30       # only train on last 30 days of data
MAX_SAMPLES     = 50_000   # cap at 50k rows — random sample if exceeded
RANDOM_STATE    = 42

# ── CI fast mode — fewer estimators on GitHub Actions free runners ────────
CI_MODE             = os.environ.get('CI_TRAINING', '').lower() == 'true'
N_ESTIMATORS_LARGE  = 50  if CI_MODE else 150
N_ESTIMATORS_MEDIUM = 30  if CI_MODE else 100
N_JOBS              = -1  # use ALL available CPU cores

logger.info(f"Training mode : {'CI-FAST' if CI_MODE else 'FULL'}")
logger.info(f"Rolling window: last {ROLLING_DAYS} days")
logger.info(f"Max samples   : {MAX_SAMPLES:,}")
logger.info(f"n_jobs        : {N_JOBS} (all cores)")


def get_db():
    client = MongoClient(MONGODB_URI, serverSelectionTimeoutMS=10_000)
    return client[DB_NAME]


def cutoff_date() -> datetime:
    """Return the rolling window cutoff — only data newer than this is used."""
    return datetime.now(timezone.utc) - timedelta(days=ROLLING_DAYS)


def sample_if_large(X: pd.DataFrame, y: pd.Series, max_rows: int = MAX_SAMPLES):
    """Randomly sample down to max_rows if dataset is too large."""
    if len(X) <= max_rows:
        return X, y
    logger.info(f"Dataset has {len(X):,} rows — sampling down to {max_rows:,}")
    idx = np.random.RandomState(RANDOM_STATE).choice(len(X), max_rows, replace=False)
    return X.iloc[idx].reset_index(drop=True), y.iloc[idx].reset_index(drop=True)


def save_model(model, name: str, metadata: dict = None):
    """Save model + metadata to disk AND MongoDB."""
    path = os.path.join(MODEL_DIR, f"{name}.joblib")
    payload = {
        "model":      model,
        "metadata":   metadata or {},
        "trained_at": datetime.now(timezone.utc).isoformat(),
        "version":    "2.0",
    }
    joblib.dump(payload, path)
    logger.success(f"Model saved to disk: {path}")

    try:
        import io
        buf = io.BytesIO()
        joblib.dump(payload, buf)
        buf.seek(0)
        client = MongoClient(MONGODB_URI)
        db = client[DB_NAME]
        db["ml_models"].replace_one(
            {"name": name},
            {
                "name":       name,
                "data":       buf.read(),
                "trained_at": datetime.now(timezone.utc).isoformat(),
                "metadata":   metadata or {},
            },
            upsert=True,
        )
        client.close()
        logger.success(f"Model saved to MongoDB: {name}")
    except Exception as e:
        logger.warning(f"Could not save to MongoDB: {e}")

    return path


def load_model(name: str):
    """Load model from disk, fallback to MongoDB."""
    path = os.path.join(MODEL_DIR, f"{name}.joblib")
    if os.path.exists(path):
        return joblib.load(path)
    try:
        import io
        client = MongoClient(MONGODB_URI)
        db = client[DB_NAME]
        doc = db["ml_models"].find_one({"name": name})
        client.close()
        if doc and "data" in doc:
            payload = joblib.load(io.BytesIO(doc["data"]))
            joblib.dump(payload, path)
            logger.info(f"Model loaded from MongoDB: {name}")
            return payload
    except Exception as e:
        logger.warning(f"Could not load from MongoDB: {e}")
    return None


# ─────────────────────────────────────────────────────────────────────────
# MODEL 1: CLV PREDICTOR
# ─────────────────────────────────────────────────────────────────────────

def build_clv_dataset(db):
    logger.info("Building CLV dataset (30-day window)...")
    cutoff = cutoff_date()

    pipeline = [
        {"$match":  {"fetched_at": {"$gte": cutoff}}},
        {"$group":  {"_id": "$event_id", "count": {"$sum": 1},
                     "first": {"$first": "$fetched_at"},
                     "last":  {"$last":  "$fetched_at"}}},
        {"$match":  {"count": {"$gte": 5}}},
        {"$limit":  10_000},   # cap events queried per run
    ]
    events = list(db[COL_ODDS_SNAPSHOTS].aggregate(pipeline, allowDiskUse=True))
    logger.info(f"CLV: {len(events)} events in window")

    X_rows, y_vals = [], []

    for ev in events:
        eid     = ev["_id"]
        opening = db[COL_ODDS_SNAPSHOTS].find_one({"event_id": eid}, sort=[("fetched_at", 1)])
        closing = db[COL_ODDS_SNAPSHOTS].find_one({"event_id": eid}, sort=[("fetched_at", -1)])
        if not opening or not closing:
            continue

        features = build_features_for_event(eid, db)
        if not features:
            continue

        shifts = []
        open_h2h  = opening.get("book_odds", {}).get("h2h", {})
        close_h2h = closing.get("book_odds", {}).get("h2h", {})

        for sel in open_h2h:
            if sel in close_h2h:
                common = set(open_h2h[sel]) & set(close_h2h[sel])
                if common:
                    open_avg  = np.mean([american_to_decimal(open_h2h[sel][b])  for b in common])
                    close_avg = np.mean([american_to_decimal(close_h2h[sel][b]) for b in common])
                    shifts.append(close_avg - open_avg)

        if not shifts:
            continue

        row = {k: v for k, v in features.items()
               if isinstance(v, (int, float, bool)) and k != "event_id"}
        X_rows.append(row)
        y_vals.append(np.mean(shifts))

    if len(X_rows) < MIN_TRAINING_ROWS:
        logger.warning(f"CLV: only {len(X_rows)} samples (need {MIN_TRAINING_ROWS})")
        return None

    X, y = sample_if_large(pd.DataFrame(X_rows).fillna(0), pd.Series(y_vals))
    logger.info(f"CLV dataset: {len(X):,} rows, {len(X.columns)} features")
    return X, y


def train_clv_model(db) -> dict:
    result = build_clv_dataset(db)
    if not result:
        return {"success": False, "reason": "insufficient_data"}

    X, y = result
    X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, random_state=RANDOM_STATE)

    model = xgb.XGBRegressor(
        n_estimators=N_ESTIMATORS_LARGE,
        max_depth=5,
        learning_rate=0.05,
        subsample=0.8,
        colsample_bytree=0.8,
        n_jobs=N_JOBS,
        random_state=RANDOM_STATE,
        verbosity=0,
    )
    model.fit(X_train, y_train, eval_set=[(X_test, y_test)], verbose=False)

    mae = mean_absolute_error(y_test, model.predict(X_test))
    fi  = dict(zip(X.columns, model.feature_importances_))
    top = sorted(fi.items(), key=lambda x: x[1], reverse=True)[:10]

    metadata = {"mae": round(mae, 6), "n_samples": len(X),
                "n_features": len(X.columns), "top_features": top}
    save_model(model, MODEL_CLV, metadata)
    logger.success(f"CLV trained — MAE: {mae:.6f}, samples: {len(X):,}")
    return {"success": True, "mae": mae, "samples": len(X)}


# ─────────────────────────────────────────────────────────────────────────
# MODEL 2: SHARP MONEY DETECTOR
# ─────────────────────────────────────────────────────────────────────────

def build_sharp_money_dataset(db):
    logger.info("Building sharp money dataset (30-day window)...")
    cutoff = cutoff_date()

    movements = list(db[COL_LINE_MOVEMENTS].find(
        {"is_sharp_book": True, "timestamp": {"$gte": cutoff}},
        sort=[("timestamp", 1)],
    ).limit(MAX_SAMPLES))

    if len(movements) < MIN_TRAINING_ROWS:
        logger.warning(f"Sharp: only {len(movements)} movements")
        return None

    df = pd.DataFrame(movements)
    X_rows, y_vals = [], []

    for (event_id, selection), group in df.groupby(["event_id", "selection"]):
        sharp_group = group[group["is_sharp_book"] == True]
        if sharp_group.empty:
            continue

        row = {
            "n_sharp_moves":   len(sharp_group),
            "avg_prob_change": float(group["prob_change"].mean()),
            "max_prob_change": float(group["prob_change"].abs().max()),
            "total_moves":     len(group),
            "sharp_ratio":     len(sharp_group) / max(len(group), 1),
            "moved_up_ratio":  float((group["moved_up"] == True).mean()),
            "velocity":        len(group) / max(group["seconds_since_prev"].mean() / 60, 1),
        }

        soft_group = group[group["is_sharp_book"] == False]
        if len(group) >= 2 and not sharp_group.empty and not soft_group.empty:
            label = int(sharp_group["timestamp"].min() < soft_group["timestamp"].min())
        else:
            label = int(not sharp_group.empty)

        X_rows.append(row)
        y_vals.append(label)

    if len(X_rows) < MIN_TRAINING_ROWS:
        return None

    X, y = sample_if_large(pd.DataFrame(X_rows).fillna(0), pd.Series(y_vals))
    logger.info(f"Sharp dataset: {len(X):,} rows")
    return X, y


def train_sharp_money_model(db) -> dict:
    result = build_sharp_money_dataset(db)
    if not result:
        return {"success": False, "reason": "insufficient_data"}

    X, y = result
    X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, random_state=RANDOM_STATE)

    # HistGradientBoostingClassifier — 10-50x faster than GradientBoosting
    model = HistGradientBoostingClassifier(
        max_iter=N_ESTIMATORS_LARGE,
        max_depth=4,
        learning_rate=0.05,
        random_state=RANDOM_STATE,
    )
    model.fit(X_train, y_train)

    preds = model.predict(X_test)
    acc   = accuracy_score(y_test, preds)
    try:
        auc = roc_auc_score(y_test, model.predict_proba(X_test)[:, 1])
    except Exception:
        auc = 0.0

    metadata = {"accuracy": round(acc, 4), "auc": round(auc, 4),
                "n_samples": len(X), "positive_rate": float(y.mean())}
    save_model(model, MODEL_SHARP, metadata)
    logger.success(f"Sharp money trained — acc: {acc:.4f}, AUC: {auc:.4f}, samples: {len(X):,}")
    return {"success": True, "accuracy": acc, "auc": auc}


# ─────────────────────────────────────────────────────────────────────────
# MODEL 3: ARB WINDOW PREDICTOR
# ─────────────────────────────────────────────────────────────────────────

def build_arb_window_dataset(db):
    logger.info("Building arb window dataset (30-day window)...")
    cutoff = cutoff_date()

    resolved_arbs = list(db[COL_ARB_HISTORY].find(
        {"resolved_at": {"$ne": None}, "detected_at": {"$ne": None},
         "detected_at": {"$gte": cutoff}},
        {"event_id": 1, "sport": 1, "profit_pct": 1,
         "detected_at": 1, "resolved_at": 1, "legs": 1},
    ).limit(MAX_SAMPLES))

    if len(resolved_arbs) < MIN_TRAINING_ROWS:
        logger.warning(f"Arb window: only {len(resolved_arbs)} resolved arbs")
        return None

    sport_enc = {
        "americanfootball_nfl": 1, "basketball_nba": 2,
        "baseball_mlb": 3, "icehockey_nhl": 4,
        "soccer_epl": 5, "mma_mixed_martial_arts": 6,
    }

    X_rows, y_vals = [], []
    for arb in resolved_arbs:
        detected = arb.get("detected_at")
        resolved = arb.get("resolved_at")
        if not detected or not resolved:
            continue
        duration_min = (resolved - detected).total_seconds() / 60
        if duration_min < 0 or duration_min > 1440:
            continue

        legs   = arb.get("legs", [])
        books  = [l.get("book", "").lower() for l in legs]
        profit = arb.get("profit_pct", 0)

        X_rows.append({
            "profit_pct":     profit,
            "has_pinnacle":   int(any("pinnacle" in b for b in books)),
            "has_draftkings": int(any("draftkings" in b for b in books)),
            "has_fanduel":    int(any("fanduel" in b for b in books)),
            "n_books":        len(legs),
            "sport_enc":      sport_enc.get(arb.get("sport", ""), 0),
            "high_profit":    int(profit >= 2.0),
        })
        y_vals.append(min(duration_min, 120))

    if len(X_rows) < MIN_TRAINING_ROWS:
        return None

    X, y = sample_if_large(pd.DataFrame(X_rows).fillna(0), pd.Series(y_vals))
    logger.info(f"Arb window dataset: {len(X):,} rows")
    return X, y


def train_arb_window_model(db) -> dict:
    result = build_arb_window_dataset(db)
    if not result:
        return {"success": False, "reason": "insufficient_data"}

    X, y = result
    X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, random_state=RANDOM_STATE)

    # HistGradientBoostingRegressor — dramatically faster than GradientBoosting
    model = HistGradientBoostingRegressor(
        max_iter=N_ESTIMATORS_MEDIUM,
        max_depth=4,
        learning_rate=0.08,
        random_state=RANDOM_STATE,
    )
    model.fit(X_train, y_train)

    mae = mean_absolute_error(y_test, model.predict(X_test))
    metadata = {"mae_minutes": round(mae, 2), "n_samples": len(X),
                "avg_duration_min": float(y.mean())}
    save_model(model, MODEL_ARB_WINDOW, metadata)
    logger.success(f"Arb window trained — MAE: {mae:.2f} min, samples: {len(X):,}")
    return {"success": True, "mae_minutes": mae}


# ─────────────────────────────────────────────────────────────────────────
# MODEL 4: EV CONFIDENCE SCORE
# ─────────────────────────────────────────────────────────────────────────

def train_ev_confidence_model(db) -> dict:
    logger.info("Building EV confidence dataset (30-day window)...")
    cutoff = cutoff_date()

    snapshots = list(db[COL_ODDS_SNAPSHOTS].find(
        {"book_odds.h2h": {"$exists": True}, "fetched_at": {"$gte": cutoff}},
        sort=[("fetched_at", -1)],
    ).limit(MAX_SAMPLES))

    if len(snapshots) < MIN_TRAINING_ROWS:
        return {"success": False, "reason": "insufficient_data"}

    X_rows, y_vals = [], []

    for snap in snapshots:
        h2h = snap.get("book_odds", {}).get("h2h", {})
        eid = snap.get("event_id", "")

        for selection, books in h2h.items():
            if not books:
                continue
            pinnacle_odds = books.get("pinnacle")
            if not pinnacle_odds:
                continue

            pin_dec  = american_to_decimal(pinnacle_odds)
            pin_prob = 1 / pin_dec

            for book, odds in books.items():
                if book == "pinnacle" or not odds:
                    continue

                book_dec = american_to_decimal(odds)
                ev_pct   = (pin_prob * book_dec - 1) * 100
                if ev_pct < 1.0:
                    continue

                other_probs = [1 / american_to_decimal(o)
                               for b, o in books.items() if b != book and o]
                avg_other   = np.mean(other_probs) if other_probs else pin_prob

                # Use cached count to avoid per-row DB queries
                X_rows.append({
                    "ev_pct":          ev_pct,
                    "pin_prob":        pin_prob,
                    "book_dec":        book_dec,
                    "sharp_agreement": float(abs(avg_other - pin_prob)),
                    "n_books":         len(books),
                    "high_ev":         int(ev_pct >= 5.0),
                })
                y_vals.append(int(
                    ev_pct >= 3.0 and
                    abs(avg_other - pin_prob) < 0.05 and
                    len(books) >= 3
                ))

        if len(X_rows) >= MAX_SAMPLES:
            break  # stop early once we hit the cap

    if len(X_rows) < MIN_TRAINING_ROWS:
        return {"success": False, "reason": "insufficient_data"}

    X, y = sample_if_large(pd.DataFrame(X_rows).fillna(0), pd.Series(y_vals))
    X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, random_state=RANDOM_STATE)

    model = xgb.XGBClassifier(
        n_estimators=N_ESTIMATORS_MEDIUM,
        max_depth=4,
        learning_rate=0.05,
        n_jobs=N_JOBS,
        random_state=RANDOM_STATE,
        verbosity=0,
        use_label_encoder=False,
        eval_metric="logloss",
    )
    model.fit(X_train, y_train, eval_set=[(X_test, y_test)], verbose=False)

    acc = accuracy_score(y_test, model.predict(X_test))
    metadata = {"accuracy": round(acc, 4), "n_samples": len(X)}
    save_model(model, MODEL_EV_CONF, metadata)
    logger.success(f"EV confidence trained — acc: {acc:.4f}, samples: {len(X):,}")
    return {"success": True, "accuracy": acc}


# ─────────────────────────────────────────────────────────────────────────
# TRAIN ALL
# ─────────────────────────────────────────────────────────────────────────

def train_all_models():
    db      = get_db()
    results = {}

    logger.info("=" * 60)
    logger.info(f"TrueOdds ML Training — {datetime.now(timezone.utc).strftime('%Y-%m-%d %H:%M UTC')}")
    logger.info(f"Window: last {ROLLING_DAYS} days | Max samples: {MAX_SAMPLES:,} | Jobs: {N_JOBS}")
    logger.info("=" * 60)

    results["clv"]        = train_clv_model(db)
    results["sharp"]      = train_sharp_money_model(db)
    results["arb_window"] = train_arb_window_model(db)
    results["ev_conf"]    = train_ev_confidence_model(db)

    success = sum(1 for r in results.values() if r.get("success"))
    logger.info(f"Training complete — {success}/{len(results)} models trained successfully")

    db["ml_training_log"].insert_one({
        "results":    results,
        "trained_at": datetime.now(timezone.utc),
        "config": {
            "rolling_days": ROLLING_DAYS,
            "max_samples":  MAX_SAMPLES,
            "ci_mode":      CI_MODE,
        },
    })

    return results


if __name__ == "__main__":
    train_all_models()
