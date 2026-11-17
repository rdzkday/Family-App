/* Kantong — Layar login & keluar.
   Skrip biasa (bukan modul): nama top-level dipakai bersama file js/ lain. Urutan muat ada di tiap index.html halaman. */
'use strict';

// ================= login =================
// Alamat API (Supabase Edge Function). Bisa ditimpa window.KANTONG_API untuk staging.
var API_URL = window.KANTONG_API || 'https://serskylzlevhjidqrvjm.supabase.co/functions/v1/kantong';

function renderConnect() {
  var app = $('#app');
  app.innerHTML = '<form class="connect" id="login" novalidate><img class="logo" src="' + ROOT + 'icons/icon-animated.svg" alt=""><h1>Family App</h1>' +
    '<p>Masuk untuk melihat keuangan dan agenda rumah tangga.</p>' +
    '<div class="field"><label for="l-user">Username</label><input id="l-user" class="input" name="username" autocomplete="username" autocapitalize="none" spellcheck="false" required></div>' +
    '<div class="field"><label for="l-pass">Password</label><div style="display:flex;gap:8px;align-items:stretch">' +
      '<input id="l-pass" class="input" type="password" name="password" autocomplete="current-password" required style="flex:1;min-width:0">' +
      '<button type="button" id="l-show" class="btn ghost" aria-label="Tampilkan password" style="width:auto;margin:0;padding:0 16px;flex:none">Lihat</button>' +
    '</div></div>' +
    '<div class="err" id="c-err" role="alert" aria-live="polite"></div><button class="btn" id="connect" type="submit">Masuk</button>' +
    '<button class="btn ghost" id="demo" type="button" style="margin-top:12px">Coba mode demo</button></form>';
  var u = $('#l-user'), pw = $('#l-pass'), err = $('#c-err');
  u.focus();
  $('#l-show').addEventListener('click', function () {
    var lihat = pw.type === 'password';
    pw.type = lihat ? 'text' : 'password';
    this.textContent = lihat ? 'Sembunyi' : 'Lihat';
    this.setAttribute('aria-label', lihat ? 'Sembunyikan password' : 'Tampilkan password');
  });
  $('#login').addEventListener('submit', function (ev) {
    ev.preventDefault();
    var username = u.value.trim().toLowerCase(), password = pw.value, btn = $('#connect');
    if (!username || !password) { err.textContent = 'Isi username dan password.'; (username ? pw : u).focus(); return; }
    err.textContent = ''; btn.disabled = true; btn.textContent = 'Masuk…';
    var base = { mode: 'remote', api: API_URL, token: '' };
    rpc('login', { username: username, password: password }, base).then(function (d) {
      var conn = { mode: 'remote', api: API_URL, token: d.token };
      return rpc('bootstrap', {}, conn).then(function (boot) {
        S.conn = conn; S.boot = boot; S.months = {}; S.outbox = []; S.todos = null; S.bukuView = null; persist(); renderShell(); sync();
      });
    }).catch(function (e) {
      btn.disabled = false; btn.textContent = 'Masuk';
      err.textContent = e.offline ? 'Tidak ada koneksi internet.' : e.message;
      pw.value = ''; pw.focus();
    });
  });
  $('#demo').addEventListener('click', function () {
    S.conn = { mode: 'demo' }; S.boot = null; S.months = {}; S.outbox = []; S.todos = null; S.bukuView = null; persist(); renderShell(); sync();
  });
}
function disconnect() {
  if (S.conn && S.conn.mode === 'remote') rpc('logout', {}).catch(function () {});   // cabut sesi perangkat ini
  ['k_conn', 'k_boot', 'k_months', 'k_outbox', 'k_demo', 'k_todos', 'k_komitmen'].forEach(LS.del);
  demoStore = null;
  S.conn = null; S.boot = null; S.months = {}; S.outbox = []; S.todos = null; S.sub = null; S.tab = PAGE === 'beranda' ? 'beranda' : PAGE === 'agenda' ? 'todo' : 'home'; S.bukuView = null;
  renderConnect();
}
