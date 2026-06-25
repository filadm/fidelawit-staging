'use strict';
// Fidelawit — stale-while-revalidate service worker.
//
// Goal: instant repeat opens (even offline, even on slow links) WITHOUT the
// failure mode of the previous worker. That one was versioned per deploy: every
// release purged the entire cache, forcing a full re-download and briefly
// serving an inconsistent bundle — which took the app down.
//
// Strategy here:
//   * ONE stable cache, never bumped per deploy.
//   * Per-resource stale-while-revalidate: serve the cached copy instantly, then
//     refresh it from the network in the background. A deploy is picked up on the
//     NEXT open — no whole-cache purge, no re-download storm, and each open
//     serves a self-consistent snapshot (no half-old/half-new bundle).
//   * Same-origin GET only; only 200/basic responses are cached.
//
// Bump CACHE only if THIS worker's logic changes (not for app deploys).

const CACHE = 'fidelawit-swr-v1';

self.addEventListener('install', () => self.skipWaiting());

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    // Drop caches from any older worker (e.g. the previous versioned one).
    for (const key of await caches.keys()) {
      if (key !== CACHE) await caches.delete(key);
    }
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET') return;
  if (new URL(request.url).origin !== self.location.origin) return;

  event.respondWith((async () => {
    const cache = await caches.open(CACHE);
    const cached = await cache.match(request);

    const fromNetwork = fetch(request)
      .then((response) => {
        if (response && response.status === 200 && response.type === 'basic') {
          cache.put(request, response.clone());
        }
        return response;
      })
      .catch(() => undefined);

    if (cached) {
      event.waitUntil(fromNetwork); // refresh in the background
      return cached;
    }
    const network = await fromNetwork;
    return network || Response.error();
  })());
});
