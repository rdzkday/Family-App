/*
 * Tes Couple Journaling di core.js: periode, kesimpulan diri vs pasangan, aturan privasi & persetujuan. Data sintetis.
 * Jalankan: node kantong/tools/test_cj.js
 */
var path = require('path');
var C = require(path.join(__dirname, '..', '..', 'public', 'shared', 'core.js'));
var J = C.CJ;
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

// ================= periode =================
eq('minggu ISO 24 Nov 2026', J.minggu('2026-11-24'), '2026-W48');
eq('Senin minggu 48', J.senin('2026-W48'), '2026-11-23');
eq('1 Jan 2027 (Jumat) = minggu 53 tahun 2026', J.minggu('2027-01-01'), '2026-W53');
eq('29 Des 2025 = 2026-W01', J.minggu('2025-12-29'), '2026-W01');
eq('geser minggu lintas tahun', J.mingguGeser('2026-W53', 1), '2027-W01');
eq('7 hari dalam minggu', J.hariDalam('2026-W48'), ['2026-11-23', '2026-11-24', '2026-11-25', '2026-11-26', '2026-11-27', '2026-11-28', '2026-11-29']);
eq('geser bulan lintas tahun', [J.bulanGeser('2026-12', 1), J.bulanGeser('2026-01', -1)], ['2027-01', '2025-12']);
eq('minggu dalam November 2026 (aturan Kamis)', J.mingguDalamBulan('2026-11'), ['2026-W45', '2026-W46', '2026-W47', '2026-W48']);
eq('urai kunci harian', J.uraiKunci('H:2026-11-24'), { periode: 'harian', nilai: '2026-11-24' });
eq('urai kunci mingguan', J.uraiKunci('M:2026-W48'), { periode: 'mingguan', nilai: '2026-W48' });
eq('kunci rusak = null', [J.uraiKunci('X:2026'), J.uraiKunci('M:2026-W60'), J.uraiKunci('B:2026-13x')], [null, null, null]);

// ================= kesimpulan =================
eq('sama = selaras', J.kesimpulan(3, 3), 'selaras');
eq('beda 1 = hampir', J.kesimpulan(2, 3), 'hampir');
eq('beda 2 = perlu', J.kesimpulan(4, 2), 'perlu');
eq('beda 4 = perlu', J.kesimpulan(0, 4), 'perlu');
eq('nilai kosong = tanpa label', J.kesimpulan(3, undefined), '');

// ================= template =================
var T = J.template();
eq('beban harian: 3 tap wajib', T.filter(function (q) { return q.periode === 'harian' && q.wajib; }).length, 3);
eq('beban mingguan: 4 wajib', T.filter(function (q) { return q.periode === 'mingguan' && q.wajib; }).length, 4);
eq('beban bulanan: 2 wajib', T.filter(function (q) { return q.periode === 'bulanan' && q.wajib; }).length, 2);
eq('item opsional tersembunyi (kecuali M9 bersyarat & otomatis)', T.filter(function (q) { return !q.wajib && q.tampil; }).map(function (q) { return q.id; }), ['H7', 'M9', 'B5']);
eq('kesehatan selalu privat', T.filter(function (q) { return q.privat; }).map(function (q) { return q.id; }), ['H6', 'M10']);

// ================= alur server =================
var now = '2026-11-24T21:00:00+07:00';
function baru() {
  return C.memoryStore({ Users: [{ id: 'riki', nama: 'Riki', buku: 'riki' }, { id: 'istri', nama: 'Febie', buku: 'istri' }] });
}
var R = { id: 'riki', nama: 'Riki', buku: 'riki' }, F = { id: 'istri', nama: 'Febie', buku: 'istri' };
var st = baru();
function h(u, a, p, t) { return C.handle(st, u, a, p || {}, t || now); }

