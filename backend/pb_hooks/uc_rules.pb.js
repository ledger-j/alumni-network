/// <reference path="../pb_data/types.d.ts" />
// UniCircle round-2 server rules (see docs/redesign/objections.md and backend/pb_hooks/uc_lib.js).
// API rules in backend/init_schema.py cover ownership and field immutability; these hooks
// cover what rules cannot express: contact rules, points, snapping, caps, group membership.
// Superuser requests (admin UI, scripts with a superuser token) bypass the member checks.

// ---------------------------------------------------------------- contact doors
onRecordCreateRequest((e) => {
  const lib = require(`${__hooks}/uc_lib.js`);
  const me = lib.member(e);
  if (me) lib.contactCheck(e.app, me, e.record.getString("recipient"), "message");
  e.next();
}, "messages");

onRecordCreateRequest((e) => {
  const lib = require(`${__hooks}/uc_lib.js`);
  const me = lib.member(e);
  if (me) lib.contactCheck(e.app, me, e.record.getString("mentor"), "mentorship");
  e.next();
}, "mentorships");

onRecordCreateRequest((e) => {
  const lib = require(`${__hooks}/uc_lib.js`);
  const me = lib.member(e);
  if (me) {
    lib.contactCheck(e.app, me, e.record.getString("to"), "collab");
    const recent = e.app.findRecordsByFilter("collab_requests", "from = {:f} && created >= {:c}", "", 11, 0,
      { f: me.id, c: lib.iso(lib.DAY) });
    if (recent.length >= 10) throw new BadRequestError("Daily limit reached: 10 collaboration requests per day.");
  }
  e.next();
}, "collab_requests");

// ---------------------------------------------------------------- mentoring: stamp + points
onRecordUpdateRequest((e) => {
  const lib = require(`${__hooks}/uc_lib.js`);
  const prev = e.record.original().getString("status");
  const now = e.record.getString("status");
  if (prev !== "active" && now === "active") e.record.set("active_at", new DateTime());
  e.next();
  if (prev !== "closed" && now === "closed") {
    try { console.log("[points] mentorship " + e.record.id + ": " + lib.awardForClose(e.app, e.record, prev)); }
    catch (err) { console.log("[points] award failed: " + err); }
  }
}, "mentorships");

onRecordCreateRequest((e) => {
  const lib = require(`${__hooks}/uc_lib.js`);
  const me = lib.member(e);
  if (me) {
    const ms = e.app.findRecordById("mentorships", e.record.getString("mentorship"));
    if (ms.getString("mentor") !== me.id && ms.getString("mentee") !== me.id) throw new ForbiddenError("Not your mentorship.");
    if (ms.getString("status") !== "active") throw new BadRequestError("Documents can be added while the mentorship is active.");
    const n = e.app.findRecordsByFilter("mentorship_docs", "mentorship = {:m}", "", lib.MAX_DOCS + 1, 0, { m: ms.id }).length;
    if (n >= lib.MAX_DOCS) throw new BadRequestError("Document limit reached (" + lib.MAX_DOCS + " per mentorship).");
  }
  e.next();
}, "mentorship_docs");

// Documents are deleted 90 days after their mentorship closed.
cronAdd("uc_docs_cleanup", "17 3 * * *", () => {
  const cutoff = new Date(Date.now() - 90 * 24 * 3600 * 1000).toISOString().replace("T", " ");
  const docs = $app.findRecordsByFilter("mentorship_docs", "mentorship.status = 'closed' && mentorship.updated < {:c}", "", 200, 0, { c: cutoff });
  docs.forEach((d) => $app.delete(d));
});

// ---------------------------------------------------------------- map location: snap + once a day
onRecordCreateRequest((e) => {
  const lib = require(`${__hooks}/uc_lib.js`);
  lib.snapLocation(e);
  e.next();
}, "user_locations");

onRecordUpdateRequest((e) => {
  const lib = require(`${__hooks}/uc_lib.js`);
  lib.snapLocation(e);
  const old = e.record.original();
  const moved = old.getFloat("lat") !== e.record.getFloat("lat") || old.getFloat("lng") !== e.record.getFloat("lng");
  if (moved && !e.hasSuperuserAuth()) {
    const age = Date.now() - lib.parse(old.getString("updated")), fresh = Date.now() - lib.parse(old.getString("created")) < 3600 * 1000;
    if (age < lib.DAY && !fresh) throw new BadRequestError("Your location can be changed once per day.");
  }
  e.next();
}, "user_locations");

