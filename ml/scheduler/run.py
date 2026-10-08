"""
scheduler/run.py
────────────────────────────────────────────────────────────────────────────
APScheduler-based job runner for the ML pipeline.

Jobs:
  Every 60s  → collect_snapshot()          — store new odds to MongoDB
  Every 5min → generate_all_predictions()  — run ML predictions
  Daily 00:00 UTC → train_all_models()     — retrain models (in a separate process)
  On startup → import_historical()         — seed historical data (once)

Run: python -m ml.scheduler.run
"""



import asyncio

import signal

import sys

import os

from collections import deque

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



PROJECT_ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
TRAIN_TIMEOUT_SECONDS = 3 * 3600
# Late-start allowance for the nightly jobs. APScheduler's default is ONE second:
# a job that isn't started within a second of its scheduled time is silently
# dropped. This scheduler shares one event loop with the collector, which blocks
# it for minutes at a time, so with the default the 00:00 training run was being
# skipped ("Run time of job job_train_models ... was missed by 0:01:18").
NIGHTLY_MISFIRE_GRACE_SECONDS = 3 * 3600

_heavy_lock = None


def _get_heavy_lock():
    """Training and archival are both memory-heavy; never run them at the same time on this VM."""
    global _heavy_lock
    if _heavy_lock is None:
        _heavy_lock = asyncio.Lock()
    return _heavy_lock


async def run_logged_subprocess(cmd: list, cwd: str, timeout: float, tag: str = "[TRAIN]") -> dict:
    """
    Run `cmd` as a child process, stream its output into our log, and report how it
    ended: {"returncode", "timed_out", "tail"}. Never raises for a failing child.

    Training in a child process means:
      * it can't block the scheduler's event loop (it used to freeze collection
        and prediction for the length of the run), and
      * if the OS kills it for using too much memory, only the child dies - the
        collector keeps running instead of being restarted by pm2.
    """
    tail = deque(maxlen=40)
    env = {**os.environ, "PYTHONUNBUFFERED": "1"}
    proc = await asyncio.create_subprocess_exec(
        *cmd, cwd=cwd, env=env, limit=1024 * 1024,
        stdout=asyncio.subprocess.PIPE, stderr=asyncio.subprocess.STDOUT,
    )

    async def pump():
        async for raw in proc.stdout:
            line = raw.decode(errors="replace").rstrip()
            if line:
                tail.append(line)
                logger.info(f"{tag} {line[:300]}")

    timed_out = False
    try:
        await asyncio.wait_for(asyncio.gather(pump(), proc.wait()), timeout=timeout)
    except asyncio.TimeoutError:
        timed_out = True
        proc.kill()
        await proc.wait()
    return {"returncode": proc.returncode, "timed_out": timed_out, "tail": list(tail)}


async def job_train_models():
    """Retrain all ML models on the latest data, in a separate process."""
    async with _get_heavy_lock():
        logger.info("[TRAIN] Starting nightly training (separate process)")
        try:
            outcome = await run_logged_subprocess(
                [sys.executable, "-m", "ml.models.train"], cwd=PROJECT_ROOT, timeout=TRAIN_TIMEOUT_SECONDS)
        except Exception as e:
            logger.error(f"[TRAIN] Could not start training: {e}")
            return
        rc = outcome["returncode"]
        if outcome["timed_out"]:
            logger.error(f"[TRAIN] Stopped after {TRAIN_TIMEOUT_SECONDS // 3600}h without finishing")
        elif rc == 0:
            logger.info("[TRAIN] Finished. Per-model results are in the log above and on the admin ML Models page.")
        elif rc == -9:
            logger.error("[TRAIN] Killed by the operating system (exit -9) - almost certainly out of memory. "
                         "The collector was not affected. See the last lines above for how far it got.")
        else:
            logger.error(f"[TRAIN] Exited with code {rc}. Last output:\n" + "\n".join(outcome["tail"][-15:]))


async def job_archive_snapshots():

    """Move old odds_snapshots out of MongoDB into local Parquet files.

    Was never wired into the scheduler before — Mongo storage grows

    unbounded without this actually running on a schedule."""

    try:

        from ml.archive_snapshots import archive_snapshots as run_archival

        # Queue behind training, and run on a worker thread so a multi-minute
        # archive can't freeze the scheduler's event loop.
        async with _get_heavy_lock():
            result = await asyncio.to_thread(run_archival)

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

        misfire_grace_time=NIGHTLY_MISFIRE_GRACE_SECONDS,

        # No next_run_time=now: that launched a full training run on EVERY restart
        # of the collector. Training now happens at 00:00 UTC; on demand, run
        #     python -m ml.models.train

    )

    scheduler.add_job(

        job_archive_snapshots,

        trigger=CronTrigger(hour=0, minute=30),

        id="archive_snapshots",

        max_instances=1,

        coalesce=True,

        misfire_grace_time=NIGHTLY_MISFIRE_GRACE_SECONDS,

    )



    scheduler.start()



    logger.info("Scheduler running:")

    logger.info(f"  📊 Odds collection:   every {COLLECTION_INTERVAL_SECONDS}s")

    logger.info(f"  🤖 Predictions:       every 5 min")

    logger.info("  🧠 Model retraining:  daily at 00:00 UTC (separate process)")



    

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

