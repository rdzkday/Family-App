/* Kantong — Tab Ringkasan & Riwayat.
   Skrip biasa (bukan modul): nama top-level dipakai bersama file js/ lain. Urutan muat ada di tiap index.html halaman. */
'use strict';

// ---------- Ringkasan ----------
function donut(items, total, label) {
  var r = 15.915, off = 0, segs = '';
  var top = items.filter(function (x) { return x.total > 0; });
  if (top.length > 7) { var rest = top.slice(6).reduce(function (s, x) { return s + x.total; }, 0); top = top.slice(0, 6).concat([{ total: rest, warna: '#D5DCE6' }]); }
  top.forEach(function (x) {
    var p = total ? x.total / total * 100 : 0;
    segs += '<circle cx="18" cy="18" r="' + r + '" fill="none" stroke="' + x.warna + '" stroke-width="4.2" stroke-dasharray="' + Math.max(0.1, p - 4).toFixed(2) + ' ' + (100 - Math.max(0.1, p - 4)).toFixed(2) + '" stroke-dashoffset="' + (-off).toFixed(2) + '"/>';
    off += p;
  });
  return '<div class="donut"><svg viewBox="0 0 36 36" aria-hidden="true"><circle cx="18" cy="18" r="' + r + '" fill="none" stroke="var(--surface-2)" stroke-width="4.2"/>' + segs + '</svg>' +
    '<div class="center"><small>' + esc(label || 'Pengeluaran') + '</small><b class="num">' + compact(total) + '</b></div></div>';
}
function compact(n) {
  var a = Math.abs(n);
  if (a >= 1e9) return (n / 1e9).toFixed(1).replace('.', ',') + ' M';
  if (a >= 1e6) return (n / 1e6).toFixed(a >= 1e7 ? 1 : 2).replace('.', ',') + ' jt';
  if (a >= 1e3) return Math.round(n / 1e3) + ' rb';
  return fmt(n);
}
function walletsHtml(bukuSel) {
  var d = db(), saldo = (S.boot && S.boot.saldo) || {};
  var ks = d.Kantong.filter(function (k) { return C.bool(k.aktif) && (bukuSel === 'all' || k.buku === bukuSel); });
  if (!ks.length) return '<div class="list"><div class="empty">Belum ada kantong.</div></div>';
  var total = 0;
  var rows = ks.map(function (k) {
    var v = saldo[k.id] || 0; total += v;
    var sub = k.jenis + (k.jenis === 'Kredit' && k.limit ? ', sisa limit ' + rp(k.limit + v) : '');
    if (bukuSel === 'all') sub = (bukuById(k.buku) || {}).nama + ', ' + sub;
    return '<button class="wallet" data-kantong="' + esc(k.id) + '"><span class="ic" style="width:10px;height:10px;border-radius:3px;background:' + bukuColor(k.buku) + '"></span><span class="main"><span class="t1" style="display:block">' + esc(k.nama) + '</span><span class="t2">' + esc(sub) + '</span></span><span class="amt num' + (v < 0 ? ' neg' : '') + '">' + rp(v) + '</span></button>';
  }).join('');
  return '<div class="list">' + rows + '</div><div class="total-row"><span>Total bersih</span><span class="num" style="color:var(--text);font-weight:700">' + rp(total) + '</span></div>';
}
function bindNav(el, render) {
  $$('[data-buku]', el).forEach(function (b) { b.addEventListener('click', function () { S.bukuView = b.getAttribute('data-buku'); render(); }); });
  $$('[data-month]', el).forEach(function (b) { b.addEventListener('click', function () { S.bulan = shiftMonth(S.bulan, +b.getAttribute('data-month')); render(); }); });
}
function readonlyNote() {
  if (S.bukuView === 'all' || canWrite(S.bukuView)) return '';
  var b = bukuById(S.bukuView);
  return '<div class="readonly-note">' + ICON.lock + '<span>Buku ' + esc(b ? b.nama : '') + ' hanya bisa kamu lihat.</span></div>';
}
var RingkasanView = {
  render: function (el) {
    if (S.sub && S.sub.type === 'cat') return CatDetail.render(el);
    var self = this;
    el.innerHTML = fiturHead(longToday()) + bukuTabs(true) + monthBar() + '<div id="rk"></div>';
    bindNav(el, function () { self.render(el); });
    this.update(el);
  },
  update: function (el) {
    if (S.sub && S.sub.type === 'cat') return CatDetail.render(el);
    var box = $('#rk', el); if (!box) return this.render(el);
    var m = ensureMonth(S.bulan);
    if (!m) { box.innerHTML = skeleton(5); return; }
    var d = db(), s = C.summarize(d, m.transaksi, m.budget, S.bukuView);
    var used = s.budgetTotal ? Math.min(1, s.pengeluaran / s.budgetTotal) : 0;
    // setoran boleh disembunyikan dari grafik saja; rincian kategori dan angka total tetap utuh
    var sembunyiSetoran = s.setoran > 0 && !showSetoran();
    var donutItems = sembunyiSetoran
      ? s.perKategori.filter(function (k) { return k.id !== C.KAT_SETORAN; }) : s.perKategori;
    var donutTotal = sembunyiSetoran ? s.pengeluaran - s.setoran : s.pengeluaran;
    var donutLabel = sembunyiSetoran ? 'Di luar setoran' : 'Pengeluaran';
    var setoranNote = s.setoran > 0
      ? '<button type="button" class="setoran-note" data-setoran>' +
        (sembunyiSetoran
          ? 'Setoran ke dompet bersama <b class="num">' + rp(s.setoran) + '</b> tidak ikut grafik, tapi tetap masuk total dan budget. <span class="lnk">Tampilkan</span>'
          : 'Setoran ke dompet bersama <b class="num">' + rp(s.setoran) + '</b> ikut grafik. <span class="lnk">Sembunyikan</span>') +
        '</button>' : '';
    var extra = [];
    if (s.transferMasuk) extra.push(['Transfer masuk', '+' + fmt(s.transferMasuk)]);
    if (s.transferKeluar) extra.push(['Transfer keluar', '−' + fmt(s.transferKeluar)]);
    if (s.reimburseMenunggu) extra.push(['Menunggu reimburse (sudah dihitung)', fmt(s.reimburseMenunggu)]);
    if (s.reimburse) extra.push(['Sudah terbayar (tidak dihitung)', fmt(s.reimburse)]);
    box.innerHTML = readonlyNote() + '<div id="rk-tal"></div>' +
      '<div class="card overview">' + donut(donutItems, donutTotal, donutLabel) + setoranNote +
      '<div class="stats"><div class="stat"><small>Pemasukan</small><b class="num in">' + rp(s.pemasukan) + '</b></div>' +
      '<div class="stat"><small>Pengeluaran</small><b class="num">' + rp(s.pengeluaran) + '</b></div>' +
      '<div class="stat"><small>Selisih</small><b class="num' + (s.selisih < 0 ? ' over' : '') + '">' + rp(s.selisih) + '</b></div></div></div>' +
      (extra.length ? '<div class="list" style="margin-top:12px">' + extra.map(function (x) { return '<div class="wallet" style="min-height:44px;padding:10px 0"><span class="main muted" style="font-size:13px">' + x[0] + '</span><span class="num" style="font-size:14px;font-weight:600">' + x[1] + '</span></div>'; }).join('') + '</div>' : '') +
      '<section class="section"><div class="card"><div class="budget-head"><span class="muted">Sisa budget</span><span class="big num' + (s.sisaBudget < 0 ? ' over' : '') + '">' + (s.budgetTotal ? rp(s.sisaBudget) : '-') + '</span></div>' +
      (s.budgetTotal ? '<div class="meter' + (s.sisaBudget < 0 ? ' over' : '') + '"><i style="width:' + (used * 100).toFixed(1) + '%"></i></div><div class="budget-foot"><span>Terpakai ' + Math.round(s.pengeluaran / s.budgetTotal * 100) + '%</span><span>Budget ' + rp(s.budgetTotal) + '</span></div>'
        : '<div class="faint" style="font-size:13px">Belum ada budget untuk bulan ini. Atur di Pengaturan, Budget bulanan.</div>') + '</div></section>' +
      '<section class="section"><div class="section-h"><h2>Per kategori</h2><span class="aside">ketuk untuk rincian</span></div><div class="list">' +
      (s.perKategori.length ? s.perKategori.map(function (k) {
        var ratio = k.budget ? Math.min(1, k.total / k.budget) : (s.pengeluaran ? k.total / s.pengeluaran : 0);
        var over = k.budget && k.total > k.budget;
        return '<button class="cat" data-cat="' + esc(k.id) + '" style="--c:' + k.warna + '"><span class="cat-top"><span class="dot"></span><span class="name">' + esc(k.nama) + '</span><span class="pct num">' + Math.round(k.pct * 100) + '%</span><span class="val num">' + rp(k.total) + '</span></span>' +
          '<span class="meter' + (over ? ' over' : '') + '" style="display:block"><i style="width:' + (ratio * 100).toFixed(1) + '%"></i></span>' +
          '<span class="cat-sub"><span>' + (k.budget ? 'Budget ' + rp(k.budget) : 'Tanpa budget') + (k.sub && k.sub.length > 1 ? ' · ' + k.sub.length + ' sub' : '') + '</span>' +
          (k.budget ? '<span class="' + (over ? 'over' : '') + '">' + (over ? 'Lewat ' + rp(-k.sisa) : 'Sisa ' + rp(k.sisa)) + '</span>' : '<span></span>') + '</span></button>';
      }).join('') : '<div class="empty">Belum ada pengeluaran.</div>') + '</div></section>' +
      (s.perMasuk.length ? '<section class="section"><div class="section-h"><h2>Pemasukan</h2></div><div class="list">' + s.perMasuk.map(function (k) {
        return '<button class="cat" data-cat="' + esc(k.id) + '" style="--c:' + k.warna + '"><span class="cat-top" style="margin:0"><span class="dot"></span><span class="name">' + esc(k.nama) + '</span><span class="val num" style="color:var(--in)">' + rp(k.total) + '</span></span></button>';
      }).join('') + '</div></section>' : '') +
      '<section class="section"><div class="section-h"><h2>Saldo kantong</h2><span class="aside">saat ini</span></div>' + walletsHtml(S.bukuView) + '</section>';
    renderTalangan($('#rk-tal', box), S.bukuView);
    var self2 = this;
    $$('[data-setoran]', box).forEach(function (b) {
      b.addEventListener('click', function () { setSetoran(!showSetoran()); self2.update(el); });
    });
    $$('[data-cat]', box).forEach(function (b) { b.addEventListener('click', function () { goSub({ type: 'cat', id: b.getAttribute('data-cat') }); }); });
    $$('[data-kantong]', box).forEach(function (b) { b.addEventListener('click', function () { openKantongSheet(C.byId(db().Kantong)[b.getAttribute('data-kantong')]); }); });
  }
};

