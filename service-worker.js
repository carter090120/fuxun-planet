const CACHE_NAME = "fuxun-planet-v16d";

const SHELL_ASSETS = [
  "./", "./index.html", "./manifest.webmanifest",
  "./icons/icon-192.png", "./icons/icon-512.png",
];

const APP_ASSETS = [
  "./styles.css", "./app.js", "./components.js", "./version.js", "./demoData.js", "./demoMode.js",
  "./storage.js", "./auth.js", "./router.js", "./parentSummary.js",
  "./questionParser.js", "./ocrService.js", "./trainingCoach.js", "./notifications.js",
  "./charts.js", "./poster.js", "./growthMarket.js", "./growthAssets.js", "./pointLedger.js", "./marketKline.js", "./trainingFocus.js", "./memberRoles.js", "./specialPerformance.js", "./fatherWorkbench.js", "./motherWorkbench.js", "./honorItems.js",
];

const NETWORK_FIRST_PATTERNS = [
  "index.html", "app.js", "styles.css", "manifest.webmanifest", "service-worker.js",
  ...APP_ASSETS.map((p) => p.replace("./", "")),
];

function isNetworkFirst(url) {
  const path = url.pathname.replace(/^\//, "");
  return NETWORK_FIRST_PATTERNS.some((name) => path === name || path.endsWith(`/${name}`));
}

function isLegacyCache(name) {
  return name.startsWith("fuxun-planet-")
    || name.startsWith("study-habit")
    || name.startsWith("fsgrowth");
}

async function networkFirst(request) {
  try {
    const res = await fetch(request);
    if (res && res.ok) {
      const cache = await caches.open(CACHE_NAME);
      await cache.put(request, res.clone());
    }
    return res;
  } catch {
    const cached = await caches.match(request);
    if (cached) return cached;
    return caches.match("./index.html");
  }
}

self.addEventListener("install", (e) => {
  e.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(SHELL_ASSETS).catch(() => undefined)),
  );
  self.skipWaiting();
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys.filter((k) => isLegacyCache(k) && k !== CACHE_NAME).map((k) => caches.delete(k)),
      ),
    ).then(() => self.clients.claim()),
  );
});

self.addEventListener("message", (e) => {
  if (e.data?.type === "SKIP_WAITING") self.skipWaiting();
});

self.addEventListener("fetch", (e) => {
  if (e.request.method !== "GET") return;
  const url = new URL(e.request.url);
  if (url.origin !== self.location.origin) return;

  if (isNetworkFirst(url)) {
    e.respondWith(networkFirst(e.request));
    return;
  }

  e.respondWith(
    fetch(e.request)
      .then((res) => {
        if (res.ok) {
          caches.open(CACHE_NAME).then((c) => c.put(e.request, res.clone()));
        }
        return res;
      })
      .catch(() => caches.match(e.request).then((c) => c || caches.match("./index.html"))),
  );
});