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

// ---------------------------------------------------------------- versi & salinan core
eq('versi core naik ke 1.6.0', C.VERSION, '1.6.0');
(function () {
  // core.mjs (Edge Function Supabase) harus persis hasil build_core.js
  var fs = require('fs'), build = require(path.join(__dirname, 'build_core.js'));
  Object.keys(build.targets).forEach(function (f) {
    var ada = fs.readFileSync(path.join(__dirname, '..', '..', f), 'utf8');
    ok('salinan core sinkron: ' + f + ' (jalankan node kantong/tools/build_core.js)', ada === build.targets[f]);
  });
})();

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

// ================================================================ todo.*
function todoStore() { var st = setup([]); return st; }
function todoCall(store, uid, action, payload, now) { return C.handle(store, usr(store, uid), action, payload, now || NOW); }
function todoById(store, id) { return C.byId(store.all('Todo'))[id]; }

// ---------------------------------------------------------------- todo: tanpa waktu tidak membuat event
(function () {
  var st = todoStore();
  var r = todoCall(st, 'u-riki', 'todo.save', { id: 'td1', judul: '  Beli   galon ' });
  eq('todo.judul dirapikan', r.todo.judul, 'Beli galon');
  eq('todo.pemilik default diri sendiri', r.todo.pemilik, 'u-riki');
  eq('todo.tanpa waktu: tidak ada event', r.todo.gcal_event_id, '');
  eq('todo.tanpa waktu: status kosong', r.todo.gcal_status, '');
  eq('todo.tanpa waktu: kalender tidak disentuh', Object.keys(st.calendar.events).length, 0);
  eq('todo.durasi default 30', r.todo.durasi, 30);
  eq('todo.oleh tercatat', r.todo.oleh, 'u-riki');
})();

// ---------------------------------------------------------------- todo: dengan waktu masuk kalender
(function () {
  var st = todoStore();
  var r = todoCall(st, 'u-febie', 'todo.save', { id: 'td2', judul: 'Jemput paket', tanggal: '2026-11-18', jam: '14:00', durasi: 45 });
  eq('todo.event dibuat', r.todo.gcal_status, 'ok');
  ok('todo.id event tersimpan', !!r.todo.gcal_event_id);
  var ev = st.calendar.events[r.todo.gcal_event_id];
  eq('todo.judul event pakai prefix inisial', ev.judul, '[F] Jemput paket');
  eq('todo.event mulai', ev.mulai, '2026-11-18T14:00');
  eq('todo.event akhir ikut durasi', ev.akhir, '2026-11-18T14:45');
  eq('todo.event bukan seharian', ev.seharian, false);
  eq('todo.warna per pemilik (user kedua)', ev.warna, 1);
  var b = todoCall(st, 'u-riki', 'todo.save', { id: 'td3', judul: 'Bayar listrik', pemilik: 'bersama', tanggal: '2026-11-20' });
  var evb = st.calendar.events[b.todo.gcal_event_id];
  eq('todo.bersama pakai prefix [B]', evb.judul, '[B] Bayar listrik');
  eq('todo.tanggal tanpa jam = seharian', evb.seharian, true);
  eq('todo.warna bersama', evb.warna, 'bersama');
  eq('todo.jam kosong tidak menghasilkan mulai', evb.mulai, undefined);
})();

// ---------------------------------------------------------------- todo: ubah waktu, hapus waktu, hapus to-do
(function () {
  var st = todoStore();
  var r = todoCall(st, 'u-riki', 'todo.save', { id: 'td4', judul: 'Servis AC', tanggal: '2026-11-18', jam: '09:00' });
  var evId = r.todo.gcal_event_id;
  r = todoCall(st, 'u-riki', 'todo.save', { id: 'td4', judul: 'Servis AC', tanggal: '2026-11-19', jam: '10:30', durasi: 60 });
  eq('todo.ubah waktu: event yang sama dipakai', r.todo.gcal_event_id, evId);
  eq('todo.ubah waktu: event pindah', st.calendar.events[evId].mulai, '2026-11-19T10:30');
  eq('todo.ubah waktu: hanya 1 event', Object.keys(st.calendar.events).length, 1);
  r = todoCall(st, 'u-riki', 'todo.save', { id: 'td4', judul: 'Servis AC', tanggal: '' });
  eq('todo.hapus waktu: event dihapus', Object.keys(st.calendar.events).length, 0);
  eq('todo.hapus waktu: id event dikosongkan', r.todo.gcal_event_id, '');
  eq('todo.hapus waktu: to-do tetap ada', todoById(st, 'td4').dihapus, '');
  r = todoCall(st, 'u-riki', 'todo.save', { id: 'td4', judul: 'Servis AC', tanggal: '2026-11-21', jam: '08:00' });
  ok('todo.pasang waktu lagi: event baru', !!r.todo.gcal_event_id && Object.keys(st.calendar.events).length === 1);
  todoCall(st, 'u-riki', 'todo.delete', { id: 'td4' });
  eq('todo.hapus to-do: event ikut terhapus', Object.keys(st.calendar.events).length, 0);
  ok('todo.hapus to-do: soft delete', !!todoById(st, 'td4').dihapus);
  ok('todo.hapus kedua kali idempoten', !!todoCall(st, 'u-riki', 'todo.delete', { id: 'td4' }).id);
  eq('todo.list tidak memuat yang dihapus', todoCall(st, 'u-riki', 'todo.list', {}).todos.length, 0);
  lempar('todo.simpan ulang yang sudah dihapus ditolak', function () { todoCall(st, 'u-riki', 'todo.save', { id: 'td4', judul: 'X' }); });
})();

