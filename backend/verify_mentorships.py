#!/usr/bin/env python3
"""Gate for mentoring + tutoring requests: who sees them, who may change what.

Run:  PB_BASE=http://127.0.0.1:8090 PB_TOKEN=<superuser token> python3 verify_mentorships.py
Needs init_schema.py to have run first. Throwaway users/records, removed at the end.
"""
from vt_common import call, admin_token, Gate, Users

admin = admin_token()
g, users = Gate("mentorships (mentoring + tutoring)"), Users(admin)
M_USER = users.make("mentor", mentor=True, role="alumnus")
S_USER = users.make("student", role="student")
T_USER = users.make("third", role="student")
P = "/api/collections/mentorships/records"
made = []


def body(kind="tutoring", **kw):
    b = {"mentor": M_USER["id"], "mentee": S_USER["id"], "kind": kind,
         "topic": "Statistics tutorial 3", "status": "requested"}
    b.update(kw)
    return b


# --- create ---
st, rec = call("POST", P, body(), S_USER["token"])
g.check("mentee creates a tutoring request", st == 200, st)
rid = rec.get("id")
made.append(f"{P}/{rid}")
st, rec2 = call("POST", P, body("mentoring", topic="CV review"), S_USER["token"])
g.check("mentee creates a mentoring request", st == 200, st)
made.append(f"{P}/{rec2.get('id')}")
st, _ = call("POST", P, body(mentee=M_USER["id"]), S_USER["token"])
g.rejected("cannot create a request in someone else's name (mentee=mentor)", st)
st, _ = call("POST", P, body(status="active"), S_USER["token"])
g.rejected("cannot create an already-active request", st)
st, _ = call("POST", P, body(kind="coaching"), S_USER["token"])
g.rejected("unknown kind is refused", st)
st, _ = call("POST", P, body(mentor=S_USER["id"]), S_USER["token"])
g.rejected("cannot request yourself", st)
st, _ = call("POST", P, body())
g.rejected("anonymous cannot create", st)

# --- visibility: only the two participants ---
for who, tok in (("mentee", S_USER["token"]), ("mentor", M_USER["token"])):
    st, lst = call("GET", P, token=tok)
    g.check(f"{who} lists the request (collected N > 0)",
            st == 200 and lst.get("totalItems", 0) >= 2 and any(i["id"] == rid for i in lst["items"]), st)
st, lst = call("GET", P, token=T_USER["token"])
g.check("third member lists zero requests", st == 200 and lst.get("totalItems", 0) == 0,
        f"{st} {lst.get('totalItems')}")
st, _ = call("GET", f"{P}/{rid}", token=T_USER["token"])
g.rejected("third member cannot view it", st)
st, lst = call("GET", P)
g.check("anonymous lists zero requests", st in (200, 403) and lst.get("totalItems", 0) == 0, st)

# --- updates: status only, by the right person ---
st, _ = call("PATCH", f"{P}/{rid}", {"status": "active"}, S_USER["token"])
g.rejected("mentee cannot self-activate", st)
st, _ = call("PATCH", f"{P}/{rid}", {"status": "active"}, T_USER["token"])
g.rejected("third member cannot update", st)
st, _ = call("PATCH", f"{P}/{rid}", {"topic": "rewritten"}, M_USER["token"])
g.rejected("mentor cannot rewrite the topic", st)
st, _ = call("PATCH", f"{P}/{rid}", {"kind": "mentoring", "status": "active"}, M_USER["token"])
g.rejected("mentor cannot change the kind", st)
st, _ = call("PATCH", f"{P}/{rid}", {"mentee": T_USER["id"], "status": "active"}, M_USER["token"])
g.rejected("mentor cannot swap the mentee", st)
st, _ = call("PATCH", f"{P}/{rid}", {"status": "active"}, M_USER["token"])
g.check("mentor accepts (status=active)", st == 200, st)
st, _ = call("PATCH", f"{P}/{rid}", {"status": "requested"}, M_USER["token"])
g.rejected("status cannot go back to requested", st)
st, _ = call("PATCH", f"{P}/{rid}", {"status": "closed"}, S_USER["token"])
g.check("mentee can close", st == 200, st)
st, cur = call("GET", f"{P}/{rid}", token=S_USER["token"])
g.check("record state after the attacks is as expected",
        cur.get("status") == "closed" and cur.get("topic") == "Statistics tutorial 3"
        and cur.get("kind") == "tutoring", cur)

# --- delete: superuser only ---
for who, tok in (("mentee", S_USER["token"]), ("mentor", M_USER["token"])):
    st, _ = call("DELETE", f"{P}/{rid}", token=tok)
    g.rejected(f"{who} cannot delete", st)

# --- users: nobody grants themselves premium ---
U = f"/api/collections/users/records/{S_USER['id']}"
st, _ = call("PATCH", U, {"supporter": True}, S_USER["token"])
g.rejected("member cannot set their own supporter flag", st)
st, _ = call("PATCH", U, {"tutor": True, "tutor_subjects": "Statistics"}, S_USER["token"])
g.check("member can set own tutor + tutor_subjects", st == 200, st)

users.cleanup(made)
g.done()
