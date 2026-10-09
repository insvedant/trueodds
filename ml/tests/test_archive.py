"""The archiver used to destroy odds. These tests pin the fix, and prove verification now catches a lossy writer."""
import os
from datetime import datetime, timedelta, timezone

import mongomock
import pyarrow as pa
import pyarrow.parquet as pq
import pytest

import ml.archive_snapshots as arch

MARKER = {"_id": "m1", "event_id": "e1", "is_duplicate": True, "duplicate_of": "r0", "fetched_at": "2026-10-01T00:00:00"}
REAL = {"_id": "r1", "event_id": "e1", "is_duplicate": False, "fetched_at": "2026-10-01T01:00:00",
        "book_odds": {"h2h": {"Yankees": {"pinnacle": -150}, "Mets": {"pinnacle": 130}}}}


def _lossy_writer(rows, path):
    """The ORIGINAL implementation: columns come from the first row only."""
    pq.write_table(pa.Table.from_pylist(rows), path)
    return True


def test_old_writer_really_did_lose_the_odds(tmp_path):
    """Documents the bug itself, so a future 'simplification' back to from_pylist fails loudly."""
    p = str(tmp_path / "b.parquet")
    _lossy_writer([MARKER, REAL], p)
    assert "book_odds" not in pq.ParquetFile(p).schema_arrow.names


@pytest.mark.parametrize("order", [[MARKER, REAL], [REAL, MARKER], [MARKER, MARKER, REAL, MARKER]])
def test_fixed_writer_keeps_odds_whatever_the_batch_starts_with(tmp_path, order):
    p = str(tmp_path / "b.parquet")
    assert arch._write_batch_parquet([dict(r) for r in order], p)
    rows = {r["_id"]: r for r in pq.read_table(p).to_pylist()}
    assert rows["r1"]["book_odds"]["h2h"]["Yankees"]["pinnacle"] == -150
    assert rows["m1"].get("book_odds") is None
    assert arch._verify_batch_parquet(p, len(order), expected_odds_rows=1)


def test_verification_rejects_a_file_whose_odds_were_dropped(tmp_path):
    p = str(tmp_path / "b.parquet")
    _lossy_writer([MARKER, REAL], p)
    assert arch._verify_batch_parquet(p, 2) is True                           # row count alone is fooled (the old check)
    assert arch._verify_batch_parquet(p, 2, expected_odds_rows=1) is False     # content check is not


def _db_with(n_real=30, n_markers=30):
    db = mongomock.MongoClient()["t"]
    # Anchored at 01:00 so the ~10 hours of data never cross a UTC midnight: the archiver splits batches by
    # date, and a post-midnight file starting with a real snapshot would (correctly) survive a lossy writer,
    # making this test depend on the time of day it runs.
    day = (datetime.now(timezone.utc) - timedelta(days=20)).date()
    base = datetime(day.year, day.month, day.day, 1, 0)
    docs, last = [], None
    # chronological, starting with a MARKER: the exact shape that triggered the loss
    for i in range(n_real + n_markers):
        ts = base + timedelta(minutes=10 * i)
        if i % 2 == 0 and last is not None:
            docs.append({"_id": f"m{i}", "event_id": "e1", "is_duplicate": True, "duplicate_of": last, "fetched_at": ts})
        else:
            docs.append({"_id": f"r{i}", "event_id": "e1", "is_duplicate": False, "fetched_at": ts,
                         "book_odds": {"h2h": {"A": {"pinnacle": -110 - i}, "B": {"pinnacle": 100 + i}}}})
            last = f"r{i}"
    docs.insert(0, {"_id": "m_first", "event_id": "e1", "is_duplicate": True, "duplicate_of": "r_prev", "fetched_at": base - timedelta(minutes=1)})
    db["odds_snapshots"].insert_many(docs)
    return db, docs


def _run_archive(db, tmp_path, monkeypatch, batch=500):
    monkeypatch.setattr(arch, "get_db", lambda: db)
    monkeypatch.setattr(arch, "ARCHIVE_DIR", str(tmp_path / "archive"))
    monkeypatch.setattr(arch, "BATCH_SIZE", batch)
    return arch.archive_snapshots()


def test_end_to_end_every_real_snapshot_keeps_its_odds_before_mongo_is_emptied(tmp_path, monkeypatch):
    db, docs = _db_with()
    n_real = sum(1 for d in docs if not d["is_duplicate"])
    result = _run_archive(db, tmp_path, monkeypatch)
    assert result["archived"] == len(docs) and db["odds_snapshots"].count_documents({}) == 0
    import glob
    with_odds = 0
    for f in glob.glob(str(tmp_path / "archive" / "**" / "*.parquet"), recursive=True):
        col = pq.read_table(f, columns=["book_odds"]).column("book_odds")
        with_odds += len(col) - col.null_count
    assert with_odds == n_real                  # nothing lost on the way out of Mongo


def test_end_to_end_with_a_lossy_writer_nothing_is_deleted(tmp_path, monkeypatch):
    """Even if a writer regressed, the content check must stop the delete (data stays safe in Mongo)."""
    db, docs = _db_with()
    monkeypatch.setattr(arch, "_write_batch_parquet", _lossy_writer)
    result = _run_archive(db, tmp_path, monkeypatch)
    assert result["archived"] == 0
    assert db["odds_snapshots"].count_documents({}) == len(docs)
