/**
 * Service Worker minimal — TT Tournoi PWA.
 *
 * Stratégies :
 *  - Pages HTML : Network-First (toujours fraîches si online)
 *  - Assets statiques : Cache-First
 *  - API GET : Network-First avec fallback cache
 *  - API POST/PATCH : passe au réseau (la file IndexedDB côté JS gère l'offline)
 *
 * Pour une intégration plus avancée (Serwist), voir docs/pwa.md.
 */

/* eslint-disable no-restricted-globals */
const CACHE = 'tt-tournoi-v1';
const STATIC = ['/', '/manifest.webmanifest'];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE).then((cache) => cache.addAll(STATIC)).catch(() => undefined),
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))),
    ),
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return; // mutations passent au réseau directement

  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  // Assets statiques : Cache-First
  if (
    url.pathname.startsWith('/_next/static/') ||
    url.pathname.startsWith('/icons/') ||
    url.pathname.startsWith('/fonts/') ||
    url.pathname.endsWith('.webmanifest')
  ) {
    event.respondWith(
      caches.match(req).then(
        (cached) =>
          cached ||
          fetch(req).then((res) => {
            const copy = res.clone();
            caches.open(CACHE).then((c) => c.put(req, copy)).catch(() => undefined);
            return res;
          }),
      ),
    );
    return;
  }

  // API GET : Network-First avec fallback cache
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(
      fetch(req)
        .then((res) => {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(req, copy)).catch(() => undefined);
          return res;
        })
        .catch(() => caches.match(req).then((cached) => cached || new Response('{"offline":true}', { status: 503, headers: { 'Content-Type': 'application/json' } }))),
    );
    return;
  }

  // Pages HTML : Network-First, fallback cache (utile pour /juge-arbitre offline)
  event.respondWith(
    fetch(req)
      .then((res) => {
        const copy = res.clone();
        caches.open(CACHE).then((c) => c.put(req, copy)).catch(() => undefined);
        return res;
      })
      .catch(() => caches.match(req).then((cached) => cached || caches.match('/'))),
  );
});