// ---------------------------------------------------------------- todo: selesai
(function () {
  var st = todoStore();
  todoCall(st, 'u-riki', 'todo.save', { id: 'td5', judul: 'Bayar listrik', pemilik: 'bersama', tanggal: '2026-11-18', jam: '19:00' });
  var r = todoCall(st, 'u-febie', 'todo.done', { id: 'td5', selesai: true });
  eq('todo.selesai tercatat', r.todo.selesai, true);
  eq('todo.siapa yang menyelesaikan', r.todo.selesai_oleh, 'u-febie');
  var ev = st.calendar.events[r.todo.gcal_event_id];
  eq('todo.selesai: event dibiarkan, judul diberi centang', ev.judul, '[B] ✓ Bayar listrik');
  eq('todo.selesai: event tidak dihapus', Object.keys(st.calendar.events).length, 1);
  r = todoCall(st, 'u-riki', 'todo.done', { id: 'td5', selesai: false });
  eq('todo.batal selesai: centang hilang', st.calendar.events[r.todo.gcal_event_id].judul, '[B] Bayar listrik');
  eq('todo.batal selesai: selesai_oleh kosong', r.todo.selesai_oleh, '');
})();

// ---------------------------------------------------------------- todo: izin
(function () {
  var st = todoStore();
  todoCall(st, 'u-riki', 'todo.save', { id: 'tr', judul: 'Punya Riki' });
  todoCall(st, 'u-febie', 'todo.save', { id: 'tf', judul: 'Punya Febie', tanggal: '2026-11-18' });
  todoCall(st, 'u-riki', 'todo.save', { id: 'tb', judul: 'Bersama', pemilik: 'bersama' });
  var semua = todoCall(st, 'u-febie', 'todo.list', {}).todos;
  eq('todo.semua orang bisa lihat semua', semua.length, 3);
  var untukku = semua.filter(function (t) { return C.canWriteTodo(usr(st, 'u-febie'), t); }).map(function (t) { return t.id; }).sort();
  eq('todo.filter Untukku Febie = milik Febie + bersama', untukku.join(','), 'tb,tf');
  lempar('todo.Febie tidak bisa ubah milik Riki', function () { todoCall(st, 'u-febie', 'todo.save', { id: 'tr', judul: 'Diubah' }); });
  lempar('todo.Febie tidak bisa centang milik Riki', function () { todoCall(st, 'u-febie', 'todo.done', { id: 'tr', selesai: true }); });
  lempar('todo.Febie tidak bisa hapus milik Riki', function () { todoCall(st, 'u-febie', 'todo.delete', { id: 'tr' }); });
  lempar('todo.Riki tidak bisa ubah milik Febie', function () { todoCall(st, 'u-riki', 'todo.save', { id: 'tf', judul: 'Diubah' }); });
  eq('todo.milik Riki tidak berubah', todoById(st, 'tr').judul, 'Punya Riki');
  ok('todo.Febie bisa ubah bersama', !!todoCall(st, 'u-febie', 'todo.save', { id: 'tb', judul: 'Bersama diubah' }).todo);
  ok('todo.Riki bisa buat to-do untuk Febie', !!todoCall(st, 'u-riki', 'todo.save', { id: 'tf2', judul: 'Untuk Febie', pemilik: 'u-febie' }).todo);
  lempar('todo.setelah dibuat untuk Febie, Riki tidak bisa ubah lagi', function () { todoCall(st, 'u-riki', 'todo.save', { id: 'tf2', judul: 'X' }); });
  lempar('todo.pemilik tidak dikenal ditolak', function () { todoCall(st, 'u-riki', 'todo.save', { id: 'tx', judul: 'X', pemilik: 'orang-lain' }); });
})();

