"""
models/train.py
────────────────────────────────────────────────────────────────────────────
All ML models for TrueOdds — training and saving.

Optimizations:
  - 30-day rolling window: only train on recent data (most relevant)
  - 50k sample cap: random sample if data exceeds limit (fast + accurate)
  - n_jobs=1: single-threaded, so memory use stays flat on a ~1 GB VM
  - HistGradientBoosting: 10-50x faster than GradientBoosting on large data
  - CI fast mode: even fewer estimators on GitHub Actions free runners

Models:
  1. CLV Predictor         — predicts closing line value
  2. Sharp Money Detector  — detects sharp money signals
  3. Arb Window Predictor  — predicts how long arb will last
  4. EV Confidence Score   — confidence score for +EV bets
"""

import os
import gc
import time
import joblib
import numpy as np
import pandas as pd
from datetime import datetime, timezone, timedelta
from loguru import logger
from pymongo import MongoClient
from sklearn.model_selection import train_test_split, GroupShuffleSplit, StratifiedKFold, cross_val_score
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
from ml.features import (
    build_features_for_event, american_to_decimal, build_cross_book_features, minutes_to_game,
    build_event_level_features, clean_h2h, parse_utc,
)
from ml.parquet_loader import load_historical_parquet, iter_h2h_snapshots, new_stream_stats

os.makedirs(MODEL_DIR, exist_ok=True)

_ZERO_MOVEMENT_FEATURES = {
    "total_movements":      0,
    "sharp_movements":      0,
    "soft_movements":       0,
    "avg_prob_change":      0.0,
    "max_prob_change":      0.0,
    "sharp_direction":      0,
    "movement_velocity":    0.0,
    "books_moving_same_dir": 0,
    "steam_detected":       False,
}


def build_features_from_parquet_row(row: dict) -> dict | None:
    """
    Build the same feature shape as features.build_features_for_event(),
    but from a single archived Parquet row instead of a live Mongo query.
    """
    book_odds = row.get("book_odds")
    if book_odds is None or (isinstance(book_odds, float) and pd.isna(book_odds)) or not isinstance(book_odds, dict):
        return None
    if not book_odds:
        return None

    commence = row.get("commence_time", "")
    features = {
        "event_id":        row.get("event_id", ""),
        "sport":           row.get("sport", ""),
        "home":            row.get("home", ""),
        "away":            row.get("away", ""),
        "minutes_to_game": minutes_to_game(commence),
    }
    features.update(build_cross_book_features(book_odds))
    features.update(_ZERO_MOVEMENT_FEATURES)
    return features


ROLLING_DAYS    = 30
MAX_SAMPLES     = 35_000
RANDOM_STATE    = 42

CI_MODE             = os.environ.get('CI_TRAINING', '').lower() == 'true'
N_ESTIMATORS_LARGE  = 50  if CI_MODE else 150
N_ESTIMATORS_MEDIUM = 30  if CI_MODE else 100
# Was -1 (all cores). On a ~950 MB VM every parallel worker carries its own copy of
# the data, which is what got training OOM-killed. Single-threaded is slower but flat.
N_JOBS              = 1

logger.info(f"Training mode : {'CI-FAST' if CI_MODE else 'FULL'}")
logger.info(f"Rolling window: last {ROLLING_DAYS} days")
logger.info(f"Max samples   : {MAX_SAMPLES:,}")
logger.info(f"n_jobs        : {N_JOBS} (single-threaded, memory-safe)")

# Quality gate. A model that can't beat the obvious do-nothing answer must not be
# saved and shown as "Trained": it would replace a working model and drive live
# advice with noise. Set ML_ALLOW_WEAK_MODELS=1 to save such models anyway.
ALLOW_WEAK_MODELS = os.environ.get("ML_ALLOW_WEAK_MODELS", "").lower() in ("1", "true", "yes")
SHARP_MIN_CV_AUC  = 0.55     # cross-validated AUC below this is indistinguishable from guessing


def get_db():
    client = MongoClient(MONGODB_URI, serverSelectionTimeoutMS=10_000)
    return client[DB_NAME]

def cutoff_date() -> datetime:
    return datetime.now(timezone.utc) - timedelta(days=ROLLING_DAYS)

