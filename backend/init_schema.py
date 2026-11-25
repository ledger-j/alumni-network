#!/usr/bin/env python3
"""UniCircle PocketBase schema initialiser (idempotent).

Extends the built-in `users` auth collection with profile + LinkedIn + mentor/tutor
fields, and creates/updates `posts`, `messages` (chat) and `mentorships` (mentoring and
tutoring requests) with API rules. Re-running it also tightens the rules on collections
that already exist (rules are patched, fields are only added, never removed).
Reads the live collection format first so it stays correct across PB versions.

Run on the box:  PB_TOKEN=<superuser token> python3 init_schema.py
   or:            PB_IDENTITY=<superuser email> PB_PASSWORD=<password> python3 init_schema.py
"""
import json, os, urllib.request, urllib.error

BASE = os.environ.get("PB_BASE", "http://127.0.0.1:8090")
USERS_ID = "_pb_users_auth_"


def _superuser_token():
    """PB_TOKEN if set; otherwise log in with PB_IDENTITY + PB_PASSWORD (superuser).
    Stored admin tokens expire, so the login route avoids a stale-token 401."""
    tok = os.environ.get("PB_TOKEN")
    if tok:
        return tok
    ident, pw = os.environ.get("PB_IDENTITY"), os.environ.get("PB_PASSWORD")
    if not (ident and pw):
        raise SystemExit("set PB_TOKEN, or PB_IDENTITY + PB_PASSWORD (superuser login)")
    r = urllib.request.Request(BASE + "/api/collections/_superusers/auth-with-password",
                               data=json.dumps({"identity": ident, "password": pw}).encode(),
                               method="POST", headers={"Content-Type": "application/json"})
    try:
        with urllib.request.urlopen(r, timeout=20) as resp:
            return json.loads(resp.read())["token"]
    except urllib.error.HTTPError as e:
        raise SystemExit(f"superuser login failed: HTTP {e.code}")


TOKEN = _superuser_token()


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

def number(name, lo=None, hi=None, int_only=False):
    return {"type": "number", "name": name, "required": False, "min": lo, "max": hi,
            "onlyInt": int_only, "hidden": False, "presentable": False, "system": False}

def datef(name, required=False):
    return {"type": "date", "name": name, "required": required, "min": "", "max": "",
            "hidden": False, "presentable": False, "system": False}

def filef(name, max_size, mimes, thumbs=None, protected=False, required=False):
    return {"type": "file", "name": name, "required": required, "maxSelect": 1, "maxSize": max_size,
            "mimeTypes": mimes, "thumbs": thumbs or [], "protected": protected,
            "hidden": False, "presentable": False, "system": False}

