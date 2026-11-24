#!/usr/bin/env python3
"""Gate for the AI helper route /api/uc/profile/structure (hook backend/pb_hooks/uc_ai.pb.js).

Without GEMINI_API_KEY in the container (the default on the throwaway PocketBase) the route
must be OFF: 401 for anonymous callers, 501 for members. With a key it would call Google; this
gate never sets a key and never reaches Google. Run:
  PB_BASE=... PB_IDENTITY=... PB_PASSWORD=... python3 verify_ai.py
"""
from vt_common import call, admin_token, Gate, Users

admin = admin_token()
g, users = Gate("AI helper route (off by default)"), Users(admin)
A = users.make("ai")
R = "/api/uc/profile/structure"
long_text = "Five years in audit at a large firm, then corporate finance. MSc Financial Economics. " * 3

st, _ = call("POST", R, {"text": long_text})
g.check("anonymous caller is refused (401)", st == 401, st)
st, r = call("POST", R, {"text": long_text}, A["token"])
g.check("member gets 501 while no key is configured", st == 501, f"{st} {r}")
g.check("the refusal says the helper is not switched on", "not switched on" in str(r.get("message", "")), r)
st, _ = call("POST", R, {"text": "short"}, A["token"])
g.check("a request cannot reach the model with too little text (501 first or 400)", st in (400, 501), st)
st, _ = call("GET", R, token=A["token"])
g.check("GET is not routed (404/405)", st in (404, 405), st)
users.cleanup()
g.done()
