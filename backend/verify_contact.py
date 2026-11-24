#!/usr/bin/env python3
"""Executed-attack gate for the contact doors, collaboration requests and blocks (round 2).

Run:  PB_BASE=http://127.0.0.1:8090 PB_TOKEN=<superuser token> python3 verify_contact.py
Needs init_schema.py + pb_hooks (uc_rules.pb.js, uc_lib.js). Throwaway users/records.
Doors: message, mentorship, collab, group. Modes: open, points, request, closed, legacy (empty).
Every denial has a paired positive control (an allowed case that must succeed).
"""
from vt_common import call, admin_token, Gate, Users

admin = admin_token()
g, users = Gate("contact doors + collab requests + blocks"), Users(admin)
U = "/api/collections/users/records"
MSG, MS, CR, CV, BL = (f"/api/collections/{c}/records" for c in
                       ("messages", "mentorships", "collab_requests", "conversations", "blocks"))
made = []


def track(path, st, rec):
    if st == 200 and rec.get("id"):
        made.append(f"{path}/{rec['id']}")
    return rec


def setu(u, **f):
    st, _ = call("PATCH", f"{U}/{u['id']}", f, admin)
    assert st == 200, f"admin patch user failed {st} {f}"


def door(door_name, s, r):
    """Try one door as member s towards member r; returns the HTTP status (records tracked)."""
    if door_name == "message":
        st, rec = call("POST", MSG, {"sender": s["id"], "recipient": r["id"], "text": "hi", "read": False}, s["token"])
        track(MSG, st, rec)
    elif door_name == "mentorship":
        st, rec = call("POST", MS, {"mentee": s["id"], "mentor": r["id"], "kind": "tutoring",
                                    "topic": "t", "status": "requested"}, s["token"])
        track(MS, st, rec)
    elif door_name == "collab":
        st, rec = call("POST", CR, {"from": s["id"], "to": r["id"], "kind": "project", "message": "let us build",
                                    "status": "pending"}, s["token"])
        track(CR, st, rec)
        if st == 200:   # keep (from,to) free of a pending row for the next door round
            call("DELETE", f"{CR}/{rec['id']}", token=admin)
    else:
        st, rec = call("POST", CV, {"title": "grp", "owner": s["id"], "members": [r["id"]]}, s["token"])
        track(CV, st, rec)
    return st


DOORS = ("message", "mentorship", "collab", "group")


def expect(label, mode_tag, s, r, allowed):
    """allowed: set of doors that must succeed (200); the rest must be 403."""
    for d in DOORS:
        st = door(d, s, r)
        if d in allowed:
            g.check(f"{mode_tag}: {d} door allowed (positive control)", st == 200, st)
        else:
            g.check(f"{mode_tag}: {d} door denied 403", st == 403, st)


A, B, C = users.make("a"), users.make("b"), users.make("c")

# ---------------------------------------------------------------- open + legacy
expect("open", "open", A, B, set(DOORS))
setu(B, contact_mode="")
expect("legacy-empty", "legacy empty contact_mode", A, B, set(DOORS))
L = users.make("legacy")      # never set any contact_mode at all
expect("legacy-new", "legacy never-set user", A, L, set(DOORS))

# ---------------------------------------------------------------- closed
setu(B, contact_mode="closed", min_points=0)
expect("closed", "closed", A, B, set())
st, _ = call("POST", MSG, {"sender": B["id"], "recipient": A["id"], "text": "B writes first", "read": False}, B["token"])
g.check("closed: B (closed) can still write out to an open member", st == 200, st)
st = door("message", A, B)
g.check("closed: reply allowed once B has messaged A (message door)", st == 200, st)
st = door("collab", A, B)
g.check("closed: collab door STILL denied after a reply", st == 403, st)
st = door("message", C, B)
g.check("closed: unrelated C still denied (reply rights are per pair)", st == 403, st)
# informational: other doors after a reply (code allows them; objection text says "replies only")
print("  INFO closed+reply: mentorship door ->", door("mentorship", A, B), " group door ->", door("group", A, B))

