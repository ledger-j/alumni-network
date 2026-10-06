#!/usr/bin/env node
// UniCircle feed seeder — Track B (honest "first pull" seeding).
//
// ETHICS (non-negotiable, enforced by design):
//   • Every seed post is authored by ONE clearly-labelled system account
//     ("UniCircle"). It never pretends to be a human and never impersonates a
//     real person. The account IS the platform, speaking in the platform's voice.
//   • No scraping, no real-person data, no fabricated alumni personas.
//   • Like counts are left at 0 — no fabricated engagement.
//   • All seed content is authored by the one system user, so it is fully
//     traceable and removable in one command (`--purge`).
//
// This solves ONLY the empty-room problem (a first visitor shouldn't see a dead
// feed). It does not, and cannot, "attract" real users on its own — that's a
// separate growth motion (outreach, the pitch, mentoring hooks).
//
// Read-only by default. Writes happen only with --seed / --purge AND a token.
// stdlib / Node-builtins only (Node 18+ for global fetch).
//
//   node tools/seed-unicircle.mjs                 # DRY RUN — prints the plan, writes nothing
//   PB_TOKEN=… node tools/seed-unicircle.mjs --seed
//   PB_TOKEN=… node tools/seed-unicircle.mjs --purge
//
// Env:
//   PB_URL           backend base           (default https://api.unicircle.eu)
//   PB_TOKEN         superuser/admin token  (required for --seed / --purge)
//   SYSTEM_EMAIL     system account email    (default system@unicircle.eu)
//   SYSTEM_NAME      display name            (default UniCircle)
//   SYSTEM_PASSWORD  only needed the first time, to create the system account
//
// Getting a token on the box (per backend/README.md):
//   PB_TOKEN=$(cat /opt/unicircle/.admin_token)

const PB_URL   = (process.env.PB_URL || 'https://api.unicircle.eu').replace(/\/$/, '');
let   TOKEN    = process.env.PB_TOKEN || '';
const IDENTITY = process.env.PB_IDENTITY || '';   // superuser email (alt to PB_TOKEN)
const PB_PASS  = process.env.PB_PASSWORD || '';   // superuser password (alt to PB_TOKEN)
const EMAIL    = process.env.SYSTEM_EMAIL || 'system@unicircle.eu';
const NAME     = process.env.SYSTEM_NAME || 'UniCircle';
const PASSWORD = process.env.SYSTEM_PASSWORD || '';
const MODE     = process.argv.includes('--seed') ? 'seed'
               : process.argv.includes('--purge') ? 'purge' : 'dry';
const JSON_OUT = process.argv.includes('--json');
const DEGREE_TAG = 'UniCircle Team';   // shown as the post's small role tag (≤20 chars)

