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
    COL_ODDS_SNAPSHOTS, COL_LINE_MOVEMENTS, COL_ARB_HISTORY, COL_STATS,
)

def get_db():
    client = MongoClient(MONGODB_URI)
    return client[DB_NAME]

def setup_indexes(db):
    """Create MongoDB indexes for efficient ML queries."""
    
    db[COL_ODDS_SNAPSHOTS].create_index([
        ("sport", ASCENDING), ("event_id", ASCENDING), ("fetched_at", DESCENDING)
    ])
    db[COL_ODDS_SNAPSHOTS].create_index([("fetched_at", DESCENDING)])
    # Supports the dedup-aware opening-line / feature-building queries that
    # filter on is_duplicate alongside event_id + fetched_at.
    db[COL_ODDS_SNAPSHOTS].create_index([
        ("event_id", ASCENDING), ("is_duplicate", ASCENDING), ("fetched_at", ASCENDING)
    ])

    
    db[COL_LINE_MOVEMENTS].create_index([
        ("event_id", ASCENDING), ("book", ASCENDING), ("timestamp", DESCENDING)
    ])

    
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

def book_odds_unchanged(prev: dict | None, book_odds: dict) -> bool:
    """
    Exact comparison of the previous snapshot's book_odds against the
    current one. American odds are integers, so this is an exact dict
    comparison — no floating point tolerance needed.
    Returns True only if every market/selection/book price is identical.
    """
    if not prev:
        return False
    return prev.get("book_odds", {}) == book_odds

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

