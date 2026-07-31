/* Offline cache.

   Code is fetched network-first so a deploy is always picked up — you can never
   be stranded on a stale build, even if the cache was not rebuilt. Photos and
   icons are cache-first because they are large and never change.

   Version is a hash of file contents, so any edit invalidates the old cache.
   Regenerate with: python3 tools/build-sw.py */
const CACHE = 'dcs-trainer-b27cd3d4';
const SHELL = [
  "./index.html",
  "./manifest.webmanifest",
  "./favicon.ico",
  "./favicon.svg",
  "./src/aircraft/f14b/controls.js",
  "./src/aircraft/f14b/gauges.js",
  "./src/aircraft/f14b/index.js",
  "./src/aircraft/f14b/procedures/aa-gun.js",
  "./src/aircraft/f14b/procedures/aa-phoenix-stt.js",
  "./src/aircraft/f14b/procedures/aa-phoenix-tws.js",
  "./src/aircraft/f14b/procedures/aa-sidewinder.js",
  "./src/aircraft/f14b/procedures/aa-sparrow.js",
  "./src/aircraft/f14b/procedures/landing-carrier.js",
  "./src/aircraft/f14b/procedures/landing-shore.js",
  "./src/aircraft/f14b/procedures/pilot-start.js",
  "./src/aircraft/f14b/procedures/rio-align-carrier.js",
  "./src/aircraft/f14b/procedures/rio-align-shore.js",
  "./src/aircraft/f14b/procedures/rio-common.js",
  "./src/aircraft/f14b/procedures/shutdown-pilot.js",
  "./src/aircraft/f14b/procedures/shutdown-rio.js",
  "./src/aircraft/f14b/systems.js",
  "./src/aircraft/registry.js",
  "./src/core/app.js",
  "./src/core/checklist.js",
  "./src/core/config.js",
  "./src/core/dom.js",
  "./src/core/kneecard.js",
  "./src/core/menu.js",
  "./src/core/presence.js",
  "./src/core/sim.js",
  "./src/core/stats.js",
  "./src/core/views.js",
  "./src/core/style.css",
  "./assets/f14b/pilot-consoles.jpg",
  "./assets/f14b/pilot-front.jpg",
  "./assets/f14b/rio-centre.jpg",
  "./assets/f14b/rio-left.jpg",
  "./assets/f14b/rio-right.jpg",
  "./assets/icons/apple-touch-icon.png",
  "./assets/icons/favicon-16.png",
  "./assets/icons/favicon-32.png",
  "./assets/icons/favicon-48.png",
  "./assets/icons/icon-192.png",
  "./assets/icons/icon-512.png",
  "./assets/icons/icon-maskable-512.png"
];
const STATIC = /\/assets\//;                 // big, immutable

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(caches.keys()
    .then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== location.origin) return;      // never touch the presence beat

  if (STATIC.test(url.pathname)) {                 // cache-first for artwork
    e.respondWith(caches.match(req).then(hit => hit || fetch(req).then(res => {
      const copy = res.clone();
      caches.open(CACHE).then(c => c.put(req, copy)).catch(() => {});
      return res;
    })));
    return;
  }

  e.respondWith(fetch(req).then(res => {           // network-first for everything else
    const copy = res.clone();
    caches.open(CACHE).then(c => c.put(req, copy)).catch(() => {});
    return res;
  }).catch(() => caches.match(req).then(hit => hit || caches.match('./index.html'))));
});
