"""
compact_parquet.py — merge a completed month's daily parquet files into one

Run monthly (see cron setup), on the 1st of the month, after the previous
month has fully closed out. Scans:

    {ARCHIVE_DIR}/year=YYYY/month=MM/day=*.parquet

and merges them into:

    {ARCHIVE_DIR}/monthly_YYYY_MM.parquet

Daily files are only deleted after the monthly file is read back and its
row count matches the sum of the daily files it replaced — same verify-
before-delete principle as archive_snapshots.py. If verification fails,
the daily files are left untouched and the monthly file (if partially
written) is removed so a retry starts clean.

By default this compacts the PREVIOUS calendar month relative to when
it's run (so on 2026-07-01 it compacts June 2026, which is now fully
closed and won't receive any more daily archive writes).
"""

import os
import sys
import glob
from datetime import datetime, timezone

import pandas as pd
from loguru import logger

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from ml.config import ARCHIVE_DIR, ARCHIVE_SUBDIR_ODDS_SNAPSHOTS, MONTHLY_COMPACT_COMPRESSION


def previous_month_ym() -> tuple[int, int]:
    now = datetime.now(timezone.utc)
    if now.month == 1:
        return now.year - 1, 12
    return now.year, now.month - 1


def daily_files_for(year: int, month: int) -> list[str]:
    pattern = os.path.join(
        ARCHIVE_DIR, ARCHIVE_SUBDIR_ODDS_SNAPSHOTS,
        f"year={year:04d}", f"month={month:02d}", "day=*.parquet",
    )
    return sorted(glob.glob(pattern))


def verify_monthly_write(monthly_path: str, expected_rows: int) -> bool:
    if not os.path.exists(monthly_path):
        logger.error(f"Verify failed — monthly file missing: {monthly_path}")
        return False
    try:
        df = pd.read_parquet(monthly_path, engine="pyarrow")
    except Exception as e:
        logger.error(f"Verify failed — could not read back {monthly_path}: {e}")
        return False
    if len(df) != expected_rows:
        logger.error(
            f"Verify failed — {monthly_path} has {len(df)} rows, expected exactly {expected_rows}"
        )
        return False
    return True


def compact_month(year: int, month: int, delete_dailies: bool = True) -> dict:
    daily_files = daily_files_for(year, month)
    if not daily_files:
        logger.info(f"No daily files found for {year:04d}-{month:02d} — nothing to compact")
        return {"compacted": False, "reason": "no_daily_files"}

    logger.info(f"Compacting {len(daily_files)} daily file(s) for {year:04d}-{month:02d}")

    frames = []
    expected_rows = 0
    for f in daily_files:
        try:
            df = pd.read_parquet(f, engine="pyarrow")
        except Exception as e:
            logger.error(f"Could not read {f}, aborting compaction for this month: {e}")
            return {"compacted": False, "reason": f"unreadable_daily_file:{f}"}
        frames.append(df)
        expected_rows += len(df)

    merged = pd.concat(frames, ignore_index=True)

    monthly_path = os.path.join(
        ARCHIVE_DIR, ARCHIVE_SUBDIR_ODDS_SNAPSHOTS, f"monthly_{year:04d}_{month:02d}.parquet",
    )
    tmp_path = monthly_path + ".tmp"

    try:
        merged.to_parquet(tmp_path, engine="pyarrow", compression=MONTHLY_COMPACT_COMPRESSION, index=False)
    except Exception as e:
        logger.error(f"Write failed for {tmp_path}: {e}")
        if os.path.exists(tmp_path):
            os.remove(tmp_path)
        return {"compacted": False, "reason": "write_failed"}

    # Atomic-ish swap: only replace the real monthly path once the temp
    # file is fully written, so a crash mid-write never leaves a corrupt
    # monthly_YYYY_MM.parquet sitting where readers expect a good one.
    os.replace(tmp_path, monthly_path)

    if not verify_monthly_write(monthly_path, expected_rows):
        logger.error(f"Verification failed for {monthly_path} — removing it, daily files kept intact")
        if os.path.exists(monthly_path):
            os.remove(monthly_path)
        return {"compacted": False, "reason": "verification_failed"}

    logger.success(f"Compacted {expected_rows:,} rows → {monthly_path} (verified)")

    if delete_dailies:
        for f in daily_files:
            os.remove(f)
        # Clean up now-empty day directories under this month, if any.
        month_dir = os.path.join(
            ARCHIVE_DIR, ARCHIVE_SUBDIR_ODDS_SNAPSHOTS, f"year={year:04d}", f"month={month:02d}",
        )
        try:
            if not os.listdir(month_dir):
                os.rmdir(month_dir)
        except OSError:
            pass
        logger.success(f"Removed {len(daily_files)} daily file(s) after verified compaction")

    return {"compacted": True, "rows": expected_rows, "path": monthly_path, "daily_files_removed": delete_dailies}


if __name__ == "__main__":
    year, month = previous_month_ym()
    result = compact_month(year, month)
    logger.success(f"Compaction run complete: {result}")
