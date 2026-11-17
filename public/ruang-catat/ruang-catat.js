/* Ruang Catat: jurnal harian + mood. Pakai koneksi & mode demo yang sama dengan Beranda/Kantong (localStorage).
   Mood bisa datang dari Beranda lewat ?mood=berat|lelah|biasa|baik|senang. Jurnal pribadi: hanya pemiliknya yang bisa baca. */
(function () {
  'use strict';
  var C = KantongCore;
  var $ = function (s, el) { return (el || document).querySelector(s); };
  var $$ = function (s, el) { return Array.prototype.slice.call((el || document).querySelectorAll(s)); };
  var esc = function (s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); };
  var LS = {
    get: function (k, d) { try { var v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch (e) { return d; } },
    set: function (k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* penuh */ } }
  };
  var pad = function (n) { return String(n).padStart(2, '0'); };
  function todayISO() { var d = new Date(); return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); }
  function nowIso() {
    var d = new Date(), off = -d.getTimezoneOffset();
    return todayISO() + 'T' + pad(d.getHours()) + ':' + pad(d.getMinutes()) + ':' + pad(d.getSeconds()) + (off >= 0 ? '+' : '-') + pad(Math.floor(Math.abs(off) / 60)) + ':' + pad(Math.abs(off) % 60);
  }
  function uid() { return 'j-' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7); }
  var BULAN = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
  var HARI = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
  function tglLabel(iso) {
    if (iso === todayISO()) return 'Hari ini';
    var p = iso.split('-'), d = new Date(+p[0], +p[1] - 1, +p[2]);
    return HARI[d.getDay()] + ', ' + d.getDate() + ' ' + BULAN[d.getMonth()] + (d.getFullYear() !== new Date().getFullYear() ? ' ' + d.getFullYear() : '');
  }
  function toast(msg, bad) { var el = $('#toast'); el.textContent = msg; el.className = 'toast show' + (bad ? ' bad' : ''); clearTimeout(toast.t); toast.t = setTimeout(function () { el.className = 'toast'; }, 2400); }

  var MOODS = [['berat', 'Berat', '#F87171', 'M8 16.5c1.2-1.6 2.5-2.3 4-2.3s2.8.7 4 2.3'], ['lelah', 'Lelah', '#FB923C', 'M8.5 15.5c1-.7 2.2-1 3.5-1s2.5.3 3.5 1'],
    ['biasa', 'Biasa', '#FCD34D', 'M8.5 15h7'], ['baik', 'Baik', '#86EFAC', 'M8.5 14.5c1 .8 2.2 1.2 3.5 1.2s2.5-.4 3.5-1.2'], ['senang', 'Senang', '#7DD3A8', 'M8 13.5c1 2 2.4 3 4 3s3-1 4-3']];
  function moodOf(id) { return MOODS.filter(function (m) { return m[0] === id; })[0] || null; }
  function face(m) { return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M9 9.8v.4M15 9.8v.4"/><path d="' + m[3] + '"/></svg>'; }
  var BACK = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 6l-6 6 6 6"/></svg>';
  var LOCK = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="5" y="11" width="14" height="9" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/></svg>';

  // ---------- data ----------
  var conn = LS.get('k_conn', null), boot = LS.get('k_boot', null);
  var S = { list: LS.get('k_jurnal', null), outbox: LS.get('k_jurnal_outbox', []), mood: '', isi: '' };
  var q = new URLSearchParams(location.search).get('mood');
  if (moodOf(q)) S.mood = q;
  function persist() { LS.set('k_jurnal', S.list); LS.set('k_jurnal_outbox', S.outbox); }

  function demoCall(action, payload) {
    var tables = LS.get('k_demo', null) || {};
    var store = C.memoryStore(tables);
    var users = store.all('Users');
    var prefs = LS.get('k_prefs', {}), u = users.filter(function (x) { return x.id === prefs.demoUser; })[0] || users[0];
    if (!u) return Promise.reject(new Error('Data demo belum ada. Buka Beranda dulu.'));
    try { var out = C.handle(store, { id: u.id, nama: u.nama, buku: u.buku }, action, payload, nowIso()); LS.set('k_demo', store.data); return Promise.resolve(out); }
    catch (e) { return Promise.reject(e); }
  }
  function rpc(action, payload) {
    if (conn.mode === 'demo') return demoCall(action, payload);
    return fetch(conn.api, { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify({ token: conn.token, action: action, payload: payload || {} }) })
      .then(function (r) { if (!r.ok) throw new Error('Server membalas ' + r.status); return r.json(); }, function () { var e = new Error('Tidak ada koneksi'); e.offline = true; throw e; })
      .then(function (j) { if (!j.ok) { var e = new Error(j.error || 'Gagal'); e.server = true; throw e; } return j.data; });
  }
  var syncing = false;
  function sync() {
    if (syncing) return; syncing = true;
    var ops = S.outbox.slice();
    var batch = ops.map(function (o) { return { opId: o.opId, action: o.action, payload: o.payload }; }).concat([{ opId: '_list', action: 'jurnal.list' }]);
    rpc('batch', { ops: batch }).then(function (d) {
      var sent = {}; ops.forEach(function (o) { sent[o.opId] = 1; });
      d.results.forEach(function (r) {
        if (r.opId === '_list') { if (r.ok) S.list = r.data.jurnal; else S.serverLama = true; }
        else if (!r.ok) toast('Tidak tersimpan: ' + r.error, true);
      });
      S.outbox = S.outbox.filter(function (o) { return !sent[o.opId]; });
      S.outbox.forEach(applyLocal);
      persist();
    }).catch(function () { /* offline: coba lagi nanti */ }).then(function () { syncing = false; renderList(); });
  }
  function applyLocal(op) {
    var list = S.list || [];
    if (op.action === 'jurnal.save') {
      list = list.filter(function (j) { return j.id !== op.payload.id; });
      list.unshift(Object.assign({ pemilik: boot && boot.user ? boot.user.id : '', dibuat: op.at }, op.payload, { _pending: true }));
    } else if (op.action === 'jurnal.delete') list = list.filter(function (j) { return j.id !== op.payload.id; });
    S.list = list;
  }
  function enqueue(action, payload) {
    var op = { opId: uid(), action: action, payload: payload, at: nowIso() };
    S.outbox.push(op); applyLocal(op); persist(); renderList(); sync();
  }

  // ---------- tampilan ----------
  function render() {
    var root = $('#rc');
    if (!conn) {
      root.innerHTML = '<div class="connect"><h1>Ruang Catat</h1><p class="sub">Hubungkan app dulu di Beranda.</p><p><a href="../">Buka Beranda</a></p></div>';
      return;
    }
    root.innerHTML = '<header><a class="back" href="../">' + BACK + 'Beranda</a><h1>Ruang Catat</h1><p class="sub">Tulis apa yang kamu rasakan hari ini. Pelan-pelan saja.</p></header>' +
      '<section class="card" aria-label="Tulis catatan hari ini"><p class="q" id="q">Gimana rasanya hari ini?</p><div class="moods" role="radiogroup" aria-labelledby="q" id="moods"></div>' +
      '<textarea id="isi" maxlength="10000" placeholder="Apa yang terjadi? Apa yang kamu butuhkan?" aria-label="Isi catatan"></textarea>' +
      '<div class="err" id="err" role="alert"></div>' +
      '<div class="row"><span class="note">' + LOCK + 'Hanya kamu yang bisa membaca catatan ini.</span><button class="btn" id="save">Simpan</button></div></section>' +
      '<section class="card" aria-labelledby="h-list"><h2 id="h-list">Catatan sebelumnya</h2><div id="list"></div></section>';
    renderMoods();
    var isi = $('#isi'); isi.value = S.isi;
    isi.addEventListener('input', function () { S.isi = isi.value; });
    $('#save').addEventListener('click', simpan);
    renderList();
    if (S.mood) setTimeout(function () { isi.focus(); }, 100);
  }
  function renderMoods() {
    var box = $('#moods');
    box.innerHTML = MOODS.map(function (m) {
      return '<button type="button" role="radio" aria-checked="' + (S.mood === m[0]) + '" data-m="' + m[0] + '" style="--c:' + m[2] + '">' + face(m) + '<span>' + m[1] + '</span></button>';
    }).join('');
    $$('[data-m]', box).forEach(function (b) { b.addEventListener('click', function () {
      var m = b.getAttribute('data-m'); S.mood = S.mood === m ? '' : m; renderMoods(); var nb = $('[data-m="' + m + '"]', box); if (nb) nb.focus();
    }); });
  }
  function simpan() {
    var payload = { id: uid(), tanggal: todayISO(), mood: S.mood, isi: S.isi.trim() };
    if (!payload.mood && !payload.isi) { $('#err').textContent = 'Pilih mood atau tulis sesuatu dulu.'; return; }
    $('#err').textContent = '';
    enqueue('jurnal.save', payload);
    S.isi = ''; S.mood = ''; $('#isi').value = ''; renderMoods();
    if (history.replaceState) history.replaceState(null, '', location.pathname);
    toast('Tersimpan. Terima kasih sudah jujur sama diri sendiri.');
  }
  function renderList() {
    var box = $('#list'); if (!box) return;
    if (S.serverLama && S.list === null) { box.innerHTML = '<p class="empty">Server belum diperbarui untuk Ruang Catat. Catatan tersimpan di HP dulu dan dikirim setelah server siap.</p>'; return; }
    if (S.list === null) { box.innerHTML = '<p class="empty">Memuat…</p>'; return; }
    if (!S.list.length) { box.innerHTML = '<p class="empty">Belum ada catatan. Yang pertama tidak harus panjang.</p>'; return; }
    box.innerHTML = S.list.slice(0, 60).map(function (j) {
      var m = moodOf(j.mood) || ['', 'Tanpa mood', '#9AA3B2', 'M8.5 15h7'];
      return '<article class="entry" style="--c:' + m[2] + '"><span class="m" title="' + esc(m[1]) + '">' + face(m) + '</span><div class="b"><div class="d">' + esc(tglLabel(j.tanggal)) + ' · ' + esc(m[1]) + (j._pending ? ' · belum terkirim' : '') + '</div>' +
        (j.isi ? '<p>' + esc(j.isi) + '</p>' : '') + '</div><button class="x" data-del="' + esc(j.id) + '" aria-label="Hapus catatan ' + esc(tglLabel(j.tanggal)) + '">Hapus</button></article>';
    }).join('');
    $$('[data-del]', box).forEach(function (b) { b.addEventListener('click', function () {
      if (confirm('Hapus catatan ini?')) { enqueue('jurnal.delete', { id: b.getAttribute('data-del') }); toast('Catatan dihapus'); }
    }); });
  }

  render();
  if (conn) {
    sync();
    window.addEventListener('online', sync);
    document.addEventListener('visibilitychange', function () { if (document.visibilityState === 'visible') sync(); });
  }
  if ('serviceWorker' in navigator && location.protocol === 'https:') navigator.serviceWorker.register('../sw.js', { scope: '../' }).catch(function () {});
})();