def sample_if_large(X: pd.DataFrame, y: pd.Series, max_rows: int = MAX_SAMPLES):
    if len(X) <= max_rows:
        return X, y
    logger.info(f"Dataset has {len(X):,} rows — sampling down to {max_rows:,}")
    idx = np.random.RandomState(RANDOM_STATE).choice(len(X), max_rows, replace=False)
    return X.iloc[idx].reset_index(drop=True), y.iloc[idx].reset_index(drop=True)

def _to_native(obj):
    """Recursively convert numpy scalars/arrays to plain Python so pymongo's BSON
    encoder accepts them (it rejects numpy.float32, which silently broke the
    MongoDB copy of the CLV model while the on-disk copy saved fine)."""
    if isinstance(obj, dict):
        return {k: _to_native(v) for k, v in obj.items()}
    if isinstance(obj, (list, tuple)):
        return [_to_native(v) for v in obj]
    if isinstance(obj, np.generic):
        return obj.item()
    if isinstance(obj, np.ndarray):
        return obj.tolist()
    return obj


def save_model(model, name: str, metadata: dict = None):
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
                "metadata":   _to_native(metadata or {}),
            },
            upsert=True,
        )
        client.close()
        logger.success(f"Model saved to MongoDB: {name}")
    except Exception as e:
        logger.warning(f"Could not save to MongoDB: {e}")

    return path

def load_model(name: str):
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

# ─────────────────────────────────────────────────────────────────────────────
# CLV predictor
#
# Question the model answers (see models/predict.py::predict_clv):
#     "From the market as it looks right now, how much will the average decimal
#      price move between now and the closing line?"
#
# So a training sample is one moment in an event's life:
#     features = what the market looked like at that moment (and how far from
#                the start of the game it was)
#     label    = closing average decimal odds  -  average decimal odds at that moment
#
# The previous builder instead described the market at the CLOSE and labelled it
# with the open→close move, using movement features computed over that same move
# (including `<team>_opening_line_shift`, which is literally the label), so it
# scored well while learning nothing. It also made a column per team name,
# double-counted events that straddle the Mongo/Parquet boundary, held every
# archived row in memory at once, and only counted events with >=5 snapshots.
# ─────────────────────────────────────────────────────────────────────────────
CLV_ROLLING_DAYS     = int(os.environ.get("CLV_ROLLING_DAYS", 90))   # CLV needs far more history than 30 days gives
CLV_MIN_EVENTS       = 100        # distinct finished games (samples from one game are correlated)
CLV_MIN_SPAN_MINUTES = 60         # an event must be observed for at least this long
# Lead-time bands (minutes before the game): <1h, 1-6h, 6-24h, 24-48h, >48h.
# One sample per band per event, taken the first time the market is seen in it.
CLV_BAND_BOUNDS_MIN  = (60, 360, 1440, 2880)


def _lead_band(minutes_to_start: float) -> int:
    for i, bound in enumerate(CLV_BAND_BOUNDS_MIN):
        if minutes_to_start < bound:
            return i
    return len(CLV_BAND_BOUNDS_MIN)


def _avg_decimal_shift(from_h2h: dict, to_h2h: dict):
    """
    Change in average decimal odds from one snapshot to another, averaged over
    selections, using only books that quote both. None if nothing is comparable.
    """
    shifts = []
    for selection, from_books in from_h2h.items():
        to_books = to_h2h.get(selection)
        if not to_books:
            continue
        common = set(from_books) & set(to_books)
        if not common:
            continue
        start = np.mean([american_to_decimal(from_books[b]) for b in common])
        end = np.mean([american_to_decimal(to_books[b]) for b in common])
        shifts.append(end - start)
    return float(np.mean(shifts)) if shifts else None


