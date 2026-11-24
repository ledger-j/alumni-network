#!/usr/bin/env python3
"""Executed-attack gate for status points (the hard slice): self-award, ledger tampering,
farming, double award, caps, rings.

Run:  PB_BASE=http://127.0.0.1:8090 PB_TOKEN=<superuser token> python3 verify_points.py
Needs init_schema.py + pb_hooks and a server started with UC_MIN_ACTIVE_HOURS=0.0006 (~2 s):
a close less than ~2 s after `active` earns nothing, after a 3.5 s sleep it does.
Throwaway users/records, removed at the end.
"""
import datetime, threading, time
from vt_common import call, admin_token, Gate, Users

admin = admin_token()
g, users = Gate("status points (server-written, anti-farming)"), Users(admin)
U = "/api/collections/users/records"
MS = "/api/collections/mentorships/records"
LG = "/api/collections/points_ledger/records"
SLEEP = 3.5


def mk(tag):
    return users.make(tag, role="alumnus")


def ledger(uid):
    st, r = call("GET", f"{LG}?perPage=200&filter=user%3D%27{uid}%27", token=admin)
    return r.get("items", []) if st == 200 else []


def pts(uid):
    st, r = call("GET", f"{U}/{uid}", token=admin)
    return r.get("points") or 0


def new_ms(mentee, mentor, kind="tutoring"):
    st, r = call("POST", MS, {"mentee": mentee["id"], "mentor": mentor["id"], "kind": kind, "topic": "t",
                              "status": "requested"}, mentee["token"])
    assert st == 200, f"cannot create mentorship {st} {r}"
    return r["id"]


def activate(mid, mentor):
    st, _ = call("PATCH", f"{MS}/{mid}", {"status": "active"}, mentor["token"])
    assert st == 200, f"cannot activate {st}"


def close(mid, who):
    return call("PATCH", f"{MS}/{mid}", {"status": "closed"}, who["token"])[0]


def full(mentee, mentor, kind="tutoring"):
    mid = new_ms(mentee, mentor, kind)
    activate(mid, mentor)
    return mid


def consistent(label, u):
    rows = ledger(u["id"])
    g.check(f"{label}: users.points equals the ledger sum", pts(u["id"]) == sum(r["delta"] for r in rows),
            f"points={pts(u['id'])} sum={sum(r['delta'] for r in rows)}")


# ---- cast
M1, A1 = mk("m1"), mk("a1")           # tutoring award
M2, A2 = mk("m2"), mk("a2")           # mentoring award + reciprocal attempt
M3, A3 = mk("m3"), mk("a3")           # too short
M4, A4 = mk("m4"), mk("a4")           # closed from requested
M5, A5 = mk("m5"), mk("a5")           # parallel closes
MC = mk("mc")                          # daily cap, mentoring (15)
MT = mk("mt")                          # daily cap, tutoring (10)
cap_mentees = [mk(f"cm{i}") for i in range(3)]
cap2_mentees = [mk(f"ct{i}") for i in range(3)]
RA, RB, RC = mk("ra"), mk("rb"), mk("rc")
H1, H2, H3, H4 = mk("h1"), mk("h2"), mk("h3"), mk("h4")
X = mk("x")                            # bystander

# ================= phase 1: activate (no sleep yet)
ms_a = full(A1, M1, "tutoring")
ms_b = full(A2, M2, "mentoring")
ms_c = full(A3, M3, "mentoring")
st_c = close(ms_c, M3)                 # immediately: < 2 s after active
ms_d = new_ms(A4, M4, "mentoring")     # never activated
st_d = close(ms_d, M4)                 # straight from requested
ms_f = full(A5, M5, "mentoring")
cap1 = [full(m, MC, "mentoring") for m in cap_mentees]
cap2 = [full(m, MT, "tutoring") for m in cap2_mentees]
MP = mk("mp")                          # parallel closes of DIFFERENT mentorships (cap race)
par_mentees = [mk(f"pm{i}") for i in range(8)]
par = [full(m, MP, "mentoring") for m in par_mentees]
ring1 = [full(RB, RA, "mentoring"), full(RC, RB, "mentoring"), full(RA, RC, "mentoring")]
time.sleep(SLEEP)

