/* Dawr service worker: app shell precached; audio chimes are cached the first time they play. */
const CACHE = 'dawr-v1';
const ASSETS = [
  './',
  'index.html',
  'css/style.css',
  'js/queue.js',
  'js/i18n.js',
  'js/app.js',
  'js/vendor/qrcode.min.js',
  'assets/logo.svg',
  'manifest.webmanifest',
  'fonts/ChivoMono-latin-500.woff2',
  'fonts/ChivoMono-latin-700.woff2',
  'fonts/Tajawal-arabic-400.woff2',
  'fonts/Tajawal-arabic-500.woff2',
  'fonts/Tajawal-arabic-700.woff2',
  'fonts/Tajawal-arabic-800.woff2',
  'fonts/Tajawal-latin-400.woff2',
  'fonts/Tajawal-latin-500.woff2',
  'fonts/Tajawal-latin-700.woff2',
  'fonts/Tajawal-latin-800.woff2',
  'fonts/fonts.css'
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(ASSETS)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== location.origin) return;
  e.respondWith(
    caches.match(req, { ignoreSearch: true }).then((hit) => hit || fetch(req).then((res) => {
      if (res && res.ok && /\/audio\//.test(req.url)) { const copy = res.clone(); caches.open(CACHE).then((c) => c.put(req, copy)); }
      return res;
    }).catch(() => (req.mode === 'navigate' ? caches.match('index.html') : Response.error())))
  );
});
