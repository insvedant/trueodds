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
from pathlib import Path

import pyarrow as pa
import pyarrow.parquet as pq
from pymongo import MongoClient
from loguru import logger

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from ml.config import (
    MONGODB_URI, DB_NAME, COL_ODDS_SNAPSHOTS, COL_LINE_MOVEMENTS, COL_STATS,
    ARCHIVE_DIR, LIVE_RETENTION_DAYS,
    ARCHIVE_SUBDIR_ODDS_SNAPSHOTS, DAILY_ARCHIVE_COMPRESSION,
)
try:
    from ml.config import ARCHIVE_SUBDIR_LINE_MOVEMENTS
except ImportError:                      # an older config.py without the constant
    ARCHIVE_SUBDIR_LINE_MOVEMENTS = "line_movements"

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


def line_movement_partition_dir(date: datetime) -> str:
    """{ARCHIVE_DIR}/line_movements/year=YYYY/month=MM/day=DD/"""
    return os.path.join(
        ARCHIVE_DIR, ARCHIVE_SUBDIR_LINE_MOVEMENTS,
        f"year={date.year:04d}", f"month={date.month:02d}", f"day={date.day:02d}",
    )


def line_movement_batch_path(date: datetime, batch_num: int) -> str:
    """.../line_movements/year=YYYY/month=MM/day=DD/batch_NNNN.parquet"""
    return os.path.join(line_movement_partition_dir(date), f"batch_{batch_num:04d}.parquet")


def _next_batch_index(partition_path: str, counters: dict, date_key) -> int:
    """
    Next unused batch number for a date. The first time a date is seen in a run, look at what is
    already on disk and continue after it. Before this, every run restarted at batch_0000 and would
    OVERWRITE files an earlier run had written for the same day (found and fixed on the server;
    kept here, and shared by the snapshot and line-movement archives).
    """
    if date_key not in counters:
        indices = []
        for existing in Path(partition_path).glob("batch_*.parquet"):
            try:
                indices.append(int(existing.stem.split("_")[1]))
            except (IndexError, ValueError):
                continue
        counters[date_key] = max(indices, default=-1) + 1
    else:
        counters[date_key] += 1
    return counters[date_key]


def batch_path(date: datetime, batch_num: int) -> str:
    """
    Full path for one batch file within a day's directory:
        .../day=DD/batch_0000.parquet
    Multiple batches for the same date are separate files — no existing
    file is ever read or rewritten to append new rows.
    """
    return os.path.join(partition_dir(date), f"batch_{batch_num:04d}.parquet")


def _normalize_line_movement(d: dict) -> dict:
    """
    A MongoDB line_movements document as a Parquet-safe row. Numeric fields stay native numbers so
    archived movements remain directly usable by DuckDB/pandas for training.
    """
    row = dict(d)
    if "_id" in row:
        row["_id"] = str(row["_id"])
    ts = row.get("timestamp")
    if hasattr(ts, "isoformat"):
        row["timestamp"] = ts.isoformat()
    elif ts is not None:
        row["timestamp"] = str(ts)
    return row


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
        # DATA-LOSS FIX. pa.Table.from_pylist() takes its top-level columns from the
        # FIRST row only. "Unchanged" marker documents have no book_odds, so any batch
        # that happened to START with a marker was written with no book_odds column at
        # all: every real snapshot in it lost its odds, the row count still matched,
        # verification passed, and the originals were then deleted from MongoDB.
        # Build the column list from ALL rows instead.
        names = []
        seen = set()
        for r in rows:
            for k in r:
                if k not in seen:
                    seen.add(k)
                    names.append(k)
        table = pa.Table.from_pydict({n: [r.get(n) for r in rows] for n in names})
        pq.write_table(table, path, compression=DAILY_ARCHIVE_COMPRESSION)
        return True
    except Exception as e:
        logger.error(f"Parquet write failed for {path}: {e}")
        return False


def _verify_batch_parquet(path: str, expected_rows: int, expected_odds_rows: int = 0) -> bool:
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
    if expected_odds_rows:
        # A matching row COUNT proved nothing about content: the old writer could drop
        # the whole book_odds column and still pass. Check the odds actually survived.
        try:
            names = pq.ParquetFile(path).schema_arrow.names
            if "book_odds" not in names:
                stored = 0
            else:
                col = pq.read_table(path, columns=["book_odds"]).column("book_odds")
                stored = len(col) - col.null_count
        except Exception as e:
            logger.error(f"Verify failed — could not inspect book_odds in {path}: {e}")
            return False
        if stored != expected_odds_rows:
            logger.error(f"Verify failed — {path} stored odds for {stored} snapshots, expected {expected_odds_rows}")
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


