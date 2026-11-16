# Kantong: catatan keuangan keluarga (PWA + Supabase)

- `public/`: PWA yang di-deploy (Vercel, project `dompet-app`, setting di `vercel.json`). Push ke `main` = otomatis rilis.
- `supabase/`: backend. Skema di `migrations/`, API di `functions/kantong/` (Edge Function). Panduan pasang: `kantong/PANDUAN.md`.
- `public/core.js`: logika bersama (aturan akses, hitungan, to-do). Salinannya untuk Edge Function dan Apps Script dibuat lewat `node kantong/tools/build_core.js`.
- `kantong/apps-script/`: backend lama (Google Sheets), masih kompatibel, tidak dikembangkan lagi.
- `kantong-pastel/`: varian tampilan lama. `public/dark/` mengarah ke app utama (tema gelap).

Fitur to-do rumah tangga + sync ke Google Calendar "Rumah Kita": lihat `kantong/PANDUAN.md` §7. Agenda & Momen: §8. Siklus (modul terpisah di project Supabase yang sama, `supabase/migrations/*_siklus.sql`): §9.

Data keuangan pribadi tidak disertakan di repo ini.

---

## Rencana fitur: Agenda + Momen + Siklus

Status: **dibangun** (16 Nov 2026), menunggu pasang backend. Brief v1: Riki (UI/UX). Pengguna: Riki & Febie.

**Yang berbeda dari rencana awal (setelah dibangun):**
- Backend Kantong sudah pindah ke Supabase (branch `claude/gallant-clarke-kiuupp`, ikut di-merge), jadi `Momen` & `selesai_at` ada di database Supabase, bukan tab Sheet. Apps Script lama tetap kompatibel.
- Status pengenalan (onboarding) dan "Tutup" kartu kenangan disimpan per HP (localStorage), bukan tab `Pengaturan`. Persetujuan Siklus (`setuju_at`, `versi_teks`) tetap di server Siklus.
- Akses Siklus memakai tabel `siklus_anggota` (pemilik/pembaca) + fungsi server, bukan tabel `siklus_pembaca`; catatan dihapus permanen (bukan kolom `dihapus`).
- `public/dark/` (varian lama) sekarang mengarah ke app utama dengan tema gelap; cache & service worker lamanya dibersihkan. Semua fitur baru dites di tema terang & gelap.

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
- [ ] Akun Febie ⭐ (Riki tidak bisa membuka dashboard)
- [ ] Akun Riki + catatan dikunci PIN
- [x] **Satu project dengan Kantong (akun Riki), modul/folder terpisah** — diubah 16 Nov; Riki secara teknis bisa membuka tabel lewat dashboard, disebutkan di layar privasi

**13. Cara login Supabase**
- [x] Kode OTP 6 angka via email, diketik di app ⭐
- [ ] Login Google
- [ ] Link login di email (berisiko nyangkut di Safari pada iPhone)

**14. Supabase gratis di-pause setelah 1 minggu tidak aktif**
- [ ] Gratis + ping harian dari Apps Script ⭐ (tidak perlu lagi: project dipakai Kantong tiap hari)
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

**Supabase project Kantong** (`supabase/migrations/20261117000000_agenda_momen.sql`):
- `momen`: `id, judul, cerita, tanggal, tanggal_selesai, kategori (kita|keluarga|pekerjaan|lainnya), pemilik (riki|febie|bersama), tahunan, gcal_event_id, gcal_status, gcal_error, oleh, dibuat, diubah, dihapus`
- `todo`: tambah `selesai_at`.
- id user `istri` → `febie` (buku `istri` tetap, kode akses ikut pindah).
- Aksi API: `agenda.month` (to-do + Momen 1 bulan, tanpa batas 30 hari), `momen.save`, `momen.delete`, `momen.sync`. `bootstrap` menambah `kenangan` dan `fitur`.

**Modul Siklus, project Supabase yang sama** (`supabase/migrations/20261117000100_siklus.sql`, prefix `siklus_*`, tidak lewat Edge Function Kantong):

| Tabel | Isi | Akses |
|---|---|---|
| `siklus_anggota` | `user_id, peran (pemilik/pembaca)` | diatur pemilik project lewat SQL Editor |
| `siklus` | `id, user_id, mulai, selesai, abaikan_jarak` | Febie: semua. Riki: baca jadwal setelah Febie aktif |
| `siklus_catatan` | `siklus_id, catatan` | Febie: semua. Riki: hanya kalau `bagikan_catatan = true` |
| `siklus_pengaturan` | `aktif, bagikan_catatan, setuju_at, versi_teks` | Febie |

