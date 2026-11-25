#!/usr/bin/env python3
"""Gate for the chat rules: privacy between members, immutable text, realtime delivery.

Run:  PB_BASE=http://127.0.0.1:8090 PB_TOKEN=<superuser token> python3 verify_chat.py
Needs init_schema.py to have run first. Throwaway users/records, removed at the end.
"""
import time
from vt_common import call, admin_token, Gate, Users, Sse

admin = admin_token()
g, users = Gate("chat rules + realtime"), Users(admin)
A, B, C = users.make("a"), users.make("b"), users.make("c")
M = "/api/collections/messages/records"
made = []

# --- happy path: A writes to B; B and A can read it (N > 0 collected) ---
sse = Sse(B["token"], ["messages"])
g.check("realtime: SSE connected and subscribed", sse.wait_ready())
st, m = call("POST", M, {"sender": A["id"], "recipient": B["id"], "text": "hello B", "read": False}, A["token"])
g.check("A can send to B", st == 200, st)
mid = m.get("id")
made.append(f"{M}/{mid}")
ev = sse.wait_for(lambda e: e[0] == "messages" and e[1].get("record", {}).get("id") == mid)
g.check("realtime: B receives A's message over SSE", ev is not None)
st, lst = call("GET", M, token=B["token"])
g.check("B lists the message (collected N > 0)",
        st == 200 and lst.get("totalItems", 0) > 0 and any(i["id"] == mid for i in lst["items"]), st)
st, lst = call("GET", M, token=A["token"])
g.check("A (sender) lists it too", st == 200 and any(i["id"] == mid for i in lst.get("items", [])), st)

# --- privacy: a stranger sees nothing, can't view, can't receive it live ---
sse_c = Sse(C["token"], ["messages"])
sse_c.wait_ready()
st, m2 = call("POST", M, {"sender": A["id"], "recipient": B["id"], "text": "second", "read": False}, A["token"])
made.append(f"{M}/{m2.get('id')}")
st, lst = call("GET", M, token=C["token"])
g.check("stranger C lists zero messages", st == 200 and lst.get("totalItems", 0) == 0,
        f"{st} {lst.get('totalItems')}")
st, _ = call("GET", f"{M}/{mid}", token=C["token"])
g.rejected("stranger C cannot view the A->B message", st)
st, lst = call("GET", M)
g.check("anonymous lists zero messages", st in (200, 403) and lst.get("totalItems", 0) == 0, st)
time.sleep(1.0)
g.check("realtime: stranger C gets no event for A->B", not any(e[0] == "messages" for e in sse_c.events))

# --- forging: C cannot send as A ---
st, _ = call("POST", M, {"sender": A["id"], "recipient": B["id"], "text": "forged", "read": False}, C["token"])
g.rejected("C cannot send with sender=A", st)

# --- update rule: recipient may flip `read` only ---
st, _ = call("PATCH", f"{M}/{mid}", {"read": True}, B["token"])
g.check("recipient B can set read=true", st == 200, st)
st, _ = call("PATCH", f"{M}/{mid}", {"text": "tampered"}, B["token"])
g.rejected("recipient B cannot rewrite the text", st)
st, _ = call("PATCH", f"{M}/{mid}", {"sender": C["id"]}, B["token"])
g.rejected("recipient B cannot change the sender", st)
st, _ = call("PATCH", f"{M}/{mid}", {"recipient": C["id"]}, B["token"])
g.rejected("recipient B cannot redirect to C", st)
st, _ = call("PATCH", f"{M}/{mid}", {"read": True}, A["token"])
g.rejected("sender A cannot mark read on B's behalf", st)
st, _ = call("PATCH", f"{M}/{mid}", {"read": True}, C["token"])
g.rejected("stranger C cannot update", st)
st, cur = call("GET", f"{M}/{mid}", token=B["token"])
g.check("text unchanged after the attacks", cur.get("text") == "hello B" and cur.get("read") is True,
        cur.get("text"))

# --- delete: nobody but the superuser ---
for who, tok in (("A", A["token"]), ("B", B["token"])):
    st, _ = call("DELETE", f"{M}/{mid}", token=tok)
    g.rejected(f"{who} cannot delete a message", st)

sse.close()
sse_c.close()
users.cleanup(made)
g.done()
