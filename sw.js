const CACHE_NAME = "roomly-pwa-v3";

const REL_PRECACHE = [
  "",
  "index.html",
  "manifest.webmanifest",
  "favicon.svg",
  "apple-touch-icon.png",
  "icon-192.png",
  "icon-512.png",
  "fonts/UbuntuSans-Variable.ttf",
  "fonts/UbuntuSansMono-Variable.ttf",
];

function scopeUrl(rel) {
  const clean = String(rel || "").replace(/^\.?\/+/, "");
  return new URL(clean, self.registration.scope).href;
}

self.addEventListener("install", event => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then(cache => cache.addAll(REL_PRECACHE.map(scopeUrl)))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", event => {
  event.waitUntil(
    caches
      .keys()
      .then(keys =>
        Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
      )
      .then(() => self.clients.claim())
  );
});

self.addEventListener("message", event => {
  const data = event?.data;
  if (!data || data.type !== "PRECACHE_URLS" || !Array.isArray(data.urls)) return;
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache =>
      Promise.allSettled(
        data.urls.map(async raw => {
          const url = scopeUrl(raw);
          const hit = await cache.match(url);
          if (!hit) await cache.add(url);
        })
      )
    )
  );
});

self.addEventListener("fetch", event => {
  const req = event.request;
  if (req.method !== "GET") return;

  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  const indexHref = scopeUrl("index.html");

  if (req.mode === "navigate") {
    event.respondWith(
      fetch(req)
        .then(res => {
          if (res && res.ok) {
            const copy = res.clone();
            caches.open(CACHE_NAME).then(c => c.put(indexHref, copy));
          }
          return res;
        })
        .catch(() => caches.match(indexHref))
    );
    return;
  }

  event.respondWith(
    caches.match(req).then(cached => {
      if (cached) return cached;
      return fetch(req).then(res => {
        if (res && res.ok && (res.type === "basic" || res.type === "cors")) {
          const copy = res.clone();
          caches.open(CACHE_NAME).then(c => c.put(req, copy));
        }
        return res;
      });
    })
  );
});
