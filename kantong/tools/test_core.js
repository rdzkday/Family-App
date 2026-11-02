/*
 * Tes core.js tanpa data asli. Jalankan: node kantong/tools/test_core.js
 * Semua data di sini sintetis, aman dipakai di repo publik.
 */
var path = require('path');
var C = require(path.join(__dirname, '..', '..', 'public', 'core.js'));

var lulus = 0, gagal = 0;
function ok(nama, syarat, info) {
  if (syarat) { lulus++; return; }
  gagal++;
  console.log('GAGAL: ' + nama + (info === undefined ? '' : '  -> ' + info));
}
function eq(nama, dapat, harap) { ok(nama, dapat === harap, 'dapat ' + JSON.stringify(dapat) + ', harap ' + JSON.stringify(harap)); }
function lempar(nama, fn) {
  try { fn(); gagal++; console.log('GAGAL: ' + nama + ' -> seharusnya ditolak, tapi lolos'); }
  catch (e) { ok(nama, true); }
}

var NOW = '2026-11-02T10:00:00+07:00';
var BL = '2026-11';

function seed() {
  return {
    Buku: [
      { id: 'riki', nama: 'Riki', tipe: 'Pribadi', pemilik: 'u-riki', urutan: 1 },
      { id: 'istri', nama: 'Febie', tipe: 'Pribadi', pemilik: 'u-febie', urutan: 2 },
      { id: 'rt', nama: 'Rumah Tangga', tipe: 'Bersama', pemilik: '', urutan: 3 }
    ],
    Users: [
      { id: 'u-riki', nama: 'Riki', buku: 'riki' },
      { id: 'u-febie', nama: 'Febie', buku: 'istri' }
    ],
    Kategori: [
      { id: 'makan', nama: 'Makan', tipe: 'Pengeluaran', buku: 'riki,istri,rt', warna: '#FFC2B0', hitung: true, aktif: true, urutan: 1 },
      { id: 'dapur', nama: 'Belanja dapur', tipe: 'Pengeluaran', buku: 'rt', warna: '#B8E6CF', hitung: true, aktif: true, urutan: 2 },
      { id: 'gaji', nama: 'Gaji', tipe: 'Pemasukan', buku: 'riki,istri', warna: '#C9B8FF', hitung: true, aktif: true, urutan: 3 },
      { id: 'titipan', nama: 'Titipan', tipe: 'Pengeluaran', buku: 'riki', warna: '#999999', hitung: false, aktif: true, urutan: 4 }
    ],
    Kantong: [
      { id: 'bca', nama: 'BCA', jenis: 'Debit', buku: 'riki', saldo_awal: 10000000, per_tanggal: '2026-10-31', limit: 0, aktif: true, urutan: 1 },
      { id: 'cash-riki', nama: 'Cash', jenis: 'Cash', buku: 'riki', saldo_awal: 500000, per_tanggal: '2026-10-31', limit: 0, aktif: true, urutan: 2 },
      { id: 'rek-febie', nama: 'Rekening', jenis: 'Debit', buku: 'istri', saldo_awal: 3000000, per_tanggal: '2026-10-31', limit: 0, aktif: true, urutan: 3 },
      { id: 'kas-rt', nama: 'Dompet RT', jenis: 'Debit', buku: 'rt', saldo_awal: 0, per_tanggal: '2026-10-31', limit: 0, aktif: true, urutan: 4 }
    ],
    Budget: [
      { id: BL + '|riki|makan', bulan: BL, buku: 'riki', kategori: 'makan', nominal: 1000000 },
      { id: BL + '|riki|setoran-rt', bulan: BL, buku: 'riki', kategori: 'setoran-rt', nominal: 5000000 },
      { id: BL + '|rt|dapur', bulan: BL, buku: 'rt', kategori: 'dapur', nominal: 3000000 }
    ],
    Transaksi: []
  };
}

