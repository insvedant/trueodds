"""
parquet_loader.py — load historical odds_snapshots from BOTH parquet sources

Used by models/train.py to merge archived (Parquet) data with recent
(Mongo) data before training. Two on-disk sources are merged here:

    1. LEGACY_ARCHIVE_DIR — /home/ubuntu/parquet_backup (pre-existing,
       written before this archival system existed)
    2. ARCHIVE_DIR        — /home/ubuntu/data_archive (written going
       forward by archive_snapshots.py / compact_parquet.py)

IMPORTANT — schema honesty: the legacy backup's exact column shape and
partitioning scheme is NOT verified against the new archive's shape. This
loader does not assume they match. It merges both via DuckDB's
union_by_name (or a column-union fallback in the pure-pandas path), which
tolerates missing/extra columns per file rather than crashing on a
mismatch. Dedup is attempted on (event_id, fetched_at) ONLY if both
columns are actually present in the merged result — if the legacy backup
doesn't have those exact column names, dedup is skipped for that data
with a clear warning logged, rather than silently guessing at a different
key and possibly dropping real rows.

Prefers DuckDB for the actual file scan since it can query partitioned
directories directly without loading every file into pandas memory up
front — important on a small Oracle Free Tier VM where RAM is limited.
Falls back to plain pandas + glob if duckdb isn't installed, so a missing
optional dependency degrades gracefully instead of breaking training.
"""

import os
import sys
import glob

import pandas as pd
from loguru import logger

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from ml.config import ARCHIVE_DIR, LEGACY_ARCHIVE_DIR

try:
    import duckdb
    _HAS_DUCKDB = True
except ImportError:
    _HAS_DUCKDB = False


def _glob_patterns() -> list[str]:
    """
    Patterns for both source directories. Matches daily partitions
    (year=*/month=*/day=*.parquet), monthly-compacted files
    (monthly_YYYY_MM.parquet), and anything else under the legacy
    directory regardless of its internal layout, since we don't know its
    exact structure — a flat glob for *.parquet anywhere under it is the
    safest assumption.
    """
    patterns = []
    if os.path.isdir(ARCHIVE_DIR):
        patterns.append(os.path.join(ARCHIVE_DIR, "**", "*.parquet"))
    if os.path.isdir(LEGACY_ARCHIVE_DIR):
        patterns.append(os.path.join(LEGACY_ARCHIVE_DIR, "**", "*.parquet"))
    return patterns


def _all_files() -> list[str]:
    files = []
    for pattern in _glob_patterns():
        files.extend(glob.glob(pattern, recursive=True))
    return files


def load_historical_parquet(
    cutoff_after: "pd.Timestamp | None" = None,
    cutoff_before: "pd.Timestamp | None" = None,
    columns: list | None = None,
    dedup: bool = True,
) -> pd.DataFrame:
    """
    Load all archived odds_snapshots rows from BOTH the legacy backup
    directory and the new archive directory, optionally filtered by a
    fetched_at range, with optional dedup across the two sources.

    Args:
        cutoff_after:  only rows with fetched_at >= this (inclusive)
        cutoff_before: only rows with fetched_at <  this (exclusive)
        columns:       optional column subset to read (reduces memory)
        dedup:         if True (default), drop duplicate rows across the
                       two sources when both event_id and fetched_at
                       columns are present in the merged result. Has no
                       effect (and logs a warning once) if those columns
                       aren't both present — see module docstring on why
                       this is a deliberate "don't guess" choice rather
                       than falling back to a different dedup key.

    Returns an empty DataFrame (not None) if neither directory exists yet
    or contains no matching rows, so callers can always safely
    pd.concat() the result without a None-check.
    """
    files = _all_files()
    if not files:
        logger.info(
            f"No parquet files found under {ARCHIVE_DIR} or {LEGACY_ARCHIVE_DIR} — returning empty frame"
        )
        return pd.DataFrame()

    if _HAS_DUCKDB:
        df = _load_with_duckdb(cutoff_after, cutoff_before, columns)
    else:
        df = _load_with_pandas(files, cutoff_after, cutoff_before, columns)

    if dedup and not df.empty:
        df = _dedup_if_possible(df)

    return df


