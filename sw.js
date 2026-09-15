// ── BECO Service Worker v1.0 ─────────────────────────────────────────────
// Cache-first para assets estáticos; network-first para Graph API.

const CACHE = 'beco-gen-v1';
const STATIC = [
  '/',
  '/index.html',
  '/manifest.json',
  'https://cdnjs.cloudflare.com/ajax/libs/Chart.js/4.4.1/chart.umd.js',
  'https://alcdn.msauth.net/browser/3.27.0/js/msal-browser.min.js'
];

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE).then(c => c.addAll(STATIC)).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);

  // Graph API y MSAL → siempre red (no cachear tokens ni datos)
  if (url.hostname.includes('microsoft') || url.hostname.includes('graph') || url.hostname.includes('msauth')) {
    e.respondWith(fetch(e.request).catch(() => new Response(
      JSON.stringify({ error: 'Sin conexión. Los datos se guardarán al reconectar.' }),
      { headers: { 'Content-Type': 'application/json' } }
    )));
    return;
  }

  // Assets estáticos → cache-first
  e.respondWith(
    caches.match(e.request).then(cached => {
      if (cached) return cached;
      return fetch(e.request).then(resp => {
        if (resp && resp.status === 200 && resp.type !== 'opaque') {
          const clone = resp.clone();
          caches.open(CACHE).then(c => c.put(e.request, clone));
        }
        return resp;
      }).catch(() => caches.match('/index.html'));
    })
  );
});
