/* Offline support. Network first (always the newest version when online), cache as fallback when offline.
   The build script replaces VERSION so every published update gets a fresh cache. */
const VERSION = '202611070245';
const CACHE = 'phdcc-' + VERSION;
const SHELL = ['./', 'index.html', 'manifest.webmanifest', 'css/app.css', 'css/time.css', 'css/records.css',
  'js/i18n.js', 'js/ui.js', 'js/store.js', 'js/sync.js', 'js/cite.js', 'js/ai.js', 'js/notes.js', 'js/plan.js', 'js/time.js',
  'js/views/dashboard.js', 'js/views/library.js', 'js/views/source.js', 'js/views/projects.js', 'js/views/journal.js', 'js/views/argument.js',
  'js/views/writing.js', 'js/views/calendar.js', 'js/views/meetings.js', 'js/views/records.js', 'js/views/reviews.js', 'js/views/cards.js',
  'js/views/settings.js', 'js/views/overlays.js', 'js/app.js', 'icons/icon-192.png', 'icons/icon-512.png', 'icons/apple-touch-icon.png'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => Promise.all(SHELL.map(u => c.add(u).catch(() => null)))).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k.startsWith('phdcc-') && k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== self.location.origin) return;
  e.respondWith(fetch(req).then(res => {
    if (res.ok) { const copy = res.clone(); caches.open(CACHE).then(c => c.put(req, copy)); }
    return res;
  }).catch(() => caches.match(req, { ignoreSearch: true }).then(r => r || caches.match('index.html'))));
});