// ---------------------------------------------------------------- todo: validasi
(function () {
  var st = todoStore();
  lempar('todo.judul kosong ditolak', function () { todoCall(st, 'u-riki', 'todo.save', { id: 'v1', judul: '   ' }); });
  lempar('todo.tanggal salah ditolak', function () { todoCall(st, 'u-riki', 'todo.save', { id: 'v1', judul: 'X', tanggal: '18-11-2026' }); });
  lempar('todo.jam salah ditolak', function () { todoCall(st, 'u-riki', 'todo.save', { id: 'v1', judul: 'X', tanggal: '2026-11-18', jam: '25:00' }); });
  lempar('todo.durasi terlalu kecil ditolak', function () { todoCall(st, 'u-riki', 'todo.save', { id: 'v1', judul: 'X', tanggal: '2026-11-18', jam: '10:00', durasi: 1 }); });
  lempar('todo.id kosong ditolak', function () { todoCall(st, 'u-riki', 'todo.save', { judul: 'X' }); });
  var r = todoCall(st, 'u-riki', 'todo.save', { id: 'v2', judul: 'X', jam: '10:00' });
  eq('todo.jam tanpa tanggal diabaikan', r.todo.jam, '');
  var panjang = new Array(200).join('a');
  eq('todo.judul dipotong 120', todoCall(st, 'u-riki', 'todo.save', { id: 'v3', judul: panjang }).todo.judul.length, 120);
  eq('todo.event lewat tengah malam', C.todoEventSpec({ id: 'x', judul: 'X', pemilik: 'u-riki', tanggal: '2026-12-31', jam: '23:50', durasi: 30 }, dbOf(st)).akhir, '2027-01-01T00:20');
})();

// ---------------------------------------------------------------- todo: kalender gagal -> to-do tetap tersimpan, bisa coba lagi
(function () {
  var st = todoStore();
  st.calendar.gagal = 'Kalender tidak bisa diakses';
  var r = todoCall(st, 'u-riki', 'todo.save', { id: 'g1', judul: 'Dokter gigi', tanggal: '2026-11-18', jam: '15:00' });
  eq('todo.gagal: to-do tetap tersimpan', todoById(st, 'g1').judul, 'Dokter gigi');
  eq('todo.gagal: status gagal', r.todo.gcal_status, 'gagal');
  eq('todo.gagal: pesan tersimpan', r.todo.gcal_error, 'Kalender tidak bisa diakses');
  eq('todo.gagal: tidak ada event', r.todo.gcal_event_id, '');
  st.calendar.gagal = '';
  r = todoCall(st, 'u-riki', 'todo.sync', { id: 'g1' });
  eq('todo.coba lagi: berhasil', r.todo.gcal_status, 'ok');
  ok('todo.coba lagi: event dibuat', !!st.calendar.events[r.todo.gcal_event_id]);
  lempar('todo.coba lagi milik orang lain ditolak', function () { todoCall(st, 'u-febie', 'todo.sync', { id: 'g1' }); });
  // tanpa adapter kalender sama sekali (server belum setup)
  var st2 = todoStore(); st2.calendar = null;
  var r2 = todoCall(st2, 'u-riki', 'todo.save', { id: 'g2', judul: 'X', tanggal: '2026-11-18' });
  eq('todo.tanpa kalender: status gagal jelas', r2.todo.gcal_status, 'gagal');
  eq('todo.tanpa kalender: to-do tanpa waktu tetap bersih', todoCall(st2, 'u-riki', 'todo.save', { id: 'g3', judul: 'Y' }).todo.gcal_status, '');
})();

// ---------------------------------------------------------------- todo: request ulang (offline/retry) tidak bikin event dobel
(function () {
  var st = todoStore();
  var p = { id: 'd1', judul: 'Arisan', tanggal: '2026-11-22', jam: '16:00', durasi: 30 };
  var a = todoCall(st, 'u-riki', 'todo.save', p);
  var b = todoCall(st, 'u-riki', 'todo.save', p);
  eq('todo.ulang: event sama', b.todo.gcal_event_id, a.todo.gcal_event_id);
  eq('todo.ulang: tetap 1 event', Object.keys(st.calendar.events).length, 1);
  var r = todoCall(st, 'u-riki', 'batch', { ops: [
    { opId: 'a', action: 'todo.save', payload: p },
    { opId: 'b', action: 'todo.done', payload: { id: 'd1', selesai: true } },
    { opId: 'c', action: 'todo.list' }
  ] });
  eq('todo.batch semua ok', r.results.map(function (x) { return x.ok; }).join(','), 'true,true,true');
  eq('todo.batch list memuat hasil terbaru', r.results[2].data.todos[0].selesai, true);
  eq('todo.batch tetap 1 event', Object.keys(st.calendar.events).length, 1);
})();

// ---------------------------------------------------------------- todo: list membuang yang selesai lama
(function () {
  var st = todoStore();
  todoCall(st, 'u-riki', 'todo.save', { id: 'l1', judul: 'Lama' }, '2026-09-01T10:00:00+07:00');
  todoCall(st, 'u-riki', 'todo.done', { id: 'l1', selesai: true }, '2026-09-02T10:00:00+07:00');
  todoCall(st, 'u-riki', 'todo.save', { id: 'l2', judul: 'Baru selesai' });
  todoCall(st, 'u-riki', 'todo.done', { id: 'l2', selesai: true });
  todoCall(st, 'u-riki', 'todo.save', { id: 'l3', judul: 'Belum selesai' }, '2026-09-01T10:00:00+07:00');
  var ids = todoCall(st, 'u-riki', 'todo.list', {}).todos.map(function (t) { return t.id; }).sort().join(',');
  eq('todo.list: selesai lama disembunyikan, yang belum selesai tetap', ids, 'l2,l3');
})();

