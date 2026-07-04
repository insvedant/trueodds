"""
archive_snapshots.py — Mongo → Parquet archival for odds_snapshots

Run daily (see cron setup). Moves any odds_snapshots document older than
LIVE_RETENTION_DAYS out of MongoDB and into a local Parquet file on the
Oracle VM's SSD, partitioned by date:

    {ARCHIVE_DIR}/odds_snapshots/year=YYYY/month=MM/day=DD/batch_NNNN.parquet

Each batch of BATCH_SIZE documents writes its own file within the day
directory — this avoids loading existing Parquet files into RAM to append
to them. parquet_loader.py's recursive glob ('**/*.parquet') and DuckDB's
union_by_name already treat all files under a directory as one logical
partition, so training compatibility is unaffected.

A document is only deleted from Mongo after its batch Parquet file has
been read back and row-count-verified using PyArrow metadata (not a full
pandas read) — a write that throws, or that silently truncates, will NOT
trigger deletion.

total_snapshots is an all-time counter owned by write-time $inc calls in
collect_data.py / import_historical.py. This script only adjusts
archived_snapshots and live_snapshots after each run, plus a one-time
migration seed for systems that predate those write-time counters.

    stats = {
        "_id": "global",
        "total_snapshots": <live + archived, all-time — owned elsewhere>,
        "archived_snapshots": <all-time count moved to parquet>,
        "live_snapshots": <current count still in Mongo>,
        "last_archive": <ISO timestamp of last successful run>,
    }
"""

import gc
import os
import sys
import itertools
from datetime import datetime, timedelta, timezone

import pyarrow as pa
import pyarrow.parquet as pq
from pymongo import MongoClient
from loguru import logger

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from ml.config import (
    MONGODB_URI, DB_NAME, COL_ODDS_SNAPSHOTS, COL_STATS,
    ARCHIVE_DIR, LIVE_RETENTION_DAYS,
    ARCHIVE_SUBDIR_ODDS_SNAPSHOTS, DAILY_ARCHIVE_COMPRESSION,
)

# Documents per processing batch.  Tune downward on very low-RAM VMs.
BATCH_SIZE = 500


def get_db():
    client = MongoClient(MONGODB_URI, serverSelectionTimeoutMS=10_000)
    return client[DB_NAME]


def partition_dir(date: datetime) -> str:
    """
    Directory that holds all batch files for a given UTC date:
        {ARCHIVE_DIR}/odds_snapshots/year=YYYY/month=MM/day=DD/
    """
    return os.path.join(
        ARCHIVE_DIR,
        ARCHIVE_SUBDIR_ODDS_SNAPSHOTS,
        f"year={date.year:04d}",
        f"month={date.month:02d}",
        f"day={date.day:02d}",
    )


def batch_path(date: datetime, batch_num: int) -> str:
    """
    Full path for one batch file within a day's directory:
        .../day=DD/batch_0000.parquet
    Multiple batches for the same date are separate files — no existing
    file is ever read or rewritten to append new rows.
    """
    return os.path.join(partition_dir(date), f"batch_{batch_num:04d}.parquet")


def _normalize_doc(d: dict) -> dict:
    """Convert Mongo-specific types to parquet-safe plain Python types."""
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
    return row


def _write_batch_parquet(rows: list, path: str) -> bool:
    """
    Write a batch of normalized row dicts directly via PyArrow — no
    pandas DataFrame, no existing-file read. Returns True on success.
    """
    try:
        table = pa.Table.from_pylist(rows)
        pq.write_table(table, path, compression=DAILY_ARCHIVE_COMPRESSION)
        return True
    except Exception as e:
        logger.error(f"Parquet write failed for {path}: {e}")
        return False


def _verify_batch_parquet(path: str, expected_rows: int) -> bool:
    """
    Verify row count via PyArrow file metadata — does NOT load any column
    data into memory, just reads the footer's row-group statistics.
    """
    if not os.path.exists(path):
        logger.error(f"Verify failed — file does not exist: {path}")
        return False
    try:
        actual = pq.ParquetFile(path).metadata.num_rows
    except Exception as e:
        logger.error(f"Verify failed — could not read metadata for {path}: {e}")
        return False
    if actual != expected_rows:
        logger.error(f"Verify failed — {path} has {actual} rows, expected {expected_rows}")
        return False
    return True


