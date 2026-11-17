/* Kantong — Layar hubungkan & putuskan.
   Skrip biasa (bukan modul): nama top-level dipakai bersama file js/ lain. Urutan muat ada di index.html & kantong.html. */
'use strict';

// ================= connect =================
function renderConnect() {
  var app = $('#app');
  app.innerHTML = '<div class="connect"><img class="logo" src="icons/icon-animated.svg" alt=""><h1>Kantong</h1>' +
    '<p>Catatan keuangan dan to-do rumah tangga. Tempel kode koneksi untuk mulai.</p>' +
    '<div class="field"><label for="code">Kode koneksi</label><textarea id="code" class="input" placeholder="Tempel kode koneksi (lihat kantong/PANDUAN.md)" autocomplete="off" spellcheck="false"></textarea></div>' +
    '<div class="err" id="c-err"></div><button class="btn" id="connect">Hubungkan</button>' +
    '<button class="btn ghost" id="demo" style="margin-top:12px">Coba mode demo</button></div>';
  $('#connect').addEventListener('click', function () {
    var raw = $('#code').value.trim(), conn, btn = this;
    try {
      var b64 = raw.replace(/-/g, '+').replace(/_/g, '/');
      while (b64.length % 4) b64 += '=';
      var o = JSON.parse(atob(b64));
      // API = Supabase Edge Function (…/functions/v1/kantong)
      if (!/^https:\/\/[^\s/]+\.[^\s/]+\//.test(o.api) || typeof o.token !== 'string' || o.token.length < 20) throw new Error();
      conn = { mode: 'remote', api: o.api, token: o.token };
    } catch (e) { $('#c-err').textContent = 'Kode tidak dikenali. Salin ulang kode koneksi (Supabase: hasil kantong_buat_kode).'; return; }
    btn.disabled = true; btn.textContent = 'Menghubungkan…';
    rpc('bootstrap', {}, conn).then(function (boot) {
      S.conn = conn; S.boot = boot; S.months = {}; S.outbox = []; S.todos = null; S.bukuView = null; persist(); renderShell(); sync();
    }, function (e) {
      btn.disabled = false; btn.textContent = 'Hubungkan';
      $('#c-err').textContent = e.code === 'AUTH' ? 'Kode akses ditolak server.' : e.message;
    });
  });
  $('#demo').addEventListener('click', function () {
    S.conn = { mode: 'demo' }; S.boot = null; S.months = {}; S.outbox = []; S.todos = null; S.bukuView = null; persist(); renderShell(); sync();
  });
}
function disconnect() {
  ['k_conn', 'k_boot', 'k_months', 'k_outbox', 'k_demo', 'k_todos', 'k_komitmen'].forEach(LS.del);
  demoStore = null;
  S.conn = null; S.boot = null; S.months = {}; S.outbox = []; S.todos = null; S.sub = null; S.tab = PAGE === 'beranda' ? 'beranda' : 'home'; S.bukuView = null;
  renderConnect();
}