def extract_compact_line_data(game: dict) -> dict:
    """
    Extract compact per-market odds from a game's bookmakers array,
    WITHOUT the full raw_bookmakers payload (titles, last_update strings,
    nested market/outcome arrays kept verbatim) that was the actual
    storage problem — confirmed by exhaustive search to have zero readers
    anywhere in this codebase.

    Replaces the old extract_book_odds(). Same name used at every call
    site is still `book_odds` (not renamed to a separate `line_data`
    field) — h2h/spreads/totals are kept in ONE structure, market-keyed
    first, because every existing training/feature function
    (build_cross_book_features, build_clv_dataset, train_ev_confidence_model)
    already depends on that exact shape for h2h. Introducing a second,
    differently-shaped field alongside it would duplicate the same price
    data and force every future feature to reshape one structure into the
    other — confirmed by inspection that nothing in the codebase reads
    "spreads"/"totals" today, so there is no existing shape to preserve
    there; extending book_odds in place is the minimal correct change.

    Shape:
    {
      "h2h": {
        "Team A": {"draftkings": -110, "fanduel": -115, ...},
        "Team B": {"draftkings": +100, ...},
      },
      "spreads": {
        "Team A": {"draftkings": {"price": -115, "point": -3.5}, ...},
        "Team B": {"draftkings": {"price": -105, "point":  3.5}, ...},
      },
      "totals": {
        "Over":  {"draftkings": {"price": -110, "point": 44.5}, ...},
        "Under": {"draftkings": {"price": -110, "point": 44.5}, ...},
      },
    }

    h2h entries stay a bare price (no point value exists for a
    moneyline), unchanged from before — this is the shape every existing
    model already reads, so nothing downstream breaks. spreads/totals
    entries now carry {price, point} instead of a bare price — confirmed
    by exhaustive search that nothing currently reads "spreads" or
    "totals" anywhere, so this shape change cannot break any existing
    consumer; it only enables the future spread-CLV / reverse-line-
    movement features this was requested for.

    Deliberately NOT capturing a per-book last_update timestamp here,
    even though the original raw_bookmakers had one and a future steam-
    detection feature could theoretically use it: every snapshot document
    already has its own top-level fetched_at, and detect_line_movement()
    already derives "did this change since last snapshot" by diffing
    consecutive snapshots' book_odds — adding a redundant per-book
    timestamp string to every market/selection/book combination would
    partially undo the storage reduction this change exists to achieve,
    for a capability nothing currently needs. Flagging this explicitly
    rather than silently omitting it.
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
                point = outcome.get("point")  # only present for spreads/totals

                if name not in result[mkt_key]:
                    result[mkt_key][name] = {}

                if point is not None:
                    result[mkt_key][name][book_key] = {"price": price, "point": point}
                else:
                    result[mkt_key][name][book_key] = price

    return result

# Backward-compatible alias — extract_book_odds is the name imported by
# import_historical.py and used historically. Kept as a plain alias
# (not a duplicated implementation) so there is exactly one place this
# logic lives, per the "minimal but correct" instruction.
extract_book_odds = extract_compact_line_data

def _extract_price_and_point(odds_value):
    """
    Normalize an odds value from either schema format into (price, point).

    New schema (spreads/totals after the raw_bookmakers removal):
        {"price": -115, "point": -3.5}  →  (-115, -3.5)

    Old schema (all markets in legacy Mongo/Parquet, h2h always):
        -115                             →  (-115, None)

    Returns (price: int|float, point: int|float|None).
    Never raises — if the value is a dict but missing expected keys,
    falls back gracefully to (None, None) so callers can skip the record.
    """
    if isinstance(odds_value, dict):
        price = odds_value.get("price")
        point = odds_value.get("point")
        return price, point
    elif odds_value is not None:
        return odds_value, None
    return None, None


def detect_line_movement(prev: dict | None, event_id: str, sport: str, book_odds: dict, now: datetime) -> list:
    """
    Compare current odds to a previously-fetched snapshot document.
    `prev` is passed in by the caller (already fetched once in
    collect_snapshot) so we don't hit Mongo twice per game per cycle.
    Returns list of line movement events for storage.

    Supports both schema formats in the same run:
    - h2h values are always bare integers (no point value exists for a moneyline)
    - spreads/totals values are {price, point} dicts in new snapshots, but may
      still be bare integers in old Mongo docs or old parquet backup files —
      both are handled via _extract_price_and_point() above.
    """
    movements = []

    if not prev:
        return movements

    prev_book_odds = prev.get("book_odds", {})

    for market, selections in book_odds.items():
        prev_market = prev_book_odds.get(market, {})

        for selection, books in selections.items():
            prev_selection = prev_market.get(selection, {})

            for book, current_value in books.items():
                prev_value = prev_selection.get(book)
                if prev_value is None:
                    continue

                curr_price, curr_point = _extract_price_and_point(current_value)
                prev_price, prev_point = _extract_price_and_point(prev_value)

                if curr_price is None or prev_price is None:
                    continue

                price_changed = curr_price != prev_price
                # point_changed only meaningful when the schema carries a point
                # (spreads/totals). When both are None (h2h or old-schema bare
                # price), we treat point as unchanged to avoid false positives.
                point_changed = (
                    curr_point is not None
                    and prev_point is not None
                    and curr_point != prev_point
                )

                if not price_changed and not point_changed:
                    continue

                is_sharp = book in SHARP_BOOKS

                movement = {
                    "event_id":      event_id,
                    "sport":         sport,
                    "market":        market,
                    "selection":     selection,
                    "book":          book,
                    # Price fields — always present
                    "prev_price":    prev_price,
                    "curr_price":    curr_price,
                    "prev_dec":      american_to_decimal(prev_price),
                    "curr_dec":      american_to_decimal(curr_price),
                    "prev_prob":     implied_prob(prev_price),
                    "curr_prob":     implied_prob(curr_price),
                    "prob_change":   implied_prob(curr_price) - implied_prob(prev_price),
                    "moved_up":      curr_price > prev_price,
                    "price_changed": price_changed,
                    # Point fields — None for h2h and old-schema data
                    "prev_point":    prev_point,
                    "curr_point":    curr_point,
                    "point_delta":   (
                        round(curr_point - prev_point, 4)
                        if curr_point is not None and prev_point is not None
                        else None
                    ),
                    "point_changed": point_changed,
                    # Legacy aliases — kept so build_sharp_money_dataset's
                    # existing query {is_sharp_book: True} still matches
                    # without a schema migration on the line_movements collection
                    "prev_odds":       prev_price,
                    "curr_odds":       curr_price,
                    "is_sharp_book":   is_sharp,
                    "minutes_to_game": None,
                    "timestamp":       now,
                    "seconds_since_prev": (
                        now - prev["fetched_at"]
                    ).total_seconds() if "fetched_at" in prev else None,
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
        return arbs  

    profit_pct = ((1 - implied_sum) / implied_sum) * 100

    
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
        "resolved_at": None,           
        "duration_minutes": None,      
        "was_profitable": None,        
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
                "was_profitable": True,  
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
        total_games      = 0
        total_duplicates = 0
        total_movements  = 0
        total_arbs       = 0

        for sport in TRACKED_SPORTS:
            games = await fetch_odds_for_sport(sport, client)

            for game in games:
                event_id = game["id"]
                home     = game.get("home_team", "")
                away     = game.get("away_team", "")
                commence = game.get("commence_time", "")

                
                book_odds = extract_book_odds(game)

                # Fetch the previous snapshot once — reused for both the
                # dedup check below and detect_line_movement(), instead of
                # querying Mongo twice per game per cycle.
                prev = db[COL_ODDS_SNAPSHOTS].find_one(
                    {"event_id": event_id},
                    sort=[("fetched_at", DESCENDING)]
                )
                unchanged = book_odds_unchanged(prev, book_odds)

                if unchanged:
                    # Odds identical to the last snapshot — store a tiny
                    # marker instead of duplicating the full payload
                    # (no book_odds, no raw_bookmakers). This still satisfies
                    # every existing fetched_at/event_id query (today's count,
                    # ml_ready threshold, distinct-events-today for
                    # predictions) without re-storing unchanged data.
                    snapshot = {
                        "event_id":      event_id,
                        "sport":         sport,
                        "sport_title":   game.get("sport_title", sport),
                        "home":          home,
                        "away":          away,
                        "commence_time": commence,
                        "fetched_at":    now,
                        "is_duplicate":  True,
                        "duplicate_of":  prev["_id"],
                    }
                else:
                    snapshot = {
                        "event_id":      event_id,
                        "sport":         sport,
                        "sport_title":   game.get("sport_title", sport),
                        "home":          home,
                        "away":          away,
                        "commence_time": commence,
                        "book_odds":     book_odds,
                        "fetched_at":    now,
                        "is_duplicate":  False,
                    }

                db[COL_ODDS_SNAPSHOTS].insert_one(snapshot)
                total_games += 1
                if unchanged:
                    total_duplicates += 1

                # total_snapshots must increment exactly once per document
                # ever written, at the moment it's written — this is the
                # only correct source of truth for an all-time counter.
                # archive_snapshots.py deliberately does NOT try to
                # reconstruct this number after the fact; it only ever
                # adjusts archived_snapshots/live_snapshots, since it has
                # no visibility into how many documents were inserted
                # between archive runs. upsert=True means the very first
                # snapshot ever written creates this doc correctly with no
                # special first-run handling needed anywhere else.
                db[COL_STATS].update_one(
                    {"_id": "global"},
                    {"$inc": {"total_snapshots": 1}},
                    upsert=True,
                )

                
                movements = detect_line_movement(prev, event_id, sport, book_odds, now)
                if movements:
                    db[COL_LINE_MOVEMENTS].insert_many(movements)
                    total_movements += len(movements)

                
                arbs = detect_arbitrage(book_odds, event_id, sport, home, away, now)
                for arb in arbs:
                    
                    existing = db[COL_ARB_HISTORY].find_one({
                        "event_id":   event_id,
                        "resolved_at": None,
                        "profit_pct": {"$gte": arb["profit_pct"] - 0.1}
                    })
                    if not existing:
                        db[COL_ARB_HISTORY].insert_one(arb)
                        total_arbs += 1

                    current_arb_ids.add(event_id)

        
        resolve_old_arbs(db, current_arb_ids, now)

        logger.success(
            f"Collection complete — "
            f"{total_games} games ({total_games - total_duplicates} changed, {total_duplicates} unchanged), "
            f"{total_movements} line movements, "
            f"{total_arbs} new arbs"
        )

        return {
            "games":       total_games,
            "changed":     total_games - total_duplicates,
            "duplicates":  total_duplicates,
            "movements":   total_movements,
            "arbs":        total_arbs,
            "timestamp":   now.isoformat(),
        }

if __name__ == "__main__":
    
    setup_indexes(get_db())
    result = asyncio.run(collect_snapshot())
    print(json.dumps(result, indent=2))