# ================= phase 1: close
g.check("setup: too-short close accepted by the API (the award is what is withheld)", st_c == 200, st_c)
g.check("setup: close-from-requested accepted by the API", st_d == 200, st_d)
g.check("legit close: mentor M1 closes after >2 s active", close(ms_a, M1) == 200)
g.check("legit close: mentor M2 closes a mentoring after >2 s active", close(ms_b, M2) == 200)

# parallel closes on one active mentorship
codes = []
lock = threading.Lock()


def worker():
    c = close(ms_f, M5)
    with lock:
        codes.append(c)


ths = [threading.Thread(target=worker) for _ in range(12)]
[t.start() for t in ths]
[t.join() for t in ths]
g.check("parallel: at least one of 12 closes succeeded", 200 in codes, codes)

ths = [threading.Thread(target=close, args=(ms, MP)) for ms in par]
[t.start() for t in ths]
[t.join() for t in ths]

# daily-cap scenarios (sequential closes, same mentor)
for ms in cap1:
    close(ms, MC)
for ms in cap2:
    close(ms, MT)
for ms in ring1:
    pass
close(ring1[0], RA); close(ring1[1], RB); close(ring1[2], RC)

# ---- positive controls first (a broken rule that blocks everything must fail here)
r1 = ledger(M1["id"])
g.check("POSITIVE: tutoring close awards exactly one ledger row to the mentor", len(r1) == 1, len(r1))
if r1:
    g.check("POSITIVE: row is session_closed, ref mentorship:<id>, delta 10 (tutoring)",
            r1[0]["reason"] == "session_closed" and r1[0]["ref"] == f"mentorship:{ms_a}" and r1[0]["delta"] == 10, str(r1[0]))
g.check("POSITIVE: users.points of the mentor is 10", pts(M1["id"]) == 10, pts(M1["id"]))
consistent("tutoring mentor", M1)
r2 = ledger(M2["id"])
g.check("POSITIVE: mentoring close awards delta 15", len(r2) == 1 and r2[0]["delta"] == 15, str(r2))
consistent("mentoring mentor", M2)
g.check("mentee earns nothing: A1 ledger empty and points 0", ledger(A1["id"]) == [] and pts(A1["id"]) == 0)
g.check("mentee earns nothing: A2 ledger empty and points 0", ledger(A2["id"]) == [] and pts(A2["id"]) == 0)

# ---- negative award cases
g.check("close < 2 s after active awards 0", ledger(M3["id"]) == [] and pts(M3["id"]) == 0)
g.check("close straight from requested awards 0", ledger(M4["id"]) == [] and pts(M4["id"]) == 0)
g.check("12 parallel closes -> exactly one ledger row", len(ledger(M5["id"])) == 1, len(ledger(M5["id"])))
g.check("12 parallel closes -> users.points is 15, not a multiple", pts(M5["id"]) == 15, pts(M5["id"]))
consistent("parallel mentor", M5)

# reopen / double close
st, _ = call("PATCH", f"{MS}/{ms_a}", {"status": "active"}, M1["token"])
g.rejected("closed mentorship cannot be reopened by the mentor", st)
st, _ = call("PATCH", f"{MS}/{ms_a}", {"status": "active"}, A1["token"])
g.rejected("closed mentorship cannot be reopened by the mentee", st)
st, _ = call("PATCH", f"{MS}/{ms_a}", {"status": "requested"}, M1["token"])
g.rejected("closed mentorship cannot go back to requested", st)
st, _ = call("PATCH", f"{MS}/{ms_a}", {"status": "closed"}, M1["token"])
g.rejected("closing twice is refused", st)
st, _ = call("PATCH", f"{MS}/{ms_a}", {"status": "closed"}, A1["token"])
g.rejected("mentee closing an already closed mentorship is refused", st)
g.check("close twice / reopen: still exactly one row, points 10", len(ledger(M1["id"])) == 1 and pts(M1["id"]) == 10)
st, _ = call("PATCH", f"{MS}/{ms_a}", {"active_at": "2020-01-01 00:00:00.000Z"}, M1["token"])
g.rejected("active_at cannot be forged by a member", st)
st, _ = call("PATCH", f"{MS}/{ms_d}", {"active_at": "2020-01-01 00:00:00.000Z", "status": "active"}, M4["token"])
g.rejected("forging active_at together with status=active is refused", st)

