/**
 * Service Worker v2 — offline-first caching for the SJ Traffic Site Checklist PWA.
 * Strategy: Cache app shell on install, cache-first for static assets,
 * network-first for data files (to pick up updates when online).
 */

const CACHE_NAME = 'sj-checklist-v2';

const APP_SHELL = [
  '/',
  '/index.html',
  '/manifest.json',
  '/css/styles.css',
  // Core JS
  '/js/app.js',
  '/js/store.js',
  '/js/db.js',
  '/js/sync.js',
  '/js/checklist-engine.js',
  '/js/toast.js',
  // Components
  '/components/nav-bar.js',
  '/components/job-list.js',
  '/components/checklist-view.js',
  '/components/sign-off.js',
  '/components/sync-status.js',
  '/components/settings.js',
  '/components/login.js',
  '/components/step-indicator.js',
  '/components/equipment-check.js',
  '/components/weather-input.js',
  '/components/photo-capture.js',
  '/components/hseq-notes.js',
  '/components/shutdown-view.js',
  '/components/finalize-job.js',
  '/components/incident-form.js',
  // Data
  '/data/characteristics.json',
  '/data/checklist-items.json',
  '/data/characteristic-map.json',
  '/data/mock-jobs.json',
  '/data/staff.json',
  '/data/equipment-items.json',
  '/data/equipment-map.json',
  '/data/client-requirements.json',
  // Assets
  '/assets/logo-full.png',
  '/assets/logo-small.png',
  '/assets/logo-icon.png',
  '/assets/icon-192.png',
  '/assets/icon-512.png',
];

// ── Install: Pre-cache app shell ────────────────────────

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(APP_SHELL);
    }).then(() => self.skipWaiting())
  );
});

// ── Activate: Clean up old caches ───────────────────────

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))
      );
    }).then(() => self.clients.claim())
  );
});

// ── Fetch: Cache-first for shell, network-first for data ─

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // Skip non-GET requests (POST to Google Sheets, etc.)
  if (event.request.method !== 'GET') return;

  // Skip chrome-extension, cross-origin (except CDN if any)
  if (!url.origin.includes(self.location.origin)) return;

  // Data files: network-first (get latest if online, fallback to cache)
  if (url.pathname.startsWith('/data/')) {
    event.respondWith(networkFirst(event.request));
    return;
  }

  // Everything else: cache-first
  event.respondWith(cacheFirst(event.request));
});

async function cacheFirst(request) {
  const cached = await caches.match(request);
  if (cached) return cached;

  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(CACHE_NAME);
      cache.put(request, response.clone());
    }
    return response;
  } catch {
    // If both cache miss and network fail, return a basic offline fallback
    return new Response('Offline', { status: 503, statusText: 'Offline' });
  }
}

async function networkFirst(request) {
  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(CACHE_NAME);
      cache.put(request, response.clone());
    }
    return response;
  } catch {
    const cached = await caches.match(request);
    if (cached) return cached;
    return new Response('Offline', { status: 503, statusText: 'Offline' });
  }
}
