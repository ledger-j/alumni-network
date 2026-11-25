/* UniCircle mock PocketBase, round-2 collections (UI testing only, NOT a security test).
   Rules here are simplified mirrors of backend/init_schema.py; the real rules are proven by
   backend/verify_*.py against a real PocketBase. Imported by tools/mock-pb.mjs. */

const REL_USERS = ['from', 'to', 'user', 'host', 'uploader', 'mentor', 'mentee', 'sender', 'owner', 'blocker', 'blocked'];

export function install(ctx) {
  const { users, send, now, rid, broadcast } = ctx;
  const isoDay = (n) => { const d = new Date(Date.now() + n * 864e5); d.setHours(18, 0, 0, 0); return d.toISOString().replace('T', ' '); };
  const U = (id) => users.find((u) => u.id === id);

  // seed profile fields used by the new UI
  Object.assign(U('u1'), { points: 25, contact_mode: 'open', min_points: 0 });
  Object.assign(U('u2'), { points: 80, contact_mode: 'points', min_points: 20, accepts_mentoring: true });
  Object.assign(U('u3'), { points: 5, contact_mode: 'open', min_points: 0 });
  Object.assign(U('u4'), { points: 40, contact_mode: 'request', min_points: 0, accepts_collab: true });
  Object.assign(U('u5'), { points: 0, contact_mode: 'closed', min_points: 0 });
  Object.assign(U('u6'), { points: 0, contact_mode: '', min_points: 0 });

  const db = {
    user_settings: [], profiles_deep: [], blocks: [], rsvps: [], mentorship_docs: [],
    user_locations: [
      { id: 'l2', user: 'u2', lat: 51.9, lng: 4.5, city: 'Rotterdam', visible: true },
      { id: 'l4', user: 'u4', lat: 52.5, lng: 13.4, city: 'Berlin', visible: true },
      { id: 'l3', user: 'u3', lat: 50.85, lng: 5.7, city: 'Maastricht', visible: true },
    ],
    points_ledger: [
      { id: 'pl1', user: 'u1', delta: 15, reason: 'session_closed', ref: 'mentorship:x1', created: isoDay(-9) },
      { id: 'pl2', user: 'u1', delta: 10, reason: 'session_closed', ref: 'mentorship:x2', created: isoDay(-3) },
    ],
    collab_requests: [
      { id: 'cr1', from: 'u4', to: 'u1', kind: 'project', message: 'Would you co-host a fintech evening in Berlin?', status: 'pending', created: isoDay(-1) },
    ],
    events: [
      { id: 'ev1', title: 'Amsterdam alumni drinks', description: 'Informal drinks, all programmes welcome.', start: isoDay(1), end: '', city: 'Amsterdam', lat: 52.35, lng: 4.9, place: 'Café De Jaren', host: 'u2', hidden: false, going_count: 3, created: isoDay(-2) },
    ],
    conversations: [
      { id: 'cv1', title: 'Finance circle', owner: 'u2', members: ['u1', 'u2', 'u4'], created: isoDay(-5), updated: isoDay(-1) },
    ],
    conversation_messages: [
      { id: 'cm1', conversation: 'cv1', sender: 'u2', text: 'Welcome to the finance circle.', created: isoDay(-4) },
      { id: 'cm2', conversation: 'cv1', sender: 'u4', text: 'Glad to be here.', created: isoDay(-1) },
    ],
  };
  const files = new Map();                      // 'coll/id/name' -> {mime, data}
  const PROTECTED = new Set(['mentorship_docs']);
  const meId = (me) => me && me.id;
  const mentorships = ctx.mentorships;
  const conv = (id) => db.conversations.find((c) => c.id === id);
  const msOf = (id) => mentorships.find((m) => m.id === id);

  const canSee = {
    user_settings: (r, me) => r.user === meId(me),
    profiles_deep: (r, me) => r.visibility !== 'private' || r.user === meId(me),
    blocks: (r, me) => r.blocker === meId(me),
    rsvps: (r, me) => r.user === meId(me),
    user_locations: (r, me) => r.visible || r.user === meId(me),
    points_ledger: (r, me) => r.user === meId(me),
    collab_requests: (r, me) => r.from === meId(me) || r.to === meId(me),
    events: (r) => !r.hidden,
    conversations: (r, me) => r.members.includes(meId(me)),
    conversation_messages: (r, me) => (conv(r.conversation)?.members || []).includes(meId(me)),
    mentorship_docs: (r, me) => { const m = msOf(r.mentorship); return !!m && (m.mentor === meId(me) || m.mentee === meId(me)); },
  };

  // ---- tiny filter language: a && b, a || b, field op value ; ops = != ~ >= <= > <
  const lit = (v) => { v = v.trim(); if (v === 'true') return true; if (v === 'false') return false; if (/^".*"$/.test(v)) return v.slice(1, -1); return isNaN(Number(v)) ? v : Number(v); };
  const cmp = (row, term) => {
    const m = term.trim().replace(/^\(+|\)+$/g, '').match(/^([\w.]+)\s*(!=|>=|<=|=|~|>|<)\s*(.+)$/);
    if (!m) return true;
    const [, f, op, raw] = m; const v = lit(raw); let x = row[f];
    if (op === '~') return Array.isArray(x) ? x.includes(v) : String(x ?? '').toLowerCase().includes(String(v).toLowerCase());
    if (Array.isArray(x)) x = x.includes(v) ? v : null;
    if (op === '=') return x === v || (x === undefined && v === '') ;
    if (op === '!=') return x !== v;
    const a = String(x ?? ''), b = String(v);
    return op === '>=' ? a >= b : op === '<=' ? a <= b : op === '>' ? a > b : a < b;
  };
  const filt = (rows, f) => !f ? rows : rows.filter((r) => f.split('||').some((or) => or.split('&&').every((t) => cmp(r, t))));

  const expand = (row, spec) => {
    if (!spec) return row;
    const ex = {};
    spec.split(',').forEach((k) => {
      k = k.trim();
      if (k === 'members') ex.members = (row.members || []).map(U).filter(Boolean);
      else if (REL_USERS.includes(k) && row[k]) ex[k] = U(row[k]);
    });
    return { ...row, expand: ex };
  };
  const decorate = (col, r) => ({ collectionId: 'c_' + col, collectionName: col, updated: now(), created: now(), ...r });

  // ---- multipart (stdlib only)
  const readAll = (req) => new Promise((ok) => { const bufs = []; req.on('data', (c) => bufs.push(c)); req.on('end', () => ok(Buffer.concat(bufs))); });
  async function parseBody(req) {
    const buf = await readAll(req), ct = req.headers['content-type'] || '';
    const mm = ct.match(/boundary=(.+)$/);
    if (mm) {
      const fields = {}, fl = {}; const sep = Buffer.from('--' + mm[1]);
      let pos = buf.indexOf(sep);
      while (pos >= 0) {
        const next = buf.indexOf(sep, pos + sep.length); if (next < 0) break;
        const part = buf.slice(pos + sep.length + 2, next - 2); const hend = part.indexOf('\r\n\r\n');
        const head = part.slice(0, hend).toString(); const data = part.slice(hend + 4);
        const name = (head.match(/name="([^"]+)"/) || [])[1]; const fn = (head.match(/filename="([^"]*)"/) || [])[1];
        const mime = (head.match(/Content-Type:\s*(.+)/i) || [])[1] || 'application/octet-stream';
        if (name) { if (fn !== undefined) fl[name] = { name: fn, mime: mime.trim(), data }; else fields[name] = data.toString(); }
        pos = next;
      }
      return { multipart: true, fields, files: fl };
    }
    let json = {}; try { json = JSON.parse(buf.toString() || '{}'); } catch { /* ignore */ }
    return { multipart: false, fields: json, files: {} };
  }
  const coerce = (o) => { const r = { ...o }; for (const k of Object.keys(r)) { if (r[k] === 'true') r[k] = true; else if (r[k] === 'false') r[k] = false; else if (typeof r[k] === 'string' && r[k] !== '' && /^-?\d+(\.\d+)?$/.test(r[k]) && ['lat', 'lng', 'accent_hue', 'min_points'].includes(k)) r[k] = Number(r[k]); } return r; };
  const snap = (v) => Math.round(Math.round(Number(v) / 0.05) * 0.05 * 100) / 100;
  const list = (items, perPage, page) => { const pp = Math.max(1, Number(perPage) || 30), pg = Math.max(1, Number(page) || 1); return { page: pg, perPage: pp, totalItems: items.length, totalPages: Math.max(1, Math.ceil(items.length / pp)), items: items.slice((pg - 1) * pp, pg * pp) }; };

  return async function handle(req, res, url, me) {
    const p = url.pathname;
    if (p === '/api/files/token' && req.method === 'POST') return send(res, me ? 200 : 401, { token: 'mocktoken' }), true;
    let m = p.match(/^\/api\/files\/([\w]+)\/([\w]+)\/(.+)$/);
    if (m) {
      const f = files.get(`${m[1]}/${m[2]}/${decodeURIComponent(m[3])}`);
      if (!f) return send(res, 404, { message: 'no file' }), true;
      if (PROTECTED.has(m[1]) && url.searchParams.get('token') !== 'mocktoken') return send(res, 404, { message: 'token' }), true;
      res.writeHead(200, { 'Content-Type': f.mime, 'Access-Control-Allow-Origin': '*' }); res.end(f.data); return true;
    }
    if ((m = p.match(/^\/api\/uc\/conversations\/(\w+)\/leave$/)) && req.method === 'POST') {
      const c = conv(m[1]); if (!c || !c.members.includes(meId(me))) return send(res, 403, { message: 'You are not a member of this group.' }), true;
      if (c.owner === me.id) return send(res, 400, { message: 'The owner cannot leave; delete the group instead.' }), true;
      c.members = c.members.filter((x) => x !== me.id); return send(res, 200, { left: true }), true;
    }
    if (p === '/api/uc/profile/structure' && req.method === 'POST') {
      const b = (await parseBody(req)).fields; if (!me) return send(res, 401, { message: 'auth' }), true;
      return send(res, 200, { experience: 'Structured: ' + String(b.text || '').slice(0, 120), skills: 'Financial analysis, Excel, Stakeholder management', languages: 'English, Dutch', sectors: 'Banking, Consulting', offer: 'CV review, interview practice', seek: '', education: '' }), true;
    }

    // users: multipart avatar/cover upload and self delete
    if ((m = p.match(/^\/api\/collections\/users\/records\/(\w+)$/))) {
      const u = U(m[1]);
      if (req.method === 'PATCH' && u && me && me.id === u.id) {
        const b = await parseBody(req);
        if (b.multipart) {
          for (const [k, f] of Object.entries(b.files)) {
            if (!/^image\/(jpeg|png|webp)$/.test(f.mime)) return send(res, 400, { message: 'Unsupported image type.' }), true;
            const name = `${k}_${rid()}_${f.name}`; files.set(`_pb_users_auth_/${u.id}/${name}`, f); u[k] = name;
          }
        }
        const body = coerce(b.fields); delete body.points; delete body.supporter;
        if ('cover' in body && !body.cover) u.cover = '';
        for (const k of Object.keys(body)) if (!(k in b.files) && k !== 'cover') u[k] = body[k];
        return send(res, 200, u), true;
      }
      if (req.method === 'DELETE' && u && me && me.id === u.id) {
        users.splice(users.indexOf(u), 1); res.writeHead(204, { 'Access-Control-Allow-Origin': '*' }); res.end(); return true;
      }
    }

    if (!(m = p.match(/^\/api\/collections\/(\w+)\/records(?:\/(\w+))?$/))) return false;
    const [, col, id] = m; const rows = db[col];
    if (!rows) return false;
    if (!me) return send(res, 200, col === 'events' ? list([]) : list([])), true;
    const see = canSee[col];

    if (req.method === 'GET' && !id) {
      let items = rows.filter((r) => see(r, me));
      items = filt(items, url.searchParams.get('filter'));
      const sort = url.searchParams.get('sort') || '';
      if (sort) { const k = sort.replace('-', ''); items = [...items].sort((a, b) => (String(a[k] ?? '') < String(b[k] ?? '') ? -1 : 1) * (sort.startsWith('-') ? -1 : 1)); }
      const out = list(items, url.searchParams.get('perPage'), url.searchParams.get('page'));
      out.items = out.items.map((r) => expand(decorate(col, r), url.searchParams.get('expand')));
      return send(res, 200, out), true;
    }
    if (req.method === 'GET' && id) { const r = rows.find((x) => x.id === id && see(x, me)); return send(res, r ? 200 : 404, r ? expand(decorate(col, r), url.searchParams.get('expand')) : { message: 'not found' }), true; }

    if (req.method === 'POST') {
      const b = await parseBody(req); const body = coerce(b.fields); const rec = { id: rid(), ...body, created: now() };
      const bad = (msg) => (send(res, 400, { message: msg }), true);
      if (col === 'user_settings' || col === 'user_locations' || col === 'profiles_deep') { if (rec.user !== me.id) return bad('user must be you'); if (rows.some((r) => r.user === me.id)) return bad('already exists'); }
      if (col === 'user_locations') { if (!me.verified) return bad('Verify your email first.'); rec.lat = snap(rec.lat); rec.lng = snap(rec.lng); rec.visible = !!rec.visible; }
      if (col === 'points_ledger') return send(res, 403, { message: 'forbidden' }), true;
      if (col === 'collab_requests') {
        if (rec.from !== me.id || rec.to === me.id) return bad('invalid request');
        const to = U(rec.to); if (to?.contact_mode === 'closed') return send(res, 403, { message: 'This member is not accepting contact from you.' }), true;
        if (to?.contact_mode === 'points' && (me.points || 0) < (to.min_points || 0)) return send(res, 403, { message: `This member asks for ${to.min_points} status points before contact.` }), true;
        if (rows.some((r) => r.from === me.id && r.to === rec.to && r.status === 'pending')) return bad('unique pending request exists');
        rec.status = 'pending';
      }
      if (col === 'events') { if (rec.host !== me.id) return bad('host must be you'); rec.hidden = false; rec.going_count = 0; if (rec.lat !== undefined && rec.lat !== '') { rec.lat = snap(rec.lat); rec.lng = snap(rec.lng); } }
      if (col === 'rsvps') { if (rec.user !== me.id) return bad('user must be you'); if (rows.some((r) => r.event === rec.event && r.user === me.id)) return bad('You already RSVPed.'); const ev = db.events.find((e) => e.id === rec.event); if (ev) ev.going_count = (ev.going_count || 0) + 1; }
      if (col === 'conversations') { if (rec.owner !== me.id) return bad('owner must be you'); let mem = Array.isArray(rec.members) ? rec.members : String(rec.members || '').split(',').filter(Boolean); if (!mem.includes(me.id)) mem.unshift(me.id); if (mem.length > 12) return bad('A group has at most 12 members.'); const closed = mem.map(U).find((u) => u && u.id !== me.id && u.contact_mode === 'closed'); if (closed) return send(res, 403, { message: 'This member is not accepting contact from you.' }), true; rec.members = mem; rec.updated = now(); }
      if (col === 'conversation_messages') { if (rec.sender !== me.id || !(conv(rec.conversation)?.members || []).includes(me.id)) return send(res, 403, { message: 'You are not a member of this group.' }), true; }
      if (col === 'mentorship_docs') {
        const ms = msOf(rec.mentorship); if (!ms || (ms.mentor !== me.id && ms.mentee !== me.id)) return send(res, 403, { message: 'Not your mentorship.' }), true;
        if (ms.status !== 'active') return bad('Documents can be added while the mentorship is active.');
        const f = b.files.file; if (!f) return bad('file required');
        if (!/(pdf|png|jpeg|plain|wordprocessingml)/.test(f.mime)) return bad('This file type is not allowed.');
        if (f.data.length > 10 * 1024 * 1024) return bad('File too large.');
        rec.uploader = me.id; rec.file = `${rid()}_${f.name}`; files.set(`mentorship_docs/${rec.id}/${rec.file}`, f);
      }
      rows.push(rec);
      if (col === 'conversation_messages') { const c = conv(rec.conversation); c.updated = now(); const out = decorate(col, rec); for (const cl of ctx.clients.values()) if (cl.subs.has(col) && cl.user && c.members.includes(cl.user.id)) cl.res.write(`id: ${Date.now()}\nevent: ${col}\ndata: ${JSON.stringify({ action: 'create', record: out })}\n\n`); }
      return send(res, 200, decorate(col, rec)), true;
    }

    const row = rows.find((x) => x.id === id);
    if (!row || (req.method !== 'DELETE' && !see(row, me))) return send(res, 404, { message: 'not found' }), true;
    if (req.method === 'PATCH') {
      const b = coerce((await parseBody(req)).fields);
      const own = row.user === me.id || row.host === me.id || row.owner === me.id;
      if (col === 'collab_requests') { if (row.to !== me.id || !['accepted', 'declined'].includes(b.status)) return send(res, 400, { message: 'rule' }), true; row.status = b.status; return send(res, 200, decorate(col, row)), true; }
      if (!own) return send(res, 404, { message: 'not found' }), true;
      delete b.user; delete b.host; delete b.owner; delete b.going_count;
      if (col === 'user_locations' && ('lat' in b || 'lng' in b)) { if ('lat' in b) b.lat = snap(b.lat); if ('lng' in b) b.lng = snap(b.lng); }
      if (col === 'conversations' && b.members) { if (!Array.isArray(b.members)) b.members = String(b.members).split(',').filter(Boolean); if (b.members.length > 12 || !b.members.includes(row.owner)) return send(res, 400, { message: 'Invalid members.' }), true; }
      Object.assign(row, b, { updated: now() }); return send(res, 200, decorate(col, row)), true;
    }
    if (req.method === 'DELETE') {
      const ok = row.user === me.id || row.host === me.id || row.owner === me.id || row.from === me.id || row.blocker === me.id || row.sender === me.id || row.uploader === me.id;
      if (!ok) return send(res, 404, { message: 'not found' }), true;
      rows.splice(rows.indexOf(row), 1);
      if (col === 'rsvps') { const ev = db.events.find((e) => e.id === row.event); if (ev) ev.going_count = Math.max(0, (ev.going_count || 1) - 1); }
      res.writeHead(204, { 'Access-Control-Allow-Origin': '*' }); res.end(); return true;
    }
    return false;
  };
}
