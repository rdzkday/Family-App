/*
 * Konfigurasi Siklus: SATU project Supabase dengan Kantong, modul terpisah (tabel & fungsi siklus_*).
 * Isi setelah migrasi dijalankan (lihat kantong/PANDUAN.md bagian Siklus):
 *   url     : boleh kosong; otomatis diambil dari kode koneksi Kantong (https://xxxx.supabase.co).
 *   anonKey : Project Settings > API > anon public key. Kunci ini memang publik; data dijaga fungsi server + login OTP.
 *   pemilik : id user Kantong yang memiliki catatan (default 'febie').
 * Kosong = Siklus belum disiapkan (fitur lain tetap jalan; mode demo tetap bisa mencoba Siklus).
 */
window.SIKLUS_CONFIG = {
  url: '',
  anonKey: '',
  pemilik: 'febie'
};
