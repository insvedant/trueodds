"""
maintenance.py — keeps MongoDB comfortably below its storage limit, automatically.

WHY: the 512 MB Atlas cluster holds odds data AND your users, subscriptions and Stripe records.
If odds data fills it, logins and webhooks fail too. This job runs hourly and:

  1. measures how full the cluster is (data + indexes, every database),
  2. picks how long to keep recent data in Mongo: 24h normally, shorter as it fills,
  3. archives everything older to Parquet (each batch deleted from Mongo only AFTER it is
     verified on disk, see archive_snapshots.py), and
  4. if the cluster is still nearly full, PAUSES odds collection (a flag the collector checks),
     so there is always room left for users and payments. It resumes by itself once there is space.

    python -m ml.maintenance            # one run (put this in cron, hourly)
    python -m ml.maintenance --status   # just report how full things are, change nothing

Environment (all optional):
    MONGO_STORAGE_LIMIT_MB   default 512
    MONGO_RETENTION_HOURS    default 24   (how long recent data stays in Mongo when there is plenty of room)
    ALERT_WEBHOOK_URL        a Discord-style webhook; notified when collection pauses/resumes or things get critical
"""
import argparse
import os
import sys
from contextlib import contextmanager
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone

from loguru import logger
from pymongo import MongoClient

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from ml.config import MONGODB_URI, DB_NAME, COL_STATS

STORAGE_LIMIT_MB = float(os.environ.get("MONGO_STORAGE_LIMIT_MB", 512))
NORMAL_RETENTION_HOURS = float(os.environ.get("MONGO_RETENTION_HOURS", 24))
PAUSE_AT_PCT = 92.0          # stop collecting at or above this
RESUME_BELOW_PCT = 85.0      # start again only once usage is below this (so it doesn't flap on and off)
LOCK_PATH = os.environ.get("MAINTENANCE_LOCK", "/tmp/trueodds_maintenance.lock")
SYSTEM_DBS = {"admin", "local", "config"}


@dataclass
class Decision:
    level: str
    retention_hours: float
    pause: bool


def decide(pct, was_paused: bool) -> Decision:
    """
    How aggressively to trim, given how full the cluster is.
      <55%  ok         keep NORMAL (24h)
      <70%  elevated   keep at most 12h
      <82%  high       keep at most 6h
      <92%  critical   keep at most 2h
      else  emergency  keep 1h and pause collection
    Once paused, stay paused until usage drops below RESUME_BELOW_PCT.
    """
    if pct is None:           # couldn't measure: be conservative, change nothing about the pause state
        return Decision("unknown", min(NORMAL_RETENTION_HOURS, 12), was_paused)
    if pct < 55:
        level, hours = "ok", NORMAL_RETENTION_HOURS
    elif pct < 70:
        level, hours = "elevated", min(NORMAL_RETENTION_HOURS, 12)
    elif pct < 82:
        level, hours = "high", min(NORMAL_RETENTION_HOURS, 6)
    elif pct < PAUSE_AT_PCT:
        level, hours = "critical", min(NORMAL_RETENTION_HOURS, 2)
    else:
        level, hours = "emergency", 1
    pause = pct >= PAUSE_AT_PCT or (was_paused and pct >= RESUME_BELOW_PCT)
    return Decision(level, hours, pause)


def cluster_usage_mb(client) -> float:
    """Data + index size across every database on the cluster (what counts against the free-tier limit)."""
    total = 0.0
    for name in client.list_database_names():
        if name in SYSTEM_DBS:
            continue
        stats = client[name].command("dbStats")
        total += (stats.get("dataSize", 0) + stats.get("indexSize", 0)) / 1048576
    return total


def collection_sizes_mb(client, top: int = 8) -> list:
    """Largest collections (data + indexes). Best effort: some shared tiers restrict collStats."""
    rows = []
    for name in client.list_database_names():
        if name in SYSTEM_DBS:
            continue
        db = client[name]
        for coll in db.list_collection_names():
            try:
                st = db.command("collStats", coll)
                rows.append((f"{name}.{coll}", (st.get("size", 0) + st.get("totalIndexSize", 0)) / 1048576, st.get("count", 0)))
            except Exception:
                continue
    return sorted(rows, key=lambda r: -r[1])[:top]


@contextmanager
def single_instance(path: str = LOCK_PATH):
    """Only one maintenance run at a time (a slow archive must not be overlapped by the next hour's)."""
    try:
        import fcntl
    except ImportError:               # not on Linux: no locking available
        yield True
        return
    handle = open(path, "w")
    try:
        try:
            fcntl.flock(handle, fcntl.LOCK_EX | fcntl.LOCK_NB)
        except OSError:
            yield False
            return
        try:
            yield True
        finally:
            fcntl.flock(handle, fcntl.LOCK_UN)
    finally:
        handle.close()


def post_webhook(message: str) -> None:
    url = os.environ.get("ALERT_WEBHOOK_URL")
    if not url:
        return
    try:
        import httpx
        httpx.post(url, json={"content": message[:1900]}, timeout=10)
    except Exception as e:
        logger.warning(f"Alert webhook failed: {e}")