class _ClvEventAccumulator:
    """
    Builds a small per-event summary from a STREAM of real snapshots coming from
    both stores (Mongo and Parquet), in any order. Per event it keeps only the
    first/last timestamps, the closing snapshot, and one snapshot per lead-time
    band, so memory grows with the number of events, not the number of rows.
    Because both stores feed one accumulator, a game that straddles the 7-day
    Mongo/Parquet boundary becomes ONE event with its true opening and closing,
    instead of two partial rows.
    """

    def __init__(self):
        self.events = {}

    def add(self, event_id, ts, commence_raw, h2h):
        if not event_id or not h2h:
            return
        commence = parse_utc(commence_raw)
        ev = self.events.get(event_id)
        if ev is None:
            ev = self.events[event_id] = {
                "n": 0, "first_ts": ts, "commence": commence, "bands": {}, "last_pre": None, "last_any": None,
            }
        ev["n"] += 1
        if ts < ev["first_ts"]:
            ev["first_ts"] = ts
        if commence is not None:
            ev["commence"] = commence
        if ev["last_any"] is None or ts > ev["last_any"][0]:
            ev["last_any"] = (ts, h2h)
        if commence is not None:
            # The closing line is the last price before the game starts.
            if ts <= commence and (ev["last_pre"] is None or ts > ev["last_pre"][0]):
                ev["last_pre"] = (ts, h2h)
            minutes_to_start = (commence - ts).total_seconds() / 60.0
            if minutes_to_start >= 0:
                band = _lead_band(minutes_to_start)
                cur = ev["bands"].get(band)
                if cur is None or ts < cur[0]:
                    ev["bands"][band] = (ts, h2h, minutes_to_start)

    def samples(self, now, funnel: dict):
        """Yield (features, label, event_id) and fill in the funnel counters."""
        for event_id, ev in self.events.items():
            funnel["events_seen"] += 1
            # No closing line exists until the game has started, so an upcoming
            # game has nothing to learn from yet.
            if ev["commence"] is None or ev["commence"] > now:
                funnel["events_not_started"] += 1
                continue
            close = ev["last_pre"] or ev["last_any"]
            close_ts, close_h2h = close
            if ev["n"] < 2 or (close_ts - ev["first_ts"]).total_seconds() < CLV_MIN_SPAN_MINUTES * 60:
                funnel["events_too_short"] += 1
                continue
            made = 0
            for band in sorted(ev["bands"]):
                ts, h2h, minutes_to_start = ev["bands"][band]
                if ts >= close_ts:                      # the closing snapshot itself has nothing left to predict
                    continue
                label = _avg_decimal_shift(h2h, close_h2h)
                if label is None:
                    continue
                feats = build_event_level_features({"h2h": h2h})
                feats["minutes_to_game"] = float(minutes_to_start)
                made += 1
                yield feats, label, event_id
            if made:
                funnel["events_used"] += 1
            else:
                funnel["events_no_usable_slice"] += 1


def build_clv_dataset(db):
    """
    Returns (X, y, groups, info). X is None when there isn't enough usable data;
    `info` then explains exactly where events were lost.
    """
    now = datetime.now(timezone.utc)
    cutoff = now - timedelta(days=CLV_ROLLING_DAYS)
    logger.info(f"Building CLV dataset ({CLV_ROLLING_DAYS}-day window, Mongo + Parquet streamed into one timeline per event)...")

    acc = _ClvEventAccumulator()

    # Recent history still in Mongo. One pass over real snapshots, h2h only.
    mongo_rows = 0
    cursor = db[COL_ODDS_SNAPSHOTS].find(
        {"fetched_at": {"$gte": cutoff}, "is_duplicate": {"$ne": True}, "book_odds.h2h": {"$exists": True}},
        {"event_id": 1, "fetched_at": 1, "commence_time": 1, "book_odds.h2h": 1},
    ).batch_size(2000)
    for doc in cursor:
        ts = parse_utc(doc.get("fetched_at"))
        h2h = clean_h2h((doc.get("book_odds") or {}).get("h2h"))
        if ts is None or not h2h:
            continue
        mongo_rows += 1
        acc.add(doc.get("event_id"), ts, doc.get("commence_time"), h2h)

    # Older history archived to Parquet, streamed file by file.
    pq_stats = new_stream_stats()
    for row in iter_h2h_snapshots(cutoff_after=pd.Timestamp(cutoff), stats=pq_stats):
        acc.add(row["event_id"], row["fetched_at"], row["commence_time"], row["h2h"])

    funnel = {"events_seen": 0, "events_not_started": 0, "events_too_short": 0,
              "events_no_usable_slice": 0, "events_used": 0}
    X_rows, y_vals, groups = [], [], []
    for feats, label, event_id in acc.samples(now, funnel):
        X_rows.append(feats)
        y_vals.append(label)
        groups.append(event_id)

    info = {
        "window_days": CLV_ROLLING_DAYS,
        "mongo_snapshots": mongo_rows,
        "parquet": pq_stats,
        **funnel,
        "samples": len(X_rows),
        "needed_samples": MIN_TRAINING_ROWS,
        "needed_events": CLV_MIN_EVENTS,
    }
    logger.info(
        "CLV data funnel: "
        f"{mongo_rows:,} Mongo snapshots + {pq_stats['rows_real_h2h']:,} Parquet snapshots "
        f"({pq_stats['files_read']} files read, {pq_stats['files_pruned']} skipped by date, "
        f"{pq_stats['files_no_odds']} without odds [{pq_stats['rows_odds_lost']:,} non-marker snapshots in them have NO odds], "
        f"{pq_stats['files_unreadable']} unreadable) "
        f"→ {funnel['events_seen']:,} events: {funnel['events_not_started']:,} not started yet, "
        f"{funnel['events_too_short']:,} observed < {CLV_MIN_SPAN_MINUTES} min, "
        f"{funnel['events_no_usable_slice']:,} with no comparable prices, "
        f"{funnel['events_used']:,} usable → {len(X_rows):,} samples"
    )

    if len(X_rows) < MIN_TRAINING_ROWS or funnel["events_used"] < CLV_MIN_EVENTS:
        logger.warning(
            f"CLV: {len(X_rows):,} samples from {funnel['events_used']:,} events "
            f"(need {MIN_TRAINING_ROWS:,} samples from at least {CLV_MIN_EVENTS} events)"
        )
        return None, None, None, info

    X = pd.DataFrame(X_rows).fillna(0)
    logger.info(f"CLV dataset: {len(X):,} rows from {funnel['events_used']:,} events, {len(X.columns)} features")
    return X, pd.Series(y_vals, dtype=float), pd.Series(groups), info