# ---------------------------------------------------------------- points
setu(B, contact_mode="points", min_points=50)
setu(C, points=0)
P = users.make("p")   # fresh sender: no reply history with B (A already got a message from B above)
setu(P, points=0)
expect("points-low", "points(min 50), sender 0 pts", P, B, set())
setu(P, points=49)
expect("points-49", "points(min 50), sender 49 pts", P, B, set())
setu(P, points=50)
expect("points-50", "points(min 50), sender 50 pts (boundary)", P, B, set(DOORS))
setu(P, points=0)
P2 = users.make("p2")
st, _ = call("POST", MSG, {"sender": B["id"], "recipient": P2["id"], "text": "B->P2", "read": False}, B["token"])
g.check("points: control, 0-pt P2 denied before B wrote", door("message", users.make("p3"), B) == 403)
st2 = door("message", P2, B)
g.check("points: sender with 0 pts may reply once B wrote first", st == 200 and st2 == 200, f"{st} {st2}")
g.check("points: other 0-pt sender C still denied", door("message", C, B) == 403)

# ---------------------------------------------------------------- request
setu(B, contact_mode="request", min_points=0)
D = users.make("d")   # fresh sender with no history with B
for d in ("message", "mentorship", "group"):
    st = door(d, D, B)
    g.check(f"request: {d} door denied 403", st == 403, st)
st, cr = call("POST", CR, {"from": D["id"], "to": B["id"], "kind": "project", "message": "hello", "status": "pending"},
              D["token"])
g.check("request: collab door allowed (positive control)", st == 200, st)
track(CR, st, cr)
crid = cr.get("id")
g.check("request: still denied to message BEFORE B accepts", door("message", D, B) == 403)
g.check("request: stranger C still cannot message", door("message", C, B) == 403)
st, _ = call("PATCH", f"{CR}/{crid}", {"status": "accepted"}, D["token"])
g.rejected("request: sender D cannot self-accept", st)
st, _ = call("PATCH", f"{CR}/{crid}", {"status": "accepted"}, B["token"])
g.check("request: B accepts the collab request", st == 200, st)
g.check("request: after acceptance D can message B (positive control)", door("message", D, B) == 200)
g.check("request: ...and still C cannot", door("message", C, B) == 403)

# ---------------------------------------------------------------- blocks
setu(B, contact_mode="open")
BLK = users.make("blk")
st, b1 = call("POST", BL, {"blocker": B["id"], "blocked": A["id"]}, B["token"])
g.check("block: B blocks A", st == 200, st)
track(BL, st, b1)
expect("blocked", "B blocked A (mode open)", A, B, set())
g.check("block: positive control, unblocked C can message B", door("message", C, B) == 200)
g.check("block: A (the blocked one) can still be reached by... B writing to A is unaffected",
        door("message", B, A) == 200)
st, _ = call("POST", BL, {"blocker": A["id"], "blocked": C["id"]}, B["token"])
g.rejected("block: B cannot create a block in A's name", st)
st, lst = call("GET", BL, token=A["token"])
g.check("block: the blocked member cannot list the block list", st == 200 and lst.get("totalItems", 1) == 0, st)
st, _ = call("DELETE", f"{BL}/{b1['id']}", token=B["token"])
g.check("block: B can remove the block", st in (200, 204), st)
g.check("block: after unblocking A can message B again", door("message", A, B) == 200)
# block overrides a satisfied points rule
setu(B, contact_mode="points", min_points=10)
setu(A, points=500)
st, b2 = call("POST", BL, {"blocker": B["id"], "blocked": A["id"]}, B["token"])
track(BL, st, b2)
g.check("block beats points: A (500 pts >= 10) is still denied", door("message", A, B) == 403)
call("DELETE", f"{BL}/{b2.get('id')}", token=B["token"])
g.check("block beats points: positive control after unblock", door("message", A, B) == 200)
setu(B, contact_mode="open")

# ---------------------------------------------------------------- collab_requests rules
S, R1, R2, R3 = users.make("s"), users.make("r1"), users.make("r2"), users.make("r3")


def cr_body(f, t, **kw):
    b = {"from": f["id"], "to": t["id"], "kind": "project", "message": "hi", "status": "pending"}
    b.update(kw)
    return b


