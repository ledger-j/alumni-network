#!/usr/bin/env python3
"""Gate: membership (billing/history record).
Positive: admin creates a membership row for a user; that user can read their OWN
row (N>0). Negative: a member cannot self-create/upgrade a membership, and one
member cannot read ANOTHER member's membership row.
"""
from verify_lib import Gate, call

g = Gate("membership")
owner_id, owner_tok = g.signup_user("owner")
other_id, other_tok = g.signup_user("other")

# positive: admin issues a membership; owner reads their own
g.admin_create("membership", {"user": owner_id, "tier": "premium", "monthly_fee": 9,
                              "status": "active", "started": "2026-07-07"})
st, mine = call("GET", f'/api/collections/membership/records?filter=(user="{owner_id}")', token=owner_tok)
g.assert_status("owner reads own membership", st)
g.assert_count("own membership visible", mine.get("totalItems", 0))

# negative: member cannot self-create a membership (no client createRule)
st, forged = call("POST", "/api/collections/membership/records",
                  {"user": owner_id, "tier": "premium", "monthly_fee": 0, "status": "active"},
                  token=owner_tok)
g.assert_denied("member self-creates membership", st)
if forged.get("id"):
    g.track("membership", forged["id"])

# negative: other member cannot read owner's membership row
st, snoop = call("GET", f'/api/collections/membership/records?filter=(user="{owner_id}")', token=other_tok)
g.assert_denied("other member reads owner membership", st, snoop.get("items"))

g.finish()
