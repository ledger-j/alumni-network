#!/usr/bin/env python3
"""UniCircle waitlist survey schema (idempotent) — adds one collection to PocketBase.

  waitlist_survey   answers to the optional questions shown AFTER someone has
                    joined the waitlist. Anyone may CREATE one row, but only for
                    an email that is already on the waitlist, and only once per
                    email (unique, any letter case). Readable by exactly the
                    people who can read the waitlist (superusers + listed
                    viewers). No updates, no deletes from the API.

Why a second collection: `waitlist` is append-only for the public (no update
rule), so the answers cannot be patched onto the sign-up row. They are linked
to it by email instead.

GDPR erasure: the unsubscribe link deletes the `waitlist` row. The hook
pb_hooks/waitlist_survey.pb.js then deletes the survey row for the same email.
Copy that file next to waitlist.pb.js on the box, or the answers outlive the
sign-up (--verify fails if the hook is not loaded).

Run on the box AFTER waitlist_schema.py (this reuses its login + helpers, and
the read rule is copied from the live `waitlist` collection):
  python3 waitlist_survey_schema.py --verify
  # non-interactive alternatives: PB_TOKEN=<token> or PB_IDENTITY=<email> PB_PASSWORD=<pw>

--verify is a non-vacuous gate (exits 1 on any failure). It proves, against a
live PocketBase:
  1. an anonymous visitor CAN save a survey for an email that is on the waitlist,
  2. a survey for an email that is NOT on the waitlist is refused,
  3. a second survey for the same email is refused (prints status + error code),
  4. an anonymous visitor CANNOT list or read surveys (0 rows visible),
  5. an anonymous visitor CANNOT edit or delete a survey row,
  6. deleting the waitlist row deletes its survey row (needs the hook loaded),
then deletes its own test rows (superuser). Test addresses are @example.invalid.
"""
import json, os, sys, time, urllib.parse, urllib.request, urllib.error
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import waitlist_schema as ws  # reuses req() + ensure_token() + field builders + upsert()

NAME = "waitlist_survey"
# Public create, but only for an email that already has a waitlist row. Compared
# in lower case: the waitlist treats Ada@x.org and ada@x.org as one person (its
# unique index is NOCASE), so someone "already on the list" under another letter
# case can still answer, and a second answer still hits the unique-email error.
CREATE_RULE = "@collection.waitlist.email:lower ?= @request.body.email:lower"
# The answer fields the form sends (all plain strings, any may be empty). Each tap
# question also has an "Other" choice with the person's own words, sent as
# "other: <words>" (max 120 typed characters), so the tap fields leave room for that.
ANSWERS = [("city", 80), ("source", 60), ("situation", 200), ("goal", 200),
           ("obstacle", 300), ("tried", 300), ("commitment", 200), ("sector", 80),
           ("note", 1000)]


def main():
    ws.ensure_token()

    # The waitlist must exist first: the create rule references it, and the
    # survey is readable by exactly whoever may read the waitlist.
    st, wl = ws.req("GET", "/api/collections/waitlist")
    if st != 200:
        sys.exit(f"`waitlist` collection not found ({st}) — run waitlist_schema.py first.")
    can_read = wl.get("listRule")
    if can_read == "":
        sys.exit("`waitlist` is publicly readable (empty listRule) — refusing to copy that onto the survey.")

    ws.upsert({
        "name": NAME, "type": "base",
        "listRule": can_read, "viewRule": can_read,
        "createRule": CREATE_RULE,
        "updateRule": None, "deleteRule": None,
        "fields": [ws.email("email", True), ws.select("role", ws.ROLES, 1, True)]
                  + [ws.text(name, False, maxlen) for name, maxlen in ANSWERS]
                  + [ws.created()],
        "indexes": [
            f"CREATE UNIQUE INDEX idx_{NAME}_email ON {NAME} (email COLLATE NOCASE)",
        ],
    })

    st, cols = ws.req("GET", "/api/collections?perPage=200")
    print("collections now:", sorted(c["name"] for c in cols.get("items", [])))

    if "--verify" in sys.argv:
        print(f"\n--- verify {NAME} ---")
        verify()


# --- the gate -----------------------------------------------------------------
def anon(method, path, body=None):
    """Like ws.req() but never sends an Authorization header; keeps error bodies."""
    data = json.dumps(body).encode() if body is not None else None
    r = urllib.request.Request(ws.BASE + path, data=data, method=method,
                               headers={"Content-Type": "application/json"})
    try:
        with urllib.request.urlopen(r, timeout=20) as resp:
            return resp.status, json.loads(resp.read() or "{}")
    except urllib.error.HTTPError as e:
        try:
            return e.code, json.loads(e.read() or "{}")
        except Exception:
            return e.code, {}


