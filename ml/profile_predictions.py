"""
profile_predictions.py — where does prediction time go? READ-ONLY: it never writes anything.

    cd ~/trueodds && ./ml/venv/bin/python -m ml.profile_predictions        # 12 events
    ./ml/venv/bin/python -m ml.profile_predictions 30                      # more events

For a sample of today's events it times every MongoDB call that building a prediction makes (calls, time,
documents transferred), the model work, and how long a bare round trip to Atlas takes. The answer to "is it
the network, the amount of data, or the CPU?" decides what to optimise.
"""
import os
import random
import statistics
import sys
import time
from collections import defaultdict
from datetime import datetime, timezone

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from ml.config import COL_ODDS_SNAPSHOTS


class _Stats:
    def __init__(self):
        self.rows = defaultdict(lambda: [0, 0.0, 0])          # (collection.operation) -> [calls, seconds, documents]

    def add(self, key, seconds, docs):
        row = self.rows[key]
        row[0] += 1
        row[1] += seconds
        row[2] += docs

    @property
    def db_seconds(self):
        return sum(r[1] for r in self.rows.values())


class _TimedCursor:
    def __init__(self, cursor, key, stats):
        self._cursor, self._key, self._stats = cursor, key, stats

    def sort(self, *a, **k):
        self._cursor = self._cursor.sort(*a, **k)
        return self

    def limit(self, *a, **k):
        self._cursor = self._cursor.limit(*a, **k)
        return self

    def __iter__(self):
        started = time.perf_counter()
        docs = list(self._cursor)                              # the network transfer happens here
        self._stats.add(self._key, time.perf_counter() - started, len(docs))
        return iter(docs)


class _TimedCollection:
    def __init__(self, collection, name, stats):
        self._c, self._name, self._stats = collection, name, stats

    def _timed(self, op, fn, *args, **kwargs):
        started = time.perf_counter()
        result = fn(*args, **kwargs)
        docs = 1 if isinstance(result, dict) else (len(result) if isinstance(result, list) else 0)
        self._stats.add(f"{self._name}.{op}", time.perf_counter() - started, docs)
        return result

    def find_one(self, *a, **k):
        return self._timed("find_one", self._c.find_one, *a, **k)

    def count_documents(self, *a, **k):
        return self._timed("count_documents", self._c.count_documents, *a, **k)

    def distinct(self, *a, **k):
        return self._timed("distinct", self._c.distinct, *a, **k)

    def aggregate(self, *a, **k):
        return self._timed("aggregate", lambda *x, **y: list(self._c.aggregate(*x, **y)), *a, **k)

    def find(self, *a, **k):
        return _TimedCursor(self._c.find(*a, **k), f"{self._name}.find", self._stats)


class _TimedDb:
    def __init__(self, db, stats):
        self._db, self._stats = db, stats

    def __getitem__(self, name):
        return _TimedCollection(self._db[name], name, self._stats)


def round_trips(client, n: int = 20) -> list:
    out = []
    for _ in range(n):
        started = time.perf_counter()
        client.admin.command("ping")
        out.append((time.perf_counter() - started) * 1000)
    return out


def profile(db, client=None, sample: int = 12, out=print) -> dict:
    from ml.features import build_features_for_event
    from ml.models import predict as P

    if client is not None:
        pings = round_trips(client)
        out(f"Round trip to MongoDB: median {statistics.median(pings):.0f} ms, worst {max(pings):.0f} ms ({len(pings)} pings)")

    now = datetime.now(timezone.utc)
    ids = db[COL_ODDS_SNAPSHOTS].distinct("event_id", {"fetched_at": {"$gte": now.replace(hour=0, minute=0, second=0, microsecond=0)}})
    ids = random.Random(1).sample(ids, min(sample, len(ids)))
    if not ids:
        out("No events found today.")
        return {}

    stats = _Stats()
    timed_db = _TimedDb(db, stats)
    build_seconds = model_seconds = 0.0
    built = 0
    for event_id in ids:
        started = time.perf_counter()
        features = build_features_for_event(event_id, timed_db)
        build_seconds += time.perf_counter() - started
        if not features:
            continue
        built += 1
        started = time.perf_counter()
        P.predict_clv(features)
        P.predict_sharp_money(features)
        model_seconds += time.perf_counter() - started
    n = max(built, 1)

    out(f"\nPer event, averaged over {built} events:")
    out(f"  {'operation':36s} {'calls':>6s} {'ms':>8s} {'docs':>9s}")
    for key, (calls, seconds, docs) in sorted(stats.rows.items(), key=lambda kv: -kv[1][1]):
        out(f"  {key:36s} {calls / n:6.1f} {1000 * seconds / n:8.0f} {docs / n:9.1f}")
    db_ms = 1000 * stats.db_seconds / n
    build_ms = 1000 * build_seconds / n
    model_ms = 1000 * model_seconds / n
    out(f"\n  database time       {db_ms:7.0f} ms")
    out(f"  feature maths (CPU) {max(build_ms - db_ms, 0):7.0f} ms")
    out(f"  models (CPU)        {model_ms:7.0f} ms")
    out(f"  total per event     {build_ms + model_ms:7.0f} ms   (the real job also upserts the prediction)")
    calls_per_event = sum(r[0] for r in stats.rows.values()) / n
    out(f"\n  {calls_per_event:.1f} database calls per event, {sum(r[2] for r in stats.rows.values()) / n:,.0f} documents transferred per event")
    return {"db_ms": db_ms, "feature_cpu_ms": max(build_ms - db_ms, 0), "model_ms": model_ms, "calls": calls_per_event, "events": built}


def main() -> int:
    from pymongo import MongoClient
    from ml.config import MONGODB_URI, DB_NAME
    sample = int(sys.argv[1]) if len(sys.argv) > 1 else 12
    client = MongoClient(MONGODB_URI, serverSelectionTimeoutMS=10_000)
    profile(client[DB_NAME], client, sample)
    return 0


if __name__ == "__main__":
    sys.exit(main())
