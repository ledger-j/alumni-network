#!/usr/bin/env python3
"""Gate for the right to erasure: deleting a member removes everything that references them.

Run:  PB_BASE=... PB_TOKEN=<superuser token> python3 verify_delete.py   (after init_schema.py + hooks)
User X owns rows in every users-referencing collection (messages both ways, posts, mentorships as
mentor and mentee, docs, collab requests both ways, blocks both ways, ledger, settings, location,
deep profile, events + RSVPs, groups as owner and as plain member, group messages, avatar file).
X deletes the own account; afterwards no collection has a row referencing X. Throwaway data.
"""
import time, datetime
from vt_common import call, admin_token, Gate, Users, multipart, get_raw, file_token, tiny_png

admin = admin_token()
g, users = Gate("right to erasure"), Users(admin)
X, Y, Z = users.make("x"), users.make("y"), users.make("z")
R = lambda c: f"/api/collections/{c}/records"
S = lambda c, p: f"/api/collections/{c}/records{p}"
PDF = b"%PDF-1.4\n1 0 obj<<>>endobj\n%%EOF\n"
future = (datetime.datetime.now(datetime.timezone.utc) + datetime.timedelta(days=3)).strftime("%Y-%m-%d %H:%M:%S.000Z")


def ok(label, st, extra=""):
    g.check(label, st in (200, 204), f"{st} {extra}")


# verified members (events, locations need it) -- superuser only
for u in (X, Y):
    st, _ = call("PATCH", S("users", f"/{u['id']}"), {"verified": True}, admin)
    ok("setup: superuser verifies member", st)
    # re-login to carry verified=true in the token context
    st, a = call("POST", "/api/collections/users/auth-refresh", {}, u["token"])
    if st == 200:
        u["token"] = a["token"]

# ---------------- seed X (and counterpart rows by Y) ----------------
st, _ = call("POST", R("messages"), {"sender": X["id"], "recipient": Y["id"], "text": "x to y", "read": False}, X["token"]); ok("seed: message X->Y", st)
st, _ = call("POST", R("messages"), {"sender": Y["id"], "recipient": X["id"], "text": "y to x", "read": False}, Y["token"]); ok("seed: message Y->X", st)
st, _ = call("POST", R("posts"), {"author": X["id"], "text": "a post by X"}, X["token"]); ok("seed: post", st)
st, _ = call("POST", R("posts"), {"author": Y["id"], "text": "a post by Y"}, Y["token"]); ok("seed: post by Y (must survive)", st)

st, m1 = call("POST", R("mentorships"), {"mentor": Y["id"], "mentee": X["id"], "kind": "mentoring", "topic": "t", "status": "requested"}, X["token"]); ok("seed: mentorship X as mentee", st, m1)
st, m2 = call("POST", R("mentorships"), {"mentor": X["id"], "mentee": Y["id"], "kind": "tutoring", "topic": "t", "status": "requested"}, Y["token"]); ok("seed: mentorship X as mentor", st, m2)
st, _ = call("PATCH", S("mentorships", f"/{m1['id']}"), {"status": "active"}, Y["token"]); ok("seed: m1 active", st)
st, _ = call("PATCH", S("mentorships", f"/{m2['id']}"), {"status": "active"}, X["token"]); ok("seed: m2 active", st)
st, doc = multipart(R("mentorship_docs"), "POST", {"mentorship": m1["id"], "uploader": X["id"]}, {"file": ("cv.pdf", PDF, "application/pdf")}, X["token"]); ok("seed: doc uploaded by X", st, doc)
st, doc2 = multipart(R("mentorship_docs"), "POST", {"mentorship": m2["id"], "uploader": Y["id"]}, {"file": ("y.pdf", PDF, "application/pdf")}, Y["token"]); ok("seed: doc by Y in X's mentorship", st, doc2)
ft = file_token(admin)
st, body, _ = get_raw(f"/api/files/{doc['collectionId']}/{doc['id']}/{doc['file']}?token={ft}")
g.check("control: doc file downloadable before erasure", st == 200 and body == PDF, st)

st, _ = call("POST", R("collab_requests"), {"from": X["id"], "to": Y["id"], "kind": "project", "message": "hi", "status": "pending"}, X["token"]); ok("seed: collab X->Y", st)
st, _ = call("POST", R("collab_requests"), {"from": Y["id"], "to": X["id"], "kind": "project", "message": "hi", "status": "pending"}, Y["token"]); ok("seed: collab Y->X", st)

