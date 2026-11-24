#!/usr/bin/env python3
"""Gate for events + rsvps: host pinning, date/limit hook, hidden events, going_count, private RSVP lists.
Run: PB_BASE=... PB_TOKEN=<superuser> python3 verify_events.py   (hooks must be loaded)."""
import datetime as dt
from vt_common import call, admin_token, Gate, Users

admin = admin_token()
g, users = Gate("events + rsvps"), Users(admin)
E = "/api/collections/events/records"
R = "/api/collections/rsvps/records"
U = "/api/collections/users/records"


def when(days=0, hours=0):
    return (dt.datetime.now(dt.timezone.utc) + dt.timedelta(days=days, hours=hours)).strftime("%Y-%m-%d %H:%M:%S.000Z")


def verify(u):
    return call("PATCH", f"{U}/{u['id']}", {"verified": True}, admin)[0] == 200


def grid_ok(v):
    return abs(round(v / 0.05) * 0.05 - v) < 1e-6


H, M, X, Z = users.make("host"), users.make("member"), users.make("unver"), users.make("host2")
g.check("verify host, member, host2", verify(H) and verify(M) and verify(Z))
made = []


def ev(who, **kw):
    body = {"title": "Alumni drinks", "start": when(3), "host": who["id"]}
    body.update(kw)
    return call("POST", E, body, who["token"])


# --- positive controls
st, e1 = ev(H, end=when(3, 3), city="Amsterdam", place="Cafe", lat=52.370216, lng=4.895168, description="hello")
g.check("verified host creates an event (positive control)", st == 200, f"{st} {e1}")
eid = e1.get("id")
made.append(f"{E}/{eid}")
g.check("event lat/lng stored snapped", grid_ok(e1.get("lat", 9)) and grid_ok(e1.get("lng", 9)), f"{e1.get('lat')},{e1.get('lng')}")
g.check("hidden false, going_count 0 on create", e1.get("hidden") is False and e1.get("going_count") == 0, e1)
st, lst = call("GET", E, token=M["token"])
g.check("another member lists the event", st == 200 and any(i["id"] == eid for i in lst.get("items", [])), st)
st, _ = call("GET", f"{E}/{eid}", token=M["token"])
g.check("another member views the event", st == 200, st)
st, lst = call("GET", E)
g.check("anonymous lists 0 events", st in (200, 403) and not lst.get("items"), st)
st, _ = call("POST", E, {"title": "x", "start": when(3), "host": X["id"]}, X["token"])
g.rejected("unverified member cannot create an event", st)

# --- attacks on create (each rejected)
attacks = [
    ("start in 1990", dict(start="1990-01-01 10:00:00.000Z")),
    ("start +2 years", dict(start=when(730))),
    ("start 2 h in the past", dict(start=when(0, -2))),
    ("end before start", dict(end=when(2))),
    ("end 30 days after start", dict(end=when(33))),
    ("lat 999", dict(lat=999, lng=4)),
    ("lng -500", dict(lat=50, lng=-500)),
    ("host = other member", dict(host=M["id"])),
    ("hidden=true on create", dict(hidden=True)),
    ("going_count=500 on create", dict(going_count=500)),
    ("title 121 chars", dict(title="T" * 121)),
    ("description 2001 chars", dict(description="d" * 2001)),
    ("empty title", dict(title="")),
    ("no start", dict(start="")),
]
for label, kw in attacks:
    st, r = ev(Z, **kw)
    if st == 200:
        made.append(f"{E}/{r.get('id')}")
    g.check(f"create with {label} rejected (4xx)", 400 <= st < 500, f"{st}")

# hook grace: just under an hour ago is allowed (positive control for the 1 h rule)
st, r = ev(Z, start=when(0, -0.5))
g.check("start 30 min ago still allowed (grace)", st == 200, st)
made.append(f"{E}/{r.get('id')}") if st == 200 else None
# edge: title of exactly 120 chars and XSS payload stored verbatim
payload = "<img src=x onerror=1>"
st, xs = ev(Z, title=payload)
g.check("title with HTML payload accepted", st == 200, st)
if st == 200:
    made.append(f"{E}/{xs.get('id')}")
    st, back = call("GET", f"{E}/{xs['id']}", token=M["token"])
    g.check("HTML payload round-trips unchanged (escaping is a front-end duty, NOTE)", back.get("title") == payload, back.get("title"))
# 3 so far for Z: grace one + xss + ... count what Z has made
st, lst = call("GET", E + "?perPage=100", token=Z["token"])
mine = [i for i in lst.get("items", []) if i.get("host") == Z["id"]]
while len(mine) < 3:
    st, r = ev(Z, title=f"fill {len(mine)}")
    if st == 200:
        made.append(f"{E}/{r.get('id')}")
        mine.append(r)
    else:
        break