def su_rows(coll, mail):
    """Superuser view: the rows of `coll` for one email (any letter case)."""
    flt = urllib.parse.quote(f'email:lower="{mail.lower()}"')
    st, r = ws.req("GET", f"/api/collections/{coll}/records?perPage=50&filter={flt}")
    return r.get("items", []) if st == 200 else []


def verify():
    fails, passes = [], []
    def check(ok, label):
        (passes if ok else fails).append(label)
        print(("PASS " if ok else "FAIL ") + label)

    tag = f"verify-survey-{int(time.time())}"
    mail = f"{tag}@example.invalid"            # joins the waitlist
    stranger = f"{tag}-nobody@example.invalid"  # never joins
    records = f"/api/collections/{NAME}/records"
    survey = {"email": mail, "role": "student", "city": "Testville", "source": "a friend",
              "situation": "studying", "goal": "find_a_mentor", "obstacle": "no network yet",
              "tried": "linkedin, career_service", "commitment": "1h_week", "sector": "",
              "note": "verify bot"}
    try:
        st, joined = anon("POST", "/api/collections/waitlist/records",
                          {"email": mail, "name": "Verify Bot", "role": "student",
                           "city": "Testville", "consent": True, "source": tag})
        check(st == 200 and bool(joined.get("id")), f"setup: test email joined the waitlist (got {st})")

        # 1. on the waitlist → may save a survey; the answers land exactly as sent
        st, made = anon("POST", records, survey)
        check(st == 200 and bool(made.get("id")), f"1. anonymous survey for a waitlist email → 200 (got {st})")
        stored = su_rows(NAME, mail)
        same = len(stored) == 1 and all(stored[0].get(k) == v for k, v in survey.items())
        check(same, f"1. superuser sees exactly 1 survey row with every answer as sent (rows: {len(stored)})")

        # 2. not on the waitlist → refused, and nothing is stored
        st, r = anon("POST", records, {**survey, "email": stranger})
        check(st == 400, f"2. survey for an email NOT on the waitlist refused (got {st}, data={json.dumps(r.get('data'))})")
        check(len(su_rows(NAME, stranger)) == 0, "2. ...and no row was stored for it")

        # 3. once per email
        st, r = anon("POST", records, {**survey, "note": "second try"})
        code = ((r.get("data") or {}).get("email") or {}).get("code", "")
        check(st == 400 and "unique" in code.lower(),
              f"3. second survey for the same email refused (got {st}, data.email.code={code!r})")
        check(len(su_rows(NAME, mail)) == 1, "3. ...and there is still exactly 1 row")

        # 4. the public cannot read answers
        st, lst = anon("GET", records + "?perPage=50")
        check(st in (200, 403) and not lst.get("items"),
              f"4. anonymous list sees 0 rows (got {st}, {len(lst.get('items', []))})")
        if made.get("id"):
            st, _ = anon("GET", f"{records}/{made['id']}")
            check(st in (403, 404), f"4. anonymous read of one row refused (got {st})")

            # 5. the public cannot change or remove answers
            st, _ = anon("PATCH", f"{records}/{made['id']}", {"city": "Hacked"})
            check(st in (403, 404), f"5. anonymous update refused (got {st})")
            st, _ = anon("DELETE", f"{records}/{made['id']}")
            check(st in (403, 404), f"5. anonymous delete refused (got {st})")
            after = su_rows(NAME, mail)
            check(len(after) == 1 and after[0].get("city") == survey["city"],
                  "5. ...and the row is still there, unchanged")

        # 6. erasure: deleting the waitlist row takes the survey row with it (hook)
        if joined.get("id"):
            st, _ = ws.req("DELETE", f"/api/collections/waitlist/records/{joined['id']}")
            left = su_rows(NAME, mail)
            for _ in range(10):          # the hook runs after the delete commits
                if not left:
                    break
                time.sleep(0.3)
                left = su_rows(NAME, mail)
            check(st == 204 and not left,
                  f"6. deleting the waitlist row deletes its survey row (delete {st}, survey rows left: {len(left)})"
                  + ("" if not left else " — is pb_hooks/waitlist_survey.pb.js loaded?"))
    finally:
        # clean up our own test rows, whatever happened above (superuser)
        for coll in (NAME, "waitlist"):
            for m in (mail, stranger):
                for it in su_rows(coll, m):
                    ws.req("DELETE", f"/api/collections/{coll}/records/{it['id']}")

    print(f"\n{len(passes)} passed, {len(fails)} failed")
    sys.exit(1 if fails or not passes else 0)


if __name__ == "__main__":
    main()
