const CACHE_VERSION = 'weeky-sw-v2';
const SHELL_CACHE = `${CACHE_VERSION}:shell`;
const RUNTIME_CACHE = `${CACHE_VERSION}:runtime`;

// Native IndexedDB helper for the Service Worker
function getOfflineTrackFromDB(trackId) {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('weeky-offline', 1);
    request.onerror = () => resolve(null);
    request.onsuccess = (event) => {
      const db = event.target.result;
      if (!db.objectStoreNames.contains('tracks')) {
        db.close();
        return resolve(null);
      }
      try {
        const tx = db.transaction('tracks', 'readonly');
        const store = tx.objectStore('tracks');
        const getReq = store.get(trackId);
        getReq.onsuccess = () => {
          db.close();
          resolve(getReq.result || null);
        };
        getReq.onerror = () => {
          db.close();
          resolve(null);
        };
      } catch (e) {
        db.close();
        resolve(null);
      }
    };
  });
}

function getOfflineLyricsFromDB(trackId) {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('weeky-offline', 1);
    request.onerror = () => resolve(null);
    request.onsuccess = (event) => {
      const db = event.target.result;
      if (!db.objectStoreNames.contains('lyrics')) {
        db.close();
        return resolve(null);
      }
      try {
        const tx = db.transaction('lyrics', 'readonly');
        const store = tx.objectStore('lyrics');
        const getReq = store.get(trackId);
        getReq.onsuccess = () => {
          db.close();
          resolve(getReq.result || null);
        };
        getReq.onerror = () => {
          db.close();
          resolve(null);
        };
      } catch (e) {
        db.close();
        resolve(null);
      }
    };
  });
}

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

      // iOS Safari can fail the whole install if any single request fails.
      // So we settle requests individually.
      const results = await Promise.allSettled(
        SHELL_ASSETS.map(async (path) => {
          const req = new Request(path, { cache: 'reload' });
          const res = await fetch(req);
          if (!res.ok) throw new Error(`Precache failed: ${path} (${res.status})`);

          // Ensure SPA shell exists under both '/' and '/index.html'.
          if (path === '/') {
            await cache.put('/', res.clone());
            await cache.put('/index.html', res.clone());
          } else if (path === '/index.html') {
            await cache.put('/index.html', res.clone());
            await cache.put('/', res.clone());
          } else {
            await cache.put(path, res);
          }
        })
      );

      // If index.html didn't cache, we still want install to succeed,
      // but offline navigation won't work.
      const failed = results.filter((r) => r.status === 'rejected');
      if (failed.length) {
        // Keep silent; we don't want to break install in production.
      }
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
        const cache = await caches.open(SHELL_CACHE);
        try {
          const fresh = await fetch(req);
          cache.put('/index.html', fresh.clone());
          cache.put('/', fresh.clone());
          return fresh;
        } catch (e) {
          const cached =
            (await cache.match(req)) ||
            (await cache.match('/')) ||
            (await cache.match('/index.html'));

          return (
            cached ||
            new Response(
              '<!doctype html><html><head><meta charset="utf-8" /><meta name="viewport" content="width=device-width, initial-scale=1" /><title>Weeky</title></head><body style="background:#000;color:#fff;font-family:system-ui;padding:16px;">Offline</body></html>',
              { status: 200, headers: { 'Content-Type': 'text/html; charset=utf-8' } }
            )
          );
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

  // Intercept offline audio chunks
  if (url.pathname.startsWith('/api/audio/stream/')) {
    // Attempt to extract trackId. The path is usually /api/audio/stream/{trackId}
    const parts = url.pathname.split('/');
    const trackId = decodeURIComponent(parts[parts.length - 1]);

    // We only intercept GETs for the actual audio file which might be served directly
    // Wait, the client first fetches the stream URL JSON, then the audio src.
    // If this is the audio src (e.g. streaming endpt), we intercept.
    event.respondWith(
      (async () => {
        // 1. Check IDB
        const blob = await getOfflineTrackFromDB(trackId);
        if (blob) {
          return new Response(blob, {
            headers: {
              'Content-Type': blob.type || 'audio/mpeg',
              'Accept-Ranges': 'bytes'
            }
          });
        }

        // 2. Fetch network
        try {
          return await fetch(req);
        } catch (e) {
          return new Response('', { status: 503 });
        }
      })()
    );
    return;
  }

  // Intercept lyrics fetch
  if (url.pathname.startsWith('/api/lyrics/')) {
    const parts = url.pathname.split('/');
    const trackId = decodeURIComponent(parts[parts.length - 1]);

    event.respondWith(
      (async () => {
        // Check IDB FIRST, because it reduces network load if already saved
        const lyricsData = await getOfflineLyricsFromDB(trackId);
        if (lyricsData) {
          return new Response(JSON.stringify(lyricsData), {
            headers: { 'Content-Type': 'application/json' }
          });
        }

        try {
          return await fetch(req);
        } catch (e) {
          return new Response(JSON.stringify({ success: false, error: 'Offline' }), { status: 503, headers: { 'Content-Type': 'application/json' } });
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
