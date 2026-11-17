/* Kantong — Transaksi: pemilih kategori, reimburse, talangan, form transaksi.
   Skrip biasa (bukan modul): nama top-level dipakai bersama file js/ lain. Urutan muat ada di index.html & kantong.html. */
'use strict';

// ================= pemilih kategori =================
function katChoices(buku, tipe, keepId) {
  return db().Kategori.filter(function (k) {
    // kategori otomatis (reimburse masuk, setoran dompet bersama) tidak dipilih manual
    if (k.id === C.KAT_REIMBURSE || k.id === C.KAT_SETORAN || k.id === C.KAT_SETORAN_MASUK) return false;
    return k.tipe === tipe && (C.bool(k.aktif) || k.id === keepId) && C.scopeOf(k).indexOf(buku) >= 0;
  }).sort(function (a, b) { return a.urutan - b.urutan; });
}
function katFreq(buku, tipe) {            // pemakaian 60 hari terakhir
  var cut = C.addDays(todayISO(), -60), cnt = {};
  Object.keys(S.months).forEach(function (b) {
    (S.months[b].transaksi || []).forEach(function (t) {
      if (t.buku === buku && t.tipe === tipe && t.kategori && t.sumber !== 'auto' && t.tanggal >= cut) cnt[t.kategori] = (cnt[t.kategori] || 0) + 1;
    });
  });
  return cnt;
}
function guessKategori(buku, tipe, ket) { // tebak dari keterangan yang pernah dipakai
  var q = String(ket || '').trim().toLowerCase();
  if (q.length < 3) return '';
  var exact = {}, part = {};
  Object.keys(S.months).forEach(function (b) {
    (S.months[b].transaksi || []).forEach(function (t) {
      if (t.buku !== buku || t.tipe !== tipe || !t.kategori || !t.keterangan || t.sumber === 'auto') return;
      var key = String(t.keterangan).trim().toLowerCase();
      if (key === q) exact[t.kategori] = (exact[t.kategori] || 0) + 1;
      else if (key.length >= 3 && (key.indexOf(q) === 0 || q.indexOf(key) === 0)) part[t.kategori] = (part[t.kategori] || 0) + 1;
    });
  });
  var pool = Object.keys(exact).length ? exact : part, best = '';
  Object.keys(pool).forEach(function (k) { if (!best || pool[k] > pool[best]) best = k; });
  return best;
}
function openKategoriPicker(f, opts, onPick) {
  openSheet('Pilih kategori', function (sh) {
    var all = katChoices(f.buku, f.tipe, f.kategori), freq = katFreq(f.buku, f.tipe);
    var top = all.filter(function (k) { return freq[k.id]; }).sort(function (a, b) { return freq[b.id] - freq[a.id] || a.urutan - b.urutan; }).slice(0, 5);
    sh.el.innerHTML = '<input class="input" id="kp-q" type="search" placeholder="Cari kategori" aria-label="Cari kategori" autocomplete="off"><div id="kp-box"></div>';
    var qEl = $('#kp-q', sh.el), box = $('#kp-box', sh.el);
    function draw() {
      var qRaw = qEl.value.trim(), q = qRaw.toLowerCase(), html = '';
      if (!q) {
        if (top.length) html += '<div class="kp-h">Sering dipakai</div><div class="chips wrap">' + top.map(function (k) {
          return '<button type="button" class="chip" data-k="' + esc(k.id) + '" aria-pressed="' + (f.kategori === k.id) + '" style="--c:' + k.warna + '"><span class="dot" style="background:' + k.warna + '"></span>' + esc(k.nama) + '</button>';
        }).join('') + '</div>';
        html += '<div class="kp-h">Semua kategori</div>';
      }
      var list = q ? all.filter(function (k) { return k.nama.toLowerCase().indexOf(q) >= 0; }) : all;
      html += list.length ? '<div class="list kp-list">' + list.map(function (k) {
        return '<button type="button" class="kp-row" data-k="' + esc(k.id) + '" style="--c:' + k.warna + '"><span class="dot"></span><span class="name">' + esc(k.nama) + '</span>' + (f.kategori === k.id ? '<span class="chk">✓</span>' : '') + '</button>';
      }).join('') + '</div>' : '<div class="empty">Tidak ada kategori "' + esc(qRaw) + '".</div>';
      if (opts.allowAdd) html += '<button type="button" class="btn ghost" id="kp-add" style="margin-top:12px">+ Kategori baru' + (qRaw ? ' "' + esc(qRaw) + '"' : '') + '</button>';
      box.innerHTML = html;
      $$('[data-k]', box).forEach(function (b) { b.addEventListener('click', function () { onPick(b.getAttribute('data-k')); sh.close(); }); });
      var add = $('#kp-add', box);
      if (add) add.addEventListener('click', function () { openKategoriSheet(null, f.tipe, f.buku, function (k) { onPick(k.id); sh.close(); }); });
    }
    qEl.addEventListener('input', draw);
    qEl.addEventListener('keydown', function (e) { if (e.key === 'Enter') { var first = $('.kp-list [data-k]', box); if (first) first.click(); } });
    draw();
  });
}

