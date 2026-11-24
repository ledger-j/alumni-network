#!/usr/bin/env python3
"""Gate for group chat: membership privacy, caps, contact doors, leave, cascade, realtime.

Run:  PB_BASE=... PB_TOKEN=<superuser token> python3 verify_groups.py   (after init_schema.py + hooks)
Every attack has a positive control. Throwaway users/records, removed at the end.
"""
import time
from vt_common import call, admin_token, Gate, Users, Sse

admin = admin_token()
g, users = Gate("group chat"), Users(admin)
A, B, C, S = users.make("owner"), users.make("b"), users.make("c"), users.make("stranger")
CLOSED, BLOCKER = users.make("closed"), users.make("blocker")
CV, CM, U = "/api/collections/conversations/records", "/api/collections/conversation_messages/records", "/api/collections/users/records"
made = []

st, _ = call("PATCH", f"{U}/{CLOSED['id']}", {"contact_mode": "closed"}, CLOSED["token"])
g.check("setup: member switches to closed mode", st == 200, st)
st, _ = call("POST", "/api/collections/blocks/records", {"blocker": BLOCKER["id"], "blocked": A["id"]}, BLOCKER["token"])
g.check("setup: BLOCKER blocks the owner", st == 200, st)

# --- positive: create group; owner is auto-included ---
st, grp = call("POST", CV, {"title": "Study group", "owner": A["id"], "members": [B["id"], C["id"]]}, A["token"])
g.check("owner creates a group with open-mode friends", st == 200, f"{st} {grp}")
gid = grp.get("id")
made.append(f"{CV}/{gid}")
g.check("owner auto-included in members", A["id"] in grp.get("members", []) and len(grp.get("members", [])) == 3, grp.get("members"))

sse_b = Sse(B["token"], ["conversation_messages"])
sse_c = Sse(C["token"], ["conversation_messages"])
sse_s = Sse(S["token"], ["conversation_messages"])
g.check("realtime: members' SSE subscribed", sse_b.wait_ready() and sse_c.wait_ready() and sse_s.wait_ready())

st, m1 = call("POST", CM, {"conversation": gid, "sender": B["id"], "text": "hi group"}, B["token"])
g.check("member B posts into the group", st == 200, f"{st} {m1}")
mid = m1.get("id")
ev = sse_c.wait_for(lambda e: e[1].get("record", {}).get("id") == mid)
g.check("realtime: member C receives B's post", ev is not None)
for who, t in (("A", A), ("B", B), ("C", C)):
    st, lst = call("GET", CM, token=t["token"])
    g.check(f"member {who} lists the message (N>0)", st == 200 and any(i["id"] == mid for i in lst.get("items", [])), st)
    st, v = call("GET", f"{CV}/{gid}", token=t["token"])
    g.check(f"member {who} views the group", st == 200 and v.get("id") == gid, st)

# --- stranger ---
st, lst = call("GET", CV, token=S["token"])
g.check("stranger lists 0 conversations", st == 200 and lst.get("totalItems", 0) == 0, f"{st} {lst.get('totalItems')}")
st, lst = call("GET", CM, token=S["token"])
g.check("stranger lists 0 conversation_messages", st == 200 and lst.get("totalItems", 0) == 0, f"{st} {lst.get('totalItems')}")
st, _ = call("GET", f"{CV}/{gid}", token=S["token"]); g.rejected("stranger cannot view the group by id", st)
st, _ = call("GET", f"{CM}/{mid}", token=S["token"]); g.rejected("stranger cannot view a group message by id", st)
st, _ = call("POST", CM, {"conversation": gid, "sender": S["id"], "text": "let me in"}, S["token"])
g.rejected("stranger cannot post into the group (sender=self)", st)
st, _ = call("POST", CM, {"conversation": gid, "sender": B["id"], "text": "spoof"}, S["token"])
g.rejected("stranger cannot spoof sender=B", st)
st, _ = call("POST", CM, {"conversation": gid, "sender": C["id"], "text": "spoof"}, B["token"])
g.rejected("member B cannot spoof sender=C", st)
st, lst = call("GET", CM, token=None)
g.check("anonymous lists 0 group messages", st in (200, 403) and lst.get("totalItems", 0) == 0, st)
st, _ = call("POST", CV, {"title": "x", "owner": A["id"], "members": [S["id"]]}, S["token"])
g.rejected("stranger cannot create a group owned by A", st)
time.sleep(1)
g.check("realtime: stranger gets no group event", not any(e[0] == "conversation_messages" for e in sse_s.events))

# --- owner adds members: doors ---
st, r = call("PATCH", f"{CV}/{gid}", {"members": [A["id"], B["id"], C["id"], S["id"]]}, A["token"])
g.check("control: owner adds open-mode stranger S (positive)", st == 200, f"{st} {r}")
st, _ = call("PATCH", f"{CV}/{gid}", {"members": [A["id"], B["id"], C["id"]]}, A["token"])  # take S back out
g.check("owner can remove a member via update", st == 200, st)
st, _ = call("PATCH", f"{CV}/{gid}", {"members": [A["id"], B["id"], C["id"], CLOSED["id"]]}, A["token"])
g.rejected("owner adds a closed-mode member -> refused", st)
st, _ = call("PATCH", f"{CV}/{gid}", {"members": [A["id"], B["id"], C["id"], BLOCKER["id"]]}, A["token"])
g.rejected("owner adds a user who blocked them -> refused", st)
st, _ = call("POST", CV, {"title": "g2", "owner": A["id"], "members": [CLOSED["id"]]}, A["token"])
g.rejected("create group including a closed-mode member -> refused", st)
st, _ = call("POST", CV, {"title": "g3", "owner": A["id"], "members": [BLOCKER["id"]]}, A["token"])
g.rejected("create group including a blocker -> refused", st)
st, v = call("GET", f"{CV}/{gid}", token=A["token"])
g.check("membership unchanged after refused adds", sorted(v.get("members", [])) == sorted([A["id"], B["id"], C["id"]]), v.get("members"))