// ---------------------------------------------------------------- events + RSVPs
onRecordCreateRequest((e) => {
  const lib = require(`${__hooks}/uc_lib.js`);
  const me = lib.member(e);
  if (!e.hasSuperuserAuth()) lib.validateEventDates(e);
  ["lat", "lng"].forEach((k) => {
    const v = e.record.get(k);
    if (v !== null && v !== "" && v !== undefined) e.record.set(k, lib.snap(v));
  });
  if (me) {
    const recent = e.app.findRecordsByFilter("events", "host = {:h} && created >= {:c}", "", 4, 0, { h: me.id, c: lib.iso(lib.DAY) });
    if (recent.length >= 3) throw new BadRequestError("Limit reached: 3 events per day.");
  }
  e.next();
}, "events");

onRecordCreateRequest((e) => {
  const lib = require(`${__hooks}/uc_lib.js`);
  const ev = e.app.findRecordById("events", e.record.getString("event"));
  const end = lib.parse(ev.getString("end")) || lib.parse(ev.getString("start")) + 3 * 3600 * 1000;
  if (ev.getBool("hidden") || end < Date.now()) throw new BadRequestError("This event is not open for RSVPs.");
  e.next();
}, "rsvps");

onRecordAfterCreateSuccess((e) => { require(`${__hooks}/uc_lib.js`).syncGoing(e); e.next(); }, "rsvps");
onRecordAfterDeleteSuccess((e) => { require(`${__hooks}/uc_lib.js`).syncGoing(e); e.next(); }, "rsvps");


// Event edits are validated like creates (only when a date field changes).
onRecordUpdateRequest((e) => {
  const lib = require(`${__hooks}/uc_lib.js`);
  const old = e.record.original();
  if (!e.hasSuperuserAuth() && (old.getString("start") !== e.record.getString("start") || old.getString("end") !== e.record.getString("end"))) lib.validateEventDates(e);
  ["lat", "lng"].forEach((k) => {
    const v = e.record.get(k);
    if (v !== null && v !== "" && v !== undefined) e.record.set(k, lib.snap(v));
  });
  e.next();
}, "events");

// ---------------------------------------------------------------- settings, deep profile, users: strict values

onRecordCreateRequest((e) => { const lib = require(`${__hooks}/uc_lib.js`); lib.requireOneOf(e, "visibility", ["members", "private"]); lib.requireOneOf(e, "source", ["self", "linkedin_import"]); e.next(); }, "profiles_deep");
onRecordUpdateRequest((e) => { const lib = require(`${__hooks}/uc_lib.js`); lib.requireOneOf(e, "visibility", ["members", "private"]); lib.requireOneOf(e, "source", ["self", "linkedin_import"]); e.next(); }, "profiles_deep");


// ---------------------------------------------------------------- group chat
onRecordCreateRequest((e) => {
  const lib = require(`${__hooks}/uc_lib.js`);
  const me = lib.member(e);
  if (me) {
    let members = e.record.getStringSlice("members");
    if (members.indexOf(me.id) < 0) members = [me.id].concat(members);
    if (members.length > lib.MAX_GROUP) throw new BadRequestError("A group has at most " + lib.MAX_GROUP + " members.");
    members.filter((m) => m !== me.id).forEach((m) => lib.contactCheck(e.app, me, m, "group"));
    e.record.set("members", members);
  }
  e.next();
}, "conversations");

onRecordUpdateRequest((e) => {
  const lib = require(`${__hooks}/uc_lib.js`);
  const me = lib.member(e);
  if (me) {
    const old = e.record.original().getStringSlice("members");
    const now = e.record.getStringSlice("members");
    if (now.indexOf(e.record.getString("owner")) < 0) throw new BadRequestError("The owner stays in the group; delete the group instead.");
    if (now.length > lib.MAX_GROUP) throw new BadRequestError("A group has at most " + lib.MAX_GROUP + " members.");
    now.filter((m) => old.indexOf(m) < 0).forEach((m) => lib.contactCheck(e.app, me, m, "group"));
  }
  e.next();
}, "conversations");

onRecordCreateRequest((e) => {
  const lib = require(`${__hooks}/uc_lib.js`);
  const me = lib.member(e);
  if (me) {
    const conv = e.app.findRecordById("conversations", e.record.getString("conversation"));
    if (conv.getStringSlice("members").indexOf(me.id) < 0) throw new ForbiddenError("You are not a member of this group.");
  }
  e.next();
}, "conversation_messages");

routerAdd("POST", "/api/uc/conversations/{id}/leave", (e) => {
  const conv = e.app.findRecordById("conversations", e.request.pathValue("id"));
  const me = e.auth.id;
  if (conv.getString("owner") === me) throw new BadRequestError("The owner cannot leave; delete the group instead.");
  const members = conv.getStringSlice("members");
  if (members.indexOf(me) < 0) throw new ForbiddenError("You are not a member of this group.");
  conv.set("members", members.filter((m) => m !== me));
  e.app.save(conv);
  return e.json(200, { left: true });
}, $apis.requireAuth("users"));