function tx(o) {
  var t = { id: o.id, tanggal: o.tanggal || BL + '-05', tipe: o.tipe, nominal: o.nominal,
    buku: o.buku || '', kategori: o.kategori || '', kantong: o.kantong || '', kantong_tujuan: o.tujuan || '',
    keterangan: o.ket || '', reimburse: !!o.reimburse, oleh: o.oleh || 'u-riki', sumber: o.sumber || 'app',
    dibuat: NOW, diubah: '', dihapus: o.dihapus || '', terbayar: o.terbayar || '', tx_balik: o.balik || '' };
  return t;
}

function setup(txs) {
  var s = seed();
  s.Transaksi = (txs || []).slice();
  var store = C.memoryStore(s);
  return store;
}
function usr(store, id) { return C.byId(store.all('Users'))[id]; }
function dbOf(store) {
  var db = {};
  Object.keys(C.SCHEMA).forEach(function (t) { db[t] = store.all(t); });
  return db;
}
function ringkas(store, bukuSel) {
  var db = dbOf(store);
  var bulanTx = db.Transaksi.filter(function (t) { return !t.dihapus && String(t.tanggal).slice(0, 7) === BL; });
  return C.summarize(db, bulanTx, C.effectiveBudget(db, BL), bukuSel);
}
function utangAntara(store, bersama, pribadi) {
  var us = C.computeUtang(dbOf(store));
  var f = us.filter(function (u) { return u.dari === bersama && u.ke === pribadi; })[0];
  return f ? f.jumlah : 0;
}

// ---------------------------------------------------------------- versi
eq('versi core naik ke 1.2.0', C.VERSION, '1.2.0');

// ---------------------------------------------------------------- arah transfer
(function () {
  var db = dbOf(setup());
  eq('pribadi -> bersama = topup', C.arahTransfer(db, tx({ id: 'a', tipe: 'Transfer', nominal: 1, kantong: 'bca', tujuan: 'kas-rt' })), 'topup');
  eq('bersama -> pribadi = ganti', C.arahTransfer(db, tx({ id: 'b', tipe: 'Transfer', nominal: 1, kantong: 'kas-rt', tujuan: 'bca' })), 'ganti');
  eq('dalam buku sendiri bukan keduanya', C.arahTransfer(db, tx({ id: 'c', tipe: 'Transfer', nominal: 1, kantong: 'bca', tujuan: 'cash-riki' })), '');
  eq('antar buku pribadi bukan keduanya', C.arahTransfer(db, tx({ id: 'd', tipe: 'Transfer', nominal: 1, kantong: 'bca', tujuan: 'rek-febie' })), '');
  eq('pengeluaran bukan transfer', C.arahTransfer(db, tx({ id: 'e', tipe: 'Pengeluaran', nominal: 1, buku: 'riki', kategori: 'makan', kantong: 'bca' })), '');
})();

// ---------------------------------------------------------------- topup masuk hitungan
(function () {
  var store = setup([
    tx({ id: 't1', tipe: 'Transfer', nominal: 5000000, buku: 'riki', kantong: 'bca', tujuan: 'kas-rt', ket: 'Topup RT' }),
    tx({ id: 't2', tipe: 'Pengeluaran', nominal: 200000, buku: 'riki', kategori: 'makan', kantong: 'bca' }),
    tx({ id: 't3', tipe: 'Pengeluaran', nominal: 400000, buku: 'rt', kategori: 'dapur', kantong: 'kas-rt' })
  ]);
  var r = ringkas(store, 'riki');
  eq('topup jadi pengeluaran Riki', r.pengeluaran, 5200000);
  eq('porsi setoran terpisah', r.setoran, 5000000);
  eq('topup tidak lagi masuk transfer keluar', r.transferKeluar, 0);
  var katSet = r.perKategori.filter(function (k) { return k.id === 'setoran-rt'; })[0];
  ok('setoran muncul sebagai kategori', !!katSet);
  eq('nominal kategori setoran', katSet ? katSet.total : 0, 5000000);
  eq('budget setoran terbaca', katSet ? katSet.budget : 0, 5000000);
  eq('total budget Riki', r.budgetTotal, 6000000);

  var rt = ringkas(store, 'rt');
  eq('topup jadi pemasukan RT', rt.pemasukan, 5000000);
  eq('porsi setoran masuk', rt.setoranMasuk, 5000000);
  eq('pengeluaran RT tidak kena topup', rt.pengeluaran, 400000);
  var katIn = rt.perMasuk.filter(function (k) { return k.id === 'setoran-rt-in'; })[0];
  ok('setoran masuk muncul di pemasukan RT', !!katIn);

  var all = ringkas(store, 'all');
  eq('tampilan semua tidak dobel hitung topup', all.pengeluaran, 600000);
  eq('tampilan semua tidak catat pemasukan topup', all.pemasukan, 0);
  eq('tampilan semua tidak catat setoran', all.setoran, 0);
})();

