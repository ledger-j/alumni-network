#!/usr/bin/env python3
"""Gate: ideas + idea_votes.
Positive: post an idea, upvote it, list ideas (N>0), and confirm one vote counts.
Negative: anon cannot post; the SAME user voting twice is rejected by the unique
index (idempotency) — vote count stays 1.
"""
from verify_lib import Gate, call

g = Gate("ideas+idea_votes")
author_id, author_tok = g.signup_user("author")
voter_id, voter_tok = g.signup_user("voter")

# positive: post an idea
st, idea = call("POST", "/api/collections/ideas/records",
                {"author": author_id, "title": "Alumni-run micro-internships",
                 "body": "Pair students with alumni for 2-week projects.", "category": "mentoring"},
                token=author_tok)
g.assert_status("author posts idea", st)
iid = idea.get("id")
if iid:
    g.track("ideas", iid)

# positive: list ideas
st, ideas = call("GET", "/api/collections/ideas/records", token=voter_tok)
g.assert_count("ideas listable", ideas.get("totalItems", 0))

# positive: upvote once
st, v = call("POST", "/api/collections/idea_votes/records",
             {"user": voter_id, "idea": iid}, token=voter_tok)
g.assert_status("voter upvotes idea", st)
if v.get("id"):
    g.track("idea_votes", v["id"])

# negative: same user votes again -> unique index rejects (idempotent count)
st, dup = call("POST", "/api/collections/idea_votes/records",
               {"user": voter_id, "idea": iid}, token=voter_tok)
g.assert_denied("duplicate vote rejected", st)
if dup.get("id"):
    g.track("idea_votes", dup["id"])
st, votes = call("GET", f'/api/collections/idea_votes/records?filter=(idea="{iid}")', token=voter_tok)
g.check("vote count stays 1 after double-submit", votes.get("totalItems") == 1,
        f"totalItems={votes.get('totalItems')}")

# negative: anon cannot post an idea
st, anon = call("POST", "/api/collections/ideas/records",
                {"author": author_id, "title": "x", "body": "y"})
g.assert_denied("anon posts idea", st)
if anon.get("id"):
    g.track("ideas", anon["id"])

g.finish()
