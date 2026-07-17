"""
features.py
────────────────────────────────────────────────────────────────────────────
Builds ML-ready feature vectors from raw odds data stored in MongoDB.
Called before training any model and to generate real-time prediction inputs.

Features engineered per event:
  - Line movement velocity (how fast odds moved)
  - Sharp book vs soft book divergence
  - Historical accuracy per book per market
  - Time-to-game (minutes until event starts)
  - Cross-book implied probability spread
  - Arb opportunity presence and profit %
  - CLV proxies (early odds vs closing odds)
"""

import pandas as pd
import numpy as np
from datetime import datetime, timezone
from pymongo import MongoClient
from loguru import logger

import sys, os
sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))
from ml.config import (
    MONGODB_URI, DB_NAME, SHARP_BOOKS,
    COL_ODDS_SNAPSHOTS, COL_LINE_MOVEMENTS,
    COL_ARB_HISTORY, COL_FEATURE_STORE,
)

def get_db():
    client = MongoClient(MONGODB_URI)
    return client[DB_NAME]

def american_to_decimal(odds: float) -> float:
    if odds >= 100:
        return (odds / 100) + 1
    elif odds <= -100:
        return (100 / abs(odds)) + 1
    return 1.0

def build_line_movement_features(event_id: str, db) -> dict:
    """
    Build features from line movement history for an event.
    Returns dict of movement-based features.
    """
    movements = list(db[COL_LINE_MOVEMENTS].find(
        {"event_id": event_id},
        sort=[("timestamp", 1)]
    ))

    if not movements:
        return {
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

    df = pd.DataFrame(movements)
    df["prob_change_abs"] = df["prob_change"].abs()

    sharp_moves = df[df["is_sharp_book"] == True]
    soft_moves  = df[df["is_sharp_book"] == False]

    
    if len(df) >= 3:
        last_3 = df.tail(3)
        all_up   = (last_3["moved_up"] == True).all()
        all_down = (last_3["moved_up"] == False).all()
        steam    = bool(all_up or all_down)
    else:
        steam = False

    
    if len(sharp_moves) > 0:
        sharp_up   = (sharp_moves["moved_up"] == True).sum()
        sharp_down = (sharp_moves["moved_up"] == False).sum()
        sharp_dir  = 1 if sharp_up > sharp_down else (-1 if sharp_down > sharp_up else 0)
    else:
        sharp_dir = 0

    
    if len(df) >= 2:
        time_span_h = (
            df["timestamp"].max() - df["timestamp"].min()
        ).total_seconds() / 3600
        velocity = len(df) / max(time_span_h, 0.01)
    else:
        velocity = 0.0

    return {
        "total_movements":       len(df),
        "sharp_movements":       len(sharp_moves),
        "soft_movements":        len(soft_moves),
        "avg_prob_change":       float(df["prob_change"].mean()),
        "max_prob_change":       float(df["prob_change_abs"].max()),
        "sharp_direction":       sharp_dir,
        "movement_velocity":     round(velocity, 4),
        "books_moving_same_dir": int((df["moved_up"] == df["moved_up"].mode()[0]).sum()),
        "steam_detected":        steam,
    }

def build_cross_book_features(book_odds: dict) -> dict:
    """
    Build features from cross-book odds comparison.
    Captures disagreement between books as ML signal.
    """
    h2h = book_odds.get("h2h", {})
    features = {}

    for selection, books in h2h.items():
        if not books:
            continue

        # Parquet-sourced archived rows can carry None for a book's price
        # (odds pulled/unavailable at that snapshot) — drop those before any
        # of the American->decimal conversions below, instead of patching
        # each usage separately.
        books = {b: o for b, o in books.items() if o is not None}
        if not books:
            continue

        odds_list = list(books.values())
        dec_list  = [american_to_decimal(o) for o in odds_list]
        prob_list = [1 / d for d in dec_list]

        
        sharp_probs = [
            1 / american_to_decimal(books[b])
            for b in books if b in SHARP_BOOKS
        ]
        soft_probs = [
            1 / american_to_decimal(books[b])
            for b in books if b not in SHARP_BOOKS
        ]

        sharp_avg = np.mean(sharp_probs) if sharp_probs else np.mean(prob_list)
        soft_avg  = np.mean(soft_probs)  if soft_probs  else np.mean(prob_list)

        prefix = selection.lower().replace(" ", "_")[:20]
        features.update({
            f"{prefix}_best_odds_dec":     max(dec_list),
            f"{prefix}_worst_odds_dec":    min(dec_list),
            f"{prefix}_odds_spread":       max(dec_list) - min(dec_list),
            f"{prefix}_prob_mean":         float(np.mean(prob_list)),
            f"{prefix}_prob_std":          float(np.std(prob_list)),
            f"{prefix}_sharp_soft_div":    float(sharp_avg - soft_avg),
            f"{prefix}_book_count":        len(books),
            f"{prefix}_pinnacle_present":  int("pinnacle" in books),
        })

    
    all_best_probs = []
    for selection, books in h2h.items():
        if not books:
            continue
        # Same None-guard as above — this is a fresh, unfiltered read of
        # h2h.items() again, so it needs its own filter rather than relying
        # on the loop above having already cleaned it.
        clean_books = {b: o for b, o in books.items() if o is not None}
        if clean_books:
            best_dec = max(american_to_decimal(o) for o in clean_books.values())
            all_best_probs.append(1 / best_dec)

    features["combined_implied_prob"] = sum(all_best_probs) if all_best_probs else 1.0
    features["vig_estimate"]          = max(0, sum(all_best_probs) - 1.0) if all_best_probs else 0.0
    features["arb_present"]           = int(sum(all_best_probs) < 1.0) if all_best_probs else 0

    return features

def minutes_to_game(commence_time: str) -> float:
    """Calculate minutes until game starts."""
    try:
        game_time = datetime.fromisoformat(commence_time.replace("Z", "+00:00"))
        now       = datetime.now(timezone.utc)
        diff      = (game_time - now).total_seconds() / 60
        return max(0, diff)
    except Exception:
        return -1

def build_features_for_event(event_id: str, db) -> dict | None:
    """
    Build complete feature vector for an event.
    Used both for training (historical) and real-time prediction.
    """
    
    snapshot = db[COL_ODDS_SNAPSHOTS].find_one(
        {"event_id": event_id},
        sort=[("fetched_at", -1)]
    )
    if not snapshot:
        return None

    # The latest document for this event may be a lightweight "unchanged"
    # marker (no book_odds — see collect_data.py dedup logic) rather than a
    # full snapshot. Resolve it back to the real snapshot it points to so
    # feature building always has actual odds to work with.
    if snapshot.get("is_duplicate"):
        real = db[COL_ODDS_SNAPSHOTS].find_one({"_id": snapshot.get("duplicate_of")})
        if real:
            snapshot = real

    
    opening = db[COL_ODDS_SNAPSHOTS].find_one(
        {"event_id": event_id, "is_duplicate": {"$ne": True}},
        sort=[("fetched_at", 1)]
    )

    book_odds   = snapshot.get("book_odds", {})
    commence    = snapshot.get("commence_time", "")

    features = {
        "event_id":       event_id,
        "sport":          snapshot.get("sport", ""),
        "home":           snapshot.get("home", ""),
        "away":           snapshot.get("away", ""),
        "minutes_to_game": minutes_to_game(commence),
        "computed_at":    datetime.now(timezone.utc).isoformat(),
    }

    
    features.update(build_cross_book_features(book_odds))

    
    features.update(build_line_movement_features(event_id, db))

    
    if opening and opening["_id"] != snapshot["_id"]:
        opening_odds = opening.get("book_odds", {})
        h2h_curr = book_odds.get("h2h", {})
        h2h_open = opening_odds.get("h2h", {})

        for sel in h2h_curr:
            if sel in h2h_open:
                curr_books = h2h_curr[sel]
                open_books = h2h_open[sel]
                # Both need to be real, non-empty dicts before we can build
                # a set from them — either side can be missing/None for the
                # same reason as build_cross_book_features above.
                if not curr_books or not open_books:
                    continue
                common = set(curr_books) & set(open_books)
                # Values within the common keys can still individually be
                # None, so filter those out before converting to decimal.
                common = {b for b in common if curr_books[b] is not None and open_books[b] is not None}
                if common:
                    curr_avg = np.mean([american_to_decimal(curr_books[b]) for b in common])
                    open_avg = np.mean([american_to_decimal(open_books[b]) for b in common])
                    prefix   = sel.lower().replace(" ", "_")[:20]
                    features[f"{prefix}_opening_line_shift"] = float(curr_avg - open_avg)

    
    arb_count = db[COL_ARB_HISTORY].count_documents({"event_id": event_id})
    features["arb_count_detected"] = arb_count

    best_arb = db[COL_ARB_HISTORY].find_one(
        {"event_id": event_id},
        sort=[("profit_pct", -1)]
    )
    features["best_arb_profit_pct"] = best_arb["profit_pct"] if best_arb else 0.0

    return features

def build_training_dataset(db, min_samples: int = 100) -> pd.DataFrame:
    """
    Build full training dataset from all historical events.
    Returns DataFrame ready for XGBoost training.
    """
    logger.info("Building training dataset from MongoDB...")

    
    pipeline = [
        {"$group": {"_id": "$event_id", "count": {"$sum": 1}}},
        {"$match": {"count": {"$gte": 3}}},  
        {"$limit": 10000}
    ]
    events = list(db[COL_ODDS_SNAPSHOTS].aggregate(pipeline))
    logger.info(f"Found {len(events)} events with sufficient snapshots")

    rows = []
    for ev in events:
        features = build_features_for_event(ev["_id"], db)
        if features:
            rows.append(features)

    if not rows:
        logger.warning("No features built — need more data collected first")
        return pd.DataFrame()

    df = pd.DataFrame(rows)

    
    drop_cols = ["event_id", "sport", "home", "away", "computed_at"]
    df = df.drop(columns=[c for c in drop_cols if c in df.columns])

    
    df = df.fillna(0)

    logger.success(f"Training dataset: {len(df)} rows × {len(df.columns)} features")
    return df

if __name__ == "__main__":
    db = get_db()
    df = build_training_dataset(db)
    if not df.empty:
        print(df.describe())
        print("\nFeatures:", list(df.columns))