// ================= reimburse: tandai terbayar =================
function toggleBayar(t) {
  if (!t || !reimStatus(t)) return;
  if (!canWrite(t.buku)) { toast('Transaksi ini hanya bisa dilihat', true); return; }
  if (t.terbayar) {
    if (!confirm('Batalkan status terbayar? Catatan uang masuk otomatis ikut dihapus, dan pengeluaran ini dihitung lagi.')) return;
    enqueue('tx.reimburse', { id: t.id, bayar: false });
    toast('Kembali ke menunggu reimburse');
    return;
  }
  openBayarSheet(t);
}
function openBayarSheet(t, onDone) {
  var d = db();
  var ks = d.Kantong.filter(function (k) { return C.bool(k.aktif) && canWrite(k.buku); });
  var f = { kantong: ks.some(function (k) { return k.id === t.kantong; }) ? t.kantong : (ks[0] || {}).id, tanggal: todayISO() };
  openSheet('Reimburse sudah dibayar', function (sh) {
    sh.el.innerHTML = '<div class="reim-sum"><div class="t1">' + esc(t.keterangan || 'Pengeluaran') + '</div><div class="num big">' + rp(t.nominal) + '</div></div>' +
      '<div class="field"><span class="lbl">Uang masuk ke kantong</span><div class="chips wrap">' + ks.map(function (k) {
        return '<button type="button" class="chip" data-bk="' + esc(k.id) + '" aria-pressed="' + (f.kantong === k.id) + '" style="--c:' + bukuColor(k.buku) + '"><span class="dot" style="background:' + bukuColor(k.buku) + '"></span>' + esc(k.nama) + '</button>';
      }).join('') + '</div></div>' +
      '<div class="field"><label for="bt-tgl">Tanggal diterima</label><input id="bt-tgl" class="input" type="date" value="' + esc(f.tanggal) + '"></div>' +
      '<p class="hint">Pengeluaran ini keluar dari hitungan pengeluaran & budget. Saldo kantong bertambah ' + rp(t.nominal) + ' lewat 1 catatan otomatis, tidak dihitung sebagai pendapatan.</p>' +
      '<button type="button" class="btn" id="bt-save">Tandai sudah terbayar</button>';
    $$('[data-bk]', sh.el).forEach(function (b) { b.addEventListener('click', function () {
      f.kantong = b.getAttribute('data-bk');
      $$('[data-bk]', sh.el).forEach(function (x) { x.setAttribute('aria-pressed', String(x === b)); });
    }); });
    $('#bt-tgl', sh.el).addEventListener('change', function (e) { f.tanggal = e.target.value || todayISO(); });
    $('#bt-save', sh.el).addEventListener('click', function () {
      if (!f.kantong) { toast('Pilih kantong', true); return; }
      enqueue('tx.reimburse', { id: t.id, bayar: true, kantong: f.kantong, tanggal: f.tanggal });
      toast('Tandai terbayar: ' + rp(t.nominal));
      sh.close(); if (onDone) onDone();
    });
  });
}

// ================= talangan Rumah Tangga =================
// Belanja buku bersama yang dibayar pakai kantong pribadi, didaftar per transaksi.
// Saldo berjalan (lebih/kurang bayar) ikut dari S.boot.utang.
var TAL_MAX = 6;
function talPilih() { S.pilihTalangan = S.pilihTalangan || {}; return S.pilihTalangan; }
function talBuka() { S.talanganBuka = S.talanganBuka || {}; return S.talanganBuka; }

