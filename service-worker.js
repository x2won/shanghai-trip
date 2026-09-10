// 앱 파일과 지도 타일을 저장해 인터넷 없이도 열리게 한다
const APP_CACHE = "app-v4";
const TILE_CACHE = "tiles-v2";
const TILE_HOSTS = ["tile.openstreetmap.org", "basemaps.cartocdn.com"];

const APP_FILES = [
  "./",
  "index.html",
  "manifest.json",
  "css/style.css",
  "vendor/leaflet.css",
  "vendor/leaflet.js",
  "js/config.js",
  "js/coords.js",
  "js/geo.js",
  "js/rally.js",
  "js/trip.js",
  "js/auth.js",
  "js/editor.js",
  "js/mapview.js",
  "js/app.js",
  "data/trip.json",
  "assets/icons/icon-192.png",
  "assets/icons/icon-512.png",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(APP_CACHE).then((c) => c.addAll(APP_FILES)).then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== APP_CACHE && k !== TILE_CACHE).map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);

  // 지도 타일: 저장된 것 우선, 없으면 받아서 저장
  if (TILE_HOSTS.some((h) => url.hostname.endsWith(h))) {
    event.respondWith(
      caches.open(TILE_CACHE).then(async (cache) => {
        const hit = await cache.match(event.request);
        if (hit) return hit;
        try {
          const res = await fetch(event.request);
          if (res.ok) cache.put(event.request, res.clone());
          return res;
        } catch {
          return new Response("", { status: 504 });
        }
      })
    );
    return;
  }

  // 앱 파일: 저장된 것 우선, 네트워크가 되면 조용히 갱신
  if (url.origin === location.origin) {
    event.respondWith(
      caches.match(event.request).then((hit) => {
        const live = fetch(event.request)
          .then((res) => {
            if (res.ok) caches.open(APP_CACHE).then((c) => c.put(event.request, res.clone()));
            return res;
          })
          .catch(() => hit);
        return hit || live;
      })
    );
  }
});