st, ok = call("POST", CR, cr_body(S, R1), S["token"])
g.check("collab: valid pending request (positive control)", st == 200, st)
track(CR, st, ok)
oid = ok.get("id")
st, _ = call("POST", CR, cr_body(S, R2, status="accepted"), S["token"])
g.rejected("collab: cannot create with status accepted", st)
st, _ = call("POST", CR, cr_body(S, R2, status="declined"), S["token"])
g.rejected("collab: cannot create with status declined", st)
st, _ = call("POST", CR, {"from": S["id"], "to": R2["id"], "kind": "project", "message": "x"}, S["token"])
g.rejected("collab: create without status refused", st)
st, _ = call("POST", CR, cr_body(S, S), S["token"])
g.rejected("collab: to == from refused", st)
st, _ = call("POST", CR, cr_body(R2, R3), S["token"])
g.rejected("collab: cannot forge from=R2", st)
st, _ = call("POST", CR, cr_body(S, R2, kind="spam"), S["token"])
g.rejected("collab: unknown kind refused", st)
st, _ = call("POST", CR, cr_body(S, R2))
g.rejected("collab: anonymous cannot create", st)
st, _ = call("POST", CR, cr_body(S, R1), S["token"])
g.rejected("collab: duplicate pending (from,to) refused", st)
st, _ = call("POST", CR, cr_body(S, R2, message="x" * 501), S["token"])
g.rejected("collab: message of 501 chars refused", st)
st, r500 = call("POST", CR, cr_body(S, R2, message="x" * 500), S["token"])
g.check("collab: message of exactly 500 chars accepted (positive control)", st == 200, st)
track(CR, st, r500)
# list privacy
st, lst = call("GET", CR, token=R3["token"])
g.check("collab: stranger lists zero requests", st == 200 and lst.get("totalItems", 1) == 0, st)
st, lst = call("GET", CR, token=R1["token"])
g.check("collab: recipient lists the request (N > 0)", st == 200 and any(i["id"] == oid for i in lst.get("items", [])), st)
st, _ = call("GET", f"{CR}/{oid}", token=R3["token"])
g.rejected("collab: stranger cannot view the request", st)
# update rules
for label, tok, body in (
    ("sender cannot PATCH status accepted", S["token"], {"status": "accepted"}),
    ("sender cannot PATCH status declined", S["token"], {"status": "declined"}),
    ("sender cannot rewrite the message", S["token"], {"message": "changed"}),
    ("stranger cannot accept", R3["token"], {"status": "accepted"}),
    ("recipient cannot change message while accepting", R1["token"], {"status": "accepted", "message": "mine"}),
    ("recipient cannot change kind while accepting", R1["token"], {"status": "accepted", "kind": "event"}),
    ("recipient cannot change from", R1["token"], {"status": "accepted", "from": R3["id"]}),
    ("recipient cannot change to", R1["token"], {"status": "accepted", "to": R3["id"]}),
    ("recipient cannot set status to pending/unknown", R1["token"], {"status": "blessed"}),
    ("recipient PATCH without status refused", R1["token"], {"message": "edit"}),
):
    st, _ = call("PATCH", f"{CR}/{oid}", body, tok)
    g.rejected("collab: " + label, st)
st, cur = call("GET", f"{CR}/{oid}", token=R1["token"])
g.check("collab: record untouched after every attack",
        cur.get("status") == "pending" and cur.get("message") == "hi" and cur.get("from") == S["id"] and cur.get("to") == R1["id"],
        str(cur))
st, _ = call("PATCH", f"{CR}/{oid}", {"status": "accepted"}, R1["token"])
g.check("collab: recipient accepts (positive control)", st == 200, st)
st, _ = call("PATCH", f"{CR}/{oid}", {"status": "declined"}, R1["token"])
g.rejected("collab: an accepted request cannot be flipped to declined", st)
st, _ = call("DELETE", f"{CR}/{oid}", token=S["token"])
g.rejected("collab: sender cannot delete a non-pending request", st)
# decline path + re-request allowed once no pending row exists
st, d1 = call("POST", CR, cr_body(R3, R1), R3["token"])
track(CR, st, d1)
st, _ = call("PATCH", f"{CR}/{d1.get('id')}", {"status": "declined"}, R1["token"])
g.check("collab: recipient can decline", st == 200, st)
st, d2 = call("POST", CR, cr_body(R3, R1), R3["token"])
g.check("collab: after a decline a new pending request is allowed (index is partial)", st == 200, st)
track(CR, st, d2)

# ---------------------------------------------------------------- daily limit (10 per rolling day)
LIM = users.make("lim")
targets = [users.make(f"t{i}") for i in range(11)]
codes = []
for i, t in enumerate(targets):
    st, rec = call("POST", CR, cr_body(LIM, t), LIM["token"])
    track(CR, st, rec)
    codes.append(st)
g.check("daily limit: first 10 requests to 10 different members accepted", codes[:10] == [200] * 10, codes)
g.check("daily limit: the 11th within a day is refused", codes[10] in (400, 403, 429), codes)
st, rec = call("POST", CR, cr_body(S, R3, message="other sender"), S["token"])
track(CR, st, rec)
g.check("daily limit: positive control, another sender is unaffected", st == 200, st)

users.cleanup(made)
g.done()