function talanganGrup(sel) {
  var cocok = function (bersama, pemilik) { return !sel || sel === 'all' || sel === bersama || sel === pemilik; };
  var grup = {}, urut = [];
  function slot(bersama, pemilik) {
    var k = bersama + '|' + pemilik;
    if (!grup[k]) { grup[k] = { key: k, bersama: bersama, pemilik: pemilik, items: [], saldo: 0 }; urut.push(k); }
    return grup[k];
  }
  ((S.boot && S.boot.talangan) || []).forEach(function (t) {
    if (!cocok(t.buku, t.pemilik)) return;
    slot(t.buku, t.pemilik).items.push(t);
  });
  ((S.boot && S.boot.utang) || []).forEach(function (u) {
    if (!cocok(u.dari, u.ke)) return;
    slot(u.dari, u.ke).saldo = u.jumlah;
  });
  return urut.map(function (k) { return grup[k]; })
    .filter(function (g) { return g.items.length || g.saldo; });
}

function talanganHtml(sel) {
  var pilih = talPilih(), buka = talBuka();
  var gs = talanganGrup(sel);
  if (!gs.length) return '';
  return gs.map(function (g) {
    var bersama = bukuById(g.bersama), pemilik = bukuById(g.pemilik);
    if (!bersama || !pemilik) return '';
    var bisa = canWrite(g.bersama);
    var dipilih = g.items.filter(function (t) { return pilih[t.id]; });
    var nDipilih = dipilih.reduce(function (s, t) { return s + t.nominal; }, 0);
    var totalSemua = g.items.reduce(function (s, t) { return s + t.nominal; }, 0);
    var semuaTercentang = g.items.length > 0 && dipilih.length === g.items.length;
    var terbuka = !!buka[g.key];
    var tampil = terbuka ? g.items : g.items.slice(0, TAL_MAX);

    var status = g.saldo > 0
      ? '<span class="t2">' + esc(bersama.nama) + ' masih harus ganti <b class="num">' + rp(g.saldo) + '</b> ke ' + esc(pemilik.nama) + '</span>'
      : g.saldo < 0
        ? '<span class="t2">' + esc(pemilik.nama) + ' pegang titipan ' + esc(bersama.nama) + ' <b class="num">' + rp(-g.saldo) + '</b>, otomatis dipakai buat belanja berikutnya</span>'
        : '<span class="t2">Sudah seimbang</span>';

    var rows = tampil.map(function (t) {
      var k = kategoriOf(t.kategori);
      var meta = [shortDate(t.tanggal)];
      if (k) meta.push(k.nama);
      if (t.oleh) meta.push(userName(t.oleh));
      return '<label class="tal-row' + (pilih[t.id] ? ' on' : '') + '">' +
        '<input type="checkbox" data-tal="' + esc(t.id) + '"' + (pilih[t.id] ? ' checked' : '') + (bisa ? '' : ' disabled') + '>' +
        '<span class="main"><span class="t1">' + esc(t.keterangan || (k ? k.nama : 'Belanja')) + '</span>' +
        '<span class="t2">' + esc(meta.join(' · ')) + '</span></span>' +
        '<span class="amt num">' + rp(t.nominal) + '</span></label>';
    }).join('');

    var sisa = g.items.length - tampil.length;
    var lebih = sisa > 0 ? '<button type="button" class="tal-more" data-tal-buka="' + esc(g.key) + '">Lihat ' + sisa + ' lainnya</button>'
      : (terbuka && g.items.length > TAL_MAX ? '<button type="button" class="tal-more" data-tal-buka="' + esc(g.key) + '">Ringkas lagi</button>' : '');

    var foot = '';
    if (g.items.length && bisa) {
      var kiri = dipilih.length
        ? '<span class="main"><b>' + dipilih.length + ' dipilih</b><span class="t2 num">' + rp(nDipilih) + '</span></span>'
        : '<span class="main"><span class="t2">Centang yang sudah ditransfer</span></span>';
      var tombolAll = '<button type="button" class="btn small ghost" data-tal-all="' + esc(g.key) + '">' +
        (semuaTercentang ? 'Batal pilih' : 'Pilih semua') + '</button>';
      var tombolLunas = dipilih.length
        ? '<button type="button" class="btn small" data-tal-lunas="' + esc(g.key) + '">Catat transfer</button>' : '';
      foot = '<div class="tal-foot">' + kiri + tombolAll + tombolLunas + '</div>';
    } else if (g.items.length) {
      foot = '<div class="tal-foot"><span class="main"><span class="t2">Hanya bisa kamu lihat</span></span></div>';
    }

    return '<section class="section"><div class="card tal">' +
      '<div class="tal-head"><div class="main"><h2>Talangan ' + esc(pemilik.nama) + ' buat ' + esc(bersama.nama) + '</h2>' + status + '</div>' +
      (g.items.length ? '<div class="amt num">' + rp(totalSemua) + '<span class="t2">' + g.items.length + ' belum ditandai</span></div>' : '') +
      '</div>' + (rows ? '<div class="tal-list">' + rows + '</div>' : '') + lebih + foot + '</div></section>';
  }).join('');
}

