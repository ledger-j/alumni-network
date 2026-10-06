// Shared helpers for waitlist.pb.js (JSVM handlers run isolated, so they
// require() this module instead of using top-level functions).
const SITE = "https://unicircle.eu";
const API = "https://api.unicircle.eu";

function esc(s) {
  return String(s == null ? "" : s).replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

const ROLE = { alumnus: "alumnus", student: "student", university_staff: "university team member", other: "member" };

function confirmationHtml(r) {
  const city = esc(r.get("city"));
  const role = ROLE[r.get("role")] || "member";
  const name = esc((r.get("name") || "").split(/\s+/)[0]);
  const invite = SITE + "/waitlist.html?ref=" + encodeURIComponent("invite-" + r.id.slice(0, 8));
  const unsub = API + "/api/uc/waitlist/unsubscribe?id=" + encodeURIComponent(r.id) + "&t=" + encodeURIComponent(r.get("unsub_token"));
  const student = r.get("role") === "student";
  return `<!doctype html><html><body style="margin:0;background:#faf9f6;font-family:Helvetica,Arial,sans-serif;color:#2b2a26;">
<div style="max-width:560px;margin:0 auto;padding:40px 24px;">
  <p style="font-size:13px;letter-spacing:.12em;text-transform:uppercase;color:#8b887e;margin:0 0 18px;">UniCircle · waitlist</p>
  <h1 style="font-family:Georgia,serif;font-weight:400;font-size:34px;line-height:1.15;margin:0 0 18px;">You're in the circle${name ? ", " + name : ""}.</h1>
  <p style="font-size:16px;line-height:1.7;color:#5c5a53;margin:0 0 16px;">Thanks for joining as ${role === "alumnus" ? "an" : "a"} ${role} in <b style="color:#2b2a26;">${city}</b>. We're opening UniCircle in waves, city by city — we'll email you the moment your spot opens.</p>
  <div style="background:#ffffff;border:1px solid rgba(43,42,38,.1);border-radius:18px;padding:20px 22px;margin:24px 0;">
    <p style="margin:0 0 10px;font-weight:bold;">What you'll get</p>
    <p style="margin:0 0 8px;font-size:15px;line-height:1.6;color:#5c5a53;">• ${student ? "Mentoring from alumni who sat where you sit" : "A simple way to mentor the students coming up behind you"}</p>
    <p style="margin:0 0 8px;font-size:15px;line-height:1.6;color:#5c5a53;">• The map: <span style="color:#d64541;">red</span> dots for alumni, <span style="color:#2f6fdb;">blue</span> for students — city and neighbourhood, never your street</p>
    <p style="margin:0;font-size:15px;line-height:1.6;color:#5c5a53;">• ${student ? "Student exchange: find the people from your course in your new city" : "Events and city chapters with the people you studied with"}</p>
  </div>
  <p style="font-size:16px;line-height:1.7;color:#5c5a53;margin:0 0 14px;">The more people from ${city} join, the sooner we open there. Share your personal invite link:</p>
  <p style="margin:0 0 28px;"><a href="${invite}" style="display:inline-block;background:#2b2a26;color:#faf9f6;text-decoration:none;padding:13px 22px;border-radius:999px;font-weight:bold;">Invite your people →</a></p>
  <p style="font-size:14px;line-height:1.6;color:#5c5a53;margin:0 0 24px;">Ideas or questions? Write to <a href="mailto:hello@unicircle.eu" style="color:#2b2a26;">hello@unicircle.eu</a> — a human reads every one.</p>
  <hr style="border:0;border-top:1px solid rgba(43,42,38,.12);margin:28px 0 16px;">
  <p style="font-size:12px;line-height:1.6;color:#8b887e;margin:0;">You're receiving this because ${esc(r.get("email"))} joined the waitlist at unicircle.eu. We only store your city (never a street address). <a href="${unsub}" style="color:#8b887e;">Remove me from the waitlist</a> · <a href="${SITE}/privacy.html" style="color:#8b887e;">Privacy</a></p>
</div></body></html>`;
}

function page(title, body) {
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(title)} · UniCircle</title></head>
<body style="margin:0;background:#faf9f6;font-family:Helvetica,Arial,sans-serif;color:#2b2a26;">
<div style="max-width:520px;margin:12vh auto;padding:24px;text-align:center;">
<h1 style="font-family:Georgia,serif;font-weight:400;font-size:34px;margin:0 0 14px;">${esc(title)}</h1>
<p style="font-size:16px;line-height:1.7;color:#5c5a53;">${body}</p>
<p style="margin-top:28px;"><a href="${SITE}" style="color:#2b2a26;font-weight:bold;">Back to UniCircle</a></p></div></body></html>`;
}

module.exports = { confirmationHtml, page, esc };
