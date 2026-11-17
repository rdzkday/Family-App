/* Shell bersama: Beranda, Kantong, Agenda.
   Skrip biasa (bukan modul): nama top-level dipakai bersama file js/ lain. Urutan muat ada di tiap index.html halaman. */
'use strict';

// ================= views =================
var view = null;
function renderShell() {
  var app = $('#app');
  if (!S.conn) { renderConnect(); return; }
  if (PAGE !== 'kantong') { renderBerandaShell(app); return; }
  app.innerHTML = (S.conn.mode === 'demo' ? '<div class="demo-bar">Mode demo, data contoh. <button data-act="leave-demo">Keluar</button></div>' : '') +
    '<main id="view" class="view"></main>' +
    '<footer class="tabbar"><nav>' + [['home', 'Catat', ICON.home], ['ringkasan', 'Ringkasan', ICON.chart], ['riwayat', 'Riwayat', ICON.list]].map(function (x) {
      return '<button data-tab="' + x[0] + '" aria-current="' + (S.tab === x[0] ? 'page' : 'false') + '">' + x[2] + x[1] + '</button>';
    }).join('') + '</nav></footer>';
  $$('[data-tab]', app).forEach(function (b) { b.addEventListener('click', function () { goTab(b.getAttribute('data-tab')); }); });
  renderView();
}
function goTab(id) {
  S.tab = id; S.sub = null;
  $$('[data-tab]').forEach(function (x) { x.setAttribute('aria-current', x.getAttribute('data-tab') === id ? 'page' : 'false'); });
  renderView(); window.scrollTo(0, 0);
}
function renderView() {
  if (PAGE === 'beranda' && !S.boot) { $('#view').innerHTML = '<div class="br-wrap"><div class="br-card br-skel"></div><div class="br-card br-skel"></div></div>'; return; }
  if (!S.boot) { $('#view').innerHTML = '<div class="topbar"><div><h1>Memuat data…</h1></div></div>' + skeleton(5); return; }
  if (!S.bukuView) S.bukuView = me().buku;
  var v = PAGE === 'beranda' ? BerandaView
    : PAGE === 'pengaturan' ? PengaturanView
    : PAGE === 'agenda' ? ({ todo: TodoView, catatan: CatatanView, jadwal: JadwalView }[S.tab] || TodoView)
    : ({ home: HomeView, ringkasan: RingkasanView, riwayat: RiwayatView }[S.tab] || HomeView);
  if (PAGE === 'agenda' || PAGE === 'pengaturan') $('#view').classList.add('br-narrow');
  view = v; v.render($('#view'));
}
function refresh() {
  if (!S.conn || !$('#view')) { if (!S.conn) renderConnect(); return; }
  if (!view || !S.boot) { renderView(); return; }
  if (view.update) view.update($('#view')); else view.render($('#view'));
}
document.addEventListener('click', function (e) {
  var t = e.target.closest('[data-act]'); if (!t) return;
  var a = t.getAttribute('data-act');
  if (a === 'sync') sync();
  if (a === 'theme') { setTheme(isDark() ? 'light' : 'dark'); t.outerHTML = themeBtn(); }
  if (a === 'leave-demo') { if (confirm('Keluar dari mode demo?')) disconnect(); }
  if (a === 'goto-todo') location.href = ROOT + 'agenda/';
  if (a === 'beranda') location.href = ROOT || './';
});

