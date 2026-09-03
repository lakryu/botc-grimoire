// Offline-Cache: Kernressourcen beim Install, Rest (Icons) beim ersten Abruf
const CACHE = "botc-v3";
const CORE = [
  ".", "index.html", "css/style.css", "manifest.webmanifest",
  "js/app.js", "js/data.js", "js/state.js", "js/ui.js", "js/audio.js", "js/candles.js",
  "js/setup.js", "js/reveal.js", "js/grimoire.js", "js/night.js", "js/day.js", "js/panels.js",
  "data/roles.json", "data/editions.json", "data/fabled.json", "data/game.json",
];

self.addEventListener("install", e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(CORE)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", e => {
  e.waitUntil(
    caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", e => {
  if (e.request.method !== "GET") return;
  const url = new URL(e.request.url);
  if (url.origin !== location.origin) return;

  // Icons ändern sich nie -> cache-first; alles andere network-first (frisch wenn online, Cache offline)
  const cacheFirst = url.pathname.includes("/assets/icons/");
  e.respondWith(
    cacheFirst
      ? caches.match(e.request).then(hit => hit || fetchAndCache(e.request))
      : fetchAndCache(e.request).catch(() => caches.match(e.request))
  );
});

function fetchAndCache(req) {
  return fetch(req).then(res => {
    if (res.ok) {
      const clone = res.clone();
      caches.open(CACHE).then(c => c.put(req, clone));
    }
    return res;
  });
}
