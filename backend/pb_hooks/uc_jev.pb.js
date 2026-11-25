/// <reference path="../pb_data/types.d.ts" />
// Jev, the UniCircle assistant (voice + text). The browser matches simple commands locally
// (voice/intents.json); only text it cannot handle reaches this route.
// Privacy rules (same as uc_ai.pb.js, privacy.html "Jev assistant"):
//  - signed-in members only; text max 1000 chars; ~30 calls per member per 10 minutes;
//  - emails, phone numbers and links are stripped BEFORE the text leaves the server;
//  - the text is never logged; Google's Gemini API is the processor;
//  - Jev may keep a short fact per call in jev_memory (owner can list and delete; cap 100 rows).
// OFF until the operator sets GEMINI_API_KEY in the PocketBase environment. Without it: 501.

routerAdd("POST", "/api/uc/jev", (e) => {
  const key = $os.getenv("GEMINI_API_KEY");
  if (!key) throw new ApiError(501, "Jev is not switched on yet.", {});
  const uid = e.auth.id;

  const strip = (s) => String(s || "")
    .replace(/[\w.+-]+@[\w-]+(\.[\w-]+)+/g, " ")                    // emails
    .replace(/https?:\/\/\S+|www\.\S+/gi, " ")                      // urls
    .replace(/(\+?\d[\s().-]?){9,}/g, " ")                          // phone-like digit runs
    .replace(/\s+/g, " ").trim();

  const data = e.requestInfo().body || {};
  const raw = String(data.text || "");
  if (!raw.trim()) throw new BadRequestError("Say or type something first.");
  if (raw.length > 1000) throw new BadRequestError("That is too long for Jev (max 1000 characters).");
  const text = strip(raw);
  const lang = ({ en: "English", nl: "Dutch", de: "German" })[String(data.lang || "en").slice(0, 2).toLowerCase()] || "English";

  // --- per-member rate limit: fixed 10-minute window, kept in the app store (memory only)
  const WINDOW = 10 * 60 * 1000, MAX = 30, rk = "jev_rl_" + uid, now = Date.now();
  let rl = { t: now, n: 0 };
  try { const s = $app.store().get(rk); if (s) rl = JSON.parse(String(s)); } catch (_) { /* fresh window */ }
  if (now - rl.t > WINDOW) rl = { t: now, n: 0 };
  if (rl.n >= MAX) throw new ApiError(429, "Jev needs a short break. Try again in a few minutes.", {});
  rl.n += 1;
  $app.store().set(rk, JSON.stringify(rl));

  // --- what Jev already knows about this member (newest 20 rows)
  let mem = [];
  try {
    mem = $app.findRecordsByFilter("jev_memory", "user = {:u}", "-created", 20, 0, { u: uid })
      .map((r) => "- " + String(r.get("text")).slice(0, 300));
  } catch (_) { mem = []; }

  const ACTIONS = ["go:feed", "go:network", "go:map", "go:mentoring", "go:events", "go:pbl-hub", "go:jobs",
    "go:profile", "go:benefits", "open:messages", "open:jev", "search:network", "profile:change-cover",
    "profile:change-photo", "help"];
  const prompt =
    "You are Jev, the assistant of UniCircle, the alumni network of Maastricht University alumni and students. " +
    "Pages: feed (posts from the circle), network (alumni directory and search), map (members by city, city level only), " +
    "mentoring (find a mentor or tutor, offer mentoring), events (alumni events and RSVPs), pbl-hub (Case Hub: real business cases " +
    "for problem-based learning), jobs (alumni-only job board), profile (your profile, photo, cover, settings), " +
    "benefits (member benefits: mentoring, events, the job board, city chapters and the lifelong network). " +
    "Answer in " + lang + ", at most 2 short sentences, friendly and concrete. Never invent members, events or jobs. " +
    "If the member asks to go somewhere or do something the app can do, set action to exactly one of: " + ACTIONS.join(", ") +
    " (for a directory search use \"search:network:<search words>\"); otherwise action is null. " +
    "If the member tells you a lasting preference or fact about themselves that would help later (e.g. favourite city, " +
    "field, what they look for), set remember to one short sentence (max 200 characters) without contact details or " +
    "sensitive data (health, religion, politics, union membership, sexual orientation); otherwise remember is null. " +
    "Respond with a JSON object only: {\"say\": string, \"action\": string|null, \"remember\": string|null}.\n\n" +
    "What you know about this member:\n" + (mem.length ? mem.join("\n") : "- nothing yet") +
    "\n\nMEMBER SAYS:\n" + text;

  const res = $http.send({
    url: "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent",
    method: "POST",
    headers: { "content-type": "application/json", "x-goog-api-key": key },
    body: JSON.stringify({
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      generationConfig: { temperature: 0.3, responseMimeType: "application/json", maxOutputTokens: 400 },
    }),
    timeout: 30,
  });
  if (res.statusCode !== 200) throw new ApiError(502, "Jev could not answer. Try again later.", {});

  let out = {};
  try { out = JSON.parse(res.json.candidates[0].content.parts[0].text) || {}; }
  catch (_) { throw new ApiError(502, "Jev returned something unusable. Try again.", {}); }

  const say = String(out.say || "").replace(/<[^>]*>/g, "").trim().slice(0, 400);
  let action = typeof out.action === "string" ? out.action.trim() : null;
  if (action) {
    const base = action.indexOf("search:network:") === 0 ? "search:network" : action;
    if (ACTIONS.indexOf(base) < 0) action = null;
    else if (base === "search:network") action = "search:network:" + strip(action.slice(15)).slice(0, 80);
  }

  // --- optional memory row (hook-only writes; cap 100 per member, oldest removed first)
  const remember = typeof out.remember === "string" ? strip(out.remember).replace(/<[^>]*>/g, "").slice(0, 200) : "";
  if (remember.length >= 3) {
    try {
      const rec = new Record($app.findCollectionByNameOrId("jev_memory"));
      rec.set("user", uid); rec.set("kind", "fact"); rec.set("text", remember);
      $app.save(rec);
      const total = $app.countRecords("jev_memory", $dbx.hashExp({ user: uid }));
      if (total > 100) {
        $app.findRecordsByFilter("jev_memory", "user = {:u}", "created", total - 100, 0, { u: uid })
          .forEach((r) => $app.delete(r));
      }
    } catch (_) { /* memory is best effort; the answer still goes back */ }
  }

  return e.json(200, { say: say || "Sorry, I did not catch that.", action: action || null });
}, $apis.requireAuth("users"));
