/* UniCircle: page module profile-points ("Status points" card on the profile).
   Called by profile.js: window.UCPages.profilePoints(root). Renders into
   [data-uc-slot="points"]. Own profile: balance + how it works + own ledger.
   Another member (?id=<id> that is not me): level badge only, read-only. */
(function () {
  'use strict';
  window.UCPages = window.UCPages || {};
  const UCP = window.UCP;

  const LEVELS = [
    { min: 0, name: 'Newcomer' },
    { min: 10, name: 'Helper' },
    { min: 30, name: 'Mentor' },
    { min: 70, name: 'Guide' },
    { min: 150, name: 'Anchor' }
  ];
  const REASONS = { session_closed: 'Session closed' };

  function levelOf(n) {
    let i = 0;
    for (let k = 0; k < LEVELS.length; k++) if (n >= LEVELS[k].min) i = k;
    const next = LEVELS[i + 1] || null;
    return { name: LEVELS[i].name, index: i, next };
  }
  const validId = (s) => /^[a-z0-9]{1,32}$/i.test(String(s || ''));
  const num = (v) => { const n = Math.floor(Number(v)); return isFinite(n) && n > 0 ? n : 0; };

  function fmtDate(iso) {
    const d = new Date(String(iso || '').replace(' ', 'T'));
    if (isNaN(d)) return '';
    try { return d.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' }); }
    catch (e) { return d.toISOString().slice(0, 10); }
  }

  function levelBlock(points, own) {
    const lv = levelOf(points);
    let hint;
    if (lv.next) {
      const left = lv.next.min - points;
      hint = own
        ? left + (left === 1 ? ' point' : ' points') + ' to reach ' + lv.next.name + '.'
        : '';
    } else hint = own ? 'You have reached the highest level.' : '';
    const pct = lv.next
      ? Math.max(0, Math.min(100, Math.round(((points - LEVELS[lv.index].min) / (lv.next.min - LEVELS[lv.index].min)) * 100)))
      : 100;
    return '<div class="uc-pts-head">'
      + '<div class="uc-pts-balance"><span class="uc-pts-n" data-pts-n>' + points + '</span>'
      + '<span class="uc-pts-unit">' + (points === 1 ? 'point' : 'points') + '</span></div>'
      + '<span class="uc-pts-badge" data-level="' + lv.index + '">' + UCP.esc(lv.name) + '</span></div>'
      + (own
        ? '<div class="uc-pts-bar" role="progressbar" aria-label="Progress to next level" aria-valuemin="0" aria-valuemax="100" aria-valuenow="' + pct + '"><i style="width:' + pct + '%"></i></div>'
        + '<p class="uc-pts-hint">' + UCP.esc(hint) + '</p>'
        : '');
  }

  function ledgerHtml(rows) {
    if (!rows) return '<p class="uc-pts-fine">Your history could not be loaded right now.</p>';
    if (!rows.length) {
      return '<div class="uc-empty-orbit" style="--uc-node-h:235;padding:20px 8px 6px;">'
        + '<div class="uc-empty-nodes" aria-hidden="true"><i></i><u></u><i></i></div>'
        + '<p style="margin:0;font-size:14px;">No points yet. Your first mentoring or tutoring session you close will show up here.</p>'
        + '<a class="uc-pf-inline uc-pts-link" href="#mentoring">Go to Mentor &amp; Tutor <span class="uc-nudge" aria-hidden="true">→</span></a></div>';
    }
    return '<ul class="uc-pts-ledger">' + rows.map((r) => {
      const d = Math.floor(Number(r.delta)) || 0;
      const label = REASONS[r.reason] || 'Points';
      return '<li><span class="uc-pts-date">' + UCP.esc(fmtDate(r.created)) + '</span>'
        + '<span class="uc-pts-reason">' + UCP.esc(label) + '</span>'
        + '<strong class="uc-pts-delta">' + (d >= 0 ? '+' : '') + d + '</strong></li>';
    }).join('') + '</ul>';
  }

  const EXPLAIN = ''
    + '<div class="uc-pts-cols">'
    + '<div><h3 class="uc-pts-h3">How you earn points</h3><ul class="uc-pts-list">'
    + '<li>Tutor or mentor someone and close the mentorship after at least 24 hours of real work: 10 points for tutoring, 15 for mentoring.</li>'
    + '<li>Once per mentorship. The same pair counts once a week. At most 15 a day.</li>'
    + '<li>The person you helped earns nothing. Opening a mentorship or closing it quickly earns nothing.</li></ul></div>'
    + '<div><h3 class="uc-pts-h3">What points do</h3><ul class="uc-pts-list">'
    + '<li>Other members can ask for a minimum number of points before they accept contact from you. You can set the same rule for your own contact settings.</li>'
    + '<li>You do not spend points; they only show what you have done.</li></ul>'
    + '<h3 class="uc-pts-h3">Why</h3><ul class="uc-pts-list">'
    + '<li>Points are proof of work. They protect busy alumni from unsolicited requests.</li></ul></div></div>';

  window.UCPages.profilePoints = async function (root) {
    try {
      const slot = root && root.querySelector('[data-uc-slot="points"]');
      if (!slot || !UCP) return;
      const me = UCP.user();
      const qid = UCP.params ? UCP.params().get('id') : null;
      const other = !!(qid && (!me || qid !== me.id));
      if (other && !validId(qid)) { slot.innerHTML = ''; return; }
      if (!other && !me) { slot.innerHTML = ''; return; }

      slot.innerHTML = '<div class="uc-card uc-pts" aria-labelledby="uc-pts-title">'
        + '<div class="uc-pts-top"><h2 class="uc-h2" id="uc-pts-title">Status points</h2></div>'
        + '<div data-pts-body>' + levelBlock(other ? 0 : num(me.points), !other) + '</div>'
        + (other ? '' : EXPLAIN + '<h3 class="uc-pts-h3">Your points history</h3><div data-pts-ledger><p class="uc-pts-fine">Loading…</p></div>')
        + '</div>';

      const body = slot.querySelector('[data-pts-body]');
      const uid = other ? qid : me.id;
      // points are written by the server: re-read, never trust the cached user
      try {
        const rec = await UCP.api('GET', '/api/collections/users/records/' + encodeURIComponent(uid));
        if (rec) {
          const p = num(rec.points);
          if (body) body.innerHTML = levelBlock(p, !other);
          if (!other && me) me.points = p;
        }
      } catch (e) { /* keep cached value */ }

      if (other) return;
      const box = slot.querySelector('[data-pts-ledger]');
      try {
        const res = await UCP.api('GET', '/api/collections/points_ledger/records?sort=-created&perPage=20');
        if (box) box.innerHTML = ledgerHtml(res && res.items ? res.items : []);
      } catch (e) {
        if (box) box.innerHTML = ledgerHtml(null);
      }
      if (window.Iconify) window.Iconify.scan(slot);
    } catch (e) { console.warn('[profile-points]', e); }
  };
})();
