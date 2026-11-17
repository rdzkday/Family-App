// Daily Mood sudah bergabung ke app utama (service worker di /sw.js).
// File ini hanya untuk HP yang masih memasang SW lama: hapus cache lamanya lalu lepas diri.
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (e) => {
  e.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter((k) => k.startsWith('daily-mood-') || k.startsWith('ruang-catat-')).map((k) => caches.delete(k)));
    await self.registration.unregister();
    const tabs = await self.clients.matchAll({ type: 'window' });
    tabs.forEach((c) => c.navigate(c.url));
  })());
});