// ---------------------------------------------------------------- penggantian bukan pengeluaran
(function () {
  var store = setup([
    tx({ id: 'g1', tipe: 'Transfer', nominal: 300000, buku: 'rt', kantong: 'kas-rt', tujuan: 'bca', ket: 'Ganti talangan' })
  ]);
  var rt = ringkas(store, 'rt');
  eq('penggantian bukan pengeluaran RT', rt.pengeluaran, 0);
  eq('penggantian tercatat transfer keluar RT', rt.transferKeluar, 300000);
  var r = ringkas(store, 'riki');
  eq('penggantian bukan pemasukan Riki', r.pemasukan, 0);
  eq('penggantian tercatat transfer masuk Riki', r.transferMasuk, 300000);
})();

// ---------------------------------------------------------------- daftar talangan
(function () {
  var store = setup([
    tx({ id: 'x1', tanggal: BL + '-03', tipe: 'Pengeluaran', nominal: 150000, buku: 'rt', kategori: 'dapur', kantong: 'bca', ket: 'Pasar' }),
    tx({ id: 'x2', tanggal: BL + '-01', tipe: 'Pengeluaran', nominal: 90000, buku: 'rt', kategori: 'dapur', kantong: 'cash-riki', ket: 'Sayur' }),
    tx({ id: 'x3', tipe: 'Pengeluaran', nominal: 80000, buku: 'rt', kategori: 'dapur', kantong: 'kas-rt', ket: 'Pakai dompet RT' }),
    tx({ id: 'x4', tipe: 'Pengeluaran', nominal: 70000, buku: 'riki', kategori: 'makan', kantong: 'bca', ket: 'Makan sendiri' }),
    tx({ id: 'x5', tipe: 'Pengeluaran', nominal: 60000, buku: 'rt', kategori: 'dapur', kantong: 'bca', ket: 'Sudah lunas', terbayar: BL + '-04', balik: 'ln-x' }),
    tx({ id: 'x6', tipe: 'Pengeluaran', nominal: 50000, buku: 'rt', kategori: 'dapur', kantong: 'bca', ket: 'Reimburse kantor', reimburse: true }),
    tx({ id: 'x7', tipe: 'Pengeluaran', nominal: 40000, buku: 'rt', kategori: 'dapur', kantong: 'bca', ket: 'Dihapus', dihapus: NOW })
  ]);
  var tl = C.computeTalangan(dbOf(store));
  eq('jumlah talangan', tl.length, 2);
  eq('urut dari tanggal paling lama', tl[0].id, 'x2');
  eq('talangan kedua', tl[1].id, 'x1');
  eq('pemilik talangan terbaca', tl[0].pemilik, 'riki');
  eq('buku talangan terbaca', tl[0].buku, 'rt');
  ok('belanja pakai dompet RT bukan talangan', !tl.some(function (t) { return t.id === 'x3'; }));
  ok('belanja buku sendiri bukan talangan', !tl.some(function (t) { return t.id === 'x4'; }));
  ok('yang sudah lunas tidak muncul', !tl.some(function (t) { return t.id === 'x5'; }));
  ok('reimburse kantor bukan talangan', !tl.some(function (t) { return t.id === 'x6'; }));
  ok('yang dihapus tidak muncul', !tl.some(function (t) { return t.id === 'x7'; }));
})();

