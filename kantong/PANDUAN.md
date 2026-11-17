# Kantong: panduan pasang (Supabase)

Backend memakai **Supabase** (Postgres + Edge Function). Logika bisnis ada di `public/core.js`, jadi aturan akses, hitungan, dan to-do sama persis dengan versi Google Sheets sebelumnya. Total sekitar 30 menit, cukup sekali.

| Folder/file | Fungsinya |
|---|---|
| `public/` | PWA. Di-deploy ke Vercel (push ke `main`). Tidak berisi data keuangan. |
| `supabase/migrations/` | Skema database: tabel, kode akses, fungsi RPC |
| `supabase/functions/kantong/` | Edge Function: API untuk PWA + sync to-do ke Google Calendar |
| `kantong/apps-script/` | Backend lama (Google Sheets). Masih bisa dipakai, tidak dikembangkan lagi |
| `kantong/tools/` | Tes & alat bantu (`build_core.js`, `test_core.js`, `test_supabase.js`, `test_sql.sh`) |

Butuh di laptop: [Supabase CLI](https://supabase.com/docs/guides/cli) dan Node.

---

## 1. Buat project Supabase (5 menit)

1. supabase.com → **New project**. Region pilih **Singapore** (paling dekat Jakarta). Simpan **database password**.
2. **Project Settings → General**: salin **Project ID** (reference id).

## 2. Pasang skema (5 menit)

Di folder repo:

```bash
supabase login
supabase link --project-ref <PROJECT_ID>
supabase db push
```

Ini membuat tabel `buku, users, kategori, kantong, budget, transaksi, todo, akses` beserta fungsi `kantong_muat`, `kantong_simpan`, `kantong_buat_kode`. Semua tabel memakai RLS tanpa policy: hanya Edge Function (service role) yang bisa membaca/menulis.

Alternatif tanpa CLI: buka **SQL Editor**, tempel isi tiap file di `supabase/migrations/` **berurutan** (`20261116…_kantong.sql`, lalu `20261117…_beranda.sql`), **Run**.

Migrasi Beranda (`20261117…`) hanya menambah: kolom `tipe` & `isi` di `todo` (catatan, agenda evaluasi), tabel `komitmen` dan `jurnal` (Ruang Catat). Data lama aman.

Lalu di **Table Editor → users** dan **buku**: ganti nama `Istri` sesuai nama pasangan. Kolom `id` jangan diubah.

## 3. Deploy API (5 menit)

```bash
supabase functions deploy kantong --no-verify-jwt
```

`--no-verify-jwt` wajib: autentikasi memakai **kode akses** di body request, bukan JWT Supabase. Tanpa kode akses yang cocok, server menolak.

Tanpa Supabase CLI: buat token di supabase.com → Account → **Access Tokens**, lalu

```bash
SUPABASE_ACCESS_TOKEN=sbp_xxx node kantong/tools/deploy_supabase.js <PROJECT_ID>
```

URL API: `https://<PROJECT_ID>.supabase.co/functions/v1/kantong`. Buka di browser, harus muncul `{"ok":true,"app":"Kantong API","backend":"supabase"}`.

## 4. Buat kode koneksi (2 menit)

Di **SQL Editor**, jalankan satu per satu (ganti `<PROJECT_ID>`):

```sql
select kantong_buat_kode('riki',  'https://<PROJECT_ID>.supabase.co/functions/v1/kantong');
select kantong_buat_kode('istri', 'https://<PROJECT_ID>.supabase.co/functions/v1/kantong');
```

Hasilnya adalah kode koneksi (teks panjang) untuk masing-masing. Kirim lewat chat pribadi, jangan dibagikan ke orang lain. Yang disimpan di database hanya hash-nya. Menjalankan ulang perintah ini = kode lama langsung mati (berguna kalau HP hilang).

## 5. Pindahkan data dari Google Sheets (10 menit, kalau ada)

Nama tabel dan kolom di Supabase sama dengan tab di Sheet, hanya huruf kecil.

1. Di Google Sheets: tiap tab → **File → Download → CSV**.
2. Supabase **Table Editor** → pilih tabel → **Insert → Import data from CSV** → pilih file. Urutan: `buku`, `users`, `kategori`, `kantong`, `budget`, `transaksi`, `todo`.
3. Kalau baris `riki`/`istri`/`rt` sudah ada dari langkah 2, lewati baris itu atau hapus dulu.

Cek: buka app, saldo kantong & ringkasan bulan lalu harus sama dengan versi Sheets.

## 6. Hosting PWA & pasang di HP

PWA di-host di Vercel (`public/`, lihat `vercel.json`). Push ke `main` = otomatis rilis.

- **Android (Chrome)**: buka URL → ⋮ → **Install app**.
- **iPhone (Safari)**: buka URL → Share → **Add to Home Screen**. Tempel kode **setelah** app dibuka dari home screen.

Buka app dari home screen → tempel **kode koneksi** → **Hubungkan**.

## 7. To-do + Google Calendar "Rumah Kita" (10 menit, opsional)

To-do yang **punya waktu** otomatis masuk ke satu kalender khusus bernama **Rumah Kita**. Tanpa waktu = hanya di app. Server memakai **service account** Google, jadi tidak perlu login Google per orang.

1. Google Calendar web → ⚙ **Settings → Add calendar → Create new calendar** → nama `Rumah Kita`.
2. console.cloud.google.com → project baru (mis. `kantong`) → **APIs & Services → Enable APIs** → aktifkan **Google Calendar API**.
3. **IAM & Admin → Service Accounts → Create** (nama `kantong`) → tab **Keys → Add key → JSON**. File JSON terunduh; salin alamat email service account-nya (`kantong@….iam.gserviceaccount.com`).
4. Google Calendar → Settings → **Rumah Kita → Share with specific people** → tambahkan email service account, izin **Make changes to events**. Tambahkan juga **semua** email Google yang perlu melihat kalender (boleh lebih dari satu per orang, mis. email pribadi & kantor Febie) dengan izin yang sama.
5. Di halaman yang sama, bagian **Integrate calendar**, salin **Calendar ID**.
6. Simpan secret ke Edge Function:

```bash
supabase secrets set TODO_CAL_ID='<Calendar ID>'
supabase secrets set GOOGLE_SA_JSON="$(cat kantong-xxxx.json)"
```

7. Pengingat event ikut setelan kalender ini (Settings → Rumah Kita → Event notifications). Atur sekali, berlaku untuk semua to-do.

Aturan yang dijalankan server:

| | To-do Riki | To-do Istri | Bersama |
|---|---|---|---|
| Riki | tulis + centang | lihat | tulis + centang |
| Istri | lihat | tulis + centang | tulis + centang |

- Judul event diberi awalan `[R]`, `[F]` (inisial nama di tabel `users`), atau `[B]` untuk bersama; warnanya berbeda per pemilik.
- Ubah waktu → event pindah. Hapus waktu → event dihapus, to-do tetap. Hapus to-do → event ikut dihapus.
- Centang selesai → event dibiarkan, judulnya diberi tanda ✓. Mau event dihapus saat dicentang? Ganti `TODO_SELESAI_EVENT` di `public/core.js` menjadi `'hapus'`, lalu `node kantong/tools/build_core.js` dan deploy ulang.
- Sync satu arah: app → kalender. Mengubah event langsung di Google Calendar **tidak** kembali ke app.
- Offline: to-do tersimpan di HP, dikirim saat online lagi; request ulang tidak membuat event dobel.
- Gagal masuk kalender (secret belum diisi, kalender belum di-share): to-do tetap tersimpan, barisnya merah dengan tombol **Coba lagi**.

---

## Beranda, Komitmen, Ruang Catat

| Halaman | URL | Isi |
|---|---|---|
| Beranda | `/` | Ringkasan Kantong, pengingat evaluasi, to-do & catatan, mood |
| Kantong | `/kantong.html` (`#todo` = tab To-do) | App keuangan lengkap, sama seperti sebelumnya |
| Ruang Catat | `/ruang-catat/?mood=…` | Jurnal harian + mood, **pribadi** (pasangan tidak bisa baca) |

- **Catatan**: tidak punya centang, tidak pernah masuk kalender. Bisa pribadi atau Bersama.
- **Evaluasi bulanan**: dijadwalkan dari Beranda → Komitmen → **Jadwalkan evaluasi**. Ini agenda (to-do bertipe evaluasi) yang masuk Google Calendar. Kartu pengingat muncul di Beranda mulai 6 jam sebelumnya; **Ingatkan nanti** = sembunyi 1 jam.
- **Komitmen**: dua-duanya boleh tulis. Berlaku sampai diganti; yang diganti pindah ke Riwayat.


| | Buku Riki | Buku Istri | Rumah Tangga |
|---|---|---|---|
| Riki | tulis + baca | baca | tulis + baca |
| Istri | baca | tulis + baca | tulis + baca |

Aturan ini dijalankan di server (`core.js` di Edge Function), bukan cuma di tampilan.

## Cara update nanti

- **Logika (`public/core.js`)**: ubah, lalu `node kantong/tools/build_core.js` supaya salinan untuk Edge Function (`core.mjs`) dan Apps Script (`Core.gs`) ikut. `node kantong/tools/test_core.js` menolak kalau salinan tidak sinkron.
- **API**: `supabase functions deploy kantong --no-verify-jwt`. URL tidak berubah, kode koneksi tetap berlaku.
- **Skema**: tambah file di `supabase/migrations/`, lalu `supabase db push`.
- **PWA**: push ke `main`. HP otomatis memuat versi baru saat online.

## Tes

```bash
node kantong/tools/test_core.js        # logika bersama (tanpa data asli)
node kantong/tools/test_supabase.js    # Edge Function dengan database & Google tiruan
bash kantong/tools/test_sql.sh         # skema SQL di Postgres lokal (Ubuntu: butuh paket postgresql)
```

## Darurat

- **HP hilang**: jalankan lagi `select kantong_buat_kode('riki', '…')`. Kode lama langsung mati.
- **Salah input massal**: transaksi yang dihapus dari app tidak benar-benar hilang (kolom `dihapus` terisi). Supabase juga menyimpan backup harian (Database → Backups).
- **Cek log API**: Supabase → Edge Functions → kantong → Logs.

## Versi lama (Google Sheets + Apps Script)

Masih ada di `kantong/apps-script/` dan tetap kompatibel dengan PWA (kode koneksi lama tetap bisa dipakai). Tidak dikembangkan lagi; panduan lamanya ada di riwayat git.
