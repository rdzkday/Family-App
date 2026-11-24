// Service worker Family App (semua fitur): network-first untuk app shell (update selalu masuk saat online),
// fallback ke cache saat offline. Request API (POST ke Supabase) tidak disentuh. Satu SW untuk semua fitur (termasuk Daily Mood).
const CACHE = 'kantong-v27-template-ilustrasi';
const SHELL = ['./', 'index.html', 'manifest.webmanifest',
  'shared/fitur.js', 'shared/core.js', 'shared/base.js', 'shared/ui.js', 'shared/shell.js', 'shared/connect.js', 'shared/demo.js', 'shared/start.js',
  'shared/tokens.css', 'shared/styles.css', 'shared/nav.css', 'shared/ilustrasi.css', 'shared/ilustrasi.js',
  'ilustrasi/dark/auth-masuk.svg', 'ilustrasi/dark/auth-keluar.svg', 'ilustrasi/dark/auth-sesi-berakhir.svg', 'ilustrasi/dark/kosong-transaksi.svg', 'ilustrasi/dark/kosong-todo.svg', 'ilustrasi/dark/kosong-catatan.svg', 'ilustrasi/dark/kosong-jadwal.svg', 'ilustrasi/dark/kosong-komitmen.svg', 'ilustrasi/dark/kosong-pencarian.svg', 'ilustrasi/dark/status-offline.svg', 'ilustrasi/dark/onboarding-05-daily-mood.svg', 'ilustrasi/light/auth-masuk.svg', 'ilustrasi/light/auth-keluar.svg', 'ilustrasi/light/auth-sesi-berakhir.svg', 'ilustrasi/light/kosong-transaksi.svg', 'ilustrasi/light/kosong-todo.svg', 'ilustrasi/light/kosong-catatan.svg', 'ilustrasi/light/kosong-jadwal.svg', 'ilustrasi/light/kosong-komitmen.svg', 'ilustrasi/light/kosong-pencarian.svg', 'ilustrasi/light/status-offline.svg', 'ilustrasi/light/onboarding-05-daily-mood.svg',
  'beranda/beranda.js', 'beranda/pengaturan.js', 'beranda/beranda.css',
  'daily-mood/', 'daily-mood/index.html', 'daily-mood/app.js', 'daily-mood/data.js', 'daily-mood/styles.css', 'daily-mood/vendor/jspdf.umd.min.js',
  'kantong/', 'kantong/index.html', 'kantong/transaksi.js', 'kantong/laporan.js', 'kantong/catat.js', 'kantong/atur.js', 'kantong/template.js',
  'pengaturan/', 'pengaturan/index.html',
  'agenda/', 'agenda/index.html', 'agenda/todo.js', 'agenda/agenda.js', 'agenda/siklus.js',
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
  if (req.method !== 'GET' || url.origin !== self.location.origin || url.pathname.startsWith('/admin')) return;   // admin panel tidak di-cache
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
