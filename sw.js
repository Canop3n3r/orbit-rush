// Minimal service worker: makes Orbit Rush installable (add to home screen). Network only, no caching,
// so a new deploy is always picked up immediately.
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', e => e.waitUntil(self.clients.claim()));
self.addEventListener('fetch', e => { if (e.request.method === 'GET') e.respondWith(fetch(e.request)); });
