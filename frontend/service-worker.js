const CACHE_NAME = 'offline-player-v1';
self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then((c) => c.addAll(['/'])));
  self.skipWaiting();
});
self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});
self.addEventListener('fetch', (event) => {
  event.respondWith(
    caches.match(event.request).then((resp) => resp || fetch(event.request))
  );
});
