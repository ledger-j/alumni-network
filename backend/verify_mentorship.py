#!/usr/bin/env python3
"""Gate: mentorships + speaker_requests.
Positive: a mentee creates a mentorship request and reads it back (N>0),
plus a speaker request round-trips. Negative: anon cannot list mentorships,
and a third party cannot create a mentorship naming others as both parties.
"""
from verify_lib import Gate, call

g = Gate("mentorships+speaker_requests")
mentee_id, mentee_tok = g.signup_user("mentee")
mentor_id, mentor_tok = g.signup_user("mentor", mentor=True, mentor_offer="Career coaching")

# positive: mentee opens a request
st, m = call("POST", "/api/collections/mentorships/records",
             {"mentor": mentor_id, "mentee": mentee_id, "topic": "Breaking into consulting",
              "status": "requested"}, token=mentee_tok)
g.assert_status("mentee creates mentorship", st)
if m.get("id"):
    g.track("mentorships", m["id"])

# positive: it is listable by an authed participant, filtered by status
st, lst = call("GET", '/api/collections/mentorships/records?filter=(status="requested")', token=mentor_tok)
g.assert_status("mentor lists requested mentorships", st)
g.assert_count("requested mentorships visible", lst.get("totalItems", 0))

# positive: speaker request round-trips
st, sr = call("POST", "/api/collections/speaker_requests/records",
              {"requester": mentee_id, "topic": "Guest talk on venture finance",
               "format": "guest-talk", "status": "open"}, token=mentee_tok)
g.assert_status("mentee creates speaker request", st)
if sr.get("id"):
    g.track("speaker_requests", sr["id"])
st, srl = call("GET", "/api/collections/speaker_requests/records", token=mentor_tok)
g.assert_count("speaker requests visible to members", srl.get("totalItems", 0))

# negative: anonymous cannot list the mentorship directory
st, anon = call("GET", "/api/collections/mentorships/records")
g.assert_denied("anon lists mentorships", st, anon.get("items"))

# negative: a third party cannot forge a mentorship between two other users
_, third_tok = g.signup_user("third")
st, forged = call("POST", "/api/collections/mentorships/records",
                  {"mentor": mentor_id, "mentee": mentee_id, "topic": "forged", "status": "requested"},
                  token=third_tok)
g.assert_denied("third party forges mentorship", st)
if forged.get("id"):
    g.track("mentorships", forged["id"])

g.finish()
