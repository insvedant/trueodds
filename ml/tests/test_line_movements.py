"""Line-movement archiving (added on the server) and Sharp Money reading BOTH Mongo and the archive."""
import glob
import os
from datetime import datetime, timedelta, timezone

import mongomock
import numpy as np
import pandas as pd
import pyarrow.parquet as pq
import pytest

import ml.archive_snapshots as arch
import ml.config as cfg
import ml.models.train as T
import ml.parquet_loader as PL

NOW = datetime.now(timezone.utc).replace(tzinfo=None)


def mv(i, days_ago, minute=0, eid=None, sharp=True, sel="A"):
    return {"event_id": eid or f"e{i}", "market": "h2h", "selection": sel, "book": "pinnacle" if sharp else "fanduel",
            "is_sharp_book": sharp, "timestamp": (NOW - timedelta(days=days_ago)).replace(hour=2, minute=minute, second=0, microsecond=0),
            "prob_change": 0.01, "moved_up": True, "seconds_since_prev": 300.0}


@pytest.fixture()
def archive_env(tmp_path, monkeypatch):
    root = str(tmp_path / "archive")
    for mod in (arch, PL, cfg):
        monkeypatch.setattr(mod, "ARCHIVE_DIR", root, raising=False)
    monkeypatch.setattr(arch, "BATCH_SIZE", 500)
    db = mongomock.MongoClient()["t"]
    monkeypatch.setattr(arch, "get_db", lambda: db)
    return root, db


def rows_on_disk(root, sub):
    return sum(pq.ParquetFile(f).metadata.num_rows for f in glob.glob(os.path.join(root, sub, "**", "*.parquet"), recursive=True))


def test_line_movements_are_archived_verified_then_deleted(archive_env):
    root, db = archive_env
    db["line_movements"].insert_many([mv(i, 20, minute=i % 59) for i in range(1200)] + [mv(9000 + i, 1) for i in range(30)])
    result = arch.archive_line_movements()
    assert result["archived"] == 1200
    assert db["line_movements"].count_documents({}) == 30                  # recent ones stay in Mongo
    assert rows_on_disk(root, "line_movements") == 1200


def test_a_second_run_on_the_same_day_does_not_overwrite_the_first(archive_env):
    """The original archiver restarted at batch_0000 on every run and replaced the earlier file."""
    root, db = archive_env
    db["line_movements"].insert_many([mv(i, 20, minute=i % 59) for i in range(300)])
    arch.archive_line_movements()
    first_files = sorted(glob.glob(os.path.join(root, "line_movements", "**", "*.parquet"), recursive=True))
    db["line_movements"].insert_many([mv(5000 + i, 20, minute=i % 59) for i in range(200)])        # same calendar day
    arch.archive_line_movements()
    second_files = sorted(glob.glob(os.path.join(root, "line_movements", "**", "*.parquet"), recursive=True))
    assert len(second_files) == len(first_files) + 1 and set(first_files) <= set(second_files)
    assert rows_on_disk(root, "line_movements") == 500


def test_snapshot_batches_are_not_overwritten_by_a_later_run_either(archive_env):
    root, db = archive_env
    def snap(i): return {"_id": f"s{i}", "event_id": "e", "is_duplicate": False, "fetched_at": NOW - timedelta(days=20) + timedelta(minutes=i),
                         "book_odds": {"h2h": {"A": {"pinnacle": -110}, "B": {"pinnacle": 100}}}}
    db["odds_snapshots"].insert_many([snap(i) for i in range(100)])
    arch.archive_snapshots()
    db["odds_snapshots"].insert_many([snap(1000 + i) for i in range(100)])
    arch.archive_snapshots()
    assert rows_on_disk(root, "odds_snapshots") == 200


def test_the_snapshot_loader_never_picks_up_line_movement_files(archive_env, tmp_path):
    root, db = archive_env
    db["line_movements"].insert_many([mv(i, 20) for i in range(50)])
    arch.archive_line_movements()
    legacy = tmp_path / "legacy"; legacy.mkdir()
    PL.LEGACY_ARCHIVE_DIR = str(legacy)
    assert PL._all_files() == [] and glob.glob(os.path.join(root, "line_movements", "**", "*.parquet"), recursive=True)


def test_archived_movements_stream_back_with_the_cutoff_applied(archive_env):
    root, db = archive_env
    db["line_movements"].insert_many([mv(1, 40), mv(2, 20), mv(3, 15)])
    arch.archive_line_movements()
    stats = {}
    got = list(PL.iter_line_movements(cutoff_after=pd.Timestamp(datetime.now(timezone.utc) - timedelta(days=30)), stats=stats))
    assert sorted(r["event_id"] for r in got) == ["e2", "e3"]               # the 40-day-old one is outside the window
    assert all(r["timestamp"].tzinfo is not None and r["is_sharp_book"] is True for r in got)
    assert stats["files_read"] >= 1


def _ms(ts):
    return ts.replace(microsecond=ts.microsecond // 1000 * 1000)


def test_sharp_dataset_is_identical_whether_movements_are_all_in_mongo_or_split_with_the_archive(world_data, archive_env, monkeypatch):
    """The core guarantee: archiving old movements must not change what Sharp Money trains on."""
    root, split_db = archive_env
    _, moves, _ = world_data
    keep = sorted({m["event_id"] for m in moves})[:22]                    # a subset keeps the fake database fast
    moves = [dict(m, timestamp=_ms(m["timestamp"])) for m in moves if m["event_id"] in set(keep)]
    monkeypatch.setattr(arch, "BATCH_SIZE", 3000)
    monkeypatch.setattr(T, "MIN_TRAINING_ROWS", 10)
    monkeypatch.setattr(T, "SHARP_MIN_PER_CLASS", 3)

    all_in_mongo = mongomock.MongoClient()["all"]
    all_in_mongo["line_movements"].insert_many([dict(m) for m in moves])
    X_ref, y_ref, info_ref = T.build_sharp_money_dataset(all_in_mongo)

    # same movements, but everything older than 7 days goes through the REAL archiver into Parquet
    split_db["line_movements"].insert_many([dict(m) for m in moves])
    arch.archive_line_movements()
    left = split_db["line_movements"].count_documents({})
    assert 0 < left < len(moves) and rows_on_disk(root, "line_movements") + left == len(moves)
    X, y, info = T.build_sharp_money_dataset(split_db)

    assert info["archive"]["files_read"] > 0 and info["mongo_groups"] > 0
    assert info["samples"] == info_ref["samples"] and info["ties_skipped"] == info_ref["ties_skipped"]
    key = lambda df, lab: pd.concat([df.round(9), lab.rename("y")], axis=1).sort_values(list(df.columns) + ["y"]).reset_index(drop=True)
    pd.testing.assert_frame_equal(key(X, y), key(X_ref, y_ref), check_exact=False, rtol=1e-9, atol=1e-9)
