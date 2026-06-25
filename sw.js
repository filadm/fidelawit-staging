// ROLLED BACK (build 20260625183951).
//
// The previous caching service worker was versioned per deploy, so every
// release purged its cache and the next open re-downloaded the whole app — a
// slow load after each update. We're removing SW caching while we design a
// better strategy (stale-while-revalidate) and validate it locally.
//
// This version SELF-DESTRUCTS: it clears all caches, unregisters itself, and
// reloads open tabs, so existing clients return to plain (no-SW) loading.
self.addEventListener('install', () => self.skipWaiting());

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    for (const key of await caches.keys()) {
      await caches.delete(key);
    }
    await self.registration.unregister();
    for (const client of await self.clients.matchAll()) {
      client.navigate(client.url);
    }
  })());
});
