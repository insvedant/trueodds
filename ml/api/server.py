"""
api/server.py
────────────────────────────────────────────────────────────────────────────
FastAPI server that serves ML predictions to the Node.js backend.
Node.js calls these endpoints instead of computing ML in JavaScript.

Run: uvicorn ml.api.server:app --host 0.0.0.0 --port 8000 --reload

Endpoints:
  GET  /health                          — health check
  GET  /predictions/{event_id}          — all predictions for one event
  GET  /predictions/batch               — predictions for all active events
  GET  /sharp-money                     — events with sharp money signals
  GET  /arb-windows                     — arbs with window predictions
  POST /predict/ev                      — score a single EV bet
  GET  /insights/{user_id}              — personal edge analysis for a user
"""

from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from datetime import datetime, timezone, timedelta
from pymongo import MongoClient
from loguru import logger
import os, sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(__file__))))
from ml.config import (
    MONGODB_URI, DB_NAME, COL_ML_PREDICTIONS, COL_ARB_HISTORY,
    COL_ODDS_SNAPSHOTS, COL_LINE_MOVEMENTS,
)
from ml.features import build_features_for_event, american_to_decimal
from ml.models.predict import (
    predict_clv, predict_sharp_money, predict_arb_window, predict_ev_confidence,
)

app = FastAPI(
    title="TrueOdds ML API",
    description="Machine learning predictions for sports betting",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:4000", "http://localhost:3000",
                   os.getenv("BACKEND_URL", ""), os.getenv("FRONTEND_URL", "")],
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Singleton MongoDB connection pool ─────────────────────────────────────────
# Previously get_db() opened a brand-new MongoClient on every request, causing
# a new TCP handshake each time — adding 200-500 ms latency per ML endpoint hit
# on Oracle Free Tier's limited network. Now we share one pool for the lifetime
# of the process. maxPoolSize=10 handles concurrent requests without contention.
_mongo_client = MongoClient(
    MONGODB_URI,
    maxPoolSize=10,
    serverSelectionTimeoutMS=3000,
    connectTimeoutMS=3000,
)
_db = _mongo_client[DB_NAME]

def get_db():
    """Return the shared database handle. Never creates a new MongoClient."""
    return _db
# ─────────────────────────────────────────────────────────────────────────────

@app.get("/health")
def health():
    db = get_db()
    snapshot_count = db[COL_ODDS_SNAPSHOTS].count_documents({})
    pred_count     = db[COL_ML_PREDICTIONS].count_documents({})
    return {
        "status":       "ok",
        "snapshots":    snapshot_count,
        "predictions":  pred_count,
        "timestamp":    datetime.now(timezone.utc).isoformat(),
    }

@app.get("/predictions/{event_id}")
def get_predictions(event_id: str):
    db   = get_db()
    pred = db[COL_ML_PREDICTIONS].find_one({"event_id": event_id}, {"_id": 0})

    if not pred:
        features = build_features_for_event(event_id, db)
        if not features:
            raise HTTPException(status_code=404, detail="Event not found")

        arb = db[COL_ARB_HISTORY].find_one(
            {"event_id": event_id, "resolved_at": None},
            sort=[("profit_pct", -1)]
        )

        pred = {
            "event_id":    event_id,
            "clv":         predict_clv(features),
            "sharp_money": predict_sharp_money(features),
            "arb_window":  predict_arb_window(arb) if arb else {"available": False},
            "generated_at": datetime.now(timezone.utc).isoformat(),
            "fresh":       True,
        }

    return pred

@app.get("/predictions/batch/all")
def get_batch_predictions(
    sport: str = Query(None),
    limit: int = Query(50, le=200),
):
    db  = get_db()
    now = datetime.now(timezone.utc)

    query = {"generated_at": {"$gte": now - timedelta(hours=1)}}
    if sport:
        query["sport"] = sport

    preds = list(db[COL_ML_PREDICTIONS].find(query, {"_id": 0}).limit(limit))
    return {"count": len(preds), "predictions": preds}

