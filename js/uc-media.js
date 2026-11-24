/* ==========================================================================
   UniCircle: media helpers (avatars, covers, protected files, safe image upload)
   Loads after js/unicircle.js and attaches to window.UC. No network except the
   PocketBase API the app already talks to. Everything degrades to a local
   initials avatar when a file is missing.

   UC.avatarUrl(user, size=100)        sync. File thumb URL
                                       <API>/api/files/<collId>/<id>/<avatar>?thumb=SxS,
                                       else a local initials SVG data URI.
   UC.coverUrl(user, w=800, h=267)     sync. users.cover thumb URL, else null.
   UC.safeUrl(u)                       returns u only if it starts with http(s)://, else ''.
                                       Use before putting a member-supplied URL in href/src.
   UC.fileToken()                      async. POST /api/files/token (auth), cached 90 s.
   UC.protectedFileUrl(rec, field)     async. <API>/api/files/<collId>/<id>/<name>?token=<t>
                                       for fields marked protected in PocketBase.
   UC.cropImage(file, opts)            async -> {blob, name}. Decodes with EXIF orientation
                                       applied, draws a cover-fit crop into a width x height
                                       canvas and re-encodes (this strips EXIF/GPS).
                                       opts: width, height, mime='image/jpeg', quality=0.85,
                                       circle=false (transparent corners, needs png/webp),
                                       zoom=1, offsetX=0, offsetY=0 (-1..1 pan), maxBytes=5 MB.
                                       Rejects: HEIC/HEIF, > 25 MB, non-image, still > maxBytes
                                       after quality 0.85 -> 0.7 -> 0.55.
   UC.pickImage({accept})              Promise<File|null> via a hidden <input type=file>.
   UC.uploadMedia(path, method, fields, fileField, blob, filename)
                                       builds a FormData (fields = plain object) and calls UC.api.
   ========================================================================== */
(function () {
  'use strict';
  const UC = window.UC;
  if (!UC) return;

  const MAX_IN = 25 * 1024 * 1024;
  let tok = null, tokAt = 0;

  const fileBase = (rec, field) => {
    const v = rec && rec[field];
    const name = Array.isArray(v) ? v[0] : v;
    return name ? `${UC.API}/api/files/${rec.collectionId}/${rec.id}/${encodeURIComponent(name)}` : null;
  };

  UC.avatarUrl = function (user, size) {
    const s = size || 100;
    const b = fileBase(user, 'avatar');
    return b ? `${b}?thumb=${s}x${s}` : UC.initialsAvatar(user);
  };

  UC.coverUrl = function (user, w, h) {
    const b = fileBase(user, 'cover');
    return b ? `${b}?thumb=${w || 800}x${h || 267}` : null;
  };

  UC.safeUrl = function (u) {
    const s = typeof u === 'string' ? u.trim() : '';
    return /^https?:\/\//i.test(s) ? s : '';
  };

  UC.fileToken = async function () {
    if (tok && Date.now() - tokAt < 90000) return tok;
    const r = await UC.api('POST', '/api/files/token');
    tok = r.token; tokAt = Date.now();
    return tok;
  };

  UC.protectedFileUrl = async function (rec, field) {
    const b = fileBase(rec, field);
    if (!b) return null;
    return `${b}?token=${encodeURIComponent(await UC.fileToken())}`;
  };

  UC.cropImage = async function (file, o) {
    o = Object.assign({ width: 400, height: 400, mime: 'image/jpeg', quality: 0.85, circle: false,
      zoom: 1, offsetX: 0, offsetY: 0, maxBytes: 5 * 1024 * 1024 }, o || {});
    if (!file) throw new Error('Not an image');
    const nm = String(file.name || ''), ty = String(file.type || '').toLowerCase();
    if (/hei[cf]/i.test(ty) || /\.hei[cf]$/i.test(nm)) throw new Error('HEIC/HEIF not supported, please choose a JPEG or PNG');
    if (file.size > MAX_IN) throw new Error('File too large');
    if (!/^image\//.test(ty)) throw new Error('Not an image');
    let bmp;
    try { bmp = await createImageBitmap(file, { imageOrientation: 'from-image' }); }
    catch (e) { throw new Error('Not an image'); }
    const W = Math.max(1, Math.round(o.width)), H = Math.max(1, Math.round(o.height));
    const cv = document.createElement('canvas'); cv.width = W; cv.height = H;
    const ctx = cv.getContext('2d');
    // cover-fit, then zoom and pan inside the slack
    const z = Math.max(1, Number(o.zoom) || 1);
    const sc = Math.max(W / bmp.width, H / bmp.height) * z;
    const dw = bmp.width * sc, dh = bmp.height * sc;
    const clamp = (v) => Math.max(-1, Math.min(1, Number(v) || 0));
    const dx = (W - dw) / 2 + clamp(o.offsetX) * (dw - W) / 2;
    const dy = (H - dh) / 2 + clamp(o.offsetY) * (dh - H) / 2;
    if (o.mime === 'image/jpeg') { ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, W, H); }
    if (o.circle) { ctx.beginPath(); ctx.arc(W / 2, H / 2, Math.min(W, H) / 2, 0, Math.PI * 2); ctx.clip(); }
    ctx.drawImage(bmp, dx, dy, dw, dh);
    if (bmp.close) bmp.close();
    const toBlob = (q) => new Promise((res) => cv.toBlob(res, o.mime, q));
    const steps = [o.quality, 0.7, 0.55].filter((q, i, a) => q <= o.quality && a.indexOf(q) === i);
    let blob = null;
    for (const q of steps) {
      blob = await toBlob(q);
      if (blob && blob.size <= o.maxBytes) break;
      if (o.mime === 'image/png') break; // quality is ignored for PNG
    }
    if (!blob || blob.size > o.maxBytes) throw new Error('Image is still too large after compression, please choose a smaller one');
    const ext = o.mime === 'image/png' ? 'png' : o.mime === 'image/webp' ? 'webp' : 'jpg';
    return { blob, name: 'image.' + ext };
  };

  UC.pickImage = function (opts) {
    return new Promise((resolve) => {
      const inp = document.createElement('input');
      inp.type = 'file';
      inp.accept = (opts && opts.accept) || 'image/jpeg,image/png,image/webp';
      inp.style.cssText = 'position:fixed;left:-9999px;opacity:0;';
      let done = false;
      const fin = (f) => { if (done) return; done = true; inp.remove(); resolve(f); };
      inp.addEventListener('change', () => fin(inp.files && inp.files[0] ? inp.files[0] : null));
      inp.addEventListener('cancel', () => fin(null));
      document.body.appendChild(inp);
      inp.click();
    });
  };

  UC.uploadMedia = function (path, method, fields, fileField, blob, filename) {
    const fd = new FormData();
    Object.keys(fields || {}).forEach((k) => { if (fields[k] != null) fd.append(k, fields[k]); });
    if (fileField && blob) fd.append(fileField, blob, filename || ('image' + (blob.type === 'image/png' ? '.png' : '.jpg')));
    return UC.api(method, path, fd);
  };
})();