var v = h(R, 'cj.state');
eq('belum aktif', v.aktif, false);
lempar('isi sebelum aktif ditolak', function () { h(R, 'cj.isi', { kunci: 'H:2026-11-24', jawaban: {} }); }, /belum aktif/);
v = h(R, 'cj.setuju', { setuju: true });
eq('satu pihak setuju: belum aktif', [v.aktif, !!v.saya.setuju, !!v.pasangan.setuju], [false, true, false]);
eq('belum aktif: tidak ada data bersama', v.isian, undefined);
v = h(F, 'cj.setuju', { setuju: true });
eq('kedua setuju: aktif', v.aktif, true);
eq('template terbit v1 berlaku hari ini', [v.sets.length, v.sets[0].versi, v.sets[0].berlaku.harian, v.sets[0].berlaku.mingguan], [1, 1, '2026-11-24', '2026-W48']);

// fondasi & target
v = h(R, 'cj.fondasi', { fondasi: { tujuan: 'Tenang dan damai', visi: 'Keluarga samawa', misi: ['Domain keahlian', 'Komunikasi terbuka', 'Peran saling melengkapi'] }, hari: 0 });
eq('fondasi tersimpan', [v.fondasi.visi, v.fondasi.misi.length, v.hari], ['Keluarga samawa', 3, 0]);
h(R, 'cj.target', { t1: 'Mendengar tanpa memotong' });
v = h(F, 'cj.target', { t1: 'Menyampaikan kebutuhan dengan jelas', t2: 'Tidur sebelum jam 23' });
eq('target dua orang terlihat (untuk observer)', [v.target.riki.t1.teks, v.target.istri.t2.teks], ['Mendengar tanpa memotong', 'Tidur sebelum jam 23']);

// isian harian
lempar('masa depan ditolak', function () { h(R, 'cj.isi', { kunci: 'H:2026-11-25', jawaban: {} }); }, /akan datang/);
lempar('terlalu lama ditolak', function () { h(R, 'cj.isi', { kunci: 'H:2026-11-10', jawaban: {} }); }, /terlalu lama/);
lempar('selesai tanpa wajib ditolak', function () { h(R, 'cj.isi', { kunci: 'H:2026-11-24', jawaban: { H1: { n: 3 } }, selesai: true }); }, /Lengkapi/);
lempar('H3 ya tanpa catatan ditolak', function () {
  h(R, 'cj.isi', { kunci: 'H:2026-11-24', jawaban: { H1: { n: 3 }, H2: { n: 2 }, H3: { n: 'ya' } }, selesai: true });
}, /ingin dibahas/);
v = h(R, 'cj.isi', { kunci: 'H:2026-11-24', jawaban: { H1: { n: 3, c: 'lumayan' }, H2: { n: 2 }, H3: { n: 'ya', c: 'Jadwal mudik' }, H6: { n: 'ya' }, ZZ: { n: 4 } }, mood: 4, selesai: true });
var mine = v.isian.filter(function (x) { return x.pemilik === 'riki'; })[0];
eq('isian tersimpan + nilai asing dibuang', Object.keys(mine.jawaban).sort(), ['H1', 'H2', 'H3']);   // H6 tersembunyi di set aktif
eq('mood tersimpan untuk pemilik', mine.mood, 4);
eq('H3 ya -> masuk antrian topik', v.topik.map(function (t) { return [t.judul, t.status, t.minggu]; }), [['Jadwal mudik', 'antri', '2026-W48']]);
lempar('skala salah dibuang, wajib jadi kurang', function () { h(F, 'cj.isi', { kunci: 'H:2026-11-24', jawaban: { H1: { n: 9 }, H2: { n: 2 }, H3: { n: 'tidak' } }, selesai: true }); }, /tenang/);

