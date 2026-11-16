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

Ini membuat tabel `buku, users, kategori, kantong, budget, transaksi, todo, momen, akses` beserta fungsi `kantong_muat`, `kantong_simpan`, `kantong_buat_kode`. Migrasi kedua (`20261117000000_agenda_momen.sql`) juga mengganti id user `istri` menjadi `febie` (id buku `istri` tetap). Semua tabel memakai RLS tanpa policy: hanya Edge Function (service role) yang bisa membaca/menulis.

Alternatif tanpa CLI: buka **SQL Editor**, tempel isi `supabase/migrations/20261116000000_kantong.sql`, **Run**; lalu ulangi untuk `20261117000000_agenda_momen.sql`.

Nama `Istri` otomatis jadi `Febie`. Kolom `id` jangan diubah manual.

## 3. Deploy API (5 menit)

```bash
supabase functions deploy kantong --no-verify-jwt
```

`--no-verify-jwt` wajib: autentikasi memakai **kode akses** di body request, bukan JWT Supabase. Tanpa kode akses yang cocok, server menolak.

URL API: `https://<PROJECT_ID>.supabase.co/functions/v1/kantong`. Buka di browser, harus muncul `{"ok":true,"app":"Kantong API","backend":"supabase"}`.

## 4. Buat kode koneksi (2 menit)

Di **SQL Editor**, jalankan satu per satu (ganti `<PROJECT_ID>`):

```sql
select kantong_buat_kode('riki',  'https://<PROJECT_ID>.supabase.co/functions/v1/kantong');
select kantong_buat_kode('febie', 'https://<PROJECT_ID>.supabase.co/functions/v1/kantong');
```

Hasilnya adalah kode koneksi (teks panjang) untuk masing-masing. Kirim lewat chat pribadi, jangan dibagikan ke orang lain. Yang disimpan di database hanya hash-nya. Menjalankan ulang perintah ini = kode lama langsung mati (berguna kalau HP hilang).

## 5. Pindahkan data dari Google Sheets (10 menit, kalau ada)

Nama tabel dan kolom di Supabase sama dengan tab di Sheet, hanya huruf kecil.

1. Di Google Sheets: tiap tab → **File → Download → CSV**.
2. Supabase **Table Editor** → pilih tabel → **Insert → Import data from CSV** → pilih file. Urutan: `buku`, `users`, `kategori`, `kantong`, `budget`, `transaksi`, `todo`.
3. Kalau baris `riki`/`febie`/`rt` sudah ada dari langkah 2, lewati baris itu atau hapus dulu. Data lama yang masih memakai `istri` sebagai user: jalankan ulang `20261117000000_agenda_momen.sql` setelah impor (aman diulang).

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
4. Google Calendar → Settings → **Rumah Kita → Share with specific people** → tambahkan email service account, izin **Make changes to events**. Tambahkan juga email Google pasangan dengan izin yang sama.
5. Di halaman yang sama, bagian **Integrate calendar**, salin **Calendar ID**.
6. Simpan secret ke Edge Function:

```bash
supabase secrets set TODO_CAL_ID='<Calendar ID>'
supabase secrets set GOOGLE_SA_JSON="$(cat kantong-xxxx.json)"
```

7. Pengingat event ikut setelan kalender ini (Settings → Rumah Kita → Event notifications). Atur sekali, berlaku untuk semua to-do.

Aturan yang dijalankan server:

| | To-do Riki | To-do Febie | Bersama |
|---|---|---|---|
| Riki | tulis + centang | lihat | tulis + centang |
| Febie | lihat | tulis + centang | tulis + centang |

- Judul event diberi awalan `[R]`, `[F]` (inisial nama di tabel `users`), atau `[B]` untuk bersama; warnanya berbeda per pemilik.
- Ubah waktu → event pindah. Hapus waktu → event dihapus, to-do tetap. Hapus to-do → event ikut dihapus.
- Centang selesai → event dibiarkan, judulnya diberi tanda ✓. Mau event dihapus saat dicentang? Ganti `TODO_SELESAI_EVENT` di `public/core.js` menjadi `'hapus'`, lalu `node kantong/tools/build_core.js` dan deploy ulang.
- Sync satu arah: app → kalender. Mengubah event langsung di Google Calendar **tidak** kembali ke app.
- Offline: to-do tersimpan di HP, dikirim saat online lagi; request ulang tidak membuat event dobel.
- Gagal masuk kalender (secret belum diisi, kalender belum di-share): to-do tetap tersimpan, barisnya merah dengan tombol **Coba lagi**.

## 8. Agenda & Momen (setelah update ini)

Agenda = kalender bulanan berisi to-do (termasuk riwayat lama) dan **Momen** (tanggal penting). Data tetap di project Kantong.

1. Skema: `supabase db push` (menjalankan `20261117000000_agenda_momen.sql`). Kode koneksi Febie tetap berlaku walau id-nya berganti ke `febie`.
2. API: `supabase functions deploy kantong --no-verify-jwt`.
3. PWA: push ke `main`.

Urutan aman: skema dulu, lalu API. Selama API belum diperbarui, to-do tetap tersimpan (kolom baru boleh kosong); Agenda menampilkan catatan "backend perlu diperbarui" dan menyembunyikan tombol Momen.