- Semua tabel RLS tanpa policy; akses hanya lewat fungsi `siklus_muat/simpan/hapus/atur/hapus_semua` yang memeriksa `auth.uid()`.
- Perkiraan **tidak disimpan**, dihitung di HP (`public/siklus.js`, `SiklusCore`).
- Login: kode OTP 6 angka via email (Supabase Auth), sesi tersimpan di HP.
- Siklus tidak pernah dikirim ke Google Calendar dan tidak tampil di Catat/Beranda.

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

**Data onboarding:** status pengenalan per HP (`k_onb_<user>`). Persetujuan Siklus (`setuju_at`, `versi_teks`) di server Siklus. Versi teks privasi naik → Febie diminta setuju ulang.

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

### Urutan pasang

1. **Kode**: merge branch ini ke `main` → Vercel otomatis rilis PWA. Tanpa backend baru, app tetap jalan (Agenda menampilkan to-do terbaru + catatan "backend perlu diperbarui").
2. **Backend Kantong**: `supabase db push` lalu `supabase functions deploy kantong --no-verify-jwt` (PANDUAN §8).
3. **Pengingat H-1**: Riki & Febie masing-masing atur *All-day event notifications* kalender "Rumah Kita" = 1 hari sebelumnya.
4. **Siklus**: atur Auth & template email → daftarkan 2 email → isi anon key di `public/siklus-config.js` → push (PANDUAN §9).

### Tes

`test_core.js` (205 cek), `test_supabase.js` (20), `test_sql.sh`, `test_siklus.js` (32), `test_siklus_sql.sh`: semua lulus. Dicek di browser (mode demo, 390 px, terang & gelap): Agenda, Momen, kenangan, onboarding Febie 8 layar, Siklus pemilik vs pembaca, migrasi to-do browser, Beranda desktop.

### Catatan terbuka

- Siklus satu project dengan Kantong: pemilik project (Riki) secara teknis bisa membuka tabel `siklus_*`. Kalau nanti butuh privasi penuh, tabelnya bisa dipindah ke project akun Febie tanpa mengubah app (cukup isi `url` di config).
- Supabase gratis tidak punya backup otomatis (sumber pihak ketiga) → tombol **Unduh cadangan (JSON)** sudah ada di Pengaturan → Siklus.
- Siklus butuh internet untuk menyimpan (tidak masuk antrean offline); membaca tetap bisa dari cache HP.

### Sumber

- Siklus 21–35 hari, rata-rata 28: [Cleveland Clinic](https://my.clevelandclinic.org/health/articles/10132-normal-menstruation), [rangkuman ACOG](https://hakaru.io/guides/menstrual-cycle-calculator-guide)
- Menu bawah 3–5 tujuan: [Material Design 3](https://m3.material.io/components/navigation-bar/guidelines)
- UU 27/2022: [JDIH Kemenkeu](https://jdih.kemenkeu.go.id/download/46c17b53-4a45-411c-9b76-c6799e5769fc/UU_Nomor_27_Tahun_2022%20Perlindungan%20Data%20Pribadi.pdf), [Pasal.id](https://pasal.id/akn/id/act/uu/2022/27), [Hukumonline: putusan MK Pasal 2 ayat 2](https://www.hukumonline.com/berita/a/mk--uu-pdp-lindungi-pemrosesan-data-privat-bersifat-nonkomersil-lt6454b8bc84511)
- 18 dari 25 app menstruasi & kehamilan dapat label peringatan privasi: [Mozilla Foundation](https://www.mozillafoundation.org/es/research/library/in-post-roe-v-wade-era-mozilla-labels-18-of-25-popular-period-and-pregnancy-tracking-tech-with-privacy-not-included-warning), [PopSci](https://www.popsci.com/technology/mozilla-period-app-privacy-report/)
- Supabase gratis: pause setelah 1 minggu, 2 project aktif, 500 MB: [Supabase Pricing](https://supabase.com/pricing), [Supabase FAQ](https://supabase.com/kb/faqs/platform/free-postgres-for-side-projects)
- App home screen iPhone tidak berbagi storage dengan Safari: [WebKit bug 181849](https://bugs.webkit.org/show_bug.cgi?id=181849), [firt.dev: iOS PWA](https://firt.dev/notes/pwa-ios/)
