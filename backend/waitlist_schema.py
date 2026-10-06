#!/usr/bin/env python3
"""UniCircle waitlist schema (idempotent) — adds two collections to PocketBase.

  waitlist          public sign-up form target. Anyone may CREATE one row
                    (consent required, unique email); nobody but superusers
                    and listed viewers may READ it. No updates, no deletes
                    from the API — the list is append-only for the public.
  waitlist_viewers  who (besides superusers) may read the waitlist, e.g. the
                    teammate running waitlist growth. Superuser-managed only,
                    so nobody can grant themselves access.

Privacy by design (GDPR data minimisation): the form stores a CITY and an
optional NEIGHBOURHOOD — never a street address or coordinates. The alumni map
and the student-exchange map are built on that same coarse location.

Run on the box — it asks for the PocketBase superuser email + password
(from /opt/unicircle/ADMIN_CREDENTIALS.txt); --verify also runs the gate:
  python3 waitlist_schema.py --verify
  # non-interactive alternatives: PB_TOKEN=<token> or PB_IDENTITY=<email> PB_PASSWORD=<pw>

Then grant a teammate read access (their UniCircle account must exist):
  ... python3 waitlist_schema.py --grant teammate@example.com
"""
import json, os, sys, urllib.request, urllib.error

BASE = os.environ.get("PB_BASE", "http://127.0.0.1:8090").rstrip("/")
TOKEN = os.environ.get("PB_TOKEN", "")
USERS_ID = "_pb_users_auth_"


def req(method, path, body=None, token=None):
    data = json.dumps(body).encode() if body is not None else None
    headers = {"Content-Type": "application/json"}
    if token or TOKEN:
        headers["Authorization"] = token or TOKEN
    r = urllib.request.Request(BASE + path, data=data, method=method, headers=headers)
    try:
        with urllib.request.urlopen(r, timeout=20) as resp:
            return resp.status, json.loads(resp.read() or "{}")
    except urllib.error.HTTPError as e:
        try:
            return e.code, json.loads(e.read() or "{}")
        except Exception:
            return e.code, {}