- Momen bisa satu hari atau rentang (maks 62 hari). Riki & Febie bisa membuat dan mengubah semua momen.
- **Ingatkan tiap tahun** = event seharian berulang tiap tahun di kalender "Rumah Kita" (29 Feb → hari terakhir Februari). Momen biasa tidak masuk kalender.
- **Pengingat H-1**: event dibuat oleh service account, jadi pengingatnya ikut setelan masing-masing orang. Riki dan Febie atur sekali di Google Calendar: Settings → **Rumah Kita** → **All-day event notifications** → *1 day before*. (Pengingat ini juga berlaku untuk to-do seharian.)
- Kartu "N tahun lalu hari ini" muncul di halaman Catat untuk semua momen; **Tutup** = sembunyi sampai besok.
- Backend lama (Apps Script): tempel `Core.gs` + `Code.gs` baru, deploy versi baru, lalu menu **Kantong → Ganti id user istri → febie (sekali)**. Momen tahunan di versi ini hanya dibuat di hari pertama rentang.

## 9. Siklus (project Supabase TERPISAH di akun Febie, ±20 menit)

Data siklus tidak pernah masuk project Kantong. Project dibuat di **akun Febie**, jadi hanya Febie yang bisa membuka dashboard dan tabelnya.

| | Jadwal (tanggal & perkiraan) | Catatan |
|---|---|---|
| Febie (pemilik) | tulis + baca | tulis + baca |
| Riki (pembaca) | baca, setelah Febie mengaktifkan | baca **hanya** kalau Febie menyalakan "Bagikan catatan" |
| Lainnya | tidak ada | tidak ada |

Aturan dijalankan server (fungsi `siklus_*`, dites di `kantong/tools/test_siklus_sql.sh`): data yang tidak boleh dilihat Riki tidak pernah dikirim ke HP-nya.

1. Login supabase.com **dengan akun Febie** → **New project** (region Singapore).
2. **SQL Editor** → tempel isi `supabase-siklus/migrations/20261117000000_siklus.sql` → **Run**.
3. **Authentication → Sign In / Providers**: matikan *Allow new users to sign up*. Email provider tetap aktif.
4. **Authentication → Email Templates → Magic Link**: ganti isi template supaya memuat kode, mis. `Kode masuk Siklus: {{ .Token }}`. (Tanpa `{{ .Token }}` yang terkirim cuma link, dan link di iPhone terbuka di Safari, bukan di app.)
5. **Authentication → Users → Add user**: email Febie dan email Riki (centang *Auto Confirm User*).
6. **SQL Editor**:
   ```sql
   select siklus_atur_anggota('email-febie@…', 'pemilik');
   select siklus_atur_anggota('email-riki@…', 'pembaca');
   ```
7. **Project Settings → API**: salin *Project URL* dan *anon public key* ke `public/siklus-config.js`, lalu push ke `main`. Anon key memang publik; data dijaga login + fungsi server.
8. Ping harian supaya project gratis tidak di-pause (Supabase gratis di-pause setelah 1 minggu tanpa aktivitas): tempel `kantong/apps-script/SiklusPing.gs` ke project Apps Script, isi Script Properties `SIKLUS_URL` & `SIKLUS_ANON`, jalankan `pasangPingSiklus()` sekali.

Di app:
- Febie: kartu **Ada yang baru** di Catat → pengenalan 8 layar → setuju → masuk dengan kode email → pilih bagikan catatan → isi catatan awal (opsional).
- Riki: **Pengaturan → Siklus → Masuk untuk lihat jadwal** (kode email sekali).
- Perkiraan tidak disimpan; dihitung di HP: hari pertama terakhir + rata-rata 6 jarak terakhir (kurang dari 2 catatan = 28 hari, "perkiraan kasar"), tampil sebagai rentang ±2 hari. Jarak di luar 21–35 hari → app bertanya "Ada yang terlewat?".
- Febie bisa **Unduh cadangan (JSON)** dan **Hapus semua catatan** (persetujuan ikut ditarik) di Pengaturan → Siklus. Supabase gratis tidak punya backup otomatis, jadi unduh cadangan sesekali.

---

## Aturan akses

| | Buku Riki | Buku Febie | Rumah Tangga |
|---|---|---|---|
| Riki | tulis + baca | baca | tulis + baca |
| Febie | baca | tulis + baca | tulis + baca |

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
node kantong/tools/test_siklus.js      # perhitungan perkiraan Siklus
bash kantong/tools/test_siklus_sql.sh  # aturan akses Siklus (auth tiruan) di Postgres lokal
```

## Darurat

- **HP hilang**: jalankan lagi `select kantong_buat_kode('riki', '…')`. Kode lama langsung mati.
- **Salah input massal**: transaksi yang dihapus dari app tidak benar-benar hilang (kolom `dihapus` terisi). Supabase juga menyimpan backup harian (Database → Backups).
- **Cek log API**: Supabase → Edge Functions → kantong → Logs.

## Versi lama (Google Sheets + Apps Script)

Masih ada di `kantong/apps-script/` dan tetap kompatibel dengan PWA (kode koneksi lama tetap bisa dipakai). Tidak dikembangkan lagi; panduan lamanya ada di riwayat git.