def _pct(mb):
    return None if mb is None else 100.0 * mb / STORAGE_LIMIT_MB


def run_once(client=None, *, measure=cluster_usage_mb, snapshots_fn=None, movements_fn=None, notify=post_webhook) -> dict:
    """
    One maintenance pass. The archivers and the measuring function are injectable so every branch can be tested.
    """
    if snapshots_fn is None or movements_fn is None:
        from ml.archive_snapshots import archive_snapshots, archive_line_movements
        snapshots_fn = snapshots_fn or archive_snapshots
        movements_fn = movements_fn or archive_line_movements
    client = client or MongoClient(MONGODB_URI, serverSelectionTimeoutMS=10_000)
    stats = client[DB_NAME][COL_STATS]

    guard = stats.find_one({"_id": "storage_guard"}) or {}
    was_paused, previous_level = bool(guard.get("paused")), guard.get("level")

    def safe_measure():
        try:
            return measure(client)
        except Exception as e:
            logger.warning(f"Could not measure MongoDB storage ({str(e).splitlines()[0][:150]}); using conservative retention")
            return None

    used_before = safe_measure()
    before = decide(_pct(used_before), was_paused)
    shown = "unknown" if used_before is None else f"{used_before:.0f} MB of {STORAGE_LIMIT_MB:.0f} MB ({_pct(used_before):.0f}%)"
    logger.info(f"MongoDB usage: {shown} → level '{before.level}', keeping {before.retention_hours:g}h of recent data")

    retention = timedelta(hours=before.retention_hours)
    archived = {}
    for name, fn in (("snapshots", snapshots_fn), ("line_movements", movements_fn)):
        try:
            archived[name] = fn(retention)
        except Exception as e:
            archived[name] = {"error": f"{type(e).__name__}: {e}"[:200]}
            logger.error(f"Archiving {name} failed: {e}")

    used_after = safe_measure() if used_before is not None else None
    after = decide(_pct(used_after), was_paused)
    pct_after = _pct(used_after)

    stats.update_one({"_id": "storage_guard"}, {"$set": {
        "paused": after.pause,
        "level": after.level,
        "pct": None if pct_after is None else round(pct_after, 1),
        "used_mb": None if used_after is None else round(used_after, 1),
        "reason": f"MongoDB at {pct_after:.0f}% of its {STORAGE_LIMIT_MB:.0f} MB limit" if pct_after is not None else "unknown",
        "retention_hours": before.retention_hours,
        "checked_at": datetime.now(timezone.utc),
    }}, upsert=True)

    if after.pause and not was_paused:
        msg = f"🛑 TrueOdds: MongoDB at {pct_after:.0f}% — odds collection PAUSED so users/payments keep working. Archive is running; it resumes below {RESUME_BELOW_PCT:.0f}%."
        logger.error(msg); notify(msg)
    elif was_paused and not after.pause:
        msg = f"✅ TrueOdds: MongoDB back to {pct_after:.0f}% — odds collection RESUMED."
        logger.info(msg); notify(msg)
    elif after.level in ("critical", "emergency") and previous_level not in ("critical", "emergency"):
        msg = f"⚠️ TrueOdds: MongoDB storage is {after.level} ({pct_after:.0f}% of {STORAGE_LIMIT_MB:.0f} MB)."
        logger.warning(msg); notify(msg)

    shown_after = "unknown" if used_after is None else f"{used_after:.0f} MB ({pct_after:.0f}%)"
    logger.info(f"Maintenance done: now {shown_after}, collection {'PAUSED' if after.pause else 'running'}")
    return {"used_before_mb": used_before, "used_after_mb": used_after, "level": after.level, "paused": after.pause,
            "retention_hours": before.retention_hours, "archived": archived}


def status(client=None) -> int:
    client = client or MongoClient(MONGODB_URI, serverSelectionTimeoutMS=10_000)
    try:
        used = cluster_usage_mb(client)
        pct = _pct(used)
        d = decide(pct, False)
        print(f"MongoDB usage: {used:.0f} MB of {STORAGE_LIMIT_MB:.0f} MB ({pct:.0f}%)  → level '{d.level}', would keep {d.retention_hours:g}h")
    except Exception as e:
        print(f"Could not measure usage: {str(e).splitlines()[0][:200]}")
    rows = collection_sizes_mb(client)
    if rows:
        print("\nLargest collections (data + indexes):")
        for name, mb, count in rows:
            print(f"  {name:45s} {mb:8.1f} MB   {count:>12,} docs")
    guard = client[DB_NAME][COL_STATS].find_one({"_id": "storage_guard"})
    print("\nStorage guard:", {k: v for k, v in (guard or {}).items() if k != "_id"} or "never run")
    return 0


def main(argv=None) -> int:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--status", action="store_true", help="report usage only; change nothing")
    args = parser.parse_args(argv)
    if args.status:
        return status()
    with single_instance() as acquired:
        if not acquired:
            logger.warning("Another maintenance run is still in progress — skipping this one")
            return 0
        run_once()
    return 0


if __name__ == "__main__":
    sys.exit(main())
