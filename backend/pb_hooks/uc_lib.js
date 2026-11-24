// UniCircle shared hook helpers (CommonJS, loaded with require(`${__hooks}/uc_lib.js`)).
// PocketBase runs every hook handler in its own isolated context, so shared logic must
// live in a module, not in top-level functions of a *.pb.js file.
//
// Everything here is the server-side half of rules that API rules cannot express
// (docs/redesign/objections.md): contact rules, points, location snapping, limits.

const DAY = 24 * 3600 * 1000;
const GRID = 0.05;                       // map locations are snapped to ~5 km cells
const POINTS = { mentoring: 15, tutoring: 10 };   // product numbers: change here only
const DAILY_POINTS_CAP = 15;
const MAX_GROUP = 12;
const MAX_DOCS = 30;

const iso = (msAgo) => new Date(Date.now() - msAgo).toISOString().replace("T", " ");
const parse = (s) => Date.parse(String(s || "").replace(" ", "T"));
const snap = (v) => Math.round(Math.round(Number(v) / GRID) * GRID * 100) / 100;
const minActiveMs = () => {
  const h = parseFloat($os.getenv("UC_MIN_ACTIVE_HOURS") || "24");
  return (isNaN(h) ? 24 : h) * 3600 * 1000;
};

function exists(app, collection, filter, params) {
  try { app.findFirstRecordByFilter(collection, filter, params); return true; } catch (_) { return false; }
}

// True when `blocker` has blocked `blocked`.
function isBlocked(app, blocker, blocked) {
  return exists(app, "blocks", "blocker = {:a} && blocked = {:b}", { a: blocker, b: blocked });
}

// The recipient already wrote to the sender, or an accepted collaboration exists either way:
// replying is always allowed.
function hasReply(app, senderId, recipientId) {
  return exists(app, "messages", "sender = {:r} && recipient = {:s}", { r: recipientId, s: senderId })
    || exists(app, "collab_requests", "status = 'accepted' && ((from = {:s} && to = {:r}) || (from = {:r} && to = {:s}))",
      { s: senderId, r: recipientId });
}

// The one gate for every door that starts contact (messages, mentorships, collaboration
// requests, group invites). door = "message" | "mentorship" | "collab" | "group".
// open: anyone · points: needs min_points (or a reply) · request: needs an accepted collaboration
// request (or a reply; the collaboration request itself is the door) · closed: replies only.
// Legacy rows with no contact_mode count as open.
function contactCheck(app, sender, recipientId, door) {
  if (!recipientId || sender.id === recipientId) return;
  let rec;
  try { rec = app.findRecordById("users", recipientId); } catch (_) { throw new BadRequestError("Unknown member."); }
  if (isBlocked(app, rec.id, sender.id)) throw new ForbiddenError("This member is not accepting contact from you.");
  const mode = rec.getString("contact_mode") || "open";
  if (mode === "open") return;
  if (door !== "collab" && hasReply(app, sender.id, rec.id)) return;
  if (mode === "closed") throw new ForbiddenError("This member is not accepting contact from you.");
  if (mode === "points") {
    const need = rec.getInt("min_points");
    if (sender.getInt("points") >= need) return;
    throw new ForbiddenError("This member asks for " + need + " status points before contact. Earn them by tutoring or mentoring.");
  }
  if (mode === "request") {
    if (door === "collab") return;
    throw new ForbiddenError("This member accepts collaboration requests only. Send one first.");
  }
}

function recount(app, table, filter, params) {
  return app.findRecordsByFilter(table, filter, "", 500, 0, params).length;
}

