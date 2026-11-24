/* Shell bersama halaman berbasis core: Beranda, Kantong, Agenda, Pengaturan.
   Skrip biasa (bukan modul): nama top-level dipakai bersama file js/ lain. Urutan muat ada di tiap index.html halaman. */
'use strict';

// ================= halaman & tab =================
// HALAMAN & daftarHalaman ada di base.js (dimuat sebelum modul fitur).
function tabDariHash() {
  var h = HALAMAN[PAGE]; if (!h) return PAGE;
  var t = location.hash.slice(1); t = h.alias[t] || t;
  return h.tabs.some(function (x) { return x[0] === t; }) ? t : h.tabs[0][0];
}
function tabSeg() {
  var h = HALAMAN[PAGE]; if (!h || h.tabs.length < 2) return '';
  return '<div class="seg page-tabs" role="tablist" aria-label="Bagian">' + h.tabs.map(function (x) {
    return '<button type="button" role="tab" data-brgo="' + x[0] + '" aria-selected="' + (S.tab === x[0]) + '" aria-pressed="' + (S.tab === x[0]) + '">' + x[1] + '</button>';
  }).join('') + '</div>';
}
// header standar halaman fitur: tombol kembali + nama fitur (dari registry) + tab
function fiturHead(sub, aksi) { var f = Fitur.info(PAGE); return pageHead(f ? f.nama : '', sub, aksi) + tabSeg(); }
function bukaTab(id) {
  var h = HALAMAN[PAGE]; if (!h) return;
  if (!h.tabs.some(function (x) { return x[0] === id; })) id = h.tabs[0][0];
  S.tab = id; S.sub = null;
  var hash = id === h.tabs[0][0] ? '' : id;
  if (location.hash.slice(1) !== hash) history.replaceState(history.state, '', hash ? '#' + hash : location.pathname);
  renderView(); window.scrollTo(0, 0);
}
document.addEventListener('click', function (e) {
  var a = e.target.closest('[data-brgo]'); if (!a || !HALAMAN[PAGE]) return;
  e.preventDefault(); bukaTab(a.getAttribute('data-brgo'));
});
window.addEventListener('hashchange', function () {
  if (HALAMAN[PAGE] && tabDariHash() !== S.tab) bukaTab(tabDariHash());
  if (PAGE === 'pengaturan') bukaPengaturanDariHash();
});

// ================= shell =================
// Bar demo + konten + menu bawah. Menu & penjaga halaman dari registry fitur (shared/fitur.js).
var view = null, navSig = '';
function fiturSig() { return Fitur.daftar().map(function (f) { return f.id; }).join(','); }
function renderShell() {
  var app = $('#app');
  if (!S.conn) { renderConnect(); return; }
  document.body.classList.add('br-page');
  navSig = fiturSig();
  app.innerHTML = (S.conn.mode === 'demo' ? '<div class="demo-bar">Mode demo, data hanya di HP ini. <button data-act="leave-demo">Keluar</button></div>' : '') +
    '<main id="view" class="br-view' + (PAGE === 'beranda' ? '' : ' br-narrow') + '"></main>' + Fitur.navHtml(PAGE);
  renderView();
  if (typeof Onboarding !== 'undefined') Onboarding.otomatis();   // pengenalan fitur, sekali per HP
}
function renderView() {
  var el = $('#view'); if (!el) return;
  if (Fitur.info(PAGE) && !Fitur.aktif(PAGE)) { view = null; Fitur.jaga(PAGE, $('#app')); return; }
  if (PAGE === 'beranda' && !S.boot) { el.innerHTML = '<div class="br-wrap"><div class="br-card br-skel"></div><div class="br-card br-skel"></div></div>'; return; }
  if (!S.boot) { el.innerHTML = pageHead('Memuat…') + skeleton(5); return; }
  if (!S.bukuView) S.bukuView = me().buku;
  var h = HALAMAN[PAGE];
  var v = PAGE === 'beranda' ? BerandaView : PAGE === 'pengaturan' ? PengaturanView
    : (h.tabs.filter(function (x) { return x[0] === S.tab; })[0] || h.tabs[0])[2];
  view = v; v.render(el);
}
function refresh() {
  if (!S.conn) { renderConnect(); return; }
  if (fiturSig() !== navSig) { renderShell(); return; }   // admin baru mengubah fitur aktif
  if (!$('#view')) return;
  if (!view || !S.boot) { renderView(); return; }
  if (view.update) view.update($('#view')); else view.render($('#view'));
}
document.addEventListener('click', function (e) {
  var t = e.target.closest('[data-act]'); if (!t) return;
  var a = t.getAttribute('data-act');
  if (a === 'sync') sync();
  if (a === 'theme') { setTheme(isDark() ? 'light' : 'dark'); t.outerHTML = themeBtn(); }
  if (a === 'leave-demo') { if (confirm('Keluar dari mode demo?')) disconnect(); }
});

