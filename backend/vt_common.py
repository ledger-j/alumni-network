"""Shared helpers for the backend verify_*.py scripts (stdlib only).

Every verify script is a *non-vacuous* gate: it counts what it collected (N > 0) and
asserts the NEGATIVE rule cases (a stranger gets nothing, a forbidden edit is refused).
A run with zero checks is a failure, not a pass.
Environment: PB_BASE (default http://127.0.0.1:8090) and either PB_TOKEN (superuser
token) or PB_IDENTITY + PB_PASSWORD (superuser login). Creates throwaway users/records
and deletes them at the end.
"""
import json, os, sys, threading, time, urllib.request, urllib.error

BASE = os.environ.get("PB_BASE", "http://127.0.0.1:8090").rstrip("/")


def call(method, path, body=None, token=None):
    data = json.dumps(body).encode() if body is not None else None
    h = {"Content-Type": "application/json"}
    if token:
        h["Authorization"] = token
    r = urllib.request.Request(BASE + path, data=data, method=method, headers=h)
    try:
        with urllib.request.urlopen(r, timeout=20) as resp:
            raw = resp.read()
            return resp.status, (json.loads(raw) if raw else {})
    except urllib.error.HTTPError as e:
        try:
            return e.code, json.loads(e.read() or "{}")
        except Exception:
            return e.code, {}


def admin_token():
    t = os.environ.get("PB_TOKEN")
    if t:
        return t
    ident, pw = os.environ.get("PB_IDENTITY"), os.environ.get("PB_PASSWORD")
    if not (ident and pw):
        sys.exit("set PB_TOKEN, or PB_IDENTITY + PB_PASSWORD (superuser)")
    st, r = call("POST", "/api/collections/_superusers/auth-with-password", {"identity": ident, "password": pw})
    if st != 200:
        sys.exit(f"superuser login failed: {st}")
    return r["token"]


class Gate:
    """Counts checks; prints one line each; exit code 1 on any failure or zero checks."""

    def __init__(self, name):
        self.name, self.n, self.failed = name, 0, []
        print(f"== {name} ==")

    def check(self, label, cond, detail=""):
        self.n += 1
        print(("  PASS " if cond else "  FAIL ") + label + (f"  [{detail}]" if detail and not cond else ""))
        if not cond:
            self.failed.append(label)

    def rejected(self, label, status):
        """A forbidden action must be refused (400/403/404), never succeed."""
        self.check(label, status in (400, 403, 404), f"got {status}")

    def done(self):
        ok = self.n > 0 and not self.failed
        print(f"checks: {self.n}  failed: {len(self.failed)}")
        print("RESULT:", "PASS" if ok else ("FAIL (no checks ran)" if self.n == 0 else "FAIL"))
        sys.exit(0 if ok else 1)


class Users:
    """Throwaway members; everything is removed with the superuser token at the end."""

    def __init__(self, admin):
        self.admin, self.made, self.stamp = admin, [], str(int(time.time()))

    def make(self, tag, **extra):
        pw = "Test123456!"
        email = f"vt_{tag}_{self.stamp}@example.test"
        st, rec = call("POST", "/api/collections/users/records",
                       {"email": email, "password": pw, "passwordConfirm": pw, "name": f"VT {tag}", **extra})
        if st != 200:
            sys.exit(f"cannot create test user {tag}: {st} {rec}")
        st, auth = call("POST", "/api/collections/users/auth-with-password", {"identity": email, "password": pw})
        if st != 200:
            sys.exit(f"cannot log in test user {tag}: {st}")
        self.made.append(rec["id"])
        return {"id": rec["id"], "token": auth["token"]}

    def cleanup(self, extra_paths=()):
        for p in extra_paths:
            call("DELETE", p, token=self.admin)
        for uid in self.made:
            call("DELETE", f"/api/collections/users/records/{uid}", token=self.admin)
        print("cleanup: done")


