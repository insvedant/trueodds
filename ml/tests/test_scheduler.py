import asyncio
import os
import sys
import time
from datetime import datetime, timedelta, timezone

import pytest

apscheduler = pytest.importorskip("apscheduler")
from apscheduler.schedulers.asyncio import AsyncIOScheduler       # noqa: E402
from apscheduler.triggers.date import DateTrigger                 # noqa: E402

import ml.scheduler.run as R                                      # noqa: E402

PY = sys.executable


def run(coro):
    return asyncio.run(coro)


def test_a_busy_event_loop_drops_a_default_job_but_not_one_with_the_nightly_grace():
    """Reproduces 'Run time of job job_train_models ... was missed by 0:01:18' and the cure."""
    ran = {"default": False, "graced": False}

    async def scenario():
        async def hog(): time.sleep(2.5)                       # blocking work inside an async job, like collection
        async def default_job(): ran["default"] = True
        async def graced_job(): ran["graced"] = True
        sch = AsyncIOScheduler(); sch.start()
        t = datetime.now(timezone.utc) + timedelta(seconds=1)
        sch.add_job(hog, DateTrigger(t))
        sch.add_job(default_job, DateTrigger(t + timedelta(milliseconds=200)))
        sch.add_job(graced_job, DateTrigger(t + timedelta(milliseconds=200)), misfire_grace_time=R.NIGHTLY_MISFIRE_GRACE_SECONDS)
        await asyncio.sleep(5)
        sch.shutdown(wait=False)
    run(scenario())
    assert ran == {"default": False, "graced": True}


def test_training_is_registered_with_the_grace_and_no_restart_trigger_and_archival_is_not_scheduled_here():
    src = open(R.__file__, encoding="utf-8").read()
    assert src.count("misfire_grace_time=NIGHTLY_MISFIRE_GRACE_SECONDS") == 1
    assert 'id="archive_snapshots"' not in src          # archival runs outside the scheduler on the server; two archivers must never run at once
    train_registration = src.split("job_train_models,")[1].split("job_archive_snapshots,")[0]
    assert "next_run_time" not in train_registration.replace("No next_run_time=now", "")


class TestSubprocessRunner:
    def test_success_streams_output_and_never_blocks_the_loop(self):
        async def scenario():
            ticks = []
            async def ticker():
                while True:
                    ticks.append(time.time()); await asyncio.sleep(0.05)
            t = asyncio.create_task(ticker())
            out = await R.run_logged_subprocess([PY, "-c", "import time\nfor i in range(3): print('line', i, flush=True); time.sleep(0.4)"], cwd="/tmp", timeout=30)
            t.cancel()
            return out, max(b - a for a, b in zip(ticks, ticks[1:]))
        out, worst_gap = run(scenario())
        assert out["returncode"] == 0 and out["tail"] == ["line 0", "line 1", "line 2"]
        assert worst_gap < 0.4

    def test_failure_exit_code_and_last_output_are_reported(self):
        out = run(R.run_logged_subprocess([PY, "-c", "import sys; print('boom'); sys.exit(3)"], cwd="/tmp", timeout=30))
        assert out["returncode"] == 3 and out["tail"] == ["boom"] and not out["timed_out"]

    @pytest.mark.skipif(os.name == "nt", reason="SIGKILL semantics")
    def test_os_kill_for_memory_is_reported_as_minus_nine(self):
        out = run(R.run_logged_subprocess([PY, "-c", "import os, signal; os.kill(os.getpid(), signal.SIGKILL)"], cwd="/tmp", timeout=30))
        assert out["returncode"] == -9

    def test_runaway_child_is_killed_at_the_timeout(self):
        t0 = time.time()
        out = run(R.run_logged_subprocess([PY, "-c", "import time; time.sleep(60)"], cwd="/tmp", timeout=1))
        assert out["timed_out"] and time.time() - t0 < 5

    def test_a_huge_single_line_does_not_crash_the_reader(self):
        out = run(R.run_logged_subprocess([PY, "-c", "print('x' * 300000)"], cwd="/tmp", timeout=30))
        assert out["returncode"] == 0


