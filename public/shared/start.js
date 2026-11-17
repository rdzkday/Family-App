/* Kantong — Mulai app.
   Skrip biasa (bukan modul): nama top-level dipakai bersama file js/ lain. Urutan muat ada di tiap index.html halaman. */
'use strict';

// ================= start =================
window.addEventListener('online', function () { sync(); });
if (PAGE === 'beranda' && window.matchMedia) matchMedia('(min-width: 900px)').addEventListener('change', function () { if (S.tab === 'beranda' && view && view.update && $('#view')) view.update($('#view')); });
document.addEventListener('visibilitychange', function () { if (document.visibilityState === 'visible') sync(); });
setInterval(function () { if (document.visibilityState === 'visible' && (S.outbox.length || !S.lastSync || Date.now() - S.lastSync > 120000)) sync(); }, 30000);
if ('serviceWorker' in navigator && location.protocol === 'https:') navigator.serviceWorker.register(ROOT + 'sw.js').catch(function () {});
// v8: mode demo dimulai kosong. Data contoh lama di HP dibuang sekali (akun asli tidak tersentuh).
if (LS.get('k_ver', null) !== 'v8') {
  if (S.conn && S.conn.mode === 'demo') {
    ['k_boot', 'k_months', 'k_outbox', 'k_demo', 'k_todos', 'k_komitmen', 'k_km_demo', 'k_siklus'].forEach(LS.del);
    S.boot = null; S.months = {}; S.outbox = []; S.todos = null; S.siklus = null;
  }
  LS.set('k_ver', 'v8');
}
if (!S.conn && window.KANTONG_PREVIEW) S.conn = { mode: 'demo' };   // file preview
S.tab = tabDariHash();
renderShell();
if (S.conn) sync();
window.__kantong = S;   // untuk debugging
