#!/usr/bin/env python3
"""Seed UniCircle with a "living from day one" set of demo alumni.

Creates 10 realistic Maastricht SBE alumni (users), a populated feed (posts)
and a few 1:1 message threads (messages), so the very first real visitor sees
an active network — people to browse, a feed with content, available mentors,
and existing conversations — instead of an empty shell.

Idempotent: profiles are keyed by email; anything that already exists is skipped.
Safe to re-run after pulling. Only adds; never deletes.

Usage
-----
Locally against a tunnel, or on the box:

    export PB_URL=http://127.0.0.1:8090          # PocketBase base URL
    export PB_ADMIN_EMAIL=you@example.com        # superuser email
    export PB_ADMIN_PASSWORD=**********          # superuser password
    python3 seed_profiles.py

On the LMS box the admin creds live in /opt/unicircle/ADMIN_CREDENTIALS.txt.
Run init_schema.py first so the collections/fields exist.

Fields written match backend/init_schema.py exactly:
  users:    email, password, passwordConfirm, name, headline, location, degree,
            linkedin_url, linkedin_imported, supporter, mentor, mentor_offer
  posts:    author (rel->users), text, degree, likes
  messages: sender (rel->users), recipient (rel->users), text, read

Assumptions (called out honestly):
  * `avatar` is a file field — seeded profiles have no photo (the frontend
    already falls back to initials/placeholder), so it's left unset.
  * `posts.image` (url) is left empty — text-only posts render fine.
  * `posts.degree` reuses the same short badge values the UI uses ("M.Sc." /
    "B.Sc."); init_schema caps it at 20 chars so we keep it short.
  * `verified` / email-verification is NOT set — these are demo accounts and
    the directory read rules only require auth, not verification.
  * A default password ("UniCircle2026!") is set for every seeded account so
    they are real, loginable auth records; override with SEED_PASSWORD.
"""
import json, os, sys, urllib.request, urllib.error, urllib.parse

BASE = os.environ.get("PB_URL", os.environ.get("PB_BASE", "http://127.0.0.1:8090")).rstrip("/")
ADMIN_EMAIL = os.environ.get("PB_ADMIN_EMAIL")
ADMIN_PASSWORD = os.environ.get("PB_ADMIN_PASSWORD")
SEED_PASSWORD = os.environ.get("SEED_PASSWORD", "UniCircle2026!")


def req(method, path, body=None, token=None):
    data = json.dumps(body).encode() if body is not None else None
    headers = {"Content-Type": "application/json"}
    if token:
        headers["Authorization"] = token
    r = urllib.request.Request(BASE + path, data=data, method=method, headers=headers)
    try:
        with urllib.request.urlopen(r, timeout=20) as resp:
            return resp.status, json.loads(resp.read() or "{}")
    except urllib.error.HTTPError as e:
        try:
            return e.code, json.loads(e.read() or "{}")
        except Exception:
            return e.code, {}
    except urllib.error.URLError as e:
        print(f"ERROR: cannot reach PocketBase at {BASE} ({e.reason})", file=sys.stderr)
        sys.exit(1)


def admin_login():
    if not ADMIN_EMAIL or not ADMIN_PASSWORD:
        print("ERROR: set PB_ADMIN_EMAIL and PB_ADMIN_PASSWORD env vars.", file=sys.stderr)
        sys.exit(1)
    # PB v0.39: superuser auth lives under the _superusers collection.
    st, auth = req("POST", "/api/collections/_superusers/auth-with-password",
                   {"identity": ADMIN_EMAIL, "password": ADMIN_PASSWORD})
    if st != 200:
        print(f"ERROR: admin login failed ({st}): {auth}", file=sys.stderr)
        sys.exit(1)
    return auth["token"]


