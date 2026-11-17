/*
 * Tes Siklus di core.js: perhitungan perkiraan + aturan privasi (siapa boleh melihat/mengubah). Data sintetis.
 * Jalankan: node kantong/tools/test_siklus.js
 */
var path = require('path');
var C = require(path.join(__dirname, '..', '..', 'public', 'shared', 'core.js'));
var K = C.Siklus;
var lulus = 0, gagal = 0;
function eq(nama, dapat, harap) {
  if (JSON.stringify(dapat) === JSON.stringify(harap)) { lulus++; return; }
  gagal++; console.log('GAGAL: ' + nama + ' -> dapat ' + JSON.stringify(dapat) + ', harap ' + JSON.stringify(harap));
}
function lempar(nama, fn, pola) {
  try { fn(); gagal++; console.log('GAGAL: ' + nama + ' -> seharusnya ditolak, tapi lolos'); }
  catch (e) {
    if (pola && !pola.test(e.message)) { gagal++; console.log('GAGAL: ' + nama + ' -> pesan "' + e.message + '"'); return; }
    if (!e.userFacing) { gagal++; console.log('GAGAL: ' + nama + ' -> error bukan untuk user: ' + e.message); return; }
    lulus++;
  }
}
function r(id, mulai, akhir, abaikan) { return { id: id, mulai: mulai, akhir: akhir || '', abaikan_jarak: !!abaikan }; }

// ================= perhitungan =================
var p0 = K.perkiraan([r('a', '2026-10-01', '2026-10-05')], '2026-10-10');
eq('1 catatan: 28 hari', p0.panjang, 28);
eq('1 catatan: kasar', p0.kasar, true);
eq('1 catatan: berikut = mulai + 28', p0.berikut, '2026-10-29');
eq('rentang ±2 hari', [p0.dari, p0.sampai], ['2026-10-27', '2026-10-31']);
eq('tanpa catatan: tidak ada perkiraan', K.perkiraan([], '2026-10-10'), null);

var rows = [r('1', '2026-01-01'), r('2', '2026-01-31'), r('3', '2026-03-01'), r('4', '2026-03-30'), r('5', '2026-04-28'),
  r('6', '2026-05-27'), r('7', '2026-06-25'), r('8', '2026-07-25')];
eq('jarak antar hari pertama', K.jarak(rows).map(function (x) { return x.hari; }), [30, 29, 29, 29, 29, 29, 30]);
var p1 = K.perkiraan(rows, '2026-08-01');
eq('rata-rata 6 jarak terakhir (29,29,29,29,29,30 -> 29)', p1.panjang, 29);
eq('bukan kasar', p1.kasar, false);
eq('berikut = mulai terakhir + 29', p1.berikut, '2026-08-23');
eq('urutan input tidak berpengaruh', K.perkiraan(rows.slice().reverse(), '2026-08-01').berikut, '2026-08-23');
eq('baris terhapus (mulai kosong) diabaikan', K.ringkas(rows.concat([{ id: 'x', mulai: '', akhir: '', dihapus: 'y' }])).jumlah, 8);

var lewat = [r('1', '2026-01-01'), r('2', '2026-01-29'), r('3', '2026-03-26', '', true), r('4', '2026-04-23')];
eq('jarak abaikan tidak dipakai (28, 28 -> 28)', K.ringkas(lewat).panjang, 28);
eq('semua jarak diabaikan -> kasar', K.ringkas([r('1', '2026-01-01'), r('2', '2026-03-01', '', true)]).kasar, true);

eq('jarak 56 hari ditanya', K.jarakAneh([r('1', '2026-01-01')], '2026-02-26', null), 56);
eq('jarak 18 hari ditanya', K.jarakAneh([r('1', '2026-01-01')], '2026-01-19', null), 18);
eq('jarak 30 hari wajar', K.jarakAneh([r('1', '2026-01-01')], '2026-01-31', null), 0);
eq('catatan pertama tidak ditanya', K.jarakAneh([], '2026-01-31', null), 0);
eq('saat edit, catatan sendiri tidak dibandingkan', K.jarakAneh([r('1', '2026-01-01'), r('2', '2026-01-31')], '2026-02-10', '2'), 40);

