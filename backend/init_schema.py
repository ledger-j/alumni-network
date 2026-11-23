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
         boolf("mentor"), text("mentor_offer", maxlen=255),
         # student tutoring: role = alumnus | student | staff; a tutor lists subjects
         text("role", maxlen=20), boolf("tutor"), text("tutor_subjects", maxlen=200)]
merged = users["fields"] + [f for f in extra if f["name"] not in existing]
# Security: the alumni directory is authenticated-only — anonymous visitors can
# sign up (createRule stays open) but cannot list/scrape member profiles. This is
# also the groundwork for premium-gating deeper directory search.
AUTHED = '@request.auth.id != ""'
# Members may edit their own profile but not grant themselves premium (`supporter`);
# only the server/admin sets that flag.
# The same guard applies at signup (createRule is open): nobody can sign up as a supporter.
# `role` is self-declared and trusted by nothing server-side, but only the known values are
# accepted so it can never be used to smuggle in e.g. "admin".
NO_SUPPORTER = '@request.body.supporter:isset = false'
ROLE_OK = ('(@request.body.role:isset = false || @request.body.role = "" || @request.body.role = "alumnus"'
           ' || @request.body.role = "student" || @request.body.role = "staff")')
SELF_UPDATE = f'id = @request.auth.id && {NO_SUPPORTER} && {ROLE_OK}'
SELF_CREATE = f'{NO_SUPPORTER} && {ROLE_OK}'
st, r = req("PATCH", f"/api/collections/{USERS_ID}",
            {"fields": merged, "listRule": AUTHED, "viewRule": AUTHED,
             "createRule": SELF_CREATE, "updateRule": SELF_UPDATE})
print("users extend:", st, r.get("name") or r)


def upsert(name, spec):
    """Create the collection, or (if it exists) patch only its API rules."""
    st, cur = req("GET", f"/api/collections/{name}")
    if st == 200:
        rules = {k: spec[k] for k in ("listRule", "viewRule", "createRule", "updateRule", "deleteRule") if k in spec}
        have = {f["name"] for f in cur.get("fields", [])}
        add = [f for f in spec["fields"] if f["name"] not in have]
        body = dict(rules)
        if add:
            body["fields"] = cur["fields"] + add
        st, r = req("PATCH", f"/api/collections/{cur['id']}", body)
        print(f"{name} update:", st, "(+fields: " + ",".join(f["name"] for f in add) + ")" if add else "")
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
    "fields": [relation("author", USERS_ID, True), text("text", True, 5000),
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
    "fields": [relation("sender", USERS_ID, True), relation("recipient", USERS_ID, True),
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
                   " && @request.body.status = \"requested\" && " + KINDS),
    "updateRule": ("((mentor = @request.auth.id && (@request.body.status = \"active\" || @request.body.status = \"closed\"))"
                   " || (mentee = @request.auth.id && @request.body.status = \"closed\")) && " + IMMUTABLE),
    "deleteRule": None,
    "fields": [relation("mentor", USERS_ID, True), relation("mentee", USERS_ID, True),
               text("kind", True, 20), text("topic", False, 160), text("status", True, 20),
               created(), updated()],
}
upsert("mentorships", mentorships)

st, cols = req("GET", "/api/collections?perPage=200")
print("collections now:", sorted(c["name"] for c in cols.get("items", [])))
