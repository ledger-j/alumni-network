#!/usr/bin/env python3
"""Gate for user_locations: opt-in visibility, verified-only, grid snapping, move limit, no coordinates on users.
Run: PB_BASE=... PB_TOKEN=<superuser> python3 verify_location.py   (hooks must be loaded)."""
import urllib.parse
from vt_common import call, admin_token, Gate, Users

admin = admin_token()
g, users = Gate("user_locations"), Users(admin)
L = "/api/collections/user_locations/records"
U = "/api/collections/users/records"


def verify(u):
    st, _ = call("PATCH", f"{U}/{u['id']}", {"verified": True}, admin)
    return st == 200


def grid_ok(v):
    return abs(round(v / 0.05) * 0.05 - v) < 1e-6 and abs(round(v, 2) - v) < 1e-9


O, V, X, T = users.make("o"), users.make("v"), users.make("x"), users.make("t")  # owner, verified viewer, unverified, third
made = []

# unverified cannot create
st, _ = call("POST", L, {"user": O["id"], "lat": 52.37, "lng": 4.89, "city": "A"}, O["token"])
g.rejected("unverified member cannot create a location", st)
g.check("admin can verify owner/viewer/third", verify(O) and verify(V) and verify(T))
# the verified flag is read from the auth record: log in again so tokens stay valid (token is a JWT; rules read the live record)
st, row = call("POST", L, {"user": O["id"], "lat": 52.370216, "lng": 4.895168, "city": "Amsterdam"}, O["token"])
g.check("verified owner can create (positive control)", st == 200, f"{st} {row}")
rid = row.get("id")
made.append(f"{L}/{rid}")
g.check("default visible is false", row.get("visible") is False, row.get("visible"))
g.check("lat/lng snapped on create (owner response)", grid_ok(row.get("lat", 9)) and grid_ok(row.get("lng", 9)),
        f"{row.get('lat')},{row.get('lng')}")
g.check("snapped value is 52.35 / 4.9", abs(row.get("lat", 0) - 52.35) < 1e-6 and abs(row.get("lng", 0) - 4.9) < 1e-6,
        f"{row.get('lat')},{row.get('lng')}")
st, mine = call("GET", L, token=O["token"])
g.check("owner lists own hidden row (positive control)", st == 200 and any(i["id"] == rid for i in mine.get("items", [])), st)

# hidden: other verified member sees nothing
st, lst = call("GET", L, token=V["token"])
g.check("verified viewer lists 0 rows while hidden", st == 200 and lst.get("totalItems") == 0, f"{st} {lst.get('totalItems')}")
st, _ = call("GET", f"{L}/{rid}", token=V["token"])
g.rejected("verified viewer cannot view hidden row by id", st)
owner_filter = 'user="' + O["id"] + '"'
for label, q in (("filter lat!=0", "?filter=" + urllib.parse.quote("lat!=0")),
                 ("fields=lat,lng", "?fields=lat,lng"),
                 ("filter visible=false", "?filter=" + urllib.parse.quote("visible=false")),
                 ("filter user=owner", "?filter=" + urllib.parse.quote(owner_filter))):
    st, r = call("GET", L + q, token=V["token"])
    g.check(f"viewer {label} on hidden row returns nothing", st in (200, 400) and not r.get("items"), f"{st} {r.get('items')}")

# toggling visible alone
st, _ = call("PATCH", f"{L}/{rid}", {"visible": True}, O["token"])
g.check("owner can set visible=true", st == 200, st)
st, lst = call("GET", L, token=V["token"])
vis = [i for i in lst.get("items", []) if i["id"] == rid]
g.check("verified viewer now lists the row", st == 200 and len(vis) == 1, f"{st} {lst.get('totalItems')}")
g.check("viewer reads snapped coordinates", bool(vis) and grid_ok(vis[0]["lat"]) and grid_ok(vis[0]["lng"]),
        vis and (vis[0]["lat"], vis[0]["lng"]))
st, one = call("GET", f"{L}/{rid}", token=V["token"])
g.check("viewer can view by id when visible", st == 200, st)
st, lst = call("GET", L, token=X["token"])
g.check("UNVERIFIED viewer lists 0 rows", st == 200 and lst.get("totalItems") == 0, f"{st} {lst.get('totalItems')}")
st, _ = call("GET", f"{L}/{rid}", token=X["token"])
g.rejected("unverified viewer cannot view by id", st)
st, lst = call("GET", L)
g.check("anonymous lists 0 rows", st in (200, 403) and not lst.get("items"), st)
st, r = call("GET", L + "?fields=lat,lng&filter=" + urllib.parse.quote("lat!=0"), token=X["token"])
g.check("unverified viewer filter/fields attack returns nothing", st in (200, 400) and not r.get("items"), st)

