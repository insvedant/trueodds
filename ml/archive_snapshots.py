"""
archive_snapshots.py — Mongo → Parquet archival for odds_snapshots

Run daily (see cron setup). Moves any odds_snapshots document older than
LIVE_RETENTION_DAYS out of MongoDB and into a local Parquet file on the
Oracle VM's SSD, partitioned by date:

    {ARCHIVE_DIR}/year=YYYY/month=MM/day=DD.parquet

A document is only deleted from Mongo after the Parquet write for its
date partition has been read back and row-count-verified — a write that
throws, or that silently truncates, will NOT trigger deletion. This is
deliberately strict: losing historical training data is treated as worse
than Mongo staying a bit fuller for one more day.

Maintains a `stats` collection so the frontend's "X snapshots collected"
counter survives archival deletion (see ml/api/server.py /health and
backend/src/routes/ml.js /health + /dashboard, both patched to read this).

total_snapshots is an all-time counter owned by write-time $inc calls in
collect_data.py / import_historical.py at the moment each document is
inserted — NOT reconstructed here. This script only adjusts
archived_snapshots and live_snapshots after each run, plus a one-time
migration seed (seed_total_snapshots_if_missing) for systems that already
had data before these write-time counters existed.

    stats = {
        "_id": "global",
        "total_snapshots": <live + archived, all-time — owned elsewhere>,
        "archived_snapshots": <all-time count moved to parquet>,
        "live_snapshots": <current count still in Mongo>,
        "last_archive": <ISO timestamp of last successful run>,
    }
"""

import os
import sys
from datetime import datetime, timedelta, timezone
from collections import defaultdict

import pandas as pd
from pymongo import MongoClient
from loguru import logger

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from ml.config import (
    MONGODB_URI, DB_NAME, COL_ODDS_SNAPSHOTS, COL_STATS,
    ARCHIVE_DIR, LIVE_RETENTION_DAYS,
    ARCHIVE_SUBDIR_ODDS_SNAPSHOTS, DAILY_ARCHIVE_COMPRESSION,
)


def get_db():
    client = MongoClient(MONGODB_URI, serverSelectionTimeoutMS=10_000)
    return client[DB_NAME]


def partition_path(date: datetime) -> str:
    """
    Return the parquet file path for a given UTC date, under a
    per-collection subfolder:
        {ARCHIVE_DIR}/odds_snapshots/year=YYYY/month=MM/day=DD.parquet
    The subfolder exists so a future second archived collection (e.g. if
    line_movements or arb_history ever needs archiving too) never
    collides with these files.
    """
    return os.path.join(
        ARCHIVE_DIR,
        ARCHIVE_SUBDIR_ODDS_SNAPSHOTS,
        f"year={date.year:04d}",
        f"month={date.month:02d}",
        f"day={date.day:02d}.parquet",
    )


def verify_parquet_write(path: str, expected_rows: int) -> bool:
    """
    Read the parquet file back and confirm row count matches what we
    intended to write. This is the gate that decides whether it's safe
    to delete the corresponding Mongo documents.
    """
    if not os.path.exists(path):
        logger.error(f"Verify failed — file does not exist: {path}")
        return False
    try:
        written = pd.read_parquet(path, engine="pyarrow")
    except Exception as e:
        logger.error(f"Verify failed — could not read back {path}: {e}")
        return False
    if len(written) < expected_rows:
        logger.error(
            f"Verify failed — {path} has {len(written)} rows, expected at least {expected_rows}"
        )
        return False
    return True


def update_stats(db, archived_delta: int):
    """
    Update archived_snapshots and live_snapshots after an archive run.

    Deliberately does NOT touch total_snapshots here. That field is an
    all-time counter owned exclusively by the write-time $inc calls in
    collect_data.py and import_historical.py, at the actual moment each
    document is inserted — this function has no visibility into how many
    new live documents were collected since the last archive run, so any
    attempt to reconstruct total_snapshots from (live_count + archived
    delta) here would silently under-count it between archive runs. This
    was a real bug in an earlier version of this function, caught by
    testing a realistic multi-run scenario rather than by code review
    alone — see the corresponding patch notes if this comment is ever
    removed and someone is tempted to "simplify" this back.
    """
    now_iso = datetime.now(timezone.utc).isoformat()
    live_count = db[COL_ODDS_SNAPSHOTS].count_documents({})

    existing = db[COL_STATS].find_one({"_id": "global"})
    new_archived = (existing.get("archived_snapshots", 0) if existing else 0) + archived_delta

    db[COL_STATS].update_one(
        {"_id": "global"},
        {"$set": {
            "archived_snapshots": new_archived,
            "live_snapshots":     live_count,
            "last_archive":       now_iso,
        }},
        upsert=True,
    )
    total_for_log = existing.get("total_snapshots", "unknown") if existing else "unknown"
    logger.info(
        f"stats updated — archived={new_archived:,} live={live_count:,} (total_snapshots={total_for_log}, owned by write-time counters)"
    )


