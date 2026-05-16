// Wave Service Worker — Offline + Download Cache
const CACHE_NAME   = 'wave-v1';
const AUDIO_CACHE  = 'wave-audio-v1';

// Static assets to cache on install (app shell)
const SHELL_ASSETS = [
  './',
  './index.html',
  './app.html',
  './manifest.json',
  './assets/css/auth.css',
  './assets/css/app.css',
  './assets/js/firebase-config.js',
  './assets/js/auth.js',
  './assets/js/app.js',
  './assets/js/player.js',
  './assets/js/crypto.js',
  './assets/js/db.js',
  './icons/wave-icon-192.png',
  './icons/wave-icon-512.png',
  './logo.png'
];

// ── Install ────────────────────────────────────────────────────────────
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(SHELL_ASSETS))
      .then(() => self.skipWaiting())
      .catch(err => console.warn('[SW] Shell cache failed (some assets may be missing):', err))
  );
});

// ── Activate ───────────────────────────────────────────────────────────
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys
          .filter(k => k !== CACHE_NAME && k !== AUDIO_CACHE)
          .map(k => caches.delete(k))
      )
    ).then(() => self.clients.claim())
  );
});

// ── Fetch ──────────────────────────────────────────────────────────────
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);

  // ── Cloudinary audio (.ganuman files) — cache after first fetch
  if (
    url.hostname.includes('cloudinary.com') &&
    url.pathname.includes('.ganuman')
  ) {
    event.respondWith(audioStrategy(event.request));
    return;
  }

  // ── Cloudinary thumbnails — cache after first fetch
  if (
    url.hostname.includes('cloudinary.com') &&
    url.pathname.match(/\.(jpg|jpeg|png|webp)$/i)
  ) {
    event.respondWith(cacheFirst(event.request, CACHE_NAME));
    return;
  }

  // ── Firebase / Firestore / Auth — always network (live data)
  if (
    url.hostname.includes('firebaseio.com') ||
    url.hostname.includes('firestore.googleapis.com') ||
    url.hostname.includes('identitytoolkit.googleapis.com') ||
    url.hostname.includes('securetoken.googleapis.com')
  ) {
    event.respondWith(fetch(event.request));
    return;
  }

  // ── Google Fonts — cache first
  if (url.hostname.includes('fonts.googleapis.com') || url.hostname.includes('fonts.gstatic.com')) {
    event.respondWith(cacheFirst(event.request, CACHE_NAME));
    return;
  }

  // ── Firebase SDK scripts — cache first
  if (url.hostname.includes('gstatic.com') && url.pathname.includes('firebasejs')) {
    event.respondWith(cacheFirst(event.request, CACHE_NAME));
    return;
  }

  // ── App shell (HTML, CSS, JS, icons) — stale-while-revalidate
  if (url.origin === self.location.origin) {
    event.respondWith(staleWhileRevalidate(event.request));
    return;
  }

  // ── Everything else — network with cache fallback
  event.respondWith(networkWithFallback(event.request));
});

// ── Cache Strategies ───────────────────────────────────────────────────

// Audio: cache-first for encrypted songs (big files, rarely change)
async function audioStrategy(request) {
  const cache    = await caches.open(AUDIO_CACHE);
  const cached   = await cache.match(request);
  if (cached) return cached;

  try {
    const response = await fetch(request);
    if (response.ok) {
      // Clone before consuming
      cache.put(request, response.clone());
    }
    return response;
  } catch {
    return new Response('Audio unavailable offline', { status: 503 });
  }
}

// Cache-first: serve from cache, fall back to network
async function cacheFirst(request, cacheName) {
  const cache  = await caches.open(cacheName);
  const cached = await cache.match(request);
  if (cached) return cached;

  try {
    const response = await fetch(request);
    if (response.ok) cache.put(request, response.clone());
    return response;
  } catch {
    return new Response('Not available offline', { status: 503 });
  }
}

// Stale-while-revalidate: serve cache immediately, update in background
async function staleWhileRevalidate(request) {
  const cache  = await caches.open(CACHE_NAME);
  const cached = await cache.match(request);

  const fetchPromise = fetch(request)
    .then(response => {
      if (response.ok) cache.put(request, response.clone());
      return response;
    })
    .catch(() => null);

  return cached || fetchPromise || new Response('Offline', { status: 503 });
}

// Network with fallback to cache
async function networkWithFallback(request) {
  try {
    const response = await fetch(request);
    return response;
  } catch {
    const cache  = await caches.open(CACHE_NAME);
    const cached = await cache.match(request);
    return cached || new Response('Not available offline', { status: 503 });
  }
}

// ── Background Sync (download queue) ──────────────────────────────────
self.addEventListener('message', event => {
  if (event.data?.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }

  // Pre-cache a song URL (called from player.js after successful decrypt)
  if (event.data?.type === 'CACHE_AUDIO' && event.data.url) {
    caches.open(AUDIO_CACHE).then(cache => {
      fetch(event.data.url)
        .then(r => { if (r.ok) cache.put(event.data.url, r); })
        .catch(() => {});
    });
  }

  // Clear audio cache (e.g. when songs are deleted by admin)
  if (event.data?.type === 'CLEAR_AUDIO_CACHE') {
    caches.delete(AUDIO_CACHE);
  }
});
