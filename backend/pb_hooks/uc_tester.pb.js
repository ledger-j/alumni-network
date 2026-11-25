/// <reference path="../pb_data/types.d.ts" />
// UniCircle test access: testers enter through a hidden link (index.html#enter/<key>), no password.
//  - POST /api/uc/tester/enter {key, name} finds or creates the member
//    tester-<slug>@testers.unicircle.eu (tester=true, verified=true, random password that is never
//    returned) and answers with a normal PocketBase auth response (token + record).
//  - The route stays OFF until the operator sets UC_TESTER_KEY (16+ characters) in the PocketBase
//    container environment. Without it: 501. Rotating the key revokes the link (not the sessions).
//  - Brute force: at most 10 WRONG keys per client IP per 10 minutes, then 429 for everyone from that
//    IP (right key included) until the window passes. Counted in $app.store(): the app-level Go store
//    is shared by every JSVM instance (hooks run in a pool of isolated VMs, so a JS variable would
//    not be), it holds one JSON string so no JS object crosses VMs, and it resets on restart (fine
//    for a 10-minute window). Superusers can clear it: DELETE /api/uc/tester/attempts.
//  - Public sign-up is closed (users createRule = null, backend/init_schema.py); $app.save bypasses
//    API rules, so this route is the only self-service way in. OAuth2 must not create accounts either.

routerAdd("POST", "/api/uc/tester/enter", (e) => {
  const WINDOW = 10 * 60 * 1000, MAX_FAILS = 10, RL_KEY = "uc_tester_rl";
  const secret = $os.getenv("UC_TESTER_KEY") || "";
  if (secret.length < 16) throw new ApiError(501, "Test access is not switched on.", {});

  // ---- rate limit (per client IP, failed keys only)
  const ip = e.realIP() || "unknown";
  const now = Date.now();
  let book = {};
  try { book = JSON.parse(String($app.store().get(RL_KEY) || "{}")) || {}; } catch (_) { book = {}; }
  Object.keys(book).forEach((k) => {
    book[k] = (book[k] || []).filter((t) => now - t < WINDOW);
    if (!book[k].length) delete book[k];
  });
  if ((book[ip] || []).length >= MAX_FAILS) {
    $app.store().set(RL_KEY, JSON.stringify(book));
    throw new ApiError(429, "Too many tries. Wait 10 minutes.", {});
  }

  // ---- key check: compare fixed-length SHA-256 digests with no early exit
  const data = e.requestInfo().body || {};
  const a = $security.sha256(String(data.key || "")), b = $security.sha256(secret);
  let diff = 0;
  for (let i = 0; i < b.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  if (diff !== 0) {
    book[ip] = (book[ip] || []).concat([now]);
    $app.store().set(RL_KEY, JSON.stringify(book));
    throw new ForbiddenError("This test link is not valid.", {});
  }
  $app.store().set(RL_KEY, JSON.stringify(book));

  // ---- name: 1-40 letters, spaces, hyphens, apostrophes
  const name = String(data.name || "").trim().replace(/\s+/g, " ");
  if (name.length < 1 || name.length > 40 || !/^[A-Za-zÀ-ÖØ-öø-ɏ' -]+$/.test(name)) {
    throw new BadRequestError("Use 1 to 40 letters for your first name (spaces, - and ' are fine).", {});
  }
  let plain = name;
  try { plain = name.normalize("NFD").replace(/[̀-ͯ]/g, ""); } catch (_) { /* keep as is */ }
  let slug = plain.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 40);
  if (!slug) slug = "t" + $security.sha256(name.toLowerCase()).slice(0, 10);

  // ---- find or create the tester member.
  // A name alone is not an identity (anyone with the link could type "Anton"): on create the browser
  // gets a one-time device secret; only its SHA-256 is kept in the hidden field tester_secret. Re-entry
  // with the same name needs that secret, otherwise a NEW account (anton-2, anton-3, ...) is made.
  const MAX_TESTERS = 200;
  const device = String(data.device || "");
  const devHash = device.length >= 32 ? $security.sha256(device) : "";
  let rec = null, issued = "";
  for (let n = 1; n <= 50 && !rec; n++) {
    const email = "tester-" + slug + (n > 1 ? "-" + n : "") + "@testers.unicircle.eu";
    let found = null;
    try { found = $app.findAuthRecordByEmail("users", email); } catch (_) { found = null; }
    if (found) {
      if (found.getBool("tester") && devHash && found.getString("tester_secret") === devHash) rec = found;
      continue;
    }
    if ($app.countRecords("users", $dbx.hashExp({ tester: true })) >= MAX_TESTERS) {
      throw new ApiError(409, "The test round is full. Ask the UniCircle team for a spot.", {});
    }
    issued = $security.randomString(48);
    rec = new Record($app.findCollectionByNameOrId("users"));
    rec.set("email", email);
    rec.set("name", name);
    rec.set("tester", true);
    rec.set("tester_secret", $security.sha256(issued));
    rec.setVerified(true);
    rec.set("emailVisibility", false);
    rec.setPassword($security.randomString(40));
    $app.save(rec);
  }
  if (!rec) throw new ApiError(409, "Too many testers with this name. Add an initial, e.g. Anton B.", {});
  // Same shape as a PocketBase auth response ({token, record}) plus the one-time device secret.
  // Hidden fields (tester_secret) never serialise into the record JSON.
  const out = { token: rec.newAuthToken(), record: rec };
  if (issued) out.device = issued;
  return e.json(200, out);
});

// Superuser only: clear the wrong-key counter (used by backend/verify_tester.py and tester_admin.py).
routerAdd("DELETE", "/api/uc/tester/attempts", (e) => {
  $app.store().remove("uc_tester_rl");
  return e.noContent(204);
}, $apis.requireSuperuserAuth());

// Sign-up is closed: OAuth2 (LinkedIn) may sign in an EXISTING member but never create one.
onRecordAuthWithOAuth2Request((e) => {
  if ((e.isNewRecord || !e.record) && !e.hasSuperuserAuth()) {
    throw new ForbiddenError("UniCircle is invite-only for now. Join the waitlist at unicircle.eu.", {});
  }
  e.next();
}, "users");
