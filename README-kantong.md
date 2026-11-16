# Kantong: catatan keuangan keluarga (PWA + Google Sheets)

- `kantong/`: versi dark mode. Panduan pasang ada di `kantong/PANDUAN.md`.
- `kantong-pastel/`: versi pastel dengan mode terang dan gelap (front-end saja, backend sama dengan `kantong/apps-script`).

Data keuangan pribadi tidak disertakan di repo ini.

Hosting: Vercel (project `dompet-app`, folder `public/`, setting di `vercel.json`). Push ke `main` = otomatis rilis.

---

## Rencana fitur: Agenda + Momen + Siklus

Status: **perencanaan**, keputusan dikunci 16 Nov 2026. Brief v1: Riki (UI/UX). Pengguna: Riki & Febie.

| Lapisan | Isi | Warna |
|---|---|---|
| To-do | To-do berwaktu + riwayatnya | `#93C5FD` |
| Momen | Tanggal penting (satu hari atau rentang) | `#FDBA74` (usulan) |
| Siklus | Catatan siklus + perkiraan, hanya kalau Febie mengaktifkan | `#F9A8D4` (usulan), perkiraan = garis putus-putus |

### Kondisi kode saat ini

- Tab `Todo` baru ada di branch `claude/gallant-clarke-kiuupp`, belum di `main`. Di `main`, to-do Beranda masih tersimpan di browser (`public/beranda.js`).
- To-do hanya punya `selesai` (ya/tidak), tanpa tanggal selesai.
- To-do selesai > 30 hari tidak dikirim ke app (`TODO_SIMPAN_SELESAI_HARI`). `agenda.month` harus ambil per bulan tanpa batas ini.
- ID user Febie di data masih `istri`.
- Apps Script jalan sebagai akun Riki (`executeAs: USER_DEPLOYING`), jadi Sheet milik Riki.
- Onboarding sekarang hanya tempel kode koneksi (`public/app.js`, bagian connect).

### Keputusan

⭐ = rekomendasi. Di file `.md` GitHub checkbox hanya tampilan; ubah pilihan dengan edit `[ ]` ↔ `[x]`.

#### Fase A: Agenda

**1. To-do tanpa jam tampil di tanggal mana?**
- [x] Belum selesai → tanggal dibuat; selesai → tanggal selesai ⭐
- [ ] Selalu tanggal dibuat
- [ ] Selalu tanggal selesai

Dampak: kolom baru `selesai_at` di tab `Todo`. To-do lama yang sudah selesai pakai tanggal dibuat.

**2. Branch to-do & data lama di browser**
- [x] Merge `claude/gallant-clarke-kiuupp`, pindahkan to-do yang belum selesai ⭐
- [ ] Merge, pindahkan semua
- [ ] Merge, buang data lama

**3. Posisi Agenda di menu bawah**
- [x] Ganti tab To-do jadi Agenda (Daftar | Kalender), tetap 5 tab ⭐
- [ ] Tab ke-6
- [ ] Hanya dari Beranda

#### Umum

**4. Tampilan yang dikerjakan**
- [ ] Pastel saja ⭐
- [x] Pastel (`public/`) + dark (`public/dark/`)

Dampak: kerja UI 2×.

**5. ID user Febie**
- [ ] Tetap `istri` ⭐
- [x] Ganti jadi `febie`, **hanya ID user** (ID buku `istri` tetap)

Dampak: migrasi sekali di `Users.id`, `Buku.pemilik`, `Transaksi.oleh`, `Todo.pemilik/oleh/selesai_oleh`, Script Property `token_istri` → `token_febie` (nilai token disalin, jadi kode koneksi Febie tetap berlaku). Seed di `setup()` dan `PANDUAN.md` ikut diubah.

#### Fase B: Momen

**6. Momen milik pribadi**
- [ ] Terlihat berdua, hanya pemilik yang edit ⭐
- [ ] Bisa pilih "Hanya aku"
- [ ] Selalu privat
- [x] Terlihat berdua, **Riki & Febie bisa membuat dan mengedit semua Momen**

**7. Durasi Momen**
- [ ] Satu tanggal di v1 ⭐
- [x] Bisa rentang tanggal; form punya checkbox **"Hanya satu hari"**