// privasi: pasangan hanya melihat status sampai dibagikan
var vf = h(F, 'cj.state');
var dariRiki = vf.isian.filter(function (x) { return x.pemilik === 'riki'; })[0];
eq('harian belum dibagikan: pasangan hanya lihat status', [dariRiki.terisi, dariRiki.jawaban, dariRiki.mood], [true, undefined, undefined]);
h(R, 'cj.bagikan', { minggu: '2026-W48' });
dariRiki = h(F, 'cj.state').isian.filter(function (x) { return x.pemilik === 'riki'; })[0];
eq('setelah dibagikan: jawaban terlihat', dariRiki.jawaban.H1, { n: 3, c: 'lumayan' });
eq('mood tetap privat (bagikan_mood mati)', dariRiki.mood, 0);
h(R, 'cj.pref', { bagikan_mood: true });
eq('bagikan mood dinyalakan', h(F, 'cj.state').isian.filter(function (x) { return x.pemilik === 'riki'; })[0].mood, 4);

// item privat: munculkan H6 lewat draft -> publish (berlaku besok), cek tidak pernah terkirim ke pasangan
var setBaru = h(R, 'cj.state').sets[0].pertanyaan.map(function (q) { var x = JSON.parse(JSON.stringify(q)); if (x.id === 'H6' || x.id === 'M10') x.tampil = true; return x; });
v = h(R, 'cj.draft', { aksi: 'simpan', pertanyaan: setBaru });
eq('draft: item personal bawaan (milik bersama) perlu persetujuan', v.draft.perlu_setuju, true);
lempar('publish tanpa persetujuan ditolak', function () { h(R, 'cj.draft', { aksi: 'publish' }); }, /persetujuan/);
lempar('pengusul tidak bisa menyetujui sendiri', function () { h(R, 'cj.draft', { aksi: 'setuju' }); }, /pasangan/);
h(F, 'cj.draft', { aksi: 'setuju' });
v = h(R, 'cj.draft', { aksi: 'publish' });
eq('v2 terbit, berlaku periode berikutnya (sudah ada isian)', [v.sets.length, v.sets[1].berlaku.harian, v.sets[1].berlaku.mingguan, v.sets[1].berlaku.bulanan], [2, '2026-11-25', '2026-W49', '2026-12']);
eq('draft hilang setelah publish', v.draft, null);
var besok = '2026-11-25T21:00:00+07:00';
h(R, 'cj.isi', { kunci: 'H:2026-11-25', jawaban: { H1: { n: 4 }, H2: { n: 4 }, H3: { n: 'tidak' }, H6: { n: 'tidak', c: 'lupa minum obat' } }, selesai: true }, besok);
h(R, 'cj.bagikan', { minggu: '2026-W48' }, besok);
var r25 = h(F, 'cj.state', {}, besok).isian.filter(function (x) { return x.pemilik === 'riki' && x.nilai === '2026-11-25'; })[0];
eq('item privat (H6) + catatannya tidak terkirim ke pasangan', [r25.jawaban.H1.n, r25.jawaban.H6], [4, undefined]);
eq('pemilik tetap melihat item privatnya', h(R, 'cj.state', {}, besok).isian.filter(function (x) { return x.nilai === '2026-11-25'; })[0].jawaban.H6.c, 'lupa minum obat');
// raw row memang ada di DB, tapi view pasangan sudah tersaring
eq('H3 diubah ke tidak -> topik hari itu tidak dibuat', h(R, 'cj.state', {}, besok).topik.length, 1);