# daily cap
g.check("daily cap (mentoring): total never above 15", pts(MC["id"]) <= 15 and sum(r["delta"] for r in ledger(MC["id"])) <= 15,
        f"{pts(MC['id'])}")
g.check("daily cap (mentoring): POSITIVE first close did award 15", pts(MC["id"]) == 15, pts(MC["id"]))
g.check("daily cap (mentoring): exactly one row of 15 (2nd, 3rd mentee earn 0)", len(ledger(MC["id"])) == 1, len(ledger(MC["id"])))
g.check("daily cap (tutoring 10+10+10): clamped to 15 total", pts(MT["id"]) == 15, pts(MT["id"]))
g.check("daily cap (tutoring): first row 10 (POSITIVE)", any(r["delta"] == 10 for r in ledger(MT["id"])))
consistent("cap mentor", MC)
consistent("cap tutoring mentor", MT)

g.check("cap race: 8 parallel closes of different mentorships still <= 15 total",
        pts(MP["id"]) <= 15 and sum(r["delta"] for r in ledger(MP["id"])) <= 15,
        f"points={pts(MP['id'])} rows={[r['delta'] for r in ledger(MP['id'])]}")
g.check("cap race: POSITIVE at least one of them paid", pts(MP["id"]) >= 10, pts(MP["id"]))
consistent("cap-race mentor", MP)

# ring A->B->C->A
for u, n in ((RA, "RA"), (RB, "RB"), (RC, "RC")):
    g.check(f"ring round 1: {n} earned exactly 15 once (POSITIVE)", pts(u["id"]) == 15 and len(ledger(u["id"])) == 1, pts(u["id"]))

# ================= phase 2: repeats that must NOT pay
ms_g = full(A1, M1, "tutoring")                        # same pair again within the week
ring2 = [full(RB, RA, "mentoring"), full(RC, RB, "mentoring"), full(RA, RC, "mentoring")]
ms_rev = full(M2, A2, "mentoring")                     # reciprocal: M2 earned from A2, now A2 mentors M2
ms_rev2 = full(RC, RA, "mentoring")                    # RA mentors RC although RC mentored RA
# reciprocal beyond the weekly window: seed ledger rows with backdated `created` (superuser)
key = lambda a, b: "".join(sorted([a["id"], b["id"]]))


def iso_ago(days):
    return (datetime.datetime.now(datetime.timezone.utc) - datetime.timedelta(days=days)).strftime("%Y-%m-%d %H:%M:%S.000Z")


def seed(user, other, days, ref):
    st, r = call("POST", LG, {"user": user["id"], "delta": 1, "reason": "session_closed", "ref": ref,
                              "pair_key": key(user, other), "created": iso_ago(days)}, admin)
    ok = st == 200 and r.get("created", "")[:10] == iso_ago(days)[:10]
    if st == 200 and not ok:      # try a PATCH of the autodate field as superuser
        st2, r2 = call("PATCH", f"{LG}/{r['id']}", {"created": iso_ago(days)}, admin)
        print("  INFO backdate: POST created ->", r.get("created"), "| PATCH ->", st2, r2.get("created"))
        ok = st2 == 200 and r2.get("created", "")[:10] == iso_ago(days)[:10]
    return ok


