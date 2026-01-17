/* sw.js - PropCola Share caching
   Cache Supabase public storage assets:
   - share JSON
   - images, pdf, mp4, any file opened
*/

const CACHE_NAME = "propcola-share-v1";

// ✅ Supabase storage url matcher
function isSupabasePublicStorage(url) {
  try {
    const u = new URL(url);

    // your project storage host
    // mxuknvleveqqybhbhwnv.supabase.co/storage/v1/object/public/
    return (
      u.hostname === "mxuknvleveqqybhbhwnv.supabase.co" &&
      u.pathname.includes("/storage/v1/object/public/")
    );
  } catch (e) {
    return false;
  }
}

// Optional: limit cache size so it doesn't grow forever
async function trimCache(maxItems = 120) {
  const cache = await caches.open(CACHE_NAME);
  const keys = await cache.keys();
  if (keys.length <= maxItems) return;

  const extra = keys.length - maxItems;
  for (let i = 0; i < extra; i++) {
    await cache.delete(keys[i]);
  }
}

self.addEventListener("install", (event) => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil((async () => {
    self.clients.claim();

    // Cleanup old cache versions if changed
    const keys = await caches.keys();
    await Promise.all(
      keys.map(k => (k !== CACHE_NAME ? caches.delete(k) : null))
    );
  })());
});

// ✅ Cache strategy:
// - Cache First for Supabase storage (fast + reduces bandwidth)
// - If not in cache -> fetch -> store -> return
self.addEventListener("fetch", (event) => {
  const req = event.request;

  // only GET
  if (req.method !== "GET") return;

  const url = req.url;

  // only handle supabase public storage
  if (!isSupabasePublicStorage(url)) return;

  event.respondWith((async () => {
    const cache = await caches.open(CACHE_NAME);

    // 1) return cache if exists
    const cached = await cache.match(req);
    if (cached) return cached;

    // 2) fetch from network
    try {
      const res = await fetch(req);

      // only cache success responses
      if (res && res.ok) {
        try {
          await cache.put(req, res.clone());
          trimCache(150); // limit growth
        } catch (e) {
          // ignore cache put errors
        }
      }

      return res;
    } catch (e) {
      // offline and not cached
      return new Response("Offline: file not cached yet.", {
        status: 504,
        statusText: "Gateway Timeout"
      });
    }
  })());
});