def update_stats(db, archived_delta: int):
    """
    Update archived_snapshots and live_snapshots after an archive run.
    Does NOT touch total_snapshots — that field is owned exclusively by
    write-time $inc calls in collect_data.py / import_historical.py.
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
        f"stats updated — archived={new_archived:,} live={live_count:,} "
        f"(total_snapshots={total_for_log}, owned by write-time counters)"
    )


def seed_total_snapshots_if_missing(db):
    """
    One-time migration seed for systems that predate the write-time $inc
    counters. Runs once: if total_snapshots is absent, seeds it from the
    current live count. After this, every inserted document increments it
    at write time via collect_data.py / import_historical.py.
    """
    existing = db[COL_STATS].find_one({"_id": "global"})
    if existing and "total_snapshots" in existing:
        return
    live_count = db[COL_ODDS_SNAPSHOTS].count_documents({})
    db[COL_STATS].update_one(
        {"_id": "global"},
        {"$set": {"total_snapshots": live_count}},
        upsert=True,
    )
    logger.warning(
        f"total_snapshots was missing — seeded from current live count ({live_count:,}). "
        f"This should only happen once, on first run after deploying the archival system."
    )


def _iter_batches(cursor, size: int):
    """Yield successive slices of `size` from a MongoDB cursor."""
    while True:
        batch = list(itertools.islice(cursor, size))
        if not batch:
            break
        yield batch


def archive_snapshots():
    db = get_db()
    seed_total_snapshots_if_missing(db)
    cutoff = datetime.now(timezone.utc) - timedelta(days=LIVE_RETENTION_DAYS)

    logger.info(
        f"Archiving odds_snapshots older than {cutoff.isoformat()} "
        f"in batches of {BATCH_SIZE}"
    )

    # count_documents is a cheap server-side aggregation — no documents
    # are transferred to Python just to get this number.
    eligible = db[COL_ODDS_SNAPSHOTS].count_documents({"fetched_at": {"$lt": cutoff}})
    if eligible == 0:
        logger.info("Nothing to archive — no documents older than the retention window.")
        update_stats(db, archived_delta=0)
        return {"archived": 0, "partitions": 0}

    logger.info(f"{eligible:,} documents eligible for archival")

    # batch_size() controls how many documents MongoDB sends to Python per
    # network round-trip — the cursor itself is lazy and holds no more than
    # batch_size documents in RAM at a time.
    cursor = db[COL_ODDS_SNAPSHOTS].find(
        {"fetched_at": {"$lt": cutoff}}
    ).batch_size(BATCH_SIZE)

    total_archived  = 0
    partition_dates: set = set()
    # Per-date counters so multiple batches for the same date get unique filenames
    batch_counters: dict = {}

    for batch_num, batch_docs in enumerate(_iter_batches(cursor, BATCH_SIZE)):
        logger.info(f"Batch {batch_num + 1}: {len(batch_docs)} docs")

        # Group this batch by calendar date
        by_date: dict = {}
        for doc in batch_docs:
            fetched_at = doc.get("fetched_at")
            if isinstance(fetched_at, str):
                fetched_at = datetime.fromisoformat(fetched_at.replace("Z", "+00:00"))
            if fetched_at is None:
                continue
            if hasattr(fetched_at, "tzinfo") and fetched_at.tzinfo is None:
                fetched_at = fetched_at.replace(tzinfo=timezone.utc)
            date_key = fetched_at.date()
            by_date.setdefault(date_key, []).append(doc)

        batch_verified_ids = []

        for date_key, docs in sorted(by_date.items()):
            dt = datetime(date_key.year, date_key.month, date_key.day)
            file_idx = batch_counters.get(date_key, 0)
            path = batch_path(dt, file_idx)
            batch_counters[date_key] = file_idx + 1
            os.makedirs(os.path.dirname(path), exist_ok=True)

            rows = [_normalize_doc(d) for d in docs]

            if not _write_batch_parquet(rows, path):
                logger.error(f"Skipping {date_key} batch {file_idx} — write failed")
                continue

            if not _verify_batch_parquet(path, len(rows)):
                logger.error(f"Skipping {date_key} batch {file_idx} — verify failed")
                try:
                    os.remove(path)
                except OSError:
                    pass
                continue

            # Only here — after verified write — do we queue these IDs for deletion
            batch_verified_ids.extend(d["_id"] for d in docs)
            total_archived += len(docs)
            partition_dates.add(date_key)
            logger.success(f"  {len(docs)} docs → {path} (verified)")

        # Delete only this batch's verified documents — not a global accumulation
        if batch_verified_ids:
            res = db[COL_ODDS_SNAPSHOTS].delete_many(
                {"_id": {"$in": batch_verified_ids}}
            )
            logger.info(f"  Deleted {res.deleted_count:,} from Mongo (batch {batch_num + 1})")

        # Release this batch's memory before fetching the next one
        del batch_docs, by_date, batch_verified_ids, rows
        gc.collect()

    update_stats(db, archived_delta=total_archived)
    logger.success(
        f"Archive complete — {total_archived:,} docs across "
        f"{len(partition_dates)} partition date(s)"
    )
    return {"archived": total_archived, "partitions": len(partition_dates)}


if __name__ == "__main__":
    result = archive_snapshots()
    logger.success(f"Archive run complete: {result}")