seed10 = seed(H1, H2, 10, "mentorship:seed10")      # H1 earned from H2 10 days ago
seed40 = seed(H3, H4, 40, "mentorship:seed40")      # H3 earned from H4 40 days ago
ms_h1 = full(H1, H2, "mentoring") if seed10 else None  # H2 mentors H1 (H1 earned from this pair 10 d ago)
ms_h3 = full(H3, H4, "mentoring") if seed40 else None  # H4 mentors H3 (>30 d ago: allowed)
time.sleep(SLEEP)
close(ms_g, M1)
for ms, who in zip(ring2, (RA, RB, RC)):
    close(ms, who)
close(ms_rev, A2)
close(ms_rev2, RA)
if ms_h1:
    close(ms_h1, H2)
if ms_h3:
    close(ms_h3, H4)

g.check("same pair again within 7 days awards 0 (M1 still 10)", pts(M1["id"]) == 10 and len(ledger(M1["id"])) == 1,
        f"{pts(M1['id'])} rows={len(ledger(M1['id']))}")
g.check("reverse pair within the week: A2 mentoring M2 awards 0", ledger(A2["id"]) == [] and pts(A2["id"]) == 0,
        str(ledger(A2["id"])))
g.check("ring repeated: RA/RB/RC unchanged at 15 each",
        all(pts(u["id"]) == 15 and len(ledger(u["id"])) == 1 for u in (RA, RB, RC)),
        [pts(u["id"]) for u in (RA, RB, RC)])
g.check("ring: nobody exceeds the daily cap of 15", all(pts(u["id"]) <= 15 for u in (RA, RB, RC)))
g.check("ring: RA mentoring RC after RC mentored RA awards 0", len(ledger(RA["id"])) == 1)
if seed10 and seed40:
    g.check("reciprocal at day 10 (outside the 7-day pair window): mentor H2 gets 0", ledger(H2["id"]) == [] and pts(H2["id"]) == 0,
            str(ledger(H2["id"])))
    g.check("POSITIVE control: same shape with the earlier award 40 days ago pays", pts(H4["id"]) == 15, pts(H4["id"]))
else:
    print("  SKIP reciprocal-30-day cases: superuser cannot backdate points_ledger.created (not counted)")
    SKIPPED_RECIPROCAL = True

# ================= attacks on the stored value
st, _ = call("PATCH", f"{U}/{X['id']}", {"points": 1000}, X["token"])
g.rejected("a) PATCH own users.points = 1000 refused", st)
st, _ = call("PATCH", f"{U}/{X['id']}", {"points": 0}, X["token"])
g.rejected("a) even points = 0 (any presence of the field) is refused", st)
g.check("a) points still 0 after the attacks", pts(X["id"]) == 0)
st, _ = call("PATCH", f"{U}/{X['id']}", {"headline": "ok", "contact_mode": "open"}, X["token"])
g.check("a) POSITIVE: a normal self-edit without points still works", st == 200, st)
st, _ = call("PATCH", f"{U}/{M1['id']}", {"points": 9999}, X["token"])
g.rejected("a) X cannot set M1's points (other member)", st)
g.check("a) M1 unchanged at 10", pts(M1["id"]) == 10)
em = f"vt_sign_{users.stamp}@example.test"
st, rec = call("POST", f"{U}", {"email": em, "password": "Test123456!", "passwordConfirm": "Test123456!", "points": 500})
g.rejected("b) signup with points 500 refused", st)
if st == 200:
    users.made.append(rec["id"])
em2 = f"vt_sign2_{users.stamp}@example.test"
st, rec = call("POST", f"{U}", {"email": em2, "password": "Test123456!", "passwordConfirm": "Test123456!", "points+": 500})
g.rejected("b) signup with {'points+': 500} refused", st)
if st == 200:
    users.made.append(rec["id"])
    print("  INFO signup points+ created a user with points =", rec.get("points"))
em3 = f"vt_sign3_{users.stamp}@example.test"
st, rec = call("POST", f"{U}", {"email": em3, "password": "Test123456!", "passwordConfirm": "Test123456!"})
g.check("b) POSITIVE: plain signup works and starts at 0 points", st == 200 and (rec.get("points") or 0) == 0, st)
if st == 200:
    users.made.append(rec["id"])