// ---------------------------------------------------------------- pelunasan: nominal pas
(function () {
  var store = setup([
    tx({ id: 'p1', tipe: 'Pengeluaran', nominal: 150000, buku: 'rt', kategori: 'dapur', kantong: 'bca' }),
    tx({ id: 'p2', tipe: 'Pengeluaran', nominal: 90000, buku: 'rt', kategori: 'dapur', kantong: 'bca' })
  ]);
  eq('utang sebelum lunas', utangAntara(store, 'rt', 'riki'), 240000);
  var res = C.handle(store, usr(store, 'u-febie'), 'talangan.lunas',
    { ids: ['p1', 'p2'], nominal: 240000, kantong: 'kas-rt', kantong_tujuan: 'bca', tanggal: BL + '-10' }, NOW);
  eq('total talangan yang dipilih', res.total, 240000);
  eq('selisih nol', res.selisih, 0);
  eq('transfer tercatat di buku bersama', res.tx.buku, 'rt');
  eq('nominal transfer', res.tx.nominal, 240000);
  eq('utang lunas', utangAntara(store, 'rt', 'riki'), 0);
  eq('daftar talangan kosong', C.computeTalangan(dbOf(store)).length, 0);
  var saldo = C.computeSaldo(dbOf(store)).saldo;
  // BCA keluar 240rb saat belanja, lalu masuk 240rb saat diganti, jadi kembali utuh
  eq('saldo BCA kembali utuh setelah diganti', saldo.bca, 10000000);
  eq('saldo Dompet RT turun', saldo['kas-rt'], -240000);
  var rt = ringkas(store, 'rt');
  eq('pengeluaran RT tetap penuh setelah lunas', rt.pengeluaran, 240000);
})();

// ---------------------------------------------------------------- pelunasan: kurang bayar
(function () {
  var store = setup([
    tx({ id: 'k1', tipe: 'Pengeluaran', nominal: 500000, buku: 'rt', kategori: 'dapur', kantong: 'bca' }),
    tx({ id: 'k2', tipe: 'Pengeluaran', nominal: 500000, buku: 'rt', kategori: 'dapur', kantong: 'bca' })
  ]);
  var res = C.handle(store, usr(store, 'u-febie'), 'talangan.lunas',
    { ids: ['k1', 'k2'], nominal: 600000, kantong: 'kas-rt', kantong_tujuan: 'bca' }, NOW);
  eq('selisih kurang tercatat', res.selisih, -400000);
  eq('sisa utang jalan terus', utangAntara(store, 'rt', 'riki'), 400000);
  eq('transaksi hilang dari daftar talangan', C.computeTalangan(dbOf(store)).length, 0);
})();

// ---------------------------------------------------------------- pelunasan: lebih bayar jadi titipan
(function () {
  var store = setup([
    tx({ id: 'l1', tipe: 'Pengeluaran', nominal: 487500, buku: 'rt', kategori: 'dapur', kantong: 'bca' })
  ]);
  var res = C.handle(store, usr(store, 'u-febie'), 'talangan.lunas',
    { ids: ['l1'], nominal: 500000, kantong: 'kas-rt', kantong_tujuan: 'bca' }, NOW);
  eq('selisih lebih tercatat', res.selisih, 12500);
  eq('kelebihan jadi titipan (utang negatif)', utangAntara(store, 'rt', 'riki'), -12500);
  var saldo = C.computeSaldo(dbOf(store)).saldo;
  // keluar 487.500 saat belanja, masuk 500.000 saat diganti: kelebihan 12.500 nyangkut di kantong Riki
  eq('saldo ikut nominal riil, bukan total talangan', saldo.bca, 10000000 - 487500 + 500000);
})();

