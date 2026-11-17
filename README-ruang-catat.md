# Ruang Catat: jurnal mood harian (PWA)

- Lokasi: `public/ruang-catat/` → terbuka di `/ruang-catat/` pada domain Cloudflare yang sama dengan Kantong.
- Data tersimpan hanya di perangkat (localStorage), tanpa akun dan tanpa server.
- Jalan offline: font, jsPDF, dan ikon disimpan lokal; service worker sendiri (`ruang-catat/sw.js`).
- PDF rangkuman: di HP lewat lembar Bagikan (WA/Files), di laptop langsung terunduh.