# --- title length ---
st, _ = call("POST", CV, {"title": "t" * 81, "owner": A["id"], "members": [B["id"]]}, A["token"])
g.rejected("title of 81 chars rejected", st)
st, ok = call("POST", CV, {"title": "t" * 80, "owner": A["id"], "members": [B["id"]]}, A["token"])
g.check("control: title of 80 chars accepted", st == 200, st)
if ok.get("id"):
    made.append(f"{CV}/{ok['id']}")

# --- member attacks ---
st, _ = call("PATCH", f"{CV}/{gid}", {"owner": B["id"]}, B["token"]); g.rejected("member PATCHes owner -> refused", st)
st, _ = call("PATCH", f"{CV}/{gid}", {"members": [A["id"], B["id"], C["id"], S["id"]]}, B["token"]); g.rejected("member PATCHes members -> refused", st)
st, _ = call("PATCH", f"{CV}/{gid}", {"title": "hijack"}, B["token"]); g.rejected("member PATCHes title -> refused", st)
st, _ = call("PATCH", f"{CV}/{gid}", {"owner": B["id"]}, A["token"]); g.rejected("owner cannot transfer ownership via update", st)
st, _ = call("PATCH", f"{CV}/{gid}", {"members": [B["id"], C["id"]]}, A["token"]); g.rejected("owner cannot remove self via update", st)
st, _ = call("DELETE", f"{CV}/{gid}", token=B["token"]); g.rejected("member cannot delete the group", st)
st, v = call("GET", f"{CV}/{gid}", token=A["token"])
g.check("group intact after member attacks", st == 200 and v.get("owner") == A["id"] and v.get("title") == "Study group", v)

# --- cap 12 ---
extra = [users.make(f"x{i}") for i in range(10)]   # owner + B + C + 10 = 13
ids12 = [A["id"], B["id"], C["id"]] + [u["id"] for u in extra[:9]]
st, r = call("PATCH", f"{CV}/{gid}", {"members": ids12}, A["token"])
g.check("control: group of exactly 12 accepted", st == 200 and len(r.get("members", [])) == 12, f"{st}")
st, _ = call("PATCH", f"{CV}/{gid}", {"members": ids12 + [extra[9]["id"]]}, A["token"])
g.rejected("13th member via update -> refused", st)
st, _ = call("POST", CV, {"title": "big", "owner": A["id"], "members": [u["id"] for u in extra] + [B["id"], C["id"]]}, A["token"])
g.rejected("create with 13 members (12 + auto-owner) -> refused", st)
st, v = call("GET", f"{CV}/{gid}", token=A["token"])
g.check("still 12 members after refused 13th", len(v.get("members", [])) == 12, len(v.get("members", [])))
call("PATCH", f"{CV}/{gid}", {"members": [A["id"], B["id"], C["id"]]}, A["token"])

# --- leave ---
st, r = call("POST", f"/api/uc/conversations/{gid}/leave", {}, S["token"]); g.rejected("non-member leave -> 403", st)
st, r = call("POST", f"/api/uc/conversations/{gid}/leave", {}, A["token"])
g.check("owner leave -> 400", st == 400, st)
sse_b.events.clear()
st, r = call("POST", f"/api/uc/conversations/{gid}/leave", {}, B["token"])
g.check("member B leaves (positive)", st == 200 and r.get("left") is True, f"{st} {r}")
st, v = call("GET", f"{CV}/{gid}", token=A["token"])
g.check("B removed, others remain", v.get("members") and B["id"] not in v["members"] and C["id"] in v["members"], v.get("members"))
st, m2 = call("POST", CM, {"conversation": gid, "sender": A["id"], "text": "after B left"}, A["token"])
g.check("owner posts after B left", st == 200, st)
time.sleep(2)
st, lst = call("GET", CM, token=B["token"])
g.check("left member B lists 0 messages", st == 200 and lst.get("totalItems", 0) == 0, f"{st} {lst.get('totalItems')}")
st, _ = call("GET", f"{CM}/{mid}", token=B["token"]); g.rejected("left member cannot view old message", st)
g.check("realtime: left member B's open SSE gets NO new event", not any(e[1].get("record", {}).get("id") == m2.get("id") for e in sse_b.events))
st, _ = call("POST", CM, {"conversation": gid, "sender": B["id"], "text": "still here?"}, B["token"])
g.rejected("left member cannot post", st)
g.check("control: C (still member) received the post live", sse_c.wait_for(lambda e: e[1].get("record", {}).get("id") == m2.get("id")) is not None)

# --- owner deletes group; messages cascade ---
st, _ = call("DELETE", f"{CV}/{gid}", token=A["token"])
g.check("owner deletes the group", st == 204, st)
st, lst = call("GET", f"/api/collections/conversation_messages/records?filter=conversation='{gid}'", token=admin)
g.check("messages cascaded with the group", st == 200 and lst.get("totalItems", -1) == 0, f"{st} {lst.get('totalItems')}")

for s in (sse_b, sse_c, sse_s):
    s.close()
users.cleanup(made)
g.done()
