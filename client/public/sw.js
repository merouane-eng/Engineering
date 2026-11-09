/* Service Worker — Engineering PWA
 * Versionné pour forcer le renouvellement des anciennes ressources.
 */
const CACHE_NAME = "engineering-v3-logo";
const STATIC_ASSETS = [
  "/",
  "/index.html",
  "/manifest.json",
  "/engineering-logo.svg",
  "/icons/icon-72x72.svg",
  "/icons/icon-96x96.svg",
  "/icons/icon-128x128.svg",
  "/icons/icon-144x144.svg",
  "/icons/icon-152x152.svg",
  "/icons/icon-192x192.svg",
  "/icons/icon-384x384.svg",
  "/icons/icon-512x512.svg",
  "/icons/maskable-icon.svg",
  "/icons/apple-touch-icon.svg"
];

self.addEventListener("install", event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(STATIC_ASSETS))
      .catch(error => console.warn("[PWA] Cache initial indisponible :", error))
  );
  self.skipWaiting();
});

self.addEventListener("activate", event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys.filter(key => key.startsWith("engineering-") && key !== CACHE_NAME)
          .map(key => caches.delete(key))
      )
    )
  );
  self.clients.claim();
});

self.addEventListener("fetch", event => {
  const request = event.request;
  const url = new URL(request.url);

  if (request.method !== "GET" || url.origin !== self.location.origin) return;

  // Ne jamais mettre en cache les réponses API : elles peuvent contenir
  // des données utilisateur et doivent toujours refléter l'état du serveur.
  if (url.pathname.startsWith("/api/")) {
    event.respondWith(fetch(request));
    return;
  }

  // Toujours vérifier la dernière version de l'application auprès du serveur.
  if (request.mode === "navigate" || url.pathname === "/" || url.pathname === "/index.html") {
    event.respondWith(
      fetch(request)
        .then(response => {
          if (response && response.ok) {
            const copy = response.clone();
            caches.open(CACHE_NAME).then(cache => cache.put("/index.html", copy));
          }
          return response;
        })
        .catch(() => caches.match("/index.html"))
    );
    return;
  }

  // Les fichiers compilés Vite portent un nom versionné : cache-first est sûr.
  event.respondWith(
    caches.match(request).then(cached => {
      if (cached) return cached;
      return fetch(request).then(response => {
        if (response && response.ok) {
          const copy = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(request, copy));
        }
        return response;
      });
    })
  );
});
