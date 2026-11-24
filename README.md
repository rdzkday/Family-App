# Family App

Aplikasi keuangan + to-do rumah tangga untuk berdua (Riki & Febie). PWA tanpa build step, backend Supabase.

- **App**: dipasang di HP dari URL Vercel (project `dompet-app`, folder `public/`). Push ke `main` = otomatis rilis.
- **Backend**: Supabase project `serskylzlevhjidqrvjm` (Postgres + Edge Function `kantong`). API: `https://serskylzlevhjidqrvjm.supabase.co/functions/v1/kantong`.
- **Panduan pasang lengkap**: [`kantong/PANDUAN.md`](kantong/PANDUAN.md).

Data keuangan pribadi tidak disertakan di repo ini.

---

## Fitur aktif — versi terbaru (v1.8.0 · 17 Nov 2026)

| Status | Fitur | Bisa apa |
|---|---|---|
| ✅ Live | **Beranda** (`/`) | Sapaan + status sinkron, pintasan ke semua fitur, ringkasan Kantong (sisa dompet RT, budget terpakai, saldo pribadi, 3 transaksi terakhir), catat transaksi cepat, to-do & catatan + tambah cepat, pengingat evaluasi bulanan, pilih mood → lanjut ke Daily Mood |
| ✅ Live | **Pengaturan** (`/pengaturan/`, akses dari ikon gear di Beranda) | Halaman sendiri, expand-collapse per fitur, tombol kembali ke Beranda di kanan atas: Umum (tema, akun, sinkron, putuskan koneksi) · Kantong (budget, kantong, kategori, setoran di grafik) · Agenda (filter awal, status Google Calendar, jadwalkan evaluasi) · Komitmen · Daily Mood (profil, kondisi, prompt, cadangan) |
| ✅ Live | **Kantong** (`/kantong/`) | Catat pengeluaran/pemasukan/transfer, 3 buku (Riki, Febie, Rumah Tangga), budget bulanan, talangan, reimburse, Ringkasan (donut per kategori), Riwayat + pencarian |
| ✅ Live | **Agenda** (`/agenda/`) | Tab **To-do** (tanpa waktu, tercatat tanggal dibuat), **Catatan**, **Kalender** (grid bulan + agenda terdekat; agenda = tanggal-jam-durasi, masuk Google Calendar). Pemilik Riki/Febie/Bersama, filter Untukku/Bersama/Semua |
| ✅ Live | **Siklus** (lapisan di Kalender Agenda + kartu Beranda + Pengaturan › Siklus) | Catatan haid Febie: mulai/selesai/catatan, perkiraan berikutnya (rata-rata 6 jarak terakhir, ±2 hari). Mati secara default; Febie setuju teks privasi lalu memilih bagikan jadwal (default ya) & catatan (default tidak) ke Riki. Tiap orang bisa menampilkan/menyembunyikan Siklus untuk dirinya sendiri. Aturan dijalankan di server |
| ✅ Live | **Komitmen** (`/komitmen/`) | Baca & cari pasal (Kesepakatan + Definisi A–Z), filter (pranikah, usulan, dicabut). Usul **pasal baru, ubah, cabut, keterangan** (baru/ganti/cabut) → **Lembar Pengesahan** (sebelum vs sesudah + alasan) → **tanda tangan dengan jari** berdua → berlaku. "Diskusikan dulu" menunda item; isi lembar berubah = TTD batal. Riwayat versi per pasal. Pasal pranikah hanya bisa diberi keterangan |
| ✅ Live | **Daily Mood** (`/daily-mood/`, dulu Ruang Catat) | Jurnal mood harian + prompt (acak/custom), kalender mood, ringkasan periode → unduh/bagikan PDF, cadangan & pulihkan. Data pribadi di Supabase (pasangan tidak bisa baca) |
| 🆕 Perlu migrasi + deploy | **Couple Journaling** (Daily Mood › tab **Berdua**) | Evaluasi harian (3 tap), check-in mingguan terpandu (timer 30 menit, satu topik per layar, fakta → dampak → permintaan, rangkum ulang, tindakan + PIC), review bulanan (rekap tren, fokus bulan depan, keputusan target, perlu konselor?). Target personal dinilai diri + pasangan → Selaras / Hampir selaras / Perlu dibicarakan (otomatis masuk agenda). Editor pertanyaan draft → preview → persetujuan → publish (berlaku periode berikutnya) + riwayat versi. Pohon tumbuh bersama, streak per minggu, lencana proses, ekspor PDF/teks untuk konselor, tautan Healing119 & 112. Aktif hanya kalau kedua pasangan setuju. Brief: [`claude/couple-journaling-brief.md`](claude/couple-journaling-brief.md) |
| ✅ Live | **Offline & sinkron** | Input masuk antrean di HP, terkirim otomatis saat online, tanpa data dobel |
| ✅ Live | **Fitur modular** | Admin menyalakan/mematikan Kantong, Agenda, Komitmen, Daily Mood di Panel Admin › Fitur. Menu, Beranda, dan Pengaturan menyesuaikan; server menolak aksi fitur yang mati |
| ✅ Live | **Tema & mode demo** | Gelap/terang berlaku di semua fitur. Mode demo mulai kosong, data hanya di HP |
| ⏳ Perlu setup sekali | **Google Calendar "Rumah Kita"** | Sync to-do berwaktu ke kalender. Secret Google belum diisi di Supabase (PANDUAN §7) |
| 🔜 Menyusul | Komitmen | Sesi evaluasi bulanan (Fase 4d) & import perjanjian pranikah (Fase 4c, menunggu file) |

