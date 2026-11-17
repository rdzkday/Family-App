# Daily Mood: jurnal mood harian (dulu "Ruang Catat")

- Lokasi: `public/daily-mood/` → `/daily-mood/`. URL lama `/ruang-catat/` dialihkan ke sini.
- Data: tabel Supabase `jurnal` lewat Edge Function `kantong` (aksi `jurnal.list/save/delete`). Pribadi: pasangan tidak bisa membaca.
  Satu baris per hari (`<user>|YYYY-MM-DD`) + satu baris pengaturan (`<user>|_pengaturan`).
- Offline-first: tersimpan di localStorage (`ruang-catat-v2`, nama kunci lama sengaja dipertahankan), dikirim saat online.
- Pengaturan (profil, kondisi, prompt, cadangan) ada di **Beranda › Pengaturan › Daily Mood**. Konstanta bersama: `data.js`.
- PDF rangkuman: di HP lewat lembar Bagikan (WA/Files), di laptop langsung terunduh.