// Points: one award per closed mentoring/tutoring, written with the ledger row in one
// transaction. The unique index (user, reason, ref) makes a double award impossible
// even for parallel requests. Returns a short reason string for logs/tests.
function awardForClose(app, ms, prevStatus) {
  if (prevStatus !== "active") return "not-active";
  const mentor = ms.getString("mentor"), mentee = ms.getString("mentee");
  const activeAt = parse(ms.getString("active_at"));
  if (!activeAt || Date.now() - activeAt < minActiveMs()) return "too-short";
  const key = [mentor, mentee].sort().join("");
  let result = "error";
  try {
    // ALL checks and the insert run in ONE transaction on PocketBase's single write connection,
    // so parallel closes by the same mentor are serialised: the daily cap, the pair rule and the
    // reciprocal rule cannot be raced. The unique (user, reason, ref) index stays as the backstop.
    app.runInTransaction((tx) => {
      if (exists(tx, "points_ledger", "pair_key = {:k} && created >= {:c}", { k: key, c: iso(7 * DAY) })) { result = "pair-week"; return; }
      if (exists(tx, "points_ledger", "user = {:m} && pair_key = {:k} && created >= {:c}", { m: mentee, k: key, c: iso(30 * DAY) })) { result = "reciprocal"; return; }
      const today = tx.findRecordsByFilter("points_ledger", "user = {:u} && created >= {:c}", "", 200, 0, { u: mentor, c: iso(DAY) });
      let sum = 0; today.forEach((r) => { sum += r.getInt("delta"); });
      const room = DAILY_POINTS_CAP - sum;
      if (room <= 0) { result = "daily-cap"; return; }
      const amount = Math.min(POINTS[ms.getString("kind")] || 0, room);
      if (amount <= 0) { result = "no-value"; return; }
      const col = tx.findCollectionByNameOrId("points_ledger");
      const row = new Record(col);
      row.set("user", mentor); row.set("delta", amount); row.set("reason", "session_closed");
      row.set("ref", "mentorship:" + ms.id); row.set("pair_key", key);
      tx.save(row);
      const out = new DynamicModel({ s: 0 });
      tx.db().newQuery("SELECT COALESCE(SUM(delta),0) AS s FROM points_ledger WHERE user = {:u}").bind({ u: mentor }).one(out);
      const user = tx.findRecordById("users", mentor);
      user.set("points", out.s);
      tx.saveNoValidate(user);
      result = "awarded";
    });
  } catch (err) { return "duplicate"; }
  return result;
}

// The authenticated member of a request (null for superusers/scripts, which bypass member checks).
function member(e) { return (!e.hasSuperuserAuth() && e.auth) ? e.auth : null; }

// Snap lat/lng of a record to the public grid before it is stored.
function snapLocation(e) {
  ["lat", "lng"].forEach((k) => {
    const v = e.record.get(k);
    if (v !== null && v !== "" && v !== undefined) e.record.set(k, snap(v));
  });
}

// Keep events.going_count equal to the number of RSVP rows.
function syncGoing(e) {
  try {
    const id = e.record.getString("event");
    const ev = e.app.findRecordById("events", id);
    ev.set("going_count", e.app.countRecords("rsvps", $dbx.hashExp({ event: id })));
    e.app.saveNoValidate(ev);
  } catch (_) { /* event already deleted */ }
}

// NOTE: PocketBase casts non-numeric strings on number fields to 0 BEFORE hooks run
// (e.requestInfo().body already holds the cast value), so "abc" cannot be rejected here.
// The effect is limited to the sender's own row (lat/lng 0, accent_hue 0) and the UI sends
// numbers only; the field min/max and the grid snap bound everything else.

// A record field must be empty or one of the allowed values.
function requireOneOf(e, field, allowed) {
  const v = e.record.getString(field);
  if (v !== "" && allowed.indexOf(v) < 0) throw new BadRequestError(field + " must be one of: " + allowed.join(", ") + ".");
}

// Event dates: start within the next 12 months (1 h grace), end after start and within 14 days.
function validateEventDates(e) {
  const start = parse(e.record.getString("start")), end = parse(e.record.getString("end"));
  if (isNaN(start)) throw new BadRequestError("Pick a start date.");
  if (start < Date.now() - 3600 * 1000 || start > Date.now() + 365 * DAY) throw new BadRequestError("The date must be within the next 12 months.");
  if (!isNaN(end) && (end < start || end - start > 14 * DAY)) throw new BadRequestError("The end must be after the start and within 14 days.");
}

module.exports = {
  requireOneOf, validateEventDates,
  member, snapLocation, syncGoing,
  DAY, GRID, MAX_GROUP, MAX_DOCS, iso, parse, snap, exists, isBlocked, hasReply,
  contactCheck, awardForClose, recount,
};
