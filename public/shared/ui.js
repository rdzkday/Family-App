/* Kantong — Komponen UI: sheet, tab, toast, baris transaksi.
   Skrip biasa (bukan modul): nama top-level dipakai bersama file js/ lain. Urutan muat ada di tiap index.html halaman. */
'use strict';

// ================= UI primitives =================
function agoLabel(ts) {
  var sec = Math.round((Date.now() - ts) / 1000);
  if (sec < 60) return 'baru saja';
  if (sec < 3600) return Math.floor(sec / 60) + ' mnt lalu';
  return new Date(ts).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
}
var toastTimer;
function toast(msg, bad) {
  var el = $('#toast'); el.textContent = msg; el.className = 'toast show' + (bad ? ' bad' : '');
  clearTimeout(toastTimer); toastTimer = setTimeout(function () { el.className = 'toast' + (bad ? ' bad' : ''); }, bad ? 4200 : 2200);
}
function syncPill() {
  var n = S.outbox.length, cls = 'sync', label;
  if (S.syncing) { cls += ' busy'; label = 'Sinkron…'; }
  else if (n) { cls += S.lastError ? ' offline' : ' pending'; label = n + ' belum terkirim'; }
  else if (S.lastError) { cls += ' offline'; label = 'Offline'; }
  else label = S.conn && S.conn.mode === 'demo' ? 'Demo' : 'Tersinkron' + (S.lastSync ? ' · ' + agoLabel(S.lastSync) : '');
  return '<button class="' + cls + '" data-act="sync" aria-label="Sinkronkan sekarang"><i></i>' + label + '</button>';
}
function renderSync() { $$('.sync').forEach(function (el) { el.outerHTML = syncPill(); }); }

var sheetStack = [], ignorePop = 0;
function openSheet(title, build) {
  var scrim = document.createElement('div'); scrim.className = 'scrim';
  var sh = document.createElement('div'); sh.className = 'sheet'; sh.setAttribute('role', 'dialog'); sh.setAttribute('aria-modal', 'true');
  sh.innerHTML = '<div class="grab"></div><div class="sheet-h"><h3>' + esc(title) + '</h3>' +
    '<button class="iconbtn" data-close aria-label="Tutup">✕</button></div><div class="sheet-b"></div>';
  document.body.appendChild(scrim); document.body.appendChild(sh);
  var api = {
    el: $('.sheet-b', sh),
    close: function (fromPop) {
      if (api.closed) return; api.closed = true;
      sh.classList.remove('show'); scrim.classList.remove('show');
      setTimeout(function () { sh.remove(); scrim.remove(); }, 260);
      sheetStack = sheetStack.filter(function (x) { return x !== api; });
      if (!fromPop && history.state && history.state.sheet) { ignorePop++; history.back(); }
    }
  };
  scrim.addEventListener('click', function () { api.close(); });
  $('[data-close]', sh).addEventListener('click', function () { api.close(); });
  sheetStack.push(api);
  history.pushState({ sheet: sheetStack.length }, '');
  build(api);
  requestAnimationFrame(function () { scrim.classList.add('show'); sh.classList.add('show'); });
  return api;
}
window.addEventListener('popstate', function () {
  if (ignorePop > 0) { ignorePop--; return; }
  if (sheetStack.length) { sheetStack[sheetStack.length - 1].close(true); return; }
  if (S.sub) { S.sub = null; renderView(); }
});
function goSub(sub) { S.sub = sub; history.pushState({ sub: 1 }, ''); renderView(); window.scrollTo(0, 0); }
function backSub() { if (history.state && history.state.sub) history.back(); else { S.sub = null; renderView(); } }

function bukuTabs(withAll) {
  var list = db().Buku.slice().sort(function (a, b) { return a.urutan - b.urutan; });
  var html = list.map(function (b) {
    return '<button data-buku="' + esc(b.id) + '" aria-pressed="' + (S.bukuView === b.id) + '" style="--c:' + bukuColor(b.id) + '"><i></i>' + esc(b.nama) + '</button>';
  }).join('');
  if (withAll) html += '<button data-buku="all" aria-pressed="' + (S.bukuView === 'all') + '">Semua</button>';
  return '<div class="buku-tabs" role="group" aria-label="Pilih buku">' + html + '</div>';
}
function monthBar() {
  var first = (S.boot && S.boot.bulan && S.boot.bulan.length) ? S.boot.bulan[S.boot.bulan.length - 1] : thisMonth();
  return '<div class="monthbar"><button class="iconbtn" data-month="-1" aria-label="Bulan sebelumnya"' + (S.bulan <= first ? ' disabled' : '') + '>' + ICON.left + '</button>' +
    '<strong>' + monthName(S.bulan) + '</strong>' +
    '<button class="iconbtn" data-month="1" aria-label="Bulan berikutnya"' + (S.bulan >= thisMonth() ? ' disabled' : '') + '>' + ICON.right + '</button></div>';
}
function monthData(b) { return S.months[b || S.bulan]; }
function ensureMonth(b) { if (!monthData(b)) sync([b]); return monthData(b); }
function skeleton(n) { var s = ''; for (var i = 0; i < (n || 4); i++) s += '<div class="skeleton"></div>'; return s; }

