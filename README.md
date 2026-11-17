# Family App

Aplikasi keuangan + to-do rumah tangga untuk berdua (Riki & Febie). PWA tanpa build step, backend Supabase.

- **App**: dipasang di HP dari URL Vercel (project `dompet-app`, folder `public/`). Push ke `main` = otomatis rilis.
- **Backend**: Supabase project `serskylzlevhjidqrvjm` (Postgres + Edge Function `kantong`). API: `https://serskylzlevhjidqrvjm.supabase.co/functions/v1/kantong`.
- **Panduan pasang lengkap**: [`kantong/PANDUAN.md`](kantong/PANDUAN.md).

Data keuangan pribadi tidak disertakan di repo ini.

---

## Fitur aktif — versi terbaru (v1.6.0 · 17 Nov 2026)

| Status | Fitur | Bisa apa |
|---|---|---|
| ✅ Live | **Beranda** (`/`) | Sapaan + status sinkron, pintasan ke semua fitur, ringkasan Kantong (sisa dompet RT, budget terpakai, saldo pribadi, 3 transaksi terakhir), catat transaksi cepat, to-do & catatan + tambah cepat, pengingat evaluasi bulanan, pilih mood → lanjut ke Daily Mood |
| ✅ Live | **Pengaturan terpusat** (di Beranda) | Satu kartu, expand-collapse per fitur: Umum (tema, akun, sinkron, putuskan koneksi) · Kantong (budget, kantong, kategori, setoran di grafik) · Agenda (filter awal, status Google Calendar, jadwalkan evaluasi) · Komitmen · Daily Mood (profil, kondisi, prompt, cadangan) |
| ✅ Live | **Kantong** (`/kantong/`) | Catat pengeluaran/pemasukan/transfer, 3 buku (Riki, Febie, Rumah Tangga), budget bulanan, talangan, reimburse, Ringkasan (donut per kategori), Riwayat + pencarian |
| ✅ Live | **Agenda** (`/agenda/`) | Tab To-do, Catatan, Jadwal. Pemilik Riki/Febie/Bersama, filter Untukku/Bersama/Semua, atur tanggal-jam-durasi |
| ✅ Live | **Komitmen** (`/komitmen/`) | Baca & cari pasal kesepakatan (Kesepakatan + Definisi A–Z), filter (pranikah, usulan, dicabut), riwayat versi & tanda tangan. **Baru:** usul pasal baru & tarik usulan, tersambung ke server |
| ✅ Live | **Daily Mood** (`/daily-mood/`, dulu Ruang Catat) | Jurnal mood harian + prompt (acak/custom), kalender mood, ringkasan periode → unduh/bagikan PDF, cadangan & pulihkan. Data pribadi di Supabase (pasangan tidak bisa baca) |
| ✅ Live | **Offline & sinkron** | Input masuk antrean di HP, terkirim otomatis saat online, tanpa data dobel |
| ✅ Live | **Tema & mode demo** | Gelap/terang berlaku di semua fitur. Mode demo pakai data contoh tanpa server |
| ⏳ Perlu setup sekali | **Google Calendar "Rumah Kita"** | Sync to-do berwaktu ke kalender. Secret Google belum diisi di Supabase (PANDUAN §7) |
| 🔜 Menyusul | Komitmen | Ubah pasal & tanda tangan dari app |

### Yang baru di rilis ini
- Nama app jadi **Family App** (fitur keuangan tetap bernama Kantong).
- Pengaturan semua fitur pindah ke Beranda (expand-collapse); tab Pengaturan Kantong & halaman Setelan dihapus.
- Agenda jadi halaman sendiri; Ruang Catat jadi **Daily Mood** dan sinkron ke Supabase.
- Komitmen: usul & tarik pasal baru.
- Repo dirapikan per fitur; file redundan dihapus (config Cloudflare, font duplikat).
- Backend: database 4 migrasi terpasang, Edge Function `kantong` v14.

---

## Cara pakai

### Pertama kali
1. Buka URL app di HP → **Install app** (Android: menu ⋮; iPhone: Share → Add to Home Screen).
2. Buka app dari home screen → tempel **kode koneksi** → **Hubungkan**.
3. Kode koneksi dibuat di Supabase **SQL Editor** (satu per orang, hasilnya rahasia):
   ```sql
   select kantong_buat_kode('riki',  'https://serskylzlevhjidqrvjm.supabase.co/functions/v1/kantong');
   select kantong_buat_kode('istri', 'https://serskylzlevhjidqrvjm.supabase.co/functions/v1/kantong');
   ```
   Menjalankan ulang = kode lama langsung mati (dipakai kalau HP hilang).
4. **Beranda › Pengaturan › Kantong**: isi saldo tiap kantong sesuai aplikasi bank, atur kategori & budget bulanan.
5. Belum punya kode? Tombol **Coba mode demo** memakai data contoh di HP saja.

### Sehari-hari
- **Kantong › Catat** (tab pertama): ketik nominal → keterangan → kategori (ditebak otomatis dari catatan sebelumnya) → kantong → Simpan. Enter di nominal = simpan.
- **Agenda › To-do**: ketik → Enter untuk simpan cepat. **Atur waktu** untuk tanggal/jam → masuk Google Calendar.
- **Ringkasan**: geser bulan, ketuk kategori untuk rincian.
- **Riwayat**: cari keterangan/kategori, ketuk transaksi untuk ubah/hapus.
- Sinkron otomatis (Supabase). Status sinkron manual ada di **Beranda › Pengaturan › Umum**.

