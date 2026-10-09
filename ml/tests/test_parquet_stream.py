import os
from datetime import datetime, timezone

import pandas as pd
import pyarrow as pa
import pyarrow.parquet as pq
import pytest

import ml.config as cfg
import ml.parquet_loader as PL

CUT = pd.Timestamp("2026-09-20", tz="UTC")


def put(root, rel, table):
    path = os.path.join(root, rel)
    os.makedirs(os.path.dirname(path), exist_ok=True)
    pq.write_table(table, path)
    return path


def row(eid, ts, h2h=None, dup=False):
    r = {"event_id": eid, "fetched_at": ts, "commence_time": "2026-09-25T20:00:00Z", "is_duplicate": dup}
    if h2h is not None:
        r["book_odds"] = {"h2h": h2h}
    return r


@pytest.fixture()
def roots(tmp_path, monkeypatch):
    new, legacy = tmp_path / "new", tmp_path / "legacy"
    new.mkdir(); legacy.mkdir()
    for mod in (cfg, PL):
        monkeypatch.setattr(mod, "ARCHIVE_DIR", str(new), raising=False)
        monkeypatch.setattr(mod, "LEGACY_ARCHIVE_DIR", str(legacy), raising=False)
    return str(new), str(legacy)


def collect():
    stats = PL.new_stream_stats()
    return list(PL.iter_h2h_snapshots(CUT, stats)), stats


def test_reads_real_snapshots_cleans_ghost_teams_and_skips_markers(roots):
    new, _ = roots
    # one file where the struct carries a key for every team in the batch (None for the ones not in this game)
    t = pa.Table.from_pylist([
        row("e1", "2026-09-22T10:00:00", {"A": {"pinnacle": -110, "draftkings": -115}, "B": {"pinnacle": 100}, "Ghost": None}),
        row("e1", "2026-09-22T11:00:00", dup=True),
        row("e2", "2026-09-22T12:00:00", {"Ghost": {"pinnacle": -300}, "C": {"fanduel": None}}),
    ])
    put(new, "odds_snapshots/year=2026/month=09/day=22/batch_0000.parquet", t)
    rows, stats = collect()
    assert [(r["event_id"], sorted(r["h2h"])) for r in rows] == [("e1", ["A", "B"]), ("e2", ["Ghost"])]
    assert rows[0]["fetched_at"] == datetime(2026, 9, 22, 10, tzinfo=timezone.utc)
    assert stats["rows_real_h2h"] == 2 and stats["files_read"] == 1


def test_whole_files_before_the_window_are_skipped_without_being_opened(roots):
    new, _ = roots
    good = pa.Table.from_pylist([row("e1", "2026-09-22T10:00:00", {"A": {"pinnacle": -110}})])
    put(new, "odds_snapshots/year=2026/month=09/day=22/batch_0000.parquet", good)
    put(new, "odds_snapshots/year=2026/month=07/day=02/batch_0000.parquet", good)
    put(new, "odds_snapshots/year=2026/month=09/day=19/batch_0000.parquet", good)          # one day of slack before the cutoff: still opened
    corrupt = os.path.join(new, "odds_snapshots/year=2026/month=06/day=01/batch_0000.parquet")
    os.makedirs(os.path.dirname(corrupt)); open(corrupt, "wb").write(b"not a parquet file")
    rows, stats = collect()
    assert stats["files_pruned"] == 2 and stats["files_read"] == 2 and stats["files_unreadable"] == 0   # corrupt file never touched
    assert stats["files_total"] == 4


def test_rows_before_the_cutoff_inside_an_opened_file_are_filtered(roots):
    new, _ = roots
    t = pa.Table.from_pylist([row("e1", "2026-09-19T23:00:00", {"A": {"pinnacle": -110}}), row("e1", "2026-09-20T01:00:00", {"A": {"pinnacle": -120}})])
    put(new, "odds_snapshots/year=2026/month=09/day=19/batch_0000.parquet", t)
    rows, _ = collect()
    assert [r["fetched_at"].hour for r in rows] == [1]


def test_files_without_odds_are_counted_and_the_lost_snapshots_are_reported(roots):
    new, _ = roots
    # what the old archiver bug produced: 3 REAL snapshots + 1 marker, none with odds
    t = pa.Table.from_pylist([{"event_id": "e1", "fetched_at": "2026-09-22T0%d:00:00" % i, "is_duplicate": i == 0} for i in range(4)])
    put(new, "odds_snapshots/year=2026/month=09/day=22/batch_0000.parquet", t)
    rows, stats = collect()
    assert rows == [] and stats["files_no_odds"] == 1 and stats["rows_odds_lost"] == 3


def test_legacy_layout_timestamp_typed_and_unpartitioned_is_read(roots):
    _, legacy = roots
    t = pa.table({"event_id": ["e9"], "fetched_at": pa.array([datetime(2026, 9, 23, 5, 0)], pa.timestamp("us")),
                  "is_duplicate": [False], "raw_bookmakers": [[{"key": "x"}]],
                  "book_odds": [{"h2h": {"Z": {"pinnacle": 150}}, "totals": {"Over": {"pinnacle": -105}}}]})
    put(legacy, "backup_001.parquet", t)                # no year=/month=/day= in the path: cannot be pruned
    rows, stats = collect()
    assert len(rows) == 1 and rows[0]["event_id"] == "e9" and rows[0]["h2h"] == {"Z": {"pinnacle": 150}}


def test_one_corrupt_file_does_not_stop_the_stream(roots):
    new, _ = roots
    bad = os.path.join(new, "odds_snapshots/year=2026/month=09/day=21/batch_0000.parquet")
    os.makedirs(os.path.dirname(bad)); open(bad, "wb").write(b"garbage")
    put(new, "odds_snapshots/year=2026/month=09/day=22/batch_0000.parquet", pa.Table.from_pylist([row("e1", "2026-09-22T10:00:00", {"A": {"pinnacle": -110}})]))
    rows, stats = collect()
    assert len(rows) == 1 and stats["files_unreadable"] == 1
