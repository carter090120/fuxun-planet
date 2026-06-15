const CACHE_NAME = "fuxun-planet-v7";
const SHELL_ASSETS = [
  "./", "./index.html", "./manifest.webmanifest",
  "./icons/icon-192.png", "./icons/icon-512.png",
];

const APP_ASSETS = [
  "./styles.css", "./app.js", "./components.js", "./version.js", "./demoData.js",
  "./storage.js", "./auth.js", "./router.js", "./parentSummary.js",
  "./questionParser.js", "./ocrService.js", "./trainingCoach.js", "./notifications.js",
  "./charts.js", "./poster.js",
];

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(CACHE_NAME).then((c) => c.addAll([...SHELL_ASSETS, ...APP_ASSETS])));
  self.skipWaiting();
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))),
  );
  self.clients.claim();
});

self.addEventListener("message", (e) => {
  if (e.data?.type === "SKIP_WAITING") self.skipWaiting();
});

self.addEventListener("fetch", (e) => {
  if (e.request.method !== "GET") return;
  const url = new URL(e.request.url);
  const isAppJs = APP_ASSETS.some((p) => url.pathname.endsWith(p.replace("./", "")));

  if (isAppJs) {
    e.respondWith(
      fetch(e.request)
        .then((res) => {
          const clone = res.clone();
          caches.open(CACHE_NAME).then((c) => c.put(e.request, clone));
          return res;
        })
        .catch(() => caches.match(e.request).then((c) => c || caches.match("./index.html"))),
    );
    return;
  }

  e.respondWith(
    caches.match(e.request).then((c) => c || fetch(e.request).catch(() => caches.match("./index.html"))),
  );
});