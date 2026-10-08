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


def test_training_and_archive_jobs_are_registered_with_the_grace_and_no_restart_trigger():
    src = open(R.__file__, encoding="utf-8").read()
    assert src.count("misfire_grace_time=NIGHTLY_MISFIRE_GRACE_SECONDS") == 2
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
