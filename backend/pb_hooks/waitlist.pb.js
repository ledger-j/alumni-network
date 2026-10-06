/// <reference path="../pb_data/types.d.ts" />
// UniCircle waitlist: confirmation email + one-click unsubscribe.
// Lives in /opt/unicircle/pb_hooks (mounted at /pb/pb_hooks). PocketBase
// reloads hook files automatically when they change.

// 1) Make sure the hidden per-row unsubscribe token field exists.
onBootstrap((e) => {
  e.next();
  try {
    const c = e.app.findCollectionByNameOrId("waitlist");
    if (!c.fields.getByName("unsub_token")) {
      c.fields.add(new TextField({ name: "unsub_token", hidden: true, max: 64 }));
      e.app.save(c);
      console.log("[waitlist] added hidden field unsub_token");
    }
    const s = e.app.settings();
    console.log("[waitlist] mail hook ready · smtp.enabled=" + s.smtp.enabled + " · sender=" + s.meta.senderAddress);
  } catch (err) {
    console.log("[waitlist] bootstrap check failed: " + err);
  }
});

// 2) Every new signup gets a server-generated token (overrides anything sent).
onRecordCreate((e) => {
  e.record.set("unsub_token", $security.randomString(40));
  e.next();
}, "waitlist");

// 3) After the row is committed, send the confirmation. Never fails the signup.
onRecordAfterCreateSuccess((e) => {
  e.next();
  const tpl = require(`${__hooks}/waitlist_mail.js`);
  try {
    const s = e.app.settings();
    const msg = new MailerMessage({
      from: { address: s.meta.senderAddress, name: s.meta.senderName || "UniCircle" },
      to: [{ address: e.record.get("email") }],
      subject: "You're on the UniCircle waitlist",
      html: tpl.confirmationHtml(e.record),
    });
    e.app.newMailClient().send(msg);
    console.log("[waitlist] confirmation sent · " + e.record.id);
  } catch (err) {
    console.log("[waitlist] confirmation FAILED · " + e.record.id + " · " + err);
  }
}, "waitlist");

// 4) One-click unsubscribe: deletes the row (GDPR erasure), constant-time token check.
routerAdd("GET", "/api/uc/waitlist/unsubscribe", (e) => {
  const tpl = require(`${__hooks}/waitlist_mail.js`);
  const id = e.request.url.query().get("id") || "";
  const t = e.request.url.query().get("t") || "";
  let rec = null;
  try { rec = $app.findRecordById("waitlist", id); } catch (_) { rec = null; }
  if (!rec || !t || !$security.equal(String(rec.get("unsub_token")), t)) {
    return e.html(200, tpl.page("Already removed", "This link has already been used, or the entry no longer exists. Nothing else to do."));
  }
  $app.delete(rec);
  console.log("[waitlist] unsubscribed + deleted · " + id);
  return e.html(200, tpl.page("You're off the list", "We've deleted your waitlist entry and won't email you again. Changed your mind? You can rejoin any time at unicircle.eu."));
});