### Yang baru di rilis ini (v1.8.0)
- **Fitur modular:** admin memilih fitur aktif (Panel Admin › Fitur). Bisa dipakai hanya untuk keuangan, tanpa fitur lain.
- **Satu navigasi:** semua fitur (termasuk Daily Mood & Komitmen) memakai menu bawah & header yang sama. Daily Mood tidak lagi jadi app terpisah (manifest & service worker ikut app utama).
- **Bersih saat pertama dibuka:** data contoh dihapus dari mode demo dan dari database (pasal Komitmen contoh).
- Backend: migrasi `20261121100000_fitur.sql` (tabel `app_setting`), Edge Function `kantong` v32.

### Rilis sebelumnya (v1.7.0)
- **Siklus**: kalender haid untuk Febie, tampil di Kalender Agenda. Bisa ditampilkan/disembunyikan oleh Febie maupun Riki (chip "Siklus" di kalender atau Pengaturan › Siklus). Tabel `siklus` + `siklus_atur`, migrasi `20261121000000_siklus.sql`.
- **Agenda › Kalender** menggantikan tab Jadwal: grid bulan (titik biru = agenda), tap tanggal untuk detail, daftar agenda terdekat.
- **To-do tanpa atur waktu**: cukup tampil "Dibuat …". Yang butuh tanggal & jam dibuat sebagai **Agenda** (to-do lama yang sudah berwaktu otomatis pindah ke Kalender).
- Beranda: kartu **Agenda terdekat** dan **Siklus**.
- Backend dirapikan: fungsi trigger `kantong_admin_tandai` diberi `search_path` tetap & dicabut dari anon/authenticated (peringatan Security Advisor).

### v1.6.0
- **Komitmen Fase 4b:** ubah & cabut pasal, keterangan, Lembar Pengesahan, tanda tangan berdua, Diskusikan dulu, Riwayat.
- Nama app jadi **Family App** (fitur keuangan tetap bernama Kantong).
- Pengaturan semua fitur pindah ke Beranda (expand-collapse); tab Pengaturan Kantong & halaman Setelan dihapus.
- Agenda jadi halaman sendiri; Ruang Catat jadi **Daily Mood** dan sinkron ke Supabase.
- Komitmen: usul & tarik pasal baru.
- Repo dirapikan per fitur; file redundan dihapus (config Cloudflare, font duplikat).
- Backend: database 4 migrasi terpasang, Edge Function `kantong` v14.

---

## Setup login & admin panel (sekali saja)

1. **Jalankan migrasi** — Supabase › SQL Editor › tempel & Run isi file berurutan:
   - `supabase/migrations/20261119000000_login.sql`
   - `supabase/migrations/20261119100000_admin.sql`
   - `supabase/migrations/20261120000000_ganti_password.sql`
2. **Deploy Edge Function** `kantong` (terminal, di folder repo):
   ```bash
   supabase functions deploy kantong --no-verify-jwt --project-ref serskylzlevhjidqrvjm
   ```
3. **Buat akun admin pertama** (SQL Editor):
   ```sql
   select kantong_atur_login('riki', 'riki', 'password-kuat-min-8');
   update login set admin = true where user_id = 'riki';
   ```
4. **Merge branch ke `main`** → Vercel rilis otomatis.
5. **Buka admin panel** `https://<url-vercel>/admin/` → masuk dengan akun admin.
6. **Buat akun Febie** di panel: Buat login (baris Febie) → isi username → Simpan → salin password yang muncul → kirim ke Febie lewat jalur pribadi.
7. **Login di HP**: buka app → isi username + password → Masuk.

### Admin panel (`/admin/`)
- Tambah akun (user baru otomatis dapat buku pribadi), ubah nama/username, aktif/nonaktif, jadikan admin.
- **Reset password** (user lupa) → password **sementara** acak 12 karakter, tampil sekali, semua HP user itu keluar. Saat login, user **wajib membuat password baru sendiri** — admin tidak pernah tahu password user.
- User bisa ganti password kapan saja: **Beranda › Pengaturan › Umum › Ubah password** (perangkat lain otomatis keluar).
- Keluarkan semua HP, hapus login (data keuangan tetap aman).
- Pengaman: admin tidak bisa menonaktifkan/menghapus akunnya sendiri; non-admin ditolak server.

