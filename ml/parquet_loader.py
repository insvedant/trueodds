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
import re
import sys
import glob
from datetime import timedelta, date

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
    Return glob patterns for directories that actually contain parquet files.
    A directory that merely EXISTS but is empty (e.g. data_archive/ on day 1
    of a fresh deploy, before the 7-day retention window elapses) must NOT
    produce a pattern — DuckDB raises IOException: No files found if given
    a glob that matches zero files, confirmed empirically against the actual
    installed DuckDB version.
    """
    patterns = []

    # IMPORTANT: only odds_snapshots belong in this loader. line_movements has a different
    # schema (and lives in its own folder under the archive); it is read by
    # load_historical_line_movements() / iter_line_movements() below.
    archive_pattern = os.path.join(ARCHIVE_DIR, "odds_snapshots", "**", "*.parquet")
    legacy_pattern  = os.path.join(LEGACY_ARCHIVE_DIR, "**", "*.parquet")

    if os.path.isdir(ARCHIVE_DIR):
        if glob.glob(archive_pattern, recursive=True):
            patterns.append(archive_pattern)
        else:
            logger.info(f"No parquet files yet in {ARCHIVE_DIR}, skipping")

    if os.path.isdir(LEGACY_ARCHIVE_DIR):
        if glob.glob(legacy_pattern, recursive=True):
            patterns.append(legacy_pattern)
        else:
            logger.warning(f"No parquet files found in {LEGACY_ARCHIVE_DIR}")

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
    skipped_missing_cols, skipped_other = 0, 0
    for f in sorted(files):
        try:
            df = pd.read_parquet(f, engine="pyarrow", columns=columns)
        except Exception as e:
            # A batch made up only of "unchanged" marker documents has no
            # book_odds column at all, so asking for it raises
            # "No match for FieldRef.Name(book_odds)" followed by a dump of the
            # whole file schema. That is expected (those rows carry no odds),
            # so count it quietly instead of logging thousands of lines.
            first_line = str(e).splitlines()[0] if str(e) else type(e).__name__
            if "No match for FieldRef" in first_line:
                skipped_missing_cols += 1
            else:
                skipped_other += 1
                logger.warning(f"Skipping unreadable parquet file {f}: {first_line[:200]}")
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

    if skipped_missing_cols or skipped_other:
        logger.info(
            f"Parquet fallback skipped {skipped_missing_cols} file(s) lacking the requested columns "
            f"(marker-only batches) and {skipped_other} unreadable file(s)"
        )
    if not frames:
        return pd.DataFrame()

    # pd.concat with differently-shaped DataFrames unions columns by name
    # automatically, filling missing ones with NaN — the pandas-fallback
    # equivalent of DuckDB's union_by_name above.
    result = pd.concat(frames, ignore_index=True)
    logger.info(f"Loaded {len(result):,} archived rows via pandas fallback from {len(files)} file(s)")
    return result


# ---------------------------------------------------------------------------
# Streaming reader
# ---------------------------------------------------------------------------
_PARTITION_RE = re.compile(r"year=(\d{4})[\\/]+month=(\d{1,2})[\\/]+day=(\d{1,2})")


def _partition_date(path: str):
    """The date encoded in a year=/month=/day= archive path, else None."""
    m = _PARTITION_RE.search(path)
    if not m:
        return None
    try:
        return date(int(m.group(1)), int(m.group(2)), int(m.group(3)))
    except ValueError:
        return None


def new_stream_stats() -> dict:
    return {
        "files_total": 0, "files_pruned": 0, "files_no_odds": 0, "files_unreadable": 0,
        "files_read": 0, "rows_read": 0, "rows_real_h2h": 0, "rows_odds_lost": 0,
    }


def iter_h2h_snapshots(cutoff_after=None, stats: dict | None = None, batch_size: int = 2000):
    """
    Yield one dict per REAL archived snapshot, one parquet file at a time:

        {"event_id", "fetched_at" (UTC datetime), "commence_time", "h2h" (cleaned)}

    Why this exists: load_historical_parquet() builds ONE pandas DataFrame of
    every archived row, with the full nested book_odds (h2h + spreads + totals)
    as Python objects. For the ~240k rows in a 30-day window that is well over
    a gigabyte on a machine with ~950 MB of RAM, which is how the training run
    ended up being killed by the out-of-memory killer. This reader instead:

      * skips whole files by the date in their year=/month=/day= path before
        opening them,
      * reads only the columns it needs, and only the h2h part of book_odds,
      * converts a couple of thousand rows at a time and discards them,

    so memory stays proportional to what the caller chooses to keep, not to
    the size of the archive.

    Counters are accumulated into `stats` (see new_stream_stats()) so callers
    can log exactly where data was lost.
    """
    import pyarrow as pa
    import pyarrow.parquet as pq
    from ml.features import parse_utc, clean_h2h

    stats = stats if stats is not None else new_stream_stats()
    for k, v in new_stream_stats().items():
        stats.setdefault(k, v)

    cutoff_day = cutoff_after.date() if cutoff_after is not None else None
    cutoff_utc = parse_utc(cutoff_after) if cutoff_after is not None else None

    for path in sorted(_all_files()):
        stats["files_total"] += 1

        pdate = _partition_date(path)
        # One day of slack so a timezone edge can never drop a boundary day.
        if cutoff_day is not None and pdate is not None and pdate < cutoff_day - timedelta(days=1):
            stats["files_pruned"] += 1
            continue

        try:
            pf = pq.ParquetFile(path)
            schema = pf.schema_arrow
            names = set(schema.names)
            if not {"event_id", "fetched_at", "book_odds"} <= names:
                stats["files_no_odds"] += 1
                # Such a file is either genuinely all "unchanged" markers, OR a batch whose
                # real snapshots had their odds dropped by the old archiver bug (that data
                # is gone). Count the non-marker rows so the log can say how much was lost.
                if "is_duplicate" in names:
                    flags = pf.read(columns=["is_duplicate"]).column("is_duplicate").to_pylist()
                    stats["rows_odds_lost"] += sum(1 for f in flags if f is not True)
                else:
                    stats["rows_odds_lost"] += pf.metadata.num_rows
                continue
            odds_type = schema.field("book_odds").type
            if not (pa.types.is_struct(odds_type) and odds_type.get_field_index("h2h") >= 0):
                stats["files_no_odds"] += 1
                continue

            cols = [c for c in ("event_id", "fetched_at", "commence_time", "is_duplicate") if c in names]
            cols.append("book_odds.h2h")
            stats["files_read"] += 1

            for batch in pf.iter_batches(batch_size=batch_size, columns=cols):
                for row in batch.to_pylist():
                    stats["rows_read"] += 1
                    if row.get("is_duplicate") is True:
                        continue
                    h2h = clean_h2h((row.get("book_odds") or {}).get("h2h"))
                    if not h2h:
                        continue
                    ts = parse_utc(row.get("fetched_at"))
                    if ts is None or (cutoff_utc is not None and ts < cutoff_utc):
                        continue
                    stats["rows_real_h2h"] += 1
                    yield {
                        "event_id": row.get("event_id"),
                        "fetched_at": ts,
                        "commence_time": row.get("commence_time"),
                        "h2h": h2h,
                    }
        except Exception as e:
            stats["files_unreadable"] += 1
            first_line = str(e).splitlines()[0] if str(e) else type(e).__name__
            logger.warning(f"Skipping unreadable parquet file {path}: {first_line[:200]}")


# ---------------------------------------------------------------------------
# Archived line_movements (added on the server; merged here)
# ---------------------------------------------------------------------------
def _line_movement_files() -> list:
    return glob.glob(os.path.join(ARCHIVE_DIR, "line_movements", "**", "*.parquet"), recursive=True)


def load_historical_line_movements(cutoff_after=None, cutoff_before=None, columns=None) -> pd.DataFrame:
    """
    Load archived line_movements into ONE DataFrame. Convenient but memory-hungry for long windows;
    training uses iter_line_movements() below instead.
    """
    files = _line_movement_files()
    if not files:
        logger.info(f"No line movement parquet files found under {os.path.join(ARCHIVE_DIR, 'line_movements')}")
        return pd.DataFrame()

    if _HAS_DUCKDB:
        pattern = os.path.join(ARCHIVE_DIR, "line_movements", "**", "*.parquet")
        where, params = [], []
        if cutoff_after is not None:
            where.append("timestamp >= ?"); params.append(str(cutoff_after))
        if cutoff_before is not None:
            where.append("timestamp < ?"); params.append(str(cutoff_before))
        query = (f"SELECT {', '.join(columns) if columns else '*'} "
                 f"FROM read_parquet('{pattern}', union_by_name=true) {'WHERE ' + ' AND '.join(where) if where else ''}")
        con = duckdb.connect()
        try:
            df = con.execute(query, params).fetchdf()
            logger.info(f"Loaded {len(df):,} historical line movements via DuckDB from {len(files)} parquet file(s)")
            return df
        except Exception as e:
            logger.error(f"DuckDB line movement load failed ({e}), falling back to pandas")
        finally:
            con.close()
    return _load_line_movements_with_pandas(files, cutoff_after, cutoff_before, columns)


def _load_line_movements_with_pandas(files, cutoff_after, cutoff_before, columns) -> pd.DataFrame:
    frames = []
    for f in sorted(files):
        try:
            df = pd.read_parquet(f, engine="pyarrow", columns=columns)
        except Exception as e:
            logger.warning(f"Skipping unreadable line movement parquet {f}: {str(e).splitlines()[0][:200]}")
            continue
        if "timestamp" in df.columns and (cutoff_after is not None or cutoff_before is not None):
            ts = pd.to_datetime(df["timestamp"], errors="coerce", utc=True)
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
    result = pd.concat(frames, ignore_index=True)
    logger.info(f"Loaded {len(result):,} historical line movements via pandas fallback from {len(files)} file(s)")
    return result


def iter_line_movements(cutoff_after=None, stats: dict | None = None, batch_size: int = 5000):
    """
    Stream archived line movements one parquet file at a time, yielding plain dicts
    {event_id, market, selection, is_sharp_book, timestamp (UTC datetime), prob_change, moved_up,
    seconds_since_prev}. Same idea as iter_h2h_snapshots(): skip whole files by the date in their
    path, read only the needed columns, and never hold more than one batch in memory.
    """
    import pyarrow.parquet as pq
    from ml.features import parse_utc

    stats = stats if stats is not None else {}
    for k in ("files_total", "files_pruned", "files_unreadable", "files_read", "rows_read"):
        stats.setdefault(k, 0)
    cutoff_day = cutoff_after.date() if cutoff_after is not None else None
    cutoff_utc = parse_utc(cutoff_after) if cutoff_after is not None else None
    wanted = ("event_id", "market", "selection", "is_sharp_book", "timestamp", "prob_change", "moved_up", "seconds_since_prev")

    for path in sorted(_line_movement_files()):
        stats["files_total"] += 1
        pdate = _partition_date(path)
        if cutoff_day is not None and pdate is not None and pdate < cutoff_day - timedelta(days=1):
            stats["files_pruned"] += 1
            continue
        try:
            pf = pq.ParquetFile(path)
            names = set(pf.schema_arrow.names)
            if not {"event_id", "selection", "is_sharp_book", "timestamp"} <= names:
                stats["files_unreadable"] += 1
                continue
            cols = [c for c in wanted if c in names]
            stats["files_read"] += 1
            for batch in pf.iter_batches(batch_size=batch_size, columns=cols):
                for row in batch.to_pylist():
                    stats["rows_read"] += 1
                    ts = parse_utc(row.get("timestamp"))
                    if ts is None or (cutoff_utc is not None and ts < cutoff_utc):
                        continue
                    row["timestamp"] = ts
                    yield row
        except Exception as e:
            stats["files_unreadable"] += 1
            logger.warning(f"Skipping unreadable line movement parquet {path}: {str(e).splitlines()[0][:200] if str(e) else type(e).__name__}")