// --- The content bank -------------------------------------------------------
// Transparent, platform-voiced posts. Add/adjust freely; re-running only posts
// items whose exact text isn't already live (dedupe by text), so this list is
// safe to grow over time.
const POSTS = [
  `Welcome to UniCircle 👋\n\nThis is the official UniCircle account — the voice of the platform itself, not a person. We'll use it to share how things work, highlight what the network can do, and get conversations started while the community grows.`,
  `Why we built UniCircle, in one line: your university should own its alumni relationship — not rent it from a feed it doesn't control.\n\nThat ownership is what lets the map, the city chapters and the "who's attending" view reliably reconnect people who actually studied together.`,
  `The recurring event problem: alumni offices keep hearing "I couldn't find the people I studied with." A rented network can't fix that — it doesn't own the graph. UniCircle does, because alumni register and keep their own details current.`,
  `Where the name comes from: Uni — for university, and for united. Circle — because a circle has no beginning and no end, just like your relationship with the people you studied with. UniCircle is the companion for your whole journey: student, graduate, and every chapter after.`,
  `A quick tip from the UniCircle team: complete your profile (programme, year, city). It's the single biggest thing that helps old classmates and future mentees find you.`,
  `Find your city chapter. Wherever your career took you — Amsterdam, London, Munich, Singapore — there are others from your university nearby. Open Events to see who's around.`,
  `Mentoring is the heart of UniCircle. Current students can reach alumni directly, and alumni can give back with a short conversation or a resume review. Two-way, opt-in, no cold calls.`,
  `The jobs board is alumni-first: roles shared inside the network, by people who studied where you did. Post an opening, or discover your next role among people who get your background.`,
  `Are you open to mentoring? Flip the "mentor" switch on your profile and add a one-line offer. It takes ten seconds and it's genuinely the most valued thing on the platform.`,
  `Conversation starter 💬 Where did your degree take you — and what's one thing you wish you'd known in your first year out? Reply and let the next generation learn from it.`,
  `How reconnection works here: because members keep their own details current, UniCircle can surface classmates by year, programme and city — the connections a broadcast feed simply can't reconstruct.`,
  `A note on where we are: UniCircle is early, and deliberately so. We'd rather build the right thing with the community than ship a polished shell. If something's missing or clunky, tell us — this account reads every reply.`,
  `You can now sign in with LinkedIn — one click, no new password to remember. Your data still lives in the university's own network, not a third party's.`,
  `New: the UniCircle map 🗺️

Red dots show where alumni are; blue dots show which students from your course or tutorial are where this term. Every dot is a neighbourhood — never a street, never GPS — and people nearby merge into one dot. Add your city to your profile to appear. Open "Map" in the side rail.`,
  `Student exchange, solved by a map 🔵

Going abroad next term? Pick your tutorial group on the map and see who from it is in the same city — or one district over. Study groups and flat tips, without a single cold message.`,
  `Mentoring works best when the ask is small. Alumni: write a one-line offer — "a 20-minute call on breaking into consulting", "I'll review one CV a month". Students: pick an offer and ask in one tap from the Mentoring page.`,
  `Moving to a new city? Search the map for it, tap the dot, and see who from your university is already there and who's open to a coffee. That's the whole point of a network you actually own.`,
  `The Case Hub is open: real, problem-based cases that students and alumni solve together. Post a case from your work (anonymised), or sharpen a solution with people from other programmes. Find it in the side rail.`,
  `UniCircle is opening in waves, city by city. Know someone who should be in the circle? Send them to unicircle.eu/waitlist.html — the more people on the map, the more useful it gets for everyone.`,
  `Privacy, plainly: we store the city (and, if you want, the neighbourhood) you type in — nothing more precise. Your data stays on EU servers, we don't sell it, and you can export or delete it any time.`,
  `Our promise: a European network where universities keep ownership of their data, alumni stay connected on their own terms, and students get a real bridge to the people who came before them. That's the circle. Glad you're in it.`,
];

// --- HTTP -------------------------------------------------------------------
async function api(method, path, body) {
  const headers = { 'Content-Type': 'application/json' };
  if (TOKEN) headers.Authorization = TOKEN;
  const res = await fetch(`${PB_URL}${path}`, { method, headers, body: body ? JSON.stringify(body) : undefined });
  const text = await res.text();
  let data = {}; try { data = text ? JSON.parse(text) : {}; } catch { data = { raw: text }; }
  return { status: res.status, ok: res.ok, data };
}
const q = (o) => Object.entries(o).map(([k, v]) => `${k}=${encodeURIComponent(v)}`).join('&');

// Obtain a token from a superuser email+password if PB_TOKEN wasn't supplied.
// (You run this with your own credentials — nothing is stored or printed.)
async function ensureToken() {
  if (TOKEN) return;
  if (!IDENTITY || !PB_PASS) throw new Error('no auth: set PB_TOKEN, or PB_IDENTITY + PB_PASSWORD (superuser).');
  const r = await api('POST', '/api/collections/_superusers/auth-with-password', { identity: IDENTITY, password: PB_PASS });
  if (!r.ok || !r.data.token) throw new Error(`superuser login failed [${r.status}] ${JSON.stringify(r.data)}`);
  TOKEN = r.data.token;
}

// --- Operations -------------------------------------------------------------
async function findSystemUser() {
  const r = await api('GET', `/api/collections/users/records?${q({ filter: `email='${EMAIL}'`, perPage: 1 })}`);
  if (!r.ok) throw new Error(`user lookup failed [${r.status}] ${JSON.stringify(r.data)} (token valid?)`);
  return r.data.items && r.data.items[0] ? r.data.items[0] : null;
}

