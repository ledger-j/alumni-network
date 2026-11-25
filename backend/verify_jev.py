#!/usr/bin/env python3
"""Gate for Jev: the route /api/uc/jev (hook backend/pb_hooks/uc_jev.pb.js) and the
jev_memory collection (backend/init_schema.py).

Without GEMINI_API_KEY (the default on the throwaway PocketBase) the route must be OFF:
401 for anonymous callers, 501 for members. Memory rows can only be written by the hook
(here: by the superuser); a member sees and deletes only their own rows. This gate never
sets a key and never reaches Google. Run:
  PB_BASE=... PB_IDENTITY=... PB_PASSWORD=... python3 verify_jev.py
"""
from vt_common import call, admin_token, Gate, Users

admin = admin_token()
g, users = Gate("Jev assistant (route off by default + memory rules)"), Users(admin)
A, B = users.make("jevA"), users.make("jevB")
R = "/api/uc/jev"
C = "/api/collections/jev_memory/records"

# --- route
st, _ = call("POST", R, {"text": "go to the map", "lang": "en"})
g.check("anonymous caller is refused (401)", st == 401, st)
st, r = call("POST", R, {"text": "what can I do here?", "lang": "en"}, A["token"])
if st == 501:
    g.check("member gets 501 while no key is configured", True)
    g.check("the refusal says Jev is not switched on yet", "not switched on" in str(r.get("message", "")), r)
else:
    print(f"  NOTE server seems to have GEMINI_API_KEY set (got {st}); 501 checks skipped")
st, _ = call("GET", R, token=A["token"])
g.check("GET is not routed (404/405)", st in (404, 405), st)

# --- memory rows: written only server-side (superuser here stands in for the hook)
st, a1 = call("POST", C, {"user": A["id"], "kind": "fact", "text": "Likes events in Berlin"}, admin)
g.check("superuser can create A's memory row", st == 200, f"{st} {a1}")
st, a2 = call("POST", C, {"user": A["id"], "kind": "preference", "text": "Prefers Dutch"}, admin)
g.check("superuser can create A's second row", st == 200, f"{st} {a2}")
st, b1 = call("POST", C, {"user": B["id"], "kind": "fact", "text": "Works in audit"}, admin)
g.check("superuser can create B's memory row", st == 200, f"{st} {b1}")

st, _ = call("POST", C, {"user": A["id"], "kind": "fact", "text": "forged"}, A["token"])
g.rejected("member cannot create a memory row through the API", st)
st, _ = call("POST", C, {"user": B["id"], "kind": "fact", "text": "forged"}, A["token"])
g.rejected("member cannot plant a memory row for someone else", st)
st, _ = call("PATCH", f"{C}/{a1['id']}", {"text": "rewritten"}, A["token"])
g.rejected("member cannot edit their own memory row (hook only)", st)

st, r = call("GET", C + "?perPage=50", token=A["token"])
ids = [x["id"] for x in r.get("items", [])]
g.check("A lists exactly their own 2 rows", st == 200 and sorted(ids) == sorted([a1["id"], a2["id"]]), f"{st} {ids}")
st, r = call("GET", C + "?perPage=50", token=B["token"])
ids = [x["id"] for x in r.get("items", [])]
g.check("B lists only their own row", st == 200 and ids == [b1["id"]], f"{st} {ids}")
st, r = call("GET", C + "?perPage=50")
g.check("anonymous lists nothing", st in (200, 401, 403) and not r.get("items"), f"{st} {r}")
st, _ = call("GET", f"{C}/{b1['id']}", token=A["token"])
g.rejected("A cannot view B's row", st)
st, _ = call("DELETE", f"{C}/{b1['id']}", token=A["token"])
g.rejected("A cannot delete B's row", st)
st, _ = call("GET", f"{C}/{b1['id']}", token=B["token"])
g.check("B's row still exists after A's attempt", st == 200, st)

st, _ = call("GET", f"{C}/{a1['id']}", token=A["token"])
g.check("A can view their own row", st == 200, st)
st, _ = call("DELETE", f"{C}/{a1['id']}", token=A["token"])
g.check("A can delete their own row", st == 204, st)
st, _ = call("GET", f"{C}/{a1['id']}", token=admin)
g.check("the deleted row is gone", st == 404, st)

# --- cascade: deleting the member removes their memory
users.cleanup()
st, _ = call("GET", f"{C}/{a2['id']}", token=admin)
g.check("memory rows are removed with the account (cascade)", st == 404, st)
g.done()
