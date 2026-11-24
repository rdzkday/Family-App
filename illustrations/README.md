# Ilustrasi Family App

Paket ilustrasi flat untuk Family App. **18 ilustrasi sudah dipasang di app** (daftar `PAKAI` di `src/build.js`), sisanya cadangan.

## Yang sudah dipasang

| Ilustrasi | Tempat di app |
|---|---|
| `auth-masuk` / `auth-keluar` / `auth-sesi-berakhir` | Layar login, sesudah Keluar akun, sesudah sesi habis |
| `kosong-transaksi` | Kantong › Riwayat kosong, Catat › "Hari ini masih bersih" |
| `kosong-pencarian` | Cari kategori Kantong, cari pasal Komitmen |
| `kosong-todo` | Agenda › To-do kosong / semua beres |
| `kosong-catatan` / `kosong-jadwal` | Agenda › Catatan kosong, agenda mendatang kosong |
| `kosong-komitmen` | Komitmen › belum ada kesepakatan |
| `status-offline` | Komitmen dibuka pertama kali tanpa internet |
| `onboarding-01…06`, `onboarding-siklus` | Onboarding app (`shared/onboarding.js`): tampil sekali sesudah masuk, slide ikut fitur aktif, buka lagi di Pengaturan › Umum › Panduan aplikasi |
| `onboarding-05-daily-mood` | Juga di Daily Mood › Kenalan dulu |
| `status-404` | `public/404.html` |

Cara kerja: `public/shared/ilustrasi.js` (`ilus()`, `emptyIl()`) + `ilustrasi.css` memilih versi gelap/terang otomatis. Tambah ilustrasi: masukkan slug ke `PAKAI`, jalankan `node illustrations/src/build.js`, panggil `ilus('slug')`, tambah ke `SHELL` di `public/sw.js`.

- **31 ilustrasi** × 2 tema (terang & gelap) + 1 lembar karakter
- **3 beranimasi** (loading), otomatis diam saat *reduce motion* aktif
- Format **SVG** (tajam di semua ukuran, total ±480 KB untuk 62 file)

## Cara lihat & pilih

1. Buka `illustrations/index.html` di browser (atau link galeri yang dikirim Claude).
2. Filter per kategori, ganti tema Terang/Gelap.
3. Tekan **Pilih** di kartu → **Salin daftar** → tempel ke Claude untuk dipasang ke app.

## Isi folder

| Path | Isi |
|---|---|
| `svg/light/*.svg` | Versi tema terang |
| `svg/dark/*.svg` | Versi tema gelap (latar & kontras disesuaikan) |
| `svg/*/panduan-karakter.svg` | Lembar 10 ekspresi Riki & Febie (referensi) |
| `manifest.json` | Daftar: kategori, judul (alt text), saran pakai, warna latar, ukuran |
| `index.html` | Galeri preview + panduan gaya |
| `src/` | Generator (Node, tanpa dependency). Ubah lalu jalankan `node illustrations/src/build.js` |

## Daftar ilustrasi

| Kategori | File | Pakai untuk |
|---|---|---|
| Loading | `loading-kantong` ⟳ | Layar memuat penuh |
| | `loading-sinkron` ⟳ | Sinkron antrean offline |
| | `loading-mini` ⟳ | Loader kecil 120×56 (ganti spinner) |
| Onboarding | `onboarding-01-selamat-datang` | Selamat datang |
| | `onboarding-02-kantong` | Kantong: uang & budget berdua |
| | `onboarding-03-agenda` | Agenda: to-do, catatan, jadwal |
| | `onboarding-siklus` | Siklus: kalender haid (privat) |
| | `onboarding-04-komitmen` | Komitmen: pasal & TTD berdua |
| | `onboarding-05-daily-mood` | Daily Mood: jurnal pribadi |
| | `onboarding-06-offline` | Offline & sinkron otomatis |
| | `onboarding-07-siap` | Setup selesai |
| Login & Akun | `auth-masuk` | Login / hubungkan akun |
| | `auth-keluar` | Logout — "Sampai jumpa" |
| | `auth-sesi-berakhir` | Sesi habis, login ulang |
| | `auth-ganti-password` | Ganti password |
| Empty state | `kosong-transaksi` | Riwayat Kantong kosong |
| | `kosong-todo` | To-do kosong / semua beres |
| | `kosong-catatan` | Catatan kosong |
| | `kosong-jadwal` | Jadwal kosong |
| | `kosong-komitmen` | Belum ada pasal |
| | `kosong-mood` | Belum ada entri mood |
| | `kosong-pencarian` | Pencarian tidak ditemukan |
| Status sistem | `status-offline` | Sedang offline |
| | `status-gagal` | Gagal menyimpan |
| | `status-tersimpan` | Berhasil tersimpan |
| | `status-sinkron-selesai` | Data sama di kedua HP |
| | `status-404` | Halaman tidak ditemukan |
| | `status-update` | Versi baru tersedia |
| | `status-budget-lewat` | Budget terlampaui |
| Momen khusus | `momen-ttd-sah` | Lembar Pengesahan sah |
| | `momen-evaluasi-bulanan` | Sesi evaluasi bulanan |

