const CACHE_NAME = 'frc-scouting-shell-v1';
const ASSETS = [
  './',
  './index.html',
  './styles.css',
  './app.js',
  './manifest.json'
];

// Install: cache app shell
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(ASSETS))
  );
});

// Activate: clean up old caches if needed
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys
          .filter(k => k !== CACHE_NAME)
          .map(k => caches.delete(k))
      )
    )
  );
});

// Fetch: serve from cache, fall back to network
self.addEventListener('fetch', (event) => {
  const req = event.request;

  // Only handle GET requests
  if (req.method !== 'GET') return;

  event.respondWith(
    caches.match(req).then(cached => {
      if (cached) return cached;
      return fetch(req);
    })
  );
});