def archive_line_movements() -> dict:
    """
    Archive line_movements older than LIVE_RETENTION_DAYS to Parquet, then delete them from Mongo.
    Same safety rule as snapshots: a batch is deleted from Mongo only after its file is written and
    verified. (Their schema differs from odds_snapshots, hence the separate directory.)
    """
    db = get_db()
    cutoff = datetime.now(timezone.utc) - timedelta(days=LIVE_RETENTION_DAYS)
    collection = db[COL_LINE_MOVEMENTS]
    logger.info(f"Archiving line_movements older than {cutoff.isoformat()} in batches of {BATCH_SIZE}")

    eligible = collection.count_documents({"timestamp": {"$lt": cutoff}})
    if eligible == 0:
        logger.info("Nothing to archive — no line_movements older than the retention window.")
        return {"archived": 0, "partitions": 0}
    logger.info(f"{eligible:,} line_movements eligible for archival")

    cursor = collection.find({"timestamp": {"$lt": cutoff}}).sort([("timestamp", 1)]).batch_size(BATCH_SIZE)
    total_archived = 0
    partition_dates: set = set()
    batch_counters: dict = {}

    for batch_num, batch_docs in enumerate(_iter_batches(cursor, BATCH_SIZE)):
        by_date: dict = {}
        for doc in batch_docs:
            timestamp = doc.get("timestamp")
            if isinstance(timestamp, str):
                timestamp = datetime.fromisoformat(timestamp.replace("Z", "+00:00"))
            if timestamp is None:
                continue
            if hasattr(timestamp, "tzinfo") and timestamp.tzinfo is None:
                timestamp = timestamp.replace(tzinfo=timezone.utc)
            by_date.setdefault(timestamp.date(), []).append(doc)

        verified_ids = []
        for date_key, docs in sorted(by_date.items()):
            dt = datetime(date_key.year, date_key.month, date_key.day)
            file_idx = _next_batch_index(line_movement_partition_dir(dt), batch_counters, date_key)
            path = line_movement_batch_path(dt, file_idx)
            os.makedirs(os.path.dirname(path), exist_ok=True)
            rows = [_normalize_line_movement(d) for d in docs]
            if not _write_batch_parquet(rows, path):
                logger.error(f"Skipping line_movements {date_key} batch {file_idx} — write failed")
                continue
            if not _verify_batch_parquet(path, len(rows)):
                logger.error(f"Skipping line_movements {date_key} batch {file_idx} — verify failed")
                try:
                    os.remove(path)
                except OSError:
                    pass
                continue
            verified_ids.extend(d["_id"] for d in docs)
            total_archived += len(docs)
            partition_dates.add(date_key)
            logger.success(f"  {len(docs)} line movements → {path} (verified)")

        if verified_ids:
            res = collection.delete_many({"_id": {"$in": verified_ids}})
            logger.info(f"  Deleted {res.deleted_count:,} line_movements from Mongo (batch {batch_num + 1})")
        del batch_docs, by_date, verified_ids
        gc.collect()

    logger.success(f"Line movement archive complete — {total_archived:,} docs across {len(partition_dates)} partition date(s)")
    return {"archived": total_archived, "partitions": len(partition_dates)}


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
            file_idx = _next_batch_index(partition_dir(dt), batch_counters, date_key)
            path = batch_path(dt, file_idx)
            os.makedirs(os.path.dirname(path), exist_ok=True)

            rows = [_normalize_doc(d) for d in docs]

            if not _write_batch_parquet(rows, path):
                logger.error(f"Skipping {date_key} batch {file_idx} — write failed")
                continue

            if not _verify_batch_parquet(path, len(rows), expected_odds_rows=sum(1 for r in rows if r.get("book_odds"))):
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
    snapshot_result = archive_snapshots()
    logger.success(f"Odds snapshot archive run complete: {snapshot_result}")

    line_movement_result = archive_line_movements()
    logger.success(f"Line movement archive run complete: {line_movement_result}")
