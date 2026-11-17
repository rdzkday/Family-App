# Kantong

Aplikasi keuangan + to-do rumah tangga untuk berdua (Riki & Febie). PWA tanpa build step, backend Supabase.

- **App**: dipasang di HP dari URL Vercel (project `dompet-app`, folder `public/`). Push ke `main` = otomatis rilis.
- **Backend**: Supabase project `serskylzlevhjidqrvjm` (Postgres + Edge Function `kantong`). API: `https://serskylzlevhjidqrvjm.supabase.co/functions/v1/kantong`.
- **Panduan pasang lengkap**: [`kantong/PANDUAN.md`](kantong/PANDUAN.md).

Data keuangan pribadi tidak disertakan di repo ini.

---

## Yang sudah jalan

| Status | Bagian |
|---|---|
| ✅ Live | Database Supabase (8 tabel, RLS, 3 fungsi RPC) |
| ✅ Live | Edge Function `kantong` (API, kode akses per user) |
| ✅ Live | PWA di Vercel: Catat, To-do, Ringkasan, Riwayat, Pengaturan |
| ✅ Live | Offline: catatan tersimpan di HP, dikirim saat online |
| ⏳ Perlu setup sekali | Sync to-do ke Google Calendar "Rumah Kita" (secret belum diisi, PANDUAN §7) |
| ⏳ Perlu dilakukan | Impor data lama dari Google Sheets (PANDUAN §5) |
| 🧪 Dalam pengembangan | Beranda desktop (`beranda.html`): Agenda & Komitmen masih tersimpan di browser saja |

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
4. **Pengaturan → Kantong**: isi saldo tiap kantong sesuai aplikasi bank. **Pengaturan → Budget bulanan**: atur budget.
5. Belum punya kode? Tombol **Coba mode demo** memakai data contoh di HP saja.

### Sehari-hari
- **Catat** (tab pertama): ketik nominal → keterangan → kategori (ditebak otomatis dari catatan sebelumnya) → kantong → Simpan. Enter di nominal = simpan.
- **To-do**: ketik → Enter untuk simpan cepat. **Atur waktu** untuk tanggal/jam → masuk Google Calendar.
- **Ringkasan**: geser bulan, ketuk kategori untuk rincian.
- **Riwayat**: cari keterangan/kategori, ketuk transaksi untuk ubah/hapus.
- Pill **Tersinkron / belum terkirim** di kanan atas: ketuk untuk sinkron sekarang.

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
- **Tema** terang/gelap/ikut HP.
- **Keamanan**: kode akses disimpan sebagai hash; tabel Supabase RLS tanpa policy (hanya Edge Function yang bisa akses).
- **Mode demo** dengan data contoh, tanpa server.

---

## Struktur repo

| Path | Isi |
|---|---|
| `public/` | PWA yang di-deploy. `core.js` = logika bersama (aturan, hitungan, to-do) |
| `public/beranda.html` | Beranda desktop (ringkasan + agenda/komitmen, sebagian masih di browser) |
| `supabase/migrations/` | Skema database |
| `supabase/functions/kantong/` | Edge Function: API + adapter Postgres + Google Calendar |
| `kantong/PANDUAN.md` | Panduan pasang & update |
| `kantong/tools/` | `test_core.js`, `test_supabase.js`, `test_sql.sh`, `build_core.js`, `deploy_supabase.js` |
| `kantong/apps-script/` | Backend lama (Google Sheets), masih kompatibel, tidak dikembangkan |
| `kantong-pastel/`, `public/dark/` | Varian tampilan lama |

## Update & tes

```bash
node kantong/tools/test_core.js        # 159 cek logika bersama
node kantong/tools/test_supabase.js    # 18 tes Edge Function (DB & Google tiruan)
bash kantong/tools/test_sql.sh         # skema SQL di Postgres lokal
```

- Ubah `public/core.js` → `node kantong/tools/build_core.js` (salinan untuk Edge Function & Apps Script).
- Deploy API: `supabase functions deploy kantong --no-verify-jwt` atau `SUPABASE_ACCESS_TOKEN=sbp_xxx node kantong/tools/deploy_supabase.js serskylzlevhjidqrvjm`.
- PWA: push ke `main`.
