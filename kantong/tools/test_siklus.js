/*
 * Tes perhitungan Siklus (public/siklus.js -> SiklusCore). Data sintetis.
 * Jalankan: node kantong/tools/test_siklus.js
 */
var path = require('path');
var K = require(path.join(__dirname, '..', '..', 'public', 'siklus.js'));
var lulus = 0, gagal = 0;
function eq(nama, dapat, harap) {
  if (JSON.stringify(dapat) === JSON.stringify(harap)) { lulus++; return; }
  gagal++; console.log('GAGAL: ' + nama + ' -> dapat ' + JSON.stringify(dapat) + ', harap ' + JSON.stringify(harap));
}
function r(id, mulai, selesai, abaikan) { return { id: id, mulai: mulai, selesai: selesai || null, abaikan_jarak: !!abaikan }; }

// kurang dari 2 catatan -> 28 hari, perkiraan kasar
var p0 = K.perkiraan([r('a', '2026-10-01', '2026-10-05')], '2026-10-10');
eq('1 catatan: 28 hari', p0.panjang, 28);
eq('1 catatan: kasar', p0.kasar, true);
eq('1 catatan: berikut = mulai + 28', p0.berikut, '2026-10-29');
eq('rentang ±2 hari', [p0.dari, p0.sampai], ['2026-10-27', '2026-10-31']);
eq('tanpa catatan: tidak ada perkiraan', K.perkiraan([], '2026-10-10'), null);

// rata-rata 6 jarak terakhir
var rows = [r('1', '2026-01-01'), r('2', '2026-01-31'), r('3', '2026-03-01'), r('4', '2026-03-30'), r('5', '2026-04-28'),
  r('6', '2026-05-27'), r('7', '2026-06-25'), r('8', '2026-07-25')];
var j = K.jarak(rows).map(function (x) { return x.hari; });
eq('jarak antar hari pertama', j, [30, 29, 29, 29, 29, 29, 30]);
var p1 = K.perkiraan(rows, '2026-08-01');
eq('rata-rata 6 jarak terakhir (29,29,29,29,29,30 -> 29)', p1.panjang, 29);
eq('bukan kasar', p1.kasar, false);
eq('berikut = mulai terakhir + 29', p1.berikut, '2026-08-23');
eq('urutan input tidak berpengaruh', K.perkiraan(rows.slice().reverse(), '2026-08-01').berikut, '2026-08-23');

// jarak terlewat tidak dihitung
var lewat = [r('1', '2026-01-01'), r('2', '2026-01-29'), r('3', '2026-03-26', null, true), r('4', '2026-04-23')];
eq('jarak abaikan tidak dipakai (28, 28 -> 28)', K.ringkas(lewat).panjang, 28);
eq('semua jarak diabaikan -> kasar', K.ringkas([r('1', '2026-01-01'), r('2', '2026-03-01', null, true)]).kasar, true);

// jarak tidak biasa (di luar 21–35)
eq('jarak 56 hari ditanya', K.jarakAneh([r('1', '2026-01-01')], '2026-02-26', null), 56);
eq('jarak 18 hari ditanya', K.jarakAneh([r('1', '2026-01-01')], '2026-01-19', null), 18);
eq('jarak 30 hari wajar', K.jarakAneh([r('1', '2026-01-01')], '2026-01-31', null), 0);
eq('catatan pertama tidak ditanya', K.jarakAneh([], '2026-01-31', null), 0);
eq('saat edit, catatan sendiri tidak dibandingkan', K.jarakAneh([r('1', '2026-01-01'), r('2', '2026-01-31')], '2026-02-10', '2'), 40);

// durasi: rata-rata dari yang punya tanggal selesai, awal 5 hari
eq('durasi baku 5 hari', K.ringkas([r('1', '2026-01-01')]).durasi, 5);
eq('durasi rata-rata', K.ringkas([r('1', '2026-01-01', '2026-01-04'), r('2', '2026-01-29', '2026-02-03')]).durasi, 5);

// tanda kalender
var t = K.tanda([r('1', '2026-10-01', '2026-10-04'), r('2', '2026-10-29')], '2026-11-02', '2026-10-01', '2026-12-31');
eq('tercatat: hari mulai', t['2026-10-01'], 'catat');
eq('tercatat: hari selesai', t['2026-10-04'], 'catat');
eq('tidak tercatat: sesudah selesai', t['2026-10-05'], undefined);
eq('catatan tanpa selesai: pakai durasi rata-rata (4 hari)', [t['2026-11-01'], t['2026-11-02']], ['catat', undefined]);
eq('perkiraan berikutnya (28 + rentang)', [t['2026-11-24'], t['2026-11-26'], t['2026-11-28'], t['2026-11-29']], ['kira', 'kira', 'kira', undefined]);
eq('perkiraan siklus sesudahnya', t['2026-12-24'], 'kira');

// lupa mencatat lama: perkiraan digeser, telat dilaporkan kalau masih dalam satu siklus
var pt = K.perkiraan([r('1', '2026-06-01'), r('2', '2026-06-29')], '2026-09-10');
eq('lewat > 1 siklus: digeser ke perkiraan yang akan datang, tanpa label telat', [pt.berikut, pt.telat], ['2026-09-21', 0]);
var pt2 = K.perkiraan([r('1', '2026-06-01'), r('2', '2026-06-29')], '2026-08-01');
eq('lewat dalam satu siklus: dilaporkan telat', [pt2.berikut, pt2.telat], ['2026-07-27', 5]);
eq('lewat sedikit (dalam rentang ±2): tidak disebut telat', K.perkiraan([r('1', '2026-06-01'), r('2', '2026-06-29')], '2026-07-28').telat, 0);

// sedang berjalan
var jalan = [r('1', '2026-10-01', '2026-10-05'), r('2', '2026-10-29')];
eq('berjalan: catatan terakhir tanpa selesai', K.berjalan(jalan, '2026-11-01').id, '2');
eq('berjalan: tidak sebelum mulai', K.berjalan(jalan, '2026-10-20'), null);
eq('berjalan: lewat 15 hari dianggap tidak berjalan', K.berjalan(jalan, '2026-11-20'), null);
eq('catatanDi', K.catatanDi(jalan, '2026-10-03', 5).id, '1');

console.log('\n' + lulus + ' cek lulus, ' + gagal + ' gagal.');
process.exit(gagal ? 1 : 0);
