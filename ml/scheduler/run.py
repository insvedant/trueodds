"""
scheduler/run.py
────────────────────────────────────────────────────────────────────────────
APScheduler-based job runner for the ML pipeline.

Jobs:
  Every 60s  → collect_snapshot()          — store new odds to MongoDB
  Every 5min → generate_all_predictions()  — run ML predictions
  Every 24h  → train_all_models()          — retrain models on new data
  On startup → import_historical()         — seed historical data (once)

Run: python -m ml.scheduler.run
"""



import asyncio

import signal

import sys

import os

from datetime import datetime, timezone

from loguru import logger

from apscheduler.schedulers.asyncio import AsyncIOScheduler

from apscheduler.triggers.interval import IntervalTrigger

from apscheduler.triggers.cron import CronTrigger

from pymongo import MongoClient



sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(__file__))))

from ml.config import (

    MONGODB_URI, DB_NAME,

    COLLECTION_INTERVAL_SECONDS,

    RETRAIN_INTERVAL_H,

    HISTORICAL_LOOKBACK_DAYS,

    ODDS_API_KEY,

)



def get_db():

    client = MongoClient(MONGODB_URI)

    return client[DB_NAME]



async def job_collect_data():

    """Collect current odds snapshot."""

    try:

        from ml.collect_data import collect_snapshot

        result = await collect_snapshot()

        logger.info(f"[COLLECT] {result}")

    except Exception as e:

        logger.error(f"[COLLECT] Failed: {e}")



async def job_generate_predictions():

    """Generate ML predictions for all active events."""

    try:

        from ml.models.predict import generate_all_predictions

        count = generate_all_predictions()

        logger.info(f"[PREDICT] Generated {count} predictions")

    except Exception as e:

        logger.error(f"[PREDICT] Failed: {e}")



async def job_train_models():

    """Retrain all ML models on latest data."""

    try:

        from ml.models.train import train_all_models

        results = train_all_models()

        success = sum(1 for r in results.values() if r.get("success"))

        logger.info(f"[TRAIN] {success}/{len(results)} models trained")

    except Exception as e:

        logger.error(f"[TRAIN] Failed: {e}")


async def job_archive_snapshots():

    """Move old odds_snapshots out of MongoDB into local Parquet files.

    Was never wired into the scheduler before — Mongo storage grows

    unbounded without this actually running on a schedule."""

    try:

        from ml.archive_snapshots import archive_snapshots as run_archival

        result = run_archival()

        logger.info(f"[ARCHIVE] {result}")

    except Exception as e:

        logger.error(f"[ARCHIVE] Failed: {e}")



async def job_import_historical_once():

    """
    Import historical data on first run only.
    Checks if we've already imported — won't run again.
    """

    db  = get_db()

    key = "historical_import_completed"



    already_done = db["ml_meta"].find_one({"key": key})

    if already_done:

        logger.info("[HISTORY] Already imported — skipping")

        return



    if not ODDS_API_KEY or "REPLACE" in ODDS_API_KEY:

        logger.warning("[HISTORY] No API key — skipping historical import")

        return



    logger.info(f"[HISTORY] Starting historical import ({HISTORICAL_LOOKBACK_DAYS} days)...")

    try:

        from ml.import_historical import import_all_sports

        count = await import_all_sports(HISTORICAL_LOOKBACK_DAYS)

        db["ml_meta"].insert_one({

            "key":         key,

            "completed_at": datetime.now(timezone.utc),

            "snapshots":   count,

        })

        logger.success(f"[HISTORY] Import complete — {count} snapshots stored")

    except Exception as e:

        logger.error(f"[HISTORY] Import failed: {e}")



async def main():

    logger.info("=" * 60)

    logger.info("TrueOdds ML Scheduler starting")

    logger.info("=" * 60)



    if not ODDS_API_KEY or "REPLACE" in ODDS_API_KEY:

        logger.warning("⚠ THEODDSAPI_KEY not set — collection will store 0 records")

        logger.warning("  Add key to .env then restart")



    scheduler = AsyncIOScheduler()



    

    scheduler.add_job(

        job_import_historical_once,

        trigger=IntervalTrigger(hours=6),  

        id="import_historical",

        max_instances=1,

        coalesce=True,

        next_run_time=datetime.now(timezone.utc),

    )



    

    scheduler.add_job(

        job_collect_data,

        trigger=IntervalTrigger(seconds=COLLECTION_INTERVAL_SECONDS),

        id="collect_data",

        max_instances=1,

        coalesce=True,

    )



    

    scheduler.add_job(

        job_generate_predictions,

        trigger=IntervalTrigger(minutes=5),

        id="generate_predictions",

        max_instances=1,

        coalesce=True,

    )



    

    scheduler.add_job(

        job_train_models,

        trigger=CronTrigger(hour=0, minute=0),

        id="train_models",

        max_instances=1,

        coalesce=True,

        next_run_time=datetime.now(timezone.utc),

    )

    scheduler.add_job(

        job_archive_snapshots,

        trigger=CronTrigger(hour=0, minute=30),

        id="archive_snapshots",

        max_instances=1,

        coalesce=True,

    )



    scheduler.start()



    logger.info("Scheduler running:")

    logger.info(f"  📊 Odds collection:   every {COLLECTION_INTERVAL_SECONDS}s")

    logger.info(f"  🤖 Predictions:       every 5 min")

    logger.info(f"  🧠 Model retraining:  every {RETRAIN_INTERVAL_H}h")



    

    stop_event = asyncio.Event()



    def handle_signal(*args):

        logger.info("Shutdown signal received")

        stop_event.set()



    signal.signal(signal.SIGTERM, handle_signal)

    signal.signal(signal.SIGINT,  handle_signal)



    await stop_event.wait()

    scheduler.shutdown()

    logger.info("ML Scheduler stopped")



if __name__ == "__main__":

    asyncio.run(main())

