"""
import_historical.py
────────────────────────────────────────────────────────────────────────────
Pulls historical odds data from TheOddsAPI historical endpoints.
Run ONCE after getting your API key to seed the database with past data.
This gives the ML models training data immediately instead of waiting weeks.

Usage: python import_historical.py --days 90 --sport americanfootball_nfl

TheOddsAPI historical endpoint:
  GET /v4/sports/{sport}/odds-history
  Supports date ranges, all books, all markets
"""

import asyncio
import httpx
import argparse
from datetime import datetime, timedelta, timezone
from loguru import logger
from pymongo import MongoClient

import sys, os
sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))
from ml.config import (
    MONGODB_URI, DB_NAME, ODDS_API_KEY, ODDS_BASE_URL,
    TRACKED_SPORTS, TRACKED_BOOKS, COL_ODDS_SNAPSHOTS,
    COL_LINE_MOVEMENTS, HISTORICAL_LOOKBACK_DAYS,
)
from ml.collect_data import extract_book_odds, detect_arbitrage, american_to_decimal, implied_prob


def get_db():
    client = MongoClient(MONGODB_URI)
    return client[DB_NAME]


async def fetch_historical_odds(sport: str, date: str, client: httpx.AsyncClient) -> list:
    """
    Fetch historical odds for a sport on a specific date.
    date format: YYYY-MM-DDTHH:MM:SSZ
    """
    if not ODDS_API_KEY or "REPLACE" in ODDS_API_KEY:
        logger.warning("THEODDSAPI_KEY not set — cannot import historical data")
        return []

    url = (
        f"{ODDS_BASE_URL}/sports/{sport}/odds-history"
        f"?apiKey={ODDS_API_KEY}"
        f"&regions=us,uk"
        f"&markets=h2h,spreads"
        f"&oddsFormat=american"
        f"&date={date}"
        f"&bookmakers={','.join(TRACKED_BOOKS)}"
    )

    try:
        resp = await client.get(url, timeout=15.0)
        resp.raise_for_status()

        remaining = resp.headers.get("x-requests-remaining", "?")
        logger.info(f"Historical [{sport}] [{date[:10]}] — remaining quota: {remaining}")

        data = resp.json()
        return data.get("data", []) if isinstance(data, dict) else data

    except Exception as e:
        logger.error(f"Historical fetch failed [{sport}] [{date}]: {e}")
        return []


async def import_sport_history(sport: str, days_back: int, db):
    """Import historical data for a sport over the last N days."""
    now          = datetime.now(timezone.utc)
    total_stored = 0
    skipped      = 0

    async with httpx.AsyncClient() as client:
        for day_offset in range(days_back, 0, -1):
            target_date = now - timedelta(days=day_offset)
            date_str    = target_date.strftime("%Y-%m-%dT12:00:00Z")

            games = await fetch_historical_odds(sport, date_str, client)

            for game in games:
                event_id  = game.get("id", "")
                home      = game.get("home_team", "")
                away      = game.get("away_team", "")
                commence  = game.get("commence_time", "")

                # Skip if already imported
                exists = db[COL_ODDS_SNAPSHOTS].find_one({
                    "event_id":   event_id,
                    "fetched_at": {"$gte": target_date - timedelta(hours=12)}
                })
                if exists:
                    skipped += 1
                    continue

                book_odds = extract_book_odds(game)

                snapshot = {
                    "event_id":       event_id,
                    "sport":          sport,
                    "sport_title":    game.get("sport_title", sport),
                    "home":           home,
                    "away":           away,
                    "commence_time":  commence,
                    "book_odds":      book_odds,
                    "raw_bookmakers": game.get("bookmakers", []),
                    "fetched_at":     target_date,
                    "is_historical":  True,
                }

                db[COL_ODDS_SNAPSHOTS].insert_one(snapshot)
                total_stored += 1

                # Compute and store arb opportunities from historical data
                arbs = detect_arbitrage(book_odds, event_id, sport, home, away, target_date)
                for arb in arbs:
                    # For historical data, mark as resolved immediately
                    arb["resolved_at"]     = target_date
                    arb["was_profitable"]  = True
                    arb["duration_minutes"] = None  # unknown from single snapshot
                    arb["is_historical"]   = True
                    db["arb_history"].insert_one(arb)

            # Paid plan — no throttle needed between sports
            await asyncio.sleep(0.1)

    logger.success(f"[{sport}] Imported {total_stored} snapshots, skipped {skipped} duplicates")
    return total_stored


async def import_all_sports(days_back: int):
    """Import historical data for all tracked sports."""
    db           = get_db()
    total        = 0
    started_at   = datetime.now()

    logger.info(f"Starting historical import — {days_back} days × {len(TRACKED_SPORTS)} sports")
    logger.info(f"Estimated API calls: ~{days_back * len(TRACKED_SPORTS)} requests")

    for sport in TRACKED_SPORTS:
        logger.info(f"Importing {sport}...")
        count = await import_sport_history(sport, days_back, db)
        total += count

    elapsed = (datetime.now() - started_at).total_seconds()
    logger.success(
        f"Historical import complete — "
        f"{total} total snapshots in {elapsed:.1f}s"
    )
    return total


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Import historical odds data")
    parser.add_argument("--days",  type=int, default=HISTORICAL_LOOKBACK_DAYS,
                        help=f"Days of history to import (default: {HISTORICAL_LOOKBACK_DAYS})")
    parser.add_argument("--sport", type=str, default=None,
                        help="Single sport to import (default: all sports)")
    args = parser.parse_args()

    if args.sport:
        db = get_db()
        asyncio.run(import_sport_history(args.sport, args.days, db))
    else:
        asyncio.run(import_all_sports(args.days))