// ================================================================ catatan & agenda evaluasi (Beranda)
(function () {
  var st = todoStore();
  var r = todoCall(st, 'u-riki', 'todo.save', { id: 'c1', tipe: 'catatan', isi: 'Ide kado Ibu\nsyal rajut', tanggal: '2026-11-20', jam: '10:00' });
  eq('catatan: judul dari baris pertama', r.todo.judul, 'Ide kado Ibu');
  eq('catatan: isi utuh', r.todo.isi, 'Ide kado Ibu\nsyal rajut');
  eq('catatan: waktu dibuang', r.todo.tanggal + '|' + r.todo.jam, '|');
  eq('catatan: tidak pernah masuk kalender', Object.keys(st.calendar.events).length, 0);
  eq('catatan: tipe tersimpan', todoById(st, 'c1').tipe, 'catatan');
  lempar('catatan: tidak bisa dicentang', function () { todoCall(st, 'u-riki', 'todo.done', { id: 'c1', selesai: true }); });
  lempar('catatan kosong ditolak', function () { todoCall(st, 'u-riki', 'todo.save', { id: 'c2', tipe: 'catatan', isi: '  ' }); });
  var b = todoCall(st, 'u-febie', 'todo.save', { id: 'c3', tipe: 'catatan', isi: 'Daftar belanja', pemilik: 'bersama' });
  eq('catatan bersama boleh', b.todo.pemilik, 'bersama');
  lempar('catatan pribadi orang lain tidak bisa diubah', function () { todoCall(st, 'u-febie', 'todo.save', { id: 'c1', tipe: 'catatan', isi: 'x' }); });
  var lama = todoCall(st, 'u-riki', 'todo.save', { id: 'o1', judul: 'Baris lama tanpa tipe' });
  st.data.Todo.forEach(function (x) { if (x.id === 'o1') x.tipe = ''; });
  eq('baris lama tanpa tipe dianggap to-do', C.todoTipe(todoById(st, 'o1')), 'todo');
  ok('tipe ngawur ditolak', (function () { try { todoCall(st, 'u-riki', 'todo.save', { id: 'z', judul: 'x', tipe: 'rahasia' }); return false; } catch (e) { return true; } })());
  void lama;
})();

(function () {
  var st = todoStore();
  lempar('evaluasi tanpa tanggal ditolak', function () { todoCall(st, 'u-riki', 'todo.save', { id: 'e0', tipe: 'evaluasi' }); });
  var r = todoCall(st, 'u-riki', 'todo.save', { id: 'e1', tipe: 'evaluasi', tanggal: '2026-11-29', jam: '19:00', durasi: 60 });
  eq('evaluasi: judul default', r.todo.judul, 'Evaluasi bulanan');
  eq('evaluasi: default bersama', r.todo.pemilik, 'bersama');
  eq('evaluasi: masuk kalender', r.todo.gcal_status, 'ok');
  eq('evaluasi: prefix [B]', st.calendar.events[r.todo.gcal_event_id].judul, '[B] Evaluasi bulanan');
  var todos = st.all('Todo');
  eq('pengingat: 7 jam sebelum belum muncul', C.evaluasiPengingat(todos, '2026-11-29T12:00'), null);
  var p = C.evaluasiPengingat(todos, '2026-11-29T13:00');
  ok('pengingat: tepat 6 jam sebelum muncul', !!p);
  eq('pengingat: sisa menit', p && p.menit, 360);
  ok('pengingat: selama acara masih muncul', !!C.evaluasiPengingat(todos, '2026-11-29T19:30'));
  eq('pengingat: setelah acara selesai hilang', C.evaluasiPengingat(todos, '2026-11-29T20:00'), null);
  todoCall(st, 'u-febie', 'todo.done', { id: 'e1', selesai: true });
  eq('pengingat: evaluasi selesai tidak muncul', C.evaluasiPengingat(st.all('Todo'), '2026-11-29T15:00'), null);
  todoCall(st, 'u-riki', 'todo.save', { id: 'e2', tipe: 'evaluasi', tanggal: '2026-12-27' });
  ok('pengingat: seharian muncul mulai 18.00 hari sebelumnya', !!C.evaluasiPengingat(st.all('Todo'), '2026-12-26T18:00') && !C.evaluasiPengingat(st.all('Todo'), '2026-12-26T17:59'));
  todoCall(st, 'u-riki', 'todo.save', { id: 'b1', judul: 'To-do biasa', tanggal: '2026-12-27', jam: '09:00' });
  eq('pengingat: to-do biasa tidak dihitung', C.evaluasiPengingat(st.all('Todo'), '2026-12-27T08:00').todo.id, 'e2');
})();