// item personal milik sendiri: publish tanpa persetujuan
var setR = h(R, 'cj.state', {}, besok).sets[1].pertanyaan.concat([{ id: 'q-ibadah1', teks: 'Tilawah 1 halaman', periode: 'harian', jenis: 'personal', skala: 'kejadian', milik: 'riki', tampil: true, catatan: true }]);
v = h(R, 'cj.draft', { aksi: 'simpan', pertanyaan: setR }, besok);
eq('item personal milik sendiri: tanpa persetujuan', v.draft.perlu_setuju, false);
lempar('pasangan tidak bisa menerbitkan item personal orang lain', function () { h(F, 'cj.draft', { aksi: 'publish' }, besok); }, /pemiliknya/);
v = h(R, 'cj.draft', { aksi: 'publish' }, besok);
eq('v3 terbit', v.sets.length, 3);
var set3 = v.sets[2];
eq('item personal hanya untuk pemiliknya', [J.item(set3, 'harian', 'riki', v.target).some(function (q) { return q.id === 'q-ibadah1'; }), J.item(set3, 'harian', 'istri', v.target).some(function (q) { return q.id === 'q-ibadah1'; })], [true, false]);
lempar('item bawaan tidak bisa diubah jadi perilaku lain', function () {
  h(R, 'cj.draft', { aksi: 'simpan', pertanyaan: [{ id: 'q-xyz1', teks: 'x', periode: 'tahunan', jenis: 'bersama', skala: 'frekuensi' }] }, besok);
}, /Frekuensi/);
v = h(R, 'cj.draft', { aksi: 'simpan', pertanyaan: [{ id: 'M4', teks: 'Target', periode: 'harian', skala: 'kejadian', jenis: 'bersama', tampil: false }] }, besok);
var m4 = v.draft.pertanyaan.filter(function (q) { return q.id === 'M4'; })[0];
eq('item khusus (target) tetap mingguan/frekuensi/personal + bawaan lain kembali tersembunyi', [m4.periode, m4.skala, m4.jenis, v.draft.pertanyaan.length], ['mingguan', 'frekuensi', 'personal', 22]);
h(R, 'cj.draft', { aksi: 'batal' }, besok);

// mingguan: diri vs pasangan
var sen = '2026-11-30T20:00:00+07:00';   // minggu 49
lempar('selesai mingguan tanpa observer wajib ditolak', function () {
  h(R, 'cj.isi', { kunci: 'M:2026-W49', jawaban: { M1: { n: 3 }, M2: { n: 3 }, M3: { n: 3 }, M4: { n: 4 } }, selesai: true }, sen);
}, /target pasangan/);
h(R, 'cj.isi', { kunci: 'M:2026-W49', jawaban: { M1: { n: 3 }, M2: { n: 3 }, M3: { n: 3 }, M4: { n: 4 }, M10: { n: 'ya', c: 'ganti obat' } }, observer: { M4: { n: 2 }, M9: { n: 3 } }, selesai: true }, sen);
var vfM = h(F, 'cj.state', {}, sen).isian.filter(function (x) { return x.pemilik === 'riki' && x.periode === 'mingguan'; })[0];
eq('penanda kondisi berat: tanda terlihat, isi privat', [vfM.berat, vfM.jawaban.M10], [true, undefined]);
v = h(F, 'cj.isi', { kunci: 'M:2026-W49', jawaban: { M1: { n: 3 }, M2: { n: 2 }, M3: { n: 3 }, M4: { n: 3 }, M9: { n: 1 } }, observer: { M4: { n: 1 } }, selesai: true }, sen);
var isiMap = {}; v.isian.filter(function (x) { return x.periode === 'mingguan'; }).forEach(function (x) { isiMap[x.pemilik] = x; });
var band = J.banding(J.setUntuk(v.sets, 'mingguan', '2026-W49'), 'mingguan', isiMap, ['riki', 'istri'], v.target);
eq('kesimpulan diri vs pasangan', band.map(function (b) { return [b.pemilik, b.qid, b.diri, b.pasangan, b.hasil]; }),
  [['riki', 'M4', 4, 1, 'perlu'], ['istri', 'M4', 3, 2, 'hampir'], ['istri', 'M9', 1, 3, 'perlu']]);
var auto = v.topik.filter(function (t) { return t.sumber === 'selisih'; });
eq('perlu dibicarakan -> otomatis masuk agenda minggu berikutnya', auto.map(function (t) { return [t.qid, t.target_milik, t.minggu]; }).sort(),
  [['M4', 'riki', '2026-W50'], ['M9', 'istri', '2026-W50']]);
eq('judul topik netral (tanpa siapa salah)', auto.filter(function (t) { return t.qid === 'M4'; })[0].judul, 'Target Riki: "Mendengar tanpa memotong"');