@app.get("/sharp-money")
def get_sharp_money_events(min_probability: float = Query(0.6)):
    db  = get_db()
    now = datetime.now(timezone.utc)

    preds = list(db[COL_ML_PREDICTIONS].find(
        {
            "generated_at": {"$gte": now - timedelta(hours=2)},
            "sharp_money.is_sharp": True,
            "sharp_money.probability": {"$gte": min_probability},
        },
        {"_id": 0}
    ).sort("sharp_money.probability", -1).limit(20))

    events = []
    for p in preds:
        sm = p.get("sharp_money", {})
        events.append({
            "event_id":    p.get("event_id"),
            "sport":       p.get("sport", ""),
            "game":        p.get("game", ""),
            "market":      p.get("market", "Moneyline"),
            "selection":   p.get("selection", ""),
            "generated_at": p.get("generated_at"),
            "sharp_money": sm,
        })

    return {"count": len(events), "events": events}

@app.get("/arb-windows")
def get_arb_windows():
    db  = get_db()
    now = datetime.now(timezone.utc)

    arbs = list(db[COL_ARB_HISTORY].find(
        {"resolved_at": None, "fetched_at": {"$gte": now - timedelta(hours=1)}},
        {"_id": 0}
    ).sort("profit_pct", -1).limit(20))

    windows = []
    for arb in arbs:
        window_pred = predict_arb_window(arb)
        windows.append({
            "event_id":   arb.get("event_id", ""),
            "game":       arb.get("game", ""),
            "sport":      arb.get("sport", ""),
            "market":     arb.get("market", ""),
            "profit_pct": arb.get("profit_pct", 0),
            "legs":       arb.get("legs", []),
            "books":      arb.get("books", []),
            "window":     window_pred,
        })

    return {"count": len(windows), "arbs": windows}

class EVInput(BaseModel):
    event_id: str
    book: str
    selection: str
    book_odds: float
    fair_odds: float
    sport: str = ""

@app.post("/predict/ev")
def score_ev(payload: EVInput):
    features = {
        "book_odds": payload.book_odds,
        "fair_odds": payload.fair_odds,
        "sport":     payload.sport,
        "book":      payload.book,
    }
    result = predict_ev_confidence(features)
    return {"event_id": payload.event_id, "ev_score": result}

@app.get("/insights/{user_id}")
def get_personal_insights(user_id: str):
    db = get_db()
    now = datetime.now(timezone.utc)
    ago = now - timedelta(days=30)

    bets = list(db["bets"].find(
        {"user": user_id, "result": {"$ne": "pending"}},
        {"_id": 0}
    ))

    if not bets:
        return {"available": False, "reason": "No settled bets found"}

    wins        = [b for b in bets if b.get("result") == "win"]
    total_stake  = sum(b.get("stake", 0) for b in bets)
    total_profit = sum(b.get("profit", 0) for b in bets)

    sport_map = {}
    for b in bets:
        s = b.get("sport", "Other")
        if s not in sport_map:
            sport_map[s] = {"bets": 0, "wins": 0, "profit": 0.0}
        sport_map[s]["bets"]   += 1
        sport_map[s]["wins"]   += 1 if b.get("result") == "win" else 0
        sport_map[s]["profit"] += b.get("profit", 0)

    sport_breakdown = sorted(
        [
            {
                "sport":   sport,
                "bets":    d["bets"],
                "wins":    d["wins"],
                "profit":  round(d["profit"], 2),
                "winRate": round(d["wins"] / d["bets"] * 100, 1) if d["bets"] else 0,
            }
            for sport, d in sport_map.items()
        ],
        key=lambda x: x["profit"],
        reverse=True,
    )

    return {
        "available":     True,
        "source":        "ml_db",
        "total_bets":    len(bets),
        "settled_bets":  len(bets),
        "wins":          len(wins),
        "total_stake":   round(total_stake, 2),
        "total_profit":  round(total_profit, 2),
        "roi":           round(total_profit / total_stake * 100, 1) if total_stake else 0,
        "win_rate":      round(len(wins) / len(bets) * 100, 1) if bets else 0,
        "sport_breakdown": sport_breakdown,
    }
