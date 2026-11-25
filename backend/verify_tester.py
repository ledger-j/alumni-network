#!/usr/bin/env python3
"""Gate for hidden-link test access (backend/pb_hooks/uc_tester.pb.js) and closed sign-up.

Run:  PB_BASE=... PB_TOKEN=<superuser token> [UC_TESTER_KEY=<same key as the server>] python3 verify_tester.py
Always: anonymous sign-up is refused; a member cannot set tester/supporter/points on themselves.
If the server answers 501 (no UC_TESTER_KEY on the server): the switched-off message is asserted.
Otherwise (needs UC_TESTER_KEY here too): wrong key 403, bad name 400, right key -> token +
record.tester, same name twice -> same member, tester cannot change tester/supporter/points,
11th wrong key -> 429. Throwaway testers are deleted; the wrong-key counter is cleared.
"""
import os, time
from vt_common import call, admin_token, Gate, Users

admin = admin_token()
g, users = Gate("tester access + closed sign-up"), Users(admin)
ENTER, RESET = "/api/uc/tester/enter", "/api/uc/tester/attempts"
U = "/api/collections/users/records"
made = []

# --- sign-up is closed for everyone without a superuser token
st, rec = call("POST", U, {"email": f"vt_anon_{int(time.time())}@example.test", "password": "Test123456!",
                           "passwordConfirm": "Test123456!", "name": "Anon"})
g.rejected("anonymous POST /users/records is refused", st)
if st == 200: made.append(rec["id"])
st, rec = call("POST", U, {"email": f"vt_anon2_{int(time.time())}@example.test", "password": "Test123456!",
                           "passwordConfirm": "Test123456!", "name": "Anon", "tester": True})
g.rejected("anonymous sign-up with tester=true is refused", st)
if st == 200: made.append(rec["id"])

# --- a normal member cannot make themselves a tester (or supporter / points)
m = users.make("member")
for field, val in (("tester", True), ("supporter", True), ("points", 999)):
    st, _ = call("PATCH", f"{U}/{m['id']}", {field: val}, m["token"])
    g.rejected(f"member cannot set {field} on themselves", st)

# --- the route itself
call("DELETE", RESET, token=admin)                         # clean counter (re-runs within 10 minutes)
st, r = call("POST", ENTER, {"key": "x" * 32, "name": "Probe"})
if st == 501:
    g.check("route is off without UC_TESTER_KEY: 501 + message", "not switched on" in str(r.get("message", "")), r)
    st, _ = call("DELETE", RESET)
    g.rejected("counter reset needs a superuser", st if st != 401 else 403)
else:
    key = os.environ.get("UC_TESTER_KEY", "")
    if len(key) < 16:
        g.check("UC_TESTER_KEY must be set here (server has it on)", False, f"server answered {st}")
        users.cleanup(); g.done()
    g.check("wrong key -> 403", st == 403, st)
    g.check("wrong key message", "not valid" in str(r.get("message", "")), r)
    call("DELETE", RESET, token=admin)

    st, _ = call("POST", ENTER, {"key": key, "name": "<script>"})
    g.check("bad name -> 400", st == 400, st)
    st, _ = call("POST", ENTER, {"key": key, "name": "x" * 41})
    g.check("41-char name -> 400", st == 400, st)

    name = f"Vt Tester {chr(97 + int(time.time()) % 26)}"
    st, a = call("POST", ENTER, {"key": key, "name": name})
    ok = st == 200 and a.get("token") and a.get("record", {}).get("id")
    g.check("right key -> 200 + token + record", bool(ok), f"{st} {a}")
    if ok:
        rec, tok = a["record"], a["token"]
        made.append(rec["id"])
        g.check("record.tester is true", rec.get("tester") is True, rec)
        g.check("record.verified is true", rec.get("verified") is True, rec)
        g.check("tester email on the testers domain", str(rec.get("email", "@testers.unicircle.eu")).endswith("@testers.unicircle.eu") or rec.get("email") is None, rec)
        g.check("no password material in the answer", not any(k in rec for k in ("password", "passwordHash", "tokenKey")), list(rec))
        st, me = call("POST", "/api/collections/users/auth-refresh", {}, tok)
        g.check("tester token works (auth-refresh)", st == 200 and me.get("record", {}).get("id") == rec["id"], st)

        dev = a.get("device") or ""
        g.check("new tester gets a one-time device secret", len(dev) >= 32, len(dev))
        g.check("tester_secret is never serialised", "tester_secret" not in rec, list(rec))
        st, b = call("POST", ENTER, {"key": key, "name": "  " + name.upper() + " ", "device": dev})
        g.check("same name + device secret -> same member", st == 200 and b.get("record", {}).get("id") == rec["id"], f"{st} {b.get('record', {}).get('id')}")
        g.check("re-entry issues no new device secret", "device" not in b, list(b))
        st, c = call("POST", ENTER, {"key": key, "name": name})
        cid = c.get("record", {}).get("id")
        if cid and cid != rec["id"]: made.append(cid)
        g.check("same name WITHOUT the device secret -> a different member (no takeover)", st == 200 and cid and cid != rec["id"], f"{st} {cid}")
        st, c2 = call("POST", ENTER, {"key": key, "name": name, "device": "x" * 48})
        c2id = c2.get("record", {}).get("id")
        if c2id and c2id not in made: made.append(c2id)
        g.check("same name with a WRONG device secret -> not the first member", st == 200 and c2id != rec["id"], f"{st} {c2id}")
        st, _ = call("PATCH", f"{U}/{rec['id']}", {"tester_secret": "x"}, tok)
        st2, cur = call("GET", f"{U}/{rec['id']}", token=admin)
        g.check("tester cannot change tester_secret (refused or ignored)",
                st >= 400 or (st2 == 200 and cur.get("tester_secret") not in (None, "", "x")), f"{st} {cur.get('tester_secret', '?')[:8]}")

        for field, val in (("tester", False), ("supporter", True), ("points", 500)):
            st, _ = call("PATCH", f"{U}/{rec['id']}", {field: val}, tok)
            g.rejected(f"tester cannot change {field}", st)
        st, cur = call("GET", f"{U}/{rec['id']}", token=admin)
        g.check("server-owned fields unchanged", cur.get("tester") is True and not cur.get("supporter") and not cur.get("points"), cur)
        st, _ = call("PATCH", f"{U}/{rec['id']}", {"headline": "Testing"}, tok)
        g.check("tester can edit an ordinary profile field", st == 200, st)

    # --- brute force: 10 wrong keys allowed, the 11th gets 429 (and so does the right key then)
    call("DELETE", RESET, token=admin)
    codes = [call("POST", ENTER, {"key": "wrong-" + str(i) + "-" * 20, "name": "Probe"})[0] for i in range(11)]
    g.check("10 wrong keys -> 403 each", codes[:10] == [403] * 10, codes)
    g.check("11th wrong key -> 429", codes[10] == 429, codes)
    st, r = call("POST", ENTER, {"key": key, "name": "Probe"})
    g.check("right key is also held back while limited (429)", st == 429, st)
    st, _ = call("DELETE", RESET)
    g.rejected("counter reset needs a superuser", st if st != 401 else 403)
    st, _ = call("DELETE", RESET, token=admin)
    g.check("superuser clears the counter", st == 204, st)

for uid in made:
    call("DELETE", f"{U}/{uid}", token=admin)
users.cleanup()
g.done()
