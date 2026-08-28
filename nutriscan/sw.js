const CACHE = 'verdiscan-v1';
const ASSETS = [
  './',
  './index.html',
  './manifest.json',
  './assets/css/app.css',
  './assets/js/app.js',
  './assets/js/rules.js',
  './assets/js/scoring.js',
  './assets/js/off-api.js',
  './assets/js/scanner.js',
  './assets/js/i18n.js',
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(ASSETS)));
  self.skipWaiting();
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (e) => {
  if (e.request.url.includes('openfoodfacts.org')) return;
  e.respondWith(
    caches.match(e.request).then((cached) => cached || fetch(e.request))
  );
});
