/*
 * Kantong — core logic (dipakai bersama oleh PWA, mode demo, dan Edge Function Supabase).
 * Salinan untuk Edge Function dibuat oleh: node kantong/tools/build_core.js
 * Gaya ES5 (tanpa optional chaining) dipertahankan supaya jalan di browser lama.
 */
var KantongCore = (function () {
  'use strict';

  var SCHEMA = {
    Buku: ['id', 'nama', 'tipe', 'pemilik', 'urutan'],
    Users: ['id', 'nama', 'buku'],
    Kategori: ['id', 'nama', 'tipe', 'buku', 'warna', 'hitung', 'aktif', 'urutan'],
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
    Jurnal: ['id', 'pemilik', 'jenis', 'tanggal', 'isi', 'diubah', 'dihapus']
  };
  var KAT_REIMBURSE = 'reimburse-masuk';   // kategori pemasukan otomatis, tidak dihitung sebagai pendapatan
  var KAT_SETORAN = 'setoran-rt';          // pengeluaran otomatis: topup dari kantong pribadi ke dompet bersama
  var KAT_SETORAN_MASUK = 'setoran-rt-in'; // pemasukan otomatis di sisi dompet bersama
  var TIPE_TX = ['Pengeluaran', 'Pemasukan', 'Transfer'];
  var JENIS_KANTONG = ['Cash', 'Debit', 'E-wallet', 'Kredit'];
  var VERSION = '1.6.0';
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
    var spend = {}, inc = {};
    monthTx.forEach(function (t) {
      if (t.dihapus) return;
      var n = num(t.nominal), k = kmap[t.kategori];
      if (t.tipe === 'Pengeluaran' && inSet(t.buku)) {
        // reimburse: tetap dihitung selama menunggu; keluar dari hitungan setelah terbayar
        if (bool(t.reimburse) && t.terbayar) { s.reimburse += n; return; }
        if (bool(t.reimburse)) s.reimburseMenunggu += n;
        if (k && !bool(k.hitung)) return;
        s.pengeluaran += n; spend[t.kategori] = (spend[t.kategori] || 0) + n;
      } else if (t.tipe === 'Pemasukan' && inSet(t.buku)) {
        if (k && !bool(k.hitung)) return;
        s.pemasukan += n; inc[t.kategori] = (inc[t.kategori] || 0) + n;
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
      Object.keys(items).forEach(function (kid) { bud[kid] = (bud[kid] || 0) + num(items[kid]); });
    });
    var ids = {};
    Object.keys(spend).forEach(function (k) { ids[k] = 1; });
    Object.keys(bud).forEach(function (k) { if (bud[k] > 0) ids[k] = 1; });
    s.perKategori = Object.keys(ids).map(function (kid) {
      var k = kmap[kid] || katBawaan(kid);
      var total = spend[kid] || 0, b = bud[kid] || 0;
      s.budgetTotal += b;
      return { id: kid, nama: k.nama, warna: k.warna, total: total, budget: b, sisa: b - total,
        pct: s.pengeluaran > 0 ? total / s.pengeluaran : 0 };
    }).sort(function (a, b) { return b.total - a.total || b.budget - a.budget; });
    s.perMasuk = Object.keys(inc).map(function (kid) {
      var k = kmap[kid] || katBawaan(kid);
      return { id: kid, nama: k.nama, warna: k.warna, total: inc[kid] };
    }).sort(function (a, b) { return b.total - a.total; });
    s.selisih = s.pemasukan - s.pengeluaran;
    s.sisaBudget = s.budgetTotal - s.pengeluaran;
    return s;
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
  function ayatDari(v) {
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
        versi: isi ? num(isi.versi) : 0, ayat: isi ? ayatDari(isi.isi_ayat) : [], sumber: isi ? String(isi.sumber || '') : '',
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
      pasal.forEach(function (p) {
        if (p.id === d.id || p.status === 'dicabut') return;
        var teks = normCari(p.ayat.join(' ') + ' ' + p.keterangan.map(function (k) { return k.isi; }).join(' '));
        if (kataUtuh(teks, istilah)) d.lihat_juga.push(p.nomor);
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
    var TINGKAT = { judul: 1, kata_kunci: 2, rujukan: 2, ayat: 3, keterangan: 3 };
    (pasal || []).forEach(function (p) {
      var f = [['judul', -1, p.judul], ['kata_kunci', -1, (p.kata_kunci || []).join(', ')], ['rujukan', -1, p.rujukan_asli]];
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
        return { jenis_item: 'versi', id: v.id, versi: num(v.versi), jenis: v.jenis, status: v.status, ayat: ayatDari(v.isi_ayat), alasan: String(v.alasan || ''),
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
        sesudah: v.jenis === 'cabut' ? [] : ayatDari(v.isi_ayat), sebelum: lama ? ayatDari(lama.isi_ayat) : [], alasan: String(v.alasan || ''), dibuat_oleh: String(v.dibuat_oleh || '') };
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
    var s = JSON.stringify(items.map(function (i) { return [i.id, i.jenis, i.sesudah, i.alasan]; })), h = 0x811c9dc5;
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

  // ---------- API handler (dipakai server & mode demo) ----------
  // store: { all(table) -> array, upsert(table, obj) -> obj, calendar?: { upsert, remove } }
  function handle(store, user, action, payload, nowIso) {
    payload = payload || {};
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
          utang: computeUtang(db), talangan: computeTalangan(db)
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
        var id = kex ? kex.id : (String(kin.id || '') || slug(nama));
        if (!kex && byId(db.Kategori)[id]) id = id + '-' + Math.random().toString(36).slice(2, 6);
        var kat = { id: id, nama: nama, tipe: tipe, buku: scope.join(','),
          warna: /^#[0-9a-fA-F]{6}$/.test(kin.warna || '') ? kin.warna : (kex ? kex.warna : '#7C9CFF'),
          hitung: kin.hitung === undefined ? (kex ? bool(kex.hitung) : true) : bool(kin.hitung),
          aktif: kin.aktif === undefined ? (kex ? bool(kex.aktif) : true) : bool(kin.aktif),
          urutan: kin.urutan !== undefined ? num(kin.urutan) : (kex ? num(kex.urutan) : db.Kategori.length + 1) };
        store.upsert('Kategori', kat);
        return { kategori: kat };
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
        Object.keys(items).forEach(function (k) { if (kmap[k]) all[k] = Math.max(0, Math.round(num(items[k]))); });
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
    VERSION: VERSION, SCHEMA: SCHEMA, TIPE_TX: TIPE_TX, JENIS_KANTONG: JENIS_KANTONG,
    canWrite: canWrite, writableBuku: writableBuku, computeSaldo: computeSaldo,
    effectiveBudget: effectiveBudget, summarize: summarize, txInBuku: txInBuku,
    bukuOfKantong: bukuOfKantong, scopeOf: scopeOf, bool: bool, num: num, byId: byId,
    addDays: addDays, slug: slug, handle: handle, memoryStore: memoryStore, cleanTx: cleanTx,
    computeUtang: computeUtang, computeTalangan: computeTalangan, arahTransfer: arahTransfer,
    KAT_REIMBURSE: KAT_REIMBURSE, KAT_SETORAN: KAT_SETORAN, KAT_SETORAN_MASUK: KAT_SETORAN_MASUK,
    cleanTodo: cleanTodo, canWriteTodo: canWriteTodo, todoEventSpec: todoEventSpec, todoPerluEvent: todoPerluEvent,
    todoSudahLewat: todoSudahLewat, todoSyncMassal: todoSyncMassal, todoTidakDikirimLewat: todoTidakDikirimLewat,
    komitmenView: komitmenView, cariKomitmen: cariKomitmen, hashLembar: hashLembar, lembarItems: lembarItems, nomorDariKueri: nomorDariKueri, normCari: normCari,
    ayatDari: ayatDari, slotTtd: slotTtd,
    isTime: isTime, TODO_BERSAMA: TODO_BERSAMA, TODO_DURASI: TODO_DURASI, TODO_SELESAI_EVENT: TODO_SELESAI_EVENT,
    TODO_TIPE: TODO_TIPE, todoTipe: todoTipe, evaluasiPengingat: evaluasiPengingat, EVALUASI_JUDUL: EVALUASI_JUDUL,
    EVALUASI_PENGINGAT_JAM: EVALUASI_PENGINGAT_JAM
  };
})();
if (typeof module !== 'undefined' && module.exports) module.exports = KantongCore;
