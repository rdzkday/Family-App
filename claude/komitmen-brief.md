# Brief Fitur: Komitmen (Kamus Kesepakatan Berbentuk Pasal)

Versi 3 · 17 Nov 2026 · Pemilik: Riki (UI/UX) · Pengguna: Riki & Febie
Turunan dari `claude/beranda-brief.md` (§2 poin 3–4, §5, Fase 4). Kalau bertentangan, **brief ini yang berlaku untuk Komitmen**. Skema tab `Komitmen` di brief Beranda §5 **diganti** oleh §10 di sini.

> Untuk Claude Code: bahasa singkat, poin, awam. Rekomendasi + alasan **sebelum** keputusan jangka panjang.
>
> **Lihat §17**: penyesuaian karena backend sudah pindah ke Supabase (16 Nov).

**Riwayat keputusan Riki:**
- *17 Nov (v2):* persetujuan berdua **wajib dengan tanda tangan** · isi awal = **import perjanjian pranikah** · tanggal berlaku = **tanggal disetujui** · **tanpa kunci/PIN**.
- *17 Nov (v3):* TTD **per Lembar Pengesahan** · **nomor pasal global** + pencarian bisa langsung ke nomor/isi · pasal pranikah **hanya bisa dibaca + diberi Keterangan tambahan** · file pranikah (PDF/foto) **menyusul** setelah dokumen fisik ketemu.

---

## 1. Masalah

- Kesepakatan dari evaluasi bulanan tersebar (ingatan, chat, catatan) → mudah lupa / beda tafsir.
- Definisi penting (misal: "selingkuh itu apa", "batasan dengan lawan jenis") belum tertulis → rawan salah paham.
- Kesepakatan bisa berubah, tapi tidak ada jejak **apa yang berubah, kapan, dan kenapa**.

## 2. Tujuan

- Satu **"kitab kesepakatan"** berdua, ditulis seperti **pasal & ayat**, mudah dicari seperti kamus.
- Tiap pasal punya **tanggal berlaku / terakhir diubah**.
- Kesepakatan baru bisa **mengubah atau mencabut** pasal lama, tanpa menghapus riwayatnya.
- Titik awal: isi **perjanjian pranikah**.

**Ukuran berhasil (dicek setelah 2 kali evaluasi bulanan):**
- Semua hasil evaluasi tercatat & ditandatangani di app.
- Saat ada beda tafsir, pasal terkait ketemu lewat pencarian **< 10 detik**.

## 3. Ruang lingkup

| Masuk v1 | Tidak masuk v1 |
|---|---|
| Pasal (kesepakatan) & Definisi (istilah) | Komentar / diskusi di dalam pasal |
| Bab (kategori) | Lampiran / foto |
| Pencarian (isi + nomor pasal) + filter + indeks A–Z | Bandingkan versi kata-per-kata (diff) |
| Ubah pasal → versi baru + riwayat | Ekspor PDF |
| Cabut pasal | Notifikasi push |
| Sesi evaluasi | Fitur import di dalam app (import sekali oleh Claude, §7) |
| Lembar Pengesahan + **TTD berdua** | Kunci PIN |
| Import perjanjian pranikah (sekali) + **Keterangan tambahan** | |

## 4. Konsep (bahasa awam)

Bayangkan seperti **undang-undang mini rumah tangga**:

| Istilah | Artinya di app | Contoh |
|---|---|---|
| **Bab** | Kelompok topik | Bab II – Batasan dengan Lawan Jenis |
| **Pasal** | Satu kesepakatan / satu definisi | Pasal 4 – Chat pribadi dengan lawan jenis |
| **Ayat** | Butir isi pasal, bernomor (1), (2), (3) | (1) … (2) … |
| **Versi** | Isi pasal pada satu waktu | Versi 2, berlaku sejak 12 Okt 2026 |
| **Keterangan** | Penjelasan tambahan yang ditempel di pasal tanpa mengubah teks aslinya | Keterangan untuk Pasal 3 Perjanjian Pranikah |
| **Sesi evaluasi** | Catatan satu kali evaluasi bulanan | Evaluasi Okt 2026 |
| **Lembar Pengesahan** | Halaman tanda tangan untuk sekumpulan usulan | Pengesahan Evaluasi Okt 2026 |

