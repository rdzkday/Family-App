/* Family App — Data contoh mode demo.
   Skrip biasa (bukan modul): nama top-level dipakai bersama file js/ lain. Urutan muat ada di index.html & kantong.html. */
'use strict';

// ================= demo seed (data contoh, bukan data asli) =================
function makeDemoSeed() {
  var P = 'riki,istri', ALL = 'riki,istri,rt';
  var kat = [['makan-jajan', 'Makan/jajan', P], ['ojol-taxi', 'Ojol/taxi', P], ['kendaraan-pribadi', 'Kendaraan pribadi', P], ['paket-data', 'Paket data', P],
    ['subscription', 'Subscription', P], ['kesehatan', 'Kesehatan', P], ['personal-care', 'Personal care', P], ['work', 'Work', 'riki'],
    ['belanja-dapur', 'Belanja dapur', 'rt'], ['listrik-air', 'Listrik & air', 'rt'], ['kebutuhan-rumah', 'Kebutuhan rumah', 'rt'], ['lain-lain', 'Lain-lain', ALL]]
    .map(function (k, i) { return { id: k[0], nama: k[1], tipe: 'Pengeluaran', buku: k[2], warna: PALETTE[i], hitung: true, aktif: true, urutan: i + 1 }; })
    .concat([{ id: 'gaji', nama: 'Gaji', tipe: 'Pemasukan', buku: ALL, warna: '#34D399', hitung: true, aktif: true, urutan: 20 },
      { id: 'pendapatan-lain', nama: 'Pendapatan lain', tipe: 'Pemasukan', buku: ALL, warna: '#5EEAD4', hitung: true, aktif: true, urutan: 21 },
      { id: C.KAT_REIMBURSE, nama: 'Reimburse masuk', tipe: 'Pemasukan', buku: ALL, warna: '#9CA3AF', hitung: false, aktif: true, urutan: 99 }]);
  var per = C.addDays(thisMonth() + '-01', -1);
  var kan = [['cash-riki', 'Cash', 'Cash', 'riki', 350000, 0], ['bca', 'BCA', 'Debit', 'riki', 4200000, 0], ['kk-bca', 'Kartu Kredit BCA', 'Kredit', 'riki', -850000, 10000000],
    ['cash-istri', 'Cash', 'Cash', 'istri', 200000, 0], ['rek-istri', 'Rekening', 'Debit', 'istri', 2500000, 0], ['kas-rt', 'Dompet RT', 'Debit', 'rt', 600000, 0]]
    .map(function (k, i) { return { id: k[0], nama: k[1], jenis: k[2], buku: k[3], saldo_awal: k[4], per_tanggal: per, limit: k[5], aktif: true, urutan: i + 1 }; });
  var bm = thisMonth(), bud = [];
  [['riki', { 'makan-jajan': 600000, 'ojol-taxi': 300000, 'kendaraan-pribadi': 200000, 'paket-data': 150000, 'subscription': 250000, 'work': 400000, 'setoran-rt': 5300000 }],
    ['istri', { 'makan-jajan': 500000, 'personal-care': 300000, 'kesehatan': 200000, 'setoran-rt': 1000000 }],
    ['rt', { 'belanja-dapur': 3000000, 'listrik-air': 800000, 'kebutuhan-rumah': 700000 }]].forEach(function (x) {
    Object.keys(x[1]).forEach(function (k) { bud.push({ id: bm + '|' + x[0] + '|' + k, bulan: bm, buku: x[0], kategori: k, nominal: x[1][k] }); });
  });
  var seedN = 7, rnd = function () { seedN = (seedN * 16807) % 2147483647; return seedN / 2147483647; };
  var tx = [], today = new Date().getDate();
  var add = function (day, tipe, n, buku, kat, kantong, ket, oleh, tujuan) {
    tx.push({ id: 'demo-' + tx.length, tanggal: bm + '-' + pad(day), tipe: tipe, nominal: n, buku: buku, kategori: kat || '', kantong: kantong, kantong_tujuan: tujuan || '',
      keterangan: ket, reimburse: false, oleh: oleh, sumber: 'demo', dibuat: bm + '-' + pad(day) + 'T0' + (tx.length % 9) + ':00:00+07:00', diubah: '', dihapus: '', terbayar: '', tx_balik: '' });
  };
  add(1, 'Transfer', 5300000, 'riki', '', 'bca', 'Topup rumah tangga', 'riki', 'kas-rt');
  add(1, 'Transfer', 1000000, 'istri', '', 'rek-istri', 'Topup rumah tangga', 'istri', 'kas-rt');
  add(1, 'Pengeluaran', 50000, 'riki', 'subscription', 'bca', 'Netflix', 'riki');
  for (var dday = 1; dday <= today; dday++) {
    if (rnd() < 0.8) add(dday, 'Pengeluaran', Math.round((15 + rnd() * 45)) * 1000, 'riki', 'makan-jajan', rnd() < .3 ? 'cash-riki' : 'bca', ['indomaret', 'bakso', 'kopi', 'nasi padang'][Math.floor(rnd() * 4)], 'riki');
    if (rnd() < 0.35) { var j = Math.floor(rnd() * 3); add(dday, 'Pengeluaran', Math.round((20 + rnd() * 40)) * 1000, 'riki', ['ojol-taxi', 'work', 'kendaraan-pribadi'][j], 'bca', ['gojek', 'fore', 'bensin'][j], 'riki'); }
    if (rnd() < 0.5) add(dday, 'Pengeluaran', Math.round((40 + rnd() * 160)) * 1000, 'rt', 'belanja-dapur', 'kas-rt', ['pasar', 'sayur', 'superindo'][Math.floor(rnd() * 3)], rnd() < .7 ? 'istri' : 'riki');
    if (rnd() < 0.4) { var q = Math.floor(rnd() * 2); add(dday, 'Pengeluaran', Math.round((10 + rnd() * 50)) * 1000, 'istri', ['makan-jajan', 'personal-care'][q], 'rek-istri', ['jajan', 'skincare'][q], 'istri'); }
  }
  add(Math.min(today, 5), 'Pengeluaran', 420000, 'rt', 'listrik-air', 'kas-rt', 'token listrik', 'istri');
  // talangan: belanja RT dibayar pakai uang pribadi (muncul di daftar talangan, per transaksi)
  add(Math.min(today, 4), 'Pengeluaran', 85000, 'rt', 'kebutuhan-rumah', 'bca', 'galon & sabun', 'riki');
  add(Math.min(today, 6), 'Pengeluaran', 132500, 'rt', 'belanja-dapur', 'bca', 'superindo mingguan', 'riki');
  add(Math.min(today, 8), 'Pengeluaran', 47000, 'rt', 'belanja-dapur', 'cash-riki', 'buah tukang sayur', 'riki');
  add(Math.min(today, 9), 'Pengeluaran', 215000, 'rt', 'kebutuhan-rumah', 'bca', 'lampu & colokan', 'riki');
  add(Math.min(today, 5), 'Pengeluaran', 60000, 'rt', 'belanja-dapur', 'rek-istri', 'sayur pasar', 'istri');
  // reimburse kantor: satu menunggu, satu sudah terbayar
  add(Math.min(today, 3), 'Pengeluaran', 828000, 'riki', 'work', 'bca', 'hotel dinas Purwokerto', 'riki');
  tx[tx.length - 1].reimburse = true;
  add(Math.min(today, 2), 'Pengeluaran', 350000, 'riki', 'work', 'bca', 'kereta dinas', 'riki');
  var pd = tx[tx.length - 1]; pd.reimburse = true; pd.terbayar = bm + '-' + pad(Math.min(today, 4)); pd.tx_balik = 'rb-' + pd.id;
  tx.push({ id: pd.tx_balik, tanggal: pd.terbayar, tipe: 'Pemasukan', nominal: 350000, buku: 'riki', kategori: C.KAT_REIMBURSE, kantong: 'bca', kantong_tujuan: '',
    keterangan: 'Reimburse: kereta dinas', reimburse: false, oleh: 'riki', sumber: 'auto', dibuat: pd.terbayar + 'T09:00:00+07:00', diubah: '', dihapus: '', terbayar: '', tx_balik: '' });
  // to-do contoh: campuran dengan waktu, tanpa waktu, bersama, dan yang sudah selesai
  var t0 = todayISO(), td = [];
  var tdAdd = function (n, judul, pemilik, tanggal, jam, selesai, tipe, isi) {
    var kapan = (tanggal || t0) + 'T08:0' + n + ':00+07:00';
    td.push({ id: 'demo-td-' + n, tipe: tipe || 'todo', isi: isi || '', judul: judul, pemilik: pemilik, tanggal: tanggal, jam: jam, durasi: tipe === 'evaluasi' ? 60 : 30,
      selesai: !!selesai, selesai_oleh: selesai ? 'istri' : '', gcal_event_id: tanggal ? 'demo-ev-' + n : '',
      gcal_status: tanggal ? 'ok' : '', gcal_error: '', oleh: pemilik === 'bersama' ? 'riki' : pemilik,
      dibuat: kapan, diubah: kapan, dihapus: '' });
  };
  tdAdd(1, 'Bayar listrik & air', 'bersama', t0, '19:00');
  tdAdd(2, 'Beli galon', 'riki', '', '');
  tdAdd(3, 'Jemput paket di agen', 'istri', C.addDays(t0, 1), '10:00');
  tdAdd(4, 'Servis AC kamar', 'bersama', C.addDays(t0, 3), '');
  tdAdd(5, 'Transfer arisan', 'istri', C.addDays(t0, -1), '16:00', true);
  // agenda evaluasi ~3 jam lagi supaya kartu pengingat terlihat di demo
  var ev = new Date(Date.now() + 3 * 3600000);
  tdAdd(6, 'Evaluasi bulanan', 'bersama', ev.getFullYear() + '-' + pad(ev.getMonth() + 1) + '-' + pad(ev.getDate()), pad(ev.getHours()) + ':00', false, 'evaluasi');
  tdAdd(7, 'Ide kado ulang tahun Ibu', 'bersama', '', '', false, 'catatan', 'Ide kado ulang tahun Ibu\nSyal rajut atau voucher pijat');
  tdAdd(8, 'Ukuran gorden kamar', 'riki', '', '', false, 'catatan', 'Ukuran gorden kamar\n2 x 140 cm, tinggi 240 cm');
  return {
    buku: [{ id: 'riki', nama: 'Riki', tipe: 'Pribadi', pemilik: 'riki', urutan: 1 }, { id: 'istri', nama: 'Febie', tipe: 'Pribadi', pemilik: 'istri', urutan: 2 }, { id: 'rt', nama: 'Rumah Tangga', tipe: 'Bersama', pemilik: '', urutan: 3 }],
    users: [{ id: 'riki', nama: 'Riki', buku: 'riki' }, { id: 'istri', nama: 'Febie', buku: 'istri' }],
    kategori: kat, kantong: kan, budget: bud, transaksi: tx, todo: td
  };
}