Dampak: kolom `tanggal_selesai` (kosong = satu hari), tampilan pita di kalender.

**8. Kartu kenangan di Beranda**
- [x] Semua Momen; beberapa di tanggal sama = satu kartu berisi daftar ⭐
- [ ] Hanya yang "tiap tahun"

**9. Momen tahunan masuk kalender "Rumah Kita"**
- [x] Semua, termasuk Momen pribadi ⭐
- [ ] Hanya Momen bersama

**10. Pengingat event tahunan**
- [x] H-1 ⭐
- [ ] Hari-H pagi ⭐
- [ ] H-7

#### Fase C: Siklus

**11. Penyimpanan data Siklus**
- [ ] A: Sheet yang sama
- [ ] B: Sheet terpisah di akun Febie
- [ ] C: Sheet sama, dikunci PIN
- [x] **Supabase**

**12. Project Supabase milik akun siapa?**
- [x] Akun Febie ⭐ (Riki tidak bisa membuka dashboard)
- [ ] Akun Riki + catatan dikunci PIN
- [ ] Akun Riki tanpa kunci

**13. Cara login Supabase**
- [x] Kode OTP 6 angka via email, diketik di app ⭐
- [ ] Login Google
- [ ] Link login di email (berisiko nyangkut di Safari pada iPhone)

**14. Supabase gratis di-pause setelah 1 minggu tidak aktif**
- [x] Gratis + ping harian dari Apps Script ⭐
- [ ] Plan berbayar
- [ ] Gratis, terima risiko

**15. Cakupan Supabase**
- [ ] Siklus saja ⭐
- [x] Semua data Kantong nanti pindah; lapisan Supabase dibuat umum dari awal

**16. Berbagi Siklus ke Riki**
- [x] **Jadwal (tanggal + perkiraan) selalu dibagikan**, Febie tidak bisa mematikan
- [x] Catatan: opsional, default tidak dibagikan

**17. Jarak antarsiklus di luar 21–35 hari**
- [x] App tanya "Ada yang terlewat?"; kalau ya, tidak dihitung ⭐
- [ ] Tetap dihitung
- [ ] Otomatis diabaikan

**18. Teks tombol**
- [x] "Mulai siklus" / "Selesai" ⭐
- [ ] "Hari ke-1" / "Selesai"
- [ ] "Mulai menstruasi" / "Selesai"

#### Onboarding

**19. Status Febie**
- [x] Sudah terhubung ke Kantong → onboarding muncul sekali lewat kartu "Ada yang baru"
- [ ] Belum

**20. Onboarding Riki**
- [x] Versi pendek, tanpa menyebut Siklus ⭐
- [ ] Tidak perlu

**21. Penyetuju teks layar privasi**
- [ ] Febie baca draf final ⭐
- [x] Riki saja

### Data

**Sheet, tab `Momen`:** `id, judul, cerita, tanggal, tanggal_selesai, kategori (kita|keluarga|pekerjaan|lainnya), pemilik (riki|febie|bersama), tahunan, gcal_event_id, gcal_status, gcal_error, oleh, dibuat, diubah, dihapus`
- Nama kolom waktu ikut pola yang ada (`dibuat/diubah/dihapus`).
- Aksi: `agenda.month` (to-do + Momen 1 bulan), `momen.save`, `momen.delete`. `agenda.month` tidak memakai kunci tulis.

**Sheet, tab `Todo`:** tambah `selesai_at`.

**Supabase (project akun Febie, region usulan Singapura):**

| Tabel | Kolom | Akses (RLS) |
|---|---|---|
| `siklus` | `id, user_id, mulai, selesai, dibuat, diubah, dihapus` | Febie: semua. Riki: baca saja (jadwal selalu dibagikan) |
| `siklus_catatan` | `siklus_id, catatan` | Febie: semua. Riki: baca hanya kalau `bagikan_catatan = true` |
| `siklus_pengaturan` | `user_id, aktif, bagikan_catatan, setuju_at, versi_teks` | Febie saja |
| `siklus_pembaca` | `pemilik_id, pembaca_id` | Febie saja (daftar siapa yang boleh baca jadwal) |