// rincian per sub-kategori (hanya kalau kategori ini induk & transaksinya tersebar ke sub)
function rincianSubHtml(id, list, total) {
  var per = {};
  list.forEach(function (t) { per[t.kategori] = (per[t.kategori] || 0) + t.nominal; });
  var ids = Object.keys(per);
  if (!ids.length || (ids.length === 1 && ids[0] === id)) return '';
  return '<section class="section"><div class="section-h"><h2>Per sub-kategori</h2></div><div class="list">' + ids.sort(function (a, b) { return per[b] - per[a]; }).map(function (kid) {
    var k = kategoriOf(kid) || { nama: kid, warna: '#94A3B8' };
    var pct = total ? per[kid] / total : 0;
    return '<div class="cat" style="--c:' + k.warna + '"><span class="cat-top"><span class="dot"></span><span class="name">' + esc(kid === id ? k.nama + ' (umum)' : k.nama) + '</span><span class="pct num">' + Math.round(pct * 100) + '%</span><span class="val num">' + rp(per[kid]) + '</span></span>' +
      '<span class="meter" style="display:block"><i style="width:' + (pct * 100).toFixed(1) + '%"></i></span></div>';
  }).join('') + '</div></section>';
}
var CatDetail = {
  render: function (el) {
    var id = S.sub.id, k = kategoriOf(id) || { nama: 'Tanpa kategori', warna: '#94A3B8', tipe: 'Pengeluaran' };
    el.innerHTML = pageHead('<span style="display:inline-block;width:12px;height:12px;border-radius:4px;margin-right:10px;vertical-align:middle;background:' + k.warna + '"></span>' + esc(k.nama),
      monthName(S.bulan) + ', buku ' + esc(S.bukuView === 'all' ? 'semua' : (bukuById(S.bukuView) || {}).nama), '', 'href="#" data-back aria-label="Kembali ke Ringkasan"') + '<div id="cd"></div>';
    $('[data-back]', el).addEventListener('click', function (e) { e.preventDefault(); backSub(); });
    var m = ensureMonth(S.bulan), box = $('#cd', el);
    if (!m) { box.innerHTML = skeleton(4); return; }
    var d = db();
    // induk: ikut transaksi semua sub-nya
    var kmapD = C.byId(d.Kategori);
    var semua = m.transaksi.filter(function (t) { return (t.kategori === id || C.indukDari(kmapD, t.kategori) === id) && (S.bukuView === 'all' || t.buku === S.bukuView); });
    var dihitung = function (t) { return t.tipe === 'Pengeluaran' ? isCounted(t) : t.tipe === 'Pemasukan'; };
    // filter per dompet: hanya dompet yang punya transaksi di kategori ini bulan ini
    var perDompet = {}, urutDompet = [];
    semua.forEach(function (t) {
      if (!perDompet.hasOwnProperty(t.kantong)) { perDompet[t.kantong] = 0; urutDompet.push(t.kantong); }
      if (dihitung(t)) perDompet[t.kantong] += t.nominal;
    });
    urutDompet.sort(function (a, b) { return perDompet[b] - perDompet[a]; });
    var fk = S.sub.kantong && perDompet.hasOwnProperty(S.sub.kantong) ? S.sub.kantong : '';
    var list = fk ? semua.filter(function (t) { return t.kantong === fk; }) : semua;
    var total = list.filter(dihitung).reduce(function (s, t) { return s + t.nominal; }, 0);
    var totalSemua = semua.filter(dihitung).reduce(function (s, t) { return s + t.nominal; }, 0);
    var bud = 0;
    // budget berlaku per kategori, bukan per dompet: meter hanya tampil tanpa filter
    if (!fk) Object.keys(m.budget || {}).forEach(function (b) { if (S.bukuView === 'all' || b === S.bukuView) bud += (m.budget[b].items || {})[id] || 0; });
    var over = bud && total > bud;
    var chips = urutDompet.length > 1 ? '<div class="chips" style="margin-bottom:12px" role="group" aria-label="Filter dompet">' +
      '<button type="button" class="chip" data-fk="" aria-pressed="' + !fk + '">Semua dompet</button>' +
      urutDompet.map(function (kid) {
        return '<button type="button" class="chip" data-fk="' + esc(kid) + '" aria-pressed="' + (fk === kid) + '">' + esc(kantongLabel(kid)) + ' <span class="num" style="opacity:.7">' + compact(perDompet[kid]) + '</span></button>';
      }).join('') + '</div>' : '';
    box.innerHTML = chips + '<div class="card"><div class="budget-head"><span class="muted">' + (k.tipe === 'Pemasukan' ? 'Total masuk' : 'Total keluar') + '</span><span class="big num">' + rp(total) + '</span></div>' +
      (bud ? '<div class="meter' + (over ? ' over' : '') + '" style="--c:' + k.warna + '"><i style="width:' + (Math.min(1, total / bud) * 100).toFixed(1) + '%"></i></div>' +
        '<div class="budget-foot"><span>Budget ' + rp(bud) + '</span><span style="' + (over ? 'color:var(--over)' : '') + '">' + (over ? 'Lewat ' + rp(total - bud) : 'Sisa ' + rp(bud - total)) + '</span></div>' : '') +
      '<div class="budget-foot"><span>' + list.length + ' transaksi' + (fk ? ' di ' + esc(kantongLabel(fk)) : '') + '</span><span>' +
        (fk && totalSemua ? Math.round(total / totalSemua * 100) + '% dari ' + rp(totalSemua) : '') + '</span></div></div>' + rincianSubHtml(id, list.filter(dihitung), total) + txGroups(list, S.bukuView);
    $$('[data-fk]', box).forEach(function (b) {
      b.addEventListener('click', function () { S.sub.kantong = b.getAttribute('data-fk'); CatDetail.render(el); });
    });
    bindTxRows(box);
  }
};