// check-in mingguan & topik
v = h(R, 'cj.sesi', { minggu: '2026-W49', aksi: 'mulai' }, sen);
eq('sesi dimulai', !!v.sesi[0].mulai_at, true);
var tp = v.topik.filter(function (t) { return t.sumber === 'harian'; })[0];
lempar('dibahas tanpa tindak lanjut ditolak', function () { h(F, 'cj.topik.update', { id: tp.id, status: 'dibahas' }, sen); }, /tindak lanjut/);
lempar('PIC asing ditolak', function () { h(F, 'cj.topik.update', { id: tp.id, pic: 'tetangga' }, sen); }, /PIC/);
v = h(F, 'cj.topik.update', { id: tp.id, fakta: 'Belum ada tanggal', dampak: 'Cemas', permintaan: 'Putuskan minggu ini', rangkum: 'Kamu ingin kepastian', tindakan: 'Cek tiket', pic: 'riki', tenggat: '2026-12-03', status: 'dibahas' }, sen);
eq('topik dibahas + tindakan & PIC', [v.topik.filter(function (t) { return t.id === tp.id; })[0].status, v.topik.filter(function (t) { return t.id === tp.id; })[0].pic], ['dibahas', 'riki']);
v = h(R, 'cj.topik', { id: 'abcd-1', judul: 'Rencana liburan' }, sen);
eq('topik manual', v.topik.filter(function (t) { return t.sumber === 'manual'; }).length, 1);
lempar('pasangan tidak bisa menghapus topik orang lain', function () { h(F, 'cj.topik.update', { id: 'cj|topik|m|abcd-1', hapus: true }, sen); }, /pembuat/);
v = h(R, 'cj.sesi', { minggu: '2026-W49', aksi: 'selesai' }, '2026-11-30T20:31:00+07:00');
eq('check-in tercatat otomatis + durasi', [!!v.sesi[0].selesai_at, v.sesi[0].durasi, v.sesi[0].topik_dibahas], [true, 31, 1]);

// bulanan
lempar('output bulanan tanpa fokus ditolak', function () { h(R, 'cj.bulan', { bulan: '2026-11', membaik: ['M1'], selesai: true }, sen); }, /fokus/);
lempar('fokus maksimal 2', function () { h(R, 'cj.bulan', { bulan: '2026-11', fokus: ['a', 'b', 'c'] }, sen); }, /maksimal 2/);
v = h(R, 'cj.bulan', { bulan: '2026-11', membaik: ['Satu topik tuntas', 'Merangkum ulang'], fokus: ['Tindak lanjut & PIC'], target: { riki: 'tetap', istri: 'naik', orang: 'x' }, konselor: 'tidak', selesai: true }, sen);
eq('output bulanan', [v.bulanan[0].bulan, v.bulanan[0].fokus, v.bulanan[0].target], ['2026-11', ['Tindak lanjut & PIC'], { riki: 'tetap', istri: 'naik' }]);

// fitur dimatikan admin
st.fitur = { mood: false };
lempar('fitur Daily Mood mati -> cj ditolak', function () { h(R, 'cj.state'); }, /tidak aktif/);
st.fitur = null;

// mundur: satu pihak mencabut persetujuan -> nonaktif, data tetap
v = h(F, 'cj.setuju', { setuju: false }, sen);
eq('dicabut: nonaktif', v.aktif, false);
v = h(F, 'cj.setuju', { setuju: true }, sen);
eq('aktif lagi, data tetap & set tidak diterbitkan ulang', [v.aktif, v.sets.length, v.isian.length > 0], [true, 3, true]);
v = h(F, 'cj.hapus_saya', {}, sen);
eq('hapus isianku saja', [v.isian.filter(function (x) { return x.pemilik === 'istri'; }).length, v.isian.filter(function (x) { return x.pemilik === 'riki'; }).length > 0], [0, true]);

console.log('\n' + lulus + ' cek lulus, ' + gagal + ' gagal.');
if (gagal) process.exit(1);