// ================================================================ KOMITMEN (Fase 4a: baca & cari)
// Isi di bawah sintetis/placeholder, BUKAN isi kesepakatan asli.
function komitmenSeed() {
  var s = seed();
  var T1 = '2026-10-01T20:00:00+07:00', T2 = '2026-11-01T20:00:00+07:00';
  var A = function (x) { return JSON.stringify(x); };
  s.KomitmenBab = [
    { id: 'bab-def', nomor: 'II', judul: 'Definisi', urutan: 2, dibuat_at: T1, dihapus: '' },
    { id: 'bab-pra', nomor: 'I', judul: 'Perjanjian Pranikah', urutan: 1, dibuat_at: T1, dihapus: '' },
    { id: 'bab-lama', nomor: 'IX', judul: 'Terhapus', urutan: 9, dibuat_at: T1, dihapus: T2 }
  ];
  var P = function (id, nomor, bab, tipe, judul, status, versiId, extra) {
    var o = { id: id, nomor: nomor, bab_id: bab, tipe: tipe, judul: judul, kata_kunci: '', sumber_asal: 'app', rujukan_asli: '', terkunci: false,
      status: status, versi_berlaku_id: versiId, dibuat_oleh: 'u-riki', dibuat_at: T1, diubah_at: T1, dihapus: '' };
    Object.keys(extra || {}).forEach(function (k) { o[k] = extra[k]; });
    return o;
  };
  s.KomitmenPasal = [
    P('p3', 3, 'bab-pra', 'kesepakatan', 'Harta bawaan', 'berlaku', 'v3-1', { sumber_asal: 'pranikah', terkunci: 'TRUE', rujukan_asli: 'Pasal 3 Perjanjian Pranikah', kata_kunci: 'aset, harta' }),
    P('p4', 4, 'bab-def', 'kesepakatan', 'Chat pribadi', 'berlaku', 'v4-2'),
    P('p12', 12, 'bab-def', 'kesepakatan', 'Waktu berdua', 'berlaku', 'v12-1', { kata_kunci: 'kencan' }),
    P('p13', 13, 'bab-pra', 'kesepakatan', 'Utang', 'berlaku', 'v13-1', { sumber_asal: 'pranikah', terkunci: true, rujukan_asli: 'Pasal 13 Perjanjian Pranikah' }),
    P('p16', 16, 'bab-def', 'definisi', 'Selingkuh', 'berlaku', 'v16-1'),
    P('p17', 17, 'bab-def', 'definisi', 'Lawan jenis', 'berlaku', 'v17-1'),
    P('p18', 18, 'bab-def', 'kesepakatan', 'Aturan lama', 'dicabut', 'v18-2'),
    P('p19', 19, 'bab-def', 'kesepakatan', 'Usulan baru', 'usulan', ''),
    P('p20', 20, 'bab-def', 'kesepakatan', 'Salah input', 'berlaku', 'v20-1', { dihapus: T2 })
  ];
  var V = function (id, pasal, versi, ayat, jenis, status, sejak, sah, alasan) {
    return { id: id, pasal_id: pasal, versi: versi, isi_ayat: typeof ayat === 'string' ? ayat : A(ayat), alasan: alasan || '', jenis: jenis, sumber: 'evaluasi',
      evaluasi_id: '', pengesahan_id: sah || '', status: status, berlaku_sejak: sejak || '', dibuat_oleh: 'u-riki', dibuat_at: sejak || T2 };
  };
  s.KomitmenVersi = [
    V('v3-1', 'p3', 1, ['[Contoh] Harta yang dibawa sebelum menikah tetap milik masing-masing.', '[Contoh] Hasilnya juga.'], 'baru', 'berlaku', T1, 'sah-pra'),
    V('v4-1', 'p4', 1, ['Versi lama ayat satu.'], 'baru', 'digantikan', T1, 'sah-pra'),
    V('v4-2', 'p4', 2, ['Chat dengan lawan jenis secukupnya.', 'Tidak menyembunyikan percakapan yang bisa dianggap selingkuh.'], 'ubah', 'berlaku', T2, 'sah-okt', 'Diperjelas'),
    V('v4-3', 'p4', 3, ['Usulan perubahan.'], 'ubah', 'usulan', '', 'sah-nov'),
    V('v12-1', 'p12', 1, ['Satu malam per minggu tanpa HP.'], 'baru', 'berlaku', T1, 'sah-pra'),
    V('v13-1', 'p13', 1, ['Utang 12 bulan sebelum menikah ditanggung sendiri.'], 'baru', 'berlaku', T1, 'sah-pra'),
    V('v16-1', 'p16', 1, 'Selingkuh adalah [placeholder].', 'baru', 'berlaku', T1, 'sah-pra'),
    V('v17-1', 'p17', 1, ['Lawan jenis adalah [placeholder].'], 'baru', 'berlaku', T1, 'sah-pra'),
    V('v18-1', 'p18', 1, ['Isi aturan lama.'], 'baru', 'digantikan', T1, 'sah-pra'),
    V('v18-2', 'p18', 2, [], 'cabut', 'berlaku', T2, 'sah-okt', 'Sudah tidak relevan'),
    V('v19-1', 'p19', 1, ['Isi usulan.'], 'baru', 'usulan', '', 'sah-nov'),
    V('v20-1', 'p20', 1, ['Terhapus permanen.'], 'baru', 'berlaku', T1, 'sah-pra')
  ];
  var K = function (id, pasal, isi, status, sejak, jenis) {
    return { id: id, pasal_id: pasal, isi: isi, menggantikan_id: '', jenis: jenis || 'baru', evaluasi_id: '', pengesahan_id: 'sah-okt', status: status,
      berlaku_sejak: sejak, dibuat_oleh: 'u-febie', dibuat_at: sejak || T2 };
  };
  s.KomitmenKeterangan = [
    K('k2', 'p3', 'Keterangan kedua, termasuk hadiah dari lawan jenis.', 'berlaku', T2),
    K('k1', 'p3', 'Keterangan pertama.', 'berlaku', T1),
    K('k0', 'p3', 'Keterangan yang sudah diganti.', 'digantikan', T1),
    K('k9', 'p3', 'Keterangan usulan.', 'usulan', '')
  ];
  s.Pengesahan = [
    { id: 'sah-pra', judul: 'Perjanjian Pranikah', jenis: 'pranikah', evaluasi_id: '', ttd_riki: 'M0 0L10 10', ttd_riki_at: T1, ttd_febie: 'M0 10L10 0', ttd_febie_at: T1, isi_hash: 'x', status: 'sah', dibuat_at: T1 },
    { id: 'sah-okt', judul: 'Evaluasi Okt 2026', jenis: 'evaluasi', evaluasi_id: '', ttd_riki: 'M1 1', ttd_riki_at: T2, ttd_febie: 'M2 2', ttd_febie_at: T2, isi_hash: 'y', status: 'sah', dibuat_at: T2 },
    { id: 'sah-nov', judul: 'Evaluasi Nov 2026', jenis: 'evaluasi', evaluasi_id: '', ttd_riki: 'M3 3', ttd_riki_at: T2, ttd_febie: '', ttd_febie_at: '', isi_hash: 'z', status: 'menunggu', dibuat_at: T2 },
    { id: 'sah-batal', judul: 'Batal', jenis: 'tunggal', evaluasi_id: '', ttd_riki: '', ttd_riki_at: '', ttd_febie: '', ttd_febie_at: '', isi_hash: '', status: 'batal', dibuat_at: T2 }
  ];
  return s;
}
function komCall(st, uid, action, payload) {
  var u = st.all('Users').filter(function (x) { return x.id === uid; })[0];
  return C.handle(st, u, action, payload || {}, NOW);
}