def train_clv_model(db) -> dict:
    X, y, groups, info = build_clv_dataset(db)
    if X is None:
        return {
            "success": False,
            "reason": "insufficient_data",
            "detail": (f"{info['samples']:,} usable samples from {info['events_used']:,} finished games in the last "
                       f"{info['window_days']} days; needs {info['needed_samples']:,} samples from at least {info['needed_events']} games."),
            "samples": info["samples"],
            "events": info["events_used"],
            "funnel": info,
        }

    if len(X) > MAX_SAMPLES:
        logger.info(f"CLV: sampling {len(X):,} rows down to {MAX_SAMPLES:,}")
        keep = np.random.RandomState(RANDOM_STATE).choice(len(X), MAX_SAMPLES, replace=False)
        X, y, groups = X.iloc[keep].reset_index(drop=True), y.iloc[keep].reset_index(drop=True), groups.iloc[keep].reset_index(drop=True)

    # Several samples come from the same game, so the held-out set must contain
    # whole games; a random row split would let the model "see" a test game's
    # other time slices during training.
    train_idx, test_idx = next(GroupShuffleSplit(n_splits=1, test_size=0.2, random_state=RANDOM_STATE).split(X, y, groups))
    X_train, X_test = X.iloc[train_idx], X.iloc[test_idx]
    y_train, y_test = y.iloc[train_idx], y.iloc[test_idx]

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

    mae = float(mean_absolute_error(y_test, model.predict(X_test)))
    # What you'd score by ignoring the features and always guessing the typical move.
    baseline_mae = float(mean_absolute_error(y_test, np.full(len(y_test), float(np.median(y_train)))))
    fi = dict(zip(X.columns, model.feature_importances_))
    top = sorted(fi.items(), key=lambda x: x[1], reverse=True)[:10]
    n_events = int(groups.nunique())

    if mae >= baseline_mae and not ALLOW_WEAK_MODELS:
        detail = (f"Held-out MAE {mae:.4f} is not better than simply guessing the typical move ({baseline_mae:.4f}) across "
                  f"{len(X):,} samples from {n_events:,} games, so there is no usable signal in these features yet. "
                  "The previously saved model (if any) was left in place.")
        logger.warning(f"CLV NOT saved: {detail}")
        return {"success": False, "reason": "no_signal", "detail": detail, "mae": mae, "baseline_mae": baseline_mae,
                "samples": len(X), "events": n_events}

    metadata = {"mae": round(mae, 6), "baseline_mae": round(baseline_mae, 6), "n_samples": len(X), "n_events": n_events,
                "n_features": len(X.columns), "window_days": CLV_ROLLING_DAYS, "top_features": top}
    save_model(model, MODEL_CLV, metadata)
    verdict = "beats" if mae < baseline_mae else "does NOT beat"
    logger.success(f"CLV trained — MAE: {mae:.6f} ({verdict} the always-guess-the-median baseline of {baseline_mae:.6f}), "
                   f"{len(X):,} samples from {n_events:,} games")
    return {"success": True, "mae": mae, "baseline_mae": baseline_mae, "samples": len(X), "events": n_events}