function renderTalangan(root, sel) {
  if (!root) return;
  root.innerHTML = talanganHtml(sel);
  var ulang = function () { renderTalangan(root, sel); };
  var pilih = talPilih();
  $$('[data-tal]', root).forEach(function (c) {
    c.addEventListener('change', function () {
      var id = c.getAttribute('data-tal');
      if (c.checked) pilih[id] = true; else delete pilih[id];
      ulang();
    });
  });
  $$('[data-tal-buka]', root).forEach(function (b) {
    b.addEventListener('click', function () {
      var k = b.getAttribute('data-tal-buka'), buka = talBuka();
      buka[k] = !buka[k]; ulang();
    });
  });
  $$('[data-tal-all]', root).forEach(function (b) {
    b.addEventListener('click', function () {
      var g = talanganGrup(sel).filter(function (x) { return x.key === b.getAttribute('data-tal-all'); })[0];
      if (!g) return;
      var semua = g.items.every(function (t) { return pilih[t.id]; });
      g.items.forEach(function (t) { if (semua) delete pilih[t.id]; else pilih[t.id] = true; });
      ulang();
    });
  });
  $$('[data-tal-lunas]', root).forEach(function (b) {
    b.addEventListener('click', function () {
      var g = talanganGrup(sel).filter(function (x) { return x.key === b.getAttribute('data-tal-lunas'); })[0];
      if (g) openLunasSheet(g, ulang);
    });
  });
}

function openLunasSheet(g, onDone) {
  var d = db(), pilih = talPilih();
  var items = g.items.filter(function (t) { return pilih[t.id]; });
  if (!items.length) { toast('Centang dulu transaksinya', true); return; }
  var total = items.reduce(function (s, t) { return s + t.nominal; }, 0);
  var bersama = bukuById(g.bersama), pemilik = bukuById(g.pemilik);
  var froms = d.Kantong.filter(function (k) { return k.buku === g.bersama && C.bool(k.aktif); });
  var tos = d.Kantong.filter(function (k) { return k.buku === g.pemilik && C.bool(k.aktif); });
  if (!froms.length) { toast('Buku ' + bersama.nama + ' belum punya kantong aktif', true); return; }
  if (!tos.length) { toast('Buku ' + pemilik.nama + ' belum punya kantong aktif', true); return; }
  var kantongTerakhir = items[items.length - 1].kantong;
  var f = {
    nominal: total,
    kantong: froms[0].id,
    kantong_tujuan: (tos.filter(function (k) { return k.id === kantongTerakhir; })[0] || tos[0]).id,
    tanggal: todayISO()
  };
  openSheet('Transfer ke ' + pemilik.nama, function (sh) {
    function draw() {
      var selisih = f.nominal - total;
      var chip = function (k, sel, attr) {
        return '<button type="button" class="chip" ' + attr + '="' + esc(k.id) + '" aria-pressed="' + (sel === k.id) + '" style="--c:' + bukuColor(k.buku) + '">' +
          '<span class="dot" style="background:' + bukuColor(k.buku) + '"></span>' + esc(k.nama) + '</button>';
      };
      sh.el.innerHTML =
        '<div class="reim-sum"><div class="t1">' + items.length + ' transaksi dicentang</div><div class="num big">' + rp(total) + '</div></div>' +
        '<label class="amount tf"><span>Rp</span><input id="ln-amt" inputmode="numeric" autocomplete="off" placeholder="0" aria-label="Nominal transfer" value="' + (f.nominal ? fmt(f.nominal) : '') + '"></label>' +
        '<div class="field"><span class="lbl">Uang keluar dari</span><div class="chips wrap">' + froms.map(function (k) { return chip(k, f.kantong, 'data-lf'); }).join('') + '</div></div>' +
        '<div class="field"><span class="lbl">Masuk ke kantong ' + esc(pemilik.nama) + '</span><div class="chips wrap">' + tos.map(function (k) { return chip(k, f.kantong_tujuan, 'data-lt'); }).join('') + '</div></div>' +
        '<div class="field"><label for="ln-tgl">Tanggal transfer</label><input id="ln-tgl" class="input" type="date" value="' + esc(f.tanggal) + '"></div>' +
        '<div class="hint">' + (
          selisih === 0 ? 'Nominal pas. Setelah dicatat, ' + items.length + ' transaksi ini hilang dari daftar talangan.'
          : selisih > 0 ? 'Lebih ' + rp(selisih) + ' dari total yang dicentang. Kelebihannya tercatat sebagai titipan ' + esc(bersama.nama) + ' di kantong ' + esc(pemilik.nama) + ', otomatis dipakai buat belanja berikutnya.'
          : 'Kurang ' + rp(-selisih) + ' dari total yang dicentang. Transaksinya tetap hilang dari daftar, sisanya jalan terus sebagai utang ' + esc(bersama.nama) + '.'
        ) + '</div>' +
        '<div class="err" id="ln-err" role="alert"></div>' +
        '<button type="button" class="btn" id="ln-save">Catat transfer</button>';

      var amt = $('#ln-amt', sh.el);
      amt.addEventListener('input', function () {
        f.nominal = parseNum(amt.value);
        amt.value = f.nominal ? fmt(f.nominal) : '';
        var h = $('.hint', sh.el), s2 = f.nominal - total;
        if (h) h.textContent = s2 === 0 ? 'Nominal pas. Setelah dicatat, ' + items.length + ' transaksi ini hilang dari daftar talangan.'
          : s2 > 0 ? 'Lebih ' + rp(s2) + ' dari total yang dicentang. Kelebihannya tercatat sebagai titipan ' + bersama.nama + ' di kantong ' + pemilik.nama + ', otomatis dipakai buat belanja berikutnya.'
          : 'Kurang ' + rp(-s2) + ' dari total yang dicentang. Transaksinya tetap hilang dari daftar, sisanya jalan terus sebagai utang ' + bersama.nama + '.';
      });
      $$('[data-lf]', sh.el).forEach(function (b) { b.addEventListener('click', function () { f.kantong = b.getAttribute('data-lf'); draw(); }); });
      $$('[data-lt]', sh.el).forEach(function (b) { b.addEventListener('click', function () { f.kantong_tujuan = b.getAttribute('data-lt'); draw(); }); });
      $('#ln-tgl', sh.el).addEventListener('change', function (e) { f.tanggal = e.target.value || todayISO(); });
      $('#ln-save', sh.el).addEventListener('click', function () {
        var errEl = $('#ln-err', sh.el);
        if (!(f.nominal > 0)) { errEl.textContent = 'Isi nominal transfernya dulu'; return; }
        if (f.kantong === f.kantong_tujuan) { errEl.textContent = 'Kantong asal dan tujuan tidak boleh sama'; return; }
        enqueue('talangan.lunas', {
          ids: items.map(function (t) { return t.id; }), nominal: f.nominal,
          kantong: f.kantong, kantong_tujuan: f.kantong_tujuan, tanggal: f.tanggal
        });
        items.forEach(function (t) { delete pilih[t.id]; });
        toast('Transfer dicatat: ' + rp(f.nominal));
        sh.close(); if (onDone) onDone();
      });
    }
    draw();
  });
}

