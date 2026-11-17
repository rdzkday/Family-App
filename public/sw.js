// Service worker Beranda/Kantong/Agenda/Komitmen: network-first untuk app shell (update selalu masuk saat online),
// fallback ke cache saat offline. Request API (POST ke Supabase) tidak disentuh. Daily Mood punya SW sendiri.
const CACHE = 'kantong-v16-family-app';
const SHELL = ['./', 'index.html', 'manifest.webmanifest',
  'shared/core.js', 'shared/base.js', 'shared/ui.js', 'shared/shell.js', 'shared/connect.js', 'shared/demo.js', 'shared/start.js',
  'shared/tokens.css', 'shared/styles.css',
  'beranda/beranda.js', 'beranda/pengaturan.js', 'beranda/beranda.css', 'daily-mood/data.js',
  'kantong/', 'kantong/index.html', 'kantong/transaksi.js', 'kantong/laporan.js', 'kantong/catat.js', 'kantong/atur.js',
  'agenda/', 'agenda/index.html', 'agenda/todo.js', 'agenda/agenda.js',
  'komitmen/', 'komitmen/index.html', 'komitmen/komitmen.js', 'komitmen/komitmen.css',
  'fonts/jakarta.woff2', 'icons/icon.svg', 'icons/icon-animated.svg', 'icons/icon-32.png', 'icons/icon-192.png', 'icons/apple-touch-icon.png'];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys()
    .then((keys) => Promise.all(keys.filter((k) => k.startsWith('kantong-') && k !== CACHE).map((k) => caches.delete(k))))
    .then(() => self.clients.claim()));
});
self.addEventListener('fetch', (e) => {
  const req = e.request;
  const url = new URL(req.url);
  if (req.method !== 'GET' || url.origin !== self.location.origin) return;
  e.respondWith((async () => {
    const cache = await caches.open(CACHE);
    try {
      const ctrl = new AbortController();
      const t = setTimeout(() => ctrl.abort(), 4000);
      const res = await fetch(req, { signal: ctrl.signal, cache: 'no-cache' });
      clearTimeout(t);
      if (res.ok && res.type === 'basic') cache.put(req, res.clone());
      return res;
    } catch (_) {
      return (await cache.match(req, { ignoreSearch: true })) ||
        (req.mode === 'navigate' ? cache.match('index.html') : Response.error());
    }
  })());
});
