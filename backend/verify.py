#!/usr/bin/env python3
"""End-to-end smoke test: signup -> login -> first post -> chat message.
Creates throwaway records then deletes them, leaving the DB clean.

Run on the box:  PB_TOKEN=$(cat /opt/unicircle/.admin_token) python3 verify.py
"""
import json, os, time, urllib.request, urllib.error

BASE = os.environ.get("PB_BASE", "http://127.0.0.1:8090")
ADMIN = os.environ["PB_TOKEN"]


def call(method, path, body=None, token=None):
    data = json.dumps(body).encode() if body is not None else None
    h = {"Content-Type": "application/json"}
    if token:
        h["Authorization"] = token
    r = urllib.request.Request(BASE + path, data=data, method=method, headers=h)
    try:
        with urllib.request.urlopen(r, timeout=20) as resp:
            return resp.status, json.loads(resp.read() or "{}")
    except urllib.error.HTTPError as e:
        try:
            return e.code, json.loads(e.read() or "{}")
        except Exception:
            return e.code, {}


stamp = str(int(time.time()))
ok = True

# 1) signup (open createRule) — "generate account"
u = {"email": f"smoke_{stamp}@unicircle.eu", "password": "Test123456!", "passwordConfirm": "Test123456!",
     "name": "Smoke Test", "headline": "Verifying the stack"}
st, rec = call("POST", "/api/collections/users/records", u)
print("signup:", st)
ok &= st == 200
uid = rec.get("id")

# 2) login
st, auth = call("POST", "/api/collections/users/auth-with-password",
                {"identity": u["email"], "password": u["password"]})
print("login:", st)
ok &= st == 200
utoken = auth.get("token")

# 3) first post
st, post = call("POST", "/api/collections/posts/records",
                {"author": uid, "text": "Hello UniCircle 👋 first post from the live backend.", "likes": 0}, token=utoken)
print("first post:", st)
ok &= st == 200
pid = post.get("id")

# 4) chat message (to self, just to exercise the collection)
st, msg = call("POST", "/api/collections/messages/records",
               {"sender": uid, "recipient": uid, "text": "ping", "read": False}, token=utoken)
print("chat message:", st)
ok &= st == 200
mid = msg.get("id")

# 5) public feed read
st, feed = call("GET", "/api/collections/posts/records?perPage=1")
print("public feed read:", st, "items:", feed.get("totalItems"))
ok &= st == 200

# cleanup (admin)
for path in (f"/api/collections/messages/records/{mid}" if mid else None,
             f"/api/collections/posts/records/{pid}" if pid else None,
             f"/api/collections/users/records/{uid}" if uid else None):
    if path:
        call("DELETE", path, token=ADMIN)
print("cleanup: done")
print("RESULT:", "PASS ✅" if ok else "FAIL ❌")
