#!/usr/bin/env python3
"""Gate for mentorship documents (protected files) and avatar/cover upload limits.

Run:  PB_BASE=... PB_TOKEN=<superuser token> python3 verify_docs.py   (after init_schema.py + hooks)
Needs the server with UC_MIN_ACTIVE_HOURS small only for points; not needed here.
Every attack has a positive control. Throwaway users/records, removed at the end.
"""
from vt_common import call, admin_token, Gate, Users, multipart, get_raw, file_token, tiny_png

admin = admin_token()
g, users = Gate("mentorship docs + avatar/cover"), Users(admin)
MENTOR, MENTEE, C = users.make("mentor"), users.make("mentee"), users.make("outsider")
MS, DOCS, U = "/api/collections/mentorships/records", "/api/collections/mentorship_docs/records", "/api/collections/users/records"
PDF = b"%PDF-1.4\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF\n"
made = []


def upload(tok, ms, name="a.pdf", data=PDF, mime="application/pdf", uploader=None, note=None):
    f = {"mentorship": ms, "uploader": uploader}
    if note is not None:
        f["note"] = note
    return multipart(DOCS, "POST", f, {"file": (name, data, mime)}, tok)


def mk_ms(activate=True, close=False):
    st, m = call("POST", MS, {"mentor": MENTOR["id"], "mentee": MENTEE["id"], "kind": "mentoring", "topic": "docs", "status": "requested"}, MENTEE["token"])
    assert st == 200, (st, m)
    made.append(f"/api/collections/mentorships/records/{m['id']}")
    if activate:
        s, _ = call("PATCH", f"{MS}/{m['id']}", {"status": "active"}, MENTOR["token"]); assert s == 200
    if close:
        s, _ = call("PATCH", f"{MS}/{m['id']}", {"status": "closed"}, MENTOR["token"]); assert s == 200
    return m["id"]


# --- mentorship states ---
ms_req = mk_ms(activate=False)
st, _ = upload(MENTEE["token"], ms_req, uploader=MENTEE["id"])
g.rejected("upload while mentorship is 'requested' -> refused", st)
ms_closed = mk_ms(activate=True, close=True)
st, _ = upload(MENTEE["token"], ms_closed, uploader=MENTEE["id"])
g.rejected("upload while mentorship is 'closed' -> refused", st)
ms = mk_ms()

# --- positive: mentee uploads a PDF while active ---
st, d = upload(MENTEE["token"], ms, uploader=MENTEE["id"], note="my CV")
g.check("mentee uploads a PDF while active", st == 200, f"{st} {d}")
did, fname, cid = d.get("id"), d.get("file"), d.get("collectionId")
g.check("record carries a stored file name", bool(did and fname and cid), d)
for who, t in (("mentee", MENTEE), ("mentor", MENTOR)):
    st, lst = call("GET", DOCS, token=t["token"])
    g.check(f"{who} lists the document (N>0)", st == 200 and any(i["id"] == did for i in lst.get("items", [])), st)
    st, v = call("GET", f"{DOCS}/{did}", token=t["token"])
    g.check(f"{who} views the document", st == 200 and v.get("id") == did, st)
    ft = file_token(t["token"])
    g.check(f"{who} obtains a file token", bool(ft))
    st, body, hdr = get_raw(f"/api/files/{cid}/{did}/{fname}?token={ft}")
    g.check(f"{who} downloads WITH token -> 200 and same bytes", st == 200 and body == PDF, f"{st} len={len(body)}")

# --- protected: no token / wrong party ---
st, body, _ = get_raw(f"/api/files/{cid}/{did}/{fname}")
g.check("download WITHOUT token refused (protected)", st in (400, 403, 404) and body != PDF, st)
st, body, _ = get_raw(f"/api/files/{cid}/{did}/{fname}?token=garbage")
g.check("download with garbage token refused", st in (400, 403, 404) and body != PDF, st)
ftc = file_token(C["token"])
g.check("outsider can mint a (useless) file token", bool(ftc))
st, body, _ = get_raw(f"/api/files/{cid}/{did}/{fname}?token={ftc}")
g.check("outsider downloads with own token -> refused", st in (400, 403, 404) and body != PDF, st)
st, lst = call("GET", DOCS, token=C["token"])
g.check("outsider lists 0 documents", st == 200 and lst.get("totalItems", 0) == 0, f"{st} {lst.get('totalItems')}")
st, _ = call("GET", f"{DOCS}/{did}", token=C["token"]); g.rejected("outsider cannot view the document", st)
st, lst = call("GET", DOCS)
g.check("anonymous lists 0 documents", st in (200, 403) and lst.get("totalItems", 0) == 0, st)
st, _ = upload(C["token"], ms, uploader=C["id"]); g.rejected("outsider cannot upload into the mentorship", st)
st, _ = upload(C["token"], ms, uploader=MENTEE["id"]); g.rejected("outsider cannot upload as the mentee (forged uploader)", st)
st, _ = upload(MENTEE["token"], ms, uploader=MENTOR["id"]); g.rejected("mentee forging uploader=mentor -> refused", st)
st, _ = upload(MENTOR["token"], ms, uploader=MENTEE["id"]); g.rejected("mentor forging uploader=mentee -> refused", st)