(function () {
  var st = C.memoryStore(komitmenSeed());
  var L = komCall(st, 'u-riki', 'komitmen.list');
  var by = {}; L.pasal.forEach(function (p) { by[p.nomor] = p; });
  eq('komitmen.bab urut & yang dihapus hilang', L.bab.map(function (b) { return b.nomor; }).join(','), 'I,II');
  eq('komitmen.pasal terhapus tidak dikirim', !!by[20], false);
  eq('komitmen.urut nomor', L.pasal.map(function (p) { return p.nomor; }).join(','), '3,4,12,13,16,17,18,19');
  eq('komitmen.jumlah berlaku', L.berlaku, 6);
  // pranikah
  eq('komitmen.pranikah terkunci', by[3].terkunci, true);
  eq('komitmen.pranikah sumber_asal', by[3].sumber_asal, 'pranikah');
  eq('komitmen.kata kunci jadi array', by[3].kata_kunci.join('|'), 'aset|harta');
  eq('komitmen.ayat dari JSON', by[3].ayat.length, 2);
  eq('komitmen.ayat teks biasa = satu ayat', by[16].ayat.join('|'), 'Selingkuh adalah [placeholder].');
  eq('komitmen.keterangan hanya yang berlaku, urut tanggal', by[3].keterangan.map(function (k) { return k.id; }).join(','), 'k1,k2');
  eq('komitmen.ada usulan keterangan ditandai', by[3].ada_usulan, true);
  // versi
  eq('komitmen.ubah: tampil versi 2', by[4].versi, 2);
  eq('komitmen.ubah: isi versi berlaku, bukan usulan', by[4].ayat[0], 'Chat dengan lawan jenis secukupnya.');
  eq('komitmen.ubah: tanggal = TTD versi berlaku', by[4].berlaku_sejak, '2026-11-01T20:00:00+07:00');
  eq('komitmen.ubah: usulan perubahan ditandai', by[4].ada_usulan, true);
  eq('komitmen.versi 1 tanpa usulan', by[12].ada_usulan, false);
  // cabut & usulan
  eq('komitmen.dicabut: status', by[18].status, 'dicabut');
  eq('komitmen.dicabut: isi terakhir tetap terbaca', by[18].ayat[0], 'Isi aturan lama.');
  eq('komitmen.dicabut: alasan', by[18].dicabut && by[18].dicabut.alasan, 'Sudah tidak relevan');
  eq('komitmen.usulan pasal baru: isi usulan tampil', by[19].ayat[0], 'Isi usulan.');
  eq('komitmen.usulan pasal baru: belum ada tanggal berlaku', by[19].berlaku_sejak, '');
  eq('komitmen.usulan pasal baru: belum ada TTD', by[19].pengesahan_id, '');
  // pengesahan
  ok('komitmen.lembar dirujuk ikut dikirim', !!L.pengesahan['sah-pra'] && !!L.pengesahan['sah-okt']);
  eq('komitmen.lembar yang belum sah tidak dikirim sebagai TTD pasal', !!L.pengesahan['sah-nov'], false);
  eq('komitmen.menunggu TTD Riki (sudah TTD)', L.menunggu_ttd, 0);
  eq('komitmen.menunggu TTD Febie', komCall(st, 'u-febie', 'komitmen.list').menunggu_ttd, 1);
  eq('komitmen.slot TTD Riki', C.slotTtd({ id: 'u-riki', buku: 'riki' }), 'riki');
  eq('komitmen.slot TTD pasangan', C.slotTtd({ id: 'istri', buku: 'istri' }), 'febie');
  // lihat juga
  eq('komitmen.lihat juga definisi Selingkuh', by[16].lihat_juga.join(','), '4');
  eq('komitmen.lihat juga definisi Lawan jenis (ayat + keterangan)', by[17].lihat_juga.join(','), '3,4');
  eq('komitmen.lihat juga hanya untuk definisi', by[4].lihat_juga.length, 0);
  // tidak menyentuh kalender
  eq('komitmen.tidak membuat event kalender', Object.keys(st.calendar.events).length, 0);
  // riwayat
  var H = komCall(st, 'u-febie', 'komitmen.history', { pasal_id: 'p4' });
  eq('komitmen.history terbaru dulu', H.riwayat.map(function (r) { return r.id; }).join(','), 'v4-3,v4-2,v4-1');
  eq('komitmen.history judul lembar', H.riwayat[1].pengesahan_judul, 'Evaluasi Okt 2026');
  ok('komitmen.history pranikah memuat keterangan', komCall(st, 'u-riki', 'komitmen.history', { pasal_id: 'p3' }).riwayat.some(function (r) { return r.jenis_item === 'keterangan'; }));
  lempar('komitmen.history pasal tak dikenal', function () { komCall(st, 'u-riki', 'komitmen.history', { pasal_id: 'x' }); });
  lempar('komitmen.history pasal terhapus', function () { komCall(st, 'u-riki', 'komitmen.history', { pasal_id: 'p20' }); });
  lempar('komitmen.aksi fase berikutnya belum ada', function () { komCall(st, 'u-riki', 'komitmen.propose', {}); });
  // kosong
  var kosong = C.handle(C.memoryStore(seed()), { id: 'u-riki', nama: 'Riki', buku: 'riki' }, 'komitmen.list', {}, NOW);
  eq('komitmen.tanpa data: daftar kosong', kosong.pasal.length + kosong.bab.length + kosong.berlaku, 0);
})();

