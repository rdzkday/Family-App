/* Kantong — Mulai app.
   Skrip biasa (bukan modul): nama top-level dipakai bersama file js/ lain. Urutan muat ada di index.html & kantong.html. */
'use strict';

// ================= start =================
window.addEventListener('online', function () { sync(); });
if (PAGE === 'beranda' && window.matchMedia) matchMedia('(min-width: 900px)').addEventListener('change', function () { if (S.tab === 'beranda' && view && view.update && $('#view')) view.update($('#view')); });
document.addEventListener('visibilitychange', function () { if (document.visibilityState === 'visible') sync(); });
setInterval(function () { if (document.visibilityState === 'visible' && (S.outbox.length || !S.lastSync || Date.now() - S.lastSync > 120000)) sync(); }, 30000);
if ('serviceWorker' in navigator && location.protocol === 'https:') navigator.serviceWorker.register('sw.js').catch(function () {});
// data demo versi lama (sebelum to-do) dibuang sekali supaya contoh to-do ikut muncul
if (LS.get('k_ver', null) !== 'v6') {
  if (S.conn && S.conn.mode === 'demo') {
    ['k_conn', 'k_boot', 'k_months', 'k_outbox', 'k_demo', 'k_todos', 'k_komitmen'].forEach(LS.del);
    S.conn = null; S.boot = null; S.months = {}; S.outbox = []; S.todos = null;
  }
  LS.set('k_ver', 'v6');
}
if (!S.conn && window.KANTONG_PREVIEW) S.conn = { mode: 'demo' };   // file preview
renderShell();
if (S.conn) sync();
window.__kantong = S;   // untuk debugging
