// Service Worker para Socrates Bot PWA
const CACHE_NAME = "socrates-bot-v1";
const STATIC_ASSETS = [
  "/",
  "/static/css/styles.css",
  "/static/js/app.js",
  "/static/js/voice_interface.js",
  "/static/js/editor.js",
  "/static/manifest.json",
  "/static/img/mascota/huevo.png",
  "/static/img/mascota/aprendiz.png",
  "/static/img/mascota/junior.png",
  "/static/img/mascota/senior.png",
  "/static/img/mascota/sabio.png"
];

// Instalacion del service worker y almacenamiento en cache
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(STATIC_ASSETS);
    })
  );
  self.skipWaiting();
});

// Activacion y limpieza de caches antiguas
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            return caches.delete(key);
          }
        })
      );
    })
  );
  self.clients.claim();
});

// Estrategia de respuesta de red con respaldo en cache
self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") {
    return;
  }
  event.respondWith(
    fetch(event.request)
      .then((networkResponse) => {
        return networkResponse;
      })
      .catch(() => {
        return caches.match(event.request).then((cachedResponse) => {
          if (cachedResponse) {
            return cachedResponse;
          }
          return caches.match("/");
        });
      })
  );
});