eq('durasi baku 5 hari', K.ringkas([r('1', '2026-01-01')]).durasi, 5);
eq('durasi rata-rata', K.ringkas([r('1', '2026-01-01', '2026-01-04'), r('2', '2026-01-29', '2026-02-03')]).durasi, 5);

var t = K.tanda([r('1', '2026-10-01', '2026-10-04'), r('2', '2026-10-29')], '2026-11-02', '2026-10-01', '2026-12-31');
eq('tercatat: hari mulai', t['2026-10-01'], 'catat');
eq('tercatat: hari selesai', t['2026-10-04'], 'catat');
eq('tidak tercatat: sesudah selesai', t['2026-10-05'], undefined);
eq('catatan tanpa selesai: pakai durasi rata-rata (4 hari)', [t['2026-11-01'], t['2026-11-02']], ['catat', undefined]);
eq('perkiraan berikutnya (28 + rentang)', [t['2026-11-24'], t['2026-11-26'], t['2026-11-28'], t['2026-11-29']], ['kira', 'kira', 'kira', undefined]);
eq('perkiraan siklus sesudahnya', t['2026-12-24'], 'kira');

var pt = K.perkiraan([r('1', '2026-06-01'), r('2', '2026-06-29')], '2026-09-10');
eq('lewat > 1 siklus: digeser, tanpa label telat', [pt.berikut, pt.telat], ['2026-09-21', 0]);
var pt2 = K.perkiraan([r('1', '2026-06-01'), r('2', '2026-06-29')], '2026-08-01');
eq('lewat dalam satu siklus: dilaporkan telat', [pt2.berikut, pt2.telat], ['2026-07-27', 5]);
eq('lewat sedikit (dalam ±2): tidak disebut telat', K.perkiraan([r('1', '2026-06-01'), r('2', '2026-06-29')], '2026-07-28').telat, 0);

var jalan = [r('1', '2026-10-01', '2026-10-05'), r('2', '2026-10-29')];
eq('berjalan: catatan terakhir tanpa selesai', K.berjalan(jalan, '2026-11-01').id, '2');
eq('berjalan: tidak sebelum mulai', K.berjalan(jalan, '2026-10-20'), null);
eq('berjalan: lewat 15 hari dianggap tidak berjalan', K.berjalan(jalan, '2026-11-20'), null);
eq('catatanDi', K.catatanDi(jalan, '2026-10-03', 5).id, '1');

// ================= aturan privasi (handle di server) =================
var NOW = '2026-11-17T09:00:00+07:00';
function toko() {
  return C.memoryStore({ Users: [{ id: 'riki', nama: 'Riki', buku: 'riki' }, { id: 'istri', nama: 'Febie', buku: 'istri' }] });
}
var RIKI = { id: 'riki', nama: 'Riki', buku: 'riki' }, FEBIE = { id: 'istri', nama: 'Febie', buku: 'istri' };
function h(st, u, a, p) { return C.handle(st, u, a, p || {}, NOW); }

var s = toko();
var v0 = h(s, FEBIE, 'siklus.list');
eq('pemilik = istri', [v0.peran, v0.pemilik.nama], ['pemilik', 'Febie']);
eq('awal: belum aktif, tampil, jadwal dibagikan (default), catatan tidak', [v0.aktif, v0.tampil, v0.bagikan_jadwal, v0.bagikan_catatan], [false, true, true, false]);
var vr0 = h(s, RIKI, 'siklus.list');
eq('suami = pembaca, belum dibagikan', [vr0.peran, vr0.dibagikan, vr0.siklus.length], ['pembaca', false, 0]);
eq('pembaca tidak melihat detail pengaturan pemilik', [vr0.aktif, vr0.setuju_at, vr0.bagikan_jadwal], [undefined, undefined, undefined]);