st, _ = call("POST", R("points_ledger"), {"user": X["id"], "delta": 5, "reason": "manual", "ref": "gate:x"}, admin); ok("seed: points ledger row (superuser)", st)
st, _ = call("POST", R("user_settings"), {"user": X["id"], "accent_hue": 120, "show_attendance": True}, X["token"]); ok("seed: user_settings", st)
st, _ = call("POST", R("user_locations"), {"user": X["id"], "lat": 50.85, "lng": 5.69, "city": "Maastricht", "visible": True}, X["token"]); ok("seed: user_locations", st)
st, _ = call("POST", R("profiles_deep"), {"user": X["id"], "experience": "e", "visibility": "members", "source": "self"}, X["token"]); ok("seed: profiles_deep", st)

st, evx = call("POST", R("events"), {"title": "X event", "host": X["id"], "start": future}, X["token"]); ok("seed: event hosted by X", st, evx)
st, evy = call("POST", R("events"), {"title": "Y event", "host": Y["id"], "start": future}, Y["token"]); ok("seed: event hosted by Y", st, evy)
st, _ = call("POST", R("rsvps"), {"event": evy["id"], "user": X["id"]}, X["token"]); ok("seed: RSVP by X on Y's event", st)
st, _ = call("POST", R("rsvps"), {"event": evx["id"], "user": Y["id"]}, Y["token"]); ok("seed: RSVP by Y on X's event", st)

st, gx = call("POST", R("conversations"), {"title": "X's group", "owner": X["id"], "members": [Y["id"], Z["id"]]}, X["token"]); ok("seed: group owned by X", st, gx)
st, gy = call("POST", R("conversations"), {"title": "Y's group", "owner": Y["id"], "members": [X["id"], Z["id"]]}, Y["token"]); ok("seed: group owned by Y, X plain member", st, gy)
st, _ = call("POST", R("conversation_messages"), {"conversation": gx["id"], "sender": X["id"], "text": "in own group"}, X["token"]); ok("seed: X message in own group", st)
st, _ = call("POST", R("conversation_messages"), {"conversation": gx["id"], "sender": Y["id"], "text": "y in x group"}, Y["token"]); ok("seed: Y message in X's group", st)
st, _ = call("POST", R("conversation_messages"), {"conversation": gy["id"], "sender": X["id"], "text": "x in y group"}, X["token"]); ok("seed: X message in Y's group", st)
st, _ = call("POST", R("conversation_messages"), {"conversation": gy["id"], "sender": Y["id"], "text": "y in y group"}, Y["token"]); ok("seed: Y message in Y's group", st)

# blocks last (they would deny the contact rows above)
st, _ = call("POST", R("blocks"), {"blocker": X["id"], "blocked": Y["id"]}, X["token"]); ok("seed: X blocks Y", st)
st, _ = call("POST", R("blocks"), {"blocker": Y["id"], "blocked": X["id"]}, Y["token"]); ok("seed: Y blocks X", st)

st, av = multipart(S("users", f"/{X['id']}"), "PATCH", {}, {"avatar": ("a.png", tiny_png(), "image/png")}, X["token"]); ok("seed: avatar for X", st)
avurl = f"/api/files/{av.get('collectionId')}/{X['id']}/{av.get('avatar')}"
st, _, _ = get_raw(avurl)
g.check("control: avatar file served before erasure", st == 200, st)

# ---------------- which collections reference users ----------------
st, cols = call("GET", "/api/collections?perPage=200", token=admin)
refs = []   # (collection, field, multi)
for c in cols.get("items", []):
    if c["name"].startswith("_") or c["name"] == "users":
        continue
    for f in c.get("fields", []):
        if f["type"] == "relation" and f.get("collectionId") == "_pb_users_auth_":
            refs.append((c["name"], f["name"], f.get("maxSelect", 1) != 1))
g.check("collected user-referencing relation fields (N>0)", len(refs) >= 19, f"{len(refs)}")


def count(uid):
    out = {}
    for coll, field, multi in refs:
        flt = f"{field}~'{uid}'" if multi else f"{field}='{uid}'"
        st, r = call("GET", S(coll, f"?filter={flt}&perPage=1"), token=admin)
        out[(coll, field)] = r.get("totalItems", -1) if st == 200 else f"HTTP{st}"
    return out


