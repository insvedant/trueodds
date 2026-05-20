"""
collect_data.py
────────────────────────────────────────────────────────────────────────────
Runs every 60 seconds and stores every odds snapshot into MongoDB.
This builds the historical dataset needed to train ML models.

Each snapshot stores:
  - Raw odds from every book
  - Computed line movement vs previous snapshot
  - Timestamp for time-series analysis

Run standalone: python collect_data.py
Or via scheduler: scheduler/run.py calls this automatically
"""

import asyncio
import httpx
import json
from datetime import datetime, timezone
from loguru import logger
from pymongo import MongoClient, ASCENDING, DESCENDING
from pymongo.errors import DuplicateKeyError

import sys, os
sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))
from ml.config import (
    MONGODB_URI, DB_NAME, ODDS_API_KEY, ODDS_BASE_URL,
    TRACKED_SPORTS, TRACKED_BOOKS, SHARP_BOOKS,
    COL_ODDS_SNAPSHOTS, COL_LINE_MOVEMENTS, COL_ARB_HISTORY,
)


def get_db():
    client = MongoClient(MONGODB_URI)
    return client[DB_NAME]


def setup_indexes(db):
    """Create MongoDB indexes for efficient ML queries."""
    # Odds snapshots: query by sport, event, time
    db[COL_ODDS_SNAPSHOTS].create_index([
        ("sport", ASCENDING), ("event_id", ASCENDING), ("fetched_at", DESCENDING)
    ])
    db[COL_ODDS_SNAPSHOTS].create_index([("fetched_at", DESCENDING)])

    # Line movements: query by event + book + time
    db[COL_LINE_MOVEMENTS].create_index([
        ("event_id", ASCENDING), ("book", ASCENDING), ("timestamp", DESCENDING)
    ])

    # Arb history: query by sport + profit
    db[COL_ARB_HISTORY].create_index([
        ("sport", ASCENDING), ("profit_pct", DESCENDING), ("detected_at", DESCENDING)
    ])

    logger.info("MongoDB indexes created")


def american_to_decimal(american: int) -> float:
    if american >= 100:
        return (american / 100) + 1
    elif american <= -100:
        return (100 / abs(american)) + 1
    return 1.0


def implied_prob(american: int) -> float:
    dec = american_to_decimal(american)
    return 1 / dec if dec > 0 else 0


def no_vig_prob(odds_list: list) -> list:
    """Remove vig from a list of American odds, return true probabilities."""
    if not odds_list:
        return []
    raw_probs = [implied_prob(o) for o in odds_list]
    total = sum(raw_probs)
    if total <= 0:
        return raw_probs
    return [p / total for p in raw_probs]


async def fetch_odds_for_sport(sport: str, client: httpx.AsyncClient) -> list:
    """Fetch h2h odds for a sport from TheOddsAPI."""
    if not ODDS_API_KEY or "REPLACE" in ODDS_API_KEY:
        logger.warning(f"THEODDSAPI_KEY not configured — skipping {sport}")
        return []

    url = (
        f"{ODDS_BASE_URL}/sports/{sport}/odds"
        f"?apiKey={ODDS_API_KEY}"
        f"&regions=us,uk"
        f"&markets=h2h,spreads,totals"
        f"&oddsFormat=american"
        f"&bookmakers={','.join(TRACKED_BOOKS)}"
    )

    try:
        resp = await client.get(url, timeout=10.0)
        resp.raise_for_status()

        remaining = resp.headers.get("x-requests-remaining", "?")
        used       = resp.headers.get("x-requests-used", "?")
        logger.info(f"TheOddsAPI [{sport}] — used: {used}, remaining: {remaining}")

        return resp.json()
    except Exception as e:
        logger.error(f"Failed to fetch odds for {sport}: {e}")
        return []


def extract_book_odds(game: dict) -> dict:
    """
    Extract all book odds from a game into a flat structure:
    {
      "h2h": {
        "home": {"draftkings": -110, "fanduel": -115, ...},
        "away": {"draftkings": +100, ...},
      },
      "spreads": {...},
      "totals": {...},
    }
    """
    result = {}

    for bookmaker in game.get("bookmakers", []):
        book_key = bookmaker["key"]
        if book_key not in TRACKED_BOOKS:
            continue

        for market in bookmaker.get("markets", []):
            mkt_key = market["key"]
            if mkt_key not in result:
                result[mkt_key] = {}

            for outcome in market.get("outcomes", []):
                name  = outcome["name"]
                price = outcome["price"]

                if name not in result[mkt_key]:
                    result[mkt_key][name] = {}

                result[mkt_key][name][book_key] = price

    return result


def detect_line_movement(db, event_id: str, sport: str, book_odds: dict, now: datetime) -> list:
    """
    Compare current odds to previous snapshot.
    Returns list of line movement events for storage.
    """
    movements = []

    # Get previous snapshot for this event
    prev = db[COL_ODDS_SNAPSHOTS].find_one(
        {"event_id": event_id},
        sort=[("fetched_at", DESCENDING)]
    )

    if not prev:
        return movements  # first snapshot, no movement to detect

    prev_book_odds = prev.get("book_odds", {})

    for market, selections in book_odds.items():
        prev_market = prev_book_odds.get(market, {})

        for selection, books in selections.items():
            prev_selection = prev_market.get(selection, {})

            for book, current_odds in books.items():
                prev_odds = prev_selection.get(book)
                if prev_odds is None or prev_odds == current_odds:
                    continue

                # Line moved — record it
                is_sharp = book in SHARP_BOOKS
                movement = {
                    "event_id":    event_id,
                    "sport":       sport,
                    "market":      market,
                    "selection":   selection,
                    "book":        book,
                    "prev_odds":   prev_odds,
                    "curr_odds":   current_odds,
                    "prev_dec":    american_to_decimal(prev_odds),
                    "curr_dec":    american_to_decimal(current_odds),
                    "prev_prob":   implied_prob(prev_odds),
                    "curr_prob":   implied_prob(current_odds),
                    "prob_change": implied_prob(current_odds) - implied_prob(prev_odds),
                    "moved_up":    current_odds > prev_odds,   # odds got longer (more value)
                    "is_sharp_book": is_sharp,
                    "minutes_to_game": None,  # filled below if commence_time available
                    "timestamp":   now,
                    "seconds_since_prev": (now - prev["fetched_at"]).total_seconds(),
                }
                movements.append(movement)

    return movements


