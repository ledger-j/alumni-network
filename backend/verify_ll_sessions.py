#!/usr/bin/env python3
"""Gate: ll_sessions.
Positive: admin seeds a lifelong-learning session; members can list it (N>0).
Negative: anon cannot list; a member cannot create one (admin-only createRule).
"""
from verify_lib import Gate, call

g = Gate("ll_sessions")
member_id, member_tok = g.signup_user("member")

# positive: admin seeds a session
g.admin_create("ll_sessions", {"title": "AI for Alumni", "faculty": "SBE",
                               "date": "2026-10-10", "reward_comp": 0})
st, sess = call("GET", "/api/collections/ll_sessions/records", token=member_tok)
g.assert_status("member lists ll_sessions", st)
g.assert_count("ll_sessions visible to members", sess.get("totalItems", 0))

# negative: anon cannot list
st, anon = call("GET", "/api/collections/ll_sessions/records")
g.assert_denied("anon lists ll_sessions", st, anon.get("items"))

# negative: member cannot create (admin-only)
st, forged = call("POST", "/api/collections/ll_sessions/records",
                  {"title": "hijack", "date": "2026-10-10"}, token=member_tok)
g.assert_denied("member creates ll_session", st)
if forged.get("id"):
    g.track("ll_sessions", forged["id"])

g.finish()