def relation(name, coll_id, required=True, cascade=False, max_select=1):
    return {"type": "relation", "name": name, "required": required, "collectionId": coll_id,
            "cascadeDelete": cascade, "minSelect": 0, "maxSelect": max_select, "hidden": False,
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
IMG = ["image/jpeg", "image/png", "image/webp"]
extra = [text("headline", maxlen=255), text("location", maxlen=120), text("degree", maxlen=120),
         urlf("linkedin_url"), boolf("linkedin_imported"), boolf("supporter"),
         boolf("mentor"), text("mentor_offer", maxlen=255),
         # student tutoring: role = alumnus | student | staff; a tutor lists subjects
         text("role", maxlen=20), boolf("tutor"), text("tutor_subjects", maxlen=200),
         # round 2: status points (server-written only), inbox protection, cover picture
         number("points", 0, 100000, True), text("contact_mode", maxlen=12), number("min_points", 0, 10000, True),
         boolf("accepts_internship"), boolf("accepts_mentoring"), boolf("accepts_collab"),
         filef("cover", 5242880, IMG, ["400x133", "1200x400", "792x198", "1584x396"])]
# Existing `avatar` (PocketBase default file field): images only, 2 MB, thumbnails.
fields = []
have_users = {f["name"] for f in users["fields"]}
for f in users["fields"]:
    if f["name"] == "avatar" and f.get("type") == "file":
        f = dict(f, mimeTypes=IMG, maxSize=2097152, thumbs=["64x64", "100x100", "256x256"])
    fields.append(f)
merged = fields + [f for f in extra if f["name"] not in have_users]
# Security: the alumni directory is authenticated-only. Anonymous visitors can sign up
# (createRule stays open) but cannot list/scrape member profiles.
AUTHED = '@request.auth.id != ""'
# Members may edit their own profile but never the server-owned fields: `supporter`
# (premium) and `points` (written only by the points hook). The same guard applies at
# signup. `role` and `contact_mode` accept known values only.
NO_SERVER = '@request.body.supporter:isset = false && @request.body.points:isset = false'
ROLE_OK = ('(@request.body.role:isset = false || @request.body.role = "" || @request.body.role = "alumnus"'
           ' || @request.body.role = "student" || @request.body.role = "staff")')
CM_OK = ('(@request.body.contact_mode:isset = false || @request.body.contact_mode = "" || @request.body.contact_mode = "open"'
         ' || @request.body.contact_mode = "points" || @request.body.contact_mode = "request" || @request.body.contact_mode = "closed")')
SELF_UPDATE = f'id = @request.auth.id && {NO_SERVER} && {ROLE_OK} && {CM_OK}'
SELF_CREATE = f'{NO_SERVER} && {ROLE_OK} && {CM_OK}'
st, r = req("PATCH", f"/api/collections/{USERS_ID}",
            {"fields": merged, "listRule": AUTHED, "viewRule": AUTHED,
             "createRule": SELF_CREATE, "updateRule": SELF_UPDATE,
             "deleteRule": "id = @request.auth.id"})
print("users extend:", st, r.get("name") or r)


def upsert(name, spec):
    """Create the collection, or patch rules, indexes and fields of an existing one.
    Existing fields keep their id (so no column is dropped); the spec's attributes win."""
    st, cur = req("GET", f"/api/collections/{name}")
    if st == 200:
        body = {k: spec[k] for k in ("listRule", "viewRule", "createRule", "updateRule", "deleteRule", "indexes") if k in spec}
        byname = {f["name"]: f for f in cur.get("fields", [])}
        merged_fields = list(cur.get("fields", []))
        added = []
        for f in spec["fields"]:
            if f["name"] in byname:
                merged_fields[merged_fields.index(byname[f["name"]])] = dict(f, id=byname[f["name"]]["id"])
            else:
                merged_fields.append(f); added.append(f["name"])
        body["fields"] = merged_fields
        st, r = req("PATCH", f"/api/collections/{cur['id']}", body)
        print(f"{name} update:", st, ("(+fields: " + ",".join(added) + ")") if added else "", "" if st == 200 else r)
        return r
    st, r = req("POST", "/api/collections", spec)
    print(f"{name} create:", st, r.get("name") or r)
    return r

# 2) posts
posts = {
    "name": "posts", "type": "base",
    "listRule": "", "viewRule": "",
    "createRule": "@request.auth.id != ''",
    "updateRule": "author = @request.auth.id",
    "deleteRule": "author = @request.auth.id",
    "fields": [relation("author", USERS_ID, True, True), text("text", True, 5000),
               urlf("image", False), text("degree", False, 20), number("likes"),
               created(), updated()],
}
upsert("posts", posts)

# 3) messages (1:1 chat)
messages = {
    "name": "messages", "type": "base",
    "listRule": "sender = @request.auth.id || recipient = @request.auth.id",
    "viewRule": "sender = @request.auth.id || recipient = @request.auth.id",
    "createRule": "sender = @request.auth.id",
    # The recipient may only flip `read`: text, sender and recipient are immutable.
    "updateRule": ("recipient = @request.auth.id && @request.body.text:isset = false"
                   " && @request.body.sender:isset = false && @request.body.recipient:isset = false"),
    "deleteRule": None,
    "fields": [relation("sender", USERS_ID, True, True), relation("recipient", USERS_ID, True, True),
               text("text", True, 5000), boolf("read"), created()],
}
upsert("messages", messages)

# 4) mentorships: mentoring and tutoring requests between two members.
#    Only the two participants can see a request. The mentee creates it (status
#    `requested`); the mentor accepts/closes it; the mentee can only close it. Nobody
#    can change who, what or which kind after creation.
KINDS = '(@request.body.kind = "mentoring" || @request.body.kind = "tutoring")'
IMMUTABLE = ("@request.body.mentor:isset = false && @request.body.mentee:isset = false"
             " && @request.body.kind:isset = false && @request.body.topic:isset = false")
mentorships = {
    "name": "mentorships", "type": "base",
    "listRule": "mentor = @request.auth.id || mentee = @request.auth.id",
    "viewRule": "mentor = @request.auth.id || mentee = @request.auth.id",
    "createRule": ("@request.auth.id != '' && mentee = @request.auth.id && mentor != @request.auth.id"
                   " && @request.body.status = \"requested\" && @request.body.active_at:isset = false && " + KINDS),
    # participants edit goals/stage/next_session; status moves requested -> active -> closed
    # only (a closed mentorship is frozen); `active_at` is stamped by the server hook.
    "updateRule": ("status != \"closed\" && (mentor = @request.auth.id || mentee = @request.auth.id)"
                   " && (@request.body.status:isset = false"
                   " || (mentor = @request.auth.id && (@request.body.status = \"active\" || @request.body.status = \"closed\"))"
                   " || (mentee = @request.auth.id && @request.body.status = \"closed\"))"
                   " && @request.body.active_at:isset = false && " + IMMUTABLE),
    "deleteRule": None,
    "fields": [relation("mentor", USERS_ID, True, True), relation("mentee", USERS_ID, True, True),
               text("kind", True, 20), text("topic", False, 160), text("status", True, 20),
               text("goals", False, 500), text("stage", False, 20), datef("next_session"), datef("active_at"),
               created(), updated()],
}
upsert("mentorships", mentorships)

# ===================================================================================
# ROUND 2 collections (docs/redesign/objections.md). Cross-record checks that rules
# cannot express live in backend/pb_hooks/uc_rules.pb.js (contact rules, points,
# group membership, event limits, location snapping).
# ===================================================================================
AUTH = "@request.auth.id"
OWN = "user = @request.auth.id"
VERIFIED = "@request.auth.verified = true"

# --- member-only settings (UI colour etc.), owner-only read and write
user_settings = {
    "name": "user_settings", "type": "base",
    "listRule": OWN, "viewRule": OWN,
    "createRule": f"{AUTH} != '' && user = @request.auth.id",
    "updateRule": f"{OWN} && @request.body.user:isset = false",
    "deleteRule": OWN,
    "indexes": ["CREATE UNIQUE INDEX idx_user_settings_user ON user_settings (`user`)"],
    "fields": [relation("user", USERS_ID, True, True), number("accent_hue", 0, 360, True),
               boolf("show_attendance"), created(), updated()],
}
upsert("user_settings", user_settings)

# --- map location: opt-in (visible=false by default), grid-snapped by the hook, verified members only
user_locations = {
    "name": "user_locations", "type": "base",
    "listRule": f"{VERIFIED} && (visible = true || user = @request.auth.id)",
    "viewRule": f"{VERIFIED} && (visible = true || user = @request.auth.id)",
    "createRule": f"{VERIFIED} && user = @request.auth.id",
    "updateRule": f"{OWN} && @request.body.user:isset = false",
    "deleteRule": OWN,
    "indexes": ["CREATE UNIQUE INDEX idx_user_locations_user ON user_locations (`user`)"],
    "fields": [relation("user", USERS_ID, True, True), number("lat", -90, 90), number("lng", -180, 180),
               text("city", False, 80), boolf("visible"), created(), updated()],
}
upsert("user_locations", user_locations)

# --- in-depth profile: written by the member only (source = self / linkedin_import), never pre-filled for others
profiles_deep = {
    "name": "profiles_deep", "type": "base",
    "listRule": f"{AUTH} != '' && (visibility != \"private\" || user = @request.auth.id)",
    "viewRule": f"{AUTH} != '' && (visibility != \"private\" || user = @request.auth.id)",
    "createRule": f"user = @request.auth.id && @request.body.is_sample:isset = false",
    "updateRule": f"{OWN} && @request.body.user:isset = false && @request.body.is_sample:isset = false",
    "deleteRule": OWN,
    "indexes": ["CREATE UNIQUE INDEX idx_profiles_deep_user ON profiles_deep (`user`)"],
    "fields": [relation("user", USERS_ID, True, True),
               text("experience", False, 2000), text("education", False, 1000), text("skills", False, 500),
               text("sectors", False, 300), text("languages", False, 200), text("offer", False, 500),
               text("seek", False, 500), urlf("link_linkedin"), urlf("link_site"),
               text("source", False, 20), text("visibility", False, 10), boolf("is_sample"), created(), updated()],
}
upsert("profiles_deep", profiles_deep)

# --- status points: written ONLY by the server hook; the owner can read their own ledger
points_ledger = {
    "name": "points_ledger", "type": "base",
    "listRule": OWN, "viewRule": OWN,
    "createRule": None, "updateRule": None, "deleteRule": None,
    "indexes": ["CREATE UNIQUE INDEX idx_points_ledger_ref ON points_ledger (`user`, `reason`, `ref`)",
                "CREATE INDEX idx_points_ledger_pair ON points_ledger (`pair_key`)"],
    "fields": [relation("user", USERS_ID, True, True), number("delta", -1000, 1000, True),
               text("reason", True, 20), text("ref", True, 60), text("pair_key", False, 40), created()],
}
upsert("points_ledger", points_ledger)

# --- block list (owner only); the contact hook honours it on every door
blocks = {
    "name": "blocks", "type": "base",
    "listRule": "blocker = @request.auth.id", "viewRule": "blocker = @request.auth.id",
    "createRule": "blocker = @request.auth.id && blocked != @request.auth.id",
    "updateRule": None, "deleteRule": "blocker = @request.auth.id",
    "indexes": ["CREATE UNIQUE INDEX idx_blocks_pair ON blocks (`blocker`, `blocked`)"],
    "fields": [relation("blocker", USERS_ID, True, True), relation("blocked", USERS_ID, True, True), created()],
}
upsert("blocks", blocks)

# --- collaboration / internship / mentoring requests (the "request" door of contact_mode)
KINDS_C = ('(@request.body.kind = "internship" || @request.body.kind = "mentoring" || @request.body.kind = "project"'
           ' || @request.body.kind = "event" || @request.body.kind = "other")')
IMM_C = ("@request.body.from:isset = false && @request.body.to:isset = false"
         " && @request.body.kind:isset = false && @request.body.message:isset = false")
collab_requests = {
    "name": "collab_requests", "type": "base",
    "listRule": "from = @request.auth.id || to = @request.auth.id",
    "viewRule": "from = @request.auth.id || to = @request.auth.id",
    "createRule": (f"from = @request.auth.id && to != @request.auth.id && @request.body.status = \"pending\" && {KINDS_C}"),
    "updateRule": ("to = @request.auth.id && status = \"pending\""
                   " && (@request.body.status = \"accepted\" || @request.body.status = \"declined\") && " + IMM_C),
    "deleteRule": "from = @request.auth.id && status = \"pending\"",
    "indexes": ["CREATE UNIQUE INDEX idx_collab_pending ON collab_requests (`from`, `to`) WHERE status = 'pending'"],
    "fields": [relation("from", USERS_ID, True, True), relation("to", USERS_ID, True, True),
               text("kind", True, 20), text("message", False, 500), text("status", True, 20), created(), updated()],
}
upsert("collab_requests", collab_requests)

# --- events (created from the map) and RSVPs
events = {
    "name": "events", "type": "base",
    "listRule": f"{AUTH} != '' && hidden = false", "viewRule": f"{AUTH} != '' && hidden = false",
    "createRule": (f"{VERIFIED} && host = @request.auth.id && @request.body.hidden:isset = false"
                   " && @request.body.going_count:isset = false"),
    "updateRule": ("host = @request.auth.id && @request.body.host:isset = false"
                   " && @request.body.hidden:isset = false && @request.body.going_count:isset = false"),
    "deleteRule": "host = @request.auth.id",
    "fields": [text("title", True, 120), text("description", False, 2000), datef("start", True), datef("end"),
               text("city", False, 80), number("lat", -90, 90), number("lng", -180, 180), text("place", False, 120),
               relation("host", USERS_ID, True, True), boolf("hidden"), number("going_count", 0, 100000, True),
               created(), updated()],
}
ev = upsert("events", events)
EV_ID = ev.get("id")
rsvps = {
    "name": "rsvps", "type": "base",
    "listRule": f"{OWN}", "viewRule": f"{OWN}",
    "createRule": f"user = @request.auth.id",
    "updateRule": None, "deleteRule": OWN,
    "indexes": ["CREATE UNIQUE INDEX idx_rsvps_pair ON rsvps (`event`, `user`)"],
    "fields": [relation("event", EV_ID, True, True), relation("user", USERS_ID, True, True), created()],
}
upsert("rsvps", rsvps)

# --- group chat: members live on the conversation (max 12); the hook validates adds and exposes /leave
conversations = {
    "name": "conversations", "type": "base",
    # `members.id ?=` (not `members ?=`): the bare form never matches a multi-relation in PocketBase 0.39.4
    "listRule": "members.id ?= @request.auth.id", "viewRule": "members.id ?= @request.auth.id",
    "createRule": f"{AUTH} != '' && owner = @request.auth.id",
    "updateRule": "owner = @request.auth.id && @request.body.owner:isset = false",
    "deleteRule": "owner = @request.auth.id",
    "fields": [text("title", True, 80), relation("owner", USERS_ID, True, True),
               relation("members", USERS_ID, False, False, 12), created(), updated()],
}
cv = upsert("conversations", conversations)
CV_ID = cv.get("id")
conversation_messages = {
    "name": "conversation_messages", "type": "base",
    "listRule": "conversation.members.id ?= @request.auth.id", "viewRule": "conversation.members.id ?= @request.auth.id",
    "createRule": "sender = @request.auth.id",
    "updateRule": None, "deleteRule": "sender = @request.auth.id",
    "fields": [relation("conversation", CV_ID, True, True), relation("sender", USERS_ID, True, True),
               text("text", True, 2000), created()],
}
upsert("conversation_messages", conversation_messages)

# --- mentoring documents: protected files, participants only, mentorship must be active (hook)
st, ms = req("GET", "/api/collections/mentorships")
MS_ID = ms.get("id")
DOCS = ["application/pdf", "image/png", "image/jpeg", "text/plain",
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document"]
mentorship_docs = {
    "name": "mentorship_docs", "type": "base",
    "listRule": "mentorship.mentor = @request.auth.id || mentorship.mentee = @request.auth.id",
    "viewRule": "mentorship.mentor = @request.auth.id || mentorship.mentee = @request.auth.id",
    "createRule": "uploader = @request.auth.id",
    "updateRule": "uploader = @request.auth.id && @request.body.uploader:isset = false && @request.body.mentorship:isset = false && @request.body.file:isset = false",
    "deleteRule": "uploader = @request.auth.id || mentorship.mentor = @request.auth.id",
    "fields": [relation("mentorship", MS_ID, True, True), relation("uploader", USERS_ID, True, True),
               filef("file", 10485760, DOCS, None, True, True), text("note", False, 300), created()],
}
upsert("mentorship_docs", mentorship_docs)

# --- optional: PocketBase rate limiting (OFF unless UC_RATE_LIMITS=1: it changes production behaviour)
if os.environ.get("UC_RATE_LIMITS") == "1":
    rules = [{"label": "*:auth", "maxRequests": 20, "duration": 60, "audience": ""},
             {"label": "users:create", "maxRequests": 5, "duration": 3600, "audience": ""},
             {"label": "messages:create", "maxRequests": 60, "duration": 60, "audience": ""},
             {"label": "conversation_messages:create", "maxRequests": 60, "duration": 60, "audience": ""},
             {"label": "collab_requests:create", "maxRequests": 20, "duration": 3600, "audience": ""},
             {"label": "events:create", "maxRequests": 10, "duration": 3600, "audience": ""},
             {"label": "/api/", "maxRequests": 600, "duration": 60, "audience": ""}]
    st, r = req("PATCH", "/api/settings", {"rateLimits": {"enabled": True, "rules": rules}})
    print("rate limits:", st, "" if st == 200 else r)

st, cols = req("GET", "/api/collections?perPage=200")
print("collections now:", sorted(c["name"] for c in cols.get("items", [])))
