/* ==========================================================================
   UniCircle — constellation engine (the brand's one moving idea)
   People are dots, relations are lines. One factory, many surfaces:
   landing hero, page ribbons, and the orbit rail (menu dots are real nodes).

   UCConstellation.mount(canvas, options) -> api
     options  count, palette[], wash (css colour | null), ink 'r,g,b',
              linkAlpha, linkDist, linkEvery, pull {x,y} | null, pointer (bool),
              pointerRadius, anchorRange, anchorAlpha, thread (bool), speed
     api      setAnchors([{id,x,y,hue}]), setActive(id), hover(id|null),
              pulse(fromId,toId,ms), setPalette(list), refresh(), destroy()

   Rules: own RAF handle per mount (several can run at once); every listener is
   removed in destroy(); pauses when hidden or off-screen; prefers-reduced-motion
   draws static frames only; DPR capped at 2.
   ========================================================================== */
(function () {
  'use strict';

  const mqReduce = window.matchMedia
    ? window.matchMedia('(prefers-reduced-motion: reduce)') : { matches: false };

  const DEFAULTS = {
    count: 90,
    palette: ['oklch(0.62 0.14 235)', 'oklch(0.62 0.14 275)', 'oklch(0.62 0.14 305)', 'oklch(0.62 0.14 185)'],
    wash: 'rgba(250,249,246,0.28)',   // trail wash; null = clear every frame (transparent canvas)
    bg: '#faf9f6',                    // first-frame fill when wash is set
    ink: '43,42,38',                  // line colour as r,g,b
    linkAlpha: 0.06,
    linkDist: 70,
    linkEvery: 3,                     // only every Nth particle links: calm, not a hairball
    pull: { x: 0.5, y: 0.55 },        // drift toward this point (fraction of W,H); null = none
    pointer: true,
    pointerRadius: 180,
    anchorRange: 130,
    anchorAlpha: 0.34,
    thread: false,                    // faint line through the anchors, in order
    speed: 1,
    size: [1.2, 4.2],
    alpha: [0.3, 0.65],
  };

  const ease = (t) => 1 - Math.pow(1 - t, 3);          // easeOutCubic

  function mount(canvas, userOpts) {
    if (!canvas || !canvas.getContext) return null;
    if (canvas.__ucConstellation) canvas.__ucConstellation.destroy();

    const o = Object.assign({}, DEFAULTS, userOpts || {});
    const ctx = canvas.getContext('2d');
    const host = canvas.parentElement || canvas;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);

    let W = 0, H = 0, raf = 0, destroyed = false;
    let visible = !document.hidden, inView = true;
    let anchors = [], activeId = null, hoverId = null, hoverT0 = 0, hoverFrom = null;
    const pulses = [];
    const mouse = { x: null, y: null };
    const particles = [];

    const byId = (id) => anchors.find((a) => a.id === id);
    const rnd = (a, b) => a + Math.random() * (b - a);

    function resize() {
      const pw = W, ph = H;
      W = canvas.clientWidth; H = canvas.clientHeight;
      if (!W || !H) { W = pw; H = ph; return; }
      // Keep the swarm spread across the new size (a canvas is often measured before its
      // CSS has applied; without this, dots stay clustered in the first, smaller box).
      if (pw && ph && (pw !== W || ph !== H)) for (const p of particles) { p.x *= W / pw; p.y *= H / ph; }
      canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      if (o.wash) { ctx.fillStyle = o.bg; ctx.fillRect(0, 0, W, H); }
      if (!particles.length) for (let i = 0; i < o.count; i++) particles.push(spawn());
      if (!running()) draw(performance.now(), false);
    }

    function spawn() {
      return {
        x: Math.random() * (W || 300), y: Math.random() * (H || 300),
        vx: Math.random() - 0.5, vy: Math.random() - 0.5,
        s: rnd(o.size[0], o.size[1]),
        c: o.palette[Math.floor(Math.random() * o.palette.length)],
        a: rnd(o.alpha[0], o.alpha[1]), off: Math.random() * Math.PI * 2,
      };
    }

    function step(p, t) {
      const f = o.speed;
      const a = Math.sin(p.y * 0.004 + t * 0.0004 + p.off) + Math.cos(p.x * 0.003 - t * 0.0003);
      p.vx += Math.cos(a) * 0.03 * f; p.vy += Math.sin(a) * 0.03 * f;
      if (o.pull) {
        const dx = W * o.pull.x - p.x, dy = H * o.pull.y - p.y, d = Math.hypot(dx, dy) || 1;
        p.vx += (dx / d) * 0.007 * f; p.vy += (dy / d) * 0.007 * f;
      }
      if (o.pointer && mouse.x !== null) {
        const mx = mouse.x - p.x, my = mouse.y - p.y, md = Math.hypot(mx, my);
        if (md < o.pointerRadius && md > 0.01) { p.vx += (mx / md) * 0.05; p.vy += (my / md) * 0.05; }
      }
      p.vx *= 0.96; p.vy *= 0.96; p.x += p.vx; p.y += p.vy;
      if (p.x < -20) p.x = W + 20; else if (p.x > W + 20) p.x = -20;
      if (p.y < -20) p.y = H + 20; else if (p.y > H + 20) p.y = -20;
    }

    const line = (x1, y1, x2, y2, rgba, w) => {
      ctx.strokeStyle = rgba; ctx.lineWidth = w || 1;
      ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
    };

    function draw(t, animate) {
      if (!W || !H) return;
      ctx.globalAlpha = 1;
      // Trails (translucent wash) only while animating. A static redraw (reduced motion,
      // off-screen, hover/resize) paints an opaque background, otherwise every redraw would
      // wash the previous frame a little more and the dots would fade away.
      if (o.wash && animate) { ctx.fillStyle = o.wash; ctx.fillRect(0, 0, W, H); }
      else if (o.wash) { ctx.fillStyle = o.bg; ctx.fillRect(0, 0, W, H); }
      else ctx.clearRect(0, 0, W, H);

      for (const p of particles) {
        if (animate) step(p, t);
        ctx.globalAlpha = p.a; ctx.fillStyle = p.c;
        ctx.beginPath(); ctx.roundRect(p.x - p.s, p.y - p.s, p.s * 2, p.s * 2, p.s * 0.7); ctx.fill();
      }
      ctx.globalAlpha = 1;

      // relations between particles
      const D2 = o.linkDist * o.linkDist, n = particles.length, e = o.linkEvery;
      for (let i = 0; i < n; i += e) {
        for (let j = i + e; j < n; j += e) {
          const a = particles[i], b = particles[j], dx = a.x - b.x, dy = a.y - b.y;
          if (dx * dx + dy * dy < D2) line(a.x, a.y, b.x, b.y, 'rgba(' + o.ink + ',' + o.linkAlpha + ')');
        }
      }

      if (anchors.length) drawAnchors(t);
    }

    function drawAnchors(t) {
      const R = o.anchorRange;
      if (o.thread && anchors.length > 1) {
        ctx.strokeStyle = 'rgba(' + o.ink + ',0.14)'; ctx.lineWidth = 1;
        ctx.beginPath();
        anchors.forEach((a, i) => (i ? ctx.lineTo(a.x, a.y) : ctx.moveTo(a.x, a.y)));
        ctx.stroke();
      }
      // menu dots reach for the nearest drifting people
      for (const a of anchors) {
        const boost = a.id === activeId ? 1.5 : 1;
        for (const p of particles) {
          const dx = a.x - p.x, dy = a.y - p.y, d = Math.hypot(dx, dy);
          if (d < R) line(a.x, a.y, p.x, p.y, 'rgba(' + o.ink + ',' + ((1 - d / R) * o.anchorAlpha * boost).toFixed(3) + ')');
        }
      }
      // active node halo
      const act = byId(activeId);
      if (act) {
        const k = mqReduce.matches ? 0.5 : 0.5 + 0.5 * Math.sin(t * 0.003);
        ctx.globalAlpha = 0.18 + 0.12 * k; ctx.fillStyle = 'oklch(0.78 0.14 ' + act.hue + ')';
        ctx.beginPath(); ctx.arc(act.x, act.y, 9 + 3 * k, 0, 6.2832); ctx.fill(); ctx.globalAlpha = 1;
      }
      // hover: a line draws from the hovered dot to the active dot (<= 220 ms)
      if (hoverId && act) {
        const h = byId(hoverId);
        if (h && h !== act) {
          const p = mqReduce.matches ? 1 : ease(Math.min(1, (performance.now() - hoverT0) / 220));
          line(h.x, h.y, h.x + (act.x - h.x) * p, h.y + (act.y - h.y) * p,
            'oklch(0.78 0.14 ' + h.hue + ' / 0.85)', 1.5);
        }
      }
      // click: a pulse travels along the line into the page
      const now = performance.now();
      for (let i = pulses.length - 1; i >= 0; i--) {
        const q = pulses[i], k = (now - q.t0) / q.ms;
        if (k >= 1) { pulses.splice(i, 1); continue; }
        const A = byId(q.from), B = byId(q.to); if (!A || !B) { pulses.splice(i, 1); continue; }
        const e1 = ease(k), x = A.x + (B.x - A.x) * e1, y = A.y + (B.y - A.y) * e1;
        ctx.globalAlpha = 1 - k * 0.6; ctx.fillStyle = 'oklch(0.85 0.12 ' + A.hue + ')';
        ctx.beginPath(); ctx.arc(x, y, 4, 0, 6.2832); ctx.fill(); ctx.globalAlpha = 1;
      }
    }

    const running = () => !destroyed && !mqReduce.matches && visible && inView;

    function frame(t) {
      raf = 0;
      if (destroyed) return;
      if (!canvas.isConnected) { destroy(); return; }
      draw(t, true);
      if (running()) raf = requestAnimationFrame(frame);
    }
    function kick() {
      if (raf || destroyed) return;
      if (running()) raf = requestAnimationFrame(frame);
      else draw(performance.now(), false);
    }

    // ---- listeners (all removed in destroy) ----
    const onMove = (ev) => {
      const r = canvas.getBoundingClientRect();
      mouse.x = ev.clientX - r.left; mouse.y = ev.clientY - r.top;
    };
    const onLeave = () => { mouse.x = mouse.y = null; };
    const onVis = () => { visible = !document.hidden; kick(); };
    const onMq = () => kick();
    if (o.pointer) { host.addEventListener('pointermove', onMove); host.addEventListener('pointerleave', onLeave); }
    document.addEventListener('visibilitychange', onVis);
    if (mqReduce.addEventListener) mqReduce.addEventListener('change', onMq);

    let ro = null, io = null;
    if (window.ResizeObserver) { ro = new ResizeObserver(resize); ro.observe(canvas); }
    else window.addEventListener('resize', resize);
    if (window.IntersectionObserver) {
      io = new IntersectionObserver((es) => { inView = es[0].isIntersecting; kick(); });
      io.observe(canvas);
    }

    function destroy() {
      if (destroyed) return;
      destroyed = true;
      if (raf) cancelAnimationFrame(raf);
      host.removeEventListener('pointermove', onMove); host.removeEventListener('pointerleave', onLeave);
      document.removeEventListener('visibilitychange', onVis);
      if (mqReduce.removeEventListener) mqReduce.removeEventListener('change', onMq);
      if (ro) ro.disconnect(); else window.removeEventListener('resize', resize);
      if (io) io.disconnect();
      if (canvas.__ucConstellation === api) delete canvas.__ucConstellation;
    }

    const api = {
      setAnchors(list) { anchors = (list || []).slice(); if (!running()) draw(performance.now(), false); },
      setActive(id) { activeId = id; if (!running()) draw(performance.now(), false); },
      hover(id) {
        if (id === hoverId) return;
        hoverFrom = hoverId; hoverId = id; hoverT0 = performance.now();
        if (!running()) draw(performance.now(), false);
      },
      pulse(from, to, ms) {
        if (mqReduce.matches) return;
        pulses.push({ from, to, ms: ms || 280, t0: performance.now() }); kick();
      },
      setPalette(list) {
        if (!Array.isArray(list) || !list.length) return;
        o.palette = list.slice();                       // later spawns use it
        for (const p of particles) p.c = o.palette[Math.floor(Math.random() * o.palette.length)];
        if (!running()) draw(performance.now(), false);
      },
      refresh() { resize(); },
      destroy,
      get running() { return running(); },
    };
    canvas.__ucConstellation = api;

    resize();
    kick();
    return api;
  }

  window.UCConstellation = { mount };
})();