lempar('belum aktif: tidak bisa mencatat', function () { h(s, FEBIE, 'siklus.save', { id: 's1', mulai: '2026-10-01' }); }, /Aktifkan/);
lempar('aktif tanpa setuju teks privasi ditolak', function () { h(s, FEBIE, 'siklus.atur', { aktif: true }); }, /privasi/);
lempar('setuju versi lama ditolak', function () { h(s, FEBIE, 'siklus.atur', { aktif: true, setuju: 0.5 }); }, /privasi/);
lempar('suami tidak bisa mengaktifkan', function () { h(s, RIKI, 'siklus.atur', { aktif: true, setuju: 1 }); }, /Febie/);
lempar('suami tidak bisa membagikan catatan', function () { h(s, RIKI, 'siklus.atur', { bagikan_catatan: true }); }, /Febie/);
var v1 = h(s, FEBIE, 'siklus.atur', { aktif: true, setuju: C.SIKLUS_VERSI_TEKS });
eq('aktif setelah setuju', [v1.aktif, v1.versi_teks, !!v1.setuju_at], [true, 1, true]);

h(s, FEBIE, 'siklus.save', { id: 's1', mulai: '2026-09-03', akhir: '2026-09-07', catatan: 'kram hari pertama' });
h(s, FEBIE, 'siklus.save', { id: 's2', mulai: '2026-10-01', akhir: '2026-10-05' });
h(s, FEBIE, 'siklus.save', { id: 's3', mulai: '2026-10-29' });
eq('pemilik melihat 3 catatan + catatan teks', h(s, FEBIE, 'siklus.list').siklus.map(function (x) { return x.catatan; }), ['kram hari pertama', '', '']);
var vr1 = h(s, RIKI, 'siklus.list');
eq('suami: jadwal dibagikan (default) tanpa catatan teks', [vr1.dibagikan, vr1.catatan_dibagikan, vr1.siklus.length, vr1.siklus[0].catatan], [true, false, 3, '']);
h(s, FEBIE, 'siklus.atur', { bagikan_catatan: true });
eq('catatan dibagikan -> suami bisa membaca', h(s, RIKI, 'siklus.list').siklus[0].catatan, 'kram hari pertama');
h(s, FEBIE, 'siklus.atur', { bagikan_jadwal: false });
var vr2 = h(s, RIKI, 'siklus.list');
eq('jadwal tidak dibagikan -> suami tidak mendapat apa pun (catatan ikut tertutup)', [vr2.dibagikan, vr2.catatan_dibagikan, vr2.siklus.length], [false, false, 0]);
h(s, FEBIE, 'siklus.atur', { bagikan_jadwal: true, bagikan_catatan: false });

// tampil: pilihan masing-masing, tidak memengaruhi yang lain
h(s, RIKI, 'siklus.atur', { tampil: false });
eq('suami menyembunyikan untuk dirinya', h(s, RIKI, 'siklus.list').tampil, false);
eq('pilihan suami tidak mengubah tampilan istri', h(s, FEBIE, 'siklus.list').tampil, true);
eq('pilihan suami tidak mengubah status aktif', h(s, FEBIE, 'siklus.list').aktif, true);
h(s, FEBIE, 'siklus.atur', { tampil: false });
eq('istri juga bisa menyembunyikan untuk dirinya', h(s, FEBIE, 'siklus.list').tampil, false);
eq('istri sembunyi tidak menutup jadwal suami', h(s, RIKI, 'siklus.list').dibagikan, true);
h(s, FEBIE, 'siklus.atur', { tampil: true }); h(s, RIKI, 'siklus.atur', { tampil: true });

