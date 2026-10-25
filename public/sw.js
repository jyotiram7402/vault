/**
 * Tijori service worker.
 *
 * Deliberately minimal. It exists for one reason: to show a readable page when
 * the device is offline.
 *
 * It never caches HTML pages, API responses or anything from another origin,
 * so no vault data — not even ciphertext — can end up in the Cache Storage of
 * a shared device. Supabase and Have I Been Pwned traffic is not touched at
 * all: those requests go straight to the network.
 */

const VERSION = 'v1'
const CACHE_NAME = `tijori-${VERSION}`
const OFFLINE_URL = '/offline.html'

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => cache.add(new Request(OFFLINE_URL, { cache: 'reload' })))
      .then(() => self.skipWaiting()),
  )
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))),
      )
      .then(() => self.clients.claim()),
  )
})

self.addEventListener('fetch', (event) => {
  const request = event.request

  // Only plain GETs from this origin are ever handled here.
  if (request.method !== 'GET') return

  let url
  try {
    url = new URL(request.url)
  } catch {
    return
  }
  if (url.origin !== self.location.origin) return

  // Build output is content-hashed, so cache-first is safe and fast.
  if (url.pathname.startsWith('/_next/static/')) {
    event.respondWith(
      caches.match(request).then((cached) => {
        if (cached) return cached
        return fetch(request).then((response) => {
          if (response && response.status === 200 && response.type === 'basic') {
            const copy = response.clone()
            caches.open(CACHE_NAME).then((cache) => cache.put(request, copy))
          }
          return response
        })
      }),
    )
    return
  }

  // Page loads are network-only, with the offline page as the fallback.
  // Nothing here is stored: a cached vault page would be a cached secret.
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request).catch(() =>
        caches.match(OFFLINE_URL).then(
          (cached) =>
            cached ||
            new Response('You are offline.', {
              status: 503,
              headers: { 'Content-Type': 'text/plain; charset=utf-8' },
            }),
        ),
      ),
    )
  }
})