// ---------------------------------------------------------------- komitmen: pencarian
(function () {
  var L = C.handle(C.memoryStore(komitmenSeed()), { id: 'u-riki', nama: 'Riki', buku: 'riki' }, 'komitmen.list', {}, NOW);
  var cari = function (q) { return C.cariKomitmen(L.pasal, q); };
  var nomor = function (q) { return cari(q).map(function (h) { return h.pasal.nomor; }).join(','); };
  eq('cari.angka: nomor', C.nomorDariKueri('12'), 12);
  eq('cari."pasal 12"', C.nomorDariKueri('pasal 12'), 12);
  eq('cari."Psl. 12"', C.nomorDariKueri('Psl. 12'), 12);
  eq('cari."  PASAL   7 "', C.nomorDariKueri('  PASAL   7 '), 7);
  eq('cari."12a" bukan nomor', C.nomorDariKueri('12a'), 0);
  eq('cari."12" → Pasal 12 paling atas', cari('12')[0].pasal.nomor, 12);
  eq('cari."12" juga temukan angka 12 di isi', nomor('12'), '12,13');
  eq('cari."pasal 12" → Pasal 12 paling atas', cari('pasal 12')[0].pasal.nomor, 12);
  eq('cari."psl 12" → Pasal 12 paling atas', cari('psl 12')[0].pasal.nomor, 12);
  eq('cari.nomor tingkat 0', cari('psl 12')[0].tingkat, 0);
  eq('cari."3" tidak cocok "13"', nomor('3'), '3');
  eq('cari.kosong', cari('   ').length, 0);
  // isi
  var lj = cari('lawan jenis');
  eq('cari."lawan jenis": judul dulu, lalu isi & keterangan', lj.map(function (h) { return h.pasal.nomor; }).join(','), '17,3,4');
  var h4 = lj.filter(function (h) { return h.pasal.nomor === 4; })[0];
  eq('cari."lawan jenis": lokasi di ayat (1)', h4.lokasi[0].di + h4.lokasi[0].idx, 'ayat0');
  var h3 = lj.filter(function (h) { return h.pasal.nomor === 3; })[0];
  eq('cari."lawan jenis": lokasi di keterangan', h3.lokasi[0].di, 'keterangan');
  eq('cari.huruf besar diabaikan', nomor('SELINGKUH'), nomor('selingkuh'));
  eq('cari."selingkuh": definisi dulu, pemakai istilah sesudahnya', nomor('selingkuh'), '16,4');
  eq('cari.kata kunci', cari('kencan')[0].pasal.nomor, 12);
  eq('cari.kata kunci tingkat 2', cari('kencan')[0].tingkat, 2);
  eq('cari."pasal 3 pranikah" → rujukan asli', nomor('pasal 3 pranikah'), '3');
  eq('cari.rujukan: lokasi', cari('pasal 3 pranikah')[0].lokasi[0].di, 'rujukan');
  eq('cari.semua kata harus ada', nomor('selingkuh kencan'), '');
  eq('cari.tidak ketemu', cari('zzz').length, 0);
  eq('cari.aksen diabaikan', C.normCari('Kafé'), 'kafe');
  ok('cari.isi dicabut tetap bisa dicari (UI yang menyaring)', cari('aturan lama').length === 1);
  eq('cari.ayatDari array', C.ayatDari(['a', 2]).join('|'), 'a|2');
  eq('cari.ayatDari kosong', C.ayatDari('').length, 0);
  var t0 = Date.now(); for (var i = 0; i < 200; i++) cari('lawan jenis'); 
  ok('cari.cepat (200 kali < 1 detik)', Date.now() - t0 < 1000, (Date.now() - t0) + ' ms');
})();