def test_training_job_runs_the_trainer_module_from_the_project_root(monkeypatch):
    seen = {}
    async def fake(cmd, cwd, timeout, tag="[TRAIN]"):
        seen.update(cmd=cmd, cwd=cwd, timeout=timeout)
        return {"returncode": 0, "timed_out": False, "tail": []}
    monkeypatch.setattr(R, "run_logged_subprocess", fake)
    run(R.job_train_models())
    assert seen["cmd"][-2:] == ["-m", "ml.models.train"] and os.path.isdir(os.path.join(seen["cwd"], "ml")) and seen["timeout"] >= 3600


def test_archival_waits_for_training_instead_of_running_beside_it(monkeypatch):
    order = []
    async def slow_train(cmd, cwd, timeout, tag="[TRAIN]"):
        order.append("train-start"); await asyncio.sleep(0.4); order.append("train-end")
        return {"returncode": 0, "timed_out": False, "tail": []}
    monkeypatch.setattr(R, "run_logged_subprocess", slow_train)
    import ml.archive_snapshots as arch
    monkeypatch.setattr(arch, "archive_snapshots", lambda: order.append("archive") or {"archived": 0})
    R._heavy_lock = None
    async def both():
        t = asyncio.create_task(R.job_train_models()); await asyncio.sleep(0.05)
        await asyncio.gather(t, R.job_archive_snapshots())
    run(both())
    assert order == ["train-start", "train-end", "archive"]


class TestFrequentJobsStayOffTheEventLoop:
    """Collection and predictions used to block the loop for minutes, so the other job was skipped."""

    def _worst_gap_while(self, coro_factory):
        async def scenario():
            ticks = []
            async def ticker():
                while True:
                    ticks.append(time.time()); await asyncio.sleep(0.05)
            t = asyncio.create_task(ticker())
            await coro_factory()
            t.cancel()
            return max(b - a for a, b in zip(ticks, ticks[1:]))
        return run(scenario())

    def test_a_blocking_prediction_run_does_not_freeze_the_scheduler(self, monkeypatch):
        import ml.models.predict as P
        monkeypatch.setattr(P, "generate_all_predictions", lambda: time.sleep(1.0) or 7)
        assert self._worst_gap_while(R.job_generate_predictions) < 0.4

    def test_a_blocking_collection_run_does_not_freeze_the_scheduler(self, monkeypatch):
        import ml.collect_data as C
        async def slow_collect():
            time.sleep(1.0)                                   # blocking work inside an async function, like the real one
            return {"games": 1}
        monkeypatch.setattr(C, "collect_snapshot", slow_collect)
        assert self._worst_gap_while(R.job_collect_data) < 0.4

    def test_frequent_jobs_have_a_catch_up_window_and_never_overlap_themselves(self):
        src = open(R.__file__, encoding="utf-8").read()
        assert src.count("misfire_grace_time=FREQUENT_MISFIRE_GRACE_SECONDS") == 2
        for job_id in ("collect_data", "generate_predictions"):
            block = src[src.index(f'id="{job_id}"'):].split("scheduler.add_job")[0]
            assert "max_instances=1" in block and "coalesce=True" in block

    def test_training_runs_at_the_configured_quiet_hour(self):
        src = open(R.__file__, encoding="utf-8").read()
        assert "CronTrigger(hour=TRAIN_HOUR_UTC, minute=0)" in src and R.TRAIN_HOUR_UTC == 8


@pytest.mark.skipif(not __import__("shutil").which("nice"), reason="nice not available")
def test_training_runs_at_lower_cpu_priority(monkeypatch):
    seen = {}
    async def fake(cmd, cwd, timeout, tag="[TRAIN]"):
        seen["cmd"] = cmd
        return {"returncode": 0, "timed_out": False, "tail": []}
    monkeypatch.setattr(R, "run_logged_subprocess", fake)
    R._heavy_lock = None
    run(R.job_train_models())
    assert seen["cmd"][1:3] == ["-n", "10"] and seen["cmd"][-3:][1:] == ["-m", "ml.models.train"]
