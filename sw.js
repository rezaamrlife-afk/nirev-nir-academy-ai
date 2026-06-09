/**
 * NIREV AI — Service Worker
 * ─────────────────────────────────────────────────────────────
 * Version: 1.0.0 — Phase 5
 *
 * Caches static assets for offline support.
 * Network-first strategy for API calls.
 * Cache-first strategy for static files.
 * ─────────────────────────────────────────────────────────────
 */

const CACHE_NAME    = 'nirev-v1';
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/css/theme.css',
  '/css/base.css',
  '/css/layout.css',
  '/css/components.css',
  '/css/dashboard.css',
  '/css/auth.css',
  '/css/assessment.css',
  '/css/analytics.css',
  '/css/progress.css',
  '/css/reports.css',
  '/js/app.js',
  '/js/auth.js',
  '/js/config.js',
  '/js/store.js',
  '/js/ui.js',
  '/js/theme.js',
  '/js/router.js',
  '/js/db.js',
  '/js/groq.js',
  '/js/dashboard.js',
  '/js/assessment.js',
  '/js/analytics.js',
  '/js/progress.js',
  '/js/reports.js',
  '/js/settings.js',
  '/css/settings.css',
  '/js/engine/assessment-engine.js',
  '/js/domain/assessments/assessment-domain.js',
  '/js/domain/scoring/scoring-domain.js',
  '/js/domain/feedback/feedback-domain.js',
  '/js/domain/analytics/analytics-domain.js',
  '/js/domain/predictions/prediction-domain.js',
  '/manifest.json',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
];

// ── Install ───────────────────────────────────────────────────

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(STATIC_ASSETS);
    }).then(() => self.skipWaiting())
  );
});

// ── Activate ──────────────────────────────────────────────────

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.filter(key => key !== CACHE_NAME).map(key => caches.delete(key))
      );
    }).then(() => self.clients.claim())
  );
});

// ── Fetch ─────────────────────────────────────────────────────

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // Skip non-GET requests
  if (event.request.method !== 'GET') return;

  // Network-first for API calls (Supabase, Groq)
  if (url.hostname.includes('supabase.co') ||
      url.hostname.includes('groq.com') ||
      url.hostname.includes('googleapis.com')) {
    event.respondWith(
      fetch(event.request).catch(() => {
        return new Response('{"error":"offline"}', {
          headers: { 'Content-Type': 'application/json' }
        });
      })
    );
    return;
  }

  // Cache-first for static assets
  event.respondWith(
    caches.match(event.request).then((cached) => {
      if (cached) return cached;
      return fetch(event.request).then((response) => {
        if (response.ok) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
        }
        return response;
      });
    })
  );
});