# ─────────────────────────────────────────────────────────────────────────────
# Sharp money detector
#
# Label: did a SHARP book (SHARP_BOOKS) move a line BEFORE the other books did?
#
# The previous builder queried only {is_sharp_book: True}, so it never loaded a
# single soft-book movement. "Who moved first" is undefined without both sides,
# so every group fell through to a fallback that returned 1 — a constant label,
# a model that just says "1", and the dashboard's "100% accuracy, AUC 0.0000".
# Here the movements of ALL books are grouped per (event, market, selection) in
# MongoDB, and only groups where both kinds moved and one clearly led are kept.
# ─────────────────────────────────────────────────────────────────────────────
SHARP_MIN_PER_CLASS = 25     # each outcome must occur at least this often, or there is nothing to learn


# Stand-in for "this kind of book never moved". Using a sentinel date (instead of
# null) means the earliest-move calculation doesn't depend on how $min treats nulls.
_NEVER = datetime(9999, 12, 31)


def _sharp_group_pipeline(cutoff):
    is_sharp = {"$eq": ["$is_sharp_book", True]}
    return [
        {"$match": {"timestamp": {"$gte": cutoff}}},
        {"$group": {
            "_id": {"event_id": "$event_id", "market": "$market", "selection": "$selection"},
            "n_total": {"$sum": 1},
            "n_sharp": {"$sum": {"$cond": [is_sharp, 1, 0]}},
            "first_sharp": {"$min": {"$cond": [is_sharp, "$timestamp", _NEVER]}},
            "first_soft": {"$min": {"$cond": [is_sharp, _NEVER, "$timestamp"]}},
            "sum_prob_change": {"$sum": "$prob_change"},
            "max_abs_prob_change": {"$max": {"$abs": "$prob_change"}},
            "n_up": {"$sum": {"$cond": [{"$eq": ["$moved_up", True]}, 1, 0]}},
            "avg_gap_seconds": {"$avg": "$seconds_since_prev"},
        }},
        # "Who moved first" needs both kinds of book to have moved.
        {"$match": {"first_sharp": {"$lt": _NEVER}, "first_soft": {"$lt": _NEVER}}},
    ]


def build_sharp_money_dataset(db):
    """Returns (X, y, info). X is None when the data can't support a model; info says why."""
    logger.info(f"Building sharp money dataset ({ROLLING_DAYS}-day window, sharp AND soft movements)...")
    cutoff = cutoff_date()

    groups = list(db[COL_LINE_MOVEMENTS].aggregate(_sharp_group_pipeline(cutoff), allowDiskUse=True))

    X_rows, y_vals, ties = [], [], 0
    for g in groups:
        first_sharp, first_soft = g["first_sharp"], g["first_soft"]
        # Both moved in the same poll cycle: timestamps are poll times, so this
        # carries no information about who led. Don't invent a label for it.
        if first_sharp == first_soft:
            ties += 1
            continue
        n_total = max(int(g["n_total"]), 1)
        gap_seconds = g.get("avg_gap_seconds") or 0.0
        X_rows.append({
            "n_sharp_moves":   int(g["n_sharp"]),
            "avg_prob_change": float(g.get("sum_prob_change") or 0.0) / n_total,
            "max_prob_change": float(g.get("max_abs_prob_change") or 0.0),
            "total_moves":     n_total,
            "sharp_ratio":     int(g["n_sharp"]) / n_total,
            "moved_up_ratio":  int(g.get("n_up") or 0) / n_total,
            "velocity":        n_total / max(gap_seconds / 60, 1),
        })
        y_vals.append(int(first_sharp < first_soft))

    positives = int(sum(y_vals))
    negatives = len(y_vals) - positives
    info = {"groups_with_both": len(groups), "ties_skipped": ties, "samples": len(y_vals),
            "sharp_led": positives, "soft_led": negatives, "needed_samples": MIN_TRAINING_ROWS,
            "needed_per_class": SHARP_MIN_PER_CLASS}
    logger.info(f"Sharp data: {len(groups):,} (event, market, selection) groups where sharp and soft books both moved → "
                f"{ties:,} ties skipped → {len(y_vals):,} samples ({positives:,} sharp led / {negatives:,} soft led)")

    if len(y_vals) < MIN_TRAINING_ROWS:
        info["reason"] = "insufficient_data"
        info["detail"] = (f"{len(y_vals):,} usable groups where sharp and soft books both moved and one clearly led "
                          f"(needs {MIN_TRAINING_ROWS:,}); {ties:,} more moved in the same poll and can't be ordered.")
        logger.warning(f"Sharp: {info['detail']}")
        return None, None, info
    if min(positives, negatives) < SHARP_MIN_PER_CLASS:
        info["reason"] = "single_class"
        info["detail"] = (f"Only {min(positives, negatives)} of {len(y_vals):,} samples are on the minority side "
                          f"(sharp led {positives:,}, soft led {negatives:,}); needs at least {SHARP_MIN_PER_CLASS} of each. "
                          "A model trained on this would only learn to repeat the majority answer.")
        logger.warning(f"Sharp: {info['detail']}")
        return None, None, info

    X, y = sample_if_large(pd.DataFrame(X_rows).fillna(0), pd.Series(y_vals))
    logger.info(f"Sharp dataset: {len(X):,} rows")
    return X, y, info


