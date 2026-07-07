#!/usr/bin/env python3
"""UniCircle PocketBase schema initialiser (idempotent).

Extends the built-in `users` auth collection with profile + LinkedIn fields,
and creates `posts` and `messages` collections with sensible API rules.
Reads the live collection format first so it stays correct across PB versions.

Run on the box:  PB_TOKEN=$(cat /opt/unicircle/.admin_token) python3 init_schema.py
"""
import json, os, urllib.request, urllib.error

BASE = os.environ.get("PB_BASE", "http://127.0.0.1:8090")
TOKEN = os.environ["PB_TOKEN"]
USERS_ID = "_pb_users_auth_"


def req(method, path, body=None):
    data = json.dumps(body).encode() if body is not None else None
    r = urllib.request.Request(BASE + path, data=data, method=method,
                               headers={"Authorization": TOKEN, "Content-Type": "application/json"})
    try:
        with urllib.request.urlopen(r, timeout=20) as resp:
            return resp.status, json.loads(resp.read() or "{}")
    except urllib.error.HTTPError as e:
        try:
            return e.code, json.loads(e.read() or "{}")
        except Exception:
            return e.code, {}


# --- field builders (v0.39 "fields" object format) ---
def text(name, required=False, maxlen=0):
    return {"type": "text", "name": name, "required": required, "min": 0, "max": maxlen,
            "pattern": "", "autogeneratePattern": "", "hidden": False, "presentable": False, "system": False}

def urlf(name, required=False):
    return {"type": "url", "name": name, "required": required, "exceptDomains": None,
            "onlyDomains": None, "hidden": False, "presentable": False, "system": False}

def boolf(name):
    return {"type": "bool", "name": name, "required": False, "hidden": False, "presentable": False, "system": False}

def number(name):
    return {"type": "number", "name": name, "required": False, "min": None, "max": None,
            "onlyInt": False, "hidden": False, "presentable": False, "system": False}

def relation(name, coll_id, required=True):
    return {"type": "relation", "name": name, "required": required, "collectionId": coll_id,
            "cascadeDelete": False, "minSelect": 0, "maxSelect": 1, "hidden": False,
            "presentable": False, "system": False}

def created():
    return {"type": "autodate", "name": "created", "onCreate": True, "onUpdate": False,
            "hidden": False, "presentable": False, "system": False}

def updated():
    return {"type": "autodate", "name": "updated", "onCreate": True, "onUpdate": True,
            "hidden": False, "presentable": False, "system": False}


# 1) Extend `users` with profile + LinkedIn fields (merge to preserve system fields)
st, users = req("GET", f"/api/collections/{USERS_ID}")
existing = {f["name"] for f in users.get("fields", [])}
extra = [text("headline", maxlen=255), text("location", maxlen=120), text("degree", maxlen=120),
         urlf("linkedin_url"), boolf("linkedin_imported"), boolf("supporter"),
         boolf("mentor"), text("mentor_offer", maxlen=255)]
merged = users["fields"] + [f for f in extra if f["name"] not in existing]
# Security: the alumni directory is authenticated-only — anonymous visitors can
# sign up (createRule stays open) but cannot list/scrape member profiles. This is
# also the groundwork for premium-gating deeper directory search.
AUTHED = '@request.auth.id != ""'
st, r = req("PATCH", f"/api/collections/{USERS_ID}",
            {"fields": merged, "listRule": AUTHED, "viewRule": AUTHED})
print("users extend:", st, r.get("name") or r)

# 2) posts
posts = {
    "name": "posts", "type": "base",
    "listRule": "", "viewRule": "",
    "createRule": "@request.auth.id != ''",
    "updateRule": "author = @request.auth.id",
    "deleteRule": "author = @request.auth.id",
    "fields": [relation("author", USERS_ID, True), text("text", True, 5000),
               urlf("image", False), text("degree", False, 20), number("likes"),
               created(), updated()],
}
st, r = req("POST", "/api/collections", posts)
print("posts create:", st, r.get("name") or r)

# 3) messages (1:1 chat)
messages = {
    "name": "messages", "type": "base",
    "listRule": "sender = @request.auth.id || recipient = @request.auth.id",
    "viewRule": "sender = @request.auth.id || recipient = @request.auth.id",
    "createRule": "sender = @request.auth.id",
    "updateRule": "recipient = @request.auth.id",
    "deleteRule": None,
    "fields": [relation("sender", USERS_ID, True), relation("recipient", USERS_ID, True),
               text("text", True, 5000), boolf("read"), created()],
}
st, r = req("POST", "/api/collections", messages)
print("messages create:", st, r.get("name") or r)

st, cols = req("GET", "/api/collections?perPage=200")
print("collections now:", sorted(c["name"] for c in cols.get("items", [])))