g.check("host2 reached 3 events in 24 h", len(mine) == 3, len(mine))
st, _ = ev(Z, title="fourth")
g.check("4th event in a day rejected", 400 <= st < 500, st)
st, _ = ev(H, title="host1 second")
g.check("a different host is not limited by host2's cap (positive control)", st == 200, st)
if st == 200:
    pass

# --- updates / deletes
st, _ = call("PATCH", f"{E}/{eid}", {"title": "hijack"}, M["token"])
g.rejected("another member cannot PATCH the event", st)
st, _ = call("DELETE", f"{E}/{eid}", token=M["token"])
g.rejected("another member cannot DELETE the event", st)
st, _ = call("PATCH", f"{E}/{eid}", {"title": "Renamed"}, H["token"])
g.check("host can PATCH own title (positive control)", st == 200, st)
for label, body in (("host change", {"host": M["id"]}), ("hidden", {"hidden": True}), ("going_count", {"going_count": 99})):
    st, _ = call("PATCH", f"{E}/{eid}", body, H["token"])
    g.rejected(f"host cannot change {label}", st)
st, bad = call("PATCH", f"{E}/{eid}", {"start": "1990-01-01 10:00:00.000Z"}, H["token"])
g.check("host PATCH start to 1990 (update hook has no date check) rejected", 400 <= st < 500, st)

# --- RSVPs
st, rv = call("POST", R, {"event": eid, "user": M["id"]}, M["token"])
g.check("member RSVPs (positive control)", st == 200, f"{st} {rv}")
rid = rv.get("id")
st, cur = call("GET", f"{E}/{eid}", token=H["token"])
g.check("going_count is 1 after RSVP", cur.get("going_count") == 1, cur.get("going_count"))
st, _ = call("POST", R, {"event": eid, "user": M["id"]}, M["token"])
g.check("duplicate RSVP -> 400", st == 400, st)
st, _ = call("POST", R, {"event": eid, "user": H["id"]}, M["token"])
g.rejected("RSVP as another user (user=victim) rejected", st)
st, _ = call("PATCH", f"{R}/{rid}", {"user": H["id"]}, M["token"])
g.check("RSVP update is not allowed", st in (400, 403, 404), st)
st, lst = call("GET", R, token=H["token"])
g.check("host (another member) lists 0 RSVP rows: attendee list hidden", st == 200 and lst.get("totalItems") == 0, f"{st} {lst.get('totalItems')}")
st, _ = call("GET", f"{R}/{rid}", token=H["token"])
g.rejected("host cannot view someone's RSVP by id", st)
st, lst = call("GET", R, token=M["token"])
g.check("member lists own RSVP", st == 200 and lst.get("totalItems") == 1, lst.get("totalItems"))
st, _ = call("DELETE", f"{R}/{rid}", token=H["token"])
g.rejected("another member cannot delete the RSVP", st)
st, _ = call("DELETE", f"{R}/{rid}", token=M["token"])
g.check("member deletes own RSVP", st in (200, 204), st)
st, cur = call("GET", f"{E}/{eid}", token=H["token"])
g.check("going_count is 0 after delete", cur.get("going_count") == 0, cur.get("going_count"))

# ended event: the create hook refuses past dates, so seed one as superuser by creating then moving it back
st, past = call("POST", E, {"title": "past", "start": when(2), "end": when(2, 1), "host": H["id"]}, admin)
if st == 200:
    made.append(f"{E}/{past['id']}")
    st, _ = call("PATCH", f"{E}/{past['id']}", {"start": when(0, -30), "end": when(0, -29)}, admin)
g.check("superuser can seed an ended event", st == 200, st)
if st == 200:
    st, _ = call("POST", R, {"event": past["id"], "user": M["id"]}, M["token"])
    g.rejected("RSVP to an ended event rejected", st)

# hidden event
st, hid = call("POST", E, {"title": "hidden", "start": when(5), "host": H["id"], "hidden": True}, admin)
g.check("superuser can create a hidden event", st == 200, f"{st} {hid}")
if st == 200:
    made.append(f"{E}/{hid['id']}")
    st, _ = call("POST", R, {"event": hid["id"], "user": M["id"]}, M["token"])
    g.rejected("RSVP to a hidden event rejected", st)
    st, lst = call("GET", E + "?perPage=100", token=M["token"])
    g.check("hidden event not listed for members", not any(i["id"] == hid["id"] for i in lst.get("items", [])), st)
    st, _ = call("GET", f"{E}/{hid['id']}", token=M["token"])
    g.rejected("hidden event cannot be viewed by id", st)

users.cleanup(made)
g.done()