def seed_total_snapshots_if_missing(db):
    """
    One-time migration safety net. On a system that already had documents
    in odds_snapshots BEFORE the write-time $inc counters were added to
    collect_data.py / import_historical.py, total_snapshots would never
    get seeded — those older documents were written without incrementing
    it. Without this, /health would silently fall back to the live-only
    count forever, even after archival starts running for real.

    Runs once: if total_snapshots is missing entirely, seed it from the
    current live count (correct, since at the moment this first runs on
    such a system, nothing has been archived yet either — live_count IS
    the true total at that instant). After this point, every future
    document increments it correctly at write time, so this only ever
    needs to fire once per deployment, ever.
    """
    existing = db[COL_STATS].find_one({"_id": "global"})
    if existing and "total_snapshots" in existing:
        return  # already seeded — normal path, nothing to do
    live_count = db[COL_ODDS_SNAPSHOTS].count_documents({})
    db[COL_STATS].update_one(
        {"_id": "global"},
        {"$set": {"total_snapshots": live_count}},
        upsert=True,
    )
    logger.warning(
        f"total_snapshots was missing — seeded one-time from current live count ({live_count:,}). "
        f"This should only happen once, on the first run after deploying the archival system."
    )


def archive_snapshots():
    db = get_db()
    seed_total_snapshots_if_missing(db)
    cutoff = datetime.now(timezone.utc) - timedelta(days=LIVE_RETENTION_DAYS)

    logger.info(f"Archiving odds_snapshots older than {cutoff.isoformat()}")

    old_docs = list(db[COL_ODDS_SNAPSHOTS].find({"fetched_at": {"$lt": cutoff}}))
    if not old_docs:
        logger.info("Nothing to archive — no documents older than the retention window.")
        update_stats(db, archived_delta=0)
        return {"archived": 0, "partitions": 0}

    logger.info(f"Found {len(old_docs):,} documents eligible for archival")

    # Group by UTC calendar date of fetched_at — each date becomes one
    # parquet partition file.
    by_date = defaultdict(list)
    for doc in old_docs:
        fetched_at = doc.get("fetched_at")
        if isinstance(fetched_at, str):
            fetched_at = datetime.fromisoformat(fetched_at.replace("Z", "+00:00"))
        if fetched_at.tzinfo is None:
            fetched_at = fetched_at.replace(tzinfo=timezone.utc)
        date_key = fetched_at.date()
        by_date[date_key].append(doc)

    total_archived = 0
    ids_to_delete  = []

    for date_key, docs in sorted(by_date.items()):
        path = partition_path(datetime(date_key.year, date_key.month, date_key.day))
        os.makedirs(os.path.dirname(path), exist_ok=True)

        # Mongo ObjectId / datetime objects aren't directly parquet-friendly —
        # normalize to plain strings before handing to pandas/pyarrow.
        rows = []
        for d in docs:
            row = dict(d)
            row["_id"] = str(row["_id"])
            fa = row.get("fetched_at")
            row["fetched_at"] = fa.isoformat() if hasattr(fa, "isoformat") else str(fa)
            ct = row.get("commence_time")
            if hasattr(ct, "isoformat"):
                row["commence_time"] = ct.isoformat()
            dup_of = row.get("duplicate_of")
            if dup_of is not None:
                row["duplicate_of"] = str(dup_of)
            rows.append(row)

        new_df = pd.DataFrame(rows)

        # If a partition file already exists for this date (e.g. a previous
        # partial run, or same-day re-archival), append rather than
        # overwrite, so we never lose previously-archived rows for that day.
        if os.path.exists(path):
            try:
                existing_df = pd.read_parquet(path, engine="pyarrow")
                combined_df = pd.concat([existing_df, new_df], ignore_index=True)
            except Exception as e:
                logger.error(f"Could not read existing partition {path}, aborting this date: {e}")
                continue
        else:
            combined_df = new_df

        try:
            combined_df.to_parquet(path, engine="pyarrow", compression=DAILY_ARCHIVE_COMPRESSION, index=False)
        except Exception as e:
            logger.error(f"Write failed for {path}: {e}")
            continue

        expected_total_rows_for_file = len(combined_df)
        if not verify_parquet_write(path, expected_total_rows_for_file):
            logger.error(f"Skipping deletion for {date_key} — write could not be verified")
            continue

        # Only NOW do we mark these specific Mongo _ids as safe to delete.
        ids_to_delete.extend(d["_id"] for d in docs)
        total_archived += len(docs)
        logger.success(f"Archived {len(docs):,} docs → {path} (verified)")

    if ids_to_delete:
        result = db[COL_ODDS_SNAPSHOTS].delete_many({"_id": {"$in": ids_to_delete}})
        logger.success(f"Deleted {result.deleted_count:,} verified-archived documents from Mongo")

    update_stats(db, archived_delta=total_archived)

    return {"archived": total_archived, "partitions": len(by_date)}


if __name__ == "__main__":
    result = archive_snapshots()
    logger.success(f"Archive run complete: {result}")
