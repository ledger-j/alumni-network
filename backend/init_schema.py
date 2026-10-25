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

# --- premium feature layer -------------------------------------------------
# Design decisions (SFC ledger, slug unicircle):
#  - users.supporter is the single runtime premium gate; `membership` is the
#    billing/history record only (admin-written, never read by gating rules).
#  - RSVP/vote idempotency via join collections with a UNIQUE composite index;
#    counters are derived display values, never client-patched.
#  - Deep directory data lives in `profiles_deep` (split-collection gating),
#    because PB API rules are row-level only — no per-tier field hiding.


def ensure(spec):
    """Create the collection, or patch rules/fields/indexes if it already exists,
    so rule changes propagate on re-run (true idempotency)."""
    st, r = req("POST", "/api/collections", spec)
    if st == 200:
        print(f"{spec['name']} create:", st)
        return r["id"]
    st2, existing = req("GET", f"/api/collections/{spec['name']}")
    if st2 != 200:
        print(f"{spec['name']} create FAILED:", st, r)
        return None
    have = {f["name"] for f in existing.get("fields", [])}
    patch = {k: spec.get(k) for k in ("listRule", "viewRule", "createRule", "updateRule", "deleteRule", "indexes") if k in spec}
    patch["fields"] = existing["fields"] + [f for f in spec["fields"] if f["name"] not in have]
    st3, r3 = req("PATCH", f"/api/collections/{existing['id']}", patch)
    print(f"{spec['name']} ensure:", st3, r3.get("name") or r3)
    return existing["id"]


# 4) mentorships — participants manage their own record
ensure({
    "name": "mentorships", "type": "base",
    "listRule": AUTHED, "viewRule": AUTHED,
    "createRule": '@request.auth.id != "" && (mentor = @request.auth.id || mentee = @request.auth.id)',
    "updateRule": "mentor = @request.auth.id || mentee = @request.auth.id",
    "deleteRule": None,
    "fields": [relation("mentor", USERS_ID, True), relation("mentee", USERS_ID, True),
               text("topic", True, 160), text("status", True, 20),  # requested|active|closed
               created(), updated()],
})

# 5) speaker_requests — authed read/create as self; requester updates
ensure({
    "name": "speaker_requests", "type": "base",
    "listRule": AUTHED, "viewRule": AUTHED,
    "createRule": '@request.auth.id != "" && requester = @request.auth.id',
    "updateRule": "requester = @request.auth.id",
    "deleteRule": "requester = @request.auth.id",
    "fields": [relation("requester", USERS_ID, True), text("topic", True, 160),
               text("format", False, 20),  # lecture|guest-talk
               text("status", False, 20), created()],
})

# 6) ideas — vote count derives from idea_votes, no client-writable counter
ideas_id = ensure({
    "name": "ideas", "type": "base",
    "listRule": AUTHED, "viewRule": AUTHED,
    "createRule": '@request.auth.id != "" && author = @request.auth.id',
    "updateRule": "author = @request.auth.id",
    "deleteRule": "author = @request.auth.id",
    "fields": [relation("author", USERS_ID, True), text("title", True, 140),
               text("body", False, 4000), text("category", False, 40),
               created(), updated()],
})

# 7) idea_votes — one vote per user per idea, enforced by UNIQUE index
if ideas_id:
    ensure({
        "name": "idea_votes", "type": "base",
        "listRule": AUTHED, "viewRule": AUTHED,
        "createRule": '@request.auth.id != "" && user = @request.auth.id',
        "updateRule": None,
        "deleteRule": "user = @request.auth.id",
        "indexes": ["CREATE UNIQUE INDEX `idx_idea_votes_user_idea` ON `idea_votes` (`user`, `idea`)"],
        "fields": [relation("user", USERS_ID, True), relation("idea", ideas_id, True), created()],
    })

# 8) chapters — admin-curated city hubs
chapters_id = ensure({
    "name": "chapters", "type": "base",
    "listRule": AUTHED, "viewRule": AUTHED,
    "createRule": None, "updateRule": None, "deleteRule": None,
    "fields": [text("name", True, 80), text("city", False, 80), created()],
})

# 9) events — admin-curated; RSVP state lives in `rsvps`
events_id = None
if chapters_id:
    events_id = ensure({
        "name": "events", "type": "base",
        "listRule": AUTHED, "viewRule": AUTHED,
        "createRule": None, "updateRule": None, "deleteRule": None,
        "fields": [relation("chapter", chapters_id, False), text("title", True, 160),
                   text("date", False, 30), text("location", False, 120), created()],
    })

# 10) rsvps — one RSVP per user per event, enforced by UNIQUE index
if events_id:
    ensure({
        "name": "rsvps", "type": "base",
        "listRule": AUTHED, "viewRule": AUTHED,
        "createRule": '@request.auth.id != "" && user = @request.auth.id',
        "updateRule": None,
        "deleteRule": "user = @request.auth.id",
        "indexes": ["CREATE UNIQUE INDEX `idx_rsvps_user_event` ON `rsvps` (`user`, `event`)"],
        "fields": [relation("user", USERS_ID, True), relation("event", events_id, True), created()],
    })

# 11) ll_sessions — lifelong-learning sessions; admin-created, member-read
ensure({
    "name": "ll_sessions", "type": "base",
    "listRule": AUTHED, "viewRule": AUTHED,
    "createRule": None, "updateRule": None, "deleteRule": None,
    "fields": [text("title", True, 160), text("faculty", False, 120),
               text("date", False, 30), number("reward_comp"), created()],
})

# 12) membership — billing/history record; a member sees only their own;
#     written by server/admin only (clients can never self-upgrade tier).
ensure({
    "name": "membership", "type": "base",
    "listRule": "user = @request.auth.id", "viewRule": "user = @request.auth.id",
    "createRule": None, "updateRule": None, "deleteRule": None,
    "fields": [relation("user", USERS_ID, True), text("tier", True, 12),  # basic|premium
               number("monthly_fee"), text("status", False, 20),  # active|lapsed|trialing
               text("started", False, 30), created(), updated()],
})

# 13) profiles_deep — premium-gated deep directory data (split-collection gate:
#     supporters can search it; owners always see/edit their own row).
ensure({
    "name": "profiles_deep", "type": "base",
    "listRule": "@request.auth.supporter = true || user = @request.auth.id",
    "viewRule": "@request.auth.supporter = true || user = @request.auth.id",
    "createRule": '@request.auth.id != "" && user = @request.auth.id',
    "updateRule": "user = @request.auth.id",
    "deleteRule": "user = @request.auth.id",
    "indexes": ["CREATE UNIQUE INDEX `idx_profiles_deep_user` ON `profiles_deep` (`user`)"],
    "fields": [relation("user", USERS_ID, True), text("cohort", False, 40),
               text("discipline", False, 120), text("city", False, 80),
               text("company", False, 120), text("position_history", False, 4000),
               boolf("email_visible"), text("contact_email", False, 255), created(), updated()],
})

st, cols = req("GET", "/api/collections?perPage=200")
print("collections now:", sorted(c["name"] for c in cols.get("items", [])))
