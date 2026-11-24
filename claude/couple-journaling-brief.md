# Couple Journaling — brief & keputusan implementasi

Sumber: brief "Couple Journaling: Evaluasi Harian, Mingguan, Bulanan + Brief Family App" (@riki, 24 Nov 2026).
Tempat: Daily Mood › tab **Berdua** (`/daily-mood/?tab=berdua`). Status: v1.10.0.

## Ringkasan brief
- Bukan penentu hubungan: hasil evaluasi = dasar fokus bulan berikutnya, bukan vonis.
- Tanpa persentase. Skala frekuensi (Selalu … Tidak dilakukan) dan kejadian (Ya / Tidak / Belum muncul).
- Item **Bersama** dan **Personal**. Target personal dinilai diri + pasangan (observer):
  sama = Selaras (pertahankan), beda 1 = Hampir selaras (cukup dicatat), beda ≥2 = Perlu dibicarakan (otomatis masuk agenda check-in).
- Beban: harian 3 tap wajib, mingguan 4 wajib, bulanan 2 wajib. Item opsional dimunculkan dari pengaturan.
- Output bulanan: 2 hal paling membaik, 1–2 fokus, target tetap/diganti/dinaikkan, perlu konselor atau tidak.
- Riset pendukung & peringatan (diary harian bisa mengubah persepsi) → harian dibuat ringan, tidak ditampilkan sebagai skor; tren yang ditampilkan mingguan.

## Pemetaan ke aplikasi
| Brief | Implementasi |
|---|---|
| Setup fondasi | Persiapan 3 langkah: fondasi (tujuan, visi, misi) → target personal 1–2 → hari check-in + item opsional |
| Aktif hanya jika keduanya setuju | `cj.setuju` per user. Saat keduanya setuju pertama kali, template bawaan terbit sebagai versi 1 |
| Check-in harian | Kartu per pertanyaan, tap ikon bulan (🌕…🌑) atau ✓/✕/–, catatan opsional ≤280 |
| H7 mood | Diambil otomatis dari entri Daily Mood hari itu. Privat kecuali "Bagikan mood" dinyalakan |
| Antrian topik | H3 "Ya" + catatan → topik minggu itu (terlihat pasangan, dijelaskan di layar). Topik manual juga bisa |
| Check-in mingguan | Mulai (bagikan isian harian) → Topik (Sampaikan: fakta→dampak→permintaan · Rangkum ulang · Tindak lanjut + PIC + tenggat) → Evaluasi → Ringkasan diri vs pasangan → Selesai (tercatat otomatis + durasi). Timer 30 menit sebagai pengingat |
| Review bulanan | Isi B1–B4 → Rekap (check-in x/y minggu, topik dibahas, minggu berat, B5 rekap target, tren kategori) → Keputusan (saran otomatis bisa diganti) |
| Penanda kondisi | M10 privat; yang terlihat pasangan hanya tanda ⚑ di minggu itu |
| Ekspor | Teks/PDF per bulan, tanpa isian harian & item privat |
| Settings pertanyaan | Tampil/sembunyi (peringatan untuk item wajib), ubah teks/jenis/skala/frekuensi, urutan ↑↓, tambah dari template / buat sendiri, catatan on/off, privat, observer. Draft → Preview → (persetujuan) → Publish, berlaku periode berikutnya. Riwayat versi + pulihkan |
| Gamifikasi | Pohon: daun = hari berdua mengisi, cabang = check-in selesai, bunga = review bulanan. Streak per minggu (check-in selesai ATAU keduanya isi harian ≥3 hari). 4 lencana proses. Ucapan + ilustrasi; tanpa konfeti, tanpa leaderboard |
| Aman | Menu "Butuh bantuan?": 112, Healing119 (119 ext. 8 / healing119.id, Kemenkes), kontak konselor kalian |

## Keputusan yang diambil (perlu dicek Riki)
1. Brief menulis "isian H5" untuk antrian topik; diasumsikan maksudnya **H3** (ada hal yang ingin dibahas).
2. **M9** (target kedua) tampil otomatis bila orangnya punya target kedua; item opsional lain tersembunyi sampai dimunculkan.
3. Item bawaan tidak bisa dihapus (hanya disembunyikan) supaya data antar-versi tetap sebanding. Item khusus (target, mood, topik, penanda, rekap) hanya bisa diubah teks/tampil/catatannya.
4. Persetujuan: perubahan yang menyentuh item bukan milik pengusul perlu persetujuan pasangan. Tombol pasangan = **Setujui & terbitkan**. Perubahan item personal milik sendiri langsung bisa terbit.
5. Publish pertama sebelum ada isian apa pun langsung berlaku (tidak menunggu periode berikutnya).
6. Isian boleh menyusul: harian 7 hari, mingguan 2 minggu, bulanan 1 bulan ke belakang.
7. Rekap target bulanan (B5): rata-rata tingkat diri & observer selama minggu-minggu bulan itu, dibulatkan, lalu dibandingkan.
8. Minggu mengikuti ISO 8601 (Senin–Minggu); minggu masuk bulan sesuai hari Kamisnya.

## Belum dikerjakan
- **Notifikasi malam**: app belum punya push server. Sementara: status di kartu Berdua + "Pasanganmu sudah mengisi".
- Urutan dengan drag (pakai tombol ↑↓, lebih aman di HP & aksesibel).
- Enkripsi end-to-end: data dikirim lewat HTTPS dan disimpan di Supabase (disk terenkripsi); pemilik project secara teknis bisa membuka tabel.
- Tindak lanjut otomatis jadi to-do Agenda.
- Sesuai brief "nanti": integrasi keuangan, rekomendasi AI, mode >2 anggota. Uji pengguna dengan keluarga Indonesia.

## Teknis
- Tabel `jurnal_pasangan` (migrasi `20261125000000_couple_journaling.sql`), satu baris per isian/topik/sesi/bulan/set/draft/pref/target, `isi` = JSON.
- Aksi server `cj.*` di `public/shared/core.js` (`cjAksi`), salinan Edge Function via `node kantong/tools/build_core.js`.
- Tes: `node kantong/tools/test_cj.js`, `test_supabase.js` (lewat Edge Function), `test_sql.sh` (skema).