// ---------------------------------------------------------------- titipan menutup talangan berikutnya
(function () {
  var store = setup([
    tx({ id: 'c1', tanggal: BL + '-02', tipe: 'Pengeluaran', nominal: 100000, buku: 'rt', kategori: 'dapur', kantong: 'bca' })
  ]);
  C.handle(store, usr(store, 'u-febie'), 'talangan.lunas',
    { ids: ['c1'], nominal: 250000, kantong: 'kas-rt', kantong_tujuan: 'bca' }, NOW);
  eq('titipan setelah lebih bayar', utangAntara(store, 'rt', 'riki'), -150000);
  C.handle(store, usr(store, 'u-riki'), 'tx.save',
    { id: 'c2', tanggal: BL + '-08', tipe: 'Pengeluaran', nominal: 150000, buku: 'rt', kategori: 'dapur', kantong: 'bca', keterangan: 'Belanja lagi' }, NOW);
  eq('talangan baru termakan titipan', utangAntara(store, 'rt', 'riki'), 0);
  eq('tetap muncul di daftar sampai ditandai', C.computeTalangan(dbOf(store)).length, 1);
})();

// ---------------------------------------------------------------- batalkan pelunasan lewat hapus transfer
(function () {
  var store = setup([
    tx({ id: 'b1', tipe: 'Pengeluaran', nominal: 150000, buku: 'rt', kategori: 'dapur', kantong: 'bca' }),
    tx({ id: 'b2', tipe: 'Pengeluaran', nominal: 90000, buku: 'rt', kategori: 'dapur', kantong: 'bca' })
  ]);
  var res = C.handle(store, usr(store, 'u-febie'), 'talangan.lunas',
    { ids: ['b1', 'b2'], nominal: 240000, kantong: 'kas-rt', kantong_tujuan: 'bca' }, NOW);
  C.handle(store, usr(store, 'u-febie'), 'tx.delete', { id: res.tx.id }, NOW);
  eq('dua transaksi balik ke daftar talangan', C.computeTalangan(dbOf(store)).length, 2);
  eq('utang kembali penuh', utangAntara(store, 'rt', 'riki'), 240000);
  var map = C.byId(dbOf(store).Transaksi);
  eq('tanda terbayar dilepas', map.b1.terbayar, '');
  eq('tautan transfer dilepas', map.b1.tx_balik, '');
})();

// ---------------------------------------------------------------- hapus satu talangan, transfer gabungan aman
(function () {
  var store = setup([
    tx({ id: 'h1', tipe: 'Pengeluaran', nominal: 150000, buku: 'rt', kategori: 'dapur', kantong: 'bca' }),
    tx({ id: 'h2', tipe: 'Pengeluaran', nominal: 90000, buku: 'rt', kategori: 'dapur', kantong: 'bca' })
  ]);
  var res = C.handle(store, usr(store, 'u-febie'), 'talangan.lunas',
    { ids: ['h1', 'h2'], nominal: 240000, kantong: 'kas-rt', kantong_tujuan: 'bca' }, NOW);
  C.handle(store, usr(store, 'u-febie'), 'tx.delete', { id: 'h1' }, NOW);
  var map = C.byId(dbOf(store).Transaksi);
  eq('transfer gabungan tidak ikut terhapus', map[res.tx.id].dihapus, '');
  eq('transaksi lain masih lunas', map.h2.terbayar !== '', true);
  eq('kelebihan jadi titipan', utangAntara(store, 'rt', 'riki'), -150000);
})();

