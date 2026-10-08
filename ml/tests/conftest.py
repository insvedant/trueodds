"""
Test setup. Nothing here touches a real database or the real archive:
MongoDB is replaced by mongomock, parquet is written to a temp dir with the
project's own archiver helpers, and models are saved to a temp dir.

Run from the repo root:   pip install -r ml/requirements-dev.txt && pytest ml/tests -q
"""
import os
import sys
import shutil
from datetime import datetime, timedelta

import pytest

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
sys.path.insert(0, ROOT)
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

import mongomock                      # noqa: E402
from loguru import logger             # noqa: E402

logger.remove()


@pytest.fixture(autouse=True)
def isolated_models(tmp_path, monkeypatch):
    """Never write models into the real ml/saved_models, and never reach a real MongoDB."""
    import ml.config as cfg
    import ml.models.train as T
    import ml.models.predict as P
    models = tmp_path / "models"
    models.mkdir()
    for mod in (cfg, T, P):
        if hasattr(mod, "MODEL_DIR"):
            monkeypatch.setattr(mod, "MODEL_DIR", str(models))
    monkeypatch.setattr(T, "MongoClient", mongomock.MongoClient)
    return models


def _write_archive(archive_dir, docs):
    """Archive `docs` exactly the way ml/archive_snapshots.py does (same helpers, same 500-doc batches)."""
    import ml.archive_snapshots as arch
    monkey_dir = arch.ARCHIVE_DIR
    arch.ARCHIVE_DIR = archive_dir
    try:
        counters = {}
        for start in range(0, len(docs), arch.BATCH_SIZE):
            by_date = {}
            for d in docs[start:start + arch.BATCH_SIZE]:
                by_date.setdefault(d["fetched_at"].date(), []).append(d)
            for date_key, group in sorted(by_date.items()):
                idx = counters.get(date_key, 0)
                counters[date_key] = idx + 1
                path = arch.batch_path(datetime(date_key.year, date_key.month, date_key.day), idx)
                os.makedirs(os.path.dirname(path), exist_ok=True)
                assert arch._write_batch_parquet([arch._normalize_doc(x) for x in group], path)
    finally:
        arch.ARCHIVE_DIR = monkey_dir


@pytest.fixture(scope="session")
def world_data():
    """~120 synthetic events over 45 days: raw docs only (cheap to build once)."""
    import synth
    return synth.generate(n_events=120, days=45, seed=3)


@pytest.fixture()
def world(world_data, tmp_path, monkeypatch):
    """
    A production-shaped world: snapshots older than 7 days live in parquet (written by the real
    archiver code), the rest in mongomock. Returns (db, meta, all_snaps, all_moves).
    """
    import ml.config as cfg
    import ml.parquet_loader as PL
    snaps, moves, meta = world_data
    cutoff = meta["now"] - timedelta(days=7)
    old = [d for d in snaps if d["fetched_at"] < cutoff]
    keep = [d for d in snaps if d["fetched_at"] >= cutoff]
    archive_dir = str(tmp_path / "data_archive")
    _write_archive(archive_dir, old)
    legacy = tmp_path / "parquet_backup"
    legacy.mkdir()
    for mod in (cfg, PL):
        monkeypatch.setattr(mod, "ARCHIVE_DIR", archive_dir, raising=False)
        monkeypatch.setattr(mod, "LEGACY_ARCHIVE_DIR", str(legacy), raising=False)
    db = mongomock.MongoClient()["trueodds_test"]
    for i in range(0, len(keep), 5000):
        db["odds_snapshots"].insert_many([dict(d) for d in keep[i:i + 5000]])
    return db, meta, snaps, moves