**Dua tipe pasal:**
- **Kesepakatan** — aturan/komitmen ("kita sepakat …").
- **Definisi** — arti sebuah istilah ("Selingkuh adalah …"). Muncul juga di **indeks A–Z**.

## 5. Aturan produk

**Final (keputusan Riki):**
1. **Tidak ada yang berlaku tanpa TTD Riki DAN Febie** — pasal baru, perubahan, pencabutan, keterangan, dan hasil import.
2. **TTD per Lembar Pengesahan**, bukan per pasal (§6).
3. **Tanggal berlaku = tanggal TTD kedua.**
4. **Tanpa kunci/PIN** (tetap di balik kode koneksi yang sudah ada).
5. **Nomor pasal global** (Pasal 1, 2, 3 … lintas bab), tetap selamanya, nomor yang dicabut tidak dipakai ulang.
6. **Pencarian** bisa menemukan pasal lewat **nomor** maupun **isi** (§8A).
7. **Pasal dari perjanjian pranikah: hanya bisa dibaca.** Tidak bisa diubah atau dicabut di app. Yang bisa: **menambah Keterangan** (§7).

**Rekomendasi (konfirmasi ke Riki):**
8. **Mengubah = membuat versi baru**, bukan menimpa. Versi lama tetap di "Riwayat".
9. **Mencabut** = pasal berstatus *Dicabut*, tetap ada di arsip.
10. **Wajib isi alasan** setiap ubah/cabut (1 kalimat cukup).
11. Tiap versi/keterangan menyimpan **sumber**: Perjanjian Pranikah / sesi evaluasi / "Di luar evaluasi".
12. Komitmen **tidak pernah** masuk Google Calendar, to-do, atau catatan.
13. Format tanggal "12 Okt 2026". Label: **"Berlaku sejak …"** (versi 1) / **"Diubah …"** (versi ≥ 2).

## 6. Tanda tangan (pengesahan) — FINAL: per Lembar Pengesahan

1. Usulan (baru/ubah/cabut/keterangan) terkumpul dalam satu **Lembar Pengesahan** — otomatis per sesi evaluasi, per import, atau per usulan tunggal di luar evaluasi.
2. Lembar menampilkan daftar semua perubahan (sebelum vs sesudah + alasan), lalu kalimat pernyataan (copy final dari Riki).
3. Masing-masing **menggambar TTD dengan jari** di HP sendiri (tidak harus bersamaan).
4. Sebelum TTD, tiap orang bisa tandai item **"Diskusikan dulu"** → item keluar dari lembar, tetap jadi usulan untuk evaluasi berikutnya. Kalau lembar berubah setelah satu orang TTD → TTD itu **batal**, harus diulang.
5. TTD kedua masuk → semua item di lembar **Berlaku** dengan tanggal hari itu.
6. Di halaman pasal: "Disahkan 12 Okt 2026" + gambar kecil kedua TTD (tap → buka Lembar Pengesahan).

**Teknis (bahasa awam):** TTD disimpan sebagai **garis-garis (SVG)**, bukan foto → kecil, muat di satu sel Google Sheet. Kotak TTD punya tombol **Ulangi** dan **Simpan**; tidak bisa simpan kalau kosong.

**Catatan:** TTD di app = **tanda komitmen pribadi berdua**, bukan tanda tangan elektronik resmi. Secara hukum, **akta perjanjian pranikah asli tetap yang berlaku**.

## 7. Import perjanjian pranikah + Keterangan

**Status:** menunggu file dari Riki (PDF atau foto) setelah dokumen fisik ketemu.