# --- evil / oversize files ---
SVG = b'<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>'
HTML = b"<!doctype html><html><body><script>alert(1)</script></body></html>"
EVIL = [("evil.svg", SVG, "image/svg+xml"), ("evil.html", HTML, "text/html"),
        ("fake.pdf", HTML, "application/pdf"), ("fake2.png", SVG, "image/png"),
        ("evil.exe", b"MZ\x90\x00\x03\x00\x00\x00" + b"\0" * 64, "application/x-msdownload"),
        ("evil.pdf.exe", b"MZ\x90\x00\x03\x00\x00\x00" + b"\0" * 64, "application/pdf")]
for n, data, mime in EVIL:
    st, r = upload(MENTEE["token"], ms, name=n, data=data, mime=mime, uploader=MENTEE["id"])
    g.check(f"{n} ({mime}) rejected with 400", st == 400, f"{st} {r.get('message') if isinstance(r, dict) else ''}")
st, r = upload(MENTEE["token"], ms, name="big.pdf", data=PDF + b"\0" * (11 * 1024 * 1024), uploader=MENTEE["id"])
g.check("11 MB file rejected with 400", st == 400, st)
st, r = upload(MENTEE["token"], ms, name="ok1mb.pdf", data=PDF + b"\0" * (1024 * 1024), uploader=MENTEE["id"])
g.check("control: 1 MB pdf accepted", st == 200, st)
if r.get("id"):
    call("DELETE", f"{DOCS}/{r['id']}", token=MENTEE["token"])
st, r = upload(MENTEE["token"], ms, name="png.png", data=tiny_png(), mime="image/png", uploader=MENTEE["id"])
g.check("control: valid png accepted", st == 200, st)
png_id, png_file = r.get("id"), r.get("file")
st, r = upload(MENTEE["token"], ms, name="n.txt", data=b"hello", mime="text/plain", uploader=MENTEE["id"], note="n" * 301)
g.check("note of 301 chars rejected", st == 400, st)

# --- update rules ---
st, _ = multipart(f"{DOCS}/{did}", "PATCH", {}, {"file": ("b.pdf", PDF + b"x", "application/pdf")}, MENTEE["token"])
g.rejected("uploader replacing the file -> refused", st)
st, r = call("PATCH", f"{DOCS}/{did}", {"note": "updated note"}, MENTEE["token"])
g.check("uploader PATCHes note (positive)", st == 200 and r.get("note") == "updated note", st)
st, _ = call("PATCH", f"{DOCS}/{did}", {"note": "mentor edit"}, MENTOR["token"]); g.rejected("other participant cannot PATCH note", st)
st, _ = call("PATCH", f"{DOCS}/{did}", {"uploader": MENTOR["id"]}, MENTEE["token"]); g.rejected("uploader cannot reassign uploader", st)
st, _ = call("PATCH", f"{DOCS}/{did}", {"mentorship": ms_closed}, MENTEE["token"]); g.rejected("uploader cannot move doc to another mentorship", st)
st, _ = call("PATCH", f"{DOCS}/{did}", {"note": "x"}, C["token"]); g.rejected("outsider cannot PATCH", st)
st, v = call("GET", f"{DOCS}/{did}", token=MENTEE["token"])
g.check("doc unchanged after attacks (note, uploader, file)", v.get("note") == "updated note" and v.get("uploader") == MENTEE["id"] and v.get("file") == fname, v)

# --- delete rules ---
st, md = upload(MENTOR["token"], ms, name="m.txt", data=b"mentor doc", mime="text/plain", uploader=MENTOR["id"])
g.check("mentor uploads a txt doc", st == 200, st)
mdid = md.get("id")
st, _ = call("DELETE", f"{DOCS}/{mdid}", token=MENTEE["token"]); g.rejected("mentee non-uploader cannot delete mentor's doc", st)
st, _ = call("DELETE", f"{DOCS}/{did}", token=C["token"]); g.rejected("outsider cannot delete", st)
st, _ = call("DELETE", f"{DOCS}/{png_id}", token=MENTOR["token"])
g.check("mentor can delete the mentee's doc", st == 204, st)
st, _ = call("DELETE", f"{DOCS}/{mdid}", token=MENTOR["token"])
g.check("uploader (mentor) can delete own doc", st == 204, st)
st, tmp = upload(MENTEE["token"], ms, name="t.txt", data=b"temp", mime="text/plain", uploader=MENTEE["id"])
st2, _ = call("DELETE", f"{DOCS}/{tmp.get('id')}", token=MENTEE["token"])
g.check("uploader (mentee) can delete own doc", st == 200 and st2 == 204, f"{st} {st2}")
st, body, _ = get_raw(f"/api/files/{cid}/{png_id}/{png_file}?token={file_token(MENTEE['token'])}")
g.check("deleted doc's file is gone", bool(png_file) and st in (400, 403, 404), st)

