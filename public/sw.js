const CACHE_VERSION = 'weeky-sw-v1';
const SHELL_CACHE = `${CACHE_VERSION}:shell`;
const RUNTIME_CACHE = `${CACHE_VERSION}:runtime`;

const SHELL_ASSETS = [
  '/',
  '/index.html',
  '/favicon.png',
  '/page-icon.png'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(SHELL_CACHE);
      await cache.addAll(SHELL_ASSETS);
      await self.skipWaiting();
    })()
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(
        keys
          .filter((k) => !k.startsWith(CACHE_VERSION))
          .map((k) => caches.delete(k))
      );
      await self.clients.claim();
    })()
  );
});

function isSameOrigin(url) {
  try {
    return new URL(url).origin === self.location.origin;
  } catch (e) {
    return false;
  }
}

self.addEventListener('fetch', (event) => {
  const req = event.request;
  const url = new URL(req.url);

  // Only handle same-origin GET requests
  if (req.method !== 'GET' || !isSameOrigin(req.url)) return;

  // Navigation (SPA) - network first, fallback to cached index
  if (req.mode === 'navigate') {
    event.respondWith(
      (async () => {
        try {
          const fresh = await fetch(req);
          const cache = await caches.open(SHELL_CACHE);
          cache.put('/index.html', fresh.clone());
          return fresh;
        } catch (e) {
          const cache = await caches.open(SHELL_CACHE);
          const cached = await cache.match('/index.html');
          return cached || new Response('Offline', { status: 503, headers: { 'Content-Type': 'text/plain' } });
        }
      })()
    );
    return;
  }

  // Cache player/account state (so Library can show something offline)
  if (url.pathname.startsWith('/api/account/state')) {
    event.respondWith(
      (async () => {
        const cache = await caches.open(RUNTIME_CACHE);
        try {
          const fresh = await fetch(req);
          cache.put(req, fresh.clone());
          return fresh;
        } catch (e) {
          const cached = await cache.match(req);
          return cached || new Response(JSON.stringify({ success: false, offline: true }), {
            status: 503,
            headers: { 'Content-Type': 'application/json' }
          });
        }
      })()
    );
    return;
  }

  // Static build assets (CRA) - cache first
  if (url.pathname.startsWith('/static/') || url.pathname.endsWith('.css') || url.pathname.endsWith('.js')) {
    event.respondWith(
      (async () => {
        const cache = await caches.open(SHELL_CACHE);
        const cached = await cache.match(req);
        if (cached) return cached;
        const fresh = await fetch(req);
        cache.put(req, fresh.clone());
        return fresh;
      })()
    );
    return;
  }

  // Images - stale-while-revalidate
  if (req.destination === 'image') {
    event.respondWith(
      (async () => {
        const cache = await caches.open(RUNTIME_CACHE);
        const cached = await cache.match(req);
        const fetchPromise = fetch(req)
          .then((fresh) => {
            cache.put(req, fresh.clone());
            return fresh;
          })
          .catch(() => null);

        return cached || (await fetchPromise) || new Response('', { status: 404 });
      })()
    );
  }
});
