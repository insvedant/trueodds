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

def get_db():
    client = MongoClient(MONGODB_URI)
    return client[DB_NAME]

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

    # Primary: use ML predictions if the model has been trained
    preds = list(db[COL_ML_PREDICTIONS].find(
        {
            "generated_at": {"$gte": now - timedelta(hours=2)},
            "sharp_money.is_sharp": True,
            "sharp_money.probability": {"$gte": min_probability},
        },
        {"_id": 0}
    ).sort("sharp_money.probability", -1).limit(20))

    if preds:
        return {
            "count":   len(preds),
            "events":  preds,
            "message": f"{len(preds)} events with sharp money signals detected",
            "source":  "ml_model",
        }

    # Fallback: derive line movement alerts directly from odds_snapshots.
    # Find events where best odds moved significantly across snapshots.
    pipeline = [
        {"$match": {"fetched_at": {"$gte": now - timedelta(hours=3)}}},
        {"$sort": {"fetched_at": 1}},
        {"$group": {
            "_id": "$event_id",
            "sport":      {"$first": "$sport"},
            "home":       {"$first": "$home_team"},
            "away":       {"$first": "$away_team"},
            "first_odds": {"$first": "$best_odds"},
            "last_odds":  {"$last":  "$best_odds"},
            "snapshots":  {"$sum": 1},
            "fetched_at": {"$last": "$fetched_at"},
        }},
        {"$match": {"snapshots": {"$gte": 2}}},
    ]
    try:
        groups = list(db[COL_ODDS_SNAPSHOTS].aggregate(pipeline))
    except Exception:
        groups = []

    def to_prob(o):
        if not o: return 0
        if o > 0: return 100 / (o + 100)
        return abs(o) / (abs(o) + 100)

    events = []
    for g in groups:
        first = g.get("first_odds") or {}
        last  = g.get("last_odds")  or {}
        home_key = g.get("home", "")
        f_odd = first.get(home_key, 0) if isinstance(first, dict) else 0
        l_odd = last.get(home_key,  0) if isinstance(last,  dict) else 0
        if not (f_odd and l_odd):
            continue
        prob_change = abs(to_prob(l_odd) - to_prob(f_odd))
        if prob_change < 0.02:
            continue
        direction   = "up" if l_odd > f_odd else "down"
        probability = min(0.95, 0.60 + prob_change * 5)
        events.append({
            "event_id": g["_id"],
            "sport":    g.get("sport", ""),
            "home":     g.get("home", ""),
            "away":     g.get("away", ""),
            "generated_at": str(g.get("fetched_at", "")),
            "sharp_money": {
                "available":       True,
                "is_sharp":        True,
                "probability":     round(probability, 3),
                "signal_strength": "moderate",
                "direction":       direction,
                "from_line":       f"+{f_odd}" if f_odd > 0 else str(f_odd),
                "to_line":         f"+{l_odd}" if l_odd > 0 else str(l_odd),
            }
        })

    events.sort(key=lambda x: x["sharp_money"]["probability"], reverse=True)
    events = events[:20]

    return {
        "count":   len(events),
        "events":  events,
        "message": f"{len(events)} line movement signals (heuristic — model training in progress)",
        "source":  "heuristic_fallback",
    }

@app.get("/arb-windows")
def get_arb_windows():
    db  = get_db()
    now = datetime.now(timezone.utc)

    # Primary: unresolved arbs in arb_history
    active_arbs = list(db[COL_ARB_HISTORY].find(
        {"resolved_at": None},
        sort=[("profit_pct", -1)],
        limit=50,
    ))

    # Fallback: use recent arb_history regardless of resolved_at
    if not active_arbs:
        active_arbs = list(db[COL_ARB_HISTORY].find(
            {"created_at": {"$gte": now - timedelta(hours=2)}},
            sort=[("profit_pct", -1)],
            limit=50,
        ))

    # Second fallback: pull from odds_snapshots and synthesise arb opportunities
    if not active_arbs:
        recent_snaps = list(db[COL_ODDS_SNAPSHOTS].find(
            {"fetched_at": {"$gte": now - timedelta(hours=1)}},
            {"_id": 0, "event_id": 1, "sport": 1, "home_team": 1,
             "away_team": 1, "arb_opportunities": 1},
            limit=100,
        ))
        for s in recent_snaps:
            for arb in (s.get("arb_opportunities") or []):
                active_arbs.append({
                    "event_id":  s.get("event_id"),
                    "sport":     s.get("sport"),
                    "home":      s.get("home_team"),
                    "away":      s.get("away_team"),
                    "profit_pct": arb.get("profit", 0),
                    "legs":      arb.get("legs", []),
                    "resolved_at": None,
                })
        active_arbs.sort(key=lambda x: x.get("profit_pct", 0), reverse=True)
        active_arbs = active_arbs[:50]

    def make_prep_tip(arb):
        legs  = arb.get("legs", [])
        books = [l.get("book", "").replace("_", " ").title() for l in legs if l.get("book")]
        profit = arb.get("profit_pct", 0)
        if books:
            return f"Have accounts funded at {' & '.join(books[:2])}. Place both legs simultaneously."
        if profit >= 3:
            return "High-value arb — fund accounts in advance and use fast bet placement."
        return "Prepare accounts at both books. Act within 60s of spotting the window."

    results = []
    for arb in active_arbs:
        window  = predict_arb_window(arb)
        urgency = window.get("urgency", "medium") if window.get("available") else "medium"
        prob    = {"critical": 88, "high": 72, "medium": 55, "low": 38}.get(urgency, 55)
        expected_in = {"critical": "Now", "high": "5–15 min", "medium": "15–45 min", "low": "45–90 min"}.get(urgency, "30 min")
        results.append({
            "event_id":    arb.get("event_id"),
            "sport":       (arb.get("sport") or "").replace("americanfootball_", "").replace("basketball_", "").replace("icehockey_", "").replace("soccer_", "").upper(),
            "home":        arb.get("home"),
            "away":        arb.get("away"),
            "market":      "Moneyline",
            "profit_pct":  arb.get("profit_pct", 0),
            "legs":        arb.get("legs", []),
            "probability": prob,
            "expectedIn":  expected_in,
            "prepTip":     make_prep_tip(arb),
            "window":      window,
        })

    urgency_order = {"critical": 0, "high": 1, "medium": 2, "low": 3}
    results.sort(key=lambda x: urgency_order.get(
        x.get("window", {}).get("urgency", "low"), 3
    ))

    return {"count": len(results), "arbs": results}