class Sse:
    """Minimal PocketBase realtime client (SSE). Collects events in .events."""

    def __init__(self, token, topics):
        self.token, self.topics, self.events, self.client_id = token, topics, [], None
        self._ready = threading.Event()
        self._resp = None
        threading.Thread(target=self._run, daemon=True).start()

    def _run(self):
        try:
            self._resp = urllib.request.urlopen(urllib.request.Request(BASE + "/api/realtime"), timeout=30)
            name, data = None, []
            for raw in self._resp:
                line = raw.decode().rstrip("\n")
                if line.startswith("event:"):
                    name = line[6:].strip()
                elif line.startswith("data:"):
                    data.append(line[5:].strip())
                elif line == "" and name:
                    payload = json.loads("".join(data) or "{}")
                    if name == "PB_CONNECT":
                        self.client_id = payload.get("clientId")
                        call("POST", "/api/realtime", {"clientId": self.client_id, "subscriptions": self.topics},
                             token=self.token)
                        self._ready.set()
                    else:
                        self.events.append((name, payload))
                    name, data = None, []
        except Exception:
            self._ready.set()

    def wait_ready(self, t=8):
        return self._ready.wait(t) and self.client_id is not None

    def wait_for(self, pred, t=6):
        end = time.time() + t
        while time.time() < end:
            for ev in list(self.events):
                if pred(ev):
                    return ev
            time.sleep(0.1)
        return None

    def close(self):
        try:
            self._resp.close()
        except Exception:
            pass


# ---------------------------------------------------------------- additions (gate 2: files, raw downloads)
def multipart(path, method, fields, files=None, token=None):
    """multipart/form-data request (stdlib only). fields: {name: str|int|bool}; files:
    {name: (filename, bytes, mime)}. Returns (status, json)."""
    import uuid
    b = "----vt" + uuid.uuid4().hex
    parts = []
    for k, v in (fields or {}).items():
        v = ("true" if v else "false") if isinstance(v, bool) else str(v)
        parts.append((f'--{b}\r\nContent-Disposition: form-data; name="{k}"\r\n\r\n').encode() + v.encode() + b"\r\n")
    for k, (fn, data, mime) in (files or {}).items():
        parts.append((f'--{b}\r\nContent-Disposition: form-data; name="{k}"; filename="{fn}"\r\n'
                      f'Content-Type: {mime}\r\n\r\n').encode() + data + b"\r\n")
    body = b"".join(parts) + f"--{b}--\r\n".encode()
    h = {"Content-Type": f"multipart/form-data; boundary={b}"}
    if token:
        h["Authorization"] = token
    r = urllib.request.Request(BASE + path, data=body, method=method, headers=h)
    try:
        with urllib.request.urlopen(r, timeout=60) as resp:
            raw = resp.read()
            return resp.status, (json.loads(raw) if raw else {})
    except urllib.error.HTTPError as e:
        try:
            return e.code, json.loads(e.read() or "{}")
        except Exception:
            return e.code, {}


def get_raw(path, token=None):
    """GET returning (status, bytes, headers) for file downloads."""
    h = {"Authorization": token} if token else {}
    r = urllib.request.Request(BASE + path, method="GET", headers=h)
    try:
        with urllib.request.urlopen(r, timeout=30) as resp:
            return resp.status, resp.read(), dict(resp.headers)
    except urllib.error.HTTPError as e:
        return e.code, e.read() or b"", dict(e.headers or {})


def file_token(tok):
    """POST /api/files/token as a member -> short-lived file token (or None)."""
    st, r = call("POST", "/api/files/token", {}, tok)
    return r.get("token") if st == 200 else None


def tiny_png(pad=0):
    """A valid 1x1 PNG; pad appends trailing bytes (ignored by decoders) to reach a size."""
    import struct, zlib
    def ch(t, d):
        c = struct.pack(">I", len(d)) + t + d
        return c + struct.pack(">I", zlib.crc32(t + d) & 0xffffffff)
    raw = b"\x00\xff\x00\x00"
    return (b"\x89PNG\r\n\x1a\n" + ch(b"IHDR", struct.pack(">IIBBBBB", 1, 1, 8, 2, 0, 0, 0))
            + ch(b"IDAT", zlib.compress(raw)) + ch(b"IEND", b"") + b"\0" * pad)