// ================= transaksi form =================
function usageRank(buku) {
  var cnt = {};
  Object.keys(S.months).forEach(function (b) {
    (S.months[b].transaksi || []).forEach(function (t) {
      if (t.buku === buku) { cnt['k:' + t.kategori] = (cnt['k:' + t.kategori] || 0) + 1; cnt['w:' + t.kantong] = (cnt['w:' + t.kantong] || 0) + 1; }
    });
  });
  return cnt;
}
function defaultKantong(buku) {
  var last = S.prefs.lastKantong && S.prefs.lastKantong[buku];
  var ks = db().Kantong.filter(function (k) { return C.bool(k.aktif) && canWrite(k.buku); });
  if (last && ks.some(function (k) { return k.id === last; })) return last;
  var own = ks.filter(function (k) { return k.buku === buku; });
  return (own[0] || ks[0] || {}).id || '';
}
function txForm(root, init, opts) {
  opts = opts || {};
  var user = me();
  var f = Object.assign({
    id: '', tipe: 'Pengeluaran', nominal: 0, buku: user.buku, kategori: '', kantong: '', kantong_tujuan: '',
    tanggal: todayISO(), keterangan: '', reimburse: false, katAuto: false
  }, init || {});
  if (!f.kantong) f.kantong = defaultKantong(f.buku);
  var existing = init && init.id ? findTx(init.id) : null;

  function draw() {
    var d = db(), rank = usageRank(f.buku);
    var writable = C.writableBuku(d, user);
    var wallets = d.Kantong.filter(function (k) { return (C.bool(k.aktif) || k.id === f.kantong) && canWrite(k.buku); })
      .sort(function (a, b) { return (b.buku === f.buku) - (a.buku === f.buku) || (rank['w:' + b.id] || 0) - (rank['w:' + a.id] || 0) || a.urutan - b.urutan; });
    var dests = d.Kantong.filter(function (k) { return (C.bool(k.aktif) || k.id === f.kantong_tujuan) && k.id !== f.kantong; });
    var cls = f.tipe === 'Pemasukan' ? 'in' : f.tipe === 'Transfer' ? 'tf' : 'out';
    var walletChip = function (k, sel, attr) {
      return '<button type="button" class="chip" ' + attr + '="' + esc(k.id) + '" aria-pressed="' + (sel === k.id) + '" style="--c:' + bukuColor(k.buku) + '">' +
        '<span class="dot" style="background:' + bukuColor(k.buku) + '"></span>' + esc(k.nama) + (k.jenis === 'Kredit' ? ' <span class="faint">kredit</span>' : '') + '</button>';
    };
    root.innerHTML =
      '<div class="seg" role="group" aria-label="Tipe transaksi">' + C.TIPE_TX.map(function (t) {
        return '<button type="button" data-tipe="' + t + '" aria-pressed="' + (f.tipe === t) + '">' + t + '</button>';
      }).join('') + '</div>' +
      '<label class="amount ' + cls + '"><span>Rp</span><input id="f-amt" inputmode="numeric" autocomplete="off" placeholder="0" aria-label="Nominal" value="' + (f.nominal ? fmt(f.nominal) : '') + '"></label>' +
      reimBox() +
      '<div class="field"><label for="f-ket">Keterangan</label><input id="f-ket" class="input" maxlength="200" placeholder="mis. indomaret" autocomplete="off" value="' + esc(f.keterangan) + '"></div>' +
      (f.tipe !== 'Transfer' && writable.length > 1 ?
        '<div class="field"><span class="lbl">Buku</span><div class="chips" role="group">' + writable.map(function (b) {
          return '<button type="button" class="chip" data-fbuku="' + esc(b.id) + '" aria-pressed="' + (f.buku === b.id) + '" style="--c:' + bukuColor(b.id) + '"><span class="dot" style="background:' + bukuColor(b.id) + '"></span>' + (b.tipe === 'Bersama' ? esc(b.nama) : 'Pribadi') + '</button>';
        }).join('') + '</div></div>' : '') +
      (f.tipe !== 'Transfer' ? '<div class="field"><span class="lbl">Kategori</span>' + katBtnHtml() + '</div>' : '') +
      '<div class="field"><span class="lbl">' + (f.tipe === 'Transfer' ? 'Dari kantong' : f.tipe === 'Pemasukan' ? 'Masuk ke kantong' : 'Bayar pakai') + '</span><div class="chips" role="group">' +
        wallets.map(function (k) { return walletChip(k, f.kantong, 'data-wal'); }).join('') + '</div></div>' +
      (f.tipe === 'Transfer' ? '<div class="field"><span class="lbl">Ke kantong</span><div class="chips" role="group">' +
        dests.map(function (k) { return walletChip(k, f.kantong_tujuan, 'data-dst'); }).join('') + '</div></div>' : '') +
      '<div class="hint" id="f-hint"></div>' +
      '<div class="field"><label for="f-tgl">Tanggal</label><input id="f-tgl" class="input" type="date" value="' + esc(f.tanggal) + '"></div>' +
      (f.tipe === 'Pengeluaran' ? '<button type="button" class="field toggle" role="switch" id="f-reim" aria-checked="' + !!f.reimburse + '"><span><span style="display:block;font-weight:500">Akan di-reimburse</span><span class="faint" style="font-size:12px">' +
        (existing && existing.terbayar ? 'Sudah terbayar. Mematikan ini menghapus catatan uang masuk otomatis.' : 'Tetap dihitung sampai kamu tandai sudah terbayar') + '</span></span><span class="sw"></span></button>' : '') +
      '<div class="err" id="f-err" role="alert"></div>' +
      '<button type="button" class="btn" id="f-save">' + (existing ? 'Simpan perubahan' : 'Simpan') + '</button>' +
      (existing ? '<button type="button" class="btn danger" id="f-del">Hapus transaksi</button>' : '');

    var amt = $('#f-amt', root);
    amt.addEventListener('input', function () {
      f.nominal = parseNum(amt.value);
      amt.value = f.nominal ? fmt(f.nominal) : '';
    });
    amt.addEventListener('keydown', function (e) { if (e.key === 'Enter') save(); });
    $('#f-tgl', root).addEventListener('change', function (e) { f.tanggal = e.target.value || todayISO(); });
    $('#f-ket', root).addEventListener('input', function (e) { f.keterangan = e.target.value; applyGuess(); });
    $$('[data-tipe]', root).forEach(function (b) { b.addEventListener('click', function () {
      var t = b.getAttribute('data-tipe'); if (t === f.tipe) return;
      f.tipe = t; f.kategori = ''; f.katAuto = false; if (t === 'Transfer') f.reimburse = false; draw();
    }); });
    $$('[data-fbuku]', root).forEach(function (b) { b.addEventListener('click', function () {
      f.buku = b.getAttribute('data-fbuku'); f.kategori = ''; f.katAuto = false; f.kantong = defaultKantong(f.buku); draw();
    }); });
    bindKat();
    $$('[data-wal]', root).forEach(function (b) { b.addEventListener('click', function () {
      f.kantong = b.getAttribute('data-wal'); if (f.kantong === f.kantong_tujuan) f.kantong_tujuan = '';
      if (f.tipe === 'Transfer') draw(); else { mark(root, '[data-wal]', b); updateHint(); }
    }); });
    $$('[data-dst]', root).forEach(function (b) { b.addEventListener('click', function () { f.kantong_tujuan = b.getAttribute('data-dst'); mark(root, '[data-dst]', b); updateHint(); }); });
    var pb = $('#f-paybtn', root);
    if (pb) pb.addEventListener('click', function () {
      if (existing.terbayar) { toggleBayar(existing); if (opts.onDone) opts.onDone(); }
      else openBayarSheet(existing, function () { if (opts.onDone) opts.onDone(); });
    });
    var reim = $('#f-reim', root);
    if (reim) reim.addEventListener('click', function () { f.reimburse = !f.reimburse; reim.setAttribute('aria-checked', String(f.reimburse)); });
    updateHint();
    applyGuess();
    $('#f-save', root).addEventListener('click', save);
    var del = $('#f-del', root);
    if (del) del.addEventListener('click', function () {
      if (!confirm('Hapus transaksi ini?')) return;
      enqueue('tx.delete', { id: existing.id }); toast('Transaksi dihapus'); if (opts.onDone) opts.onDone();
    });
  }
  function katBtnHtml() {
    var k = f.kategori ? kategoriOf(f.kategori) : null;
    return '<button type="button" class="katbtn' + (k ? ' set' : '') + '" id="f-kat" aria-haspopup="dialog">' +
      (k ? '<span class="dot" style="background:' + k.warna + '"></span><span class="nm">' + esc(k.nama) + '</span>' + (f.katAuto ? '<span class="auto">otomatis</span>' : '') : '<span class="ph">Pilih kategori</span>') +
      ICON.right + '</button>';
  }
  function bindKat() {
    var b = $('#f-kat', root); if (!b) return;
    b.addEventListener('click', function () {
      openKategoriPicker(f, opts, function (id) { f.kategori = id; f.katAuto = false; updateKatBtn(); });
    });
  }
  function updateKatBtn() { var b = $('#f-kat', root); if (!b) return; b.outerHTML = katBtnHtml(); bindKat(); }
  function applyGuess() {
    if (f.tipe === 'Transfer' || (f.kategori && !f.katAuto)) return;
    var id = guessKategori(f.buku, f.tipe, f.keterangan);
    if (id && !katChoices(f.buku, f.tipe, '').some(function (k) { return k.id === id; })) id = '';
    if (id === f.kategori) return;
    f.kategori = id; f.katAuto = !!id; updateKatBtn();
  }
  function reimBox() {
    if (!existing || f.tipe !== 'Pengeluaran' || !f.reimburse || !C.bool(existing.reimburse)) return '';
    var paid = !!existing.terbayar;
    return '<div class="reim-box ' + (paid ? 'paid' : 'wait') + '"><div class="main"><b>' + (paid ? 'Sudah terbayar' : 'Menunggu reimburse') + '</b>' +
      '<span>' + (paid ? shortDate(existing.terbayar) + '. Tidak dihitung ke pengeluaran & budget.' : 'Masih dihitung ke pengeluaran & budget.') + '</span></div>' +
      '<button type="button" class="btn small ' + (paid ? 'ghost' : '') + '" id="f-paybtn">' + (paid ? 'Batalkan' : 'Tandai terbayar') + '</button></div>';
  }
  function updateHint() {
    var el = $('#f-hint', root); if (!el) return;
    var msg = '', kmap = C.byId(db().Kantong), b = bukuById(f.buku);
    if (f.tipe === 'Pengeluaran' && b && b.tipe === 'Bersama') {
      var k = kmap[f.kantong], kb = k ? bukuById(k.buku) : null;
      if (kb && kb.tipe === 'Pribadi') msg = 'Dibayar pakai uang ' + kb.nama + '. ' + b.nama + ' tercatat berutang ke ' + kb.nama + ' sampai diganti.';
    } else if (f.tipe === 'Transfer') {
      var a = kmap[f.kantong], z = kmap[f.kantong_tujuan], ab = a ? bukuById(a.buku) : null, zb = z ? bukuById(z.buku) : null;
      if (ab && zb && ab.tipe === 'Pribadi' && zb.tipe === 'Bersama') msg = 'Setoran ke ' + zb.nama + '. Dihitung sebagai pengeluaran ' + ab.nama + ' dan pemasukan ' + zb.nama + '. Di tampilan semua buku tidak dihitung dua kali.';
      else if (ab && zb && ab.tipe === 'Bersama' && zb.tipe === 'Pribadi') msg = 'Penggantian ke ' + zb.nama + '. Bukan pengeluaran baru, jadi tidak dobel.';
    }
    el.textContent = msg; el.style.display = msg ? '' : 'none';
  }
  function mark(scope, sel, btn) { $$(sel, scope).forEach(function (x) { x.setAttribute('aria-pressed', String(x === btn)); }); }
  function save() {
    var errEl = $('#f-err', root);
    var payload = {
      id: f.id || uid(), tanggal: f.tanggal, tipe: f.tipe, nominal: f.nominal, buku: f.buku,
      kategori: f.kategori, kantong: f.kantong, kantong_tujuan: f.kantong_tujuan,
      keterangan: f.keterangan, reimburse: f.reimburse
    };
    if (f.tipe === 'Transfer') payload.buku = C.bukuOfKantong(db(), f.kantong);
    try { payload = C.cleanTx(payload, db(), me(), existing); }
    catch (e) { errEl.textContent = e.message; return; }
    errEl.textContent = '';
    S.prefs.lastKantong = S.prefs.lastKantong || {};
    if (f.tipe !== 'Transfer') S.prefs.lastKantong[f.buku] = f.kantong;
    enqueue('tx.save', payload);
    toast(existing ? 'Perubahan disimpan' : 'Tersimpan ' + rp(payload.nominal));
    if (opts.onDone) opts.onDone(payload);
    if (!existing) { f.id = ''; f.nominal = 0; f.keterangan = ''; f.kategori = ''; f.katAuto = false; f.reimburse = false; draw(); }
  }
  draw();
}

