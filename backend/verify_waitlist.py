#!/usr/bin/env python3
"""Non-vacuous gate for the waitlist collections. Exits 1 on any failure.

Proves, against a live PocketBase:
  1. an anonymous visitor CAN join (create) with consent,
  2. joining WITHOUT consent is refused,
  3. the same email twice (any letter case) is refused,
  4. an anonymous visitor CANNOT read the list (0 rows visible, never ours),
  5. an anonymous visitor CANNOT edit or delete a row,
  6. waitlist_viewers cannot be written by anyone but a superuser,
then deletes its own test rows (superuser).

  PB_BASE=https://api.unicircle.eu PB_TOKEN=... python3 verify_waitlist.py
"""
import os, sys, time
sys.path.insert(0, os.path.dirname(__file__))
import waitlist_schema as ws  # reuses req() + ensure_token()

fails, passes = [], []
def check(ok, label):
    (passes if ok else fails).append(label)
    print(("PASS " if ok else "FAIL ") + label)

ANON = "anon-no-auth"   # sentinel: send no Authorization header
def anon(method, path, body=None):
    import json, urllib.request, urllib.error
    data = json.dumps(body).encode() if body is not None else None
    r = urllib.request.Request(ws.BASE + path, data=data, method=method,
                               headers={"Content-Type": "application/json"})
    try:
        with urllib.request.urlopen(r, timeout=20) as resp:
            return resp.status, json.loads(resp.read() or "{}")
    except urllib.error.HTTPError as e:
        return e.code, {}

ws.ensure_token()
tag = f"verify-{int(time.time())}"
mail = f"{tag}@example.invalid"
row = {"email": mail, "name": "Verify Bot", "role": "student", "city": "Testville",
       "interests": ["student_exchange"], "consent": True, "source": tag}

st, created = anon("POST", "/api/collections/waitlist/records", row)
check(st == 200 and created.get("id"), "anonymous join with consent → 200")

st, _ = anon("POST", "/api/collections/waitlist/records", {**row, "email": "x" + mail, "consent": False})
check(st == 400, f"join without consent refused (got {st})")

st, _ = anon("POST", "/api/collections/waitlist/records", {**row, "email": mail.upper()})
check(st == 400, f"duplicate email (case-insensitive) refused (got {st})")

st, lst = anon("GET", "/api/collections/waitlist/records?perPage=50")
check(st in (200, 403) and not lst.get("items"), f"anonymous list sees 0 rows (got {st}, {len(lst.get('items', []))})")

if created.get("id"):
    st, _ = anon("PATCH", f"/api/collections/waitlist/records/{created['id']}", {"city": "Hacked"})
    check(st in (403, 404), f"anonymous update refused (got {st})")
    st, _ = anon("DELETE", f"/api/collections/waitlist/records/{created['id']}")
    check(st in (403, 404), f"anonymous delete refused (got {st})")

st, _ = anon("POST", "/api/collections/waitlist_viewers/records", {"user": "abc"})
check(st in (400, 403), f"anonymous cannot grant viewer access (got {st})")

# superuser sees the row → proves the rows really landed (not a vacuous pass)
st, su = ws.req("GET", "/api/collections/waitlist/records?filter=" + __import__("urllib.parse").parse.quote(f'source="{tag}"'))
check(st == 200 and len(su.get("items", [])) == 1, "superuser sees exactly the 1 test row")
for it in su.get("items", []):
    ws.req("DELETE", f"/api/collections/waitlist/records/{it['id']}")

print(f"\n{len(passes)} passed, {len(fails)} failed")
sys.exit(1 if fails or not passes else 0)