def train_sharp_money_model(db) -> dict:
    X, y, info = build_sharp_money_dataset(db)
    if X is None:
        return {"success": False, "reason": info["reason"], "detail": info["detail"], "samples": info["samples"], "funnel": info}

    # Stratified: both outcomes are guaranteed in the held-out set, so AUC is always defined.
    X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, random_state=RANDOM_STATE, stratify=y)

    model = HistGradientBoostingClassifier(
        max_iter=N_ESTIMATORS_LARGE,
        max_depth=4,
        learning_rate=0.05,
        random_state=RANDOM_STATE,
    )
    model.fit(X_train, y_train)

    preds = model.predict(X_test)
    acc = float(accuracy_score(y_test, preds))
    auc = float(roc_auc_score(y_test, model.predict_proba(X_test)[:, 1]))
    positive_rate = float(y.mean())
    # Accuracy of always answering with the more common outcome — the number to beat.
    baseline_acc = float(max(y_test.mean(), 1 - y_test.mean()))

    # One 20% test split is a noisy judge of "is there any signal?". Cross-validation
    # uses every sample, so it separates a real edge from luck far more reliably.
    cv_auc = float(cross_val_score(
        HistGradientBoostingClassifier(max_iter=N_ESTIMATORS_LARGE, max_depth=4, learning_rate=0.05, random_state=RANDOM_STATE),
        X, y, cv=StratifiedKFold(n_splits=5, shuffle=True, random_state=RANDOM_STATE), scoring="roc_auc").mean())
    if cv_auc < SHARP_MIN_CV_AUC and not ALLOW_WEAK_MODELS:
        detail = (f"Cross-validated AUC is {cv_auc:.3f} (0.5 = pure guessing; needs {SHARP_MIN_CV_AUC}) on {len(X):,} samples, "
                  "so these features don't yet predict which side leads. The previously saved model (if any) was left in place.")
        logger.warning(f"Sharp money NOT saved: {detail}")
        return {"success": False, "reason": "no_signal", "detail": detail, "samples": len(X), "cv_auc": cv_auc}

    metadata = {"accuracy": round(acc, 4), "auc": round(auc, 4), "baseline_accuracy": round(baseline_acc, 4),
                "cv_auc": round(cv_auc, 4), "n_samples": len(X), "positive_rate": positive_rate, "ties_skipped": info["ties_skipped"]}
    save_model(model, MODEL_SHARP, metadata)
    logger.success(f"Sharp money trained — acc: {acc:.4f} (always-majority baseline {baseline_acc:.4f}), "
                   f"AUC: {auc:.4f} (cross-validated {cv_auc:.4f}), samples: {len(X):,}")
    return {"success": True, "accuracy": acc, "auc": auc, "cv_auc": cv_auc, "baseline_accuracy": baseline_acc, "samples": len(X)}


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
        "americanfootball_ncaaf": 7, "basketball_wnba": 8,
        "aussierules_afl": 9, "rugbyleague_nrl": 10,
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