def _dedup_if_possible(df: pd.DataFrame) -> pd.DataFrame:
    """
    Drop duplicate rows across the legacy backup + new archive, keyed on
    (event_id, fetched_at) — the two fields every real (non-marker)
    odds_snapshots document has always had, in both this system's own
    archive output and, presumably, the legacy backup, since both are
    ultimately derived from the same odds_snapshots collection schema.

    Deliberately does NOT fall back to a different/guessed key if these
    columns are missing — that risk (silently dropping real rows on a
    wrong assumption about the legacy schema) is worse than occasionally
    shipping a few duplicate rows into training, which has no correctness
    impact, only a negligible volume one.
    """
    if "event_id" not in df.columns or "fetched_at" not in df.columns:
        logger.warning(
            "Skipping cross-source dedup — event_id and/or fetched_at column "
            "not present in the merged legacy+new archive data. This can "
            "happen if the legacy backup's schema differs from the new "
            "archive's. Proceeding WITHOUT dedup rather than guessing a "
            "different key that could incorrectly drop real rows."
        )
        return df

    before = len(df)
    df = df.drop_duplicates(subset=["event_id", "fetched_at"], keep="first")
    removed = before - len(df)
    if removed > 0:
        logger.info(f"Dedup removed {removed:,} duplicate rows across legacy backup + new archive")
    return df


def _load_with_duckdb(cutoff_after, cutoff_before, columns) -> pd.DataFrame:
    """
    DuckDB can scan all parquet files across BOTH directories as a single
    virtual table via a list of glob patterns, push the date filter down
    before materializing anything in Python, and only then hand back a
    pandas DataFrame. union_by_name=true means files with different
    column sets (e.g. the legacy backup having a different shape than the
    new archive) are merged by column NAME rather than position, with
    missing columns filled as NULL rather than erroring — this is the key
    mechanism that lets two differently-shaped sources merge safely.
    """
    patterns = _glob_patterns()
    if not patterns:
        return pd.DataFrame()

    con = duckdb.connect()
    col_clause = ", ".join(columns) if columns else "*"
    where_clauses = []
    params = []

    if cutoff_after is not None:
        where_clauses.append("fetched_at >= ?")
        params.append(str(cutoff_after))
    if cutoff_before is not None:
        where_clauses.append("fetched_at < ?")
        params.append(str(cutoff_before))

    where_sql = f"WHERE {' AND '.join(where_clauses)}" if where_clauses else ""

    # Build a UNION ALL across each source directory's own glob, rather
    # than a single read_parquet call with a list of patterns — this is
    # more robust if one directory is entirely empty or doesn't exist,
    # since read_parquet on a pattern matching zero files raises an error
    # in some DuckDB versions, whereas skipping that branch entirely here
    # avoids the issue without relying on DuckDB-version-specific behavior.
    subqueries = []
    for pattern in patterns:
        subqueries.append(
            f"SELECT {col_clause} FROM read_parquet('{pattern}', union_by_name=true) {where_sql}"
        )

    query = " UNION ALL BY NAME ".join(subqueries)

    try:
        df = con.execute(query, params * len(subqueries)).fetchdf()
    except Exception as e:
        logger.error(f"DuckDB load failed ({e}), falling back to pandas path")
        con.close()
        return _load_with_pandas(_all_files(), cutoff_after, cutoff_before, columns)
    finally:
        con.close()

    file_count = len(_all_files())
    logger.info(f"Loaded {len(df):,} archived rows via DuckDB from {file_count} parquet file(s) across {len(patterns)} source dir(s)")
    return df


def _load_with_pandas(files, cutoff_after, cutoff_before, columns) -> pd.DataFrame:
    """
    Fallback path when duckdb isn't installed. Reads files one at a time
    and applies the date filter immediately after each read, rather than
    concatenating everything first, to keep peak memory lower. Uses
    pd.concat's natural column-union behavior (mismatched columns become
    NaN, not an error) to tolerate the legacy backup having a different
    shape than the new archive, mirroring DuckDB's union_by_name behavior
    in the primary path above.
    """
    frames = []
    for f in sorted(files):
        try:
            df = pd.read_parquet(f, engine="pyarrow", columns=columns)
        except Exception as e:
            logger.warning(f"Skipping unreadable parquet file {f}: {e}")
            continue

        if "fetched_at" in df.columns and (cutoff_after is not None or cutoff_before is not None):
            ts = pd.to_datetime(df["fetched_at"], errors="coerce", utc=True)
            mask = pd.Series(True, index=df.index)
            if cutoff_after is not None:
                mask &= ts >= cutoff_after
            if cutoff_before is not None:
                mask &= ts < cutoff_before
            df = df[mask]

        if not df.empty:
            frames.append(df)

    if not frames:
        return pd.DataFrame()

    # pd.concat with differently-shaped DataFrames unions columns by name
    # automatically, filling missing ones with NaN — the pandas-fallback
    # equivalent of DuckDB's union_by_name above.
    result = pd.concat(frames, ignore_index=True)
    logger.info(f"Loaded {len(result):,} archived rows via pandas fallback from {len(files)} file(s)")
    return result
