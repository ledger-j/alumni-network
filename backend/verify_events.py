#!/usr/bin/env python3
"""Gate: chapters -> events + rsvps.
Positive: admin seeds a chapter and an event under it; a member RSVPs; the event
list and RSVP list are non-empty (N>0). Negative: anon cannot list events; the
SAME user RSVPing twice is rejected by the unique index — RSVP count stays 1.
"""
from verify_lib import Gate, call

g = Gate("chapters+events+rsvps")
member_id, member_tok = g.signup_user("member")

# positive: admin seeds chapter + event (creation is admin-only by rule)
chapter = g.admin_create("chapters", {"name": "Munich Chapter", "city": "Munich"})
event = g.admin_create("events", {"chapter": chapter["id"], "title": "Alumni Mixer",
                                  "date": "2026-09-01", "location": "Munich"})

st, evs = call("GET", "/api/collections/events/records", token=member_tok)
g.assert_status("member lists events", st)
g.assert_count("events visible to members", evs.get("totalItems", 0))

# positive: member RSVPs once
st, r = call("POST", "/api/collections/rsvps/records",
             {"user": member_id, "event": event["id"]}, token=member_tok)
g.assert_status("member RSVPs", st)
if r.get("id"):
    g.track("rsvps", r["id"])
st, rl = call("GET", f'/api/collections/rsvps/records?filter=(event="{event["id"]}")', token=member_tok)
g.assert_count("RSVP recorded", rl.get("totalItems", 0))

# negative: duplicate RSVP rejected (idempotent count)
st, dup = call("POST", "/api/collections/rsvps/records",
               {"user": member_id, "event": event["id"]}, token=member_tok)
g.assert_denied("duplicate RSVP rejected", st)
if dup.get("id"):
    g.track("rsvps", dup["id"])
st, rl2 = call("GET", f'/api/collections/rsvps/records?filter=(event="{event["id"]}")', token=member_tok)
g.check("RSVP count stays 1 after double-submit", rl2.get("totalItems") == 1,
        f"totalItems={rl2.get('totalItems')}")

# negative: anon cannot list events
st, anon = call("GET", "/api/collections/events/records")
g.assert_denied("anon lists events", st, anon.get("items"))

g.finish()