# --- 10 diverse SBE alumni personas (tone matches js/app.js demo personas) ---
PROFILES = [
    {"key": "lena.fischer", "name": "Lena Fischer",
     "headline": "Investment Banking Analyst at Goldman Sachs | SBE Finance",
     "location": "London, United Kingdom", "degree": "M.Sc. Financial Economics",
     "mentor": True, "mentor_offer": "IB recruiting & assessment-centre prep for finalists",
     "supporter": True},
    {"key": "sven.dijkstra", "name": "Sven Dijkstra",
     "headline": "Corporate Finance Associate at KPMG Netherlands",
     "location": "Amsterdam, Netherlands", "degree": "M.Sc. Financial Economics",
     "mentor": True, "mentor_offer": "CV reviews & Big Four interview coaching"},
    {"key": "amara.okonkwo", "name": "Amara Okonkwo",
     "headline": "Strategy Consultant at McKinsey & Company",
     "location": "Munich, Germany", "degree": "M.Sc. Corporate Governance",
     "mentor": True, "mentor_offer": "Case-interview practice for aspiring consultants",
     "supporter": True},
    {"key": "tobias.mueller", "name": "Tobias Müller",
     "headline": "Risk Strategy Architect at Binance | Fintech",
     "location": "Amsterdam, Netherlands", "degree": "M.Sc. Econometrics"},
    {"key": "chiara.rossi", "name": "Chiara Rossi",
     "headline": "Junior Product Specialist at Booking.com | Agile Practitioner",
     "location": "Amsterdam, Netherlands", "degree": "B.Sc. International Business"},
    {"key": "david.dobele", "name": "David Döbele",
     "headline": "Co-Founder @ pumpkin careers | Munich Alumni Chair",
     "location": "Munich, Germany", "degree": "M.Sc. Financial Economics",
     "mentor": True, "mentor_offer": "Startup & early-career mentoring, Munich hub",
     "supporter": True},
    {"key": "sofia.jansen", "name": "Sofia Jansen",
     "headline": "ESG Analyst at Triodos Bank | Sustainable Finance",
     "location": "Maastricht, Netherlands", "degree": "M.Sc. Sustainable Finance"},
    {"key": "marc.laurent", "name": "Marc Laurent",
     "headline": "Data Scientist at Adyen | ex-SBE Econometrics",
     "location": "Amsterdam, Netherlands", "degree": "M.Sc. Econometrics",
     "mentor": True, "mentor_offer": "Breaking into data/quant roles from an SBE degree"},
    {"key": "hannah.becker", "name": "Hannah Becker",
     "headline": "Transaction Advisory at EY | SBE Alumni London",
     "location": "London, United Kingdom", "degree": "M.Sc. Financial Economics"},
    {"key": "lucas.meyer", "name": "Lucas Meyer",
     "headline": "Graduate Trainee, Corporate Banking at ING",
     "location": "Amsterdam, Netherlands", "degree": "B.Sc. International Business"},
]

# --- feed posts (author key -> text, short degree badge) ---
POSTS = [
    {"author": "lena.fischer",
     "text": "Two years out of SBE and the PBL muscle still pays off — walked into an M&A pitch today and realised the 'brainstorm, define, self-study, discuss' loop is basically how a deal team works. Whatever you think of the tutorials, they train you well.",
     "degree": "M.Sc.", "likes": 34},
    {"author": "david.dobele",
     "text": "Munich alumni: our next UniCircle meetup is booked at the Hofbräuhaus. 3,000+ Maastricht grads around Bavaria and somehow we still only bump into each other at the airport. Come say hi — first round on the chapter. 🍻",
     "degree": "M.Sc.", "likes": 51},
    {"author": "sven.dijkstra",
     "text": "Reviewed 6 alumni CVs this week for Big Four applications. One recurring fix: stop listing every Period 4 group project — lead with the one deliverable you actually owned. SBE gives you plenty of those. Happy to look at yours, DM me.",
     "degree": "M.Sc.", "likes": 28},
    {"author": "amara.okonkwo",
     "text": "Doing case prep with two current SBE students this month. If you're recruiting for consulting: the Maastricht seminar format already taught you to structure an argument under pressure — you just have to name the framework out loud now. You're more ready than you think.",
     "degree": "M.Sc.", "likes": 40},
    {"author": "marc.laurent",
     "text": "Reminder that an Econometrics degree from SBE is a quant degree in disguise. Half my Adyen data team came from social-science stats backgrounds. If you can survive Advanced Econometrics you can absolutely learn to ship a model. 📈",
     "degree": "M.Sc.", "likes": 37},
    {"author": "sofia.jansen",
     "text": "Back in Maastricht for the sustainable-finance guest lectures. Wild to sit in the same Tapijnkazerne rooms as a working analyst now. If any current students want to talk ESG careers over a coffee at the Markt, I'm around all week.",
     "degree": "M.Sc.", "likes": 22},
    {"author": "chiara.rossi",
     "text": "Six months into my first product role and the thing that transferred best from IB at SBE wasn't a model — it was being comfortable presenting a half-formed idea to a room and defending it. Turns out that's 80% of the job.",
     "degree": "B.Sc.", "likes": 19},
    {"author": "hannah.becker",
     "text": "London SBE crew — the finance network night at The Ned is filling up. Asset management, IB, transaction advisory all in one room. Great excuse to trade war stories and figure out who's hiring. See you there.",
     "degree": "M.Sc.", "likes": 25},
]