def detect_arbitrage(book_odds: dict, event_id: str, sport: str,
                     home: str, away: str, now: datetime) -> list:
    """
    Detect arbitrage opportunities from book odds.
    Returns list of arb records for storage.
    """
    arbs = []

    h2h = book_odds.get("h2h", {})
    if not h2h:
        return arbs

    # Find best odds for each side across all books
    best = {}
    for selection, books in h2h.items():
        if not books:
            continue
        best_book  = max(books, key=lambda b: american_to_decimal(books[b]))
        best_odds  = books[best_book]
        best[selection] = {"book": best_book, "odds": best_odds, "dec": american_to_decimal(best_odds)}

    if len(best) < 2:
        return arbs

    selections = list(best.values())
    implied_sum = sum(1 / s["dec"] for s in selections)

    if implied_sum >= 1.0:
        return arbs  # no arb

    profit_pct = ((1 - implied_sum) / implied_sum) * 100

    # Optimal stakes on $1000
    stake     = 1000
    legs      = []
    for sel_name, sel_data in best.items():
        optimal_stake = (stake / sel_data["dec"]) / implied_sum
        legs.append({
            "selection": sel_name,
            "book":      sel_data["book"],
            "odds":      sel_data["odds"],
            "dec":       sel_data["dec"],
            "stake":     round(optimal_stake, 2),
        })

    arbs.append({
        "event_id":    event_id,
        "sport":       sport,
        "home":        home,
        "away":        away,
        "market":      "h2h",
        "profit_pct":  round(profit_pct, 4),
        "implied_sum": round(implied_sum, 6),
        "legs":        legs,
        "detected_at": now,
        "resolved_at": None,           # filled when arb disappears
        "duration_minutes": None,      # filled when arb resolves
        "was_profitable": None,        # ground truth for ML training
    })

    return arbs


def resolve_old_arbs(db, current_event_ids: set, now: datetime):
    """Mark arbs as resolved when they disappear from the feed."""
    db[COL_ARB_HISTORY].update_many(
        {
            "resolved_at": None,
            "event_id":    {"$nin": list(current_event_ids)},
            "detected_at": {"$lt": now},
        },
        {
            "$set": {
                "resolved_at": now,
                "was_profitable": True,  # assumption: arbs that closed were taken
            },
            "$currentDate": {"updatedAt": True},
        }
    )


async def collect_snapshot():
    """Main collection function — fetches all sports and stores to MongoDB."""
    db  = get_db()
    now = datetime.now(timezone.utc)

    logger.info(f"Starting odds collection at {now.isoformat()}")

    async with httpx.AsyncClient() as client:
        current_arb_ids = set()
        total_games     = 0
        total_movements = 0
        total_arbs      = 0

        for sport in TRACKED_SPORTS:
            games = await fetch_odds_for_sport(sport, client)

            for game in games:
                event_id = game["id"]
                home     = game.get("home_team", "")
                away     = game.get("away_team", "")
                commence = game.get("commence_time", "")

                # Extract structured book odds
                book_odds = extract_book_odds(game)

                # ── Store odds snapshot ────────────────────────────────
                snapshot = {
                    "event_id":      event_id,
                    "sport":         sport,
                    "sport_title":   game.get("sport_title", sport),
                    "home":          home,
                    "away":          away,
                    "commence_time": commence,
                    "book_odds":     book_odds,
                    "raw_bookmakers": game.get("bookmakers", []),
                    "fetched_at":    now,
                }

                db[COL_ODDS_SNAPSHOTS].insert_one(snapshot)
                total_games += 1

                # ── Detect and store line movements ────────────────────
                movements = detect_line_movement(db, event_id, sport, book_odds, now)
                if movements:
                    db[COL_LINE_MOVEMENTS].insert_many(movements)
                    total_movements += len(movements)

                # ── Detect and store arbitrage ─────────────────────────
                arbs = detect_arbitrage(book_odds, event_id, sport, home, away, now)
                for arb in arbs:
                    # Check if this arb already exists (avoid duplicates)
                    existing = db[COL_ARB_HISTORY].find_one({
                        "event_id":   event_id,
                        "resolved_at": None,
                        "profit_pct": {"$gte": arb["profit_pct"] - 0.1}
                    })
                    if not existing:
                        db[COL_ARB_HISTORY].insert_one(arb)
                        total_arbs += 1

                    current_arb_ids.add(event_id)

        # Resolve arbs that are no longer in the feed
        resolve_old_arbs(db, current_arb_ids, now)

        logger.success(
            f"Collection complete — "
            f"{total_games} games, "
            f"{total_movements} line movements, "
            f"{total_arbs} new arbs"
        )

        return {
            "games":     total_games,
            "movements": total_movements,
            "arbs":      total_arbs,
            "timestamp": now.isoformat(),
        }


if __name__ == "__main__":
    # Run once immediately for testing
    setup_indexes(get_db())
    result = asyncio.run(collect_snapshot())
    print(json.dumps(result, indent=2))
