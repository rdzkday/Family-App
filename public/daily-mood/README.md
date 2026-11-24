# Daily Mood: jurnal mood harian (dulu "Ruang Catat")

- Lokasi: `public/daily-mood/` → `/daily-mood/`. URL lama `/ruang-catat/` dialihkan ke sini.
- Bagian dari Family App: menu bawah, tema, manifest, dan service worker (`/sw.js`) sama dengan fitur lain. Bisa dimatikan admin (fitur `mood`).
  `sw.js` di folder ini hanya pembersih untuk HP yang masih memasang SW lama.
- Data: tabel Supabase `jurnal` lewat Edge Function `kantong` (aksi `jurnal.list/save/delete`). Pribadi: pasangan tidak bisa membaca.
  Satu baris per hari (`<user>|YYYY-MM-DD`) + satu baris pengaturan (`<user>|_pengaturan`).
- Offline-first: tersimpan di localStorage (`ruang-catat-v2`, nama kunci lama sengaja dipertahankan), dikirim saat online.
- Pengaturan (profil, kondisi, prompt, cadangan) ada di **Beranda › Pengaturan › Daily Mood**. Konstanta bersama: `data.js`.
- **Tab Berdua = Couple Journaling** (`berdua.js`, `berdua.css`): tabel `jurnal_pasangan` lewat aksi `cj.*` (fitur `mood`). Logika & aturan privasi di `shared/core.js` (`cjAksi`, helper `KantongCore.CJ`, dimuat juga di halaman ini). Isian harian jalan offline (antre `cj-outbox-*`), aksi lain butuh koneksi. Mode demo: data di `k_cj_demo`, bisa "lihat sebagai" Riki/Febie. Buka langsung: `/daily-mood/?tab=berdua`.
- PDF rangkuman: di HP lewat lembar Bagikan (WA/Files), di laptop langsung terunduh.
