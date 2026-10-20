// Minimal service worker: makes Orbit Rush installable (add to home screen). Network only, nothing is cached,
// so a new deploy is always picked up immediately. /tiles/* (private build's 3D-tiles proxy) is never touched:
// no respondWith, the browser fetches it directly (no-store from the server), so tiles are never cached here.
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', e => e.waitUntil(self.clients.claim()));
self.addEventListener('fetch', e => {
  const u = new URL(e.request.url);
  if (e.request.method !== 'GET' || u.origin !== self.location.origin || u.pathname.includes('/tiles/')) return;
  e.respondWith(fetch(e.request));
});