- Perkiraan **tidak disimpan**, dihitung di HP: hari pertama terakhir + rata-rata 6 siklus terakhir. Kalau < 2 catatan: 28 hari + label "perkiraan kasar". Tampil sebagai rentang ±2 hari.
- Agenda menggabungkan data Sheet (to-do, Momen) dan Supabase (Siklus) di HP.
- Ping harian: trigger waktu di Apps Script mengirim request ringan ke Supabase.
- Siklus tidak pernah dikirim ke Google Calendar dan tidak tampil di Beranda.
- Modul `supabase.js` dibuat umum (login OTP + request) supaya siap dipakai saat data lain pindah.

### Onboarding fitur baru

**Prinsip**
- Siklus default mati; Febie sendiri yang mengaktifkan.
- Sebelum aktif, Febie diberi tahu dengan jelas: **jadwal selalu terlihat oleh Riki**, catatan privat kecuali dibagikan.
- Data kesehatan termasuk data pribadi spesifik (UU 27/2022 Pasal 4 ayat 2). Pemakaian pribadi/rumah tangga dikecualikan (Pasal 2 ayat 2), jadi ini standar sukarela.
- Semua layar bisa dilewati. Pilihan bisa diubah di Pengaturan → Siklus.

**Febie** (muncul sekali lewat kartu "Ada yang baru")
1. **Sambutan**: "Hai Febie. Kantong sekarang punya Agenda: to-do, momen penting, dan (kalau kamu mau) catatan siklus." [Lanjut] [Lewati semua → Siklus tetap mati]
2. **Agenda & Momen**: contoh kalender kecil. "Tandai hari penting, satu hari atau beberapa hari. Bisa diingatkan tiap tahun."
3. **Tawaran Siklus**: "Mau catat siklus di sini? Kamu catat tanggal mulai & selesai, plus catatan kalau mau, lalu dapat perkiraan berikutnya. Ini perkiraan, bukan diagnosis dan bukan alat kontrasepsi." [Ya, aktifkan] [Nanti saja → layar 8]
4. **Privasi**: "Catatanmu disimpan di database milik akunmu sendiri. Jadwal (tanggal & perkiraan) selalu terlihat oleh Riki. Catatan hanya terlihat olehmu, kecuali kamu bagikan." Wajib centang "Aku paham dan setuju".
5. **Masuk**: isi email → ketik kode 6 angka.
6. **Berbagi catatan ke Riki**: Tidak (default) / Ya. "Bisa diubah kapan saja."
7. **Isi awal** (opsional): hari pertama siklus terakhir + "Tambah siklus sebelumnya" (maks 6). Lewati → perkiraan kasar 28 hari.
8. **Selesai**: ringkasan pilihan + "Sembunyi cepat: chip Siklus di Agenda. Ubah: Pengaturan → Siklus."

**Riki** (versi pendek): layar 1, 2, 8 tanpa menyebut Siklus. Setelah Febie mengaktifkan Siklus, chip Siklus muncul di Agenda Riki dengan tombol "Masuk untuk lihat jadwal" (login OTP sekali).

**Data onboarding:** key `onboarding_versi_<user>` di tab `Pengaturan` (Sheet). Persetujuan Siklus (`setuju_at`, `versi_teks`) di Supabase. Versi teks privasi naik → Febie diminta setuju ulang.

### Kriteria selesai

Fase A
- [ ] Agenda menampilkan bulan berjalan; geser ke bulan lalu menampilkan to-do & Momen lama, termasuk to-do selesai > 30 hari.
- [ ] To-do tanpa jam: belum selesai di tanggal dibuat, selesai di tanggal selesai.
- [ ] Tab To-do jadi Agenda (Daftar | Kalender) di pastel dan dark.
- [ ] ID `istri` → `febie` termigrasi; kode koneksi Febie tetap berlaku.

Fase B
- [ ] Tambah Momen di tanggal mana pun (termasuk lampau), satu hari atau rentang.
- [ ] Riki & Febie bisa mengedit semua Momen.
- [ ] Momen tahunan → event tahunan seharian di "Rumah Kita" dengan pengingat H-1; Momen biasa → tidak ada event.
- [ ] Kartu kenangan hanya muncul di tanggal ulang Momen (rentang → tanggal mulai; 29 Feb → 28 Feb di tahun bukan kabisat).