# --- cap 30 (did remains = 1 doc) ---
st, lst = call("GET", f"{DOCS}?filter=mentorship='{ms}'&perPage=100", token=MENTEE["token"])
have = lst.get("totalItems", 0)
g.check("setup: 1 document before filling the cap", have == 1, have)
ok_all = True
for i in range(30 - have):
    st, r = upload(MENTEE["token"], ms, name=f"t{i}.txt", data=f"doc {i}".encode(), mime="text/plain", uploader=MENTEE["id"])
    ok_all = ok_all and st == 200
g.check("control: documents up to the cap of 30 accepted", ok_all)
st, _ = upload(MENTEE["token"], ms, name="t31.txt", data=b"one too many", mime="text/plain", uploader=MENTEE["id"])
g.check("31st document -> 400", st == 400, st)
st, _ = upload(MENTOR["token"], ms, name="t31.txt", data=b"one too many", mime="text/plain", uploader=MENTOR["id"])
g.check("31st document by the mentor -> 400", st == 400, st)
st, lst = call("GET", f"{DOCS}?filter=mentorship='{ms}'&perPage=1", token=MENTEE["token"])
g.check("exactly 30 documents stored", lst.get("totalItems") == 30, lst.get("totalItems"))

# --- avatar / cover on users ---
me, other = f"{U}/{MENTEE['id']}", f"{U}/{MENTOR['id']}"
st, _ = multipart(me, "PATCH", {}, {"avatar": ("evil.svg", SVG, "image/svg+xml")}, MENTEE["token"]); g.check("avatar evil.svg -> 400", st == 400, st)
st, _ = multipart(me, "PATCH", {}, {"avatar": ("evil.png", SVG, "image/png")}, MENTEE["token"]); g.check("avatar svg content labelled png -> 400", st == 400, st)
st, _ = multipart(me, "PATCH", {}, {"avatar": ("evil.html", HTML, "text/html")}, MENTEE["token"]); g.check("avatar html -> 400", st == 400, st)
st, _ = multipart(me, "PATCH", {}, {"avatar": ("big.png", tiny_png(3 * 1024 * 1024), "image/png")}, MENTEE["token"]); g.check("avatar 3 MB png -> 400 (limit 2 MB)", st == 400, st)
st, _ = multipart(me, "PATCH", {}, {"cover": ("evil.svg", SVG, "image/svg+xml")}, MENTEE["token"]); g.check("cover evil.svg -> 400", st == 400, st)
st, _ = multipart(me, "PATCH", {}, {"cover": ("big.png", tiny_png(5 * 1024 * 1024 + 4096), "image/png")}, MENTEE["token"]); g.check("cover just over 5 MB -> 400", st == 400, st)
st, u = multipart(me, "PATCH", {}, {"avatar": ("a.png", tiny_png(), "image/png")}, MENTEE["token"])
g.check("control: valid png avatar on own record -> 200", st == 200 and bool(u.get("avatar")), f"{st} {u}")
av = u.get("avatar")
st, u2 = multipart(me, "PATCH", {}, {"avatar": ("a1.png", tiny_png(1024 * 1024), "image/png")}, MENTEE["token"])
g.check("control: 1 MB png avatar (under 2 MB) -> 200", st == 200, st)
st, u3 = multipart(me, "PATCH", {}, {"cover": ("c.png", tiny_png(1024 * 1024), "image/png")}, MENTEE["token"])
g.check("control: 1 MB png cover (under 5 MB) -> 200", st == 200 and bool(u3.get("cover")), st)
st, _ = multipart(other, "PATCH", {}, {"avatar": ("a.png", tiny_png(), "image/png")}, MENTEE["token"])
g.rejected("member cannot set another member's avatar", st)
st, body, hdr = get_raw(f"/api/files/{u2['collectionId']}/{MENTEE['id']}/{u2.get('avatar')}")
g.check("NOTE avatar is public by URL (not protected, by design) -> 200 without token", st == 200 and len(body) > 100, st)
st, body, hdr = get_raw(f"/api/files/{u3['collectionId']}/{MENTEE['id']}/{u3.get('cover')}")
g.check("NOTE cover is public by URL (not protected, by design) -> 200 without token", st == 200, st)

users.cleanup(made)
g.done()
