/// <reference path="../pb_data/types.d.ts" />
// UniCircle AI helper: structures text a member pasted into the in-depth profile fields.
// Privacy rules (docs/redesign/objections.md P3, P13):
//  - only on an explicit button press by the signed-in member, never run for anyone else;
//  - emails, phone numbers and URLs are stripped from the text BEFORE it leaves the server;
//  - nothing is stored by this route; the member reviews a diff and saves what they accept;
//  - Google's Gemini API is the processor and is named on privacy.html.
// The route stays OFF until the operator sets GEMINI_API_KEY in the PocketBase container
// environment (a spend and key decision that belongs to the operator). Without it: 501.

routerAdd("POST", "/api/uc/profile/structure", (e) => {
  const key = $os.getenv("GEMINI_API_KEY");
  if (!key) throw new ApiError(501, "The AI helper is not switched on.", {});
  const data = e.requestInfo().body || {};
  let text = String(data.text || "");
  if (text.trim().length < 40) throw new BadRequestError("Paste a bit more text (at least 40 characters).");
  text = text.slice(0, 4000)
    .replace(/[\w.+-]+@[\w-]+(\.[\w-]+)+/g, " ")                    // emails
    .replace(/https?:\/\/\S+|www\.\S+/gi, " ")                      // urls
    .replace(/(\+?\d[\s().-]?){9,}/g, " ");                         // phone-like digit runs

  const FIELDS = { experience: 2000, education: 1000, skills: 500, sectors: 300, languages: 200, offer: 500, seek: 500 };
  const prompt =
    "Structure the profile text below into a JSON object with exactly these string keys: " + Object.keys(FIELDS).join(", ") + ". " +
    "Use only what the text states; do not invent employers, degrees, dates or skills; leave a key as an empty string when the text says nothing. " +
    "Do not output names of people, contact details or sensitive data (health, religion, politics, union membership, sexual orientation). " +
    "Write plain text, short lines separated by newlines, no markdown. Respond with the JSON object only.\n\nTEXT:\n" + text;

  const res = $http.send({
    url: "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent",
    method: "POST",
    headers: { "content-type": "application/json", "x-goog-api-key": key },
    body: JSON.stringify({
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      generationConfig: { temperature: 0.1, responseMimeType: "application/json", maxOutputTokens: 1500 },
    }),
    timeout: 30,
  });
  if (res.statusCode !== 200) throw new ApiError(502, "The AI helper could not answer. Try again later.", {});

  let parsed = {};
  try {
    const raw = res.json.candidates[0].content.parts[0].text;
    parsed = JSON.parse(raw);
  } catch (_) { throw new ApiError(502, "The AI helper returned something unusable. Try again.", {}); }

  const out = {};
  Object.keys(FIELDS).forEach((k) => {
    const v = parsed[k];
    out[k] = (typeof v === "string" ? v : Array.isArray(v) ? v.join("\n") : "").replace(/<[^>]*>/g, "").trim().slice(0, FIELDS[k]);
  });
  return e.json(200, out);
}, $apis.requireAuth("users"));
