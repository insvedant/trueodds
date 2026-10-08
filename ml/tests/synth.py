"""
Synthetic TrueOdds data that mirrors the *shapes* the real collector writes
(see ml/collect_data.py), so the training code can be exercised end to end
without the production database.

Shapes reproduced on purpose:
  * odds_snapshots: full snapshot docs with book_odds{h2h,totals}, plus
    lightweight "unchanged" markers (is_duplicate=True, duplicate_of=<id>) that
    have NO book_odds.
  * line_movements: one doc per (book, selection) price change, with
    is_sharp_book True for SHARP_BOOKS and False for every other book, all
    stamped with the poll time (so books that move in the same poll tie).
  * Sharp books lead the market in some events, soft books lead in others, and
    some move in the same poll - so "who moved first" is a real, non-constant
    signal.
"""
import math
import random
from datetime import datetime, timedelta, timezone

import mongomock
from bson import ObjectId

SHARP = ["pinnacle", "circa", "bookmaker"]
SOFT = ["draftkings", "fanduel", "betmgm", "williamhill_us", "bovada", "betrivers"]
ALL_BOOKS = SHARP + SOFT
SPORTS = ["basketball_nba", "icehockey_nhl", "americanfootball_nfl", "baseball_mlb", "soccer_epl"]
TEAMS = [f"Team {c}{i}" for c in "ABCDEFGH" for i in range(1, 9)]  # 64 distinct names


def _american(prob: float) -> int:
    prob = min(max(prob, 0.04), 0.96)
    if prob >= 0.5:
        a = -100 * prob / (1 - prob)
    else:
        a = 100 * (1 - prob) / prob
    a = int(round(a / 5.0) * 5)           # real books quote in steps of 5
    if -100 < a < 100:
        a = 100 if a >= 0 else -105
    return a


def _implied(a: int) -> float:
    return 100 / (a + 100) if a > 0 else -a / (-a + 100)


def _dec(a: int) -> float:
    return a / 100 + 1 if a > 0 else 100 / abs(a) + 1


