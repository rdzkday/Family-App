/* Kantong — Isi awal mode demo.
   Mode demo dimulai KOSONG: tanpa transaksi, budget, to-do, atau catatan. Yang disiapkan hanya struktur:
   buku, 2 user, dan kantong bersaldo 0. Kategori dipilih lewat template saat Kantong pertama dibuka.
   Semua data demo tersimpan di HP ini saja (localStorage k_demo), tidak pernah dikirim ke server.
   Skrip biasa (bukan modul): nama top-level dipakai bersama file js/ lain. Urutan muat ada di tiap index.html halaman. */
'use strict';

// Naikkan angka ini kalau isi awal demo berubah: data demo lama di HP dibuang sekali (lihat demoTables di base.js).
var DEMO_VERSI = 2;   // 2 = kategori dipilih lewat template (bukan kategori bawaan tetap)

function makeDemoSeed() {
  // Kategori sengaja kosong: mode demo melewati alur yang sama dengan data asli
  // (pilih manajer keuangan -> pilih template -> budget 40:30:20:10) lewat KantongCore.handle.
  var kat = [];
  var per = todayISO();
  var kan = [['cash-riki', 'Cash', 'Cash', 'riki'], ['rek-riki', 'Rekening', 'Debit', 'riki'],
    ['cash-istri', 'Cash', 'Cash', 'istri'], ['rek-istri', 'Rekening', 'Debit', 'istri'], ['kas-rt', 'Dompet RT', 'Debit', 'rt']]
    .map(function (k, i) { return { id: k[0], nama: k[1], jenis: k[2], buku: k[3], saldo_awal: 0, per_tanggal: per, limit: 0, aktif: true, urutan: i + 1 }; });
  return {
    buku: [{ id: 'riki', nama: 'Riki', tipe: 'Pribadi', pemilik: 'riki', urutan: 1 }, { id: 'istri', nama: 'Febie', tipe: 'Pribadi', pemilik: 'istri', urutan: 2 }, { id: 'rt', nama: 'Rumah Tangga', tipe: 'Bersama', pemilik: '', urutan: 3, manajer: '' }],
    users: [{ id: 'riki', nama: 'Riki', buku: 'riki' }, { id: 'istri', nama: 'Febie', buku: 'istri' }],
    kategori: kat, kantong: kan, budget: [], transaksi: [], todo: [], siklus: [], siklus_atur: []
  };
}