Fase C
- [ ] Siklus mati sampai Febie mengaktifkan lewat onboarding + centang setuju.
- [ ] Akun Riki: jadwal & perkiraan terbaca; catatan kosong kalau `bagikan_catatan = false` (dicek di tes RLS).
- [ ] Jarak di luar 21–35 hari → app bertanya "Ada yang terlewat?".
- [ ] < 2 catatan → 28 hari + label "perkiraan kasar"; perkiraan tampil sebagai rentang ±2 hari.
- [ ] Toggle "Tampilkan Siklus" off → semua tanda hilang; on → kembali utuh.
- [ ] Siklus tidak pernah muncul di Google Calendar maupun Beranda.

Umum
- [ ] Tap target ≥ 44 px, kontras ≥ 4.5:1, `test_core.js` + tes baru lulus.

### Urutan kerja

0. **Persiapan**: merge `claude/gallant-clarke-kiuupp` → pindahkan to-do aktif dari browser ke Sheet → migrasi ID `istri` → `febie`.
1. **Fase A**: Agenda bulanan + riwayat to-do (pastel + dark).
2. **Fase B**: Momen + kartu kenangan + event tahunan.
3. **Fase C**: Febie membuat project Supabase → tabel + RLS → login OTP → Siklus → onboarding → ping harian.

### Catatan terbuka

- Keputusan #15 (semua data pindah ke Supabase) vs #12 (project milik Febie): usulan, data Kantong lain nanti di project terpisah milik Riki, supaya Febie tetap satu-satunya pemilik data Siklus.
- Pengingat H-1 di Google Calendar kemungkinan hanya berlaku di akun Riki. Febie mungkin perlu mengatur notifikasi kalender "Rumah Kita" di HP-nya. Perlu dites.
- Ping harian adalah trik umum, bukan jaminan resmi Supabase.
- Supabase gratis disebut tidak punya backup otomatis (sumber pihak ketiga). Usulan: tombol "Unduh cadangan (JSON)" di Pengaturan → Siklus, pola sama dengan branch `ruang-catat`.

### Sumber

- Siklus 21–35 hari, rata-rata 28: [Cleveland Clinic](https://my.clevelandclinic.org/health/articles/10132-normal-menstruation), [rangkuman ACOG](https://hakaru.io/guides/menstrual-cycle-calculator-guide)
- Menu bawah 3–5 tujuan: [Material Design 3](https://m3.material.io/components/navigation-bar/guidelines)
- UU 27/2022: [JDIH Kemenkeu](https://jdih.kemenkeu.go.id/download/46c17b53-4a45-411c-9b76-c6799e5769fc/UU_Nomor_27_Tahun_2022%20Perlindungan%20Data%20Pribadi.pdf), [Pasal.id](https://pasal.id/akn/id/act/uu/2022/27), [Hukumonline: putusan MK Pasal 2 ayat 2](https://www.hukumonline.com/berita/a/mk--uu-pdp-lindungi-pemrosesan-data-privat-bersifat-nonkomersil-lt6454b8bc84511)
- 18 dari 25 app menstruasi & kehamilan dapat label peringatan privasi: [Mozilla Foundation](https://www.mozillafoundation.org/es/research/library/in-post-roe-v-wade-era-mozilla-labels-18-of-25-popular-period-and-pregnancy-tracking-tech-with-privacy-not-included-warning), [PopSci](https://www.popsci.com/technology/mozilla-period-app-privacy-report/)
- Supabase gratis: pause setelah 1 minggu, 2 project aktif, 500 MB: [Supabase Pricing](https://supabase.com/pricing), [Supabase FAQ](https://supabase.com/kb/faqs/platform/free-postgres-for-side-projects)
- App home screen iPhone tidak berbagi storage dengan Safari: [WebKit bug 181849](https://bugs.webkit.org/show_bug.cgi?id=181849), [firt.dev: iOS PWA](https://firt.dev/notes/pwa-ios/)