row = r1[0]["id"] if r1 else None
st, _ = call("POST", LG, {"user": X["id"], "delta": 500, "reason": "session_closed", "ref": "mentorship:fake"}, X["token"])
g.rejected("c) member cannot POST a ledger row for self", st)
st, _ = call("POST", LG, {"user": M1["id"], "delta": 500, "reason": "session_closed", "ref": "mentorship:fake2"}, X["token"])
g.rejected("c) member cannot POST a ledger row for another member", st)
st, _ = call("POST", LG, {"user": M1["id"], "delta": 500, "reason": "session_closed", "ref": "mentorship:fake3"})
g.rejected("c) anonymous cannot POST a ledger row", st)
if row:
    st, _ = call("PATCH", f"{LG}/{row}", {"delta": 1000}, M1["token"])
    g.rejected("c) the owner cannot PATCH their own ledger row", st)
    st, _ = call("DELETE", f"{LG}/{row}", token=M1["token"])
    g.rejected("c) the owner cannot DELETE their own ledger row", st)
    st, _ = call("PATCH", f"{LG}/{row}", {"delta": 1000}, X["token"])
    g.rejected("c) a stranger cannot PATCH the row", st)
    st, _ = call("DELETE", f"{LG}/{row}", token=X["token"])
    g.rejected("c) a stranger cannot DELETE the row", st)
g.check("c) ledger and points unchanged after all ledger attacks", pts(M1["id"]) == 10 and len(ledger(M1["id"])) == 1)

for label, body in (("string '5'", {"points": "5"}), ("modifier points+", {"points+": 5}),
                    ("modifier points-", {"points-": 1}), ("float", {"points": 5.5}), ("null", {"points": None}),
                    ("array", {"points": [5]})):
    st, _ = call("PATCH", f"{U}/{X['id']}", body, X["token"])
    g.rejected(f"d) PATCH points as {label} refused", st)
    g.check(f"d) points still 0 after {label}", pts(X["id"]) == 0, pts(X["id"]))
st, _ = call("PATCH", f"{U}/{M1['id']}", {"points": "999"}, M1["token"])
g.rejected("d) mentor with 10 points cannot PATCH points '999' on self", st)
g.check("d) M1 still 10", pts(M1["id"]) == 10)

# e) visibility
st, lst = call("GET", f"{LG}?perPage=200", token=X["token"])
g.check("e) bystander X lists zero ledger rows", st == 200 and lst.get("totalItems", 1) == 0, st)
st, lst = call("GET", f"{LG}?perPage=200&filter=user%3D%27{M1['id']}%27", token=A1["token"])
g.check("e) other member cannot list M1's ledger even with a filter", st == 200 and lst.get("totalItems", 1) == 0, st)
if row:
    st, _ = call("GET", f"{LG}/{row}", token=A1["token"])
    g.rejected("e) other member cannot view M1's ledger row by id", st)
    st, _ = call("GET", f"{LG}/{row}", token=M1["token"])
    g.check("e) POSITIVE: M1 views own ledger row", st == 200, st)
st, lst = call("GET", LG, token=M1["token"])
g.check("e) POSITIVE: M1 lists own ledger (N > 0)", st == 200 and lst.get("totalItems", 0) >= 1, st)
st, lst = call("GET", LG)
g.check("e) anonymous gets no ledger rows", st in (200, 403) and lst.get("totalItems", 0) == 0, st)
st, rec = call("GET", f"{U}/{M1['id']}", token=X["token"])
g.check("e) documented decision: points are readable on users by other members", st == 200 and rec.get("points") == 10, f"{st} {rec.get('points')}")
st, lst = call("GET", f"{U}?perPage=200&sort=-points", token=X["token"])
g.check("e) members list shows points for sorting (documented)", st == 200 and any(i["id"] == M1["id"] and i.get("points") == 10 for i in lst.get("items", [])))

users.cleanup()
g.done()