---

## Fitur

### Keuangan
- **3 buku**: Riki, Febie (pribadi), Rumah Tangga (bersama). Tiap orang menulis bukunya sendiri + Rumah Tangga, bisa melihat semua. Aturan dijalankan di server.
- **Tipe transaksi**: Pengeluaran, Pemasukan, Transfer antar kantong.
- **Kantong**: Cash, Debit, E-wallet, Kartu Kredit (tagihan & limit). Saldo dihitung otomatis dari transaksi.
- **Kategori**: per buku, warna, bisa dinonaktifkan, pilihan "tidak dihitung" untuk titipan/reimburse. Tebakan kategori dari keterangan.
- **Budget bulanan** per kategori; bulan berikutnya mewarisi otomatis. Kartu "Jatah bulan ini tinggal segini" di Catat.
- **Setoran Rumah Tangga**: transfer pribadi → dompet bersama dihitung sebagai pengeluaran pribadi & pemasukan RT, tidak dobel di tampilan "Semua". Bisa disembunyikan dari grafik.
- **Talangan**: belanja RT yang dibayar pakai uang pribadi tercatat per transaksi; centang yang sudah diganti → **Catat transfer**. Lebih/kurang bayar jadi titipan/utang berjalan.
- **Reimburse kantor**: tandai "akan di-reimburse", tetap dihitung sampai ditandai terbayar; uang masuk dicatat otomatis.
- **Ringkasan**: donut per kategori, pemasukan/pengeluaran/selisih, sisa budget, saldo kantong, rincian per kategori.
- **Riwayat**: per bulan, pencarian, filter "menunggu reimburse". Hapus = soft delete (baris tetap ada di database).

### To-do rumah tangga
- Pemilik: **Riki / Febie / Bersama**. Filter **Untukku** (milikku + bersama), **Bersama**, **Semua**.
- Tambah cepat tanpa waktu, atau **Atur waktu**: tanggal + jam + durasi (default 30 menit) atau **Seharian**.
- Centang selesai (bersama: dicatat siapa yang menyelesaikan), ubah, hapus.
- To-do berwaktu → event di Google Calendar **Rumah Kita** dengan awalan `[R]`/`[F]`/`[B]`, warna per pemilik. Ubah waktu = event pindah; hapus waktu/hapus to-do = event dihapus; selesai = judul event diberi ✓. Sync satu arah (app → kalender).
- Status per baris: Menunggu koneksi · Menyinkronkan… · ikon kalender biru (tersinkron) · merah + **Coba lagi** (gagal).
- Kartu **To-do hari ini** (hari ini + terlewat) di tab Catat.

### Umum
- **Offline-first**: semua input masuk antrean, dikirim saat online. Request ulang tidak menggandakan data/event.
- **Tema** terang/gelap (Beranda › Pengaturan › Umum).
- **Keamanan**: kode akses disimpan sebagai hash; tabel Supabase RLS tanpa policy (hanya Edge Function yang bisa akses).
- **Mode demo** dengan data contoh, tanpa server.

---

## Struktur repo (per fitur)

| Path | Isi |
|---|---|
| `public/index.html` + `public/beranda/` | Beranda: kartu ringkasan + Pengaturan semua fitur (`pengaturan.js`) |
| `public/kantong/` | Kantong: `index.html`, `catat.js`, `transaksi.js`, `laporan.js` (Ringkasan/Riwayat), `atur.js` (kantong, kategori, budget; tampil di Beranda) |
| `public/agenda/` | Agenda: `index.html`, `todo.js` (data, sheet, tab To-do), `agenda.js` (tab Catatan & Jadwal) |
| `public/komitmen/` | Komitmen: kamus kesepakatan berbentuk pasal |
| `public/daily-mood/` | Daily Mood (dulu Ruang Catat): jurnal mood, sinkron ke tabel `jurnal`, SW sendiri. `data.js` dipakai juga oleh Beranda |
| `public/shared/` | Dipakai semua halaman: `core.js` (logika bersama, disalin ke Edge Function), `base.js` (state, API, antrean offline), `ui.js`, `shell.js`, `connect.js`, `demo.js`, `start.js`, `tokens.css`, `styles.css` |
| `supabase/migrations/` | Skema database |
| `supabase/functions/kantong/` | Edge Function: API + adapter Postgres + Google Calendar |
| `kantong/PANDUAN.md` | Panduan pasang & update |
| `kantong/tools/` | `test_core.js`, `test_supabase.js`, `test_sql.sh`, `build_core.js`, `deploy_supabase.js` |

## Update & tes

```bash
node kantong/tools/test_core.js        # 259 cek logika bersama
node kantong/tools/test_supabase.js    # 19 tes Edge Function (DB & Google tiruan)
bash kantong/tools/test_sql.sh         # skema SQL di Postgres lokal
```

- Ubah `public/shared/core.js` → `node kantong/tools/build_core.js` (salinan untuk Edge Function).
- Deploy API: `supabase functions deploy kantong --no-verify-jwt` atau `SUPABASE_ACCESS_TOKEN=sbp_xxx node kantong/tools/deploy_supabase.js serskylzlevhjidqrvjm` (di sesi Claude Code cloud: tanpa token, tambah `NODE_USE_ENV_PROXY=1`).
- PWA: push ke `main`.