**Cara import (sekali, oleh Claude — bukan fitur di app):**
1. Riki kirim file ke **chat Claude** (bukan ke repo).
2. Claude ubah jadi tabel **Bab → Pasal → Ayat**, teks **disalin persis** (tidak diparafrasekan).
   - **PDF teks:** teks diambil langsung → akurat.
   - **Foto/scan:** Claude membaca teks dari gambar → **bisa salah baca** (huruf, angka, tanda baca). Wajib dicek berdua **kata per kata**. Tips foto: lurus, terang, tanpa bayangan, satu halaman per foto.
3. Riki & Febie cek tabel di chat → koreksi.
4. Claude Code masukkan ke Sheet dengan skrip sekali pakai (`tools/import_pranikah.js`, tidak menyimpan isi dokumen di repo). Status: **Usulan**.
5. Otomatis dibuat **Lembar Pengesahan "Perjanjian Pranikah"** → TTD berdua → Berlaku.

**Aturan pasal dari pranikah:**
- Masuk **Bab "Perjanjian Pranikah"**, nomor global app (misal Pasal 1–15), dengan **rujukan asli** di bawah judul ("Pasal 3 Perjanjian Pranikah").
- Sumber: "Perjanjian Pranikah · akta [tanggal akta]". Tanggal berlaku di app = tanggal TTD; tanggal akta tampil sebagai info.
- **Hanya bisa dibaca.** Tombol Ubah & Cabut **tidak muncul**. Yang muncul: **+ Keterangan**.