function kantongLabel(id) { var k = C.byId(db().Kantong)[id]; return k ? k.nama : id; }
function kategoriOf(id) { return C.byId(db().Kategori)[id]; }
// pengeluaran dihitung kecuali reimburse yang sudah terbayar
function isCounted(t) { return t.tipe === 'Pengeluaran' && !(C.bool(t.reimburse) && t.terbayar); }
// setoran ke dompet bersama ikut dihitung ke pengeluaran & budget,
// tapi porsinya biasanya jauh lebih besar dari pos lain sehingga donut jadi susah dibaca
function showSetoran() { return !!S.prefs.showSetoran; }
function setSetoran(v) { S.prefs.showSetoran = !!v; persist(); }
function reimStatus(t) { if (t.tipe !== 'Pengeluaran' || !C.bool(t.reimburse)) return ''; return t.terbayar ? 'paid' : 'wait'; }
function shortDate(iso) { var p = String(iso).split('-'); return p.length === 3 ? (+p[2]) + ' ' + BULAN[+p[1] - 1].slice(0, 3) : iso; }

function txRow(t, ctxBuku) {
  var k = kategoriOf(t.kategori), color, letter, amtCls = '', sign = '−';
  if (t.tipe === 'Transfer') {
    color = '#C7D3FF'; letter = ICON.swap; amtCls = 'tf'; sign = '';
    if (ctxBuku && ctxBuku !== 'all') sign = t.buku === ctxBuku ? '−' : '+';
  } else {
    color = k ? k.warna : '#94A3B8'; letter = esc(((k ? k.nama : '?')[0] || '?').toUpperCase());
    if (t.tipe === 'Pemasukan') { amtCls = 'in'; sign = '+'; }
    if (reimStatus(t) === 'paid') amtCls += ' dim';
  }
  var title = t.keterangan || (t.tipe === 'Transfer' ? 'Transfer' : (k ? k.nama : 'Transaksi'));
  var meta = [];
  if (t.tipe === 'Transfer') meta.push(esc(kantongLabel(t.kantong) + ' ke ' + kantongLabel(t.kantong_tujuan)));
  else {
    if (t.keterangan && k) meta.push(esc(k.nama));
    meta.push(esc(kantongLabel(t.kantong)));
  }
  var tags = '';
  if (!ctxBuku || ctxBuku === 'all' || t.buku !== ctxBuku) {
    var b = bukuById(t.buku); if (b) tags += '<span class="tag" style="--c:' + bukuColor(b.id) + '"><i></i>' + esc(b.nama) + '</span>';
  }
  if (t.oleh && me() && t.oleh !== me().id) tags += '<span class="tag">oleh ' + esc(userName(t.oleh)) + '</span>';
  var rs = reimStatus(t);
  if (rs === 'wait') tags += '<span class="tag wait">Menunggu reimburse</span>';
  if (rs === 'paid') tags += '<span class="tag paid">Sudah terbayar</span>';
  if (t.sumber === 'auto') tags += '<span class="tag">Otomatis</span>';
  if (t._pending) tags += '<span class="tag" style="color:var(--accent)">belum terkirim</span>';
  return '<button class="tx" data-tx="' + esc(t.id) + '"><span class="ic" style="--c:' + color + '">' + letter + '</span>' +
    '<span class="main"><span class="t1 sr">' + esc(title) + '</span><span class="t2">' + meta.join('<span class="faint">/</span>') + tags + '</span></span>' +
    '<span class="amt num ' + amtCls + '">' + sign + fmt(t.nominal) + '</span>' +
    (rs && canWrite(t.buku) ? '<span class="paychk" data-pay="' + esc(t.id) + '" role="checkbox" aria-checked="' + (rs === 'paid') + '" aria-label="Sudah terbayar"></span>' : '') + '</button>';
}
function txGroups(list, ctxBuku) {
  if (!list.length) return '<div class="list"><div class="empty">Belum ada transaksi.</div></div>';
  var by = {};
  list.forEach(function (t) { (by[t.tanggal] = by[t.tanggal] || []).push(t); });
  return Object.keys(by).sort().reverse().map(function (d) {
    var items = by[d].sort(function (a, b) { return String(b.dibuat || b.id).localeCompare(String(a.dibuat || a.id)); });
    var out = items.reduce(function (s, t) { return s + (isCounted(t) ? t.nominal : 0); }, 0);
    return '<div class="day"><div class="day-h"><span>' + dayLabel(d) + '</span><span class="num">' + (out ? '−' + fmt(out) : '') + '</span></div>' +
      '<div class="list">' + items.map(function (t) { return txRow(t, ctxBuku); }).join('') + '</div></div>';
  }).join('');
}
function bindTxRows(root) {
  $$('[data-tx]', root).forEach(function (el) {
    el.addEventListener('click', function (e) {
      var t = findTx(el.getAttribute('data-tx'));
      if (e.target.closest && e.target.closest('[data-pay]')) { e.stopPropagation(); toggleBayar(t); return; }
      openTxSheet(t);
    });
  });
}

// tombol saklar (dipakai form Kantong, Agenda)
function toggleHtml(id, label, sub, on) {
  return '<button type="button" class="field toggle" role="switch" id="' + id + '" aria-checked="' + !!on + '"><span><span style="display:block;font-weight:500">' + label + '</span>' + (sub ? '<span class="faint" style="font-size:12px">' + sub + '</span>' : '') + '</span><span class="sw"></span></button>';
}
function bindToggle(el, id, obj, key) {
  var t = $('#' + id, el); if (!t) return;
  t.addEventListener('click', function () { obj[key] = !obj[key]; t.setAttribute('aria-checked', String(obj[key])); });
}