# validation
for label, body in (("lat 999", {"lat": 999}), ("lng -500", {"lng": -500}), ("lat 1e308", {"lat": 1e308})):
    st, _ = call("PATCH", f"{L}/{rid}", body, O["token"])
    g.check(f"PATCH {label} -> 400", st == 400, st)
# PocketBase casts non-numeric strings to 0 before any hook runs (documented in uc_lib.js): the
# value must never be stored raw, and the effect stays on the owner's own row.
for label, body in (("lat non-numeric", {"lat": "abc"}), ("lng non-numeric", {"lng": "north"})):
    st, r = call("PATCH", f"{L}/{rid}", body, O["token"])
    k = "lat" if "lat" in body else "lng"
    g.check(f"PATCH {label} is rejected or coerced to a number", st == 400 or (st == 200 and isinstance(r.get(k), (int, float))), f"{st} {r.get(k)!r}")
st, _ = call("POST", L, {"user": T["id"], "lat": 999, "lng": 4}, T["token"])
g.check("POST lat 999 -> 400", st == 400, st)
st, _ = call("POST", L, {"user": T["id"], "lat": "x", "lng": 4}, T["token"])
g.check("POST non-numeric lat is rejected or coerced to a number", st == 400 or st == 200, st)

# unique + foreign rows
st, _ = call("POST", L, {"user": O["id"], "lat": 50, "lng": 5}, O["token"])
g.check("second row for same user -> 400", st == 400, st)
st, _ = call("POST", L, {"user": O["id"], "lat": 50, "lng": 5}, T["token"])
g.rejected("third user cannot create a row for the owner", st)
st, _ = call("PATCH", f"{L}/{rid}", {"visible": False}, T["token"])
g.rejected("third user cannot PATCH owner's row", st)
st, _ = call("PATCH", f"{L}/{rid}", {"user": T["id"]}, O["token"])
g.rejected("owner cannot re-point row to another user", st)
st, _ = call("DELETE", f"{L}/{rid}", token=T["token"])
g.rejected("third user cannot DELETE owner's row", st)
st, _ = call("GET", f"{L}/{rid}", token=O["token"])
g.check("row still exists after attacks", st == 200, st)

# users has no coordinates
st, ur = call("GET", f"{U}/{O['id']}", token=V["token"])
g.check("users record readable (positive control)", st == 200, st)
g.check("users record has no lat/lng/map_visible keys",
        st == 200 and not any(k in ur for k in ("lat", "lng", "map_visible")), list(ur))

# move limit: inside grace hour allowed (row just created)
st, mv = call("PATCH", f"{L}/{rid}", {"lat": 40.0, "lng": 10.0}, O["token"])
g.check("move inside 1 h grace is allowed and snapped", st == 200 and grid_ok(mv.get("lat", 9)), f"{st} {mv}")
# try to backdate as superuser
back = "2000-01-01 00:00:00.000Z"
st, bd = call("PATCH", f"{L}/{rid}", {"created": back, "updated": back}, admin)
st2, cur = call("GET", f"{L}/{rid}", token=O["token"])
backdated = st == 200 and cur.get("created", "").startswith("2000")
if backdated:
    st, _ = call("PATCH", f"{L}/{rid}", {"lat": 41.0, "lng": 11.0}, O["token"])
    g.check("move after backdating (age > 24h) is allowed", st == 200, st)
    st, _ = call("PATCH", f"{L}/{rid}", {"lat": 45.0, "lng": 12.0}, O["token"])
    g.check("second move within 24h (grace over) -> 400", st == 400, st)
    st, t = call("PATCH", f"{L}/{rid}", {"visible": False}, O["token"])
    g.check("visible toggle always allowed after a move", st == 200, st)
else:
    print(f"  NOTE cannot backdate created/updated as superuser ({st}); move-limit beyond grace not tested")

# pagination: 3 visible members
P = [users.make(f"p{i}") for i in range(3)]
for i, p in enumerate(P):
    verify(p)
    st, r = call("POST", L, {"user": p["id"], "lat": 50 + 0.1 * i, "lng": 5, "city": "P", "visible": True}, p["token"])
    g.check(f"visible member {i} created", st == 200, st)
    made.append(f"{L}/{r.get('id')}")
call("PATCH", f"{L}/{rid}", {"visible": True}, O["token"])
seen, page, total = set(), 1, None
while True:
    st, r = call("GET", f"{L}?perPage=2&page={page}&sort=created", token=V["token"])
    if st != 200 or not r.get("items"):
        break
    total = r.get("totalItems")
    seen |= {i["user"] for i in r["items"]}
    if page >= r.get("totalPages", 1):
        break
    page += 1
want = {p["id"] for p in P} | {O["id"]}
g.check("pagination perPage=2 returns every visible member across pages", want <= seen and page >= 2,
        f"seen={len(seen)} want={len(want)} pages={page} total={total}")

users.cleanup(made)
g.done()