**Keterangan tambahan (berlaku untuk pasal pranikah):**
- Fungsi: menjelaskan tafsir/cara menjalankan pasal versi kalian, **tanpa mengubah teks asli**.
- Tampil di bawah ayat, terpisah jelas: kotak bertanda "Keterangan" + tanggal disahkan.
- Satu pasal boleh punya **beberapa keterangan**, urut tanggal.
- Rekomendasi: keterangan **juga lewat Lembar Pengesahan + TTD berdua** (konsisten dengan aturan #1). → *Konfirmasi ke Riki, §16 #1.*
- Keterangan bisa **diganti** (keterangan baru menggantikan yang lama; yang lama masuk Riwayat) atau **dicabut** — keduanya juga lewat TTD.
- Isi keterangan ikut **bisa dicari**.

## 8. Alur pengguna

**A. Membaca / mencari (paling sering)**
1. Buka Komitmen → kolom cari di atas.
2. **Cari nomor:** ketik "12", "pasal 12", atau "psl 12" → Pasal 12 tampil paling atas; Enter → langsung buka.
3. **Cari isi:** ketik kata (misal "lawan jenis", "selingkuh", "harta") → hasil muncul saat mengetik, kata cocok di-*highlight*. Dicari di: judul, isi ayat, keterangan, kata kunci, rujukan asli ("pasal 3 pranikah" → ketemu).
4. Hasil menampilkan **di bagian mana** kata ditemukan: "di ayat (2)" / "di keterangan".
5. Tap hasil → halaman pasal, langsung **scroll ke ayat/keterangan yang cocok**.

**B. Sesi evaluasi bulanan**
1. Tap **Mulai evaluasi** (juga dari kartu pengingat di Beranda).
2. Isi catatan ringkas (opsional).
3. Di dalam sesi: **+ Pasal baru**, **Ubah pasal**, **Cabut pasal**, **+ Keterangan** — semua masuk Lembar Pengesahan sesi ini.
4. **Selesai & tanda tangani** → buka Lembar Pengesahan → TTD (§6).

**C. Ubah pasal (non-pranikah) di luar evaluasi**
1. Buka pasal → **Ubah** → edit ayat + alasan → Simpan → *Usulan*, Lembar Pengesahan tunggal dibuat.
2. Pasangan dapat banner → buka lembar → lihat sebelum vs sesudah → TTD atau "Diskusikan dulu".

**D. Tambah keterangan pada pasal pranikah**
1. Buka pasal pranikah → **+ Keterangan** → tulis → Simpan → *Usulan* → Lembar Pengesahan → TTD berdua.

**E. Tambah definisi di luar evaluasi**
- Boleh. Sumber "Di luar evaluasi". Tetap lewat Lembar Pengesahan + TTD.

## 9. Struktur layar

**Daftar Komitmen (mobile 390 px)**
1. Header "Komitmen" + jumlah pasal berlaku.
2. Kolom cari (placeholder: "Cari kata atau nomor pasal").
3. Chip filter: **Semua · Kesepakatan · Definisi · Pranikah · Usulan · Dicabut**.
4. Tab tampilan: **Per Bab** (default) | **A–Z** (hanya Definisi, huruf indeks di sisi kanan).
5. Banner kuning bila ada lembar menunggu TTD-mu: "1 lembar menunggu tanda tanganmu".
6. Daftar pasal per Bab. Tiap baris: `Pasal 4` · judul · cuplikan 1 baris · "Diubah 12 Okt 2026". Pasal pranikah: ikon gembok kecil + "Pranikah".
7. Tombol **Mulai evaluasi**.

**Halaman pasal**
- `Pasal 4` + judul + label tipe + status (+ "Pasal 3 Perjanjian Pranikah" bila dari import).
- Ayat bernomor (1), (2), …
- *(Pranikah)* blok **Keterangan** di bawah ayat: tiap keterangan dalam kotak terpisah + tanggal disahkan.
- Footer: Berlaku sejak / Diubah · Versi · Sumber · 2 TTD kecil.
- Tombol: non-pranikah = **Ubah**, **Cabut**, **Riwayat** · pranikah = **+ Keterangan**, **Riwayat**.
- *(Definisi)* "Lihat juga: Pasal 7" bila pasal lain memakai istilah ini.

**Lembar Pengesahan**
- Judul lembar + tanggal dibuat.
- Daftar item: label Baru / Diubah / Dicabut / Keterangan, sebelum vs sesudah, alasan; tombol "Diskusikan dulu" per item.
- Kalimat pernyataan.
- Dua kotak TTD: Riki | Febie. Kotak pasangan hanya tampil ("Belum ditandatangani" / gambar TTD + jam).

**Riwayat pasal**: versi & keterangan terbaru → terlama: tanggal, alasan, isi lengkap, link ke Lembar Pengesahan.

**Desktop**: kiri = cari + daftar, kanan = isi pasal.

**Warna**: token Komitmen brief Beranda §3 (`#FCD34D`, kartu `#1C1A13`, border `#3D3520`, teks `#D6CFB8`). Usulan = kuning outline · Berlaku = normal · Dicabut = muted + judul dicoret · Keterangan = kotak `#0E1014` border kiri `#FCD34D`. Garis TTD = `#ECEEF2` di atas `#0E1014`.

**Contoh tampilan (isi = placeholder):**

```
BAB I – PERJANJIAN PRANIKAH

Pasal 3 – [Judul pasal asli]           🔒 Pranikah
Pasal 3 Perjanjian Pranikah
(1) [Teks asli ayat 1, sama persis dengan akta]
(2) [Teks asli ayat 2]
┃ Keterangan · disahkan 1 Des 2026
┃ [Penjelasan/tafsir yang kalian sepakati]
Berlaku sejak 1 Des 2026 · Akta [tanggal] · ✍ R ✍ F

BAB II – DEFINISI

Pasal 16 – Selingkuh                    [Definisi]
(1) Selingkuh adalah [definisi yang kalian sepakati].
(2) Termasuk di dalamnya: [contoh perilaku].
(3) Tidak termasuk: [contoh yang disepakati bukan selingkuh].
Berlaku sejak 1 Des 2026 · Versi 1 · ✍ R ✍ F
```

Pola ayat definisi yang disarankan: **arti → termasuk → tidak termasuk**.

## 10. Data (rekomendasi)

> **Diperbarui di §17:** backend sekarang Supabase. Nama tab di bawah = nama tabel di `KantongCore.SCHEMA`; di Postgres jadi huruf kecil.

**Tetap pakai Google Sheet + Apps Script Kantong**, 6 tab baru. Aturan Sheet sama (jangan ubah `id`, header, nama tab).

**Kenapa dipisah "pasal" dan "versi"?** Pasal = **map** (nomor & judul tetap). Versi = **lembar isi** di dalam map. Mengubah = menambah lembar baru, lembar lama tidak dibuang → riwayat & tanggal otomatis benar.

**`KomitmenBab`**: `id, nomor (I, II, …), judul, urutan, dibuat_at, dihapus`

**`KomitmenPasal`**: `id, nomor (angka global, unik, tidak dipakai ulang), bab_id, tipe (kesepakatan|definisi), judul, kata_kunci (dipisah koma), sumber_asal (app|pranikah), rujukan_asli (misal "Pasal 3 Perjanjian Pranikah"), terkunci (TRUE untuk pranikah), status (usulan|berlaku|dicabut), versi_berlaku_id, dibuat_oleh, dibuat_at, diubah_at, dihapus`

**`KomitmenVersi`**: `id, pasal_id, versi (1,2,3…), isi_ayat (JSON array teks), alasan, jenis (baru|ubah|cabut), sumber (pranikah|evaluasi|luar_evaluasi), evaluasi_id, pengesahan_id, status (usulan|berlaku|ditunda|digantikan), berlaku_sejak (= TTD kedua), dibuat_oleh, dibuat_at`

**`KomitmenKeterangan`**: `id, pasal_id, isi, menggantikan_id (keterangan lama yang diganti, boleh kosong), jenis (baru|ganti|cabut), evaluasi_id, pengesahan_id, status (usulan|berlaku|ditunda|digantikan|dicabut), berlaku_sejak, dibuat_oleh, dibuat_at`

**`Pengesahan`**: `id, judul, jenis (pranikah|evaluasi|tunggal), evaluasi_id, ttd_riki (SVG path), ttd_riki_at, ttd_febie (SVG path), ttd_febie_at, isi_hash, status (menunggu|sah|batal), dibuat_at`

> `isi_hash` (bahasa awam): "sidik jari" isi lembar. Isi berubah setelah TTD → sidik jari beda → TTD otomatis batal. Menjamin yang ditandatangani tidak bisa diubah diam-diam.

**`Evaluasi`**: `id, tanggal, catatan, dibuat_oleh, selesai_at`

**Aksi baru di `KantongCore.handle`:** `komitmen.list`, `komitmen.history`, `komitmen.propose` (baru/ubah/cabut), `keterangan.propose` (baru/ganti/cabut), `pengesahan.get`, `pengesahan.defer`, `pengesahan.sign`, `evaluasi.start`, `evaluasi.finish`, `evaluasi.list`. Aksi `home` di Beranda ikut mengembalikan: jumlah pasal berlaku + jumlah lembar menunggu TTD user.

**Aturan server:**
- `komitmen.propose` dengan jenis ubah/cabut pada pasal `terkunci = TRUE` → **ditolak** (pesan: "Pasal pranikah hanya bisa diberi keterangan").
- `pengesahan.sign`: cek user = pemilik kotak; cek `isi_hash` cocok; TTD kedua → semua item jadi *berlaku*, `berlaku_sejak` = waktu TTD kedua (Asia/Jakarta), versi/keterangan lama → *digantikan*.

**Pencarian (di HP/browser, dari data `komitmen.list`):**
- Data kecil → instan & jalan offline.
- Input berupa angka / "pasal N" / "psl N" → cocokkan **nomor pasal** dulu, taruh paling atas.
- Selain itu → cari di judul, isi ayat, keterangan, kata kunci, rujukan asli. Abaikan huruf besar/kecil.
- Urutan hasil: cocok nomor → cocok judul → cocok kata kunci → cocok isi/keterangan.

**Offline:** baca & cari = offline OK. Usul = antrean offline. **TTD wajib online.**

## 11. Privasi

- Isi Komitmen & perjanjian pranikah sangat pribadi. Data **hanya di Google Sheet**; tidak boleh masuk repo (repo public), log, atau file contoh.
- File pranikah **tidak diunggah ke repo**; skrip import membaca data dari luar repo lalu langsung kirim ke Sheet.
- Mode demo (`KANTONG_PREVIEW`) pakai placeholder, **bukan** isi asli.

## 12. Status & pesan (UX copy)

| Kondisi | Tampilan |
|---|---|
| Belum ada pasal | "Belum ada kesepakatan. Mulai dari evaluasi bulanan pertama kalian." + tombol Mulai evaluasi |
| Cari tidak ketemu | "Tidak ada pasal tentang "{kata}". Mau jadikan usulan baru?" |
| Cari nomor tidak ada | "Pasal {N} tidak ada." (atau "Pasal {N} sudah dicabut" + link) |
| Menunggu TTD pasangan | "Menunggu tanda tangan {nama}" |
| Menunggu TTD kamu | "{nama} sudah menandatangani. Giliranmu." + tombol Buka lembar |
| TTD batal karena lembar berubah | "Isi lembar berubah. Tanda tanganmu perlu diulang." |
| Diskusikan dulu | "Ditunda ke evaluasi berikutnya" |
| Kotak TTD kosong | Tombol Simpan nonaktif · "Gambar tanda tanganmu di sini" |
| TTD saat offline | "Butuh koneksi internet untuk menandatangani." |
| Sah | "Disahkan {tanggal} · Riki & Febie" |
| Pasal pranikah | "Teks asli perjanjian pranikah. Tidak bisa diubah, bisa diberi keterangan." |
| Pasal dicabut | "Dicabut {tanggal} · Alasan: …" |

## 13. Kaitan dengan Beranda

- Kartu pengingat evaluasi: jumlah kesepakatan aktif + "1 lembar menunggu tanda tanganmu" (jika ada).
- Tombol "Lihat kesepakatan" → daftar Komitmen; saat hari-H tambah **Mulai evaluasi**.
- Shortcut & bottom nav "Komitmen" → daftar Komitmen.

## 14. Urutan kerja

1. **Fase 4a – Baca & cari.** Tab data, `komitmen.list`, daftar per Bab, A–Z, cari (nomor + isi), halaman pasal.
2. **Fase 4b – Pengesahan & TTD.** Usul baru/ubah/cabut/keterangan, Lembar Pengesahan, kotak TTD, `isi_hash`, kunci pasal pranikah, riwayat.
3. **Fase 4c – Import pranikah.** *Menunggu file dari Riki.* Claude susun tabel → cek berdua → skrip import → TTD berdua.
4. **Fase 4d – Sesi evaluasi.** `Evaluasi`, sambung ke Lembar Pengesahan & kartu pengingat Beranda.

Fase 4a–4b bisa jalan duluan pakai data contoh; 4c menyusul saat file siap.

Tiap fase: demo dulu (`KANTONG_PREVIEW`), cek Playwright 390×844 (termasuk menggambar TTD di layar sentuh), baru deploy. **Desain layar final menunggu Riki**; §9 = acuan sementara.

## 15. Kriteria selesai

- [ ] Ketik "12" / "pasal 12" → Pasal 12 paling atas; Enter → terbuka.
- [ ] Cari "lawan jenis" → semua pasal terkait (termasuk dari keterangan) muncul, ter-highlight, menunjukkan lokasi ("di ayat (2)"), < 1 detik.
- [ ] Tab A–Z hanya berisi Definisi, urut abjad.
- [ ] Ubah Pasal 4 (non-pranikah) → nomor tetap 4, versi naik, versi lama di Riwayat.
- [ ] Pasal pranikah: tombol Ubah/Cabut tidak ada; server menolak ubah/cabut; **+ Keterangan** berfungsi.
- [ ] Teks ayat pranikah sama persis dengan dokumen, ada rujukan asli, masuk Bab "Perjanjian Pranikah".
- [ ] Tidak ada pasal/keterangan berlaku sebelum **dua TTD**; tanggal berlaku = waktu TTD kedua.
- [ ] Satu orang tidak bisa mengisi kotak TTD pasangannya.
- [ ] Lembar diubah setelah TTD pertama → TTD itu batal.
- [ ] "Diskusikan dulu" → item keluar dari lembar, tetap jadi usulan.
- [ ] Cabut pasal → hilang dari "Semua", muncul di "Dicabut"; nomor tidak dipakai ulang.
- [ ] Tidak ada isi asli Komitmen/pranikah di repo.
- [ ] Komitmen tidak muncul di to-do, catatan, atau Google Calendar.
- [ ] Baca & cari jalan offline; TTD menolak saat offline dengan pesan jelas.
- [ ] Tap target ≥ 44 px, kontras ≥ 4.5:1, kotak TTD nyaman di 390 px.
- [ ] `node kantong/tools/test_core.js` lulus + tes baru `komitmen.*`, `keterangan.*`, `pengesahan.*`, `evaluasi.*`.

## 16. Pertanyaan terbuka (tanya Riki, jangan ditebak)

1. **Keterangan** pada pasal pranikah juga wajib TTD berdua? Rekomendasi: ya (konsisten dengan aturan #1).
2. Keterangan hanya untuk pasal pranikah, atau boleh juga untuk pasal biasa? Rekomendasi: pranikah saja — pasal biasa cukup diubah langsung.
3. Daftar **Bab** di luar "Perjanjian Pranikah"? (Contoh arah: Definisi, Batasan dengan Lawan Jenis, Keuangan, Komunikasi & Konflik, Waktu Bersama, Keluarga Besar.)
4. Kalimat pernyataan di atas kotak TTD — mau ditulis sendiri?
5. Boleh **hapus permanen** pasal non-pranikah (misal salah ketik total), atau semua lewat "Cabut"?
6. *(Menunggu)* File perjanjian pranikah — PDF atau foto, dikirim saat dokumen fisik ketemu.
7. *(Baru, §17)* Warna Komitmen: ikut tema pastel yang sekarang dipakai app (butter `--b-rt`, terang + gelap), atau tetap palet gelap `#1C1A13`/`#FCD34D`? Rekomendasi: ikut tema app.

---

## 17. Catatan penyesuaian Claude Code (17 Nov 2026)

**Kenapa ada catatan ini:** pada 16 Nov backend Kantong pindah dari Google Sheet ke **Supabase** (Postgres + Edge Function). Apps Script jadi versi lama, tidak dikembangkan lagi. Brief v3 masih menulis Google Sheet.

**Penyesuaian (rekomendasi, tidak mengubah keputusan final Riki):**
- **Data di Supabase**, bukan Sheet. 6 tabel sama persis dengan §10, nama huruf kecil: `komitmen_bab`, `komitmen_pasal`, `komitmen_versi`, `komitmen_keterangan`, `pengesahan`, `evaluasi`. Kolom tidak diubah.
  - Alasan: satu sumber data dengan Kantong; RLS tanpa policy → hanya Edge Function yang bisa baca/tulis; simpan banyak baris dalam satu transaksi (penting untuk TTD kedua yang mengesahkan banyak item sekaligus).
- **TTD (SVG)** disimpan di kolom teks Postgres. Tidak ada batas "satu sel Sheet" lagi.
- **Privasi §11** tetap: data hanya di database Supabase, tidak di repo/log/file contoh.
- **Skrip import (§7 langkah 4)** kirim ke Edge Function/Supabase, bukan Sheet.
- **Kotak TTD per orang:** kolom `ttd_riki` = user yang buku pribadinya `riki`; `ttd_febie` = pasangan (id user di database `istri`).
- **Aksi `home`** belum ada di backend; Beranda masih membaca cache HP. Ringkasan Komitmen di Beranda diambil dari cache `komitmen.list`.
- **Warna:** app sekarang pakai tema pastel (terang + gelap). Komitmen memakai token butter `--b-rt` yang sama dengan kartu Komitmen di Beranda. Palet gelap §9 menunggu jawaban §16 #7.

**Status Fase 4a (17 Nov):** dikerjakan dengan data contoh. Halaman `public/komitmen.html`. Belum di-deploy; migrasi `supabase/migrations/20261117000000_komitmen.sql` perlu dijalankan di Supabase sebelum rilis.