def train_ev_confidence_model(db) -> dict:
    logger.info("Building EV confidence dataset (30-day window, Mongo + Parquet merged)...")
    cutoff = cutoff_date()

    snapshots = list(db[COL_ODDS_SNAPSHOTS].find(
        {"book_odds.h2h": {"$exists": True}, "fetched_at": {"$gte": cutoff}},
        sort=[("fetched_at", -1)],
    ).limit(MAX_SAMPLES))

    remaining_budget = MAX_SAMPLES - len(snapshots)
    if remaining_budget > 0:
        archived_df = load_historical_parquet(
            cutoff_after=pd.Timestamp(cutoff),
            columns=["event_id", "book_odds"],
        )
        if not archived_df.empty and "book_odds" in archived_df.columns:
            archived_records = archived_df.to_dict("records")
            archived_usable = [
                r for r in archived_records
                if isinstance(r.get("book_odds"), dict) and r["book_odds"].get("h2h")
            ][:remaining_budget]
            logger.info(f"EV confidence: +{len(archived_usable)} archived (Parquet) rows added")
            snapshots.extend(archived_usable)

    if len(snapshots) < MIN_TRAINING_ROWS:
        return {"success": False, "reason": "insufficient_data"}

    X_rows, y_vals = [], []

    for snap in snapshots:
        h2h = (snap.get("book_odds") or {}).get("h2h") or {}
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

                # The label below is built from ev_pct, sharp_agreement and n_books, so
                # those must NOT also be inputs (the model would just re-read the
                # answer key: it scored a meaningless 100%). Only the raw market
                # prices are given.
                X_rows.append({
                    "pin_prob":        pin_prob,
                    "book_dec":        book_dec,
                })
                y_vals.append(int(
                    ev_pct >= 3.0 and
                    abs(avg_other - pin_prob) < 0.05 and
                    len(books) >= 3
                ))

        if len(X_rows) >= MAX_SAMPLES:
            break

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

def _run_model(name: str, trainer, db) -> dict:
    """
    Run one trainer so that a failure in one model can never cost the others.
    Previously the four trainers ran back to back with no handling: if the first
    (CLV) raised anything — an out-of-memory error, a bad parquet file — the
    exception escaped, the other three never ran, and NOTHING was written to
    ml_training_log, which is why the history showed so few runs.
    """
    started = time.time()
    try:
        result = trainer(db)
    except Exception as e:
        logger.exception(f"[{name}] training crashed")
        result = {"success": False, "reason": "error", "detail": f"{type(e).__name__}: {e}"[:300]}
    result["seconds"] = round(time.time() - started, 1)
    gc.collect()
    return result


def train_all_models():
    db      = get_db()
    results = {}

    logger.info("=" * 60)
    logger.info(f"TrueOdds ML Training — {datetime.now(timezone.utc).strftime('%Y-%m-%d %H:%M UTC')}")
    logger.info(f"Window: last {ROLLING_DAYS} days (CLV: {CLV_ROLLING_DAYS}) | Max samples: {MAX_SAMPLES:,} | Jobs: {N_JOBS}")
    logger.info("=" * 60)

    results["clv"]        = _run_model("clv", train_clv_model, db)
    results["sharp"]      = _run_model("sharp", train_sharp_money_model, db)
    results["arb_window"] = _run_model("arb_window", train_arb_window_model, db)
    results["ev_conf"]    = _run_model("ev_conf", train_ev_confidence_model, db)

    success = sum(1 for r in results.values() if r.get("success"))
    logger.info(f"Training complete — {success}/{len(results)} models trained successfully")
    for key, r in results.items():
        if not r.get("success"):
            logger.warning(f"  {key}: {r.get('reason')} — {r.get('detail', '')}")

    try:
        db["ml_training_log"].insert_one({
            "results":    _to_native(results),
            "trained_at": datetime.now(timezone.utc),
            "config": {
                "rolling_days": ROLLING_DAYS,
                "clv_rolling_days": CLV_ROLLING_DAYS,
                "max_samples":  MAX_SAMPLES,
                "ci_mode":      CI_MODE,
            },
        })
    except Exception as e:
        logger.error(f"Could not write ml_training_log: {e}")

    return results

if __name__ == "__main__":
    train_all_models()
