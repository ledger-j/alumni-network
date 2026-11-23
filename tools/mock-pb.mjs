#!/usr/bin/env node
/* UniCircle mock PocketBase — a tiny stand-in for UI and realtime testing.
   Not a security test: rule checks run against a real PocketBase (backend/verify_*.py).
   Usage:  node tools/mock-pb.mjs [port=8099]
   Then:   open http://127.0.0.1:5173/?api=http://127.0.0.1:8099#feed
           and sign in by setting localStorage.uc_auth (see seedAuth() in tools/ui-gate.mjs),
           or simply POST /mock/login?user=u1 for a token ("mock.u1").
   Only demo data. Zero dependencies (Node 18+). */
import http from 'node:http';

const PORT = Number(process.argv[2] || process.env.PORT || 8099);
const now = () => new Date().toISOString().replace('T', ' ');
let seq = 100;
const rid = () => 'm' + String(seq++).padStart(8, '0');

const users = [
  ['u1', 'Alex Demo', 'Alex Demo', 'Alumnus, M.Sc. Finance', 'Amsterdam', true],
  ['u2', 'Mira Visser', 'Mira Visser', 'Consultant · mentor for finance students', 'Rotterdam', true],
  ['u3', 'Noah Jansen', 'Noah Jansen', 'Student, B.Sc. Economics · tutor Statistics', 'Maastricht', false],
  ['u4', 'Lena Berger', 'Lena Berger', 'Product manager', 'Berlin', true],
  ['u5', 'Omar Haddad', 'Omar Haddad', 'Data analyst', 'Brussels', false],
  ['u6', 'Sofia Rossi', 'Sofia Rossi', 'Student, M.Sc. Marketing', 'Milan', false],
].map(([id, name, _n, headline, location, mentor]) => ({
  id, collectionId: '_pb_users_auth_', collectionName: 'users', email: id + '@example.test',
  name, headline, location, mentor, mentor_offer: mentor ? 'CV review, interview prep' : '',
  degree: 'M.Sc.', verified: true, created: now(), updated: now(),
}));
const posts = [
  { id: 'p1', author: 'u2', text: 'Welcome to UniCircle. This is demo data from the mock server.', image: '', degree: 'MSc', likes: 3, created: now(), updated: now(), collectionName: 'posts' },
];
const messages = [
  { id: rid(), collectionName: 'messages', sender: 'u2', recipient: 'u1', text: 'Hi Alex, happy to look at your CV this week.', read: false, created: now(), updated: now() },
];
const clients = new Map();   // clientId -> {res, subs:Set, user}

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Access-Control-Allow-Methods': 'GET,POST,PATCH,DELETE,OPTIONS',
};
const send = (res, code, obj) => { res.writeHead(code, { ...cors, 'Content-Type': 'application/json' }); res.end(JSON.stringify(obj)); };
const body = (req) => new Promise((ok) => { let b = ''; req.on('data', (c) => (b += c)); req.on('end', () => { try { ok(JSON.parse(b || '{}')); } catch { ok({}); } }); });
const userOf = (req) => { const t = (req.headers.authorization || '').replace(/^Bearer\s+/i, ''); return users.find((u) => 'mock.' + u.id === t) || null; };
const list = (items) => ({ page: 1, perPage: items.length || 30, totalItems: items.length, totalPages: 1, items });