// validasi simpan
lempar('suami tidak bisa mencatat', function () { h(s, RIKI, 'siklus.save', { id: 'x1', mulai: '2026-11-10' }); }, /Febie/);
lempar('suami tidak bisa menghapus', function () { h(s, RIKI, 'siklus.delete', { id: 's1' }); }, /Febie/);
lempar('suami tidak bisa hapus semua', function () { h(s, RIKI, 'siklus.hapus_semua'); }, /Febie/);
lempar('tanggal masa depan ditolak', function () { h(s, FEBIE, 'siklus.save', { id: 'x2', mulai: '2026-11-18' }); }, /masa depan/);
lempar('selesai sebelum mulai ditolak', function () { h(s, FEBIE, 'siklus.save', { id: 'x3', mulai: '2026-11-10', akhir: '2026-11-09' }); }, /selesai/);
lempar('selesai > 15 hari ditolak', function () { h(s, FEBIE, 'siklus.save', { id: 'x4', mulai: '2026-08-01', akhir: '2026-08-16' }); }, /15/);
lempar('mulai dobel ditolak', function () { h(s, FEBIE, 'siklus.save', { id: 'x5', mulai: '2026-10-01' }); }, /tanggal itu/);
lempar('bertabrakan dengan catatan lain ditolak', function () { h(s, FEBIE, 'siklus.save', { id: 'x6', mulai: '2026-09-05' }); }, /bertabrakan/);
lempar('catatan terlalu panjang ditolak', function () { h(s, FEBIE, 'siklus.save', { id: 'x7', mulai: '2026-08-01', catatan: new Array(302).join('a') }); }, /300/);
lempar('tanggal tidak valid ditolak', function () { h(s, FEBIE, 'siklus.save', { id: 'x8', mulai: '1-2-3' }); }, /mulai/);
h(s, FEBIE, 'siklus.save', { id: 's3', mulai: '2026-10-29', akhir: '2026-11-02' });
eq('ubah catatan: catatan teks lama tetap kalau tidak dikirim', h(s, FEBIE, 'siklus.save', { id: 's1', mulai: '2026-09-03', akhir: '2026-09-06' }).siklus[0].catatan, 'kram hari pertama');
eq('ubah: tanggal selesai berubah', h(s, FEBIE, 'siklus.list').siklus[0].akhir, '2026-09-06');

// hapus = tombstone tanpa data kesehatan
h(s, FEBIE, 'siklus.delete', { id: 's1' });
var row = s.data.Siklus.filter(function (x) { return x.id === 's1'; })[0];
eq('hapus: tanggal & catatan dikosongkan, ditandai dihapus', [row.mulai, row.akhir, row.catatan, !!row.dihapus], ['', '', '', true]);
eq('hapus: tidak tampil lagi', h(s, FEBIE, 'siklus.list').siklus.length, 2);
lempar('catatan terhapus tidak bisa diubah', function () { h(s, FEBIE, 'siklus.save', { id: 's1', mulai: '2026-09-03' }); }, /dihapus/);

// hapus semua: semua catatan jadi tombstone, persetujuan ditarik, Siklus mati
var vh = h(s, FEBIE, 'siklus.hapus_semua');
eq('hapus semua: kosong & mati & persetujuan ditarik', [vh.siklus.length, vh.aktif, vh.versi_teks, vh.setuju_at], [0, false, 0, '']);
eq('hapus semua: tidak ada data kesehatan tertinggal', s.data.Siklus.filter(function (x) { return x.mulai || x.akhir || x.catatan; }).length, 0);
eq('hapus semua: suami tidak melihat apa pun', h(s, RIKI, 'siklus.list').dibagikan, false);

// matikan: data tetap, suami tidak melihat lagi
var s2 = toko();
h(s2, FEBIE, 'siklus.atur', { aktif: true, setuju: 1 });
h(s2, FEBIE, 'siklus.save', { id: 'a', mulai: '2026-11-01' });
h(s2, FEBIE, 'siklus.atur', { aktif: false });
eq('matikan: catatan pemilik tetap ada', h(s2, FEBIE, 'siklus.list').siklus.length, 1);
eq('matikan: suami tidak melihat jadwal', h(s2, RIKI, 'siklus.list').siklus.length, 0);
h(s2, FEBIE, 'siklus.atur', { aktif: true });
eq('aktifkan lagi tanpa setuju ulang (versi sama)', h(s2, FEBIE, 'siklus.list').aktif, true);

// batch (jalur sinkron app) meneruskan aksi siklus dan menolak per operasi
var b = h(s2, RIKI, 'batch', { ops: [{ opId: '1', action: 'siklus.list' }, { opId: '2', action: 'siklus.save', payload: { id: 'z', mulai: '2026-11-05' } }] });
eq('batch: list ok, simpan suami ditolak', [b.results[0].ok, b.results[1].ok], [true, false]);

// data lain tidak bocor: jurnal & siklus tetap terpisah
eq('bootstrap tidak memuat data siklus', 'siklus' in h(s2, RIKI, 'bootstrap'), false);

console.log('\n' + lulus + ' cek lulus, ' + gagal + ' gagal.');
process.exit(gagal ? 1 : 0);