⟳ = beranimasi

## Panduan gaya

**Konsep:** karakter diambil dari icon app — Kantong + dua koin. Koin biru = **Riki**, koin pink = **Febie**. Pembeda tidak hanya warna (aman buta warna): Riki punya **jambul**, Febie punya **pita lavender**.

**Aturan bentuk**
- Flat geometris: lingkaran, rounded-rect, kurva. Tanpa outline hitam.
- Shading 2 tone dari warna yang sama, cahaya dari kiri atas.
- Latar = blob organik dengan warna latar fitur (sama dengan token `--br-*-bg`).
- Tanpa teks di dalam gambar → copy tetap di UI, gampang diubah.
- Satu ide per gambar; karakter mendukung pesan, bukan hiasan.
- Kanvas 320×240 (4:3); `loading-mini` 120×56.

**Palet** (dari `public/shared/tokens.css` & `public/icons/icon.svg`)

| Peran | Hex |
|---|---|
| Riki | `#8FA2FF` (bayangan `#7388EE`) |
| Febie | `#F28DB5` (bayangan `#E071A0`) |
| Tinta (mata, detail) | `#2B2F55` |
| Kantong / sukses | `#7DD3A8` |
| Agenda | `#93C5FD` |
| Komitmen / koin | `#FCD34D` |
| Daily Mood | `#C4B5FD` |
| Peringatan | `#F87171` |
| Material Kantong | `#25262E` · `#EFE7D4` · `#2F3E75` |

**Pemakaian di UI (saran)**
- Empty state: lebar ilustrasi 160–200px, di atas judul + 1 kalimat + CTA. Lebar blok maks. 400px.
- Onboarding: lebar penuh kartu (maks. 320px).
- Pilih file sesuai tema aktif: `svg/light/` saat `data-theme="light"`, selain itu `svg/dark/`.
- Selalu isi `alt` dari kolom `judul` di `manifest.json`, atau `alt=""` jika teks di sebelahnya sudah menjelaskan.

## Referensi

- [Atlassian — Illustrations](https://atlassian.design/foundations/illustrations): spot illustration = satu konsep (empty, error, perayaan).
- [SAP Fiori — UX Illustrations](https://www.sap.com/design-system/fiori-design-web/v1-96/foundations/visual/ux-illustrations): tanpa teks di ilustrasi, desain minimal.
- [Salesforce Lightning — Empty state](https://v1.lightningdesignsystem.com/guidelines/empty-state): pesan wajib, ilustrasi & CTA opsional; karakter tidak boleh mengalahkan pesan.
- [Sprout Social Seeds — Empty states](https://seeds.sproutsocial.com/patterns/empty-states): lebar konten maks. 400px, CTA harus bisa ditindaklanjuti.
- [IBM Design Language — Flat style](https://www.ibm.com/design/language/illustration/flat-style/design): ukuran objek minimum.
- [Flat Vector Illustration Guide](https://getillustrations.com/blog/flat-vector-illustration-guide/): 3–6 warna per gambar, satu warna dominan, konsisten satu sub-gaya.