function applyFilter(items, f) {                 // supports: id != "x", id="x" || id="y", the chat thread filter
  if (!f) return items;
  const ids = [...f.matchAll(/"([^"]+)"/g)].map((m) => m[1]);
  if (/^id\s*!=/.test(f)) return items.filter((i) => i.id !== ids[0]);
  if (/^id\s*=/.test(f)) return items.filter((i) => ids.includes(i.id));
  if (/^\(sender=/.test(f)) return items.filter((m) => (m.sender === ids[0] && m.recipient === ids[1]) || (m.sender === ids[2] && m.recipient === ids[3]));
  if (/^\(mentor=true\)|^mentor\s*=\s*true/.test(f)) return items.filter((u) => u.mentor);
  return items;
}
function broadcast(topic, action, record) {
  for (const c of clients.values()) {
    if (!c.subs.has(topic)) continue;
    if (topic === 'messages' && !(c.user && (record.sender === c.user.id || record.recipient === c.user.id))) continue;
    c.res.write(`id: ${Date.now()}\nevent: ${topic}\ndata: ${JSON.stringify({ action, record })}\n\n`);
  }
}

http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://x');
  const p = url.pathname;
  if (req.method === 'OPTIONS') { res.writeHead(204, cors); return res.end(); }
  const me = userOf(req);

  if (p === '/api/health') return send(res, 200, { code: 200, message: 'mock' });
  if (p === '/mock/login') { const u = users.find((x) => x.id === url.searchParams.get('user')) || users[0]; return send(res, 200, { token: 'mock.' + u.id, record: u }); }
  if (p === '/api/collections/users/auth-refresh') return me ? send(res, 200, { token: 'mock.' + me.id, record: me }) : send(res, 401, { message: 'no' });

  if (p === '/api/realtime' && req.method === 'GET') {
    const id = 'c' + rid();
    res.writeHead(200, { ...cors, 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', Connection: 'keep-alive' });
    clients.set(id, { res, subs: new Set(), user: null });
    res.write(`id: ${id}\nevent: PB_CONNECT\ndata: ${JSON.stringify({ clientId: id })}\n\n`);
    req.on('close', () => clients.delete(id));
    return;
  }
  if (p === '/api/realtime' && req.method === 'POST') {
    const b = await body(req), c = clients.get(b.clientId);
    if (!c) return send(res, 404, { message: 'client not found' });
    c.subs = new Set(b.subscriptions || []); c.user = me; return send(res, 204, {});
  }

  let m;
  if ((m = p.match(/^\/api\/collections\/(\w+)\/records(?:\/(\w+))?$/))) {
    const [, col, id] = m;
    const store = { users, posts, messages }[col];
    if (!store) return send(res, 404, { message: 'no collection' });
    if (col === 'messages') {
      if (!me) return send(res, 200, list([]));
      if (req.method === 'GET' && !id) {
        let items = messages.filter((x) => x.sender === me.id || x.recipient === me.id);
        items = applyFilter(items, url.searchParams.get('filter'));
        const sort = url.searchParams.get('sort');
        items = [...items].sort((a, b) => (a.created < b.created ? -1 : 1) * (sort === '-created' ? -1 : 1));
        return send(res, 200, list(items));
      }
      if (req.method === 'POST') {
        const b = await body(req);
        if (b.sender !== me.id) return send(res, 400, { message: 'sender must be you' });
        const rec = { id: rid(), collectionName: 'messages', sender: b.sender, recipient: b.recipient, text: String(b.text || '').slice(0, 2000), read: false, created: now(), updated: now() };
        messages.push(rec); broadcast('messages', 'create', rec); return send(res, 200, rec);
      }
      if (req.method === 'PATCH' && id) {
        const rec = messages.find((x) => x.id === id);
        if (!rec || rec.recipient !== me.id) return send(res, 404, { message: 'not found' });
        const b = await body(req); if ('read' in b) rec.read = !!b.read;   // only `read` is writable (mirrors the planned rule)
        return send(res, 200, rec);
      }
    }
    if (req.method === 'GET' && !id) {
      let items = applyFilter(store, url.searchParams.get('filter'));
      if (url.searchParams.get('sort') === '-mentor') items = [...items].sort((a, b) => Number(b.mentor) - Number(a.mentor));
      return send(res, 200, list(items));
    }
    if (req.method === 'GET' && id) { const r = store.find((x) => x.id === id); return r ? send(res, 200, r) : send(res, 404, { message: 'not found' }); }
    if (req.method === 'PATCH' && id && col === 'users' && me && me.id === id) { Object.assign(me, await body(req)); return send(res, 200, me); }
  }
  send(res, 404, { message: 'mock: unhandled ' + req.method + ' ' + p });
}).listen(PORT, '127.0.0.1', () => console.log('mock-pb listening on http://127.0.0.1:' + PORT));