// ---------------------------------------------------------------- edit talangan yang sudah lunas
(function () {
  var store = setup([
    tx({ id: 'e1', tipe: 'Pengeluaran', nominal: 150000, buku: 'rt', kategori: 'dapur', kantong: 'bca' }),
    tx({ id: 'e2', tipe: 'Pengeluaran', nominal: 90000, buku: 'rt', kategori: 'dapur', kantong: 'bca' })
  ]);
  var res = C.handle(store, usr(store, 'u-febie'), 'talangan.lunas',
    { ids: ['e1', 'e2'], nominal: 240000, kantong: 'kas-rt', kantong_tujuan: 'bca' }, NOW);
  C.handle(store, usr(store, 'u-riki'), 'tx.save',
    { id: 'e1', tanggal: BL + '-05', tipe: 'Pengeluaran', nominal: 200000, buku: 'rt', kategori: 'dapur', kantong: 'bca', keterangan: 'Nominal dibetulkan' }, NOW);
  var map = C.byId(dbOf(store).Transaksi);
  eq('transfer gabungan tetap utuh saat nominal diedit', map[res.tx.id].nominal, 240000);
  eq('status lunas dipertahankan', map.e1.tx_balik, res.tx.id);
  eq('selisih nominal muncul sebagai utang', utangAntara(store, 'rt', 'riki'), 50000);

  C.handle(store, usr(store, 'u-riki'), 'tx.save',
    { id: 'e2', tanggal: BL + '-05', tipe: 'Pengeluaran', nominal: 90000, buku: 'riki', kategori: 'makan', kantong: 'bca', keterangan: 'Pindah ke buku sendiri' }, NOW);
  var map2 = C.byId(dbOf(store).Transaksi);
  eq('pindah buku melepas tanda lunas', map2.e2.terbayar, '');
  eq('transfer gabungan tetap ada', map2[res.tx.id].dihapus, '');
})();

// ---------------------------------------------------------------- reimburse kantor tidak terganggu
(function () {
  var store = setup([
    tx({ id: 'r1', tipe: 'Pengeluaran', nominal: 300000, buku: 'riki', kategori: 'makan', kantong: 'bca', ket: 'Jamuan klien', reimburse: true })
  ]);
  var sebelum = ringkas(store, 'riki');
  eq('reimburse menunggu tetap dihitung', sebelum.pengeluaran, 300000);
  eq('penanda menunggu terisi', sebelum.reimburseMenunggu, 300000);
  C.handle(store, usr(store, 'u-riki'), 'tx.reimburse', { id: 'r1', bayar: true, kantong: 'bca', tanggal: BL + '-09' }, NOW);
  var sesudah = ringkas(store, 'riki');
  eq('setelah terbayar keluar dari pengeluaran', sesudah.pengeluaran, 0);
  eq('tercatat sebagai reimburse terbayar', sesudah.reimburse, 300000);
  eq('pemasukan otomatis tidak dihitung pendapatan', sesudah.pemasukan, 0);
  ok('reimburse kantor tidak masuk daftar talangan', C.computeTalangan(dbOf(store)).length === 0);
})();

// ---------------------------------------------------------------- kategori otomatis dibuat saat bootstrap
(function () {
  var store = setup([]);
  var boot = C.handle(store, usr(store, 'u-riki'), 'bootstrap', {}, NOW);
  var kmap = C.byId(store.all('Kategori'));
  ok('kategori setoran dibuat', !!kmap['setoran-rt']);
  ok('kategori setoran masuk dibuat', !!kmap['setoran-rt-in']);
  eq('tipe kategori setoran', kmap['setoran-rt'].tipe, 'Pengeluaran');
  eq('setoran dihitung ke budget', C.bool(kmap['setoran-rt'].hitung), true);
  ok('bootstrap mengirim daftar talangan', Array.isArray(boot.talangan));
  var jml = store.all('Kategori').length;
  C.handle(store, usr(store, 'u-riki'), 'bootstrap', {}, NOW);
  eq('bootstrap kedua tidak bikin duplikat', store.all('Kategori').length, jml);
})();