def generate(n_events=300, days=45, now=None, seed=7, poll_minutes=60, tracked_hours=72, lead_mix=(0.55, 0.30, 0.15), keep_moves=True):
    """
    Returns (db, meta). lead_mix = P(sharp leads), P(soft leads), P(same poll).
    Events commence between (now - days) and (now + 2 days) and are tracked for
    `tracked_hours` before commencing (or from `now - tracked_hours` for
    events that haven't started yet).
    """
    rng = random.Random(seed)
    now = (now or datetime.now(timezone.utc)).replace(tzinfo=None, microsecond=0)  # pymongo hands back naive UTC
    snaps, moves = [], []
    meta = {"events": 0, "real": 0, "markers": 0, "movements": 0, "labels": {"sharp_first": 0, "soft_first": 0, "tie": 0}}

    for i in range(n_events):
        eid = f"evt_{i:05d}"
        sport = SPORTS[i % len(SPORTS)]
        home, away = rng.sample(TEAMS, 2)
        commence = now - timedelta(days=days) + timedelta(seconds=rng.random() * (days + 2) * 86400)
        start = commence - timedelta(hours=tracked_hours)
        first_poll = max(start, now - timedelta(days=days))
        end = min(commence, now)
        if end <= first_poll + timedelta(hours=3):
            continue

        mode = rng.choices(["sharp", "soft", "tie"], weights=lead_mix)[0]
        lag = {"sharp": (0, rng.randint(1, 3)), "soft": (rng.randint(1, 3), 0), "tie": (0, 0)}[mode]  # (sharp_lag, soft_lag) in polls

        n_polls = int((end - first_poll).total_seconds() // (poll_minutes * 60)) + 1
        p0 = rng.uniform(0.25, 0.75)
        true_p = [p0]
        for _ in range(n_polls):
            step = rng.gauss(0, 0.012) if rng.random() < 0.55 else 0.0       # market only moves some polls
            true_p.append(min(max(true_p[-1] + step, 0.1), 0.9))
        book_noise = {b: rng.uniform(-0.006, 0.006) for b in ALL_BOOKS}
        vig = {b: (0.015 if b in SHARP else 0.045) for b in ALL_BOOKS}

        prev_prices, prev_real_id, prev_ts = None, None, None
        first_sharp_move_ts, first_soft_move_ts = None, None
        for k in range(n_polls):
            ts = first_poll + timedelta(minutes=k * poll_minutes)
            if ts > end:
                break
            prices = {}
            for b in ALL_BOOKS:
                lag_b = lag[0] if b in SHARP else lag[1]
                p = true_p[max(k - lag_b, 0)]
                ph = min(max(p + book_noise[b], 0.05), 0.95)
                prices[b] = {home: _american(ph * (1 + vig[b] / 2)), away: _american((1 - ph) * (1 + vig[b] / 2))}
            tot = {b: {"Over": _american(0.5 + book_noise[b]), "Under": _american(0.5 - book_noise[b])} for b in ALL_BOOKS}

            if prev_prices is not None and prices == prev_prices:
                snaps.append({
                    "_id": ObjectId(), "event_id": eid, "sport": sport, "sport_title": sport, "home": home, "away": away,
                    "commence_time": commence.isoformat() + "Z", "fetched_at": ts, "is_duplicate": True, "duplicate_of": prev_real_id,
                })
                meta["markers"] += 1
                prev_ts = ts
                continue

            doc_id = ObjectId()
            h2h = {home: {b: prices[b][home] for b in ALL_BOOKS}, away: {b: prices[b][away] for b in ALL_BOOKS}}
            snaps.append({
                "_id": doc_id, "event_id": eid, "sport": sport, "sport_title": sport, "home": home, "away": away,
                "commence_time": commence.isoformat() + "Z", "fetched_at": ts, "is_duplicate": False,
                "book_odds": {"h2h": h2h, "totals": {"Over": {b: tot[b]["Over"] for b in ALL_BOOKS}, "Under": {b: tot[b]["Under"] for b in ALL_BOOKS}}},
            })
            meta["real"] += 1

            if prev_prices is not None:
                for b in ALL_BOOKS:
                    for sel in (home, away):
                        a0, a1 = prev_prices[b][sel], prices[b][sel]
                        if a0 == a1:
                            continue
                        is_sharp = b in SHARP
                        if is_sharp and first_sharp_move_ts is None:
                            first_sharp_move_ts = ts
                        if not is_sharp and first_soft_move_ts is None:
                            first_soft_move_ts = ts
                        (moves.append if keep_moves else (lambda _x: None))({
                            "event_id": eid, "sport": sport, "market": "h2h", "selection": sel, "book": b,
                            "prev_price": a0, "curr_price": a1, "prev_dec": _dec(a0), "curr_dec": _dec(a1),
                            "prev_prob": _implied(a0), "curr_prob": _implied(a1), "prob_change": _implied(a1) - _implied(a0),
                            "moved_up": a1 > a0, "price_changed": True, "prev_point": None, "curr_point": None,
                            "point_delta": None, "point_changed": False, "prev_odds": a0, "curr_odds": a1,
                            "is_sharp_book": is_sharp, "minutes_to_game": None, "timestamp": ts,
                            "seconds_since_prev": (ts - prev_ts).total_seconds() if prev_ts else None,
                        })
                        meta["movements"] += 1
            prev_prices, prev_real_id, prev_ts = prices, doc_id, ts
        meta["events"] += 1
        if first_sharp_move_ts and first_soft_move_ts:
            key = "sharp_first" if first_sharp_move_ts < first_soft_move_ts else ("soft_first" if first_soft_move_ts < first_sharp_move_ts else "tie")
            meta["labels"][key] += 1

    # The collector inserts chronologically (one poll cycle after another), so
    # parquet batches written by the archiver each span one or two dates.
    snaps.sort(key=lambda d: d["fetched_at"])
    moves.sort(key=lambda d: d["timestamp"])
    meta["now"] = now
    return snaps, moves, meta


def build_db(**kw):
    """Convenience: generate + load everything into a fresh mongomock database."""
    snaps, moves, meta = generate(**kw)
    db = mongomock.MongoClient()["trueodds_test"]
    for i in range(0, len(snaps), 5000):
        db["odds_snapshots"].insert_many(snaps[i:i + 5000])
    for i in range(0, len(moves), 5000):
        db["line_movements"].insert_many(moves[i:i + 5000])
    return db, meta
