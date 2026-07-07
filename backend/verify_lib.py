#!/usr/bin/env python3
"""Shared gate harness for UniCircle verify_<feature>.py scripts.

Non-vacuous by construction: every check is recorded, PASS requires at least
one positive (N>0) assertion AND at least one negative (denied) assertion,
and a run with zero recorded assertions is a FAIL.

Run on the box:  PB_TOKEN=$(cat /opt/unicircle/.admin_token) python3 verify_<feature>.py
"""
import json, os, sys, time, urllib.request, urllib.error

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


class Gate:
    """Evidence-pair collector: command/effect assertions, counted and typed."""

    def __init__(self, feature):
        self.feature = feature
        self.checks = []          # (kind, label, passed, evidence)
        self._cleanup = []        # (path, token) deleted in reverse order

    # -- assertions ---------------------------------------------------------
    def check(self, label, passed, evidence):
        self.checks.append(("check", label, bool(passed), evidence))
        print(("  ok " if passed else "  FAIL ") + f"{label}  [{evidence}]")
        return passed

    def assert_status(self, label, st, expected=200):
        return self.check(label, st == expected, f"status {st}, expected {expected}")

    def assert_count(self, label, n):
        """Positive evidence: something real was collected (N>0)."""
        self.checks.append(("positive", label, n > 0, f"collected N={n}"))
        print(("  ok " if n > 0 else "  FAIL ") + f"{label}  [collected N={n}]")
        return n > 0

    def assert_denied(self, label, st, items=None):
        """Negative evidence: anon/basic actor was refused (4xx or empty)."""
        denied = st in (400, 401, 403, 404) or (st == 200 and not (items or []))
        ev = f"status {st}" + ("" if items is None else f", items={len(items or [])}")
        self.checks.append(("negative", label, denied, ev))
        print(("  ok " if denied else "  FAIL ") + f"{label} denied  [{ev}]")
        return denied

    # -- fixtures -----------------------------------------------------------
    def signup_user(self, tag, **fields):
        stamp = f"{int(time.time())}{len(self._cleanup)}"
        email = f"gate_{tag}_{stamp}@unicircle.eu"
        body = {"email": email, "password": "Test123456!", "passwordConfirm": "Test123456!",
                "name": f"Gate {tag}", **fields}
        st, rec = call("POST", "/api/collections/users/records", body)
        if st != 200:
            raise RuntimeError(f"fixture signup failed: {st} {rec}")
        uid = rec["id"]
        self._cleanup.append((f"/api/collections/users/records/{uid}", ADMIN))
        st, auth = call("POST", "/api/collections/users/auth-with-password",
                        {"identity": email, "password": "Test123456!"})
        if st != 200:
            raise RuntimeError(f"fixture login failed: {st} {auth}")
        return uid, auth["token"]

    def admin_create(self, collection, body):
        st, rec = call("POST", f"/api/collections/{collection}/records", body, token=ADMIN)
        if st != 200:
            raise RuntimeError(f"fixture admin_create {collection} failed: {st} {rec}")
        self._cleanup.append((f"/api/collections/{collection}/records/{rec['id']}", ADMIN))
        return rec

    def track(self, collection, rec_id):
        """Register a record created during the test for admin cleanup."""
        self._cleanup.append((f"/api/collections/{collection}/records/{rec_id}", ADMIN))

    # -- verdict ------------------------------------------------------------
    def finish(self):
        for path, token in reversed(self._cleanup):
            call("DELETE", path, token=token)
        print("cleanup: done")
        total = len(self.checks)
        pos = [c for c in self.checks if c[0] == "positive"]
        neg = [c for c in self.checks if c[0] == "negative"]
        failed = [c for c in self.checks if not c[2]]
        vacuous = total == 0 or not any(p[2] for p in pos) or not any(n[2] for n in neg)
        ok = not failed and not vacuous
        print(f"assertions: {total} total, {len(pos)} positive, {len(neg)} negative, {len(failed)} failed")
        if total == 0:
            print("VACUOUS: zero assertions recorded")
        elif vacuous and not failed:
            print("VACUOUS: missing a passing positive (N>0) or negative (denied) assertion")
        print(f"RESULT[{self.feature}]:", "PASS" if ok else "FAIL")
        sys.exit(0 if ok else 1)
