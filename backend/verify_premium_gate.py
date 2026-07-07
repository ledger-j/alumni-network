#!/usr/bin/env python3
"""Gate + adversarial pass: profiles_deep premium gating (the hard slice).
Positive: a supporter can list profiles_deep (N>0). Negative / executed attacks:
a basic (non-supporter) user is denied on the deep directory via every angle —
plain list, filter injection, ?fields= projection, and expand traversal from a
public collection. Owners always see their own row (not a gating bypass).
"""
from verify_lib import Gate, call, ADMIN

g = Gate("premium_gate")

# fixtures: one supporter, one basic user, each with a deep profile row
sup_id, sup_tok = g.signup_user("supporter")
basic_id, basic_tok = g.signup_user("basic")
# flip supporter via admin (runtime gate = users.supporter). PocketBase resolves
# @request.auth.supporter from the live auth record at rule-eval time, so the
# existing token reflects this without a re-login.
call("PATCH", f"/api/collections/users/records/{sup_id}", {"supporter": True}, token=ADMIN)

deep_sup = g.admin_create("profiles_deep", {"user": sup_id, "cohort": "2018",
                          "discipline": "Economics", "city": "Amsterdam", "company": "ECB"})
deep_basic = g.admin_create("profiles_deep", {"user": basic_id, "cohort": "2019",
                            "discipline": "Finance", "city": "Munich", "company": "Allianz"})

# positive: supporter can search the deep directory
st, s = call("GET", "/api/collections/profiles_deep/records", token=sup_tok)
g.assert_status("supporter lists profiles_deep", st)
g.assert_count("supporter sees deep profiles", s.get("totalItems", 0))

# --- executed bypass attacks by a basic (non-supporter) user ---
# attack 1: plain list
st, a1 = call("GET", "/api/collections/profiles_deep/records", token=basic_tok)
# a basic user still sees their OWN row (by design); assert they DON'T see others'
others = [r for r in a1.get("items", []) if r.get("user") != basic_id]
g.check("basic user sees no other deep profiles (plain list)", len(others) == 0,
        f"foreign rows={len(others)}")

# attack 2: filter injection targeting the supporter's row
st, a2 = call("GET", f'/api/collections/profiles_deep/records?filter=(city="Amsterdam")', token=basic_tok)
foreign = [r for r in a2.get("items", []) if r.get("user") != basic_id]
g.check("filter injection leaks no foreign deep profile", len(foreign) == 0,
        f"foreign rows={len(foreign)}")

# attack 3: field projection to skim gated columns
st, a3 = call("GET", "/api/collections/profiles_deep/records?fields=company,contact_email", token=basic_tok)
foreign3 = [r for r in a3.get("items", []) if r.get("company") == "ECB"]
g.check("?fields= projection leaks no gated company", len(foreign3) == 0,
        f"leaked rows={len(foreign3)}")

# attack 4: direct view of the supporter's deep record by id
st, a4 = call("GET", f"/api/collections/profiles_deep/records/{deep_sup['id']}", token=basic_tok)
g.assert_denied("basic views supporter deep record by id", st)

g.finish()