// ================================================================ Ruang Catat (jurnal pribadi)
(function () {
  var st = todoStore();
  var isi = JSON.stringify({ date: '2026-11-02', mood: 2, emotions: ['Lelah'], tags: [], answers: [] });
  var r = todoCall(st, 'u-febie', 'jurnal.save', { id: 'u-febie|2026-11-02', isi: isi });
  eq('jurnal: tanggal dari id', r.jurnal.tanggal, '2026-11-02');
  eq('jurnal: jenis entri', r.jurnal.jenis, 'entri');
  todoCall(st, 'u-febie', 'jurnal.save', { id: 'u-febie|_pengaturan', isi: '{"profile":{"name":"F"}}' });
  eq('jurnal: Febie lihat 2 baris miliknya', todoCall(st, 'u-febie', 'jurnal.list', {}).jurnal.length, 2);
  eq('jurnal: Riki tidak lihat jurnal Febie', todoCall(st, 'u-riki', 'jurnal.list', {}).jurnal.length, 0);
  lempar('jurnal: Riki tidak bisa tulis id Febie', function () { todoCall(st, 'u-riki', 'jurnal.save', { id: 'u-febie|2026-11-03', isi: '{}' }); });
  lempar('jurnal: Riki tidak bisa hapus id Febie', function () { todoCall(st, 'u-riki', 'jurnal.delete', { id: 'u-febie|2026-11-02' }); });
  lempar('jurnal: tanggal ngawur ditolak', function () { todoCall(st, 'u-febie', 'jurnal.save', { id: 'u-febie|kemarin', isi: '{}' }); });
  lempar('jurnal: isi bukan JSON ditolak', function () { todoCall(st, 'u-febie', 'jurnal.save', { id: 'u-febie|2026-11-04', isi: 'halo' }); });
  todoCall(st, 'u-febie', 'jurnal.delete', { id: 'u-febie|2026-11-02' });
  eq('jurnal: hapus menyembunyikan baris', todoCall(st, 'u-febie', 'jurnal.list', {}).jurnal.length, 1);
  eq('jurnal: isi dikosongkan setelah dihapus', C.byId(st.all('Jurnal'))['u-febie|2026-11-02'].isi, '');
})();

console.log('\n' + lulus + ' cek lulus, ' + gagal + ' gagal.');
process.exit(gagal ? 1 : 0);
