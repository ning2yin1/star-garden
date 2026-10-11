'use strict';
// Bump VERSION whenever any cached file changes. A waiting update activates
// after all old app windows close, so a running game keeps a consistent version.
const VERSION = 'v1';
const CACHE_PREFIX = `star-garden:${self.registration.scope}:`;
const CACHE_NAME = CACHE_PREFIX + VERSION;
const ASSETS = [
  './', './index.html', './style.css', './engine.js', './script.js', './pwa.js',
  './manifest.webmanifest', './icons/icon-192.png', './icons/icon-512.png',
  './icons/apple-touch-icon.png',
  './images/background.png', './images/red.png', './images/blue.png',
  './images/yellow.png', './images/green.png', './images/purple.png',
  './images/star_arrow.png', './images/wind_spirit.png',
  './images/stardust_magic.png', './images/rainbow_crystal.png',
  './audio/serenitys-lullaby.mp3'
];

self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE_NAME).then(cache =>
    cache.addAll(ASSETS.map(path => new Request(new URL(path, self.registration.scope), {cache: 'reload'})))
  ));
});

self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter(key => key.startsWith(CACHE_PREFIX) && key !== CACHE_NAME)
      .map(key => caches.delete(key)));
    await self.clients.claim();
  })());
});

// iOS media playback can request byte ranges even for a fully cached MP3.
async function cachedResponse(request) {
  const cache = await caches.open(CACHE_NAME);
  const response = await cache.match(request.url);
  if (!response) return fetch(request);
  const range = request.headers.get('range');
  if (!range) return response;
  const match = /^bytes=(\d*)-(\d*)$/.exec(range);
  if (!match || (!match[1] && !match[2])) return response;
  const data = await response.arrayBuffer();
  const size = data.byteLength;
  const start = match[1] ? Number(match[1]) : Math.max(0, size - Number(match[2]));
  const end = match[1] && match[2] ? Math.min(Number(match[2]), size - 1) : size - 1;
  if (start >= size || start > end) {
    return new Response(null, {status: 416, headers: {'Content-Range': `bytes */${size}`}});
  }
  const headers = new Headers(response.headers);
  headers.set('Content-Range', `bytes ${start}-${end}/${size}`);
  headers.set('Content-Length', String(end - start + 1));
  headers.set('Accept-Ranges', 'bytes');
  return new Response(data.slice(start, end + 1), {status: 206, headers});
}

self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);
  if (event.request.method !== 'GET' || !url.href.startsWith(self.registration.scope)) return;
  event.respondWith(cachedResponse(event.request));
});
