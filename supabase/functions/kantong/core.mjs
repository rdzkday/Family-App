// DIBUAT OTOMATIS dari public/shared/core.js. Jangan diedit di sini. Jalankan: node kantong/tools/build_core.js
/*
 * Kantong — core logic (dipakai bersama oleh PWA, mode demo, dan Edge Function Supabase).
 * Salinan untuk Edge Function dibuat oleh: node kantong/tools/build_core.js
 * Gaya ES5 (tanpa optional chaining) dipertahankan supaya jalan di browser lama.
 */
var KantongCore = (function () {
  'use strict';

  var SCHEMA = {
    // manajer = id user manajer keuangan (hanya buku Bersama). penghasilan/rasio/rencana_diubah = rencana budget 40:30:20:10
    Buku: ['id', 'nama', 'tipe', 'pemilik', 'urutan', 'manajer', 'penghasilan', 'rasio', 'rencana_diubah'],
    Users: ['id', 'nama', 'buku'],
    // induk = id kategori induk ('' = induk). pos = kebutuhan | cicilan | tabungan | sosial | ''
    Kategori: ['id', 'nama', 'tipe', 'buku', 'warna', 'hitung', 'aktif', 'urutan', 'induk', 'pos'],
    Kantong: ['id', 'nama', 'jenis', 'buku', 'saldo_awal', 'per_tanggal', 'limit', 'aktif', 'urutan'],
    Budget: ['id', 'bulan', 'buku', 'kategori', 'nominal'],
    Transaksi: ['id', 'tanggal', 'tipe', 'nominal', 'buku', 'kategori', 'kantong', 'kantong_tujuan',
      'keterangan', 'reimburse', 'oleh', 'sumber', 'dibuat', 'diubah', 'dihapus', 'terbayar', 'tx_balik'],
    Todo: ['id', 'judul', 'pemilik', 'tanggal', 'jam', 'durasi', 'selesai', 'selesai_oleh',
      'gcal_event_id', 'gcal_status', 'gcal_error', 'oleh', 'dibuat', 'diubah', 'dihapus', 'tipe', 'isi'],
    // ---- Komitmen (claude/komitmen-brief.md §10) ----
    KomitmenBab: ['id', 'nomor', 'judul', 'urutan', 'dibuat_at', 'dihapus'],
    KomitmenPasal: ['id', 'nomor', 'bab_id', 'tipe', 'judul', 'kata_kunci', 'sumber_asal', 'rujukan_asli', 'terkunci',
      'status', 'versi_berlaku_id', 'dibuat_oleh', 'dibuat_at', 'diubah_at', 'dihapus'],
    KomitmenVersi: ['id', 'pasal_id', 'versi', 'isi_ayat', 'alasan', 'jenis', 'sumber', 'evaluasi_id', 'pengesahan_id',
      'status', 'berlaku_sejak', 'dibuat_oleh', 'dibuat_at'],
    KomitmenKeterangan: ['id', 'pasal_id', 'isi', 'menggantikan_id', 'jenis', 'evaluasi_id', 'pengesahan_id', 'status',
      'berlaku_sejak', 'dibuat_oleh', 'dibuat_at'],
    Pengesahan: ['id', 'judul', 'jenis', 'evaluasi_id', 'ttd_riki', 'ttd_riki_at', 'ttd_febie', 'ttd_febie_at', 'isi_hash',
      'status', 'dibuat_at'],
    Evaluasi: ['id', 'tanggal', 'catatan', 'dibuat_oleh', 'selesai_at'],
    // Ruang Catat (pribadi): satu baris per hari + satu baris pengaturan per orang. isi = JSON dari app.
    Jurnal: ['id', 'pemilik', 'jenis', 'tanggal', 'isi', 'diubah', 'dihapus'],
    // Siklus (catatan haid istri). Baris dihapus = tombstone: tanggal & catatan dikosongkan.
    Siklus: ['id', 'pemilik', 'mulai', 'akhir', 'abaikan_jarak', 'catatan', 'dibuat', 'diubah', 'dihapus'],
    // pengaturan Siklus per user (id = id user). tampil = pilihan masing-masing; sisanya hanya berarti untuk pemilik.
    SiklusAtur: ['id', 'aktif', 'bagikan_jadwal', 'bagikan_catatan', 'tampil', 'setuju_at', 'versi_teks', 'diubah'],
    // Couple Journaling (sub menu Berdua di Daily Mood). isi = JSON; aturan baca/tulis di cjAksi.
    JurnalPasangan: ['id', 'jenis', 'pemilik', 'kunci', 'isi', 'dibuat', 'diubah', 'dihapus']
  };
  var KAT_REIMBURSE = 'reimburse-masuk';   // kategori pemasukan otomatis, tidak dihitung sebagai pendapatan
  var KAT_SETORAN = 'setoran-rt';          // pengeluaran otomatis: topup dari kantong pribadi ke dompet bersama
  var KAT_SETORAN_MASUK = 'setoran-rt-in'; // pemasukan otomatis di sisi dompet bersama
  var TIPE_TX = ['Pengeluaran', 'Pemasukan', 'Transfer'];
  var JENIS_KANTONG = ['Cash', 'Debit', 'E-wallet', 'Kredit'];
  var VERSION = '1.10.0';
  // ---------- to-do ----------
  var TODO_BERSAMA = 'bersama';          // pemilik to-do bersama (selain itu: id user)
  var TODO_DURASI = 30;                  // menit, dipakai kalau jam diisi tapi durasi kosong
  var TODO_SELESAI_EVENT = 'centang';    // 'centang' = event dibiarkan, judul diberi tanda ✓ ; 'hapus' = event dihapus saat dicentang
  var TODO_SIMPAN_SELESAI_HARI = 30;     // to-do selesai lebih lama dari ini tidak dikirim ke app
  // tipe baris di tabel Todo: to-do biasa, catatan (tanpa centang & tanpa kalender), agenda evaluasi bulanan
  var TODO_TIPE = ['todo', 'catatan', 'evaluasi'];
  var EVALUASI_JUDUL = 'Evaluasi bulanan';
  var EVALUASI_PENGINGAT_JAM = 6;         // kartu pengingat evaluasi muncul mulai 6 jam sebelum jadwal

  // ---------- util ----------
  function err(msg) { var e = new Error(msg); e.userFacing = true; return e; }

  // ---------- fitur modular ----------
  // Fitur yang bisa dinyalakan/dimatikan admin (tabel app_setting, kunci 'fitur'). Beranda & Pengaturan selalu ada.
  // aksi: prefiks/nama aksi milik fitur itu. Fitur nonaktif = aksinya ditolak.
  var FITUR = [
    { id: 'kantong', nama: 'Kantong', aksi: ['month', 'tx.', 'budget.', 'kantong.', 'kategori.', 'talangan.', 'buku.'] },
    { id: 'agenda', nama: 'Agenda', aksi: ['todo.', 'kalender.', 'siklus.'] },   // Siklus = lapisan di Kalender Agenda
    { id: 'komitmen', nama: 'Komitmen', aksi: ['komitmen.', 'pengesahan.'] },
    { id: 'mood', nama: 'Daily Mood', aksi: ['jurnal.', 'cj.'] }   // cj. = Couple Journaling
  ];
  function fiturDariAksi(action) {
    action = String(action || '');
    for (var i = 0; i < FITUR.length; i++) {
      for (var j = 0; j < FITUR[i].aksi.length; j++) {
        var a = FITUR[i].aksi[j];
        if (a.slice(-1) === '.' ? action.indexOf(a) === 0 : action === a) return FITUR[i];
      }
    }
    return null;
  }
  // setelan: { kantong: true, ... } atau null (semua aktif). Fitur yang tidak disebut dianggap aktif.
  function fiturAktif(setelan, id) { return !setelan || setelan[id] !== false; }
  function cekFitur(setelan, action) {
    var f = fiturDariAksi(action);
    if (f && !fiturAktif(setelan, f.id)) throw err('Fitur ' + f.nama + ' tidak aktif');
  }
  function isDate(s) { return typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s); }
  function isMonth(s) { return typeof s === 'string' && /^\d{4}-\d{2}$/.test(s); }
  function isTime(s) { return typeof s === 'string' && /^([01]\d|2[0-3]):[0-5]\d$/.test(s); }
  function bool(v) { return v === true || v === 'TRUE' || v === 'true' || v === 1; }
  function num(v) { var n = Number(v); return isFinite(n) ? n : 0; }
  function byId(list) { var m = {}; for (var i = 0; i < list.length; i++) m[list[i].id] = list[i]; return m; }
  function scopeOf(k) { return String(k.buku || '').split(',').map(function (s) { return s.trim(); }).filter(Boolean); }
  function slug(s) {
    return String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40) || 'item';
  }
  function addDays(iso, n) {
    var p = iso.split('-'); var d = new Date(Date.UTC(+p[0], +p[1] - 1, +p[2] + n));
    return d.toISOString().slice(0, 10);
  }
  function sortBy(list, key) {
    return list.slice().sort(function (a, b) { return num(a[key]) - num(b[key]); });
  }

  // ---------- izin ----------
  function canWrite(db, user, bukuId) {
    var b = byId(db.Buku)[bukuId];
    if (!b || !user) return false;
    return b.tipe === 'Bersama' || b.pemilik === user.id;
  }
  function writableBuku(db, user) {
    return sortBy(db.Buku, 'urutan').filter(function (b) { return canWrite(db, user, b.id); });
  }

  // ---------- perhitungan ----------
  function liveTx(db) { return db.Transaksi.filter(function (t) { return !t.dihapus; }); }

  function txEffects(t) {
    // [ [kantongId, delta], ... ]
    var n = num(t.nominal);
    if (t.tipe === 'Pengeluaran') return [[t.kantong, -n]];
    if (t.tipe === 'Pemasukan') return [[t.kantong, n]];
    if (t.tipe === 'Transfer') return [[t.kantong, -n], [t.kantong_tujuan, n]];
    return [];
  }

  function computeSaldo(db) {
    var kmap = byId(db.Kantong), out = {}, delta = {};
    db.Kantong.forEach(function (k) { out[k.id] = num(k.saldo_awal); delta[k.id] = 0; });
    liveTx(db).forEach(function (t) {
      txEffects(t).forEach(function (e) {
        var k = kmap[e[0]];
        if (k && String(t.tanggal) > String(k.per_tanggal || '')) { out[k.id] += e[1]; delta[k.id] += e[1]; }
      });
    });
    return { saldo: out, delta: delta };
  }

  function effectiveBudget(db, bulan) {
    // { bukuId: { sumber: 'YYYY-MM' | null, items: { kategoriId: nominal } } }
    var res = {};
    db.Buku.forEach(function (b) {
      var best = null;
      db.Budget.forEach(function (r) {
        if (r.buku === b.id && String(r.bulan) <= bulan && (!best || String(r.bulan) > best)) best = String(r.bulan);
      });
      var items = {};
      if (best) db.Budget.forEach(function (r) {
        if (r.buku === b.id && String(r.bulan) === best) items[r.kategori] = num(r.nominal);
      });
      res[b.id] = { sumber: best, items: items };
    });
    return res;
  }

  function bukuOfKantong(db, kantongId) { var k = byId(db.Kantong)[kantongId]; return k ? k.buku : ''; }

  // Arah transfer antar buku:
  //  'topup' = kantong pribadi -> kantong dompet bersama (setoran bulanan)
  //  'ganti' = kantong dompet bersama -> kantong pribadi (penggantian talangan)
  //  ''      = pindah dalam buku yang sama atau antar buku pribadi
  function arahTransfer(db, t) {
    if (t.tipe !== 'Transfer') return '';
    var bmap = byId(db.Buku), kmap = byId(db.Kantong);
    var ks = kmap[t.kantong], kt = kmap[t.kantong_tujuan];
    if (!ks || !kt || ks.buku === kt.buku) return '';
    var bs = bmap[ks.buku], bt = bmap[kt.buku];
    if (!bs || !bt) return '';
    if (bs.tipe === 'Pribadi' && bt.tipe === 'Bersama') return 'topup';
    if (bs.tipe === 'Bersama' && bt.tipe === 'Pribadi') return 'ganti';
    return '';
  }

  // apakah transaksi relevan untuk tampilan buku tertentu ('all' = semua)
  function txInBuku(db, t, bukuSel) {
    if (bukuSel === 'all') return true;
    if (t.buku === bukuSel) return true;
    return t.tipe === 'Transfer' && bukuOfKantong(db, t.kantong_tujuan) === bukuSel;
  }

  // nama cadangan kalau baris kategori otomatis belum ada di Sheet
  function katBawaan(kid) {
    if (kid === KAT_SETORAN) return { id: kid, nama: 'Setoran RT', warna: '#A8B6D9' };
    if (kid === KAT_SETORAN_MASUK) return { id: kid, nama: 'Setoran dari pribadi', warna: '#A8B6D9' };
    return { id: kid, nama: kid || 'Tanpa kategori', warna: '#94A3B8' };
  }

  function summarize(db, monthTx, budgets, bukuSel) {
    var inSet = function (b) { return bukuSel === 'all' || b === bukuSel; };
    var kmap = byId(db.Kategori);
    var s = { pemasukan: 0, pengeluaran: 0, reimburse: 0, reimburseMenunggu: 0, transferMasuk: 0, transferKeluar: 0,
      setoran: 0, setoranMasuk: 0, budgetTotal: 0, perKategori: [], perMasuk: [] };
    var spend = {}, inc = {}, rinci = {};
    monthTx.forEach(function (t) {
      if (t.dihapus) return;
      var n = num(t.nominal), k = kmap[t.kategori];
      if (t.tipe === 'Pengeluaran' && inSet(t.buku)) {
        // reimburse: tetap dihitung selama menunggu; keluar dari hitungan setelah terbayar
        if (bool(t.reimburse) && t.terbayar) { s.reimburse += n; return; }
        if (bool(t.reimburse)) s.reimburseMenunggu += n;
        if (k && !bool(k.hitung)) return;
        // pengeluaran di sub dijumlah ke induknya; rincian per sub disimpan terpisah
        var ki = indukDari(kmap, t.kategori);
        s.pengeluaran += n; spend[ki] = (spend[ki] || 0) + n;
        rinci[ki] = rinci[ki] || {}; rinci[ki][t.kategori] = (rinci[ki][t.kategori] || 0) + n;
      } else if (t.tipe === 'Pemasukan' && inSet(t.buku)) {
        if (k && !bool(k.hitung)) return;
        var km = indukDari(kmap, t.kategori);
        s.pemasukan += n; inc[km] = (inc[km] || 0) + n;
      } else if (t.tipe === 'Transfer') {
        var src = inSet(t.buku), dst = inSet(bukuOfKantong(db, t.kantong_tujuan));
        // src && dst berarti kedua sisi ada di tampilan ini (mis. buku 'all' atau pindah dalam buku):
        // sengaja tidak dihitung supaya satu rupiah tidak kehitung dua kali.
        if (arahTransfer(db, t) === 'topup') {
          // setoran ke dompet bersama = pengeluaran di buku pribadi, pemasukan di buku bersama
          if (src && !dst) { s.pengeluaran += n; s.setoran += n; spend[KAT_SETORAN] = (spend[KAT_SETORAN] || 0) + n; }
          else if (dst && !src) { s.pemasukan += n; s.setoranMasuk += n; inc[KAT_SETORAN_MASUK] = (inc[KAT_SETORAN_MASUK] || 0) + n; }
        } else {
          // penggantian talangan dan pindah antar kantong: bukan pengeluaran/pemasukan baru
          if (src && !dst) s.transferKeluar += n;
          if (dst && !src) s.transferMasuk += n;
        }
      }
    });
    var bud = {};
    Object.keys(budgets || {}).forEach(function (b) {
      if (!inSet(b)) return;
      var items = budgets[b].items || {};
      // budget hanya di induk; kalau ada budget lama di sub, ikut ke induknya
      Object.keys(items).forEach(function (kid) { var ki = indukDari(kmap, kid); bud[ki] = (bud[ki] || 0) + num(items[kid]); });
    });
    var ids = {};
    Object.keys(spend).forEach(function (k) { ids[k] = 1; });
    Object.keys(bud).forEach(function (k) { if (bud[k] > 0) ids[k] = 1; });
    s.perKategori = Object.keys(ids).map(function (kid) {
      var k = kmap[kid] || katBawaan(kid);
      var total = spend[kid] || 0, b = bud[kid] || 0;
      s.budgetTotal += b;
      var sub = Object.keys(rinci[kid] || {}).map(function (sid) {
        var sk = kmap[sid] || katBawaan(sid);
        return { id: sid, nama: sk.nama, warna: sk.warna, total: rinci[kid][sid], langsung: sid === kid };
      }).sort(function (a, b) { return b.total - a.total; });
      return { id: kid, nama: k.nama, warna: k.warna, total: total, budget: b, sisa: b - total,
        pct: s.pengeluaran > 0 ? total / s.pengeluaran : 0, pos: k.pos || '', sub: sub };
    }).sort(function (a, b) { return b.total - a.total || b.budget - a.budget; });
    s.perMasuk = Object.keys(inc).map(function (kid) {
      var k = kmap[kid] || katBawaan(kid);
      return { id: kid, nama: k.nama, warna: k.warna, total: inc[kid] };
    }).sort(function (a, b) { return b.total - a.total; });
    s.selisih = s.pemasukan - s.pengeluaran;
    s.sisaBudget = s.budgetTotal - s.pengeluaran;
    return s;
  }

  // ---------- template kategori, sub-kategori, rencana budget 40:30:20:10 ----------
  // Template disimpan di kode (bukan database) supaya gampang diedit. Tiap baris: [nama, level minimal, pos, sub].
  // Level: s = Simpel, m = Menengah, d = Detail. Level lebih tinggi selalu memuat isi level di bawahnya.
  // Pos: K = kebutuhan, C = cicilan, T = tabungan, S = sosial. Sub: [nama, level minimal]. Kategori Pemasukan tanpa pos & budget.
  var TEMPLATE_KATEGORI = {
    pribadi: {
      pengeluaran: [
        ['Makan & jajan', 's', 'K', [['Makan', 'm'], ['Kopi & jajan', 'm'], ['Makan siang kantor', 'd']]],
        ['Transportasi', 's', 'K', [['Bensin', 'm'], ['Ojek & transport umum', 'm'], ['Parkir & tol', 'm'], ['Servis kendaraan', 'd']]],
        ['Pulsa & internet', 's', 'K', []],
        ['Kebutuhan pribadi', 's', 'K', [['Perawatan diri', 'm'], ['Pakaian', 'm'], ['Kesehatan', 'm'], ['Potong rambut', 'd'], ['Olahraga', 'd']]],
        ['Pengembangan diri', 'd', 'K', [['Buku', 'd'], ['Kursus', 'd']]],
        ['Hiburan', 's', 'K', [['Langganan', 'm'], ['Nongkrong', 'm'], ['Hobi', 'd'], ['Liburan', 'd']]],
        ['Cicilan & utang', 's', 'C', [['Kartu kredit', 'm'], ['Paylater', 'm'], ['Cicilan gadget', 'd'], ['Pinjaman', 'd']]],
        ['Tabungan & investasi', 's', 'T', [['Dana darurat', 'm'], ['Investasi', 'm'], ['Tabungan tujuan', 'd'], ['Reksa dana', 'd'], ['Emas', 'd']]],
        ['Sosial & sedekah', 's', 'S', [['Sedekah', 'm'], ['Hadiah', 'm'], ['Zakat', 'd'], ['Kondangan', 'd'], ['Bantu keluarga', 'd']]]
      ],
      pemasukan: [['Gaji', 's'], ['Bonus', 'm'], ['Freelance', 'm'], ['THR', 'd'], ['Hasil investasi', 'd'], ['Pemasukan lain', 's']]
    },
    rt: {
      pengeluaran: [
        ['Belanja dapur', 's', 'K', [['Sayur & lauk', 'm'], ['Bumbu & sembako', 'm'], ['Galon & gas', 'm']]],
        ['Tagihan rumah', 's', 'K', [['Listrik', 'm'], ['Air', 'm'], ['Internet', 'm'], ['IPL/iuran', 'd'], ['Asuransi', 'd']]],
        ['Kebutuhan rumah', 's', 'K', [['Kebersihan', 'm'], ['Perlengkapan rumah', 'm'], ['Perbaikan rumah', 'd'], ['ART/laundry', 'd']]],
        ['Transportasi keluarga', 's', 'K', []],
        ['Kesehatan keluarga', 's', 'K', [['Obat', 'm'], ['Dokter', 'm']]],
        ['Anak', 'd', 'K', [['Kebutuhan anak', 'd'], ['Pendidikan', 'd']]],
        ['Hiburan keluarga', 'd', 'K', [['Makan di luar', 'd'], ['Langganan', 'd']]],
        ['Cicilan', 's', 'C', [['Cicilan rumah', 'm'], ['Cicilan kendaraan', 'm']]],
        ['Tabungan bersama', 's', 'T', [['Dana darurat', 'm'], ['Liburan', 'm'], ['Pendidikan anak', 'd'], ['Investasi', 'd']]],
        ['Sosial & keluarga besar', 's', 'S', [['Orang tua', 'm'], ['Sedekah', 'm'], ['Kondangan', 'd'], ['Zakat', 'd']]]
      ],
      // Setoran dari pribadi dibuat otomatis oleh sistem, jadi tidak ada di sini
      pemasukan: [['Pemasukan lain', 's']]
    }
  };
  var TEMPLATE_LEVEL = ['simpel', 'menengah', 'detail'];
  var POS = ['kebutuhan', 'cicilan', 'tabungan', 'sosial'];          // urutan = urutan rasio
  var POS_NAMA = { kebutuhan: 'Kebutuhan', cicilan: 'Cicilan', tabungan: 'Tabungan', sosial: 'Sosial' };
  var POS_KODE = { K: 'kebutuhan', C: 'cicilan', T: 'tabungan', S: 'sosial' };
  var RASIO_BAKU = '40,30,20,10';
  var TEMPLATE_WARNA = ['#FFC2B0', '#B8D4FF', '#A8E0E8', '#C9B8FF', '#FFE29A', '#FFC6DA', '#F4B8B8', '#B8E6CF', '#E3C6F2', '#FFD6A5'];
  var WARNA_MASUK = ['#34D399', '#5EEAD4', '#6EE7B7', '#A7F3D0', '#99F6E4', '#86EFAC'];
  var KAT_SISTEM = [KAT_REIMBURSE, KAT_SETORAN, KAT_SETORAN_MASUK];

  // nama dibandingkan tanpa beda huruf besar/kecil & spasi (sama dengan index unik di database)
  function normNama(s) { return String(s || '').toLowerCase().replace(/\s+/g, ' ').trim(); }
  function isSistem(k) { return KAT_SISTEM.indexOf(k && k.id) >= 0; }
  function jenisTemplate(b) { return b && b.tipe === 'Bersama' ? 'rt' : 'pribadi'; }

  // Daftar datar isi template: [{ nama, tipe, pos, induk (nama induk, '' = induk), warna }]
  function templateDaftar(jenis, level) {
    var t = TEMPLATE_KATEGORI[jenis], lv = TEMPLATE_LEVEL.indexOf(level);
    if (!t || lv < 0) throw err('Level template tidak dikenal');
    var ikut = function (x) { return TEMPLATE_LEVEL.indexOf({ s: 'simpel', m: 'menengah', d: 'detail' }[x]) <= lv; };
    var out = [];
    t.pengeluaran.forEach(function (r, i) {
      if (!ikut(r[1])) return;
      var pos = POS_KODE[r[2]] || '', w = TEMPLATE_WARNA[i % TEMPLATE_WARNA.length];
      out.push({ nama: r[0], tipe: 'Pengeluaran', pos: pos, induk: '', warna: w });
      (r[3] || []).forEach(function (sb) { if (ikut(sb[1])) out.push({ nama: sb[0], tipe: 'Pengeluaran', pos: pos, induk: r[0], warna: w }); });
    });
    t.pemasukan.forEach(function (r, i) {
      if (ikut(r[1])) out.push({ nama: r[0], tipe: 'Pemasukan', pos: '', induk: '', warna: WARNA_MASUK[i % WARNA_MASUK.length] });
    });
    return out;
  }

  // Siapa boleh memilih template & mengatur budget otomatis: pemilik buku pribadi, atau manajer keuangan buku bersama.
  function bolehAturRencana(db, user, bukuId) {
    var b = byId(db.Buku)[bukuId];
    if (!b || !user) return false;
    if (b.tipe === 'Bersama') return !!b.manajer && b.manajer === user.id;
    return b.pemilik === user.id;
  }
  function cekAturRencana(db, user, bukuId) {
    var b = byId(db.Buku)[bukuId];
    if (!b) throw err('Buku tidak valid');
    if (bolehAturRencana(db, user, bukuId)) return b;
    if (b.tipe === 'Bersama') throw err(b.manajer ? 'Hanya manajer keuangan yang bisa mengatur ini' : 'Pilih dulu manajer keuangan rumah tangga');
    throw err('Hanya pemilik buku yang bisa mengatur ini');
  }
  // Buku "kosong" = belum punya kategori sendiri. Kategori sistem (setoran, reimburse) tidak dihitung.
  function bukuKosong(db, bukuId) {
    return !(db.Kategori || []).some(function (k) { return !isSistem(k) && scopeOf(k).indexOf(bukuId) >= 0; });
  }
  // kategori lain yang namanya sama di buku & induk yang sama (aturan anti dobel)
  function kategoriKembar(db, nama, bukuList, induk, kecualiId) {
    var n = normNama(nama);
    return (db.Kategori || []).filter(function (k) {
      if (k.id === kecualiId || !bool(k.aktif) || String(k.induk || '') !== String(induk || '') || normNama(k.nama) !== n) return false;
      return scopeOf(k).some(function (b) { return bukuList.indexOf(b) >= 0; });
    })[0] || null;
  }
  // id kategori -> id induknya (atau dirinya sendiri)
  function indukDari(kmap, kid) {
    var k = kmap[kid];
    return k && k.induk && kmap[k.induk] ? k.induk : kid;
  }
  function parseRasio(v) {
    var a = (Object.prototype.toString.call(v) === '[object Array]' ? v : String(v == null || v === '' ? RASIO_BAKU : v).split(','))
      .map(function (x) { return String(x).trim(); });
    if (a.length !== 4 || a.some(function (x) { return !/^\d+$/.test(x); })) throw err('Rasio harus 4 angka, mis. 40,30,20,10');
    var n = a.map(Number);
    if (n[0] + n[1] + n[2] + n[3] !== 100) throw err('Total rasio harus 100');
    return n;
  }
  // Pembagian murni (dipakai server & layar pratinjau). induk: [{ key, pos }] berurutan.
  // Nominal pos dibagi rata ke induk di pos itu, dibulatkan ke ribuan; sisa pembulatan masuk ke induk pertama pos itu.
  function bagiRencana(induk, penghasilan, rasio) {
    var r = parseRasio(rasio), total = Math.max(0, Math.round(num(penghasilan)));
    var out = { penghasilan: total, rasio: r.join(','), pos: [], items: {}, belum_dialokasikan: [] };
    POS.forEach(function (p, i) {
      var nom = Math.round(total * r[i] / 100);
      var anggota = induk.filter(function (x) { return x.pos === p; });
      out.pos.push({ pos: p, nama: POS_NAMA[p], persen: r[i], nominal: nom, kategori: anggota.map(function (x) { return x.key; }) });
      if (!anggota.length) { if (nom > 0) out.belum_dialokasikan.push({ pos: p, nama: POS_NAMA[p], nominal: nom }); return; }
      var tiap = Math.floor(nom / anggota.length / 1000) * 1000;
      anggota.forEach(function (x, j) { out.items[x.key] = j === 0 ? nom - tiap * (anggota.length - 1) : tiap; });
    });
    return out;
  }
  // induk Pengeluaran di buku ini yang ikut rencana budget
  function indukRencana(db, bukuId) {
    return sortBy((db.Kategori || []).filter(function (k) {
      return k.tipe === 'Pengeluaran' && !k.induk && !isSistem(k) && bool(k.aktif) && bool(k.hitung) &&
        POS.indexOf(k.pos) >= 0 && scopeOf(k).indexOf(bukuId) >= 0;
    }), 'urutan').map(function (k) { return { key: k.id, pos: k.pos, nama: k.nama }; });
  }
  function rencanaBuku(b) {
    return { penghasilan: num(b.penghasilan), rasio: String(b.rasio || RASIO_BAKU), diubah: String(b.rencana_diubah || '') };
  }

  // id kategori dari template: '<buku>-<nama>' atau '<buku>-<induk>-<nama>', unik
  function idTemplate(ada, bukuId, indukNama, nama) {
    var base = slug(bukuId + ' ' + (indukNama ? indukNama + ' ' : '') + nama), id = base, n = 2;
    while (ada[id]) id = base.slice(0, 36) + '-' + (n++);
    return id;
  }
  function terapkanTemplate(store, db, user, bukuId, level) {
    var b = cekAturRencana(db, user, bukuId);
    var daftar = templateDaftar(jenisTemplate(b), level);
    var ada = byId(db.Kategori), dibuat = 0, dilewati = [], idInduk = {};
    var urut = (db.Kategori || []).reduce(function (m, k) { return Math.max(m, num(k.urutan)); }, 0);
    // nama yang sudah ada (aktif atau nonaktif) di buku ini dilewati, tidak error. Aman dipanggil 2x.
    function cari(nama, induk) {
      var n = normNama(nama);
      return (db.Kategori || []).filter(function (k) {
        return !isSistem(k) && String(k.induk || '') === induk && normNama(k.nama) === n && scopeOf(k).indexOf(bukuId) >= 0;
      })[0];
    }
    daftar.forEach(function (x) {
      var indukId = '';
      if (x.induk) {
        indukId = idInduk[normNama(x.induk)] || '';
        if (!indukId) { dilewati.push(x.induk + ' › ' + x.nama); return; }
      }
      var kembar = cari(x.nama, indukId);
      if (kembar) {
        if (!x.induk) idInduk[normNama(x.nama)] = kembar.id;
        dilewati.push(x.induk ? x.induk + ' › ' + x.nama : x.nama);
        return;
      }
      var id = idTemplate(ada, bukuId, x.induk, x.nama);
      var kat = { id: id, nama: x.nama, tipe: x.tipe, buku: bukuId, warna: x.warna, hitung: true, aktif: true,
        urutan: ++urut, induk: indukId, pos: x.pos };
      store.upsert('Kategori', kat);
      db.Kategori.push(kat); ada[id] = kat; dibuat++;
      if (!x.induk) idInduk[normNama(x.nama)] = id;
    });
    db.Kategori = store.all('Kategori');
    return { dibuat: dibuat, dilewati: dilewati };
  }

  // ---------- validasi ----------
  function cleanTx(input, db, user, existing) {
    var t = {
      id: String(input.id || ''), tanggal: String(input.tanggal || ''), tipe: String(input.tipe || ''),
      nominal: Math.round(num(input.nominal)), buku: String(input.buku || ''),
      kategori: String(input.kategori || ''), kantong: String(input.kantong || ''),
      kantong_tujuan: String(input.kantong_tujuan || ''),
      keterangan: String(input.keterangan || '').trim().slice(0, 200),
      reimburse: bool(input.reimburse),
      // status terbayar hanya diubah lewat aksi tx.reimburse, tidak bisa dari form biasa
      terbayar: existing ? String(existing.terbayar || '') : '',
      tx_balik: existing ? String(existing.tx_balik || '') : ''
    };
    if (!t.id || t.id.length > 64) throw err('ID transaksi tidak valid');
    if (TIPE_TX.indexOf(t.tipe) < 0) throw err('Tipe transaksi tidak valid');
    if (!(t.nominal > 0) || t.nominal > 1e12) throw err('Nominal harus lebih dari 0');
    if (!isDate(t.tanggal)) throw err('Tanggal tidak valid');
    var kan = byId(db.Kantong), kat = byId(db.Kategori);
    var src = kan[t.kantong];
    if (!src) throw err('Pilih kantong');
    var keep = function (field) { return existing && existing[field] === t[field]; };
    if (!bool(src.aktif) && !keep('kantong')) throw err('Kantong "' + src.nama + '" nonaktif');
    if (!canWrite(db, user, src.buku)) throw err('Kamu tidak bisa memakai kantong "' + src.nama + '"');
    if (t.tipe === 'Transfer') {
      var dst = kan[t.kantong_tujuan];
      if (!dst) throw err('Pilih kantong tujuan');
      if (dst.id === src.id) throw err('Kantong asal dan tujuan sama');
      if (!bool(dst.aktif) && !keep('kantong_tujuan')) throw err('Kantong tujuan nonaktif');
      t.buku = src.buku; t.kategori = ''; t.reimburse = false; t.terbayar = ''; t.tx_balik = '';
    } else {
      t.kantong_tujuan = '';
      if (!byId(db.Buku)[t.buku]) throw err('Buku tidak valid');
      var k = kat[t.kategori];
      if (!k) throw err('Pilih kategori');
      if (k.tipe !== t.tipe) throw err('Kategori tidak cocok dengan tipe transaksi');
      if (!bool(k.aktif) && !keep('kategori')) throw err('Kategori "' + k.nama + '" nonaktif');
      if (scopeOf(k).indexOf(t.buku) < 0 && !keep('kategori')) throw err('Kategori "' + k.nama + '" tidak tersedia di buku ini');
      if (t.tipe === 'Pemasukan') { t.reimburse = false; t.terbayar = ''; t.tx_balik = ''; }
    }
    if (!canWrite(db, user, t.buku)) throw err('Kamu hanya bisa melihat buku ini');
    return t;
  }

  // ---------- utang antar buku (Rumah Tangga <-> pribadi) ----------
  // Jumlah positif = buku bersama masih berutang ke pemilik buku pribadi.
  //  + pengeluaran buku bersama yang dibayar pakai kantong pribadi
  //  - transfer dari kantong buku bersama ke kantong pribadi (penggantian)
  // Topup (transfer pribadi -> bersama) sengaja tidak dihitung: itu alokasi dana, bukan utang.
  function computeUtang(db) {
    var kmap = byId(db.Kantong), bmap = byId(db.Buku), acc = {};
    function key(b, p) { return b + '|' + p; }
    function add(b, p, n) { var k = key(b, p); acc[k] = (acc[k] || 0) + n; }
    function pribadi(kid) { var k = kmap[kid]; var b = k ? bmap[k.buku] : null; return b && b.tipe === 'Pribadi' ? b : null; }
    function bersama(kid) { var k = kmap[kid]; var b = k ? bmap[k.buku] : null; return b && b.tipe === 'Bersama' ? b : null; }
    liveTx(db).forEach(function (t) {
      var n = num(t.nominal), tb = bmap[t.buku];
      if (t.tipe === 'Pengeluaran' && tb && tb.tipe === 'Bersama' && !bool(t.reimburse)) {
        var p = pribadi(t.kantong); if (p) add(tb.id, p.id, n);
      } else if (t.tipe === 'Pemasukan' && tb && tb.tipe === 'Bersama' && t.sumber !== 'auto') {
        var p2 = pribadi(t.kantong); if (p2) add(tb.id, p2.id, -n);
      } else if (t.tipe === 'Transfer') {
        var from = bersama(t.kantong), to = pribadi(t.kantong_tujuan);
        if (from && to) add(from.id, to.id, -n);
      }
    });
    return Object.keys(acc).filter(function (k) { return acc[k] !== 0; }).map(function (k) {
      var p = k.split('|');
      return { dari: p[0], ke: p[1], jumlah: acc[k] };
    });
  }

  // ---------- talangan: belanja buku bersama yang dibayar pakai kantong pribadi ----------
  // Daftar per transaksi (bukan total), hanya yang belum ditandai lunas.
  function computeTalangan(db) {
    var kmap = byId(db.Kantong), bmap = byId(db.Buku), out = [];
    liveTx(db).forEach(function (t) {
      if (t.tipe !== 'Pengeluaran' || bool(t.reimburse) || t.terbayar) return;
      var tb = bmap[t.buku];
      if (!tb || tb.tipe !== 'Bersama') return;
      var k = kmap[t.kantong];
      if (!k) return;
      var pb = bmap[k.buku];
      if (!pb || pb.tipe !== 'Pribadi') return;
      out.push({ id: t.id, tanggal: String(t.tanggal), nominal: num(t.nominal),
        keterangan: String(t.keterangan || ''), kategori: String(t.kategori || ''),
        buku: tb.id, pemilik: pb.id, kantong: t.kantong, oleh: String(t.oleh || '') });
    });
    return out.sort(function (a, b) { return a.tanggal < b.tanggal ? -1 : (a.tanggal > b.tanggal ? 1 : 0); });
  }

  function ensureKategoriSetoran(store, db) {
    var semua = db.Buku.map(function (b) { return b.id; }).join(',');
    var perlu = [
      { id: KAT_SETORAN, nama: 'Setoran RT', tipe: 'Pengeluaran', urutan: 97 },
      { id: KAT_SETORAN_MASUK, nama: 'Setoran dari pribadi', tipe: 'Pemasukan', urutan: 98 }
    ];
    var kmap = byId(db.Kategori), dibuat = false;
    perlu.forEach(function (p) {
      if (kmap[p.id]) return;
      store.upsert('Kategori', { id: p.id, nama: p.nama, tipe: p.tipe, buku: semua,
        warna: '#A8B6D9', hitung: true, aktif: true, urutan: p.urutan });
      dibuat = true;
    });
    if (dibuat) db.Kategori = store.all('Kategori');
  }

  function ensureKategoriReimburse(store, db) {
    var ada = byId(db.Kategori)[KAT_REIMBURSE];
    if (ada) return ada;
    var kat = { id: KAT_REIMBURSE, nama: 'Reimburse masuk', tipe: 'Pemasukan',
      buku: db.Buku.map(function (b) { return b.id; }).join(','), warna: '#9CA3AF',
      hitung: false, aktif: true, urutan: 99 };
    store.upsert('Kategori', kat);
    db.Kategori = store.all('Kategori');
    return kat;
  }
  function clone(o) { var c = {}; Object.keys(o).forEach(function (k) { c[k] = o[k]; }); return c; }
  function softDelete(store, t, nowIso) { var d = clone(t); d.dihapus = nowIso; d.diubah = nowIso; store.upsert('Transaksi', d); }

  // ---------- to-do rumah tangga ----------
  // pemilik: id user ('riki', 'istri', ...) atau 'bersama'.
  // Tulis = pemilik sendiri atau bersama; semua orang bisa lihat semua.
  function canWriteTodo(user, t) {
    if (!user || !t) return false;
    return t.pemilik === TODO_BERSAMA || t.pemilik === user.id;
  }
  function todoPemilikNama(db, pemilik) {
    if (pemilik === TODO_BERSAMA) return 'Bersama';
    var u = byId(db.Users || [])[pemilik];
    return u ? u.nama : pemilik;
  }
  function todoTipe(t) { var x = String((t && t.tipe) || 'todo'); return TODO_TIPE.indexOf(x) >= 0 ? x : 'todo'; }
  function cleanTodo(input, db, user, existing) {
    var tipe = String(input.tipe || (existing ? todoTipe(existing) : 'todo'));
    if (TODO_TIPE.indexOf(tipe) < 0) throw err('Tipe tidak dikenal');
    var t = {
      id: String(input.id || ''),
      tipe: tipe,
      isi: String(input.isi || '').replace(/\r\n?/g, '\n').trim().slice(0, 2000),
      judul: String(input.judul || '').replace(/\s+/g, ' ').trim().slice(0, 120),
      pemilik: String(input.pemilik || (existing ? existing.pemilik : (tipe === 'evaluasi' ? TODO_BERSAMA : user.id))),
      tanggal: String(input.tanggal || ''),
      jam: String(input.jam || ''),
      durasi: (input.durasi === undefined || input.durasi === null || input.durasi === '')
        ? (existing && num(existing.durasi) ? num(existing.durasi) : TODO_DURASI) : Math.round(num(input.durasi))
    };
    if (!t.id || t.id.length > 64) throw err('ID to-do tidak valid');
    if (tipe === 'catatan') {
      // catatan: cukup isi; judul = baris pertama. Tidak pernah punya waktu, jadi tidak pernah masuk kalender.
      if (!t.judul) t.judul = t.isi.split('\n')[0].replace(/\s+/g, ' ').trim().slice(0, 120);
      t.tanggal = ''; t.jam = '';
    }
    if (tipe === 'evaluasi' && !t.judul) t.judul = EVALUASI_JUDUL;
    if (!t.judul) throw err(tipe === 'catatan' ? 'Tulis dulu catatannya' : 'Tulis dulu to-do-nya');
    if (t.pemilik !== TODO_BERSAMA && !byId(db.Users || [])[t.pemilik]) throw err('Pilih untuk siapa to-do ini');
    if (tipe === 'evaluasi' && !t.tanggal) throw err('Evaluasi butuh tanggal');
    if (t.tanggal && !isDate(t.tanggal)) throw err('Tanggal tidak valid');
    if (!t.tanggal) t.jam = '';                       // tanpa tanggal = tanpa waktu sama sekali
    if (t.jam && !isTime(t.jam)) throw err('Jam tidak valid');
    if (!(t.durasi >= 5 && t.durasi <= 1440)) throw err('Durasi 5 menit sampai 24 jam');
    return t;
  }
  // Kartu pengingat evaluasi: agenda evaluasi terdekat yang belum selesai, kalau sekarang sudah masuk
  // jendela EVALUASI_PENGINGAT_JAM sebelum mulai dan acaranya belum lewat. nowLocal: 'YYYY-MM-DDTHH:MM' (waktu lokal).
  function evaluasiPengingat(todos, nowLocal) {
    var best = null;
    (todos || []).forEach(function (t) {
      if (t.dihapus || bool(t.selesai) || todoTipe(t) !== 'evaluasi' || !t.tanggal) return;
      var mulai = t.tanggal + 'T' + (t.jam || '00:00');
      var akhir = t.jam ? addMinutes(t.tanggal, t.jam, num(t.durasi) || TODO_DURASI) : addDays(t.tanggal, 1) + 'T00:00';
      var buka = addMinutes(t.tanggal, t.jam || '00:00', -EVALUASI_PENGINGAT_JAM * 60);
      if (nowLocal < buka || nowLocal >= akhir) return;
      if (!best || mulai < best.mulai) best = { todo: t, mulai: mulai, akhir: akhir, menit: menitAntara(nowLocal, mulai) };
    });
    return best;
  }
  function menitAntara(a, b) {   // b - a dalam menit, keduanya 'YYYY-MM-DDTHH:MM'
    var pa = Date.UTC(+a.slice(0, 4), +a.slice(5, 7) - 1, +a.slice(8, 10), +a.slice(11, 13), +a.slice(14, 16));
    var pb = Date.UTC(+b.slice(0, 4), +b.slice(5, 7) - 1, +b.slice(8, 10), +b.slice(11, 13), +b.slice(14, 16));
    return Math.round((pb - pa) / 60000);
  }
  // jam akhir event: 'YYYY-MM-DDTHH:MM' + menit, aman lewat tengah malam
  function addMinutes(tanggal, jam, menit) {
    var p = tanggal.split('-'), h = jam.split(':');
    var d = new Date(Date.UTC(+p[0], +p[1] - 1, +p[2], +h[0], +h[1] + menit));
    return d.toISOString().slice(0, 16);
  }
  // Rincian event kalender dari satu to-do. Adapter kalender tinggal memakainya, tidak perlu tahu aturan.
  function todoEventSpec(t, db) {
    var users = db.Users || [], idx = -1, nama = 'Bersama';
    for (var i = 0; i < users.length; i++) if (users[i].id === t.pemilik) { idx = i; nama = users[i].nama; }
    var huruf = t.pemilik === TODO_BERSAMA ? 'B' : String(nama || t.pemilik).charAt(0).toUpperCase();
    var selesai = bool(t.selesai);
    var spec = {
      judul: '[' + huruf + '] ' + (selesai ? '\u2713 ' : '') + t.judul,
      tanggal: t.tanggal, jam: t.jam, durasi: num(t.durasi) || TODO_DURASI, seharian: !t.jam,
      pemilik: t.pemilik, pemilikNama: nama, warna: t.pemilik === TODO_BERSAMA ? 'bersama' : idx, selesai: selesai,
      deskripsi: (todoTipe(t) === 'evaluasi' ? 'Evaluasi bulanan berdua. Buka Beranda untuk lihat kesepakatan yang berlaku.' : 'To-do ' + nama + ' dari Family App.') +
        (selesai ? ' Sudah selesai.' : '') + '\nkantong-todo:' + t.id
    };
    if (!spec.seharian) { spec.mulai = t.tanggal + 'T' + t.jam; spec.akhir = addMinutes(t.tanggal, t.jam, spec.durasi); }
    return spec;
  }
  function todoPerluEvent(t) {
    if (t.dihapus || !t.tanggal || todoTipe(t) === 'catatan') return false;
    if (bool(t.selesai) && TODO_SELESAI_EVENT === 'hapus') return false;
    return true;
  }
  // Keputusan #5 brief integrasi: hanya to-do mendatang yang dikirim massal ke kalender.
  function todoSudahLewat(t, today) { return !!t.tanggal && String(t.tanggal).slice(0, 10) < today; }
  function todoSyncMassal(t, today) {
    return todoPerluEvent(t) && !t._pending && t.gcal_status === 'gagal' && !bool(t.selesai) && !todoSudahLewat(t, today);
  }
  // to-do lewat yang tak pernah terkirim karena kalender belum disiapkan: tampil netral, bukan error
  function todoTidakDikirimLewat(t, today) {
    return todoSudahLewat(t, today) && t.gcal_status === 'gagal' && /belum disiapkan/i.test(t.gcal_error || '');
  }
  // Samakan Google Calendar dengan isi to-do. Tidak pernah melempar error:
  // kegagalan dicatat di gcal_status supaya to-do tetap tersimpan dan bisa "Coba lagi".
  // store.calendar: { upsert(eventId, spec, todo) -> eventId, remove(eventId, todo) } (opsional).
  // Argumen ketiga/kedua (todo) hanya dipakai adapter yang bekerja asinkron (Supabase) untuk menulis hasil belakangan.
  function syncTodoCalendar(store, db, t) {
    var cal = store.calendar, mau = todoPerluEvent(t);
    try {
      if (!cal) {
        if (mau || t.gcal_event_id) throw new Error('Kalender belum disiapkan');
        t.gcal_status = ''; t.gcal_error = '';
      } else if (mau) {
        t.gcal_event_id = String(cal.upsert(String(t.gcal_event_id || ''), todoEventSpec(t, db), t) || '');
        if (!t.gcal_event_id) throw new Error('Kalender tidak mengembalikan id event');
        t.gcal_status = 'ok'; t.gcal_error = '';
      } else {
        if (t.gcal_event_id) cal.remove(String(t.gcal_event_id), t);
        t.gcal_event_id = ''; t.gcal_status = ''; t.gcal_error = '';
      }
    } catch (e) {
      t.gcal_status = 'gagal';
      t.gcal_error = String(e && e.message ? e.message : e).slice(0, 200);
    }
    return t;
  }
  function todoEventSama(a, b) {
    return !!a && !!b && a.judul === b.judul && todoTipe(a) === todoTipe(b) && a.pemilik === b.pemilik && a.tanggal === b.tanggal &&
      a.jam === b.jam && num(a.durasi) === num(b.durasi) && bool(a.selesai) === bool(b.selesai) && !a.dihapus === !b.dihapus;
  }
  function liveTodo(db, today) {
    var batas = addDays(today, -TODO_SIMPAN_SELESAI_HARI);
    return (db.Todo || []).filter(function (t) {
      if (t.dihapus) return false;
      if (bool(t.selesai) && String(t.diubah || t.dibuat || '').slice(0, 10) < batas) return false;
      return true;
    });
  }
  function todoAksi(store, db, user, action, payload, nowIso) {
    var today = nowIso.slice(0, 10);
    if (action === 'todo.list') return { todos: liveTodo(db, today) };
    var ex = byId(db.Todo || [])[String(payload.id || '')];
    if (action === 'todo.save') {
      if (ex && ex.dihapus) throw err('To-do sudah dihapus');
      if (ex && !canWriteTodo(user, ex)) throw err('To-do ini milik ' + todoPemilikNama(db, ex.pemilik) + '. Kamu hanya bisa melihat.');
      var t = cleanTodo(payload, db, user, ex);
      t.selesai = ex && t.tipe !== 'catatan' ? bool(ex.selesai) : false;
      t.selesai_oleh = t.selesai ? String(ex.selesai_oleh || '') : '';
      t.gcal_event_id = ex ? String(ex.gcal_event_id || '') : '';
      t.gcal_status = ex ? String(ex.gcal_status || '') : ''; t.gcal_error = ex ? String(ex.gcal_error || '') : '';
      t.oleh = ex ? ex.oleh : user.id; t.dibuat = ex ? ex.dibuat : nowIso; t.diubah = nowIso; t.dihapus = '';
      // kalender hanya disentuh kalau ada yang berubah atau sync sebelumnya gagal: hemat kuota, idempoten saat request diulang
      if (!ex || !todoEventSama(ex, t) || t.gcal_status === 'gagal' || (todoPerluEvent(t) && !t.gcal_event_id)) syncTodoCalendar(store, db, t);
      store.upsert('Todo', t);
      return { todo: t };
    }
    if (action === 'todo.done') {
      if (!ex || ex.dihapus) throw err('To-do tidak ditemukan');
      if (todoTipe(ex) === 'catatan') throw err('Catatan tidak bisa dicentang');
      if (!canWriteTodo(user, ex)) throw err('To-do ini milik ' + todoPemilikNama(db, ex.pemilik) + '. Kamu hanya bisa melihat.');
      var d = clone(ex), selesai = bool(payload.selesai);
      d.selesai = selesai; d.selesai_oleh = selesai ? user.id : ''; d.diubah = nowIso;
      if (bool(ex.selesai) !== selesai || d.gcal_status === 'gagal') syncTodoCalendar(store, db, d);
      store.upsert('Todo', d);
      return { todo: d };
    }
    if (action === 'todo.delete') {
      if (!ex || ex.dihapus) return { id: String(payload.id || '') };   // idempoten
      if (!canWriteTodo(user, ex)) throw err('To-do ini milik ' + todoPemilikNama(db, ex.pemilik) + '. Kamu hanya bisa melihat.');
      var h = clone(ex); h.dihapus = nowIso; h.diubah = nowIso;
      syncTodoCalendar(store, db, h);
      store.upsert('Todo', h);
      return { id: h.id };
    }
    if (action === 'todo.sync') {
      if (!ex) throw err('To-do tidak ditemukan');
      if (!canWriteTodo(user, ex)) throw err('To-do ini milik ' + todoPemilikNama(db, ex.pemilik) + '. Kamu hanya bisa melihat.');
      var s = clone(ex); s.diubah = nowIso;
      syncTodoCalendar(store, db, s);
      store.upsert('Todo', s);
      return { todo: s };
    }
    throw err('Aksi tidak dikenal: ' + action);
  }

  // ---------- komitmen: baca & cari (Fase 4a) ----------
  // Pasal = map (nomor & judul tetap), Versi = isi pada satu waktu. Yang tampil = versi berlaku (atau usulan untuk pasal baru).
  // isi_ayat: JSON array teks ayat, atau objek {pembuka, ayat} untuk pasal yang punya kalimat tanpa nomor (mis. teks akta pranikah)
  function isiObjek(v) {
    if (v && typeof v === 'object' && Object.prototype.toString.call(v) !== '[object Array]') return v;
    var s = String(v == null ? '' : v).trim();
    if (s.charAt(0) !== '{') return null;
    try { var o = JSON.parse(s); return o && typeof o === 'object' ? o : null; } catch (e) { return null; }
  }
  function pembukaDari(v) { var o = isiObjek(v); return o ? String(o.pembuka == null ? '' : o.pembuka) : ''; }
  function ayatDari(v) {
    var obj = isiObjek(v);
    if (obj) v = obj.ayat || [];
    if (Object.prototype.toString.call(v) === '[object Array]') return v.map(function (x) { return String(x == null ? '' : x); });
    var s = String(v == null ? '' : v).trim();
    if (!s) return [];
    try { var a = JSON.parse(s); if (Object.prototype.toString.call(a) === '[object Array]') return a.map(function (x) { return String(x == null ? '' : x); }); }
    catch (e) { /* teks biasa: satu ayat */ }
    return [s];
  }
  function listDari(s) { return String(s || '').split(',').map(function (x) { return x.trim(); }).filter(Boolean); }
  // kotak TTD milik user: 'riki' untuk pemilik buku riki, selain itu 'febie' (claude/komitmen-brief.md §17)
  function slotTtd(user) { return user && (user.id === 'riki' || user.buku === 'riki') ? 'riki' : 'febie'; }
  function kelompok(list, key) {
    var m = {};
    (list || []).forEach(function (r) { var k = String(r[key] || ''); (m[k] = m[k] || []).push(r); });
    return m;
  }
  function terakhir(list, fn) { var out = null; list.forEach(function (r) { if (fn(r)) out = r; }); return out; }
  function normCari(s) {
    s = String(s == null ? '' : s).toLowerCase();
    if (s.normalize) s = s.normalize('NFD').replace(/[̀-ͯ]/g, '');
    return s.replace(/\s+/g, ' ').trim();
  }
  function cocokToken(teks, tok) {
    if (/^\d+$/.test(tok)) return new RegExp('(^|[^0-9])' + tok + '([^0-9]|$)').test(teks);   // "3" tidak cocok dengan "13"
    return teks.indexOf(tok) >= 0;
  }
  function kataUtuh(teks, kata) {
    var i = teks.indexOf(kata);
    while (i >= 0) {
      var a = i === 0 ? ' ' : teks.charAt(i - 1), b = teks.charAt(i + kata.length) || ' ';
      if (!/[a-z0-9]/.test(a) && !/[a-z0-9]/.test(b)) return true;
      i = teks.indexOf(kata, i + 1);
    }
    return false;
  }

  function komitmenView(db, user) {
    var versiBy = kelompok(db.KomitmenVersi, 'pasal_id'), ketBy = kelompok(db.KomitmenKeterangan, 'pasal_id');
    var sah = byId(db.Pengesahan || []), dipakai = {};
    var bab = sortBy((db.KomitmenBab || []).filter(function (b) { return !b.dihapus; }), 'urutan').map(function (b) {
      return { id: b.id, nomor: String(b.nomor || ''), judul: String(b.judul || ''), urutan: num(b.urutan) };
    });
    var pasal = (db.KomitmenPasal || []).filter(function (p) { return !p.dihapus; }).map(function (p) {
      var vs = (versiBy[p.id] || []).slice().sort(function (a, b) { return num(a.versi) - num(b.versi); });
      var sahV = function (v) { return v.status === 'berlaku' || v.status === 'digantikan'; };
      var cur = byId(vs)[p.versi_berlaku_id] || terakhir(vs, function (v) { return v.status === 'berlaku'; });
      if (!cur && p.status === 'usulan') cur = terakhir(vs, function (v) { return v.status === 'usulan'; }) || terakhir(vs, function (v) { return v.status === 'ditunda'; });
      var isi = cur && cur.jenis === 'cabut' ? terakhir(vs, function (v) { return v.jenis !== 'cabut' && sahV(v); }) : cur;
      var cabut = p.status === 'dicabut' ? terakhir(vs, function (v) { return v.jenis === 'cabut' && v.status === 'berlaku'; }) : null;
      var kets = ketBy[p.id] || [];
      var ket = kets.filter(function (k) { return k.status === 'berlaku' && k.jenis !== 'cabut'; })
        .sort(function (a, b) { return String(a.berlaku_sejak).localeCompare(String(b.berlaku_sejak)); })
        .map(function (k) {
          if (k.pengesahan_id) dipakai[k.pengesahan_id] = 1;
          return { id: k.id, isi: String(k.isi || ''), berlaku_sejak: String(k.berlaku_sejak || ''), pengesahan_id: String(k.pengesahan_id || '') };
        });
      var pid = cur ? String(cur.pengesahan_id || '') : '';
      if (pid && cur.status === 'berlaku') dipakai[pid] = 1;
      return {
        id: p.id, nomor: num(p.nomor), bab_id: String(p.bab_id || ''), tipe: p.tipe === 'definisi' ? 'definisi' : 'kesepakatan',
        judul: String(p.judul || ''), kata_kunci: listDari(p.kata_kunci), sumber_asal: p.sumber_asal === 'pranikah' ? 'pranikah' : 'app',
        rujukan_asli: String(p.rujukan_asli || ''), terkunci: bool(p.terkunci), status: String(p.status || 'usulan'),
        versi: isi ? num(isi.versi) : 0, ayat: isi ? ayatDari(isi.isi_ayat) : [], pembuka: isi ? pembukaDari(isi.isi_ayat) : '', sumber: isi ? String(isi.sumber || '') : '',
        berlaku_sejak: cur && cur.status === 'berlaku' ? String(cur.berlaku_sejak || '') : '',
        pengesahan_id: cur && cur.status === 'berlaku' ? pid : '',
        dicabut: cabut ? { tanggal: String(cabut.berlaku_sejak || ''), alasan: String(cabut.alasan || '') } : null,
        keterangan: ket,
        ada_usulan: vs.some(function (v) { return v.status === 'usulan'; }) || kets.some(function (k) { return k.status === 'usulan'; }),
        // lembar yang sedang menunggu TTD untuk pasal ini, dan usulan yang ditunda ("Diskusikan dulu")
        lembar_usulan: vs.concat(kets).filter(function (r) { return r.status === 'usulan' && r.pengesahan_id; }).map(function (r) { return String(r.pengesahan_id); })
          .filter(function (id, i, a) { return a.indexOf(id) === i; }),
        ditunda: vs.filter(function (v) { return v.status === 'ditunda'; }).map(function (v) { return { id: v.id, jenis: v.jenis, alasan: String(v.alasan || '') }; })
          .concat(kets.filter(function (k) { return k.status === 'ditunda'; }).map(function (k) { return { id: k.id, jenis: 'keterangan', alasan: String(k.isi || '') }; }))
      };
    }).sort(function (a, b) { return a.nomor - b.nomor; });
    // "Lihat juga": pasal lain yang memakai istilah sebuah definisi
    pasal.forEach(function (d) {
      d.lihat_juga = [];
      var istilah = normCari(d.judul);
      if (d.tipe !== 'definisi' || !istilah) return;
      var alias = [normCari(d.judul.replace(/\([^)]*\)/g, ' '))];
      var kurung = /\(([^)]+)\)/.exec(d.judul); if (kurung) alias.push(normCari(kurung[1]));
      pasal.forEach(function (p) {
        if (p.id === d.id || p.status === 'dicabut') return;
        var teks = normCari((p.pembuka || '') + ' ' + p.ayat.join(' ') + ' ' + p.keterangan.map(function (k) { return k.isi; }).join(' '));
        if (kataUtuh(teks, istilah) || alias.some(function (a) { return a && kataUtuh(teks, a); })) d.lihat_juga.push(p.nomor);
      });
    });
    var slot = slotTtd(user);
    var lembar = {};
    Object.keys(dipakai).forEach(function (id) {
      var s = sah[id]; if (!s) return;
      lembar[id] = { id: s.id, judul: String(s.judul || ''), jenis: String(s.jenis || ''), status: String(s.status || ''),
        ttd_riki: String(s.ttd_riki || ''), ttd_riki_at: String(s.ttd_riki_at || ''),
        ttd_febie: String(s.ttd_febie || ''), ttd_febie_at: String(s.ttd_febie_at || '') };
    });
    var menunggu = (db.Pengesahan || []).filter(function (s) { return s.status === 'menunggu'; })
      .map(function (s) { return lembarView(db, s, user); }).filter(function (l) { return l.items.length; })
      .sort(function (a, b) { return String(a.dibuat_at).localeCompare(String(b.dibuat_at)); });
    return {
      bab: bab, pasal: pasal, pengesahan: lembar, menunggu: menunggu, slot_saya: slot,
      berlaku: pasal.filter(function (p) { return p.status === 'berlaku'; }).length,
      menunggu_ttd: menunggu.filter(function (l) { return !l['ttd_' + slot]; }).length
    };
  }

  // Cari di daftar pasal hasil komitmenView. Urutan: nomor (0) → judul (1) → kata kunci/rujukan (2) → isi/keterangan (3).
  // Hasil: [{ pasal, tingkat, lokasi: [{ di: 'nomor'|'judul'|'kata_kunci'|'rujukan'|'ayat'|'keterangan', idx }] }]
  function nomorDariKueri(q) {
    var m = /^(?:pasal|psl|ps)?\.?\s*(\d{1,4})$/.exec(normCari(q));
    return m ? Number(m[1]) : 0;
  }
  function cariKomitmen(pasal, q) {
    var nq = normCari(q);
    if (!nq) return [];
    var nomor = nomorDariKueri(q), toks = nq.split(' '), out = [];
    var TINGKAT = { judul: 1, kata_kunci: 2, rujukan: 2, pembuka: 3, ayat: 3, keterangan: 3 };
    (pasal || []).forEach(function (p) {
      var f = [['judul', -1, p.judul], ['kata_kunci', -1, (p.kata_kunci || []).join(', ')], ['rujukan', -1, p.rujukan_asli]];
      if (p.pembuka) f.push(['pembuka', -1, p.pembuka]);
      (p.ayat || []).forEach(function (a, i) { f.push(['ayat', i, a]); });
      (p.keterangan || []).forEach(function (k, i) { f.push(['keterangan', i, k.isi]); });
      var lokasi = [], semua = '';
      f.forEach(function (x) {
        var n = normCari(x[2]); semua += ' | ' + n;
        if (n && (n.indexOf(nq) >= 0 || toks.some(function (t) { return cocokToken(n, t); }))) lokasi.push({ di: x[0], idx: x[1], frasa: n.indexOf(nq) >= 0 });
      });
      var tingkat = 9;
      if (nomor && p.nomor === nomor) { tingkat = 0; lokasi.unshift({ di: 'nomor', idx: -1, frasa: true }); }
      else if (toks.every(function (t) { return cocokToken(semua, t); })) {
        lokasi.sort(function (a, b) { return (b.frasa - a.frasa) || (TINGKAT[a.di] - TINGKAT[b.di]); });
        lokasi.forEach(function (l) { tingkat = Math.min(tingkat, TINGKAT[l.di]); });
      }
      if (tingkat < 9) out.push({ pasal: p, tingkat: tingkat, frasa: lokasi.some(function (l) { return l.frasa; }), lokasi: lokasi });
    });
    return out.sort(function (a, b) { return (a.tingkat - b.tingkat) || (b.frasa - a.frasa) || (a.pasal.nomor - b.pasal.nomor); });
  }

  function komitmenAksi(store, db, user, action, payload, nowIso) {
    if (action === 'komitmen.list') return komitmenView(db, user);
    if (action === 'komitmen.history') {
      var id = String(payload.pasal_id || '');
      var p = byId(db.KomitmenPasal || [])[id];
      if (!p || p.dihapus) throw err('Pasal tidak ditemukan');
      var sah = byId(db.Pengesahan || []);
      var item = (db.KomitmenVersi || []).filter(function (v) { return v.pasal_id === id; }).map(function (v) {
        return { jenis_item: 'versi', id: v.id, versi: num(v.versi), jenis: v.jenis, status: v.status, ayat: ayatDari(v.isi_ayat), pembuka: pembukaDari(v.isi_ayat), alasan: String(v.alasan || ''),
          sumber: String(v.sumber || ''), berlaku_sejak: String(v.berlaku_sejak || ''), dibuat_at: String(v.dibuat_at || ''),
          pengesahan_id: String(v.pengesahan_id || ''), pengesahan_judul: sah[v.pengesahan_id] ? String(sah[v.pengesahan_id].judul || '') : '' };
      }).concat((db.KomitmenKeterangan || []).filter(function (k) { return k.pasal_id === id; }).map(function (k) {
        return { jenis_item: 'keterangan', id: k.id, jenis: k.jenis, status: k.status, isi: String(k.isi || ''), menggantikan_id: String(k.menggantikan_id || ''),
          berlaku_sejak: String(k.berlaku_sejak || ''), dibuat_at: String(k.dibuat_at || ''),
          pengesahan_id: String(k.pengesahan_id || ''), pengesahan_judul: sah[k.pengesahan_id] ? String(sah[k.pengesahan_id].judul || '') : '' };
      }));
      // terbaru dulu; usulan (belum disahkan) paling atas; seri → versi lebih tinggi dulu
      var kunci = function (r) { return (r.status === 'usulan' ? '9' : '0') + String(r.berlaku_sejak || r.dibuat_at); };
      item.sort(function (a, b) { return kunci(b).localeCompare(kunci(a)) || (num(b.versi) - num(a.versi)); });
      return { pasal_id: id, riwayat: item };
    }
    // Fase 4b (awal): usul pasal baru di luar evaluasi → status Usulan + Lembar Pengesahan tunggal (brief §6, §8E).
    if (action === 'komitmen.usul_baru') {
      var nowU = String(nowIso || new Date().toISOString());
      var tipe = payload.tipe === 'definisi' ? 'definisi' : 'kesepakatan';
      var judul = String(payload.judul || '').trim();
      var ayat = ayatDari(payload.ayat).map(function (a) { return a.trim(); }).filter(Boolean);
      if (!judul) throw err('Judul wajib diisi');
      if (judul.length > 120) throw err('Judul maksimal 120 huruf');
      if (!ayat.length) throw err('Isi minimal satu ayat');
      var babId = '';
      if (tipe === 'kesepakatan') {
        var babs = (db.KomitmenBab || []).filter(function (b) { return !b.dihapus; });
        var babBaru = String(payload.bab_baru || '').trim();
        if (babBaru) {
          var sama = babs.filter(function (b) { return normCari(b.judul) === normCari(babBaru); })[0];
          if (sama) babId = sama.id;
          else {
            var ROM = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI', 'XII', 'XIII', 'XIV', 'XV', 'XVI', 'XVII', 'XVIII', 'XIX', 'XX'];
            var urut = babs.reduce(function (m, b) { return Math.max(m, num(b.urutan)); }, 0) + 1;
            babId = 'b-' + Math.random().toString(36).slice(2, 8);
            store.upsert('KomitmenBab', { id: babId, nomor: ROM[urut - 1] || String(urut), judul: babBaru, urutan: urut, dibuat_at: nowU, dihapus: '' });
          }
        } else {
          babId = String(payload.bab_id || '');
          if (!babs.some(function (b) { return b.id === babId; })) throw err('Pilih bab atau tulis bab baru');
        }
      }
      var nomor = (db.KomitmenPasal || []).reduce(function (m, x) { return Math.max(m, num(x.nomor)); }, 0) + 1;   // nomor tidak dipakai ulang
      var rnd = Math.random().toString(36).slice(2, 8);
      var pid2 = 'p-' + rnd, sid = 'sah-' + rnd;
      store.upsert('Pengesahan', { id: sid, judul: 'Usulan Pasal ' + nomor, jenis: 'tunggal', evaluasi_id: '', isi_hash: '', status: 'menunggu', dibuat_at: nowU });
      store.upsert('KomitmenVersi', { id: pid2 + '-v1', pasal_id: pid2, versi: 1, isi_ayat: JSON.stringify(ayat), alasan: String(payload.alasan || '').trim(),
        jenis: 'baru', sumber: 'luar_evaluasi', evaluasi_id: '', pengesahan_id: sid, status: 'usulan', berlaku_sejak: '', dibuat_oleh: user.id, dibuat_at: nowU });
      store.upsert('KomitmenPasal', { id: pid2, nomor: nomor, bab_id: babId, tipe: tipe, judul: judul, kata_kunci: listDari(payload.kata_kunci).join(', '),
        sumber_asal: 'app', rujukan_asli: '', terkunci: false, status: 'usulan', versi_berlaku_id: '', dibuat_oleh: user.id, dibuat_at: nowU, diubah_at: nowU, dihapus: '' });
      return { pasal_id: pid2, nomor: nomor, pengesahan_id: sid };
    }
    // Tarik usulan pasal baru yang belum disahkan (belum pernah berlaku → boleh dihapus dari daftar).
    if (action === 'komitmen.tarik_usulan') {
      var pu = byId(db.KomitmenPasal || [])[String(payload.pasal_id || '')];
      if (!pu || pu.dihapus) throw err('Pasal tidak ditemukan');
      if (pu.status !== 'usulan') throw err('Hanya usulan yang belum disahkan yang bisa ditarik');
      var nowT = String(nowIso || new Date().toISOString());
      pu.dihapus = nowT; pu.diubah_at = nowT; store.upsert('KomitmenPasal', pu);
      (db.KomitmenVersi || []).filter(function (v) { return v.pasal_id === pu.id && v.status === 'usulan'; }).forEach(function (v) {
        var s = byId(db.Pengesahan || [])[v.pengesahan_id];
        if (s && s.status === 'menunggu') { s.status = 'batal'; store.upsert('Pengesahan', s); }
      });
      return { pasal_id: pu.id };
    }
    // ---------- Fase 4b: usul ubah / cabut / keterangan (brief §5, §6, §7, §8C-D) ----------
    var now = String(nowIso || new Date().toISOString());
    var pasalMap = byId(db.KomitmenPasal || []);
    function ambilPasal(id) {
      var p = pasalMap[String(id || '')];
      if (!p || p.dihapus) throw err('Pasal tidak ditemukan');
      return p;
    }
    function cekBelumAdaUsulan(p) {
      var ada = (db.KomitmenVersi || []).some(function (v) { return v.pasal_id === p.id && v.status === 'usulan'; });
      if (ada) throw err('Pasal ' + p.nomor + ' masih punya usulan yang menunggu tanda tangan');
    }
    function lembarBaru(judul) {
      var sid = 'sah-' + Math.random().toString(36).slice(2, 8);
      store.upsert('Pengesahan', { id: sid, judul: judul, jenis: 'tunggal', evaluasi_id: '', isi_hash: '', status: 'menunggu', dibuat_at: now });
      return sid;
    }
    function versiBerlaku(p) {
      var vs = (db.KomitmenVersi || []).filter(function (v) { return v.pasal_id === p.id; });
      return byId(vs)[p.versi_berlaku_id] || terakhir(sortBy(vs, 'versi'), function (v) { return v.status === 'berlaku'; });
    }
    function versiBerikut(p) { return (db.KomitmenVersi || []).filter(function (v) { return v.pasal_id === p.id; }).reduce(function (m, v) { return Math.max(m, num(v.versi)); }, 0) + 1; }
    function wajibAlasan(a) { a = String(a || '').trim(); if (!a) throw err('Alasan wajib diisi (1 kalimat cukup)'); return a; }

    if (action === 'komitmen.usul_ubah' || action === 'komitmen.usul_cabut') {
      var cabutkah = action === 'komitmen.usul_cabut';
      var pp = ambilPasal(payload.pasal_id);
      if (bool(pp.terkunci)) throw err('Pasal pranikah hanya bisa diberi keterangan');
      if (pp.status !== 'berlaku') throw err(cabutkah ? 'Hanya pasal yang berlaku yang bisa dicabut' : 'Hanya pasal yang berlaku yang bisa diubah');
      cekBelumAdaUsulan(pp);
      var alasan = wajibAlasan(payload.alasan), lama = versiBerlaku(pp);
      var ayatU = cabutkah ? ayatDari(lama && lama.isi_ayat) : ayatDari(payload.ayat).map(function (a) { return a.trim(); }).filter(Boolean);
      if (!cabutkah) {
        if (!ayatU.length) throw err('Isi minimal satu ayat');
        if (lama && JSON.stringify(ayatU) === JSON.stringify(ayatDari(lama.isi_ayat))) throw err('Isi ayat belum diubah');
      }
      var sidU = lembarBaru((cabutkah ? 'Pencabutan Pasal ' : 'Perubahan Pasal ') + pp.nomor);
      var vno = versiBerikut(pp);
      store.upsert('KomitmenVersi', { id: pp.id + '-v' + vno, pasal_id: pp.id, versi: vno, isi_ayat: JSON.stringify(ayatU), alasan: alasan,
        jenis: cabutkah ? 'cabut' : 'ubah', sumber: 'luar_evaluasi', evaluasi_id: '', pengesahan_id: sidU, status: 'usulan', berlaku_sejak: '', dibuat_oleh: user.id, dibuat_at: now });
      pp.diubah_at = now; store.upsert('KomitmenPasal', pp);
      return { pasal_id: pp.id, nomor: num(pp.nomor), pengesahan_id: sidU };
    }
    if (action === 'komitmen.usul_keterangan') {
      var pk = ambilPasal(payload.pasal_id);
      if (pk.status !== 'berlaku') throw err('Keterangan hanya untuk pasal yang berlaku');
      var jenisK = ['baru', 'ganti', 'cabut'].indexOf(payload.jenis) >= 0 ? payload.jenis : 'baru';
      var isiK = String(payload.isi || '').trim(), lamaK = null;
      if (jenisK !== 'baru') {
        lamaK = (db.KomitmenKeterangan || []).filter(function (k) { return k.id === String(payload.menggantikan_id || '') && k.pasal_id === pk.id && k.status === 'berlaku'; })[0];
        if (!lamaK) throw err('Keterangan yang dimaksud tidak ditemukan');
        if ((db.KomitmenKeterangan || []).some(function (k) { return k.menggantikan_id === lamaK.id && k.status === 'usulan'; })) throw err('Keterangan ini sudah punya usulan yang menunggu');
      }
      if (jenisK === 'cabut') isiK = String(lamaK.isi || '');
      else if (!isiK) throw err('Isi keterangan wajib diisi');
      if (isiK.length > 2000) throw err('Keterangan maksimal 2.000 huruf');
      var sidK = lembarBaru((jenisK === 'cabut' ? 'Pencabutan keterangan' : 'Keterangan') + ' Pasal ' + pk.nomor);
      var kid = 'k-' + Math.random().toString(36).slice(2, 8);
      store.upsert('KomitmenKeterangan', { id: kid, pasal_id: pk.id, isi: isiK, menggantikan_id: lamaK ? lamaK.id : '', jenis: jenisK, evaluasi_id: '',
        pengesahan_id: sidK, status: 'usulan', berlaku_sejak: '', dibuat_oleh: user.id, dibuat_at: now });
      return { pasal_id: pk.id, nomor: num(pk.nomor), keterangan_id: kid, pengesahan_id: sidK };
    }
    // usulan yang ditunda ("Diskusikan dulu") diajukan lagi → lembar tunggal baru
    if (action === 'komitmen.ajukan_ulang') {
      var iid = String(payload.item_id || '');
      var vi = (db.KomitmenVersi || []).filter(function (v) { return v.id === iid && v.status === 'ditunda'; })[0];
      var ki = vi ? null : (db.KomitmenKeterangan || []).filter(function (k) { return k.id === iid && k.status === 'ditunda'; })[0];
      if (!vi && !ki) throw err('Usulan yang ditunda tidak ditemukan');
      var pa = ambilPasal((vi || ki).pasal_id);
      if (vi) cekBelumAdaUsulan(pa);
      var sidA = lembarBaru('Usulan ulang Pasal ' + pa.nomor);
      var row = vi || ki; row.status = 'usulan'; row.pengesahan_id = sidA;
      store.upsert(vi ? 'KomitmenVersi' : 'KomitmenKeterangan', row);
      return { pasal_id: pa.id, nomor: num(pa.nomor), pengesahan_id: sidA };
    }
    throw err('Aksi belum tersedia: ' + action);
  }

  // ---------- Lembar Pengesahan & tanda tangan (brief §6) ----------
  // Item lembar = versi & keterangan berstatus usulan yang menunjuk lembar itu.
  function lembarItems(db, sid) {
    var pmap = byId(db.KomitmenPasal || []), kmap = byId(db.KomitmenKeterangan || []);
    var vs = (db.KomitmenVersi || []).filter(function (v) { return v.pengesahan_id === sid && v.status === 'usulan'; }).map(function (v) {
      var p = pmap[v.pasal_id] || {};
      var lama = v.jenis === 'baru' ? null : (db.KomitmenVersi || []).filter(function (x) { return x.pasal_id === v.pasal_id && x.status === 'berlaku'; })[0];
      return { id: v.id, jenis_item: 'versi', jenis: v.jenis, pasal_id: v.pasal_id, nomor: num(p.nomor), judul: String(p.judul || ''), tipe: String(p.tipe || ''),
        sesudah: v.jenis === 'cabut' ? [] : ayatDari(v.isi_ayat), sebelum: lama ? ayatDari(lama.isi_ayat) : [],
        pembuka: v.jenis === 'cabut' ? '' : pembukaDari(v.isi_ayat), alasan: String(v.alasan || ''), dibuat_oleh: String(v.dibuat_oleh || '') };
    });
    var ks = (db.KomitmenKeterangan || []).filter(function (k) { return k.pengesahan_id === sid && k.status === 'usulan'; }).map(function (k) {
      var p = pmap[k.pasal_id] || {}, lama = kmap[k.menggantikan_id];
      return { id: k.id, jenis_item: 'keterangan', jenis: k.jenis, pasal_id: k.pasal_id, nomor: num(p.nomor), judul: String(p.judul || ''), tipe: String(p.tipe || ''),
        sesudah: k.jenis === 'cabut' ? [] : [String(k.isi || '')], sebelum: lama ? [String(lama.isi || '')] : [], alasan: '', dibuat_oleh: String(k.dibuat_oleh || '') };
    });
    return vs.concat(ks).sort(function (a, b) { return a.nomor - b.nomor; });
  }
  // "sidik jari" isi lembar (FNV-1a 32-bit): isi berubah → hash beda → TTD lama batal
  function hashLembar(items) {
    var s = JSON.stringify(items.map(function (i) { return i.pembuka ? [i.id, i.jenis, i.sesudah, i.alasan, i.pembuka] : [i.id, i.jenis, i.sesudah, i.alasan]; })), h = 0x811c9dc5;
    for (var i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul ? Math.imul(h, 0x01000193) : (h * 0x01000193) | 0; }
    return ('0000000' + (h >>> 0).toString(16)).slice(-8);
  }
  function lembarView(db, s, user) {
    var items = lembarItems(db, s.id), hash = hashLembar(items);
    var basi = !!s.isi_hash && s.isi_hash !== hash;   // isi berubah setelah ada TTD
    return { id: s.id, judul: String(s.judul || ''), jenis: String(s.jenis || ''), status: String(s.status || ''), dibuat_at: String(s.dibuat_at || ''),
      isi_hash: hash, items: items, slot_saya: slotTtd(user),
      ttd_riki: basi ? '' : String(s.ttd_riki || ''), ttd_riki_at: basi ? '' : String(s.ttd_riki_at || ''),
      ttd_febie: basi ? '' : String(s.ttd_febie || ''), ttd_febie_at: basi ? '' : String(s.ttd_febie_at || '') };
  }
  function cekTtdPath(d) {
    d = String(d || '').trim();
    if (!d) throw err('Gambar tanda tanganmu dulu');
    if (d.length > 60000) throw err('Tanda tangan terlalu panjang, ulangi lebih sederhana');
    if (!/^[MLQCZmlqcz0-9.,\s-]+$/.test(d) || !/^M/.test(d)) throw err('Format tanda tangan tidak valid');
    return d;
  }
  function pengesahanAksi(store, db, user, action, payload, nowIso) {
    var now = String(nowIso || new Date().toISOString());
    var s = byId(db.Pengesahan || [])[String(payload.id || '')];
    if (!s) throw err('Lembar pengesahan tidak ditemukan');
    if (action === 'pengesahan.get') return lembarView(db, s, user);
    if (s.status !== 'menunggu') throw err(s.status === 'sah' ? 'Lembar ini sudah sah' : 'Lembar ini sudah dibatalkan');
    var items = lembarItems(db, s.id), hash = hashLembar(items);
    if (action === 'pengesahan.defer') {   // "Diskusikan dulu": item keluar dari lembar, TTD yang ada batal
      var iid = String(payload.item_id || '');
      var v = (db.KomitmenVersi || []).filter(function (x) { return x.id === iid && x.pengesahan_id === s.id && x.status === 'usulan'; })[0];
      var k = v ? null : (db.KomitmenKeterangan || []).filter(function (x) { return x.id === iid && x.pengesahan_id === s.id && x.status === 'usulan'; })[0];
      if (!v && !k) throw err('Item tidak ada di lembar ini');
      var row = v || k; row.status = 'ditunda'; row.pengesahan_id = '';
      store.upsert(v ? 'KomitmenVersi' : 'KomitmenKeterangan', row);
      s.ttd_riki = s.ttd_riki_at = s.ttd_febie = s.ttd_febie_at = s.isi_hash = '';
      if (items.length <= 1) s.status = 'batal';
      store.upsert('Pengesahan', s);
      return { id: s.id, status: s.status, item_id: iid };
    }
    if (action === 'pengesahan.sign') {
      if (!items.length) throw err('Lembar ini kosong');
      if (String(payload.isi_hash || '') !== hash) throw err('Isi lembar berubah. Muat ulang lalu baca lagi sebelum tanda tangan.');
      var slot = slotTtd(user), lain = slot === 'riki' ? 'febie' : 'riki';
      if (payload.slot && payload.slot !== slot) throw err('Kamu hanya bisa mengisi kotak tanda tanganmu sendiri');
      if (s.isi_hash && s.isi_hash !== hash) { s['ttd_' + lain] = ''; s['ttd_' + lain + '_at'] = ''; }   // TTD pasangan untuk isi lama → batal
      s['ttd_' + slot] = cekTtdPath(payload.ttd); s['ttd_' + slot + '_at'] = now; s.isi_hash = hash;
      var sah = !!(s.ttd_riki && s.ttd_febie);
      if (sah) { s.status = 'sah'; terapkanLembar(store, db, s.id, now); }
      store.upsert('Pengesahan', s);
      return { id: s.id, status: s.status, sah: sah };
    }
    throw err('Aksi tidak dikenal: ' + action);
  }
  // TTD kedua: semua item berlaku dengan tanggal hari itu; versi/keterangan lama → digantikan (brief §6.5, §10)
  function terapkanLembar(store, db, sid, at) {
    var pmap = byId(db.KomitmenPasal || []), kmap = byId(db.KomitmenKeterangan || []);
    (db.KomitmenVersi || []).filter(function (v) { return v.pengesahan_id === sid && v.status === 'usulan'; }).forEach(function (v) {
      var p = pmap[v.pasal_id]; if (!p) return;
      (db.KomitmenVersi || []).forEach(function (x) {
        if (x.pasal_id === p.id && x.id !== v.id && x.status === 'berlaku') { x.status = 'digantikan'; store.upsert('KomitmenVersi', x); }
      });
      v.status = 'berlaku'; v.berlaku_sejak = at; store.upsert('KomitmenVersi', v);
      p.status = v.jenis === 'cabut' ? 'dicabut' : 'berlaku'; p.versi_berlaku_id = v.id; p.diubah_at = at;
      store.upsert('KomitmenPasal', p);
    });
    (db.KomitmenKeterangan || []).filter(function (k) { return k.pengesahan_id === sid && k.status === 'usulan'; }).forEach(function (k) {
      var lama = kmap[k.menggantikan_id];
      if (lama && lama.status === 'berlaku') { lama.status = k.jenis === 'cabut' ? 'dicabut' : 'digantikan'; store.upsert('KomitmenKeterangan', lama); }
      k.status = 'berlaku'; k.berlaku_sejak = at; store.upsert('KomitmenKeterangan', k);
    });
  }

  // ---------- Ruang Catat (jurnal pribadi) ----------
  // id = '<user>|YYYY-MM-DD' (entri) atau '<user>|_pengaturan'. Hanya pemilik yang bisa baca & tulis.
  function jurnalAksi(store, db, user, action, payload, nowIso) {
    var milik = (db.Jurnal || []).filter(function (j) { return j.pemilik === user.id; });
    if (action === 'jurnal.list') return { jurnal: milik.filter(function (j) { return !j.dihapus; }) };
    var id = String(payload.id || ''), pre = user.id + '|', kunci = id.slice(pre.length);
    if (id.indexOf(pre) !== 0) throw err('Catatan ini bukan milikmu');
    var jenis = kunci === '_pengaturan' ? 'pengaturan' : 'entri';
    if (jenis === 'entri' && !isDate(kunci)) throw err('ID catatan tidak valid');
    var ex = byId(db.Jurnal || [])[id];
    if (ex && ex.pemilik !== user.id) throw err('Catatan ini bukan milikmu');
    if (action === 'jurnal.save') {
      var isi = String(payload.isi || '');
      if (isi.length > 60000) throw err('Catatan terlalu panjang');
      try { JSON.parse(isi); } catch (e) { throw err('Isi catatan tidak valid'); }
      var j = { id: id, pemilik: user.id, jenis: jenis, tanggal: jenis === 'entri' ? kunci : '', isi: isi, diubah: nowIso, dihapus: '' };
      store.upsert('Jurnal', j);
      return { jurnal: j };
    }
    if (action === 'jurnal.delete') {
      if (!ex || ex.dihapus) return { id: id };
      var h = clone(ex); h.dihapus = nowIso; h.diubah = nowIso; h.isi = '';   // isi dikosongkan: catatan pribadi tidak disimpan setelah dihapus
      store.upsert('Jurnal', h);
      return { id: id };
    }
    throw err('Aksi tidak dikenal: ' + action);
  }

  // ---------- Siklus (catatan haid) ----------
  // Pemilik = user istri. Aturan baca/tulis dijalankan di sini (server), bukan hanya di tampilan:
  //  * pemilik : baca + tulis semua catatannya.
  //  * pasangan: baca JADWAL hanya kalau Siklus aktif & jadwal dibagikan; catatan hanya kalau catatan juga dibagikan.
  //  * tiap user memilih sendiri Siklus ditampilkan atau tidak di app-nya (tampil).
  var SIKLUS_PEMILIK = 'istri';
  var SIKLUS_VERSI_TEKS = 1;        // naikkan kalau teks privasi berubah -> pemilik diminta setuju ulang
  var SK = { NORMAL_MIN: 21, NORMAL_MAX: 35, BAKU_SIKLUS: 28, BAKU_DURASI: 5, JUMLAH: 6, RENTANG: 2, MAKS_DURASI: 15, CATATAN_MAKS: 300 };
  // rentang siklus dewasa yang umum 21–35 hari (ACOG; Cleveland Clinic)
  function skSelisih(a, b) {   // jumlah hari dari a ke b
    var pa = a.split('-'), pb = b.split('-');
    return Math.round((Date.UTC(+pb[0], +pb[1] - 1, +pb[2]) - Date.UTC(+pa[0], +pa[1] - 1, +pa[2])) / 86400000);
  }
  function skUrut(rows) {
    return (rows || []).filter(function (r) { return r && r.mulai && !r.dihapus; }).slice()
      .sort(function (a, b) { return a.mulai < b.mulai ? -1 : (a.mulai > b.mulai ? 1 : 0); });
  }
  function skRata(arr) { return Math.round(arr.reduce(function (s, x) { return s + x; }, 0) / arr.length); }
  // jarak antar hari pertama berturut-turut; abaikan = pemilik bilang ada catatan terlewat sebelum siklus itu
  function skJarak(rows) {
    var s = skUrut(rows), out = [];
    for (var i = 1; i < s.length; i++) out.push({ dari: s[i - 1].mulai, ke: s[i].mulai, hari: skSelisih(s[i - 1].mulai, s[i].mulai), abaikan: bool(s[i].abaikan_jarak) });
    return out;
  }
  // panjang siklus = rata-rata 6 jarak terakhir yang dipakai; belum ada jarak = 28 hari ("perkiraan kasar")
  function skRingkas(rows) {
    var s = skUrut(rows);
    var j = skJarak(s).filter(function (x) { return !x.abaikan && x.hari > 0; }).slice(-SK.JUMLAH);
    var d = s.filter(function (r) { return r.akhir; }).map(function (r) { return skSelisih(r.mulai, r.akhir) + 1; }).slice(-SK.JUMLAH);
    return { jumlah: s.length, dipakai: j.length, kasar: j.length === 0, panjang: j.length ? skRata(j.map(function (x) { return x.hari; })) : SK.BAKU_SIKLUS,
      durasi: d.length ? Math.min(SK.MAKS_DURASI, skRata(d)) : SK.BAKU_DURASI };
  }
  function skAkhir(r, durasi) { return r.akhir || addDays(r.mulai, durasi - 1); }
  function skPerkiraan(rows, today) {
    var s = skUrut(rows); if (!s.length) return null;
    var r = skRingkas(s), berikut = addDays(s[s.length - 1].mulai, r.panjang);
    // terlambat <= 1 siklus: tampilkan apa adanya + "sudah lewat N hari".
    // terlambat > 1 siklus (kemungkinan lupa mencatat): geser ke perkiraan berikutnya yang belum lewat.
    var telat = skSelisih(berikut, today), geser = 0;
    if (telat > r.panjang) {
      while (skSelisih(berikut, today) > SK.RENTANG && geser < 60) { berikut = addDays(berikut, r.panjang); geser++; }
      telat = 0;
    }
    return { berikut: berikut, dari: addDays(berikut, -SK.RENTANG), sampai: addDays(berikut, SK.RENTANG), kasar: r.kasar,
      panjang: r.panjang, durasi: r.durasi, jumlah: r.jumlah, dipakai: r.dipakai, telat: telat > SK.RENTANG ? telat : 0 };
  }
  // tanda per tanggal di [awal, akhir]: 'catat' (tercatat) atau 'kira' (rentang perkiraan, 3 siklus ke depan)
  function skTanda(rows, today, awal, akhir) {
    var s = skUrut(rows), r = skRingkas(s), out = {}, akhirTerakhir = '';
    s.forEach(function (row) {
      var z = skAkhir(row, r.durasi);
      if (z > akhirTerakhir) akhirTerakhir = z;
      if (z < awal || row.mulai > akhir) return;
      for (var d = row.mulai; d <= z; d = addDays(d, 1)) if (d >= awal && d <= akhir) out[d] = 'catat';
    });
    var p = skPerkiraan(s, today);
    if (p) for (var k = 0; k < 3; k++) {
      var m = addDays(p.berikut, k * r.panjang);
      for (var i = -SK.RENTANG; i <= SK.RENTANG; i++) {
        var d2 = addDays(m, i);
        if (d2 >= awal && d2 <= akhir && !out[d2] && d2 > akhirTerakhir) out[d2] = 'kira';
      }
    }
    return out;
  }
  function skCatatanDi(rows, d, durasi) {
    var hit = null;
    skUrut(rows).forEach(function (row) { if (d >= row.mulai && d <= skAkhir(row, durasi)) hit = row; });
    return hit;
  }
  // catatan yang masih berjalan (belum dicatat selesai, belum lewat batas) pada tanggal d
  function skBerjalan(rows, d) {
    var s = skUrut(rows), last = s[s.length - 1];
    if (!last || last.akhir || d < last.mulai || skSelisih(last.mulai, d) >= SK.MAKS_DURASI) return null;
    return last;
  }
  // jarak tidak biasa ke hari pertama sebelumnya (di luar 21–35 hari) -> jumlah hari; 0 kalau wajar / tidak ada pembanding
  function skJarakAneh(rows, mulaiBaru, kecualiId) {
    var prev = null;
    skUrut(rows).forEach(function (r) { if (r.id !== kecualiId && r.mulai < mulaiBaru) prev = r; });
    if (!prev) return 0;
    var h = skSelisih(prev.mulai, mulaiBaru);
    return h < SK.NORMAL_MIN || h > SK.NORMAL_MAX ? h : 0;
  }
  var Siklus = { K: SK, selisih: skSelisih, urut: skUrut, jarak: skJarak, ringkas: skRingkas, akhir: skAkhir, perkiraan: skPerkiraan,
    tanda: skTanda, catatanDi: skCatatanDi, berjalan: skBerjalan, jarakAneh: skJarakAneh };

  function siklusAturDari(db, uid) {
    var a = byId(db.SiklusAtur || [])[uid];
    if (!a) return { aktif: false, bagikan_jadwal: true, bagikan_catatan: false, tampil: true, setuju_at: '', versi_teks: 0 };
    return { aktif: bool(a.aktif), bagikan_jadwal: bool(a.bagikan_jadwal), bagikan_catatan: bool(a.bagikan_catatan), tampil: bool(a.tampil),
      setuju_at: a.setuju_at || '', versi_teks: num(a.versi_teks) };
  }
  // tampilan Siklus untuk user tertentu (hanya data yang boleh ia lihat)
  function siklusView(db, user) {
    var pemilik = SIKLUS_PEMILIK, milikku = user.id === pemilik;
    var ap = siklusAturDari(db, pemilik), aku = siklusAturDari(db, user.id);
    var u = (db.Users || []).filter(function (x) { return x.id === pemilik; })[0];
    var aktif = ap.aktif && ap.versi_teks >= SIKLUS_VERSI_TEKS;
    var jadwal = milikku || (aktif && ap.bagikan_jadwal), catatan = milikku || (jadwal && ap.bagikan_catatan);
    var rows = !jadwal ? [] : skUrut((db.Siklus || []).filter(function (r) { return r.pemilik === pemilik; })).map(function (r) {
      return { id: r.id, mulai: r.mulai, akhir: r.akhir || '', abaikan_jarak: bool(r.abaikan_jarak), catatan: catatan ? (r.catatan || '') : '' };
    });
    var v = { peran: milikku ? 'pemilik' : 'pembaca', pemilik: { id: pemilik, nama: u ? u.nama : 'Istri', ada: !!u }, tampil: aku.tampil, versi_wajib: SIKLUS_VERSI_TEKS, siklus: rows };
    if (milikku) {
      v.aktif = aktif; v.bagikan_jadwal = ap.bagikan_jadwal; v.bagikan_catatan = ap.bagikan_catatan; v.setuju_at = ap.setuju_at; v.versi_teks = ap.versi_teks;
    } else { v.dibagikan = !!jadwal; v.catatan_dibagikan = !!(jadwal && ap.bagikan_catatan); }
    return v;
  }
  function siklusSimpanAtur(store, db, uid, ubah, nowIso) {
    var lama = byId(db.SiklusAtur || [])[uid], a = siklusAturDari(db, uid);
    Object.keys(ubah).forEach(function (k) { a[k] = ubah[k]; });
    var row = { id: uid, aktif: !!a.aktif, bagikan_jadwal: !!a.bagikan_jadwal, bagikan_catatan: !!a.bagikan_catatan, tampil: a.tampil !== false,
      setuju_at: a.setuju_at || '', versi_teks: num(a.versi_teks), diubah: nowIso };
    store.upsert('SiklusAtur', row);
    db.SiklusAtur = (db.SiklusAtur || []).filter(function (x) { return x.id !== uid; }).concat([row]);
    return lama;
  }
  function siklusAksi(store, db, user, action, payload, nowIso) {
    var pemilik = SIKLUS_PEMILIK, milikku = user.id === pemilik, today = nowIso.slice(0, 10);
    var namaPemilik = siklusView(db, user).pemilik.nama;
    function hanyaPemilik() { if (!milikku) throw err('Hanya ' + namaPemilik + ' yang bisa mengubah catatan Siklus'); }
    var hidup = (db.Siklus || []).filter(function (r) { return r.pemilik === pemilik && !r.dihapus && r.mulai; });
    if (action === 'siklus.list') return siklusView(db, user);
    if (action === 'siklus.atur') {
      var ubah = {};
      if ('tampil' in payload) ubah.tampil = bool(payload.tampil);
      ['aktif', 'bagikan_jadwal', 'bagikan_catatan', 'setuju'].forEach(function (k) { if (k in payload) hanyaPemilik(); });
      if ('bagikan_jadwal' in payload) ubah.bagikan_jadwal = bool(payload.bagikan_jadwal);
      if ('bagikan_catatan' in payload) ubah.bagikan_catatan = bool(payload.bagikan_catatan);
      if (payload.setuju) {
        if (num(payload.setuju) < SIKLUS_VERSI_TEKS) throw err('Teks privasi sudah diperbarui. Baca dan setujui lagi.');
        ubah.setuju_at = nowIso; ubah.versi_teks = num(payload.setuju);
      }
      if ('aktif' in payload) {
        ubah.aktif = bool(payload.aktif);
        var versi = 'versi_teks' in ubah ? ubah.versi_teks : siklusAturDari(db, pemilik).versi_teks;
        if (ubah.aktif && versi < SIKLUS_VERSI_TEKS) throw err('Setujui teks privasi dulu untuk mengaktifkan Siklus');
      }
      siklusSimpanAtur(store, db, user.id, ubah, nowIso);
      return siklusView(db, user);
    }
    if (action === 'siklus.save') {
      hanyaPemilik();
      if (!siklusView(db, user).aktif) throw err('Aktifkan Siklus dulu di Pengaturan');
      var id = String(payload.id || '');
      if (!id || id.length > 64) throw err('ID catatan tidak valid');
      var ex = byId(db.Siklus || [])[id];
      if (ex && ex.pemilik !== pemilik) throw err('Catatan ini bukan milikmu');
      if (ex && ex.dihapus) throw err('Catatan sudah dihapus');
      var mulai = String(payload.mulai || ''), akhir = String(payload.akhir || '');
      if (!isDate(mulai)) throw err('Isi tanggal mulai');
      if (mulai > today) throw err('Tanggal mulai tidak boleh di masa depan');
      if (akhir) {
        if (!isDate(akhir)) throw err('Tanggal selesai tidak valid');
        if (akhir < mulai || skSelisih(mulai, akhir) >= SK.MAKS_DURASI) throw err('Tanggal selesai harus 1–' + SK.MAKS_DURASI + ' hari sejak mulai');
        if (akhir > today) throw err('Tanggal selesai tidak boleh di masa depan');
      }
      var cat = String(payload.catatan == null ? (ex ? ex.catatan : '') : payload.catatan).trim();
      if (cat.length > SK.CATATAN_MAKS) throw err('Catatan maksimal ' + SK.CATATAN_MAKS + ' karakter');
      var ujung = akhir || mulai;
      hidup.forEach(function (o) {
        if (o.id === id) return;
        if (o.mulai === mulai) throw err('Sudah ada catatan yang mulai di tanggal itu');
        if (mulai <= (o.akhir || o.mulai) && ujung >= o.mulai) throw err('Tanggalnya bertabrakan dengan catatan lain');
      });
      store.upsert('Siklus', { id: id, pemilik: pemilik, mulai: mulai, akhir: akhir, abaikan_jarak: bool(payload.abaikan_jarak), catatan: cat,
        dibuat: ex ? ex.dibuat : nowIso, diubah: nowIso, dihapus: '' });
      db.Siklus = store.all('Siklus');
      return siklusView(db, user);
    }
    if (action === 'siklus.delete') {
      hanyaPemilik();
      var h = byId(db.Siklus || [])[String(payload.id || '')];
      if (h && h.pemilik === pemilik && !h.dihapus) {
        store.upsert('Siklus', { id: h.id, pemilik: pemilik, mulai: '', akhir: '', abaikan_jarak: false, catatan: '', dibuat: h.dibuat, diubah: nowIso, dihapus: nowIso });
        db.Siklus = store.all('Siklus');
      }
      return siklusView(db, user);
    }
    if (action === 'siklus.hapus_semua') {
      hanyaPemilik();
      hidup.forEach(function (r) {
        store.upsert('Siklus', { id: r.id, pemilik: pemilik, mulai: '', akhir: '', abaikan_jarak: false, catatan: '', dibuat: r.dibuat, diubah: nowIso, dihapus: nowIso });
      });
      db.Siklus = store.all('Siklus');
      siklusSimpanAtur(store, db, pemilik, { aktif: false, bagikan_jadwal: true, bagikan_catatan: false, setuju_at: '', versi_teks: 0 }, nowIso);
      return siklusView(db, user);
    }
    throw err('Aksi tidak dikenal: ' + action);
  }

  // ---------- Couple Journaling (tabel jurnal_pasangan, aksi cj.*) ----------
  // Evaluasi harian / mingguan / bulanan untuk pasangan. Bukan penentu hubungan: hasilnya jadi bahan fokus bulan berikutnya.
  // Aturan dijalankan di server (bukan hanya tampilan):
  //  * aktif hanya kalau KEDUA pasangan setuju (cj|pref|<user>.setuju).
  //  * isian harian privat sampai pemiliknya membagikan (cj.bagikan). Item privat (kesehatan) & catatannya tidak pernah dikirim ke pasangan.
  //  * isian mingguan/bulanan terlihat pasangan setelah pemiliknya menekan Selesai. Mood (H7) privat kecuali bagikan_mood.
  //  * set pertanyaan: draft -> persetujuan pasangan (kalau menyentuh item yang bukan milik pengusul) -> publish, berlaku periode berikutnya.
  var CJ_SKALA = {
    frekuensi: [
      { v: 4, label: 'Selalu', arti: 'Dilakukan setiap ada kesempatan' },
      { v: 3, label: 'Hampir selalu', arti: 'Sebagian besar kesempatan, sesekali terlewat' },
      { v: 2, label: 'Sedang', arti: 'Kadang dilakukan, kadang tidak' },
      { v: 1, label: 'Hampir tidak', arti: 'Jarang sekali dilakukan' },
      { v: 0, label: 'Tidak dilakukan', arti: 'Tidak dilakukan sama sekali' }
    ],
    kejadian: [
      { v: 'ya', label: 'Ya', arti: 'Dilakukan / terjadi' },
      { v: 'tidak', label: 'Tidak', arti: 'Seharusnya dilakukan, tapi tidak' },
      { v: 'belum', label: 'Belum muncul', arti: 'Situasinya belum terjadi, jadi tidak dinilai' }
    ]
  };
  var CJ_KESIMPULAN = {
    selaras: { label: 'Selaras', lanjut: 'Pertahankan' },
    hampir: { label: 'Hampir selaras', lanjut: 'Cukup dicatat' },
    perlu: { label: 'Perlu dibicarakan', lanjut: 'Masuk agenda check-in mingguan' }
  };
  var CJ_PERIODE = ['harian', 'mingguan', 'bulanan'];
  var CJ_KODE = { harian: 'H', mingguan: 'M', bulanan: 'B' };
  var CJ_DARI_KODE = { H: 'harian', M: 'mingguan', B: 'bulanan' };
  var CJ_CATATAN_MAKS = 280;
  var CJ_MAKS_ITEM = 60;
  var CJ_MUNDUR = { harian: 7, mingguan: 2, bulanan: 1 };   // isian boleh menyusul: 7 hari / 2 minggu / 1 bulan ke belakang
  var CJ_SESI_MENIT = 30;

  function cjQ(id, periode, teks, o) {
    var q = { id: id, teks: teks, periode: periode, jenis: 'bersama', skala: 'frekuensi', wajib: false, tampil: false, catatan: true,
      privat: false, observer: false, sumber: '', topik: false, penanda: false, milik: 'bersama', bawaan: true };
    Object.keys(o || {}).forEach(function (k) { q[k] = o[k]; });
    if (q.wajib) q.tampil = true;
    return q;
  }
  // Template bawaan (brief Couple Journaling, 24 Nov 2026). Item opsional tersembunyi sampai dimunculkan.
  var CJ_TEMPLATE = [
    cjQ('H1', 'harian', 'Hari ini saya merasa tenang', { wajib: true }),
    cjQ('H2', 'harian', 'Hari ini saya merasa didengar', { wajib: true }),
    cjQ('H3', 'harian', 'Ada hal yang ingin dibahas minggu ini?', { wajib: true, skala: 'kejadian', topik: true }),
    cjQ('H4', 'harian', 'Mengabari sesuai kesepakatan yang dibuat saat berjauhan', { skala: 'kejadian' }),
    cjQ('H5', 'harian', 'Janji kecil hari ini ditepati', { skala: 'kejadian' }),
    cjQ('H6', 'harian', 'Perawatan diri berjalan (obat, tidur, olahraga; pilih sendiri)', { skala: 'kejadian', jenis: 'personal', privat: true }),
    cjQ('H7', 'harian', 'Mood hari ini', { skala: 'otomatis', jenis: 'personal', sumber: 'mood', tampil: true, catatan: false }),
    cjQ('M1', 'mingguan', 'Satu topik tuntas sebelum ganti topik', { wajib: true }),
    cjQ('M2', 'mingguan', 'Pendengar merangkum ulang sebelum merespons', { wajib: true }),
    cjQ('M3', 'mingguan', 'Tiap masalah punya tindak lanjut dan PIC', { wajib: true }),
    cjQ('M4', 'mingguan', 'Target pengembangan diri saya', { wajib: true, jenis: 'personal', observer: true, sumber: 'target1' }),
    cjQ('M5', 'mingguan', 'Kritik disampaikan dengan fakta → dampak → permintaan'),
    cjQ('M6', 'mingguan', 'Tugas rumah tangga dilakukan'),
    cjQ('M7', 'mingguan', 'Berbagi progres pembelajaran', { skala: 'kejadian' }),
    cjQ('M8', 'mingguan', 'Waktu mandiri dihargai (tanpa telepon berulang)'),
    // tampil = ya, tapi hanya muncul kalau orangnya punya target kedua
    cjQ('M9', 'mingguan', 'Target pengembangan diri kedua', { jenis: 'personal', observer: true, sumber: 'target2', tampil: true }),
    cjQ('M10', 'mingguan', 'Ada kondisi berat minggu ini (misal perubahan obat)', { skala: 'kejadian', jenis: 'personal', privat: true, penanda: true }),
    cjQ('B1', 'bulanan', 'Keputusan rumah tangga diambil berimbang', { wajib: true }),
    cjQ('B2', 'bulanan', 'Langkah menuju harapan jangka panjang berjalan', { wajib: true }),
    cjQ('B3', 'bulanan', 'Daftar peran & keputusan rumah tangga ditinjau', { skala: 'kejadian' }),
    cjQ('B4', 'bulanan', 'Pengeluaran sesuai anggaran'),
    cjQ('B5', 'bulanan', 'Rekap target personal', { skala: 'otomatis', jenis: 'personal', sumber: 'rekap', tampil: true, catatan: false })
  ];
  // contoh pertanyaan tambahan (Atur pertanyaan > Tambah dari template)
  var CJ_TEMPLATE_TAMBAHAN = [
    { periode: 'harian', teks: 'Saya mengucapkan terima kasih ke pasangan', skala: 'kejadian', jenis: 'bersama' },
    { periode: 'harian', teks: 'Ada waktu berdua tanpa gawai', skala: 'kejadian', jenis: 'bersama' },
    { periode: 'harian', teks: 'Ibadah harian berjalan', skala: 'kejadian', jenis: 'personal' },
    { periode: 'mingguan', teks: 'Ada waktu berkualitas berdua (kencan, jalan, ngobrol panjang)', skala: 'kejadian', jenis: 'bersama' },
    { periode: 'mingguan', teks: 'Pengasuhan anak terasa terbagi adil', skala: 'frekuensi', jenis: 'bersama' },
    { periode: 'mingguan', teks: 'Saling menginspirasi lewat bidang keahlian masing-masing', skala: 'frekuensi', jenis: 'bersama' },
    { periode: 'mingguan', teks: 'Ibadah atau aktivitas spiritual bersama', skala: 'frekuensi', jenis: 'bersama' },
    { periode: 'bulanan', teks: 'Silaturahmi dengan keluarga besar terjaga', skala: 'frekuensi', jenis: 'bersama' },
    { periode: 'bulanan', teks: 'Rencana keuangan ditinjau bersama', skala: 'kejadian', jenis: 'bersama' },
    { periode: 'bulanan', teks: 'Ada waktu istirahat/liburan yang cukup', skala: 'frekuensi', jenis: 'bersama' }
  ];
  function cjTemplate() { return CJ_TEMPLATE.map(function (q) { return clone(q); }); }
  function cjBawaan(id) { for (var i = 0; i < CJ_TEMPLATE.length; i++) if (CJ_TEMPLATE[i].id === id) return CJ_TEMPLATE[i]; return null; }
  // item bawaan yang perilakunya khusus (target, mood, rekap, topik, penanda): skala/periode/jenis tidak bisa diubah
  function cjKhusus(q) { return !!(q.sumber || q.topik || q.penanda || q.observer); }

  // ---- periode ----
  function cjMinggu(iso) {   // ISO 8601: minggu mulai Senin, minggu ke-1 memuat Kamis pertama
    var p = iso.split('-'), d = new Date(Date.UTC(+p[0], +p[1] - 1, +p[2]));
    var h = d.getUTCDay() || 7;
    d.setUTCDate(d.getUTCDate() + 4 - h);
    var y = d.getUTCFullYear(), w = Math.ceil(((d - Date.UTC(y, 0, 1)) / 86400000 + 1) / 7);
    return y + '-W' + (w < 10 ? '0' : '') + w;
  }
  function cjSenin(w) {
    var y = +w.slice(0, 4), n = +w.slice(6), j4 = new Date(Date.UTC(y, 0, 4)), h = j4.getUTCDay() || 7;
    return addDays(j4.toISOString().slice(0, 10), 1 - h + (n - 1) * 7);
  }
  function cjHariDalam(w) { var s = cjSenin(w), out = []; for (var i = 0; i < 7; i++) out.push(addDays(s, i)); return out; }
  function cjMingguGeser(w, n) { return cjMinggu(addDays(cjSenin(w), 7 * n)); }
  function cjBulanGeser(m, n) {
    var y = +m.slice(0, 4), b = +m.slice(5, 7) - 1 + n;
    y += Math.floor(b / 12); b = ((b % 12) + 12) % 12;
    return y + '-' + (b < 9 ? '0' : '') + (b + 1);
  }
  function cjBulanDariMinggu(w) { return addDays(cjSenin(w), 3).slice(0, 7); }   // bulan hari Kamis
  function cjMingguDalamBulan(m) {
    var out = [], w = cjMinggu(m + '-01');
    if (cjBulanDariMinggu(w) < m) w = cjMingguGeser(w, 1);
    while (cjBulanDariMinggu(w) === m) { out.push(w); w = cjMingguGeser(w, 1); }
    return out;
  }
  function isMinggu(s) { return typeof s === 'string' && /^\d{4}-W(0[1-9]|[1-4]\d|5[0-3])$/.test(s); }
  // 'H:2026-11-24' -> { periode:'harian', nilai:'2026-11-24' }
  function cjUraiKunci(k) {
    k = String(k || ''); var kode = k.slice(0, 1), nilai = k.slice(2), periode = CJ_DARI_KODE[kode];
    if (k.charAt(1) !== ':' || !periode) return null;
    if (periode === 'harian' && !isDate(nilai)) return null;
    if (periode === 'mingguan' && !isMinggu(nilai)) return null;
    if (periode === 'bulanan' && !isMonth(nilai)) return null;
    return { periode: periode, nilai: nilai };
  }
  function cjSekarang(periode, today) { return periode === 'harian' ? today : periode === 'mingguan' ? cjMinggu(today) : today.slice(0, 7); }
  function cjBerikut(periode, today) {
    return periode === 'harian' ? addDays(today, 1) : periode === 'mingguan' ? cjMingguGeser(cjMinggu(today), 1) : cjBulanGeser(today.slice(0, 7), 1);
  }
  function cjMundur(periode, today) {
    var n = CJ_MUNDUR[periode];
    return periode === 'harian' ? addDays(today, -n) : periode === 'mingguan' ? cjMingguGeser(cjMinggu(today), -n) : cjBulanGeser(today.slice(0, 7), -n);
  }

  // ---- set pertanyaan ----
  // sets: daftar versi terbit { versi, pertanyaan, berlaku: {harian, mingguan, bulanan} }. Set yang berlaku untuk periode itu.
  function cjSetUntuk(sets, periode, nilai) {
    var s = (sets || []).slice().sort(function (a, b) { return a.versi - b.versi; }), hit = s[0] || null;
    s.forEach(function (x) { if (x.berlaku && x.berlaku[periode] <= nilai) hit = x; });
    return hit;
  }
  function cjPunyaTarget(targets, uid, sumber) {
    var t = targets && targets[uid];
    if (sumber === 'target1') return !!(t && t.t1 && t.t1.teks);
    if (sumber === 'target2') return !!(t && t.t2 && t.t2.teks);
    return true;
  }
  // pertanyaan yang dijawab uid untuk dirinya sendiri
  function cjItem(set, periode, uid, targets) {
    return ((set && set.pertanyaan) || []).filter(function (q) {
      return q.tampil && q.periode === periode && (q.milik === 'bersama' || q.milik === uid) && cjPunyaTarget(targets, uid, q.sumber);
    });
  }
  // pertanyaan personal milik pasangan yang dinilai uid sebagai observer
  function cjItemObserver(set, periode, pasanganId, targets) {
    if (!pasanganId) return [];
    return ((set && set.pertanyaan) || []).filter(function (q) {
      return q.tampil && q.observer && q.periode === periode && (q.milik === 'bersama' || q.milik === pasanganId) && cjPunyaTarget(targets, pasanganId, q.sumber);
    });
  }
  function cjTeksItem(q, targets, uid) {   // teks M4/M9 = target orangnya
    var t = targets && targets[uid];
    if (q.sumber === 'target1' && t && t.t1 && t.t1.teks) return t.t1.teks;
    if (q.sumber === 'target2' && t && t.t2 && t.t2.teks) return t.t2.teks;
    return q.teks;
  }
  function cjNilaiValid(q, v) {
    if (q.skala === 'frekuensi') return typeof v === 'number' && v >= 0 && v <= 4 && Math.floor(v) === v;
    if (q.skala === 'kejadian') return q.topik ? (v === 'ya' || v === 'tidak') : (v === 'ya' || v === 'tidak' || v === 'belum');
    return false;
  }
  function cjLabelNilai(q, v) {
    var sk = CJ_SKALA[q.skala] || [];
    for (var i = 0; i < sk.length; i++) if (sk[i].v === v) return sk[i].label;
    return '';
  }
  // selisih kategori diri vs pasangan -> selaras | hampir | perlu
  function cjKesimpulan(diri, pasangan) {
    if (typeof diri !== 'number' || typeof pasangan !== 'number') return '';
    var d = Math.abs(diri - pasangan);
    return d === 0 ? 'selaras' : d === 1 ? 'hampir' : 'perlu';
  }
  // bandingkan item personal (observer) dua isian mingguan/bulanan: isi[uid] = isian uid (bentuk view)
  function cjBanding(set, periode, isi, ids, targets) {
    var out = [];
    ids.forEach(function (uid) {
      var lain = ids[0] === uid ? ids[1] : ids[0];
      cjItemObserver(set, periode, uid, targets).forEach(function (q) {
        var a = isi[uid] && isi[uid].jawaban && isi[uid].jawaban[q.id], b = isi[lain] && isi[lain].observer && isi[lain].observer[q.id];
        if (!a || !b) return;
        out.push({ qid: q.id, pemilik: uid, teks: cjTeksItem(q, targets, uid), diri: a.n, pasangan: b.n, hasil: cjKesimpulan(a.n, b.n) });
      });
    });
    return out;
  }
  function cjSamaItem(a, b) { return JSON.stringify(a) === JSON.stringify(b); }
  // perubahan draft menyentuh item yang bukan milik pengusul? -> perlu persetujuan pasangan
  function cjPerluSetuju(baru, lama, oleh) {
    var ma = {}, mb = {}, ids = {};
    (lama || []).forEach(function (q) { ma[q.id] = q; ids[q.id] = 1; });
    (baru || []).forEach(function (q) { mb[q.id] = q; ids[q.id] = 1; });
    var urutLama = (lama || []).filter(function (q) { return q.milik !== oleh; }).map(function (q) { return q.id; }).join(',');
    var urutBaru = (baru || []).filter(function (q) { return q.milik !== oleh; }).map(function (q) { return q.id; }).join(',');
    if (urutLama !== urutBaru) return true;
    return Object.keys(ids).some(function (id) {
      var a = ma[id], b = mb[id];
      if (a && b && cjSamaItem(a, b)) return false;
      return (a && a.milik !== oleh) || (b && b.milik !== oleh);
    });
  }
  // bersihkan satu pertanyaan dari app. lama = versi sebelumnya (id sama) kalau ada.
  function cjBersihItem(q, lama, oleh, ids) {
    if (!q || typeof q !== 'object') throw err('Pertanyaan tidak valid');
    var id = String(q.id || ''), b = cjBawaan(id), teks = String(q.teks || '').replace(/\s+/g, ' ').trim();
    if (!b && !/^q-[a-z0-9]{3,16}$/.test(id)) throw err('ID pertanyaan tidak valid');
    if (!teks) throw err('Teks pertanyaan tidak boleh kosong');
    if (teks.length > 160) throw err('Teks pertanyaan maksimal 160 karakter');
    var o;
    if (b) {
      o = clone(b);
      if (!cjKhusus(b)) {
        if (CJ_PERIODE.indexOf(q.periode) >= 0) o.periode = q.periode;
        if (q.skala === 'frekuensi' || q.skala === 'kejadian') o.skala = q.skala;
        if (q.jenis === 'bersama' || q.jenis === 'personal') o.jenis = q.jenis;
      }
      o.privat = b.privat || (o.jenis === 'personal' && bool(q.privat));
    } else {
      if (CJ_PERIODE.indexOf(q.periode) < 0) throw err('Frekuensi pertanyaan tidak valid');
      if (q.skala !== 'frekuensi' && q.skala !== 'kejadian') throw err('Skala pertanyaan tidak valid');
      if (q.jenis !== 'bersama' && q.jenis !== 'personal') throw err('Jenis pertanyaan tidak valid');
      var milik = lama ? lama.milik : (q.milik === oleh ? oleh : 'bersama');
      if (milik !== 'bersama' && ids.indexOf(milik) < 0) milik = 'bersama';
      o = cjQ(id, q.periode, teks, { skala: q.skala, jenis: q.jenis, milik: milik, bawaan: false });
      o.privat = o.jenis === 'personal' && bool(q.privat);
      o.observer = o.jenis === 'personal' && o.skala === 'frekuensi' && !o.privat && bool(q.observer);
    }
    o.teks = teks;
    o.tampil = bool(q.tampil);
    o.catatan = o.skala === 'otomatis' ? false : (o.topik ? true : bool(q.catatan));
    return o;
  }
  function cjBersihSet(list, lama, oleh, ids) {
    if (!Array.isArray(list)) throw err('Daftar pertanyaan tidak valid');
    if (list.length > CJ_MAKS_ITEM) throw err('Maksimal ' + CJ_MAKS_ITEM + ' pertanyaan');
    var ml = {}; (lama || []).forEach(function (q) { ml[q.id] = q; });
    var lihat = {}, out = list.map(function (q) {
      var x = cjBersihItem(q, ml[q && q.id], oleh, ids);
      if (lihat[x.id]) throw err('Ada pertanyaan ganda');
      lihat[x.id] = 1;
      return x;
    });
    // item bawaan tidak bisa dihapus, hanya disembunyikan
    CJ_TEMPLATE.forEach(function (b) { if (!lihat[b.id]) { var x = clone(ml[b.id] || b); x.tampil = false; out.push(x); } });
    return out;
  }

  // ---- baris ----
  function cjBaca(row) { if (!row || row.dihapus) return null; try { return JSON.parse(row.isi || '{}'); } catch (e) { return {}; } }
  function cjPut(store, db, id, jenis, pemilik, kunci, isi, nowIso) {
    var ex = byId(db.JurnalPasangan || [])[id];
    var row = { id: id, jenis: jenis, pemilik: pemilik, kunci: kunci, isi: JSON.stringify(isi), dibuat: ex && !ex.dihapus && ex.dibuat ? ex.dibuat : nowIso, diubah: nowIso, dihapus: '' };
    store.upsert('JurnalPasangan', row);
    db.JurnalPasangan = (db.JurnalPasangan || []).filter(function (r) { return r.id !== id; }).concat([row]);
    return row;
  }
  function cjHapus(store, db, id, nowIso) {
    var ex = byId(db.JurnalPasangan || [])[id];
    if (!ex || ex.dihapus) return;
    var row = { id: id, jenis: ex.jenis, pemilik: ex.pemilik, kunci: ex.kunci, isi: '', dibuat: ex.dibuat, diubah: nowIso, dihapus: nowIso };
    store.upsert('JurnalPasangan', row);
    db.JurnalPasangan = (db.JurnalPasangan || []).filter(function (r) { return r.id !== id; }).concat([row]);
  }
  function cjAmbil(db, id) { return cjBaca(byId(db.JurnalPasangan || [])[id]); }
  function cjSemua(db, jenis) {
    return (db.JurnalPasangan || []).filter(function (r) { return r.jenis === jenis && !r.dihapus; })
      .map(function (r) { var o = cjBaca(r) || {}; o._id = r.id; o._pemilik = r.pemilik; o._kunci = r.kunci; o._diubah = r.diubah; return o; });
  }
  function cjPasanganDari(db, uid) { return (db.Users || []).filter(function (u) { return u.id !== uid; })[0] || null; }
  function cjSets(db) {
    return cjSemua(db, 'set').map(function (s) { return { versi: num(s.versi), pertanyaan: s.pertanyaan || [], berlaku: s.berlaku || {}, oleh: s.oleh || '', disetujui: s.disetujui || '', terbit_at: s.terbit_at || '' }; })
      .sort(function (a, b) { return a.versi - b.versi; });
  }
  function cjTargets(db) {
    var t = {}; cjSemua(db, 'target').forEach(function (x) { t[x._pemilik] = { t1: x.t1 || null, t2: x.t2 || null, riwayat: x.riwayat || [] }; });
    return t;
  }
  function cjPref(db, uid) { var p = cjAmbil(db, 'cj|pref|' + uid) || {}; return { setuju: p.setuju || '', bagikan_mood: !!p.bagikan_mood }; }
  function cjAktif(db, uid) {
    var ps = cjPasanganDari(db, uid);
    return !!(ps && cjPref(db, uid).setuju && cjPref(db, ps.id).setuju);
  }
  // isian dalam bentuk yang boleh dilihat viewer
  function cjSaringIsian(row, viewer, sets, prefPemilik) {
    var o = cjBaca(row); if (!o) return null;
    var k = cjUraiKunci(row.kunci); if (!k) return null;
    var set = cjSetUntuk(sets, k.periode, k.nilai), pq = {};
    ((set && set.pertanyaan) || []).forEach(function (q) { pq[q.id] = q; });
    var berat = Object.keys(o.jawaban || {}).some(function (id) { return pq[id] && pq[id].penanda && o.jawaban[id] && o.jawaban[id].n === 'ya'; });
    var v = { id: row.id, pemilik: row.pemilik, kunci: row.kunci, periode: k.periode, nilai: k.nilai, selesai_at: o.selesai_at || '', terisi: !!o.selesai_at,
      dibagikan: !!o.dibagikan, berat: berat, diubah: row.diubah };
    if (row.pemilik === viewer) { v.jawaban = o.jawaban || {}; v.observer = o.observer || {}; v.mood = o.mood || 0; return v; }
    var boleh = k.periode === 'harian' ? !!(o.dibagikan && o.selesai_at) : !!o.selesai_at;
    if (!boleh) return v;   // hanya status: sudah/belum mengisi
    v.jawaban = {};
    Object.keys(o.jawaban || {}).forEach(function (id) { if (pq[id] && !pq[id].privat) v.jawaban[id] = o.jawaban[id]; });
    v.observer = o.observer || {};
    v.mood = prefPemilik.bagikan_mood ? (o.mood || 0) : 0;
    return v;
  }
  function cjView(db, user, nowIso) {
    var today = nowIso.slice(0, 10), ps = cjPasanganDari(db, user.id), aku = cjPref(db, user.id), dia = ps ? cjPref(db, ps.id) : { setuju: '', bagikan_mood: false };
    var v = {
      today: today, minggu: cjMinggu(today), bulan: today.slice(0, 7),
      aktif: cjAktif(db, user.id),
      saya: { id: user.id, nama: user.nama, setuju: aku.setuju, bagikan_mood: aku.bagikan_mood },
      pasangan: ps ? { id: ps.id, nama: ps.nama, setuju: dia.setuju, bagikan_mood: dia.bagikan_mood, ada: true } : { id: '', nama: 'Pasangan', setuju: '', ada: false }
    };
    if (!v.aktif) return v;
    var atur = cjAmbil(db, 'cj|atur') || {}, sets = cjSets(db), draft = cjAmbil(db, 'cj|draft');
    v.fondasi = atur.fondasi || { tujuan: '', visi: '', misi: [] };
    v.hari = atur.hari == null ? 0 : num(atur.hari);
    v.konselor = atur.konselor || { nama: '', kontak: '' };
    v.atur_oleh = atur.oleh || ''; v.atur_diubah = atur.diubah || '';
    v.sets = sets;
    if (draft) {
      var akhir = sets[sets.length - 1];
      v.draft = { pertanyaan: draft.pertanyaan || [], oleh: draft.oleh || '', diubah: draft.diubah || '', dari_versi: num(draft.dari_versi),
        setuju_oleh: draft.setuju_oleh || '', perlu_setuju: cjPerluSetuju(draft.pertanyaan, akhir ? akhir.pertanyaan : [], draft.oleh) };
    } else v.draft = null;
    v.target = cjTargets(db);
    var prefPs = dia;
    v.isian = (db.JurnalPasangan || []).filter(function (r) { return r.jenis === 'isian' && !r.dihapus && (r.pemilik === user.id || (ps && r.pemilik === ps.id)); })
      .map(function (r) { return cjSaringIsian(r, user.id, sets, r.pemilik === user.id ? aku : prefPs); }).filter(Boolean);
    v.topik = cjSemua(db, 'topik').map(function (t) { t.id = t._id; delete t._id; delete t._pemilik; delete t._kunci; return t; });
    v.sesi = cjSemua(db, 'sesi').map(function (s) { s.minggu = s._kunci; delete s._id; delete s._pemilik; delete s._kunci; return s; });
    v.bulanan = cjSemua(db, 'bulan').map(function (b) { b.bulan = b._kunci; delete b._id; delete b._pemilik; delete b._kunci; return b; });
    return v;
  }
  function cjTeks(s, maks, nama) {
    var t = String(s == null ? '' : s).trim();
    if (t.length > maks) throw err((nama || 'Catatan') + ' maksimal ' + maks + ' karakter');
    return t;
  }
  function cjAksi(store, db, user, action, payload, nowIso) {
    var today = nowIso.slice(0, 10), ps = cjPasanganDari(db, user.id), ids = [user.id].concat(ps ? [ps.id] : []);
    function selesai() { return cjView(db, user, nowIso); }
    function wajibAktif() { if (!cjAktif(db, user.id)) throw err('Couple Journaling belum aktif. Kedua pasangan perlu menyetujui dulu.'); }

    if (action === 'cj.state') return selesai();

    if (action === 'cj.setuju') {
      if (!ps) throw err('Belum ada akun pasangan. Minta admin membuatkan akun dulu.');
      var pref = cjPref(db, user.id);
      pref.setuju = bool(payload.setuju) ? (pref.setuju || nowIso) : '';
      cjPut(store, db, 'cj|pref|' + user.id, 'pref', user.id, '', pref, nowIso);
      // pertama kali aktif: terbitkan template bawaan, berlaku mulai hari ini
      if (cjAktif(db, user.id) && !cjSets(db).length) {
        cjPut(store, db, 'cj|set|1', 'set', '', '1', { versi: 1, pertanyaan: cjTemplate(), oleh: user.id, disetujui: 'template',
          terbit_at: nowIso, berlaku: { harian: today, mingguan: cjMinggu(today), bulanan: today.slice(0, 7) } }, nowIso);
      }
      return selesai();
    }
    if (action === 'cj.pref') {
      var pf = cjPref(db, user.id);
      if ('bagikan_mood' in payload) pf.bagikan_mood = bool(payload.bagikan_mood);
      cjPut(store, db, 'cj|pref|' + user.id, 'pref', user.id, '', pf, nowIso);
      return selesai();
    }

    wajibAktif();
    var sets = cjSets(db), targets = cjTargets(db);

    if (action === 'cj.fondasi') {
      var atur = cjAmbil(db, 'cj|atur') || {};
      if (payload.fondasi) {
        var f = payload.fondasi, misi = Array.isArray(f.misi) ? f.misi : [];
        if (misi.length > 6) throw err('Misi maksimal 6 butir');
        atur.fondasi = { tujuan: cjTeks(f.tujuan, 200, 'Tujuan'), visi: cjTeks(f.visi, 200, 'Visi'),
          misi: misi.map(function (m) { return cjTeks(m, 200, 'Misi'); }).filter(Boolean) };
      }
      if ('hari' in payload) {
        var hr = num(payload.hari);
        if (hr < 0 || hr > 6 || Math.floor(hr) !== hr) throw err('Hari check-in tidak valid');
        atur.hari = hr;
      }
      if (payload.konselor) atur.konselor = { nama: cjTeks(payload.konselor.nama, 80, 'Nama konselor'), kontak: cjTeks(payload.konselor.kontak, 80, 'Kontak konselor') };
      atur.oleh = user.id; atur.diubah = nowIso;
      cjPut(store, db, 'cj|atur', 'atur', '', '', atur, nowIso);
      return selesai();
    }

    if (action === 'cj.target') {
      var lamaT = cjAmbil(db, 'cj|target|' + user.id) || {}, baruT = { t1: lamaT.t1 || null, t2: lamaT.t2 || null, riwayat: lamaT.riwayat || [] };
      ['t1', 't2'].forEach(function (k) {
        if (!(k in payload)) return;
        var teks = cjTeks(payload[k], 120, 'Target');
        var cur = baruT[k];
        if (cur && cur.teks === teks) return;
        if (cur && cur.teks) baruT.riwayat = baruT.riwayat.concat([{ slot: k, teks: cur.teks, sejak: cur.sejak, sampai: today }]).slice(-20);
        baruT[k] = teks ? { teks: teks, sejak: today } : null;
      });
      if (!baruT.t1 && baruT.t2) { baruT.t1 = baruT.t2; baruT.t2 = null; }
      cjPut(store, db, 'cj|target|' + user.id, 'target', user.id, '', baruT, nowIso);
      return selesai();
    }

    if (action === 'cj.isi') {
      var k = cjUraiKunci(payload.kunci);
      if (!k) throw err('Periode isian tidak valid');
      if (k.nilai > cjSekarang(k.periode, today)) throw err('Belum bisa mengisi periode yang akan datang');
      if (k.nilai < cjMundur(k.periode, today)) throw err('Periode ini sudah lewat terlalu lama untuk diisi');
      var set = cjSetUntuk(sets, k.periode, k.nilai);
      var items = cjItem(set, k.periode, user.id, targets), obsItems = cjItemObserver(set, k.periode, ps && ps.id, targets);
      var idIsi = 'cj|isi|' + user.id + '|' + CJ_KODE[k.periode] + ':' + k.nilai;
      var lamaI = cjAmbil(db, idIsi) || {};
      function bersihJawaban(src, daftar) {
        var out = {}; src = src && typeof src === 'object' ? src : {};
        daftar.forEach(function (q) {
          if (q.skala === 'otomatis') return;
          var a = src[q.id]; if (!a || typeof a !== 'object') return;
          var n = q.skala === 'frekuensi' && typeof a.n === 'string' && a.n !== '' ? Number(a.n) : a.n;
          if (!cjNilaiValid(q, n)) return;
          var c = q.catatan ? cjTeks(a.c, CJ_CATATAN_MAKS, 'Catatan') : '';
          out[q.id] = c ? { n: n, c: c } : { n: n };
        });
        return out;
      }
      var jaw = bersihJawaban(payload.jawaban, items), obs = bersihJawaban(payload.observer, obsItems);
      var mood = 0;
      if (k.periode === 'harian' && items.some(function (q) { return q.sumber === 'mood'; })) {
        mood = num(payload.mood); if (mood < 1 || mood > 5 || Math.floor(mood) !== mood) mood = 0;
      }
      var tutup = bool(payload.selesai) || !!lamaI.selesai_at;
      if (tutup) {
        var kurang = items.filter(function (q) { return q.wajib && q.skala !== 'otomatis' && !jaw[q.id]; });
        if (kurang.length) throw err('Lengkapi dulu: ' + cjTeksItem(kurang[0], targets, user.id));
        if (obsItems.some(function (q) { return q.wajib && !obs[q.id]; })) throw err('Lengkapi dulu penilaianmu untuk target pasangan');
        var topikQ = items.filter(function (q) { return q.topik; })[0];
        if (topikQ && jaw[topikQ.id] && jaw[topikQ.id].n === 'ya' && !jaw[topikQ.id].c) throw err('Tulis singkat hal yang ingin dibahas');
      }
      cjPut(store, db, idIsi, 'isian', user.id, CJ_KODE[k.periode] + ':' + k.nilai,
        { jawaban: jaw, observer: obs, mood: mood, selesai_at: tutup ? (lamaI.selesai_at || nowIso) : '', dibagikan: !!lamaI.dibagikan }, nowIso);
      // H3: "ada yang ingin dibahas" -> antrian topik check-in minggu itu
      if (k.periode === 'harian') {
        items.filter(function (q) { return q.topik; }).forEach(function (q) {
          var idT = 'cj|topik|h|' + user.id + '|' + k.nilai, lamaTp = cjAmbil(db, idT), a = jaw[q.id];
          if (a && a.n === 'ya' && a.c && tutup) {
            if (lamaTp && lamaTp.status !== 'antri') return;
            cjPut(store, db, idT, 'topik', user.id, cjMinggu(k.nilai), { judul: a.c, dari: user.id, sumber: 'harian', tanggal: k.nilai,
              minggu: cjMinggu(k.nilai), status: 'antri', dibuat: lamaTp ? lamaTp.dibuat : nowIso }, nowIso);
          } else if (lamaTp && lamaTp.status === 'antri') cjHapus(store, db, idT, nowIso);
        });
      }
      // mingguan: dua-duanya selesai -> beda persepsi >= 2 tingkat otomatis masuk agenda minggu berikutnya
      if (k.periode === 'mingguan' && tutup && ps) {
        var isiPs = cjAmbil(db, 'cj|isi|' + ps.id + '|M:' + k.nilai);
        if (isiPs && isiPs.selesai_at) {
          var isiMap = {}; isiMap[user.id] = cjAmbil(db, idIsi); isiMap[ps.id] = isiPs;
          cjBanding(set, 'mingguan', isiMap, [user.id, ps.id], targets).forEach(function (b) {
            var idA = 'cj|topik|a|' + k.nilai + '|' + b.qid + '|' + b.pemilik, ada = cjAmbil(db, idA), mgBerikut = cjMingguGeser(k.nilai, 1);
            var nama = b.pemilik === user.id ? user.nama : ps.nama;
            if (b.hasil === 'perlu') {
              if (ada) return;
              cjPut(store, db, idA, 'topik', '', mgBerikut, { judul: 'Target ' + nama + ': "' + b.teks + '"', dari: '', sumber: 'selisih', qid: b.qid, target_milik: b.pemilik,
                minggu: mgBerikut, dari_minggu: k.nilai, status: 'antri', dibuat: nowIso }, nowIso);
            } else if (ada && ada.status === 'antri') cjHapus(store, db, idA, nowIso);
          });
        }
      }
      return selesai();
    }

    if (action === 'cj.bagikan') {
      var w = String(payload.minggu || '');
      if (!isMinggu(w)) throw err('Minggu tidak valid');
      var hari = cjHariDalam(w), on = payload.bagikan !== false;
      hari.forEach(function (d) {
        var idH = 'cj|isi|' + user.id + '|H:' + d, isiH = cjAmbil(db, idH);
        if (!isiH || !!isiH.dibagikan === on) return;
        isiH.dibagikan = on;
        cjPut(store, db, idH, 'isian', user.id, 'H:' + d, isiH, nowIso);
      });
      return selesai();
    }

    if (action === 'cj.topik') {   // topik manual
      var tid = String(payload.id || '');
      if (!/^[a-z0-9-]{4,40}$/.test(tid)) throw err('ID topik tidak valid');
      var judul = cjTeks(payload.judul, 160, 'Topik');
      if (!judul) throw err('Tulis topiknya dulu');
      var idM = 'cj|topik|m|' + tid, exM = cjAmbil(db, idM), mg = isMinggu(payload.minggu) ? payload.minggu : cjMinggu(today);
      if (exM && exM.dari !== user.id) throw err('Topik ini dibuat pasangan');
      cjPut(store, db, idM, 'topik', user.id, mg, { judul: judul, dari: user.id, sumber: 'manual', minggu: mg, status: exM ? exM.status : 'antri',
        dibuat: exM ? exM.dibuat : nowIso }, nowIso);
      return selesai();
    }

    if (action === 'cj.topik.update') {
      var idU = String(payload.id || ''), row = byId(db.JurnalPasangan || [])[idU], tp = cjBaca(row);
      if (!tp || row.jenis !== 'topik') throw err('Topik tidak ditemukan');
      ['fakta', 'dampak', 'permintaan', 'rangkum', 'tindakan'].forEach(function (f) { if (f in payload) tp[f] = cjTeks(payload[f], CJ_CATATAN_MAKS, 'Isian'); });
      if ('pic' in payload) {
        var pic = String(payload.pic || '');
        if (pic && pic !== 'berdua' && ids.indexOf(pic) < 0) throw err('PIC tidak valid');
        tp.pic = pic;
      }
      if ('tenggat' in payload) {
        var tg = String(payload.tenggat || '');
        if (tg && !isDate(tg)) throw err('Tenggat tidak valid');
        tp.tenggat = tg;
      }
      if ('status' in payload) {
        var st = String(payload.status);
        if (['antri', 'dibahas', 'ditunda'].indexOf(st) < 0) throw err('Status topik tidak valid');
        if (st === 'dibahas' && (!tp.tindakan || !tp.pic)) throw err('Isi tindak lanjut dan PIC dulu');
        tp.status = st;
        if (st === 'dibahas') { tp.dibahas_at = nowIso; tp.dibahas_minggu = cjMinggu(today); }
      }
      if (payload.hapus) {
        if (tp.dari !== user.id || tp.status === 'dibahas') throw err('Hanya pembuat yang bisa menghapus topik yang belum dibahas');
        cjHapus(store, db, idU, nowIso);
        return selesai();
      }
      tp.diubah_oleh = user.id;
      cjPut(store, db, idU, 'topik', row.pemilik, row.kunci, tp, nowIso);
      return selesai();
    }

    if (action === 'cj.sesi') {
      var ws = String(payload.minggu || '');
      if (!isMinggu(ws) || ws > cjMinggu(today) || ws < cjMingguGeser(cjMinggu(today), -CJ_MUNDUR.mingguan)) throw err('Minggu check-in tidak valid');
      var idS = 'cj|sesi|' + ws, ss = cjAmbil(db, idS), aks = String(payload.aksi || '');
      if (aks === 'mulai') {
        if (ss && ss.selesai_at) return selesai();
        cjPut(store, db, idS, 'sesi', '', ws, ss || { mulai_at: nowIso, mulai_oleh: user.id, menit: CJ_SESI_MENIT }, nowIso);
      } else if (aks === 'selesai') {
        if (!ss) throw err('Check-in belum dimulai');
        if (!ss.selesai_at) {
          ss.selesai_at = nowIso; ss.selesai_oleh = user.id;
          ss.durasi = Math.max(1, Math.round((Date.parse(nowIso) - Date.parse(ss.mulai_at)) / 60000)) || 1;
          ss.topik_dibahas = cjSemua(db, 'topik').filter(function (t) { return t.status === 'dibahas' && t.dibahas_minggu === cjMinggu(today); }).length;
          cjPut(store, db, idS, 'sesi', '', ws, ss, nowIso);
        }
      } else if (aks === 'batal') {
        if (ss && !ss.selesai_at) cjHapus(store, db, idS, nowIso);
      } else throw err('Aksi check-in tidak dikenal');
      return selesai();
    }

    if (action === 'cj.bulan') {
      var bl = String(payload.bulan || '');
      if (!isMonth(bl) || bl > today.slice(0, 7) || bl < cjBulanGeser(today.slice(0, 7), -CJ_MUNDUR.bulanan)) throw err('Bulan tidak valid');
      var idB = 'cj|bulan|' + bl, lb = cjAmbil(db, idB) || {};
      function daftarTeks(a, maks) {
        if (!Array.isArray(a)) return [];
        if (a.length > maks) throw err('Pilih maksimal ' + maks);
        return a.map(function (x) { return cjTeks(x, 160, 'Isian'); }).filter(Boolean);
      }
      var ob = { membaik: daftarTeks(payload.membaik, 2), fokus: daftarTeks(payload.fokus, 2), target: {}, konselor: '', catatan: cjTeks(payload.catatan, CJ_CATATAN_MAKS) };
      var tgt = payload.target && typeof payload.target === 'object' ? payload.target : {};
      ids.forEach(function (u) { var x = String(tgt[u] || ''); if (['tetap', 'ganti', 'naik'].indexOf(x) >= 0) ob.target[u] = x; });
      var ks = String(payload.konselor || '');
      if (ks && ['ya', 'tidak', 'nanti'].indexOf(ks) < 0) throw err('Pilihan konselor tidak valid');
      ob.konselor = ks;
      ob.oleh = user.id;
      ob.selesai_at = bool(payload.selesai) ? (lb.selesai_at || nowIso) : (lb.selesai_at || '');
      if (bool(payload.selesai) && (!ob.fokus.length || !ob.konselor)) throw err('Pilih fokus bulan depan dan jawab soal konselor dulu');
      cjPut(store, db, idB, 'bulan', '', bl, ob, nowIso);
      return selesai();
    }

    if (action === 'cj.draft') {
      var akhirSet = sets[sets.length - 1], lamaD = cjAmbil(db, 'cj|draft');
      var aks2 = String(payload.aksi || 'simpan');
      if (aks2 === 'simpan') {
        var bersih = cjBersihSet(payload.pertanyaan, (lamaD && lamaD.pertanyaan) || (akhirSet ? akhirSet.pertanyaan : []), user.id, ids);
        cjPut(store, db, 'cj|draft', 'draft', '', '', { pertanyaan: bersih, oleh: user.id, diubah: nowIso, dari_versi: akhirSet ? akhirSet.versi : 0, setuju_oleh: '' }, nowIso);
      } else if (aks2 === 'pulihkan') {
        var vs = num(payload.versi), sv = sets.filter(function (s) { return s.versi === vs; })[0];
        if (!sv) throw err('Versi tidak ditemukan');
        cjPut(store, db, 'cj|draft', 'draft', '', '', { pertanyaan: sv.pertanyaan, oleh: user.id, diubah: nowIso, dari_versi: akhirSet ? akhirSet.versi : 0, setuju_oleh: '', pulih_dari: vs }, nowIso);
      } else if (aks2 === 'setuju') {
        if (!lamaD) throw err('Tidak ada draft');
        if (lamaD.oleh === user.id) throw err('Persetujuan diberikan oleh pasangan');
        lamaD.setuju_oleh = user.id; lamaD.setuju_at = nowIso;
        cjPut(store, db, 'cj|draft', 'draft', '', '', lamaD, nowIso);
      } else if (aks2 === 'batal') {
        cjHapus(store, db, 'cj|draft', nowIso);
      } else if (aks2 === 'publish') {
        if (!lamaD) throw err('Tidak ada draft');
        var perlu = cjPerluSetuju(lamaD.pertanyaan, akhirSet ? akhirSet.pertanyaan : [], lamaD.oleh);
        if (perlu && (!lamaD.setuju_oleh || lamaD.setuju_oleh === lamaD.oleh)) throw err('Perubahan item Bersama perlu persetujuan pasangan dulu');
        if (!perlu && lamaD.oleh !== user.id) throw err('Perubahan ini hanya bisa diterbitkan pemiliknya');
        // belum ada isian sama sekali: langsung berlaku. Selain itu mulai periode berikutnya agar data lama tetap sebanding.
        var segar = !(db.JurnalPasangan || []).some(function (r) { return r.jenis === 'isian' && !r.dihapus; });
        var berlaku = {};
        CJ_PERIODE.forEach(function (p) { berlaku[p] = segar ? cjSekarang(p, today) : cjBerikut(p, today); });
        var versi = (akhirSet ? akhirSet.versi : 0) + 1;
        cjPut(store, db, 'cj|set|' + versi, 'set', '', String(versi), { versi: versi, pertanyaan: lamaD.pertanyaan, oleh: lamaD.oleh,
          disetujui: perlu ? lamaD.setuju_oleh : '', terbit_at: nowIso, berlaku: berlaku }, nowIso);
        cjHapus(store, db, 'cj|draft', nowIso);
      } else throw err('Aksi draft tidak dikenal');
      return selesai();
    }

    if (action === 'cj.hapus_saya') {   // hapus semua isian milikku (target & pengaturan bersama tetap)
      (db.JurnalPasangan || []).filter(function (r) { return r.jenis === 'isian' && r.pemilik === user.id && !r.dihapus; })
        .forEach(function (r) { cjHapus(store, db, r.id, nowIso); });
      return selesai();
    }
    throw err('Aksi tidak dikenal: ' + action);
  }
  var CJ = { SKALA: CJ_SKALA, KESIMPULAN: CJ_KESIMPULAN, PERIODE: CJ_PERIODE, KODE: CJ_KODE, CATATAN_MAKS: CJ_CATATAN_MAKS, MAKS_ITEM: CJ_MAKS_ITEM,
    SESI_MENIT: CJ_SESI_MENIT, MUNDUR: CJ_MUNDUR, TEMPLATE_TAMBAHAN: CJ_TEMPLATE_TAMBAHAN,
    template: cjTemplate, bawaan: cjBawaan, khusus: cjKhusus, minggu: cjMinggu, senin: cjSenin, hariDalam: cjHariDalam, mingguGeser: cjMingguGeser,
    bulanGeser: cjBulanGeser, bulanDariMinggu: cjBulanDariMinggu, mingguDalamBulan: cjMingguDalamBulan, uraiKunci: cjUraiKunci, sekarang: cjSekarang,
    berikut: cjBerikut, mundur: cjMundur, setUntuk: cjSetUntuk, item: cjItem, itemObserver: cjItemObserver, teksItem: cjTeksItem, nilaiValid: cjNilaiValid,
    labelNilai: cjLabelNilai, kesimpulan: cjKesimpulan, banding: cjBanding, perluSetuju: cjPerluSetuju, bersihSet: cjBersihSet, view: cjView };

  // ---------- API handler (dipakai server & mode demo) ----------
  // store: { all(table) -> array, upsert(table, obj) -> obj, calendar?: { upsert, remove } }
  function handle(store, user, action, payload, nowIso) {
    payload = payload || {};
    cekFitur(store.fitur || null, action);
    var db = {};
    Object.keys(SCHEMA).forEach(function (t) { db[t] = store.all(t); });
    var today = nowIso.slice(0, 10);

    switch (action) {
      case 'bootstrap': {
        var months = {};
        liveTx(db).forEach(function (t) { months[String(t.tanggal).slice(0, 7)] = 1; });
        months[today.slice(0, 7)] = 1;
        // kategori setoran dibuat sekali; kalau Sheet sedang tidak bisa ditulis, bootstrap tetap jalan
        try { ensureKategoriSetoran(store, db); } catch (eSet) { /* pakai nama cadangan */ }
        return {
          version: VERSION, user: user, today: today,
          buku: sortBy(db.Buku, 'urutan'), users: db.Users,
          kategori: sortBy(db.Kategori, 'urutan'), kantong: sortBy(db.Kantong, 'urutan'),
          saldo: computeSaldo(db).saldo, bulan: Object.keys(months).sort().reverse(),
          utang: computeUtang(db), talangan: computeTalangan(db),
          rencana: db.Buku.reduce(function (m, b) { m[b.id] = rencanaBuku(b); return m; }, {}),
          fitur: store.fitur || null
        };
      }
      case 'month': {
        var bulan = String(payload.bulan || '');
        if (!isMonth(bulan)) throw err('Bulan tidak valid');
        return {
          bulan: bulan,
          transaksi: liveTx(db).filter(function (t) { return String(t.tanggal).slice(0, 7) === bulan; }),
          budget: effectiveBudget(db, bulan)
        };
      }
      case 'tx.save': {
        var ex = byId(db.Transaksi)[payload.id];
        if (ex && ex.dihapus) throw err('Transaksi sudah dihapus');
        if (ex && !canWrite(db, user, ex.buku)) throw err('Kamu hanya bisa melihat transaksi ini');
        if (ex && ex.sumber === 'auto') throw err('Catatan otomatis. Ubah lewat transaksi reimburse aslinya.');
        var t = cleanTx(payload, db, user, ex);
        // jika transaksi reimburse yang sudah terbayar diubah, catatan pemasukan otomatisnya ikut
        var linked = ex && ex.tx_balik ? byId(db.Transaksi)[ex.tx_balik] : null;
        if (linked && !linked.dihapus) {
          if (linked.tipe === 'Transfer') {
            // pelunasan talangan: 1 transfer bisa menutup beberapa transaksi, jadi jangan diubah di sini.
            // Kalau transaksi ini tidak lagi berupa talangan, cukup lepas tandanya.
            var masihTalangan = t.tipe === 'Pengeluaran' && !t.reimburse && t.buku === linked.buku;
            if (!masihTalangan) { t.terbayar = ''; t.tx_balik = ''; }
          } else if (!t.reimburse || t.tipe !== 'Pengeluaran') {
            softDelete(store, linked, nowIso); t.terbayar = ''; t.tx_balik = '';
          } else {
            var lk = clone(linked);
            lk.nominal = t.nominal; lk.buku = t.buku;
            lk.keterangan = 'Reimburse: ' + (t.keterangan || 'pengeluaran'); lk.diubah = nowIso;
            store.upsert('Transaksi', lk);
          }
        }
        t.oleh = ex ? ex.oleh : user.id;
        t.sumber = ex ? (ex.sumber || 'app') : 'app';
        t.dibuat = ex ? ex.dibuat : nowIso;
        t.diubah = nowIso; t.dihapus = '';
        store.upsert('Transaksi', t);
        return { tx: t };
      }
      case 'tx.reimburse': {
        var rx = byId(db.Transaksi)[payload.id];
        if (!rx || rx.dihapus) throw err('Transaksi tidak ditemukan');
        if (rx.tipe !== 'Pengeluaran' || !bool(rx.reimburse)) throw err('Transaksi ini bukan reimburse');
        if (!canWrite(db, user, rx.buku)) throw err('Kamu hanya bisa melihat transaksi ini');
        var rid = 'rb-' + rx.id, cur = byId(db.Transaksi)[rid];
        var upd = clone(rx);
        if (bool(payload.bayar)) {
          var tujuan = byId(db.Kantong)[payload.kantong];
          if (!tujuan) throw err('Pilih kantong tempat uang masuk');
          if (!bool(tujuan.aktif)) throw err('Kantong "' + tujuan.nama + '" nonaktif');
          if (!canWrite(db, user, tujuan.buku)) throw err('Kamu tidak bisa memakai kantong "' + tujuan.nama + '"');
          var tgl = isDate(payload.tanggal) ? payload.tanggal : today;
          ensureKategoriReimburse(store, db);
          var masuk = { id: rid, tanggal: tgl, tipe: 'Pemasukan', nominal: rx.nominal, buku: rx.buku,
            kategori: KAT_REIMBURSE, kantong: tujuan.id, kantong_tujuan: '',
            keterangan: 'Reimburse: ' + (rx.keterangan || 'pengeluaran'), reimburse: false,
            oleh: user.id, sumber: 'auto', dibuat: cur ? cur.dibuat : nowIso, diubah: nowIso, dihapus: '',
            terbayar: '', tx_balik: '' };
          store.upsert('Transaksi', masuk);
          upd.terbayar = tgl; upd.tx_balik = rid;
        } else {
          if (cur && !cur.dihapus) softDelete(store, cur, nowIso);
          upd.terbayar = ''; upd.tx_balik = '';
        }
        upd.diubah = nowIso;
        store.upsert('Transaksi', upd);
        return { tx: upd };
      }
      case 'talangan.lunas': {
        var ids = payload.ids || [];
        if (!ids.length) throw err('Pilih dulu transaksi yang mau dilunasi');
        if (ids.length > 100) throw err('Maksimal 100 transaksi sekaligus');
        var kanL = byId(db.Kantong), bmapL = byId(db.Buku);
        var srcK = kanL[payload.kantong], dstK = kanL[payload.kantong_tujuan];
        if (!srcK) throw err('Pilih kantong dompet bersama');
        if (!dstK) throw err('Pilih kantong tujuan');
        if (srcK.id === dstK.id) throw err('Kantong asal dan tujuan sama');
        if (!bool(srcK.aktif)) throw err('Kantong "' + srcK.nama + '" nonaktif');
        if (!bool(dstK.aktif)) throw err('Kantong "' + dstK.nama + '" nonaktif');
        var bSrc = bmapL[srcK.buku], bDst = bmapL[dstK.buku];
        if (!bSrc || bSrc.tipe !== 'Bersama') throw err('Kantong asal harus kantong dompet bersama');
        if (!bDst || bDst.tipe !== 'Pribadi') throw err('Kantong tujuan harus kantong pribadi');
        if (!canWrite(db, user, bSrc.id)) throw err('Kamu tidak bisa memakai kantong "' + srcK.nama + '"');
        var nomL = Math.round(num(payload.nominal));
        if (!(nomL > 0) || nomL > 1e12) throw err('Nominal harus lebih dari 0');
        var tglL = isDate(payload.tanggal) ? payload.tanggal : today;
        var txmapL = byId(db.Transaksi), pilih = [], totalPilih = 0;
        for (var iL = 0; iL < ids.length; iL++) {
          var p = txmapL[String(ids[iL])];
          if (!p || p.dihapus) throw err('Ada transaksi yang sudah tidak ada. Muat ulang dulu.');
          if (p.terbayar) throw err('Ada transaksi yang sudah dilunasi. Muat ulang dulu.');
          if (p.tipe !== 'Pengeluaran' || bool(p.reimburse)) throw err('Ada transaksi yang bukan talangan');
          if (p.buku !== bSrc.id) throw err('Ada transaksi yang bukan milik buku ' + bSrc.nama);
          var pk = kanL[p.kantong];
          if (!pk || pk.buku !== bDst.id) throw err('Ada transaksi yang tidak dibayar pakai kantong ' + bDst.nama);
          pilih.push(p); totalPilih += num(p.nominal);
        }
        var tidL = 'ln-' + tglL.replace(/-/g, '') + '-' + Math.random().toString(36).slice(2, 8);
        var ketL = String(payload.keterangan || '').trim().slice(0, 200) ||
          ('Ganti talangan ' + bDst.nama + ' (' + pilih.length + ' transaksi)');
        var trf = { id: tidL, tanggal: tglL, tipe: 'Transfer', nominal: nomL, buku: bSrc.id,
          kategori: '', kantong: srcK.id, kantong_tujuan: dstK.id, keterangan: ketL,
          reimburse: false, oleh: user.id, sumber: 'app', dibuat: nowIso, diubah: nowIso, dihapus: '',
          terbayar: '', tx_balik: '' };
        store.upsert('Transaksi', trf);
        pilih.forEach(function (p2) {
          var up = clone(p2); up.terbayar = tglL; up.tx_balik = tidL; up.diubah = nowIso;
          store.upsert('Transaksi', up);
        });
        // selisih lebih/kurang tidak disimpan terpisah: computeUtang sudah menghitungnya
        // dari (total pengeluaran talangan - total transfer penggantian), jadi otomatis jalan ke bulan depan.
        return { tx: trf, ids: pilih.map(function (p3) { return p3.id; }), total: totalPilih, selisih: nomL - totalPilih };
      }
      case 'tx.delete': {
        var d = byId(db.Transaksi)[payload.id];
        if (!d || d.dihapus) return { id: payload.id };        // idempoten
        if (!canWrite(db, user, d.buku)) throw err('Kamu hanya bisa melihat transaksi ini');
        if (d.sumber === 'auto') throw err('Catatan otomatis. Batalkan lewat transaksi reimburse aslinya.');
        if (d.tx_balik) {
          var dl = byId(db.Transaksi)[d.tx_balik];
          // transfer pelunasan talangan dibiarkan: bisa dipakai transaksi lain.
          // Selisihnya otomatis muncul sebagai titipan di kartu utang antar dompet.
          if (dl && !dl.dihapus && dl.tipe !== 'Transfer') softDelete(store, dl, nowIso);
        }
        if (d.tipe === 'Transfer') {
          // hapus transfer pelunasan = batalkan pelunasannya, transaksi balik ke daftar talangan
          db.Transaksi.forEach(function (x) {
            if (x.dihapus || x.tx_balik !== d.id) return;
            var ub = clone(x); ub.terbayar = ''; ub.tx_balik = ''; ub.diubah = nowIso;
            store.upsert('Transaksi', ub);
          });
        }
        softDelete(store, d, nowIso);
        return { id: d.id };
      }
      case 'kategori.save': {
        var kin = payload, kex = byId(db.Kategori)[kin.id];
        var nama = String(kin.nama || '').trim().slice(0, 40);
        if (!nama) throw err('Nama kategori wajib diisi');
        var tipe = String(kin.tipe || (kex && kex.tipe) || '');
        if (tipe !== 'Pengeluaran' && tipe !== 'Pemasukan') throw err('Tipe kategori tidak valid');
        var scope = String(kin.buku || '').split(',').map(function (s) { return s.trim(); })
          .filter(function (b) { return byId(db.Buku)[b]; });
        if (!scope.length) throw err('Pilih minimal satu buku');
        // boleh ubah hanya jika semua buku lama & baru yang disentuh bisa ditulis user,
        // atau buku yang tidak bisa ditulis tidak berubah
        var old = kex ? scopeOf(kex) : [];
        var touched = scope.filter(function (b) { return old.indexOf(b) < 0; })
          .concat(old.filter(function (b) { return scope.indexOf(b) < 0; }));
        touched.forEach(function (b) { if (!canWrite(db, user, b)) throw err('Tidak bisa mengubah kategori buku orang lain'); });
        if (kex && !scope.concat(old).some(function (b) { return canWrite(db, user, b); })) throw err('Tidak bisa mengubah kategori ini');
        // sub-kategori: 2 level saja (induk -> sub). Sub ikut buku & pos induknya.
        var kmapS = byId(db.Kategori);
        var induk = kin.induk === undefined ? (kex ? String(kex.induk || '') : '') : String(kin.induk || '');
        var pos = kin.pos === undefined ? (kex ? String(kex.pos || '') : '') : String(kin.pos || '');
        if (pos && POS.indexOf(pos) < 0) throw err('Pos budget tidak dikenal');
        if (induk) {
          var ik = kmapS[induk];
          if (!ik) throw err('Induk kategori tidak ditemukan');
          if (kex && ik.id === kex.id) throw err('Kategori tidak bisa jadi sub dirinya sendiri');
          if (ik.induk) throw err('Sub-kategori tidak bisa punya sub lagi');
          if (isSistem(ik)) throw err('Kategori otomatis tidak bisa punya sub');
          if (ik.tipe !== tipe) throw err('Tipe sub harus sama dengan induknya');
          if (kex && db.Kategori.some(function (x) { return x.induk === kex.id; })) throw err('Kategori ini punya sub, jadi tidak bisa jadi sub');
          scope.forEach(function (b) { if (scopeOf(ik).indexOf(b) < 0) throw err('Sub harus di buku yang sama dengan induknya'); });
          pos = String(ik.pos || '');
        }
        if (tipe === 'Pemasukan') pos = '';
        var aktifBaru = kin.aktif === undefined ? (kex ? bool(kex.aktif) : true) : bool(kin.aktif);
        if (aktifBaru) {
          var kembar = kategoriKembar(db, nama, scope, induk, kex ? kex.id : '');
          if (kembar) throw err('Kategori "' + kembar.nama + '" sudah ada' + (induk ? ' di induk ini' : ' di buku ini'));
        }
        var id = kex ? kex.id : (String(kin.id || '') || slug(nama));
        if (!kex && byId(db.Kategori)[id]) id = id + '-' + Math.random().toString(36).slice(2, 6);
        if (!kex) {
          var urMax = db.Kategori.reduce(function (m, x) { return Math.max(m, num(x.urutan)); }, 0);
          if (kin.urutan === undefined) kin.urutan = urMax + 1;
        }
        var kat = { id: id, nama: nama, tipe: tipe, buku: scope.join(','), induk: induk, pos: pos,
          warna: /^#[0-9a-fA-F]{6}$/.test(kin.warna || '') ? kin.warna : (kex ? kex.warna : '#7C9CFF'),
          hitung: kin.hitung === undefined ? (kex ? bool(kex.hitung) : true) : bool(kin.hitung),
          aktif: kin.aktif === undefined ? (kex ? bool(kex.aktif) : true) : bool(kin.aktif),
          urutan: kin.urutan !== undefined ? num(kin.urutan) : (kex ? num(kex.urutan) : db.Kategori.length + 1) };
        store.upsert('Kategori', kat);
        // pos induk berubah -> sub ikut
        if (!induk) db.Kategori.forEach(function (x) {
          if (x.induk === kat.id && String(x.pos || '') !== kat.pos) { var u = clone(x); u.pos = kat.pos; store.upsert('Kategori', u); }
        });
        return { kategori: kat };
      }
      case 'kategori.template': {
        var hasilT = terapkanTemplate(store, db, user, String(payload.buku || ''), String(payload.level || ''));
        hasilT.kategori = sortBy(db.Kategori, 'urutan');
        return hasilT;
      }
      case 'buku.manajer': {
        var bm = byId(db.Buku)[String(payload.buku || '')];
        if (!bm || bm.tipe !== 'Bersama') throw err('Manajer keuangan hanya untuk buku bersama');
        var calon = byId(db.Users || [])[String(payload.user || '')];
        if (!calon) throw err('Pilih user yang ada');
        // pertama kali: siapa pun yang login boleh memilih. Setelah itu: hanya manajer saat ini (atau admin lewat Panel Admin)
        if (bm.manajer && bm.manajer !== user.id) throw err('Hanya manajer keuangan saat ini yang bisa menggantinya');
        var bu = clone(bm); bu.manajer = calon.id;
        store.upsert('Buku', bu);
        return { buku: bu };
      }
      case 'budget.rencana': {
        var bkR = String(payload.buku || ''), blR = String(payload.bulan || today.slice(0, 7));
        if (!isMonth(blR)) throw err('Bulan tidak valid');
        var bR = cekAturRencana(db, user, bkR);
        var gaji = Math.round(num(payload.penghasilan));
        if (!(gaji > 0) || gaji > 1e12) throw err('Isi penghasilan per bulan');
        var hasil = bagiRencana(indukRencana(db, bkR), gaji, payload.rasio);
        // nominal per kategori boleh diubah user sebelum simpan (hanya induk yang ikut rencana)
        var ubah = payload.items || {};
        Object.keys(ubah).forEach(function (k) { if (k in hasil.items) hasil.items[k] = Math.max(0, Math.round(num(ubah[k]))); });
        var bRow = clone(bR); bRow.penghasilan = gaji; bRow.rasio = hasil.rasio; bRow.rencana_diubah = nowIso;
        store.upsert('Buku', bRow);
        handle(store, user, 'budget.save', { bulan: blR, buku: bkR, items: hasil.items }, nowIso);
        db.Budget = store.all('Budget');
        hasil.bulan = blR; hasil.buku = bkR;
        hasil.total = Object.keys(hasil.items).reduce(function (t, k) { return t + hasil.items[k]; }, 0);
        hasil.budget = effectiveBudget(db, blR)[bkR];
        return hasil;
      }
      case 'kantong.save': {
        var kin2 = payload, kx = byId(db.Kantong)[kin2.id];
        var buku = kx ? kx.buku : String(kin2.buku || '');
        if (!canWrite(db, user, buku)) throw err('Kamu hanya bisa melihat kantong ini');
        var nm = String(kin2.nama || '').trim().slice(0, 40);
        if (!nm) throw err('Nama kantong wajib diisi');
        var jenis = String(kin2.jenis || (kx && kx.jenis) || '');
        if (JENIS_KANTONG.indexOf(jenis) < 0) throw err('Jenis kantong tidak valid');
        var kid = kx ? kx.id : (String(kin2.id || '') || slug(nm + '-' + buku));
        if (!kx && byId(db.Kantong)[kid]) kid = kid + '-' + Math.random().toString(36).slice(2, 6);
        var k2 = { id: kid, nama: nm, jenis: jenis, buku: buku,
          saldo_awal: kx ? num(kx.saldo_awal) : 0,
          per_tanggal: kx ? String(kx.per_tanggal || addDays(today, -1)) : addDays(today, -1),
          limit: Math.max(0, num(kin2.limit !== undefined ? kin2.limit : (kx ? kx.limit : 0))),
          aktif: kin2.aktif === undefined ? (kx ? bool(kx.aktif) : true) : bool(kin2.aktif),
          urutan: kin2.urutan !== undefined ? num(kin2.urutan) : (kx ? num(kx.urutan) : db.Kantong.length + 1) };
        if (kin2.saldo_sekarang !== undefined && kin2.saldo_sekarang !== null && kin2.saldo_sekarang !== '') {
          var delta = kx ? (computeSaldo(db).delta[kx.id] || 0) : 0;
          k2.saldo_awal = Math.round(num(kin2.saldo_sekarang) - delta);
        }
        store.upsert('Kantong', k2);
        db.Kantong = store.all('Kantong');
        return { kantong: k2, saldo: computeSaldo(db).saldo[k2.id] };
      }
      case 'budget.save': {
        var bl = String(payload.bulan || ''), bk = String(payload.buku || '');
        if (!isMonth(bl)) throw err('Bulan tidak valid');
        if (!canWrite(db, user, bk)) throw err('Kamu hanya bisa melihat budget buku ini');
        var items = payload.items || {}, kmap = byId(db.Kategori), saved = 0;
        // simpan semua item termasuk 0 agar bulan ini punya snapshot sendiri
        var eff = effectiveBudget(db, bl)[bk].items;
        var all = {};
        Object.keys(eff).forEach(function (k) { all[k] = eff[k]; });
        // budget hanya di kategori induk
        Object.keys(items).forEach(function (k) { if (kmap[k] && !kmap[k].induk) all[k] = Math.max(0, Math.round(num(items[k]))); });
        Object.keys(all).forEach(function (k) {
          store.upsert('Budget', { id: bl + '|' + bk + '|' + k, bulan: bl, buku: bk, kategori: k, nominal: all[k] });
          saved++;
        });
        if (!saved) store.upsert('Budget', { id: bl + '|' + bk + '|_', bulan: bl, buku: bk, kategori: '_', nominal: 0 });
        db.Budget = store.all('Budget');
        return { bulan: bl, buku: bk, budget: effectiveBudget(db, bl)[bk] };
      }
      case 'batch': {
        var ops = payload.ops || [];
        if (ops.length > 200) throw err('Terlalu banyak operasi');
        return { results: ops.map(function (op) {
          if (op.action === 'batch') return { ok: false, error: 'Nested batch' };
          try { return { ok: true, opId: op.opId, data: handle(store, user, op.action, op.payload, nowIso) }; }
          catch (e) { return { ok: false, opId: op.opId, error: e.userFacing ? e.message : 'Kesalahan server: ' + e.message }; }
        }) };
      }
      default:
        if (String(action).indexOf('todo.') === 0) return todoAksi(store, db, user, action, payload, nowIso);
        if (String(action).indexOf('komitmen.') === 0) return komitmenAksi(store, db, user, action, payload, nowIso);
        if (String(action).indexOf('pengesahan.') === 0) return pengesahanAksi(store, db, user, action, payload || {}, nowIso);
        if (String(action).indexOf('jurnal.') === 0) return jurnalAksi(store, db, user, action, payload, nowIso);
        if (String(action).indexOf('siklus.') === 0) return siklusAksi(store, db, user, action, payload, nowIso);
        if (String(action).indexOf('cj.') === 0) return cjAksi(store, db, user, action, payload, nowIso);
        throw err('Aksi tidak dikenal: ' + action);
    }
  }

  // ---------- memory store (mode demo & test) ----------
  function memoryStore(seed) {
    var data = {};
    Object.keys(SCHEMA).forEach(function (t) { data[t] = (seed && seed[t] ? seed[t] : []).map(function (r) { return JSON.parse(JSON.stringify(r)); }); });
    // kalender tiruan: menyimpan event di memori, bisa dibuat gagal lewat calendar.gagal = 'pesan'
    var calendar = {
      events: {}, n: 0, gagal: '',
      upsert: function (id, spec) {
        if (this.gagal) throw new Error(this.gagal);
        if (!id || !this.events[id]) id = 'ev-' + (++this.n);
        this.events[id] = spec; return id;
      },
      remove: function (id) { if (this.gagal) throw new Error(this.gagal); delete this.events[id]; }
    };
    return {
      data: data, calendar: calendar,
      all: function (t) { return data[t].map(function (r) { return JSON.parse(JSON.stringify(r)); }); },
      upsert: function (t, obj) {
        var row = {}; SCHEMA[t].forEach(function (h) { row[h] = obj[h] === undefined ? '' : obj[h]; });
        for (var i = 0; i < data[t].length; i++) if (data[t][i].id === row.id) { data[t][i] = row; return row; }
        data[t].push(row); return row;
      }
    };
  }

  return {
    VERSION: VERSION, SCHEMA: SCHEMA, FITUR: FITUR, fiturDariAksi: fiturDariAksi, fiturAktif: fiturAktif, cekFitur: cekFitur, TIPE_TX: TIPE_TX, JENIS_KANTONG: JENIS_KANTONG,
    canWrite: canWrite, writableBuku: writableBuku, computeSaldo: computeSaldo,
    effectiveBudget: effectiveBudget, summarize: summarize, txInBuku: txInBuku,
    bukuOfKantong: bukuOfKantong, scopeOf: scopeOf, bool: bool, num: num, byId: byId,
    addDays: addDays, slug: slug, handle: handle, memoryStore: memoryStore, cleanTx: cleanTx,
    computeUtang: computeUtang, computeTalangan: computeTalangan, arahTransfer: arahTransfer,
    KAT_REIMBURSE: KAT_REIMBURSE, KAT_SETORAN: KAT_SETORAN, KAT_SETORAN_MASUK: KAT_SETORAN_MASUK,
    TEMPLATE_KATEGORI: TEMPLATE_KATEGORI, TEMPLATE_LEVEL: TEMPLATE_LEVEL, POS: POS, POS_NAMA: POS_NAMA, RASIO_BAKU: RASIO_BAKU,
    templateDaftar: templateDaftar, jenisTemplate: jenisTemplate, bolehAturRencana: bolehAturRencana, bukuKosong: bukuKosong,
    bagiRencana: bagiRencana, indukRencana: indukRencana, parseRasio: parseRasio, normNama: normNama, isSistem: isSistem, indukDari: indukDari,
    cleanTodo: cleanTodo, canWriteTodo: canWriteTodo, todoEventSpec: todoEventSpec, todoPerluEvent: todoPerluEvent,
    todoSudahLewat: todoSudahLewat, todoSyncMassal: todoSyncMassal, todoTidakDikirimLewat: todoTidakDikirimLewat,
    komitmenView: komitmenView, cariKomitmen: cariKomitmen, hashLembar: hashLembar, lembarItems: lembarItems, nomorDariKueri: nomorDariKueri, normCari: normCari,
    ayatDari: ayatDari, pembukaDari: pembukaDari, slotTtd: slotTtd,
    isTime: isTime, TODO_BERSAMA: TODO_BERSAMA, TODO_DURASI: TODO_DURASI, TODO_SELESAI_EVENT: TODO_SELESAI_EVENT,
    TODO_TIPE: TODO_TIPE, todoTipe: todoTipe, evaluasiPengingat: evaluasiPengingat, EVALUASI_JUDUL: EVALUASI_JUDUL,
    EVALUASI_PENGINGAT_JAM: EVALUASI_PENGINGAT_JAM,
    Siklus: Siklus, siklusView: siklusView, SIKLUS_PEMILIK: SIKLUS_PEMILIK, SIKLUS_VERSI_TEKS: SIKLUS_VERSI_TEKS,
    CJ: CJ
  };
})();
export default KantongCore;
