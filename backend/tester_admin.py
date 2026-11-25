#!/usr/bin/env python3
"""List or purge hidden-link testers (users with tester = true, see pb_hooks/uc_tester.pb.js).

  python3 tester_admin.py --list            # who entered through the test link
  python3 tester_admin.py --purge           # DRY RUN: shows what would be deleted
  python3 tester_admin.py --purge --yes     # deletes every tester and every record that references one
  python3 tester_admin.py --reset-limits    # clears the wrong-key counter of the test route

Auth like init_schema.py: PB_BASE (default http://127.0.0.1:8090) and PB_TOKEN, or
PB_IDENTITY + PB_PASSWORD (superuser login). The record scan is generic: every collection
with a relation field pointing at `users` is checked, so new collections are covered too.
"""
import argparse, sys
from urllib.parse import quote
from vt_common import call, admin_token

USERS_ID = "_pb_users_auth_"


def all_records(tok, coll, flt):
    out, page = [], 1
    while True:
        st, r = call("GET", f"/api/collections/{coll}/records?perPage=200&page={page}&filter={quote(flt)}", token=tok)
        if st != 200:
            print(f"  ! {coll}: list failed ({st}) {r.get('message', '')}")
            return out
        out += r.get("items", [])
        if page >= r.get("totalPages", 1):
            return out
        page += 1


def testers(tok):
    return all_records(tok, "users", "tester = true")


def references(tok, ids):
    """[(collection, record_id, field)] for every record whose users-relation points at a tester."""
    st, cols = call("GET", "/api/collections?perPage=500", token=tok)
    found = []
    for c in cols.get("items", []):
        if c["name"] == "users" or c.get("type") == "view":
            continue
        for f in c.get("fields", []):
            if f.get("type") != "relation" or f.get("collectionId") != USERS_ID:
                continue
            # Multi-relations are memberships (e.g. a group chat a tester was added to): the group
            # belongs to someone else, so it is kept; deleting the user removes them from the list.
            if (f.get("maxSelect") or 1) > 1:
                continue
            for uid in ids:
                flt = f'{f["name"]} = "{uid}"'
                for rec in all_records(tok, c["name"], flt):
                    found.append((c["name"], rec["id"], f["name"]))
    return found


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--list", action="store_true")
    ap.add_argument("--purge", action="store_true")
    ap.add_argument("--yes", action="store_true", help="really delete (with --purge)")
    ap.add_argument("--reset-limits", action="store_true")
    a = ap.parse_args()
    if not (a.list or a.purge or a.reset_limits):
        ap.print_help(); sys.exit(2)
    tok = admin_token()

    if a.reset_limits:
        st, _ = call("DELETE", "/api/uc/tester/attempts", token=tok)
        print("wrong-key counter cleared" if st == 204 else f"reset failed: {st}")

    ts = testers(tok)
    if a.list or a.purge:
        print(f"testers: {len(ts)}")
        for u in ts:
            print(f"  {u['id']}  {u.get('name', ''):<24} {u.get('email', '')}  since {u.get('created', '')[:16]}")

    if a.purge and ts:
        ids = [u["id"] for u in ts]
        refs = references(tok, ids)
        by = {}
        for coll, _, field in refs:
            by[f"{coll}.{field}"] = by.get(f"{coll}.{field}", 0) + 1
        print(f"records referencing testers: {len(refs)}")
        for k, n in sorted(by.items()):
            print(f"  {k}: {n}")
        if not a.yes:
            print("DRY RUN: nothing deleted. Add --yes to delete these records and the tester accounts.")
            return
        done, fail = 0, 0
        for coll, rid, _ in refs:                 # authored rows first; cascades may already have removed some
            st, _ = call("DELETE", f"/api/collections/{coll}/records/{rid}", token=tok)
            done += st == 204
            fail += st not in (204, 404)
        for uid in ids:
            st, r = call("DELETE", f"/api/collections/users/records/{uid}", token=tok)
            if st not in (204, 404):
                fail += 1; print(f"  ! user {uid}: {st} {r.get('message', '')}")
        print(f"deleted records: {done}, testers: {len(ids)}, failures: {fail}")
        sys.exit(1 if fail else 0)


if __name__ == "__main__":
    main()