// ---------------------------------------------------------------- validasi dan izin
(function () {
  var store = setup([
    tx({ id: 'v1', tipe: 'Pengeluaran', nominal: 150000, buku: 'rt', kategori: 'dapur', kantong: 'bca' }),
    tx({ id: 'v2', tipe: 'Pengeluaran', nominal: 70000, buku: 'riki', kategori: 'makan', kantong: 'bca' }),
    tx({ id: 'v3', tipe: 'Pengeluaran', nominal: 60000, buku: 'rt', kategori: 'dapur', kantong: 'rek-febie' })
  ]);
  var febie = usr(store, 'u-febie');
  lempar('tanpa transaksi dipilih ditolak', function () {
    C.handle(store, febie, 'talangan.lunas', { ids: [], nominal: 1000, kantong: 'kas-rt', kantong_tujuan: 'bca' }, NOW);
  });
  lempar('nominal nol ditolak', function () {
    C.handle(store, febie, 'talangan.lunas', { ids: ['v1'], nominal: 0, kantong: 'kas-rt', kantong_tujuan: 'bca' }, NOW);
  });
  lempar('kantong asal pribadi ditolak', function () {
    C.handle(store, febie, 'talangan.lunas', { ids: ['v1'], nominal: 1000, kantong: 'bca', kantong_tujuan: 'cash-riki' }, NOW);
  });
  lempar('kantong tujuan bersama ditolak', function () {
    C.handle(store, febie, 'talangan.lunas', { ids: ['v1'], nominal: 1000, kantong: 'kas-rt', kantong_tujuan: 'kas-rt' }, NOW);
  });
  lempar('transaksi buku pribadi ditolak', function () {
    C.handle(store, febie, 'talangan.lunas', { ids: ['v2'], nominal: 1000, kantong: 'kas-rt', kantong_tujuan: 'bca' }, NOW);
  });
  lempar('kantong tujuan tidak cocok pemilik talangan', function () {
    C.handle(store, febie, 'talangan.lunas', { ids: ['v3'], nominal: 1000, kantong: 'kas-rt', kantong_tujuan: 'bca' }, NOW);
  });
  lempar('transaksi tidak dikenal ditolak', function () {
    C.handle(store, febie, 'talangan.lunas', { ids: ['tidak-ada'], nominal: 1000, kantong: 'kas-rt', kantong_tujuan: 'bca' }, NOW);
  });
  C.handle(store, febie, 'talangan.lunas', { ids: ['v1'], nominal: 150000, kantong: 'kas-rt', kantong_tujuan: 'bca' }, NOW);
  lempar('transaksi yang sudah lunas tidak bisa dilunasi dua kali', function () {
    C.handle(store, febie, 'talangan.lunas', { ids: ['v1'], nominal: 150000, kantong: 'kas-rt', kantong_tujuan: 'bca' }, NOW);
  });
  ok('Riki juga boleh mencatat pelunasan (buku bersama)',
    !!C.handle(store, usr(store, 'u-riki'), 'talangan.lunas', { ids: ['v3'], nominal: 60000, kantong: 'kas-rt', kantong_tujuan: 'rek-febie' }, NOW).tx);
})();

// ---------------------------------------------------------------- kategori tak dihitung tetap diabaikan
(function () {
  var store = setup([
    tx({ id: 'n1', tipe: 'Pengeluaran', nominal: 100000, buku: 'riki', kategori: 'titipan', kantong: 'bca' }),
    tx({ id: 'n2', tipe: 'Pengeluaran', nominal: 50000, buku: 'riki', kategori: 'makan', kantong: 'bca' })
  ]);
  eq('kategori hitung=false tidak masuk total', ringkas(store, 'riki').pengeluaran, 50000);
})();

console.log('\n' + lulus + ' cek lulus, ' + gagal + ' gagal.');
process.exit(gagal ? 1 : 0);
