from datetime import datetime, timedelta, timezone

import mongomock
import pytest

import ml.archive_snapshots as arch
import ml.maintenance as M

NOW = datetime.now(timezone.utc).replace(tzinfo=None)


def snap(_id, age, real=True, of=None, eid="e1"):
    d = {"_id": _id, "event_id": eid, "fetched_at": NOW - age, "is_duplicate": not real}
    if real:
        d["book_odds"] = {"h2h": {"A": {"pinnacle": -110}, "B": {"pinnacle": 100}}}
    else:
        d["duplicate_of"] = of
    return d


@pytest.fixture()
def env(tmp_path, monkeypatch):
    db = mongomock.MongoClient()["t"]
    monkeypatch.setattr(arch, "get_db", lambda: db)
    monkeypatch.setattr(arch, "ARCHIVE_DIR", str(tmp_path / "archive"))
    return db


H = lambda n: timedelta(hours=n)


class TestRetention:
    def test_a_shorter_retention_archives_more(self, env):
        env["odds_snapshots"].insert_many([snap("a", H(30)), snap("b", H(10)), snap("c", H(3)), snap("d", timedelta(minutes=30), eid="e2")])
        assert arch.archive_snapshots(retention=H(24))["archived"] == 1
        assert env["odds_snapshots"].count_documents({}) == 3
        assert arch.archive_snapshots(retention=H(2))["archived"] == 2
        assert sorted(d["_id"] for d in env["odds_snapshots"].find()) == ["d"]

    def test_default_retention_is_unchanged(self, env):
        env["odds_snapshots"].insert_many([snap("old", timedelta(days=9)), snap("new", timedelta(days=3))])
        assert arch.archive_snapshots()["archived"] == 1


class TestProtectedOriginals:
    def test_a_snapshot_a_recent_marker_still_points_at_is_never_archived(self, env):
        """Odds unchanged for 5 days: the real snapshot is old, but live markers still depend on it."""
        env["odds_snapshots"].insert_many([snap("orig", timedelta(days=5)), snap("m1", H(2), real=False, of="orig"), snap("m2", timedelta(minutes=10), real=False, of="orig"),
                                           snap("junk", timedelta(days=5), eid="e9")])
        result = arch.archive_snapshots(retention=H(24))
        remaining = {d["_id"] for d in env["odds_snapshots"].find()}
        assert "orig" in remaining and {"m1", "m2"} <= remaining          # the referenced original and its markers stay
        assert "junk" not in remaining and result["archived"] == 1        # unrelated old data is still archived
        for m in env["odds_snapshots"].find({"is_duplicate": True}):
            assert env["odds_snapshots"].find_one({"_id": m["duplicate_of"]}) is not None     # no dangling marker

    def test_once_nothing_recent_points_at_it_the_original_is_archived(self, env):
        env["odds_snapshots"].insert_many([snap("orig", timedelta(days=5)), snap("m1", timedelta(days=4), real=False, of="orig")])
        assert arch.archive_snapshots(retention=H(24))["archived"] == 2
        assert env["odds_snapshots"].count_documents({}) == 0


class TestDecisions:
    @pytest.mark.parametrize("pct, level, hours, pause", [
        (10, "ok", 24, False), (54.9, "ok", 24, False), (55, "elevated", 12, False), (69, "elevated", 12, False),
        (70, "high", 6, False), (81, "high", 6, False), (82, "critical", 2, False), (91.9, "critical", 2, False), (92, "emergency", 1, True), (99, "emergency", 1, True)])
    def test_thresholds(self, pct, level, hours, pause):
        d = M.decide(pct, was_paused=False)
        assert (d.level, d.retention_hours, d.pause) == (level, hours, pause)

    def test_once_paused_it_stays_paused_until_usage_is_clearly_lower(self, ):
        assert M.decide(88, was_paused=True).pause is True            # below the pause line but above the resume line
        assert M.decide(86, was_paused=True).pause is True
        assert M.decide(84, was_paused=True).pause is False
        assert M.decide(88, was_paused=False).pause is False         # a fresh run at 88% does not pause

    def test_unmeasurable_usage_is_handled_conservatively(self):
        d = M.decide(None, was_paused=False)
        assert d.level == "unknown" and d.retention_hours == 12 and d.pause is False
        assert M.decide(None, was_paused=True).pause is True


