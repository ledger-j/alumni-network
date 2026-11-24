/* UniCircle service worker: app-shell precache + offline fallback.
   Bump VERSION on every deploy that changes a precached file. */
const VERSION = 'uc-v7';
const CACHE = 'unicircle-' + VERSION;

// App shell: plain paths; cache-busting ?v= query strings are ignored on lookup.
const SHELL = [
  '/index.html', '/offline.html', '/assets/img/logo-u-badge-128.png', '/assets/img/logo-u-128.png', '/assets/img/favicon-32.png',
  '/css/main.css', '/css/components.css', '/css/unicircle.css', '/css/redesign.css',
  '/css/uc-orbit.css', '/css/pages.css', '/css/p-feed.css', '/css/p-network.css',
  '/css/p-events-jobs.css', '/css/p-mentoring-cases.css', '/css/p-map.css', '/css/p-profile.css', '/css/p-profile2.css', '/css/uc-collab.css', '/css/uc-chat.css',
  '/js/uc-theme.js', '/js/uc-constellation.js', '/js/app.js', '/js/unicircle.js', '/js/uc-media.js', '/js/uc-chat.js', '/js/uc-collab.js',
  '/js/pages/_shared.js', '/js/uc-waitlist-form.js', '/js/uc-map.js',
  '/js/pages/feed.js', '/js/pages/network.js', '/js/pages/map.js',
  '/js/pages/mentoring.js', '/js/pages/events.js', '/js/pages/pbl-hub.js',
  '/js/pages/jobs.js', '/js/pages/profile.js', '/js/pages/profile-deep.js', '/js/pages/profile-points.js'
];

self.addEventListener('install', (event) => {
  // Cache each file separately so one missing file cannot block the install.
  event.waitUntil(
    caches.open(CACHE)
      .then((cache) => Promise.all(SHELL.map((url) => cache.add(url).catch(() => {}))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  // Drop caches of older versions, then take control of open pages.
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k.startsWith('unicircle-') && k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  const url = new URL(req.url);

  // Never touch: non-GET, other origins (api.unicircle.eu, fonts, CDNs), /api/ paths.
  if (req.method !== 'GET') return;
  if (url.origin !== self.location.origin) return;
  if (url.pathname.startsWith('/api/')) return;

  // Navigations: network first, fall back to the cached shell, then the offline page.
  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req)
        .then((res) => {
          if (res.ok && url.pathname === '/') caches.open(CACHE).then((c) => c.put('/index.html', res.clone()));
          return res;
        })
        .catch(() =>
          (url.pathname === '/' || url.pathname === '/index.html'
            ? caches.match('/index.html')
            : Promise.resolve(undefined)
          ).then((shell) => shell || caches.match('/offline.html'))
        )
    );
    return;
  }

  // Static assets: cache first, refresh in the background (stale-while-revalidate).
  event.respondWith(
    caches.open(CACHE).then((cache) =>
      cache.match(req, { ignoreSearch: true }).then((hit) => {
        const refresh = fetch(req)
          .then((res) => {
            if (res.ok && res.type === 'basic') cache.put(req, res.clone());
            return res;
          })
          .catch(() => hit);
        return hit || refresh;
      })
    )
  );
});
