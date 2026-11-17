/* Kantong — Isi awal mode demo.
   Mode demo dimulai KOSONG: tanpa transaksi, budget, to-do, atau catatan. Yang disiapkan hanya struktur
   supaya form bisa langsung dipakai: buku, 2 user, kategori bawaan, dan kantong bersaldo 0.
   Semua data demo tersimpan di HP ini saja (localStorage k_demo), tidak pernah dikirim ke server.
   Skrip biasa (bukan modul): nama top-level dipakai bersama file js/ lain. Urutan muat ada di tiap index.html halaman. */
'use strict';

function makeDemoSeed() {
  var P = 'riki,istri', ALL = 'riki,istri,rt';
  var kat = [['makan-jajan', 'Makan/jajan', P], ['transportasi', 'Transportasi', P], ['paket-data', 'Paket data', P], ['subscription', 'Subscription', P],
    ['kesehatan', 'Kesehatan', P], ['personal-care', 'Personal care', P], ['belanja-dapur', 'Belanja dapur', 'rt'], ['listrik-air', 'Listrik & air', 'rt'],
    ['kebutuhan-rumah', 'Kebutuhan rumah', 'rt'], ['lain-lain', 'Lain-lain', ALL]]
    .map(function (k, i) { return { id: k[0], nama: k[1], tipe: 'Pengeluaran', buku: k[2], warna: PALETTE[i], hitung: true, aktif: true, urutan: i + 1 }; })
    .concat([{ id: 'gaji', nama: 'Gaji', tipe: 'Pemasukan', buku: ALL, warna: '#34D399', hitung: true, aktif: true, urutan: 20 },
      { id: 'pendapatan-lain', nama: 'Pendapatan lain', tipe: 'Pemasukan', buku: ALL, warna: '#5EEAD4', hitung: true, aktif: true, urutan: 21 },
      { id: C.KAT_REIMBURSE, nama: 'Reimburse masuk', tipe: 'Pemasukan', buku: ALL, warna: '#9CA3AF', hitung: false, aktif: true, urutan: 99 }]);
  var per = todayISO();
  var kan = [['cash-riki', 'Cash', 'Cash', 'riki'], ['rek-riki', 'Rekening', 'Debit', 'riki'],
    ['cash-istri', 'Cash', 'Cash', 'istri'], ['rek-istri', 'Rekening', 'Debit', 'istri'], ['kas-rt', 'Dompet RT', 'Debit', 'rt']]
    .map(function (k, i) { return { id: k[0], nama: k[1], jenis: k[2], buku: k[3], saldo_awal: 0, per_tanggal: per, limit: 0, aktif: true, urutan: i + 1 }; });
  return {
    buku: [{ id: 'riki', nama: 'Riki', tipe: 'Pribadi', pemilik: 'riki', urutan: 1 }, { id: 'istri', nama: 'Febie', tipe: 'Pribadi', pemilik: 'istri', urutan: 2 }, { id: 'rt', nama: 'Rumah Tangga', tipe: 'Bersama', pemilik: '', urutan: 3 }],
    users: [{ id: 'riki', nama: 'Riki', buku: 'riki' }, { id: 'istri', nama: 'Febie', buku: 'istri' }],
    kategori: kat, kantong: kan, budget: [], transaksi: [], todo: [], siklus: [], siklus_atur: []
  };
}