async function ensureSystemUser() {
  let u = await findSystemUser();
  if (u) return { user: u, created: false };
  if (!PASSWORD) throw new Error(`system account ${EMAIL} does not exist yet — set SYSTEM_PASSWORD to create it (min 8 chars).`);
  const r = await api('POST', '/api/collections/users/records', {
    email: EMAIL, password: PASSWORD, passwordConfirm: PASSWORD, name: NAME,
    headline: 'Official UniCircle account', verified: true,
  });
  if (!r.ok) throw new Error(`create system user failed [${r.status}] ${JSON.stringify(r.data)}`);
  return { user: r.data, created: true };
}

async function livePostTexts(authorId) {
  const seen = new Set();
  for (let page = 1; ; page++) {
    const r = await api('GET', `/api/collections/posts/records?${q({ filter: `author='${authorId}'`, perPage: 200, page })}`);
    if (!r.ok) throw new Error(`post list failed [${r.status}] ${JSON.stringify(r.data)}`);
    for (const p of r.data.items) seen.add(p.text);
    if (page >= (r.data.totalPages || 1)) break;
  }
  return seen;
}

async function doSeed() {
  const { user, created } = await ensureSystemUser();
  const seen = await livePostTexts(user.id);
  const todo = POSTS.filter((t) => !seen.has(t));
  let posted = 0;
  for (const text of todo) {
    const r = await api('POST', '/api/collections/posts/records', { author: user.id, text, degree: DEGREE_TAG, likes: 0 });
    if (!r.ok) throw new Error(`post create failed [${r.status}] ${JSON.stringify(r.data)}`);
    posted++;
  }
  return { userId: user.id, accountCreated: created, alreadyLive: seen.size, posted, skipped: POSTS.length - todo.length };
}

async function doPurge() {
  const u = await findSystemUser();
  if (!u) return { deleted: 0, note: 'no system account found' };
  let deleted = 0;
  for (;;) {
    const r = await api('GET', `/api/collections/posts/records?${q({ filter: `author='${u.id}'`, perPage: 200 })}`);
    if (!r.ok) throw new Error(`purge list failed [${r.status}] ${JSON.stringify(r.data)}`);
    if (!r.data.items.length) break;
    for (const p of r.data.items) {
      const d = await api('DELETE', `/api/collections/posts/records/${p.id}`);
      if (d.ok) deleted++;
    }
  }
  return { deleted };
}

async function currentFeedCount() {
  const r = await api('GET', '/api/collections/posts/records?perPage=1');
  return r.ok ? (r.data.totalItems ?? '?') : `err ${r.status}`;
}

// --- Main -------------------------------------------------------------------
async function main() {
  if (MODE === 'dry') {
    const feed = await currentFeedCount();  // public read — no token needed
    const out = {
      mode: 'DRY RUN (nothing written)', backend: PB_URL, systemAccount: `${NAME} <${EMAIL}>`,
      currentFeedPosts: feed, bankSize: POSTS.length, tokenPresent: !!TOKEN,
    };
    if (JSON_OUT) { console.log(JSON.stringify({ ...out, posts: POSTS }, null, 2)); return; }
    console.log(`\nUniCircle seeder — DRY RUN (writes nothing)`);
    console.log('─'.repeat(64));
    console.log(`Backend            : ${PB_URL}`);
    console.log(`System account     : ${NAME} <${EMAIL}>  (transparent, non-human)`);
    console.log(`Current feed posts : ${feed}`);
    console.log(`Content bank       : ${POSTS.length} posts, each tagged "${DEGREE_TAG}", likes=0`);
    console.log(`Token present      : ${TOKEN ? 'yes' : 'no'}`);
    console.log('─'.repeat(64));
    console.log(`\nWould post (idempotent — skips any already live):\n`);
    POSTS.forEach((t, i) => console.log(`  ${String(i + 1).padStart(2)}. ${squash(t)}`));
    console.log(`\nTo apply:  PB_TOKEN=… SYSTEM_PASSWORD=… node tools/seed-unicircle.mjs --seed`);
    console.log(`To undo :  PB_TOKEN=…                   node tools/seed-unicircle.mjs --purge\n`);
    return;
  }
  try { await ensureToken(); } catch (e) { console.error(e.message); process.exit(2); }
  const result = MODE === 'seed' ? await doSeed() : await doPurge();
  console.log(JSON.stringify({ mode: MODE, ...result }, null, 2));
}

const squash = (s) => s.replace(/\s+/g, ' ').trim().slice(0, 96) + (s.length > 96 ? '…' : '');
main().catch((e) => { console.error('ERROR:', e.message); process.exit(1); });