before = count(X["id"])
SEEDED = {"messages": ("sender", "recipient"), "posts": ("author",), "mentorships": ("mentor", "mentee"),
          "mentorship_docs": ("uploader",), "collab_requests": ("from", "to"), "blocks": ("blocker", "blocked"),
          "points_ledger": ("user",), "user_settings": ("user",), "user_locations": ("user",),
          "profiles_deep": ("user",), "events": ("host",), "rsvps": ("user",),
          "conversations": ("owner", "members"), "conversation_messages": ("sender",)}
for coll, fields in SEEDED.items():
    for f in fields:
        g.check(f"before: {coll}.{f} references X (seeded, N>0)", isinstance(before.get((coll, f)), int) and before[(coll, f)] > 0, before.get((coll, f)))
unseeded = [k for k, v in before.items() if k[0] not in SEEDED]

# ---------------- attacks before the delete ----------------
st, _ = call("DELETE", S("users", f"/{X['id']}"), token=Y["token"]); g.rejected("another member cannot delete X's account", st)
st, _ = call("DELETE", S("users", f"/{X['id']}")); g.check("anonymous cannot delete X's account", st in (400, 401, 403, 404), st)
st, _ = call("DELETE", S("users", f"/{X['id']}"), token=Z["token"]); g.rejected("a group co-member cannot delete X's account", st)
st, v = call("GET", S("users", f"/{X['id']}"), token=admin)
g.check("X still exists after the attacks", st == 200, st)

# ---------------- erasure ----------------
st, _ = call("DELETE", S("users", f"/{X['id']}"), token=X["token"])
g.check("X deletes the own account -> 204", st == 204, st)
st, _ = call("GET", S("users", f"/{X['id']}"), token=admin)
g.check("X's user record is gone", st == 404, st)
time.sleep(0.5)
after = count(X["id"])
for k, v in after.items():
    g.check(f"after: {k[0]}.{k[1]} has zero rows referencing X", v == 0, v)

# survivors / side effects
st, r = call("GET", S("conversations", f"/{gy['id']}"), token=Y["token"])
g.check("Y's group still exists", st == 200, st)
g.check("X removed from Y's group; Y and Z remain", st == 200 and X["id"] not in r.get("members", []) and Y["id"] in r.get("members", []) and Z["id"] in r.get("members", []), r.get("members"))
st, r = call("GET", S("conversation_messages", f"?filter=conversation='{gy['id']}'&perPage=50"), token=Y["token"])
g.check("Y's own message in Y's group survives; X's is gone", r.get("totalItems") == 1 and r["items"][0]["sender"] == Y["id"], r.get("totalItems"))
st, r = call("GET", S("conversations", f"/{gx['id']}"), token=Y["token"])
g.check("group owned by X is gone (cascade)", st == 404, st)
st, r = call("GET", S("conversation_messages", f"?filter=conversation='{gx['id']}'"), token=admin)
g.check("messages of X's group are gone", r.get("totalItems") == 0, r.get("totalItems"))
st, r = call("GET", S("posts", f"?filter=author='{Y['id']}'"), token=Y["token"])
g.check("control: Y's own post survives", r.get("totalItems") == 1, r.get("totalItems"))
st, r = call("GET", S("events", f"/{evy['id']}"), token=Y["token"])
g.check("control: Y's event survives; RSVP count reflects removal", st == 200 and r.get("going_count") == 0, f"{st} {r.get('going_count')}")
st, r = call("GET", S("mentorship_docs", f"?filter=mentorship='{m2['id']}'"), token=admin)
g.check("docs inside X's mentorships are gone", r.get("totalItems") == 0, r.get("totalItems"))

# files go with their records
ft = file_token(admin)
st, body, _ = get_raw(f"/api/files/{doc['collectionId']}/{doc['id']}/{doc['file']}?token={ft}")
g.check("uploaded doc file is gone with its record", st in (400, 403, 404) and body != PDF, st)
st, body, _ = get_raw(avurl)
g.check("avatar file is gone with the user", st in (400, 403, 404), st)

print("NOTE collections with a users relation but no seeded row:", sorted(set(f"{a}.{b}" for a, b in unseeded)) or "none")
users.cleanup()
g.done()