// ---------- Riwayat ----------
var RiwayatView = {
  q: '', onlyWait: false,
  render: function (el) {
    var self = this;
    el.innerHTML = fiturHead(longToday()) + bukuTabs(true) + monthBar() +
      '<input class="input" id="q" type="search" placeholder="Cari keterangan atau kategori" value="' + esc(this.q) + '" aria-label="Cari">' +
      '<div class="chips wrap" style="margin-top:10px"><button type="button" class="chip" id="rw-wait" aria-pressed="' + this.onlyWait + '">Menunggu reimburse</button></div>' +
      '<div id="rw"></div>';
    bindNav(el, function () { self.render(el); });
    $('#q', el).addEventListener('input', function (e) { self.q = e.target.value; self.update(el); });
    $('#rw-wait', el).addEventListener('click', function () { self.onlyWait = !self.onlyWait; this.setAttribute('aria-pressed', String(self.onlyWait)); self.update(el); });
    this.update(el);
  },
  update: function (el) {
    var box = $('#rw', el); if (!box) return this.render(el);
    var m = ensureMonth(S.bulan);
    if (!m) { box.innerHTML = skeleton(6); return; }
    var d = db(), q = this.q.trim().toLowerCase();
    var list = m.transaksi.filter(function (t) {
      if (!C.txInBuku(d, t, S.bukuView)) return false;
      if (RiwayatView.onlyWait && reimStatus(t) !== 'wait') return false;
      if (!q) return true;
      var k = kategoriOf(t.kategori);
      return (t.keterangan + ' ' + (k ? k.nama : '') + ' ' + kantongLabel(t.kantong)).toLowerCase().indexOf(q) >= 0;
    });
    box.innerHTML = readonlyNote().replace('class="readonly-note"', 'class="readonly-note" style="margin:16px 0 0"') + txGroups(list, S.bukuView);
    bindTxRows(box);
  }
};