# --- short message threads (sender key, recipient key, text) in order ---
THREADS = [
    ("lucas.meyer", "sven.dijkstra",
     "Hi Sven — saw your CV post. I'm a graduate trainee at ING and applying to KPMG next round. Could I send you mine?"),
    ("sven.dijkstra", "lucas.meyer",
     "Of course, that's exactly what I'm here for. Send it over and I'll mark it up this week — flag the KPMG deadline so I prioritise."),
    ("lucas.meyer", "sven.dijkstra",
     "Legend, thank you! Deadline's the 20th. Sending now."),

    ("chiara.rossi", "amara.okonkwo",
     "Amara, would love to do a case prep session — I'm leaning consulting over another product role. Are your slots still open?"),
    ("amara.okonkwo", "chiara.rossi",
     "Yes! I've got two students this month but happy to add you. Your Booking.com product background is a real asset in cases — we'll lean into it."),

    ("marc.laurent", "tobias.mueller",
     "Tobias — fellow Econometrics grad here. We're building out the risk-model stack at Adyen. Would be great to compare notes on how Binance handles it, coffee in Amsterdam?"),
    ("tobias.mueller", "marc.laurent",
     "Ha, always up for talking shop with an SBE econometrician. I'm in the city Thursdays — let's do it."),
]


def find_user_by_email(token, email):
    filt = urllib.parse.quote(f'email="{email}"')
    st, res = req("GET", f"/api/collections/users/records?filter={filt}&perPage=1", token=token)
    items = res.get("items") or []
    return items[0] if items else None


def main():
    token = admin_login()
    print(f"Connected to {BASE} as {ADMIN_EMAIL}\n")

    ids = {}          # key -> user id
    created_u = skipped_u = 0

    for p in PROFILES:
        email = f"{p['key']}@sbe.unicircle.eu"
        existing = find_user_by_email(token, email)
        if existing:
            ids[p["key"]] = existing["id"]
            skipped_u += 1
            print(f"  = user exists: {p['name']}")
            continue
        body = {
            "email": email, "password": SEED_PASSWORD, "passwordConfirm": SEED_PASSWORD,
            "name": p["name"], "headline": p["headline"], "location": p["location"],
            "degree": p["degree"], "linkedin_imported": False,
            "supporter": p.get("supporter", False),
            "mentor": p.get("mentor", False), "mentor_offer": p.get("mentor_offer", ""),
        }
        st, rec = req("POST", "/api/collections/users/records", body, token=token)
        if st == 200:
            ids[p["key"]] = rec["id"]
            created_u += 1
            tag = " (mentor)" if p.get("mentor") else ""
            print(f"  + user: {p['name']}{tag}")
        else:
            print(f"  ! failed user {p['name']}: {st} {rec}")

    # posts — idempotency: skip if this author already has a post with same text
    created_p = skipped_p = 0
    for post in POSTS:
        aid = ids.get(post["author"])
        if not aid:
            continue
        filt = urllib.parse.quote(f'author="{aid}"')
        st, res = req("GET", f"/api/collections/posts/records?filter={filt}&perPage=200", token=token)
        existing_texts = {i.get("text") for i in (res.get("items") or [])}
        if post["text"] in existing_texts:
            skipped_p += 1
            continue
        body = {"author": aid, "text": post["text"], "degree": post["degree"], "likes": post["likes"]}
        st, rec = req("POST", "/api/collections/posts/records", body, token=token)
        if st == 200:
            created_p += 1
        else:
            print(f"  ! failed post by {post['author']}: {st} {rec}")

    # messages — idempotency: skip if identical sender/recipient/text already exists
    created_m = skipped_m = 0
    for sender, recipient, text in THREADS:
        sid, rid = ids.get(sender), ids.get(recipient)
        if not (sid and rid):
            continue
        filt = urllib.parse.quote(f'sender="{sid}" && recipient="{rid}"')
        st, res = req("GET", f"/api/collections/messages/records?filter={filt}&perPage=200", token=token)
        existing_texts = {i.get("text") for i in (res.get("items") or [])}
        if text in existing_texts:
            skipped_m += 1
            continue
        body = {"sender": sid, "recipient": rid, "text": text, "read": True}
        st, rec = req("POST", "/api/collections/messages/records", body, token=token)
        if st == 200:
            created_m += 1
        else:
            print(f"  ! failed message {sender}->{recipient}: {st} {rec}")

    print("\n--- Seed summary ---")
    print(f"users:    {created_u} created, {skipped_u} already present")
    print(f"posts:    {created_p} created, {skipped_p} skipped")
    print(f"messages: {created_m} created, {skipped_m} skipped")
    mentors = [p["name"] for p in PROFILES if p.get("mentor")]
    print(f"mentors available: {', '.join(mentors)}")
    print("Seed password for all demo accounts:", SEED_PASSWORD)
    print("Done ✅")


if __name__ == "__main__":
    main()