## Cara pakai

### Pertama kali
1. Buka URL app di HP → **Install app** (Android: menu ⋮; iPhone: Share → Add to Home Screen).
2. Buka app dari home screen → isi **username + password** → **Masuk**.
3. Akun dibuat admin di Supabase **SQL Editor** (password min. 8 karakter, di-hash bcrypt):
   ```sql
   select kantong_atur_login('riki',  'riki',  'password-rahasia');
   select kantong_atur_login('istri', 'febie', 'password-rahasia');
   ```
   Menjalankan ulang = ganti password + semua perangkat user itu otomatis keluar (dipakai kalau HP hilang). 5x salah password = akun terkunci 15 menit.
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
- **Mode demo** tanpa server, mulai kosong (hanya buku, kategori, kantong bersaldo 0).

### Fitur modular
- Daftar fitur: `kantong`, `agenda`, `komitmen`, `mood`. Beranda & Pengaturan selalu ada.
- Setelan disimpan di tabel `app_setting` (kunci `fitur`), diubah lewat **Panel Admin › Fitur**, dikirim ke app lewat `bootstrap`.
- **Server**: `FITUR` di `shared/core.js` memetakan aksi ke fitur (mis. `tx.*` → kantong). Aksi fitur yang mati ditolak: "Fitur X tidak aktif".
- **App**: registry `shared/fitur.js` jadi satu sumber untuk menu bawah, pintasan & kartu Beranda, bagian Pengaturan, dan penjaga halaman.
- Menambah fitur baru: daftarkan di `FITUR` (core.js) + `DAFTAR` (fitur.js) + daftar id di migrasi, lalu halaman fitur memanggil `daftarHalaman()` (tab) atau `Fitur.jaga()` (halaman mandiri).

---

## Struktur repo (per fitur)

| Path | Isi |
|---|---|
| `public/index.html` + `public/beranda/` | Beranda: kartu ringkasan + Pengaturan semua fitur (`pengaturan.js`) |
| `public/kantong/` | Kantong: `index.html`, `catat.js`, `transaksi.js`, `laporan.js` (Ringkasan/Riwayat), `atur.js` (kantong, kategori, budget; tampil di Beranda) |
| `public/agenda/` | Agenda: `index.html`, `todo.js` (data, sheet, tab To-do), `agenda.js` (tab Catatan & Kalender), `siklus.js` (lapisan Siklus, Pengaturan › Siklus, kartu Beranda) |
| `public/komitmen/` | Komitmen: kamus kesepakatan berbentuk pasal |
| `public/daily-mood/` | Daily Mood (dulu Ruang Catat): jurnal mood, sinkron ke tabel `jurnal`. `data.js` dipakai juga oleh Pengaturan. `berdua.js` + `berdua.css` = Couple Journaling (tab Berdua, tabel `jurnal_pasangan`, aksi `cj.*`) |
| `public/shared/` | Dipakai semua halaman: `fitur.js` (registry fitur & menu), `core.js` (logika bersama, disalin ke Edge Function), `base.js` (state, API, antrean offline, registry halaman), `ui.js`, `shell.js` (shell + tab), `connect.js`, `demo.js`, `start.js`, `tokens.css`, `styles.css`, `nav.css` |
| `supabase/migrations/` | Skema database |
| `supabase/functions/kantong/` | Edge Function: API + adapter Postgres + Google Calendar |
| `kantong/PANDUAN.md` | Panduan pasang & update |
| `kantong/tools/` | `test_core.js`, `test_supabase.js`, `test_sql.sh`, `build_core.js`, `deploy_supabase.js` |

## Update & tes

```bash
node kantong/tools/test_core.js        # 398 cek logika bersama
node kantong/tools/test_siklus.js      # 75 cek Siklus: perkiraan + aturan privasi
node kantong/tools/test_cj.js          # 74 cek Couple Journaling: periode, kesimpulan, privasi, persetujuan
node kantong/tools/test_supabase.js    # 25 tes Edge Function (DB & Google tiruan)
bash kantong/tools/test_sql.sh         # skema SQL di Postgres lokal
```

- Ubah `public/shared/core.js` → `node kantong/tools/build_core.js` (salinan untuk Edge Function).
- Deploy API: `supabase functions deploy kantong --no-verify-jwt` atau `SUPABASE_ACCESS_TOKEN=sbp_xxx node kantong/tools/deploy_supabase.js serskylzlevhjidqrvjm` (di sesi Claude Code cloud: tanpa token, tambah `NODE_USE_ENV_PROXY=1`).
- PWA: push ke `main`.
