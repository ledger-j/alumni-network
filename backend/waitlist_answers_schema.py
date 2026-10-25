#!/usr/bin/env python3
"""UniCircle waitlist answers (idempotent): adds the V2 questions' answer fields to the
existing `waitlist` collection. No new collection: the answers travel in the same sign-up
request as the spot (js/uc-survey-v2.js + js/uc-waitlist-form-v2.js) and live on the same row.

Why on the row: one request, one place, and the unsubscribe link (which deletes the row)
erases the answers with it, so no extra hook is needed.

It only ADDS missing fields. Existing fields, rules and indexes stay exactly as they are.
Run AFTER waitlist_schema.py (this reuses its login + helpers):
  python3 waitlist_answers_schema.py --verify
  # non-interactive alternatives: PB_TOKEN=<token> or PB_IDENTITY=<email> PB_PASSWORD=<pw>
  # from a laptop instead of the box: PB_BASE=https://api.unicircle.eu (not tested yet)

--verify is a non-vacuous gate (exits 1 on any failure). Against a live PocketBase it proves:
  1. an anonymous join WITH answers is accepted, and a superuser reads back every answer exactly,
  2. an anonymous join WITHOUT answers still works (the V1 forms send none),
  3. an answer over its length limit is refused and not stored,
  4. an anonymous visitor still CANNOT list rows or edit the answers,
then deletes its own test rows (superuser) and checks they are gone.
Test addresses are @example.invalid.
"""
import json, os, sys, time, urllib.error, urllib.parse, urllib.request
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import waitlist_schema as ws  # reuses req() + ensure_token() + text()

# The answer fields the V2 form sends (plain strings, any may be empty). Tap answers are short
# codes; pick-several answers are a ", " list; "Other" is sent as "other: <their words>" (max 120
# typed characters), so the tap fields leave room for that. Lengths match the form's maxlength.
ANSWERS = [("situation", 200), ("goal", 200), ("obstacle", 300), ("tried", 300),
           ("commitment", 200), ("sector", 80), ("note", 1000)]
RECORDS = "/api/collections/waitlist/records"


def main():
    ws.ensure_token()
    st, cur = ws.req("GET", "/api/collections/waitlist")
    if st != 200:
        sys.exit(f"`waitlist` collection not found ({st}): run waitlist_schema.py first.")
    have = {f["name"] for f in cur.get("fields", [])}
    add = [ws.text(name, False, maxlen) for name, maxlen in ANSWERS if name not in have]
    if add:
        st, r = ws.req("PATCH", f"/api/collections/{cur['id']}", {"fields": cur["fields"] + add})
        if st != 200:
            sys.exit(f"waitlist update failed: {st} {r.get('message') or r}")
        print("waitlist: added", ", ".join(f["name"] for f in add))
    else:
        print("waitlist: the answer fields are already there")
    if "--verify" in sys.argv:
        sys.exit(verify())


def anon(method, path, body=None):
    """A request with no Authorization header: what any visitor of the website can do."""
    data = json.dumps(body).encode() if body is not None else None
    r = urllib.request.Request(ws.BASE + path, data=data, method=method,
                               headers={"Content-Type": "application/json"})
    try:
        with urllib.request.urlopen(r, timeout=20) as resp:
            return resp.status, json.loads(resp.read() or "{}")
    except urllib.error.HTTPError as e:
        return e.code, {}


def verify():
    fails, passes = [], []

    def check(ok, label):
        print(("PASS " if ok else "FAIL ") + label)
        (passes if ok else fails).append(label)

    tag = f"verify-answers-{int(time.time())}"
    a_mail, b_mail, c_mail = (f"{tag}-{x}@example.invalid" for x in "abc")
    row = {"role": "student", "city": "Testville", "consent": True, "source": tag}
    answers = {"situation": "bachelor_second", "goal": "internship", "obstacle": "no_reply, other: too shy",
               "tried": "linkedin", "commitment": "prepare", "sector": "", "note": "Synthetic test note."}

    st, a = anon("POST", RECORDS, {**row, "email": a_mail, **answers})
    check(st == 200 and bool(a.get("id")), f"1. anonymous join with answers accepted (got {st})")
    st, b = anon("POST", RECORDS, {**row, "email": b_mail})
    check(st == 200 and bool(b.get("id")), f"2. anonymous join without answers accepted (got {st})")
    st, _ = anon("POST", RECORDS, {**row, "email": c_mail, "note": "x" * 1001})
    check(st == 400, f"3. a 1001-character note refused (got {st})")
    st, lst = anon("GET", RECORDS + "?perPage=50")
    check(st in (200, 403) and not lst.get("items"), f"4a. anonymous list sees 0 rows (got {st})")
    if a.get("id"):
        st, _ = anon("PATCH", f"{RECORDS}/{a['id']}", {"goal": "changed"})
        check(st in (403, 404), f"4b. anonymous edit of the answers refused (got {st})")

    # Superuser read-back: proves the answers really landed on the row (not a vacuous pass).
    flt = urllib.parse.quote(f'source="{tag}"')
    st, su = ws.req("GET", f"{RECORDS}?perPage=10&filter={flt}")
    rows = {r["email"]: r for r in su.get("items", [])}
    got = rows.get(a_mail, {})
    check(all(got.get(k) == v for k, v in answers.items()),
          "1b. superuser reads back every answer exactly: "
          + ", ".join(f"{k}={'ok' if got.get(k) == v else repr(got.get(k))}" for k, v in answers.items()))
    check(c_mail not in rows, "3b. the refused sign-up was not stored")

    for r in su.get("items", []):
        ws.req("DELETE", f"{RECORDS}/{r['id']}")
    st, su = ws.req("GET", f"{RECORDS}?perPage=10&filter={flt}")
    check(st == 200 and not su.get("items"), "5. test rows deleted, no answers left behind")

    print(f"\n{len(passes)} passed, {len(fails)} failed")
    return 1 if fails or not passes else 0


if __name__ == "__main__":
    main()