class EVBetInput(BaseModel):
    game:         str
    sport:        str
    book:         str
    book_odds:    int       
    fair_odds:    int       
    ev_pct:       float
    n_books:      int = 5
    has_movements: int = 0

@app.post("/predict/ev")
def score_ev_bet(bet: EVBetInput):
    ev_dict = {
        "ev":            bet.ev_pct,
        "book_odds_int": bet.book_odds,
        "fair_odds_int": bet.fair_odds,
        "n_books":       bet.n_books,
        "has_movements": bet.has_movements,
    }
    confidence = predict_ev_confidence(ev_dict)
    return {
        "game":       bet.game,
        "sport":      bet.sport,
        "book":       bet.book,
        "ev_pct":     bet.ev_pct,
        "confidence": confidence,
    }

@app.get("/insights/{user_id}")
def get_personal_insights(user_id: str):
    db = get_db()

    
    bets = list(db["bets"].find(
        {"user": user_id, "result": {"$in": ["win", "loss"]}},
        sort=[("date", -1)],
        limit=500,
    ))

    if len(bets) < 10:
        return {
            "user_id": user_id,
            "message": "Need at least 10 settled bets for analysis",
            "bets_needed": max(0, 10 - len(bets)),
        }

    
    wins   = [b for b in bets if b.get("result") == "win"]
    losses = [b for b in bets if b.get("result") == "loss"]

    total_staked = sum(b.get("stake", 0) for b in bets)
    total_profit = sum(b.get("profit", 0) for b in bets)
    win_rate     = len(wins) / len(bets)
    roi          = (total_profit / total_staked * 100) if total_staked > 0 else 0

    
    from collections import defaultdict
    sport_stats = defaultdict(lambda: {"bets": 0, "profit": 0, "staked": 0})
    for b in bets:
        s = b.get("sport", "Unknown")
        sport_stats[s]["bets"]   += 1
        sport_stats[s]["profit"] += b.get("profit", 0)
        sport_stats[s]["staked"] += b.get("stake", 0)

    best_sport = max(sport_stats.items(), key=lambda x: x[1]["profit"], default=(None, {}))
    worst_sport= min(sport_stats.items(), key=lambda x: x[1]["profit"], default=(None, {}))

    
    bet_types = defaultdict(lambda: {"bets": 0, "profit": 0})
    for b in bets:
        t = b.get("betType", "standard")
        bet_types[t]["bets"]   += 1
        bet_types[t]["profit"] += b.get("profit", 0)

    
    
    clv_scores = []
    for b in bets:
        if b.get("odds") and b.get("closingOdds"):
            clv = american_to_decimal(int(b["odds"])) - american_to_decimal(int(b["closingOdds"]))
            clv_scores.append(clv)

    avg_clv = sum(clv_scores) / len(clv_scores) if clv_scores else None

    
    results_list = ["W" if b.get("result") == "win" else "L" for b in bets]
    current_streak = 1
    for i in range(1, len(results_list)):
        if results_list[i] == results_list[i-1]:
            current_streak += 1
        else:
            break

    
    if roi >= 8:
        grade = "A — Professional level edge"
    elif roi >= 4:
        grade = "B — Strong positive edge"
    elif roi >= 0:
        grade = "C — Breaking even"
    else:
        grade = "D — Below breakeven"

    return {
        "user_id":       user_id,
        "total_bets":    len(bets),
        "win_rate":      round(win_rate * 100, 1),
        "roi":           round(roi, 2),
        "total_profit":  round(total_profit, 2),
        "total_staked":  round(total_staked, 2),
        "edge_grade":    grade,
        "avg_clv":       round(avg_clv, 4) if avg_clv is not None else None,
        "current_streak": f"{current_streak} {'W' if results_list[0] == 'W' else 'L'}",
        "best_sport":    {"name": best_sport[0], **best_sport[1]} if best_sport[0] else None,
        "worst_sport":   {"name": worst_sport[0], **worst_sport[1]} if worst_sport[0] else None,
        "by_sport":      dict(sport_stats),
        "by_bet_type":   dict(bet_types),
        "recommendations": _get_recommendations(roi, win_rate, sport_stats, bet_types),
    }

def _get_recommendations(roi, win_rate, sport_stats, bet_types):
    recs = []
    if roi < 0:
        recs.append("Your ROI is negative — focus on arbitrage bets until you build confidence")
    if win_rate < 0.48:
        recs.append("Win rate below 48% — consider raising your minimum EV threshold")
    if len(sport_stats) >= 3:
        sorted_sports = sorted(sport_stats.items(), key=lambda x: x[1]["profit"], reverse=True)
        recs.append(f"Your best sport is {sorted_sports[0][0]} — focus more bets there")
        if sorted_sports[-1][1]["profit"] < -50:
            recs.append(f"Consider avoiding {sorted_sports[-1][0]} — consistent losses")
    return recs

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