def readings(*values):
    """A measuring function that returns the given MB values in order (it is called with the client)."""
    it = iter(values)
    return lambda client: next(it)


class TestRunOnce:
    def run(self, client, usages, notify=None, was_paused=None):
        seq = iter(usages)
        calls = []
        if was_paused is not None:
            client["trueodds"]["ml_stats"].insert_one({"_id": "storage_guard", "paused": was_paused, "level": "ok"})
        report = M.run_once(client, measure=lambda c: next(seq),
                            snapshots_fn=lambda r: calls.append(("snap", r)) or {"archived": 1},
                            movements_fn=lambda r: calls.append(("mov", r)) or {"archived": 2},
                            notify=notify or (lambda m: None))
        return report, calls, client["trueodds"]["ml_stats"].find_one({"_id": "storage_guard"})

    def test_plenty_of_room_keeps_a_day_and_does_not_pause(self):
        report, calls, guard = self.run(mongomock.MongoClient(), [100.0, 90.0])
        assert calls == [("snap", H(24)), ("mov", H(24))]
        assert report["paused"] is False and guard["paused"] is False and guard["level"] == "ok"

    def test_filling_up_tightens_retention(self):
        _, calls, _ = self.run(mongomock.MongoClient(), [400.0, 300.0])       # 78% -> keep 6h
        assert calls[0] == ("snap", H(6))

    def test_still_nearly_full_after_archiving_pauses_collection_and_alerts_once(self):
        sent = []
        report, calls, guard = self.run(mongomock.MongoClient(), [500.0, 495.0], notify=sent.append)      # 98% -> 97%
        assert guard["paused"] is True and report["paused"] is True and calls[0][1] == H(1)
        assert len(sent) == 1 and "PAUSED" in sent[0]

    def test_archiving_that_frees_space_means_no_pause(self):
        _, _, guard = self.run(mongomock.MongoClient(), [490.0, 200.0])       # 96% before, 39% after
        assert guard["paused"] is False

    def test_it_stays_paused_through_the_hysteresis_band_then_resumes_with_an_alert(self):
        client = mongomock.MongoClient()
        _, _, guard = self.run(client, [450.0, 445.0], was_paused=True)       # 88% -> 87%: below the pause line, above the resume line
        assert guard["paused"] is True
        sent = []
        M.run_once(client, measure=readings(420.0, 300.0), snapshots_fn=lambda r: {}, movements_fn=lambda r: {}, notify=sent.append)   # 59% after archiving
        guard = client["trueodds"]["ml_stats"].find_one({"_id": "storage_guard"})
        assert guard["paused"] is False and len(sent) == 1 and "RESUMED" in sent[0]

    def test_a_failing_archiver_does_not_stop_the_guard_from_being_updated(self):
        client = mongomock.MongoClient()
        def boom(r): raise RuntimeError("disk full")
        report = M.run_once(client, measure=readings(505.0, 500.0), snapshots_fn=boom, movements_fn=lambda r: {"archived": 0}, notify=lambda m: None)
        assert "error" in report["archived"]["snapshots"] and report["paused"] is True       # still 98% full: pause anyway
        assert client["trueodds"]["ml_stats"].find_one({"_id": "storage_guard"})["paused"] is True

    def test_when_usage_cannot_be_measured_it_still_archives_conservatively_and_keeps_the_pause_state(self):
        client = mongomock.MongoClient()
        def cant(c): raise RuntimeError("command not supported")
        report = M.run_once(client, measure=cant, snapshots_fn=lambda r: {"retention": r}, movements_fn=lambda r: {}, notify=lambda m: None)
        assert report["archived"]["snapshots"]["retention"] == H(12) and report["paused"] is False


def test_only_one_maintenance_run_at_a_time(tmp_path):
    lock = str(tmp_path / "lock")
    with M.single_instance(lock) as first:
        assert first is True
        with M.single_instance(lock) as second:
            assert second is False                       # an overlapping run must back off
    with M.single_instance(lock) as again:
        assert again is True                             # and the lock is released afterwards