def ensure_token():
    global TOKEN
    if TOKEN:
        return
    ident, pw = os.environ.get("PB_IDENTITY"), os.environ.get("PB_PASSWORD")
    if not (ident and pw) and sys.stdin.isatty():
        # Interactive: ask for the PocketBase superuser login (password not echoed,
        # nothing stored). The login is in /opt/unicircle/ADMIN_CREDENTIALS.txt.
        import getpass
        try:
            ident = ident or input("PocketBase superuser email: ").strip()
            pw = pw or getpass.getpass("PocketBase superuser password: ")
        except (EOFError, KeyboardInterrupt):
            sys.exit("
Cancelled.")
    if not (ident and pw):
        sys.exit("Need PB_TOKEN, or PB_IDENTITY + PB_PASSWORD (superuser), or run in a terminal to be prompted.")
    st, r = req("POST", "/api/collections/_superusers/auth-with-password",
                {"identity": ident, "password": pw})
    if st != 200:
        sys.exit(f"superuser login failed: {st} {r.get('message')}")
    TOKEN = r["token"]


# --- field builders (v0.39 "fields" object format, as in init_schema.py) ---
def base(type_, name, required=False, **extra):
    f = {"type": type_, "name": name, "required": required,
         "hidden": False, "presentable": False, "system": False}
    f.update(extra)
    return f

def text(name, required=False, maxlen=0):
    return base("text", name, required, min=0, max=maxlen, pattern="", autogeneratePattern="")

def email(name, required=False):
    return base("email", name, required, exceptDomains=None, onlyDomains=None)

def boolf(name, required=False):
    return base("bool", name, required)

def select(name, values, max_select=1, required=False):
    return base("select", name, required, values=values, maxSelect=max_select)

def relation(name, coll_id, required=True):
    return base("relation", name, required, collectionId=coll_id, cascadeDelete=True,
                minSelect=0, maxSelect=1)

def created():
    return base("autodate", "created", onCreate=True, onUpdate=False)


ROLES = ["alumnus", "student", "university_staff", "other"]
INTERESTS = ["mentor_others", "find_a_mentor", "alumni_map", "student_exchange",
             "events", "jobs"]


def upsert(spec):
    """Create the collection, or patch rules/fields/indexes onto an existing one."""
    st, cur = req("GET", f"/api/collections/{spec['name']}")
    if st == 200:
        names = {f["name"] for f in cur.get("fields", [])}
        fields = cur["fields"] + [f for f in spec["fields"] if f["name"] not in names]
        body = {k: v for k, v in spec.items() if k not in ("name", "type", "fields")}
        body["fields"] = fields
        st, r = req("PATCH", f"/api/collections/{cur['id']}", body)
        print(f"{spec['name']} update:", st, r.get("name") or r)
        return r if st == 200 else cur
    st, r = req("POST", "/api/collections", spec)
    print(f"{spec['name']} create:", st, r.get("name") or r)
    if st != 200:
        sys.exit(1)
    return r


def main():
    ensure_token()

    # 1) viewers first — the waitlist read rule references it.
    viewers = upsert({
        "name": "waitlist_viewers", "type": "base",
        # Superuser-managed only (null rules): nobody can grant themselves access.
        "listRule": None, "viewRule": None,
        "createRule": None, "updateRule": None, "deleteRule": None,
        "fields": [relation("user", USERS_ID, True), created()],
        "indexes": ["CREATE UNIQUE INDEX idx_waitlist_viewers_user ON waitlist_viewers (user)"],
    })

    can_read = '@request.auth.id != "" && @collection.waitlist_viewers.user ?= @request.auth.id'
    upsert({
        "name": "waitlist", "type": "base",
        "listRule": can_read, "viewRule": can_read,
        # Public sign-up; consent must be explicitly true, and nobody can
        # smuggle in a `source` longer than a tag.
        "createRule": "@request.body.consent = true",
        "updateRule": None, "deleteRule": None,
        "fields": [
            email("email", True),
            text("name", False, 120),
            select("role", ROLES, 1, True),
            text("institution", False, 160),
            text("programme", False, 160),
            text("grad_year", False, 4),
            text("city", True, 80),
            text("neighbourhood", False, 80),   # coarse area only — never a street
            text("tutorial", False, 80),        # students: course / tutorial group
            select("interests", INTERESTS, len(INTERESTS)),
            boolf("consent", True),
            text("source", False, 60),          # e.g. "waitlist-page", "maxim-linkedin"
            created(),
        ],
        "indexes": [
            "CREATE UNIQUE INDEX idx_waitlist_email ON waitlist (email COLLATE NOCASE)",
            "CREATE INDEX idx_waitlist_city ON waitlist (city)",
        ],
    })

    if "--grant" in sys.argv:
        who = sys.argv[sys.argv.index("--grant") + 1]
        st, r = req("GET", "/api/collections/users/records?perPage=1&filter="
                    + urllib.request.quote(f'email="{who}"'))
        items = r.get("items", [])
        if not items:
            sys.exit(f"No UniCircle account with email {who} — they must sign up first.")
        st, r = req("POST", "/api/collections/waitlist_viewers/records", {"user": items[0]["id"]})
        print("grant:", who, st, "ok" if st == 200 else r.get("message") or r)

    st, cols = req("GET", "/api/collections?perPage=200")
    print("collections now:", sorted(c["name"] for c in cols.get("items", [])))

    if "--verify" in sys.argv:
        # Run the gate with the same login (no second password prompt).
        import runpy
        os.environ["PB_TOKEN"] = TOKEN
        print("\n--- verify_waitlist.py ---")
        runpy.run_path(os.path.join(os.path.dirname(os.path.abspath(__file__)), "verify_waitlist.py"), run_name="__main__")


if __name__ == "__main__":
    main()
