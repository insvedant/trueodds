from datetime import datetime, timedelta, timezone

import mongomock

import ml.profile_predictions as prof


def populated_db(n_events=6, movements_per_event=40):
    db = mongomock.MongoClient()["t"]
    now = datetime.now(timezone.utc).replace(tzinfo=None)
    commence = (datetime.now(timezone.utc) + timedelta(hours=20)).isoformat().replace("+00:00", "Z")
    for i in range(n_events):
        eid = f"ev{i}"
        db["odds_snapshots"].insert_one({"event_id": eid, "sport": "basketball_nba", "home": "H", "away": "A", "commence_time": commence,
                                         "fetched_at": now, "is_duplicate": False,
                                         "book_odds": {"h2h": {"H": {"pinnacle": -110, "draftkings": 105}, "A": {"pinnacle": -110, "draftkings": -125}}}})
        db["line_movements"].insert_many([{"event_id": eid, "market": "h2h", "selection": "H", "book": "pinnacle", "is_sharp_book": j % 2 == 0,
                                           "timestamp": now - timedelta(minutes=j), "prob_change": 0.01, "moved_up": j % 3 == 0, "seconds_since_prev": 300.0}
                                          for j in range(movements_per_event)])
    return db


def test_it_reports_where_the_time_goes_and_attributes_documents_to_the_right_call():
    db = populated_db()
    lines = []
    result = prof.profile(db, client=None, sample=4, out=lines.append)
    text = "\n".join(lines)
    assert result["events"] == 4 and result["calls"] >= 4
    assert "line_movements.find" in text and "odds_snapshots.find_one" in text
    movement_line = next(l for l in lines if l.strip().startswith("line_movements.find"))
    assert float(movement_line.split()[-1]) == 40.0                      # every movement document of the event is pulled across the wire
    assert "database time" in text and "models (CPU)" in text and "total per event" in text


def test_it_never_writes_anything():
    db = populated_db()
    before = {name: db[name].count_documents({}) for name in db.list_collection_names()}
    prof.profile(db, client=None, sample=6, out=lambda *_: None)
    after = {name: db[name].count_documents({}) for name in db.list_collection_names()}
    assert before == after


def test_it_copes_with_nothing_to_profile():
    lines = []
    assert prof.profile(mongomock.MongoClient()["t"], client=None, sample=5, out=lines.append) == {}
    assert any("No events" in l for l in lines)


def test_round_trip_timing_returns_one_reading_per_ping():
    class Admin:
        def command(self, name): assert name == "ping"
    class Client:
        admin = Admin()
    pings = prof.round_trips(Client(), n=7)
    assert len(pings) == 7 and all(p >= 0 for p in pings)