function openTxSheet(t) {
  if (!t) return;
  var editable = canWrite(t.buku) && !t._pending && t.sumber !== 'auto';
  openSheet(editable ? 'Ubah transaksi' : 'Detail transaksi', function (sh) {
    if (editable) { txForm(sh.el, t, { onDone: function () { sh.close(); } }); return; }
    var k = kategoriOf(t.kategori), b = bukuById(t.buku);
    var rows = [['Tipe', t.tipe], ['Nominal', rp(t.nominal)], ['Tanggal', dayLabel(t.tanggal) + ' (' + t.tanggal + ')'],
      ['Buku', b ? b.nama : t.buku]];
    if (t.tipe === 'Transfer') rows.push(['Dari', kantongLabel(t.kantong)], ['Ke', kantongLabel(t.kantong_tujuan)]);
    else rows.push(['Kategori', k ? k.nama : '-'], ['Kantong', kantongLabel(t.kantong)]);
    rows.push(['Keterangan', t.keterangan || '-'], ['Dicatat oleh', userName(t.oleh)]);
    if (t.sumber === 'import') rows.push(['Catatan', 'Data lama, tanggal perkiraan']);
    sh.el.innerHTML = (t._pending ? '' : '<div class="readonly-note">' + ICON.lock + '<span>' + (t.sumber === 'auto' ? 'Dibuat otomatis saat reimburse ditandai terbayar. Batalkan lewat transaksi reimburse aslinya.' : 'Hanya bisa dilihat. Transaksi ini ada di buku ' + esc(b ? b.nama : '') + '.') + '</span></div>') +
      '<div class="list">' + rows.map(function (r) {
        return '<div class="wallet"><div class="main"><div class="t2">' + esc(r[0]) + '</div><div class="t1">' + esc(r[1]) + '</div></div></div>';
      }).join('') + '</div>';
  });
}
