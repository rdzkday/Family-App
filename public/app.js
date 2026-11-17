/* Kantong PWA — vanilla JS, tanpa build step. */
(function () {
  'use strict';
  var C = KantongCore;

  // ================= util =================
  var $ = function (s, el) { return (el || document).querySelector(s); };
  var $$ = function (s, el) { return Array.prototype.slice.call((el || document).querySelectorAll(s)); };
  var esc = function (s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  };
  var NF = new Intl.NumberFormat('id-ID');
  var fmt = function (n) { return NF.format(Math.round(Math.abs(n || 0))); };
  var rp = function (n) { return (n < 0 ? '−' : '') + 'Rp ' + fmt(n); };
  var parseNum = function (s) { return Number(String(s || '').replace(/[^0-9]/g, '')) || 0; };
  var LS = {
    get: function (k, d) { try { var v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch (e) { return d; } },
    set: function (k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* storage penuh/terblokir */ } },
    del: function (k) { try { localStorage.removeItem(k); } catch (e) { /* abaikan */ } }
  };
  var pad = function (n) { return String(Math.floor(Math.abs(n))).padStart(2, '0'); };
  function todayISO() { var d = new Date(); return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); }
  function thisMonth() { return todayISO().slice(0, 7); }
  function nowIso() {
    var d = new Date(), off = -d.getTimezoneOffset();
    return todayISO() + 'T' + pad(d.getHours()) + ':' + pad(d.getMinutes()) + ':' + pad(d.getSeconds()) +
      (off >= 0 ? '+' : '-') + pad(off / 60) + ':' + pad(off % 60);
  }
  function uid() {
    if (window.crypto && crypto.randomUUID) return crypto.randomUUID();
    return 'id-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 10);
  }
  var BULAN = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
  var HARI = ['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab'];
  var HARI_P = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
  function monthName(b) { var p = b.split('-'); return BULAN[+p[1] - 1] + ' ' + p[0]; }
  function shiftMonth(b, n) { var p = b.split('-'); var d = new Date(+p[0], +p[1] - 1 + n, 1); return d.getFullYear() + '-' + pad(d.getMonth() + 1); }
  function dateObj(iso) { var p = iso.split('-'); return new Date(+p[0], +p[1] - 1, +p[2]); }
  function dayLabel(iso) {
    var t = todayISO();
    if (iso === t) return 'Hari ini';
    if (iso === C.addDays(t, -1)) return 'Kemarin';
    var d = dateObj(iso);
    return HARI[d.getDay()] + ', ' + d.getDate() + ' ' + BULAN[d.getMonth()].slice(0, 3);
  }
  function longToday() { var d = new Date(); return HARI_P[d.getDay()] + ', ' + d.getDate() + ' ' + BULAN[d.getMonth()]; }

  var ICON = {
    home: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 5v14M5 12h14"/><rect x="3" y="3" width="18" height="18" rx="6"/></svg>',
    chart: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3a9 9 0 1 0 9 9h-9z"/><path d="M15 3.5A9 9 0 0 1 20.5 9H15z"/></svg>',
    list: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M8 6h12M8 12h12M8 18h12"/><circle cx="4" cy="6" r="1"/><circle cx="4" cy="12" r="1"/><circle cx="4" cy="18" r="1"/></svg>',
    gear: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M4 7h10M18 7h2M4 17h4M12 17h8"/><circle cx="16" cy="7" r="2"/><circle cx="10" cy="17" r="2"/></svg>',
    left: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 6l-6 6 6 6"/></svg>',
    right: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 6l6 6-6 6"/></svg>',
    swap: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M7 7h12l-3-3M17 17H5l3 3"/></svg>',
    lock: '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="5" y="11" width="14" height="9" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/></svg>',
    check: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="6"/><path d="M8 12.5l3 3 5.5-6.5"/></svg>',
    cal: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="5" width="18" height="16" rx="4"/><path d="M3 10h18M8 3v4M16 3v4"/></svg>',
    calx: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="5" width="18" height="16" rx="4"/><path d="M3 10h18M8 3v4M16 3v4M9.5 13.5l5 5M14.5 13.5l-5 5"/></svg>',
    clock: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>',
    note: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 3h9l4 4v14H6z"/><path d="M15 3v4h4M9 12h7M9 16h5"/></svg>',
    heart: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10z"/></svg>',
    wallet: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 7h15a3 3 0 0 1 3 3v7a3 3 0 0 1-3 3H6a3 3 0 0 1-3-3V7z"/><path d="M3 7l12-4v4"/><circle cx="16.5" cy="13.5" r="1"/></svg>',
    book: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 4h11a3 3 0 0 1 3 3v13H8a3 3 0 0 1-3-3V4z"/><path d="M5 17a3 3 0 0 1 3-3h11"/></svg>',
    house: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 11l8-7 8 7v8a2 2 0 0 1-2 2h-3v-6h-6v6H6a2 2 0 0 1-2-2z"/></svg>',
    plus: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" aria-hidden="true"><path d="M12 5v14M5 12h14"/></svg>',
    ext: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M7 17L17 7M9 7h8v8"/></svg>',
    user: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/></svg>'
  };

  // ================= tema =================
  var SUN = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/></svg>';
  var MOON = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"><path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5z"/></svg>';
  var PAGE = window.KANTONG_PAGE === 'beranda' ? 'beranda' : 'kantong';
  function themePref() { return PAGE === 'beranda' ? 'dark' : LS.get('k_theme', 'auto'); }
  function isDark() { var t = themePref(); return t === 'dark' || (t === 'auto' && window.matchMedia && matchMedia('(prefers-color-scheme: dark)').matches); }
  function applyTheme() {
    var t = themePref(), r = document.documentElement;
    if (t === 'auto') r.removeAttribute('data-theme'); else r.setAttribute('data-theme', t);
    var m = document.querySelector('meta[name="theme-color"]'); if (m) m.setAttribute('content', PAGE === 'beranda' ? '#0E1014' : isDark() ? '#1B1925' : '#F7F5FC');
  }
  function setTheme(t) { LS.set('k_theme', t); applyTheme(); }
  function berandaBtn() { return '<button class="theme-btn" data-act="beranda" aria-label="Ke Beranda"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 11l8-7 8 7v8a2 2 0 0 1-2 2h-3v-6h-6v6H6a2 2 0 0 1-2-2z"/></svg></button>'; }
  function themeBtn() { return '<button class="theme-btn" data-act="theme" aria-label="Ganti tema terang/gelap">' + (isDark() ? SUN : MOON) + '</button>'; }
  applyTheme();
  if (window.matchMedia) matchMedia('(prefers-color-scheme: dark)').addEventListener('change', function () { applyTheme(); });

  // ================= state =================
  var S = {
    conn: LS.get('k_conn', null),          // {mode:'remote', api, token} | {mode:'demo'}
    boot: LS.get('k_boot', null),
    months: LS.get('k_months', {}),
    outbox: LS.get('k_outbox', []),
    todos: LS.get('k_todos', null),        // null = belum pernah dimuat
    prefs: LS.get('k_prefs', { lastKantong: {}, demoUser: 'riki' }),
    tab: PAGE === 'beranda' ? 'beranda' : (({ '#todo': 'todo', '#ringkasan': 'ringkasan', '#riwayat': 'riwayat', '#pengaturan': 'pengaturan' })[location.hash] || 'home'), sub: null, bukuView: null, bulan: thisMonth(),
    syncing: false, again: false, lastError: null, catTab: 'Pengeluaran'
  };
  function persist() {
    LS.set('k_conn', S.conn); LS.set('k_boot', S.boot); LS.set('k_outbox', S.outbox); LS.set('k_prefs', S.prefs); LS.set('k_todos', S.todos);
    var keys = Object.keys(S.months).sort().reverse();
    var keep = {}; keys.slice(0, 8).forEach(function (k) { keep[k] = S.months[k]; });
    S.months = keep; LS.set('k_months', keep);
  }
  function db() {
    var b = S.boot || {};
    return { Buku: b.buku || [], Users: b.users || [], Kategori: b.kategori || [], Kantong: b.kantong || [], Budget: [], Transaksi: [], Todo: S.todos || [] };
  }
  function me() { return S.boot ? S.boot.user : null; }
  function bukuById(id) { return C.byId(db().Buku)[id]; }
  function bukuColor(id) {
    var map = { riki: 'var(--b-riki)', istri: 'var(--b-istri)', rt: 'var(--b-rt)' };
    if (map[id]) return map[id];
    var i = db().Buku.findIndex(function (b) { return b.id === id; });
    return ['#8FA2FF', '#F28DB5', '#F2B544', '#5EEAD4', '#A78BFA'][Math.max(0, i) % 5];
  }
  function userName(id) { var u = db().Users.find(function (x) { return x.id === id; }); return u ? u.nama : id; }
  function canWrite(bukuId) { return C.canWrite(db(), me(), bukuId); }

  // ================= API =================
  function demoTables() {
    var saved = LS.get('k_demo', null);
    if (saved) return saved;
    var seed = window.KANTONG_DEMO_SEED || makeDemoSeed();
    return { Buku: seed.buku, Users: seed.users, Kategori: seed.kategori, Kantong: seed.kantong, Budget: seed.budget, Transaksi: seed.transaksi, Todo: seed.todo || [] };
  }
  var demoStore = null;
  function demoRpc(action, payload) {
    if (!demoStore) demoStore = C.memoryStore(demoTables());
    var users = demoStore.all('Users');
    var u = users.find(function (x) { return x.id === S.prefs.demoUser; }) || users[0];
    return new Promise(function (res, rej) {
      setTimeout(function () {
        try {
          var out = C.handle(demoStore, { id: u.id, nama: u.nama, buku: u.buku }, action, payload, nowIso());
          LS.set('k_demo', demoStore.data);
          res(out);
        } catch (e) { rej(e); }
      }, 180);
    });
  }
  function rpc(action, payload, conn) {
    conn = conn || S.conn;
    if (!conn) return Promise.reject(new Error('Belum terhubung'));
    if (conn.mode === 'demo') return demoRpc(action, payload);
    var ctrl = new AbortController();
    var timer = setTimeout(function () { ctrl.abort(); }, 30000);
    return fetch(conn.api, {
      method: 'POST', redirect: 'follow', signal: ctrl.signal,
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({ token: conn.token, action: action, payload: payload || {} })
    }).then(function (r) {
      clearTimeout(timer);
      if (!r.ok) throw new Error('Server membalas ' + r.status);
      return r.json();
    }, function () {
      clearTimeout(timer);
      var e = new Error('Tidak ada koneksi'); e.offline = true; throw e;
    }).then(function (j) {
      if (!j.ok) { var e = new Error(j.error || 'Gagal'); e.code = j.code; e.server = true; throw e; }
      return j.data;
    });
  }

  // ---------- outbox & sync ----------
  function enqueue(action, payload) {
    var op = { opId: uid(), action: action, payload: payload, at: nowIso() };
    S.outbox.push(op);
    applyLocal(op);
    persist();
    sync();
  }
  function removeTxLocal(id) {
    Object.keys(S.months).forEach(function (b) {
      var m = S.months[b]; if (!m) return;
      m.transaksi = m.transaksi.filter(function (t) { return t.id !== id; });
    });
  }
  function findTx(id) {
    var found = null;
    Object.keys(S.months).forEach(function (b) {
      (S.months[b].transaksi || []).forEach(function (t) { if (t.id === id) found = t; });
    });
    return found;
  }
  function applyLocal(op) {
    if (op.action === 'tx.save') {
      var t = op.payload, ex = findTx(t.id);
      removeTxLocal(t.id);
      var m = S.months[t.tanggal.slice(0, 7)];
      if (m) m.transaksi.push(Object.assign({}, t, { oleh: ex ? ex.oleh : me().id, _pending: true }));
    } else if (op.action === 'tx.delete') {
      removeTxLocal(op.payload.id);
    } else if (op.action === 'tx.reimburse') {
      var rt = findTx(op.payload.id);
      if (rt) { rt.terbayar = op.payload.bayar ? (op.payload.tanggal || todayISO()) : ''; rt._pending = true; }
    } else if (op.action === 'talangan.lunas') {
      var p = op.payload, ids = p.ids || [], tgl = p.tanggal || todayISO();
      var daftar = (S.boot && S.boot.talangan) || [];
      var kena = daftar.filter(function (t) { return ids.indexOf(t.id) >= 0; });
      var bersama = kena.length ? kena[0].buku : '', pemilik = kena.length ? kena[0].pemilik : '';
      ids.forEach(function (id) { var x = findTx(id); if (x) { x.terbayar = tgl; x._pending = true; } });
      if (S.boot) {
        S.boot.talangan = daftar.filter(function (t) { return ids.indexOf(t.id) < 0; });
        if (bersama) {
          var ada = false;
          S.boot.utang = (S.boot.utang || []).map(function (u) {
            if (u.dari !== bersama || u.ke !== pemilik) return u;
            ada = true; return { dari: u.dari, ke: u.ke, jumlah: u.jumlah - p.nominal };
          }).filter(function (u) { return u.jumlah !== 0; });
          if (!ada) S.boot.utang.push({ dari: bersama, ke: pemilik, jumlah: -p.nominal });
        }
      }
      var ml = S.months[tgl.slice(0, 7)];
      if (ml) ml.transaksi.push({ id: 'ln-local-' + uid(), tanggal: tgl, tipe: 'Transfer', nominal: p.nominal,
        buku: bersama, kategori: '', kantong: p.kantong, kantong_tujuan: p.kantong_tujuan,
        keterangan: 'Ganti talangan', reimburse: false, oleh: me().id, sumber: 'app',
        dibuat: nowIso(), diubah: '', dihapus: '', terbayar: '', tx_balik: '', _pending: true });
    } else if (op.action === 'todo.save') {
      var exT = findTodo(op.payload.id);
      upsertTodoLocal(Object.assign({ selesai: false, selesai_oleh: '', gcal_event_id: '', gcal_status: '', gcal_error: '',
        oleh: me() ? me().id : '', dibuat: op.at }, exT || {}, op.payload, { diubah: op.at, dihapus: '', _pending: true }));
    } else if (op.action === 'todo.done') {
      var tdn = findTodo(op.payload.id);
      if (tdn) { tdn.selesai = !!op.payload.selesai; tdn.selesai_oleh = tdn.selesai && me() ? me().id : ''; tdn.diubah = op.at; tdn._pending = true; }
    } else if (op.action === 'todo.delete') {
      S.todos = todos().filter(function (t) { return t.id !== op.payload.id; });
    } else if (op.action === 'todo.sync') {
      var tsy = findTodo(op.payload.id);
      if (tsy) tsy._pending = true;
    }
  }
  function sync(extraMonths) {
    if (!S.conn) return Promise.resolve();
    if (S.syncing) { S.again = true; (extraMonths || []).forEach(function (b) { S.wantMonths = (S.wantMonths || []).concat(b); }); return Promise.resolve(); }
    S.syncing = true; renderSync();
    var ops = S.outbox.slice();
    var want = {}; want[thisMonth()] = 1; want[S.bulan] = 1;
    (extraMonths || []).concat(S.wantMonths || []).forEach(function (b) { want[b] = 1; });
    S.wantMonths = [];
    var batch = ops.map(function (o) { return { opId: o.opId, action: o.action, payload: o.payload }; })
      .concat([{ opId: '_boot', action: 'bootstrap' }, { opId: '_todo', action: 'todo.list' }, { opId: '_komit', action: 'komitmen.list' }])
      .concat(Object.keys(want).map(function (b) { return { opId: '_m_' + b, action: 'month', payload: { bulan: b } }; }));
    return rpc('batch', { ops: batch }).then(function (d) {
      var sent = {}; ops.forEach(function (o) { sent[o.opId] = 1; });
      d.results.forEach(function (r) {
        if (r.opId === '_boot') { if (r.ok) S.boot = r.data; }
        else if (r.opId === '_todo') { if (r.ok) S.todos = r.data.todos || []; }
        else if (r.opId === '_komit') { if (r.ok) LS.set('k_komitmen', { data: r.data, at: Date.now() }); }   // cache yang sama dengan komitmen.html
        else if (String(r.opId).indexOf('_m_') === 0) { if (r.ok) S.months[r.data.bulan] = r.data; }
        else if (!r.ok) toast('Tidak tersimpan: ' + r.error, true);
      });
      S.outbox = S.outbox.filter(function (o) { return !sent[o.opId]; });
      S.outbox.forEach(applyLocal);           // operasi yang masuk selama request
      S.lastError = null; S.lastSync = Date.now();
      persist();
    }).catch(function (e) {
      S.lastError = e.message;
      if (e.code === 'AUTH') { toast('Kode akses tidak berlaku. Hubungkan ulang.', true); }
    }).then(function () {
      S.syncing = false; renderSync(); refresh();
      if (S.again) { S.again = false; sync(); }
    });
  }

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

  // ================= to-do rumah tangga =================
  // Sumber kebenaran: S.todos (dari server, aksi todo.list). Perubahan lewat outbox, sama seperti transaksi.
  function todos() { return S.todos || []; }
  function findTodo(id) { return todos().filter(function (t) { return t.id === id; })[0] || null; }
  function upsertTodoLocal(t) {
    var list = todos(), i = -1;
    for (var k = 0; k < list.length; k++) if (list[k].id === t.id) i = k;
    if (i >= 0) list[i] = t; else list.push(t);
    S.todos = list;
  }
  function todoPemilikList() {
    return db().Users.map(function (u) { return { id: u.id, nama: u.nama, warna: bukuColor(u.buku) }; })
      .concat([{ id: C.TODO_BERSAMA, nama: 'Bersama', warna: 'var(--b-rt)' }]);
  }
  function todoPemilikInfo(id) {
    return todoPemilikList().filter(function (p) { return p.id === id; })[0] || { id: id, nama: id, warna: 'var(--surface-3)' };
  }
  function canWriteTodo(t) { return C.canWriteTodo(me(), t); }
  function todoFilter() { return S.prefs.todoFilter || 'untukku'; }
  function todoMatch(t, f) {
    if (f === 'semua') return true;
    if (f === 'bersama') return t.pemilik === C.TODO_BERSAMA;
    return canWriteTodo(t);                       // Untukku = milikku + bersama
  }
  function todoDefaultPemilik() { return todoFilter() === 'bersama' ? C.TODO_BERSAMA : me().id; }
  function nowHM() { var d = new Date(); return pad(d.getHours()) + ':' + pad(d.getMinutes()); }
  function todoTerlewat(t) {
    if (C.bool(t.selesai) || !t.tanggal) return false;
    var today = todayISO();
    return t.tanggal < today || (t.tanggal === today && !!t.jam && t.jam < nowHM());
  }
  function todoWaktuLabel(t) {
    if (!t.tanggal) return '';
    var today = todayISO(), lbl;
    if (t.tanggal === today) lbl = 'Hari ini';
    else if (t.tanggal === C.addDays(today, 1)) lbl = 'Besok';
    else if (t.tanggal === C.addDays(today, -1)) lbl = 'Kemarin';
    else {
      var d = dateObj(t.tanggal);
      lbl = HARI[d.getDay()] + ', ' + d.getDate() + ' ' + BULAN[d.getMonth()].slice(0, 3) + (d.getFullYear() !== new Date().getFullYear() ? ' ' + d.getFullYear() : '');
    }
    return lbl + (t.jam ? ' ' + t.jam : ' · seharian');
  }
  function todoSorted(list) {
    // yang punya waktu dulu (paling dekat di atas), lalu tanpa waktu (terbaru di atas)
    return list.slice().sort(function (a, b) {
      var ka = a.tanggal ? 0 : 1, kb = b.tanggal ? 0 : 1;
      if (ka !== kb) return ka - kb;
      if (!ka) { var sa = a.tanggal + 'T' + (a.jam || ''), sb = b.tanggal + 'T' + (b.jam || ''); if (sa !== sb) return sa < sb ? -1 : 1; }
      return String(b.dibuat || '').localeCompare(String(a.dibuat || ''));
    });
  }
  // status kalender per baris (UX copy dari brief: menunggu koneksi / menyinkronkan / tersinkron / gagal)
  function todoStatusHtml(t) {
    if (!t.tanggal) return '';
    var waktu = esc(todoWaktuLabel(t));
    if (t._pending) {
      var sedang = S.syncing || !S.lastError;
      return '<span class="td-st wait">' + ICON.clock + waktu + ' · ' + (sedang ? 'Menyinkronkan…' : 'Menunggu koneksi') + '</span>';
    }
    if (t.gcal_status === 'gagal') return '<span class="td-st bad">' + ICON.calx + waktu + '</span>';
    if (t.gcal_status === 'ok') return '<span class="td-st ok">' + ICON.cal + waktu + '</span>';
    return '<span class="td-st">' + ICON.cal + waktu + '</span>';
  }
  function todoRow(t) {
    var bisa = canWriteTodo(t), selesai = C.bool(t.selesai), p = todoPemilikInfo(t.pemilik);
    if (C.todoTipe(t) === 'catatan') return catatanRow(t);
    var tags = C.todoTipe(t) === 'evaluasi' ? '<span class="tag" style="--c:#FCD34D"><i></i>Evaluasi</span>' : '';
    if (t.pemilik !== me().id) tags += '<span class="tag" style="--c:' + p.warna + '"><i></i>' + esc(p.nama) + '</span>';
    if (selesai && t.pemilik === C.TODO_BERSAMA && t.selesai_oleh) tags += '<span class="tag">oleh ' + esc(userName(t.selesai_oleh)) + '</span>';
    var gagal = !t._pending && t.gcal_status === 'gagal' && C.todoPerluEvent(t);
    return '<div class="todo-row' + (selesai ? ' done' : '') + (todoTerlewat(t) ? ' late' : '') + '">' +
      '<button type="button" class="todo-chk" role="checkbox" aria-checked="' + selesai + '" data-tdone="' + esc(t.id) + '" aria-label="' + (selesai ? 'Batalkan selesai' : 'Tandai selesai') + ': ' + esc(t.judul) + '"' + (bisa ? '' : ' disabled') + '></button>' +
      '<div class="todo-main" role="button" tabindex="0" data-todo="' + esc(t.id) + '"><span class="t1">' + esc(t.judul) + '</span>' +
      '<span class="t2">' + todoStatusHtml(t) + tags + '</span>' +
      (gagal ? '<button type="button" class="td-retry" data-tretry="' + esc(t.id) + '"' + (bisa ? '' : ' disabled') + '>' + ICON.calx + 'Gagal masuk kalender. Coba lagi</button>' : '') +
      '</div></div>';
  }
  function catatanRow(t) {
    var p = todoPemilikInfo(t.pemilik), isi = String(t.isi || t.judul);
    var sisa = isi.indexOf('\n') >= 0 ? isi.slice(isi.indexOf('\n') + 1).replace(/\s+/g, ' ').trim() : '';
    return '<div class="todo-row note"><span class="note-ic" aria-hidden="true">' + ICON.note + '</span>' +
      '<div class="todo-main" role="button" tabindex="0" data-todo="' + esc(t.id) + '"><span class="t1">' + esc(t.judul) + '</span>' +
      '<span class="t2">' + (sisa ? '<span class="note-more">' + esc(sisa.slice(0, 90)) + '</span>' : '') +
      '<span class="tag" style="--c:' + p.warna + '"><i></i>' + esc(t.pemilik === (me() || {}).id ? 'Pribadi' : p.nama) + '</span></span></div></div>';
  }
  function bindTodoRows(root) {
    if (!root) return;
    $$('[data-tdone]', root).forEach(function (b) { b.addEventListener('click', function () { toggleTodoDone(findTodo(b.getAttribute('data-tdone'))); }); });
    $$('[data-todo]', root).forEach(function (el) {
      var buka = function (e) {
        if (e.target.closest && e.target.closest('[data-tretry]')) return;
        var t = findTodo(el.getAttribute('data-todo'));
        if (t) openTodoSheet(t);
      };
      el.addEventListener('click', buka);
      el.addEventListener('keydown', function (e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); buka(e); } });
    });
    $$('[data-tretry]', root).forEach(function (b) { b.addEventListener('click', function (e) {
      e.stopPropagation();
      var t = findTodo(b.getAttribute('data-tretry'));
      if (!t || !canWriteTodo(t)) return;
      enqueue('todo.sync', { id: t.id }); toast('Mencoba masuk ke kalender lagi…');
    }); });
  }
  function toggleTodoDone(t) {
    if (!t) return;
    if (!canWriteTodo(t)) { toast('To-do ini milik ' + todoPemilikInfo(t.pemilik).nama + ', hanya bisa dilihat', true); return; }
    var selesai = !C.bool(t.selesai);
    enqueue('todo.done', { id: t.id, selesai: selesai });
    toast(selesai ? 'Selesai: ' + t.judul : 'Dikembalikan ke daftar');
  }
  // simpan dari form cepat maupun sheet; validasi memakai aturan yang sama dengan server
  function simpanTodo(f, existing, errEl) {
    var tipe = f.tipe || 'todo', waktu = tipe === 'evaluasi' || (tipe === 'todo' && f.aturWaktu);
    var payload = { id: f.id || uid(), tipe: tipe, judul: tipe === 'catatan' ? '' : f.judul, isi: tipe === 'catatan' ? f.isi : (f.isi || ''), pemilik: f.pemilik,
      tanggal: waktu ? f.tanggal : '', jam: waktu && !f.seharian ? f.jam : '', durasi: f.durasi };
    try { payload = C.cleanTodo(payload, db(), me(), existing); }
    catch (e) { if (errEl) errEl.textContent = e.message; else toast(e.message, true); return null; }
    if (errEl) errEl.textContent = '';
    enqueue('todo.save', payload);
    if (tipe === 'catatan') toast(existing ? 'Catatan diperbarui' : 'Catatan tersimpan');
    else if (existing && existing.tanggal && !payload.tanggal) toast('Waktu dihapus. Event kalender ikut dihapus, to-do tetap ada.');
    else if (payload.tanggal) toast(existing ? 'Perubahan disimpan. Masuk ke Google Calendar.' : 'Tersimpan. Masuk ke Google Calendar.');
    else toast(existing ? 'Perubahan disimpan' : 'Tersimpan');
    return payload;
  }
  var TODO_DURASI_PILIHAN = [[15, '15 mnt'], [30, '30 mnt'], [45, '45 mnt'], [60, '1 jam'], [90, '1,5 jam'], [120, '2 jam'], [180, '3 jam']];
  function openTodoSheet(t, init) {
    var editable = !t || canWriteTodo(t);
    var now = new Date(), jamDefault = pad((now.getHours() + 1) % 24) + ':00';
    var f = t
      ? { id: t.id, tipe: C.todoTipe(t), judul: t.judul, isi: t.isi || '', pemilik: t.pemilik, aturWaktu: !!t.tanggal, tanggal: t.tanggal || todayISO(),
        seharian: !!t.tanggal && !t.jam, jam: t.jam || jamDefault, durasi: C.num(t.durasi) || C.TODO_DURASI }
      : Object.assign({ id: '', tipe: 'todo', judul: '', isi: '', pemilik: todoDefaultPemilik(), aturWaktu: false, tanggal: todayISO(), seharian: false, jam: jamDefault, durasi: C.TODO_DURASI }, init || {});
    if (f.tipe === 'evaluasi') { f.aturWaktu = true; if (!f.judul) f.judul = C.EVALUASI_JUDUL; }
    var NAMA = { todo: 'to-do', catatan: 'catatan', evaluasi: 'jadwal evaluasi' }[f.tipe];
    var judulSheet = t ? (editable ? 'Ubah ' + NAMA : 'Detail ' + NAMA) : ({ todo: 'To-do baru', catatan: 'Catatan baru', evaluasi: 'Jadwalkan evaluasi' })[f.tipe];
    openSheet(judulSheet, function (sh) {
      function hintText() {
        if (f.tipe === 'catatan') return 'Catatan hanya di app, tidak pernah masuk kalender.';
        if (!f.aturWaktu) return 'Tanpa waktu: hanya di app, tidak masuk kalender.';
        var spec = C.todoEventSpec({ id: f.id || 'x', judul: f.judul || 'to-do', pemilik: f.pemilik, tanggal: f.tanggal, jam: f.seharian ? '' : f.jam, durasi: f.durasi, selesai: t ? t.selesai : false }, db());
        var kapan = todoWaktuLabel({ tanggal: f.tanggal, jam: f.seharian ? '' : f.jam });
        if (!spec.seharian) kapan += '–' + spec.akhir.slice(11);
        return 'Masuk ke Google Calendar "Rumah Kita" sebagai ' + spec.judul + ' · ' + kapan + '.';
      }
      function draw() {
        var dis = editable ? '' : ' disabled';
        var pil = TODO_DURASI_PILIHAN.slice();
        if (!pil.some(function (x) { return x[0] === f.durasi; })) pil.push([f.durasi, f.durasi + ' mnt']);
        var catatan = f.tipe === 'catatan', evaluasi = f.tipe === 'evaluasi';
        sh.el.innerHTML = (editable ? '' : '<div class="readonly-note">' + ICON.lock + '<span>' + (catatan ? 'Catatan' : 'To-do') + ' ini milik ' + esc(todoPemilikInfo(f.pemilik).nama) + '. Hanya bisa kamu lihat.</span></div>') +
          (catatan
            ? '<div class="field" style="margin-top:4px"><label for="td-isi">Catatan</label><textarea id="td-isi" class="input" rows="6" maxlength="2000" placeholder="Tulis catatan…"' + dis + '>' + esc(f.isi) + '</textarea></div>'
            : '<div class="field" style="margin-top:4px"><label for="td-judul">' + (evaluasi ? 'Judul agenda' : 'Apa yang mau dikerjain?') + '</label><input id="td-judul" class="input" maxlength="120" placeholder="mis. bayar listrik" autocomplete="off" value="' + esc(f.judul) + '"' + dis + '></div>') +
          '<div class="field"><span class="lbl">Untuk</span><div class="chips wrap" role="group" aria-label="Pemilik to-do">' + todoPemilikList().map(function (p) {
            return '<button type="button" class="chip" data-tp="' + esc(p.id) + '" aria-pressed="' + (f.pemilik === p.id) + '" style="--c:' + p.warna + '"' + dis + '><span class="dot" style="background:' + p.warna + '"></span>' + esc(p.nama) + '</button>';
          }).join('') + '</div></div>' +
          (catatan ? '' : toggleHtml('td-eval', 'Agenda evaluasi bulanan', evaluasi ? 'Pengingat muncul di Beranda ' + C.EVALUASI_PENGINGAT_JAM + ' jam sebelumnya' : 'Jadikan jadwal evaluasi berdua', evaluasi).replace('<button ', '<button' + dis + ' ')) +
          (catatan || evaluasi ? '' : toggleHtml('td-waktu', 'Atur waktu', f.aturWaktu ? 'Masuk ke Google Calendar "Rumah Kita"' : 'Tanpa waktu: hanya di app', f.aturWaktu).replace('<button ', '<button' + dis + ' ')) +
          (f.aturWaktu && !catatan ?
            '<div class="field row2"><div><label for="td-tgl">Tanggal</label><input id="td-tgl" class="input" type="date" value="' + esc(f.tanggal) + '"' + dis + '></div>' +
            '<div><label for="td-jam">Jam</label><input id="td-jam" class="input" type="time" step="300" value="' + esc(f.jam) + '"' + (f.seharian || !editable ? ' disabled' : '') + '></div></div>' +
            toggleHtml('td-seharian', 'Seharian', 'Tanpa jam, muncul sebagai event sehari penuh', f.seharian).replace('<button ', '<button' + dis + ' ') +
            (!f.seharian ? '<div class="field"><span class="lbl">Durasi</span><div class="chips" role="group" aria-label="Durasi">' + pil.map(function (x) {
              return '<button type="button" class="chip" data-td="' + x[0] + '" aria-pressed="' + (f.durasi === x[0]) + '"' + dis + '>' + x[1] + '</button>';
            }).join('') + '</div></div>' : '') : '') +
          '<div class="hint" id="td-hint">' + esc(hintText()) + '</div>' +
          (t && t.gcal_status === 'gagal' && C.todoPerluEvent(t) && !t._pending ? '<div class="hint" style="color:var(--todo-bad)">Terakhir gagal masuk kalender: ' + esc(t.gcal_error || 'tidak diketahui') + '</div>' : '') +
          '<div class="err" id="td-err" role="alert"></div>' +
          (editable ? '<button type="button" class="btn" id="td-save">' + (t ? 'Simpan perubahan' : 'Simpan') + '</button>' +
            (t ? '<button type="button" class="btn danger" id="td-del">Hapus ' + NAMA + '</button>' : '') : '');
        if (!editable) return;
        var judul = $('#td-judul', sh.el), isi = $('#td-isi', sh.el);
        if (judul) {
          judul.addEventListener('input', function () { f.judul = judul.value; $('#td-hint', sh.el).textContent = hintText(); });
          judul.addEventListener('keydown', function (e) { if (e.key === 'Enter') simpan(); });
        }
        if (isi) isi.addEventListener('input', function () { f.isi = isi.value; });
        $$('[data-tp]', sh.el).forEach(function (b) { b.addEventListener('click', function () {
          f.pemilik = b.getAttribute('data-tp');
          $$('[data-tp]', sh.el).forEach(function (x) { x.setAttribute('aria-pressed', String(x === b)); });
          $('#td-hint', sh.el).textContent = hintText();
        }); });
        var tw = $('#td-waktu', sh.el); if (tw) tw.addEventListener('click', function () { f.aturWaktu = !f.aturWaktu; draw(); });
        var te = $('#td-eval', sh.el); if (te) te.addEventListener('click', function () {
          if (f.tipe === 'evaluasi') { f.tipe = 'todo'; if (f.judul === C.EVALUASI_JUDUL) f.judul = ''; }
          else { f.tipe = 'evaluasi'; f.aturWaktu = true; f.pemilik = C.TODO_BERSAMA; if (!f.judul) f.judul = C.EVALUASI_JUDUL; }
          draw();
        });
        var tgl = $('#td-tgl', sh.el), jam = $('#td-jam', sh.el), sehari = $('#td-seharian', sh.el);
        if (tgl) tgl.addEventListener('change', function () { f.tanggal = tgl.value || todayISO(); $('#td-hint', sh.el).textContent = hintText(); });
        if (jam) jam.addEventListener('change', function () { if (jam.value) f.jam = jam.value.slice(0, 5); $('#td-hint', sh.el).textContent = hintText(); });
        if (sehari) sehari.addEventListener('click', function () { f.seharian = !f.seharian; draw(); });
        $$('[data-td]', sh.el).forEach(function (b) { b.addEventListener('click', function () {
          f.durasi = +b.getAttribute('data-td');
          $$('[data-td]', sh.el).forEach(function (x) { x.setAttribute('aria-pressed', String(x === b)); });
          $('#td-hint', sh.el).textContent = hintText();
        }); });
        $('#td-save', sh.el).addEventListener('click', simpan);
        var del = $('#td-del', sh.el);
        if (del) del.addEventListener('click', function () {
          if (!confirm('Hapus ' + NAMA + ' ini?' + (t.gcal_event_id ? ' Event di Google Calendar ikut dihapus.' : ''))) return;
          enqueue('todo.delete', { id: t.id }); toast(NAMA.charAt(0).toUpperCase() + NAMA.slice(1) + ' dihapus'); sh.close();
        });
      }
      function simpan() {
        if (simpanTodo(f, t, $('#td-err', sh.el))) sh.close();
      }
      draw();
      if (!t) { var j = $('#td-judul', sh.el) || $('#td-isi', sh.el); if (j && !f.judul && !f.isi) setTimeout(function () { j.focus(); }, 300); }
    });
  }
  // kartu kecil di Beranda: to-do hari ini & yang terlewat (milikku + bersama)
  function renderHomeTodo(root) {
    if (!root) return;
    var today = todayISO();
    var list = todoSorted(todos().filter(function (t) { return canWriteTodo(t) && !C.bool(t.selesai) && t.tanggal && t.tanggal <= today; }));
    root.innerHTML = list.length
      ? '<section class="section"><div class="section-h"><h2>To-do hari ini</h2><button type="button" class="aside lnk" data-act="goto-todo">Lihat semua</button></div>' +
        '<div class="list todo-list">' + list.slice(0, 3).map(todoRow).join('') + '</div>' +
        (list.length > 3 ? '<p class="faint" style="font-size:12px;text-align:center;margin:8px 0 0">+' + (list.length - 3) + ' lainnya di tab To-do</p>' : '') + '</section>'
      : '';
    bindTodoRows(root);
  }
  var TodoView = {
    render: function (el) {
      var self = this;
      el.innerHTML = '<div class="topbar"><div><div class="date">' + longToday() + '</div><h1>To-do & catatan</h1></div><div class="top-actions">' + berandaBtn() + syncPill() + '</div></div>' +
        '<div class="seg" role="group" aria-label="Filter to-do">' + [['untukku', 'Untukku'], ['bersama', 'Bersama'], ['semua', 'Semua']].map(function (x) {
          return '<button type="button" data-tf="' + x[0] + '" aria-pressed="' + (todoFilter() === x[0]) + '">' + x[1] + '</button>';
        }).join('') + '</div>' +
        '<div class="todo-add"><input id="td-new" class="input" type="text" maxlength="120" placeholder="Tulis to-do, lalu Enter" autocomplete="off" enterkeyhint="done" aria-label="To-do baru">' +
        '<button type="button" class="btn small ghost" id="td-time" aria-label="Atur waktu">' + ICON.cal + '<span>Atur waktu</span></button></div>' +
        '<div id="td-list"></div>';
      $$('[data-tf]', el).forEach(function (b) { b.addEventListener('click', function () {
        S.prefs.todoFilter = b.getAttribute('data-tf'); persist();
        $$('[data-tf]', el).forEach(function (x) { x.setAttribute('aria-pressed', String(x === b)); });
        self.update(el);
      }); });
      var inp = $('#td-new', el);
      inp.addEventListener('keydown', function (e) {
        if (e.key !== 'Enter') return;
        e.preventDefault();
        var judul = inp.value.trim(); if (!judul) return;
        if (simpanTodo({ judul: judul, pemilik: todoDefaultPemilik(), aturWaktu: false, durasi: C.TODO_DURASI }, null)) { inp.value = ''; }
      });
      $('#td-time', el).addEventListener('click', function () {
        openTodoSheet(null, { judul: inp.value.trim(), aturWaktu: true });
        inp.value = '';
      });
      this.update(el);
    },
    update: function (el) {
      var box = $('#td-list', el); if (!box) return this.render(el);
      if (S.todos === null) { box.innerHTML = skeleton(3); return; }
      var f = todoFilter(), semua = todos().filter(function (t) { return todoMatch(t, f); });
      var list = semua.filter(function (t) { return C.todoTipe(t) !== 'catatan'; });
      var notes = semua.filter(function (t) { return C.todoTipe(t) === 'catatan'; })
        .sort(function (a, b) { return String(b.diubah || b.dibuat || '').localeCompare(String(a.diubah || a.dibuat || '')); });
      var buka = todoSorted(list.filter(function (t) { return !C.bool(t.selesai); }));
      var beres = list.filter(function (t) { return C.bool(t.selesai); })
        .sort(function (a, b) { return String(b.diubah || '').localeCompare(String(a.diubah || '')); }).slice(0, 20);
      var html;
      if (!buka.length && !beres.length) html = '<div class="list"><div class="empty">Belum ada to-do. Tulis satu hal yang mau dikerjain hari ini.</div></div>';
      else {
        html = buka.length ? '<div class="list todo-list">' + buka.map(todoRow).join('') + '</div>'
          : '<div class="list"><div class="empty">Semua beres. Tulis to-do berikutnya di atas.</div></div>';
        if (beres.length) html += '<section class="section"><div class="section-h"><h2>Selesai</h2><span class="aside">' + beres.length + ' terakhir</span></div><div class="list todo-list">' + beres.map(todoRow).join('') + '</div></section>';
      }
      html += '<section class="section"><div class="section-h"><h2>Catatan</h2><button type="button" class="aside lnk" id="td-note-new">+ Catatan</button></div>' +
        (notes.length ? '<div class="list todo-list">' + notes.map(catatanRow).join('') + '</div>' : '<div class="list"><div class="empty">Belum ada catatan.</div></div>') + '</section>';
      box.innerHTML = html;
      $('#td-note-new', box).addEventListener('click', function () { openTodoSheet(null, { tipe: 'catatan' }); });
      bindTodoRows(box);
    }
  };

  // ================= views =================
  var view = null;
  function renderShell() {
    var app = $('#app');
    if (!S.conn) { renderConnect(); return; }
    if (PAGE === 'beranda') { renderBerandaShell(app); return; }
    app.innerHTML = (S.conn.mode === 'demo' ? '<div class="demo-bar">Ini versi demo dengan data contoh. <button data-act="leave-demo">Keluar dari demo</button></div>' : '') +
      '<main id="view" class="view"></main>' +
      '<footer class="tabbar"><nav>' + [['home', 'Catat', ICON.home], ['todo', 'To-do', ICON.check], ['ringkasan', 'Ringkasan', ICON.chart], ['riwayat', 'Riwayat', ICON.list], ['pengaturan', 'Pengaturan', ICON.gear]].map(function (x) {
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
    if (!S.boot) { $('#view').innerHTML = '<div class="topbar"><div><h1>Memuat data…</h1></div>' + syncPill() + '</div>' + skeleton(5); return; }
    if (!S.bukuView) S.bukuView = me().buku;
    var v = { home: HomeView, todo: TodoView, ringkasan: RingkasanView, riwayat: RiwayatView, pengaturan: SettingsView, beranda: BerandaView }[S.tab];
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
    if (a === 'goto-todo') goTab('todo');
    if (a === 'beranda') location.href = './';
  });

  // ---------- Catat (home) ----------
  var HomeView = {
    render: function (el) {
      el.innerHTML = '<div class="topbar"><div><div class="date">' + longToday() + '</div><h1>Halo, ' + esc(me().nama) + '!</h1></div><div class="top-actions">' + berandaBtn() + themeBtn() + syncPill() + '</div></div>' +
        '<div id="home-budget"></div>' +
        '<section class="section"><div class="entry" id="entry"></div></section>' +
        '<div id="home-todo"></div><div id="home-utang"></div><div id="home-reim"></div>' +
        '<section class="section"><div class="section-h"><h2>Catatan hari ini</h2><span class="aside" id="today-total"></span></div><div id="today"></div></section>';
      txForm($('#entry', el), null, { allowAdd: true });
      this.update(el);
    },
    update: function (el) {
      var m = ensureMonth(thisMonth());
      var budgetEl = $('#home-budget', el), todayEl = $('#today', el);
      if (!m) { budgetEl.innerHTML = '<div class="skeleton"></div>'; todayEl.innerHTML = skeleton(2); return; }
      var d = db(), user = me();
      var mine = C.writableBuku(d, user);
      budgetEl.innerHTML = '<div class="hero"><div class="section-h" style="margin:0 0 14px"><h2>Jatah ' + BULAN[new Date().getMonth()] + ' tinggal segini</h2></div>' +
        mine.map(function (b, i) {
          var s = C.summarize(d, m.transaksi, m.budget, b.id);
          var used = s.budgetTotal ? Math.min(1, s.pengeluaran / s.budgetTotal) : 0;
          return '<div style="' + (i ? 'margin-top:16px' : '') + '"><div class="budget-head"><span class="muted" style="display:flex;align-items:center;gap:8px"><span class="dot" style="width:8px;height:8px;border-radius:50%;background:' + bukuColor(b.id) + '"></span>' + (b.tipe === 'Bersama' ? esc(b.nama) : 'Pribadi') + '</span>' +
            '<span class="big num' + (s.sisaBudget < 0 ? ' over' : '') + '" style="font-size:18px">' + (s.budgetTotal ? rp(s.sisaBudget) : '<span class="faint" style="font-size:13px;font-weight:500">Budget belum diatur</span>') + '</span></div>' +
            (s.budgetTotal ? '<div class="meter' + (s.sisaBudget < 0 ? ' over' : '') + '" style="--c:' + bukuColor(b.id) + '"><i style="width:' + (used * 100).toFixed(1) + '%"></i></div>' +
            '<div class="budget-foot"><span>Terpakai ' + rp(s.pengeluaran) + '</span><span>dari ' + rp(s.budgetTotal) + '</span></div>' : '') + '</div>';
        }).join('') + '</div>';
      var t = todayISO();
      var list = m.transaksi.filter(function (x) { return x.tanggal === t && mine.some(function (b) { return C.txInBuku(d, x, b.id); }); });
      var out = list.reduce(function (s, x) { return s + (isCounted(x) ? x.nominal : 0); }, 0);
      $('#today-total', el).textContent = out ? 'Keluar ' + rp(out) : '';
      todayEl.innerHTML = list.length ? '<div class="list">' + list.sort(function (a, b) { return String(b.dibuat || '9').localeCompare(String(a.dibuat || '9')); })
        .map(function (x) { return txRow(x, null); }).join('') + '</div>' : '<div class="list"><div class="empty">Hari ini masih bersih. Catat jajan pertamamu di atas.</div></div>';
      bindTxRows(todayEl);
      renderHomeTodo($('#home-todo', el));
      renderTalangan($('#home-utang', el), null);
      var waits = [];
      Object.keys(S.months).forEach(function (b) { (S.months[b].transaksi || []).forEach(function (x) { if (reimStatus(x) === 'wait' && canWrite(x.buku)) waits.push(x); }); });
      waits.sort(function (a, b) { return String(a.tanggal).localeCompare(String(b.tanggal)); });
      var re = $('#home-reim', el);
      re.innerHTML = waits.length ? '<section class="section"><div class="section-h"><h2>Menunggu reimburse</h2><span class="aside">' + rp(waits.reduce(function (s, x) { return s + x.nominal; }, 0)) + '</span></div><div class="list">' +
        waits.slice(0, 5).map(function (x) { return txRow(x, null); }).join('') + '</div>' + (waits.length > 5 ? '<p class="faint" style="font-size:12px;text-align:center">+' + (waits.length - 5) + ' lainnya, lihat di Riwayat</p>' : '') + '</section>' : '';
      bindTxRows(re);
    }
  };

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
      el.innerHTML = '<div class="topbar"><div><h1>Ringkasan</h1></div>' + syncPill() + '</div>' + bukuTabs(true) + monthBar() + '<div id="rk"></div>';
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
            '<span class="cat-sub"><span>' + (k.budget ? 'Budget ' + rp(k.budget) : 'Tanpa budget') + '</span>' +
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

  var CatDetail = {
    render: function (el) {
      var id = S.sub.id, k = kategoriOf(id) || { nama: 'Tanpa kategori', warna: '#94A3B8', tipe: 'Pengeluaran' };
      el.innerHTML = '<button class="back" data-back>' + ICON.left + 'Ringkasan</button>' +
        '<div class="topbar"><div><h1 style="display:flex;align-items:center;gap:10px"><span style="width:12px;height:12px;border-radius:4px;background:' + k.warna + '"></span>' + esc(k.nama) + '</h1>' +
        '<div class="date">' + monthName(S.bulan) + ', buku ' + esc(S.bukuView === 'all' ? 'semua' : (bukuById(S.bukuView) || {}).nama) + '</div></div>' + syncPill() + '</div><div id="cd"></div>';
      $('[data-back]', el).addEventListener('click', backSub);
      var m = ensureMonth(S.bulan), box = $('#cd', el);
      if (!m) { box.innerHTML = skeleton(4); return; }
      var d = db();
      var semua = m.transaksi.filter(function (t) { return t.kategori === id && (S.bukuView === 'all' || t.buku === S.bukuView); });
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
          (fk && totalSemua ? Math.round(total / totalSemua * 100) + '% dari ' + rp(totalSemua) : '') + '</span></div></div>' + txGroups(list, S.bukuView);
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
      el.innerHTML = '<div class="topbar"><div><h1>Riwayat</h1></div>' + syncPill() + '</div>' + bukuTabs(true) + monthBar() +
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

  // ---------- Pengaturan ----------
  var SettingsView = {
    render: function (el) {
      if (S.sub) return ({ kantong: KantongList, kategori: KategoriList, budget: BudgetEdit })[S.sub.type].render(el);
      var demo = S.conn.mode === 'demo';
      var host = demo ? 'Mode demo, tersimpan di HP ini' : (/supabase\.(co|in)\//.test(S.conn.api || '') ? 'Terhubung ke Supabase' : 'Terhubung ke Google Sheets');
      el.innerHTML = '<div class="topbar"><div><h1>Pengaturan</h1></div>' + syncPill() + '</div>' +
        '<div class="menu"><div style="padding:16px;border-bottom:1px solid var(--surface-2)"><div style="font-weight:700;font-size:17px">' + esc(me().nama) + '</div><div class="faint" style="font-size:13px">' + host + '</div></div>' +
        '<button data-s="sync"><span class="main">Sinkron sekarang<div class="t2">' + (S.lastSync ? 'Terakhir ' + new Date(S.lastSync).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }) : 'Belum sinkron di sesi ini') + (S.outbox.length ? ', ' + S.outbox.length + ' belum terkirim' : '') + '</div></span></button>' +
        (demo ? '<button data-s="switch"><span class="main">Masuk sebagai ' + esc((db().Users.filter(function (u) { return u.id !== me().id; })[0] || { nama: 'pengguna lain' }).nama) + '<div class="t2">Coba aturan baca/tulis antar buku</div></span></button>' : '') +
        '</div>' +
        '<section class="section"><div class="section-h"><h2>Tampilan</h2></div><div class="menu" style="padding-top:16px"><div class="seg" role="group" aria-label="Tema">' + [['auto', 'Ikut HP'], ['light', 'Terang'], ['dark', 'Gelap']].map(function (x) { return '<button data-theme-set="' + x[0] + '" aria-pressed="' + (themePref() === x[0]) + '">' + x[1] + '</button>'; }).join('') + '</div></div></section>' +
        '<section class="section"><div class="menu">' +
        '<button data-s="budget"><span class="main">Budget bulanan<div class="t2">Atur budget per kategori</div></span>' + ICON.right + '</button>' +
        '<button data-s="kategori"><span class="main">Kategori<div class="t2">' + db().Kategori.filter(function (k) { return C.bool(k.aktif) && k.id !== C.KAT_REIMBURSE; }).length + ' kategori aktif</div></span>' + ICON.right + '</button>' +
        '<button data-s="kantong"><span class="main">Kantong<div class="t2">Cash, debit, e-wallet, kartu kredit</div></span>' + ICON.right + '</button>' +
        '</div></section>' +
        '<section class="section"><div class="menu"><button data-s="beranda"><span class="main">Beranda<div class="t2">Ringkasan keuangan, to-do, kesepakatan, dan mood</div></span>' + ICON.right + '</button></div></section>' +
        '<section class="section"><div class="menu"><button data-s="out"><span class="main" style="color:var(--over)">' + (demo ? 'Keluar dari mode demo' : 'Putuskan koneksi di HP ini') + '</span></button></div>' +
        '<p class="faint" style="font-size:12px;text-align:center;margin-top:20px">Kantong v' + (S.boot.version || C.VERSION) + '</p></section>';
      $$('[data-theme-set]', el).forEach(function (b) { b.addEventListener('click', function () { setTheme(b.getAttribute('data-theme-set')); SettingsView.render(el); }); });
      $$('[data-s]', el).forEach(function (b) { b.addEventListener('click', function () {
        var a = b.getAttribute('data-s');
        if (a === 'sync') sync();
        else if (a === 'beranda') location.href = './';
        else if (a === 'switch') { S.prefs.demoUser = S.prefs.demoUser === 'riki' ? 'istri' : 'riki'; S.bukuView = null; persist(); S.boot = null; renderView(); sync(); }
        else if (a === 'out') { if (confirm(demo ? 'Keluar dari mode demo? Data demo dihapus.' : 'Putuskan koneksi? Transaksi yang belum terkirim akan hilang dari HP ini.')) disconnect(); }
        else goSub({ type: a });
      }); });
    },
    update: function (el) { if (!S.sub || S.sub.type !== 'budget') this.render(el); }
  };
  function subHeader(title, el) {
    return '<button class="back" data-back>' + ICON.left + 'Pengaturan</button><div class="topbar"><div><h1>' + esc(title) + '</h1></div>' + syncPill() + '</div>';
  }
  function bindBack(el) { $('[data-back]', el).addEventListener('click', backSub); }
  function settingCall(action, payload, okMsg) {
    return rpc(action, payload).then(function (d) { toast(okMsg); return sync().then(function () { return d; }); })
      .catch(function (e) { toast(e.offline ? 'Perlu koneksi internet untuk menyimpan pengaturan' : e.message, true); throw e; });
  }

  var KantongList = {
    render: function (el) {
      var d = db(), saldo = S.boot.saldo || {};
      el.innerHTML = subHeader('Kantong', el) + d.Buku.slice().sort(function (a, b) { return a.urutan - b.urutan; }).map(function (b) {
        var ks = d.Kantong.filter(function (k) { return k.buku === b.id; });
        return '<section class="section"><div class="section-h"><h2 style="display:flex;align-items:center;gap:8px"><span style="width:8px;height:8px;border-radius:50%;background:' + bukuColor(b.id) + '"></span>' + esc(b.nama) + '</h2>' +
          (canWrite(b.id) ? '<button class="btn small ghost" data-addk="' + esc(b.id) + '">+ Tambah</button>' : '<span class="aside">hanya lihat</span>') + '</div><div class="list">' +
          (ks.length ? ks.map(function (k) {
            var v = saldo[k.id] || 0;
            return '<button class="wallet" data-k="' + esc(k.id) + '"' + (C.bool(k.aktif) ? '' : ' style="opacity:.45"') + '><span class="main"><span class="t1" style="display:block">' + esc(k.nama) + '</span><span class="t2">' + k.jenis + (C.bool(k.aktif) ? '' : ', nonaktif') + '</span></span><span class="amt num' + (v < 0 ? ' neg' : '') + '">' + rp(v) + '</span></button>';
          }).join('') : '<div class="empty">Belum ada kantong.</div>') + '</div></section>';
      }).join('');
      bindBack(el);
      $$('[data-k]', el).forEach(function (b) { b.addEventListener('click', function () { openKantongSheet(C.byId(db().Kantong)[b.getAttribute('data-k')]); }); });
      $$('[data-addk]', el).forEach(function (b) { b.addEventListener('click', function () { openKantongSheet(null, b.getAttribute('data-addk')); }); });
    }
  };
  function toggleHtml(id, label, sub, on) {
    return '<button type="button" class="field toggle" role="switch" id="' + id + '" aria-checked="' + !!on + '"><span><span style="display:block;font-weight:500">' + label + '</span>' + (sub ? '<span class="faint" style="font-size:12px">' + sub + '</span>' : '') + '</span><span class="sw"></span></button>';
  }
  function bindToggle(el, id, obj, key) {
    var t = $('#' + id, el); if (!t) return;
    t.addEventListener('click', function () { obj[key] = !obj[key]; t.setAttribute('aria-checked', String(obj[key])); });
  }
  function openKantongSheet(k, bukuId) {
    var editable = canWrite(k ? k.buku : bukuId);
    var f = k ? { id: k.id, nama: k.nama, jenis: k.jenis, limit: k.limit, aktif: C.bool(k.aktif) } : { nama: '', jenis: 'Debit', limit: 0, aktif: true, buku: bukuId };
    var cur = k ? ((S.boot.saldo || {})[k.id] || 0) : 0;
    openSheet(k ? (editable ? 'Ubah kantong' : k.nama) : 'Kantong baru', function (sh) {
      function draw() {
        var kredit = f.jenis === 'Kredit';
        sh.el.innerHTML = (editable ? '' : '<div class="readonly-note">' + ICON.lock + '<span>Kantong ini hanya bisa kamu lihat.</span></div>') +
          '<div class="field"><label for="k-nama">Nama</label><input id="k-nama" class="input" maxlength="40" value="' + esc(f.nama) + '" placeholder="mis. BCA, GoPay, Cash"' + (editable ? '' : ' disabled') + '></div>' +
          '<div class="field"><span class="lbl">Jenis</span><div class="seg">' + C.JENIS_KANTONG.map(function (j) { return '<button type="button" data-j="' + j + '" aria-pressed="' + (f.jenis === j) + '"' + (editable ? '' : ' disabled') + '>' + j + '</button>'; }).join('') + '</div></div>' +
          '<div class="field"><label for="k-saldo">' + (kredit ? 'Tagihan saat ini' : 'Saldo saat ini') + '</label><input id="k-saldo" class="input num" inputmode="numeric" value="' + fmt(kredit ? Math.max(0, -cur) : cur) + '"' + (editable ? '' : ' disabled') + '>' +
          '<div class="faint" style="font-size:12px;margin-top:6px">' + (kredit ? 'Disimpan sebagai saldo minus. ' : '') + 'Isi sesuai angka di aplikasi bank. Transaksi berikutnya otomatis mengubah saldo.</div></div>' +
          (kredit ? '<div class="field"><label for="k-limit">Limit kartu</label><input id="k-limit" class="input num" inputmode="numeric" value="' + fmt(f.limit) + '"' + (editable ? '' : ' disabled') + '></div>' : '') +
          (k && editable ? toggleHtml('k-aktif', 'Aktif', 'Kantong nonaktif tidak muncul saat input', f.aktif) : '') +
          (editable ? '<div class="err" id="k-err"></div><button class="btn" id="k-save">Simpan kantong</button>' : '');
        if (!editable) return;
        $('#k-nama', sh.el).addEventListener('input', function (e) { f.nama = e.target.value; });
        ['k-saldo', 'k-limit'].forEach(function (id) { var i = $('#' + id, sh.el); if (i) i.addEventListener('input', function () { var n = parseNum(i.value); i.value = n ? fmt(n) : ''; }); });
        $$('[data-j]', sh.el).forEach(function (b) { b.addEventListener('click', function () { f.jenis = b.getAttribute('data-j'); draw(); }); });
        bindToggle(sh.el, 'k-aktif', f, 'aktif');
        $('#k-save', sh.el).addEventListener('click', function () {
          var saldo = parseNum($('#k-saldo', sh.el).value);
          var p = { id: f.id, nama: f.nama, jenis: f.jenis, buku: f.buku, aktif: f.aktif,
            limit: f.jenis === 'Kredit' ? parseNum(($('#k-limit', sh.el) || {}).value) : 0,
            saldo_sekarang: f.jenis === 'Kredit' ? -saldo : saldo };
          var btn = this; btn.disabled = true;
          settingCall('kantong.save', p, 'Kantong disimpan').then(function () { sh.close(); refresh(); }, function (e) { btn.disabled = false; $('#k-err', sh.el).textContent = e.message; });
        });
      }
      draw();
    });
  }

  var KategoriList = {
    render: function (el) {
      var d = db();
      el.innerHTML = subHeader('Kategori', el) +
        '<div class="seg" style="margin-bottom:16px">' + ['Pengeluaran', 'Pemasukan'].map(function (t) { return '<button data-ct="' + t + '" aria-pressed="' + (S.catTab === t) + '">' + t + '</button>'; }).join('') + '</div>' +
        '<div class="list">' + d.Kategori.filter(function (k) { return k.tipe === S.catTab && k.id !== C.KAT_REIMBURSE; }).sort(function (a, b) { return C.bool(b.aktif) - C.bool(a.aktif) || a.urutan - b.urutan; }).map(function (k) {
          return '<button class="wallet" data-c="' + esc(k.id) + '"' + (C.bool(k.aktif) ? '' : ' style="opacity:.45"') + '><span style="width:12px;height:12px;border-radius:4px;background:' + k.warna + ';flex:none"></span><span class="main"><span class="t1" style="display:block">' + esc(k.nama) + '</span><span class="t2" style="display:flex;gap:6px;flex-wrap:wrap;margin-top:4px">' +
            C.scopeOf(k).map(function (b) { var bk = bukuById(b); return bk ? '<span class="tag" style="--c:' + bukuColor(b) + '"><i></i>' + esc(bk.nama) + '</span>' : ''; }).join('') +
            (C.bool(k.hitung) ? '' : '<span class="tag">tidak dihitung</span>') + (C.bool(k.aktif) ? '' : '<span class="tag">nonaktif</span>') + '</span></span>' + ICON.right.replace('<svg', '<svg width="18" height="18" style="color:var(--text-3)"') + '</button>';
        }).join('') + '</div>' +
        '<button class="btn ghost" id="add-cat">+ Tambah kategori ' + S.catTab.toLowerCase() + '</button>';
      bindBack(el);
      var self = this;
      $$('[data-ct]', el).forEach(function (b) { b.addEventListener('click', function () { S.catTab = b.getAttribute('data-ct'); self.render(el); }); });
      $$('[data-c]', el).forEach(function (b) { b.addEventListener('click', function () { openKategoriSheet(kategoriOf(b.getAttribute('data-c'))); }); });
      $('#add-cat', el).addEventListener('click', function () { openKategoriSheet(null, S.catTab, me().buku); });
    }
  };
  var PALETTE = ['#FFC2B0', '#B8E6CF', '#C9B8FF', '#FFE29A', '#B8D4FF', '#FFC6DA', '#C6EBA8', '#FFD6A5', '#A8E0E8', '#E3C6F2', '#F4B8B8', '#D5DCE6', '#F7D9C4', '#BFE3F5', '#E8E1A6', '#D9C2FF'];
  function openKategoriSheet(k, tipe, bukuId, onSaved) {
    var d = db();
    var f = k ? { id: k.id, nama: k.nama, tipe: k.tipe, buku: C.scopeOf(k), warna: k.warna, hitung: C.bool(k.hitung), aktif: C.bool(k.aktif) }
      : { nama: '', tipe: tipe || 'Pengeluaran', buku: [bukuId || me().buku], warna: PALETTE[d.Kategori.length % PALETTE.length], hitung: true, aktif: true };
    var editable = !k || f.buku.some(function (b) { return canWrite(b); });
    openSheet(k ? (editable ? 'Ubah kategori' : k.nama) : 'Kategori ' + f.tipe.toLowerCase(), function (sh) {
      function draw() {
        sh.el.innerHTML = (editable ? '' : '<div class="readonly-note">' + ICON.lock + '<span>Kategori ini milik buku lain.</span></div>') +
          '<div class="field"><label for="c-nama">Nama</label><input id="c-nama" class="input" maxlength="40" value="' + esc(f.nama) + '"' + (editable ? '' : ' disabled') + '></div>' +
          '<div class="field"><span class="lbl">Dipakai di buku</span><div class="chips wrap">' + d.Buku.map(function (b) {
            var on = f.buku.indexOf(b.id) >= 0, can = canWrite(b.id) && editable;
            return '<button type="button" class="chip" data-cb="' + esc(b.id) + '" aria-pressed="' + on + '" style="--c:' + bukuColor(b.id) + '"' + (can ? '' : ' disabled') + '><span class="dot" style="background:' + bukuColor(b.id) + '"></span>' + esc(b.nama) + '</button>';
          }).join('') + '</div></div>' +
          '<div class="field"><span class="lbl">Warna</span><div class="swatches">' + PALETTE.map(function (c) { return '<button type="button" data-cw="' + c + '" aria-label="Warna ' + c + '" aria-pressed="' + (f.warna.toUpperCase() === c) + '" style="--c:' + c + '"' + (editable ? '' : ' disabled') + '></button>'; }).join('') + '</div></div>' +
          (editable ? toggleHtml('c-hitung', f.tipe === 'Pemasukan' ? 'Hitung sebagai pemasukan' : 'Hitung ke pengeluaran & budget', f.tipe === 'Pemasukan' ? 'Matikan untuk uang titipan atau reimburse' : 'Matikan untuk pos yang tidak ingin dianalisis', f.hitung) : '') +
          (k && editable ? toggleHtml('c-aktif', 'Aktif', 'Kategori nonaktif tetap muncul di riwayat', f.aktif) : '') +
          (editable ? '<div class="err" id="c-err"></div><button class="btn" id="c-save">Simpan kategori</button>' : '');
        if (!editable) return;
        $('#c-nama', sh.el).addEventListener('input', function (e) { f.nama = e.target.value; });
        $$('[data-cb]', sh.el).forEach(function (b) { b.addEventListener('click', function () {
          var id = b.getAttribute('data-cb'), i = f.buku.indexOf(id);
          if (i >= 0) f.buku.splice(i, 1); else f.buku.push(id);
          b.setAttribute('aria-pressed', String(i < 0));
        }); });
        $$('[data-cw]', sh.el).forEach(function (b) { b.addEventListener('click', function () { f.warna = b.getAttribute('data-cw'); $$('[data-cw]', sh.el).forEach(function (x) { x.setAttribute('aria-pressed', String(x === b)); }); }); });
        bindToggle(sh.el, 'c-hitung', f, 'hitung'); bindToggle(sh.el, 'c-aktif', f, 'aktif');
        $('#c-save', sh.el).addEventListener('click', function () {
          var btn = this; btn.disabled = true;
          settingCall('kategori.save', { id: f.id, nama: f.nama, tipe: f.tipe, buku: f.buku.join(','), warna: f.warna, hitung: f.hitung, aktif: f.aktif }, 'Kategori disimpan')
            .then(function (res) { sh.close(); refresh(); if (onSaved) onSaved(res.kategori); }, function (e) { btn.disabled = false; $('#c-err', sh.el).textContent = e.message; });
        });
      }
      draw();
    });
  }

  var BudgetEdit = {
    buku: null, vals: {},
    render: function (el) {
      var d = db(), self = this;
      var writable = C.writableBuku(d, me());
      if (!this.buku || !writable.some(function (b) { return b.id === self.buku; })) this.buku = me().buku;
      el.innerHTML = subHeader('Budget bulanan', el) +
        '<div class="buku-tabs">' + writable.map(function (b) { return '<button data-bb="' + esc(b.id) + '" aria-pressed="' + (self.buku === b.id) + '" style="--c:' + bukuColor(b.id) + '"><i></i>' + esc(b.nama) + '</button>'; }).join('') + '</div>' +
        monthBar() + '<div id="be"></div>';
      bindBack(el);
      $$('[data-bb]', el).forEach(function (b) { b.addEventListener('click', function () { self.buku = b.getAttribute('data-bb'); self.render(el); }); });
      $$('[data-month]', el).forEach(function (b) { b.addEventListener('click', function () { S.bulan = shiftMonth(S.bulan, +b.getAttribute('data-month')); self.render(el); }); });
      var m = ensureMonth(S.bulan), box = $('#be', el);
      if (!m) { box.innerHTML = skeleton(6); this.waiting = true; return; }
      this.waiting = false;
      var eff = (m.budget || {})[this.buku] || { sumber: null, items: {} };
      var cats = d.Kategori.filter(function (k) { return k.tipe === 'Pengeluaran' && (C.bool(k.aktif) || eff.items[k.id]) && C.scopeOf(k).indexOf(self.buku) >= 0; })
        .sort(function (a, b) { return a.urutan - b.urutan; });
      this.vals = {}; cats.forEach(function (k) { self.vals[k.id] = eff.items[k.id] || 0; });
      var note = !eff.sumber ? 'Belum ada budget. Isi lalu simpan, bulan berikutnya otomatis ikut.' :
        eff.sumber !== S.bulan ? 'Bulan ini mengikuti budget ' + monthName(eff.sumber) + '. Simpan untuk mengubah mulai ' + monthName(S.bulan) + '.' : 'Budget khusus ' + monthName(S.bulan) + '. Bulan berikutnya ikut angka ini.';
      box.innerHTML = '<p class="faint" style="font-size:13px;margin:0 0 12px">' + note + '</p><div class="list">' + cats.map(function (k) {
        return '<div class="budget-row" style="--c:' + k.warna + '"><span class="name"><span class="dot"></span><span style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap">' + esc(k.nama) + '</span></span><input class="input num" inputmode="numeric" data-bv="' + esc(k.id) + '" value="' + (self.vals[k.id] ? fmt(self.vals[k.id]) : '') + '" placeholder="0" aria-label="Budget ' + esc(k.nama) + '"></div>';
      }).join('') + '</div><div class="total-row"><span>Total budget</span><span class="num" id="bt" style="color:var(--text);font-weight:700"></span></div>' +
        '<div class="sticky-save"><button class="btn" id="b-save" style="margin:0">Simpan budget ' + BULAN[+S.bulan.slice(5) - 1] + '</button></div>';
      var total = function () { $('#bt', box).textContent = rp(Object.keys(self.vals).reduce(function (s, k) { return s + self.vals[k]; }, 0)); };
      total();
      $$('[data-bv]', box).forEach(function (i) { i.addEventListener('input', function () {
        var n = parseNum(i.value); self.vals[i.getAttribute('data-bv')] = n; i.value = n ? fmt(n) : ''; total();
      }); });
      $('#b-save', box).addEventListener('click', function () {
        var btn = this; btn.disabled = true;
        settingCall('budget.save', { bulan: S.bulan, buku: self.buku, items: self.vals }, 'Budget disimpan').then(function () { btn.disabled = false; }, function () { btn.disabled = false; });
      });
    },
    update: function (el) { if (this.waiting) this.render(el); }
  };
  // Pengaturan memakai sub-view; update hanya untuk sub-view yang menunggu data
  var _sr = SettingsView.update;
  SettingsView.update = function (el) {
    if (S.sub && S.sub.type === 'budget') return BudgetEdit.update(el);
    if (S.sub) return ({ kantong: KantongList, kategori: KategoriList })[S.sub.type].render(el);
    return _sr.call(SettingsView, el);
  };

  // ================= Beranda (index.html) =================
  // Satu pintu: ringkasan Kantong, pengingat evaluasi, to-do & catatan, mood → Ruang Catat.
  // Memakai state, antrean offline, dan sheet yang sama dengan Kantong.
  var RUANG_CATAT_URL = 'ruang-catat/';
  var MOODS = [['berat', 'Berat', '#F87171', 'M8 16.5c1.2-1.6 2.5-2.3 4-2.3s2.8.7 4 2.3'], ['lelah', 'Lelah', '#FB923C', 'M8.5 15.5c1-.7 2.2-1 3.5-1s2.5.3 3.5 1'],
    ['biasa', 'Biasa', '#FCD34D', 'M8.5 15h7'], ['baik', 'Baik', '#86EFAC', 'M8.5 14.5c1 .8 2.2 1.2 3.5 1.2s2.5-.4 3.5-1.2'], ['senang', 'Senang', '#7DD3A8', 'M8 13.5c1 2 2.4 3 4 3s3-1 4-3']];
  function moodSvg(m) {
    return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M9 9.8v.4M15 9.8v.4"/><path d="' + m[3] + '"/></svg>';
  }
  function sapaan() { var h = new Date().getHours(); return h < 11 ? 'Pagi' : h < 15 ? 'Siang' : h < 18 ? 'Sore' : 'Malam'; }
  function nowLocal() { return todayISO() + 'T' + nowHM(); }
  function bukuRT() { return db().Buku.filter(function (b) { return b.tipe === 'Bersama'; })[0] || null; }
  function saldoBuku(bukuId) {
    var saldo = (S.boot && S.boot.saldo) || {};
    return db().Kantong.filter(function (k) { return C.bool(k.aktif) && k.buku === bukuId; })
      .reduce(function (s, k) { return s + (saldo[k.id] || 0); }, 0);
  }
  function brSisa(menit) {
    if (menit <= 0) return 'Sedang berlangsung';
    if (menit < 60) return menit + ' menit lagi';
    var j = Math.floor(menit / 60), m = menit % 60;
    return j + ' jam' + (m >= 10 ? ' ' + m + ' mnt' : '') + ' lagi';
  }
  function brTanggal(t) {
    var d = dateObj(t.tanggal);
    return HARI_P[d.getDay()] + ', ' + d.getDate() + ' ' + BULAN[d.getMonth()].slice(0, 3) + (t.jam ? ' · ' + t.jam.replace(':', '.') : ' · seharian');
  }
  function brSyncLine() {
    var timed = todos().filter(function (t) { return C.todoPerluEvent(t); });
    var gagal = timed.filter(function (t) { return !t._pending && t.gcal_status === 'gagal'; });
    var ic = '<span class="br-sync-ic">' + ICON.cal + '</span>', cls = '', txt;
    if (S.conn && S.conn.mode === 'demo') txt = 'Mode demo · data contoh di HP ini';
    else if (S.outbox.length) { txt = S.syncing || !S.lastError ? 'Menyinkronkan ' + S.outbox.length + ' perubahan…' : 'Offline · ' + S.outbox.length + ' perubahan menunggu koneksi'; cls = ' wait'; }
    else if (gagal.length && /belum disiapkan/i.test(gagal[0].gcal_error || '')) { txt = 'Google Calendar belum disiapkan'; cls = ' bad'; }
    else if (gagal.length) { txt = gagal.length + ' to-do gagal masuk Google Calendar'; cls = ' bad'; }
    else txt = 'Tersinkron ke Google Calendar' + (S.lastSync ? ' · ' + agoLabel(S.lastSync) : '');
    return '<button type="button" class="br-sync' + cls + '" data-act="sync" aria-label="' + esc(txt) + '. Ketuk untuk sinkron sekarang">' + ic + '<span>' + esc(txt) + '</span></button>';
  }
  function renderBerandaShell(app) {
    document.body.classList.add('br-page');
    var nav = [['beranda', 'Beranda', ICON.house], ['kantong', 'Kantong', ICON.wallet], ['tambah', 'Tambah', ICON.plus], ['agenda', 'Agenda', ICON.cal], ['komitmen', 'Komitmen', ICON.heart]];
    app.innerHTML = (S.conn.mode === 'demo' ? '<div class="br-demo">Mode demo, data contoh. <button data-act="leave-demo">Keluar</button></div>' : '') +
      '<main id="view" class="br-view"></main>' +
      '<nav class="br-nav" aria-label="Menu utama">' + nav.map(function (x) {
        return '<button type="button" data-brnav="' + x[0] + '"' + (x[0] === 'tambah' ? ' class="br-fab" aria-label="Tambah to-do atau catatan"' : ' aria-current="' + (S.tab === x[0] ? 'page' : 'false') + '"') + '>' +
          '<span class="ic">' + x[2] + '</span>' + (x[0] === 'tambah' ? '' : '<span>' + x[1] + '</span>') + '</button>';
      }).join('') + '</nav>';
    $$('[data-brnav]', app).forEach(function (b) { b.addEventListener('click', function () { brNav(b.getAttribute('data-brnav')); }); });
    renderView();
  }
  function brNav(id) {
    if (id === 'kantong') { location.href = 'kantong.html'; return; }
    if (id === 'agenda') { location.href = 'kantong.html#todo'; return; }
    if (id === 'komitmen') { location.href = 'komitmen.html'; return; }
    if (id === 'tambah') {
      if (S.tab !== 'beranda') brGo('beranda');
      var box = $('#br-add'); if (!box) return;
      box.scrollIntoView({ behavior: 'smooth', block: 'center' });
      var inp = $('#br-add-in'); if (inp) setTimeout(function () { inp.focus(); }, 250);
      return;
    }
    brGo(id);
  }
  function brGo(id) {
    S.tab = id; S.sub = null;
    $$('[data-brnav]').forEach(function (x) { if (x.hasAttribute('aria-current')) x.setAttribute('aria-current', x.getAttribute('data-brnav') === id ? 'page' : 'false'); });
    renderView(); window.scrollTo(0, 0);
  }
  function openTxBaru() {
    openSheet('Catat transaksi', function (sh) { txForm(sh.el, null, { onDone: function () { sh.close(); } }); });
  }

  var BerandaView = {
    add: { tipe: 'todo', pemilik: '' },
    mood: '',
    render: function (el) {
      var self = this, user = me();
      var cari = function (id) { return $('#' + id, el); };
      el.innerHTML = '<div class="br-wrap">' +
        '<header class="br-head"><div><div class="br-date">' + esc(longToday()) + ' ' + new Date().getFullYear() + '</div><h1>' + sapaan() + ', ' + esc(user.nama) + '</h1></div>' +
        (S.conn.mode === 'demo' ? '<div class="br-who" role="group" aria-label="Lihat sebagai (mode demo)">' + db().Users.map(function (u) {
          return '<button type="button" data-who="' + esc(u.id) + '" aria-pressed="' + (u.id === user.id) + '" aria-label="Lihat sebagai ' + esc(u.nama) + '">' + esc(u.nama.charAt(0)) + '</button>';
        }).join('') + '</div>' : '') + '</header>' +
        '<div id="br-sync"></div>' +
        '<nav class="br-short" aria-label="Pintasan">' +
          '<a href="kantong.html" style="--c:#7DD3A8;--cb:#1B2A23"><span class="ic">' + ICON.wallet + '</span>Kantong</a>' +
          '<a href="kantong.html#todo" style="--c:#93C5FD;--cb:#1A2433"><span class="ic">' + ICON.cal + '</span>Agenda</a>' +
          '<a href="komitmen.html" style="--c:#FCD34D;--cb:#2A2614"><span class="ic">' + ICON.heart + '</span>Komitmen</a>' +
          '<a href="' + RUANG_CATAT_URL + '" style="--c:#C4B5FD;--cb:#252137"><span class="ic">' + ICON.book + '</span><span>Ruang Catat <i class="ext">' + ICON.ext + '</i></span></a>' +
        '</nav>' +
        '<div class="br-grid"><div class="br-col main">' +
          '<section class="br-card br-kantong" id="br-kantong" aria-labelledby="br-kantong-h"></section>' +
          '<div id="br-eval-m" class="br-eval-slot m"></div>' +
          '<section class="br-card" id="br-todo" aria-labelledby="br-todo-h"></section>' +
          '<section class="br-card br-add" id="br-add" aria-label="Tambah cepat"></section>' +
        '</div><div class="br-col side">' +
          '<div id="br-eval-d" class="br-eval-slot d"></div>' +
          '<section class="br-card br-mood" id="br-mood" aria-labelledby="br-mood-h"></section>' +
        '</div></div></div>';
      $$('[data-who]', el).forEach(function (b) { b.addEventListener('click', function () {
        if (b.getAttribute('data-who') === user.id) return;
        S.prefs.demoUser = b.getAttribute('data-who'); self.add.pemilik = ''; persist(); S.boot = null; S.todos = null; renderView(); sync();
      }); });
      $$('[data-brgo]', el).forEach(function (b) { b.addEventListener('click', function () { brGo(b.getAttribute('data-brgo')); }); });
      this.renderAdd(cari('br-add'));
      this.renderMood(cari('br-mood'));
      this.update(el);
    },
    update: function (el) {
      if (!$('#br-kantong', el)) return this.render(el);
      $('#br-sync', el).innerHTML = brSyncLine();
      this.renderKantong($('#br-kantong', el));
      var ev = this.evalHtml(), slot = window.matchMedia && matchMedia('(min-width: 900px)').matches ? 'd' : 'm';
      $('#br-eval-m', el).innerHTML = slot === 'm' ? ev : '';
      $('#br-eval-d', el).innerHTML = slot === 'd' ? ev : '';
      this.bindEval(el);
      this.renderTodo($('#br-todo', el));
    },
    renderKantong: function (box) {
      var user = me(), rt = bukuRT(), m = ensureMonth(thisMonth());
      var head = '<div class="br-card-h"><h2 id="br-kantong-h"><span class="br-ic" style="--c:#7DD3A8;--cb:#1B2A23">' + ICON.wallet + '</span>Kantong</h2><a class="br-lnk" href="kantong.html">Buka</a></div>';
      if (!m) { box.innerHTML = head + '<div class="br-skel-line"></div><div class="br-skel-line"></div>'; return; }
      var d = db(), s = rt ? C.summarize(d, m.transaksi, m.budget, rt.id) : null;
      var used = s && s.budgetTotal ? s.pengeluaran / s.budgetTotal : 0;
      var pct = Math.round(used * 100);
      var rtHtml = rt ? '<div class="br-rt"><div class="br-lbl">Sisa dompet ' + esc(rt.nama) + '</div>' +
        '<div class="br-big num">' + rp(saldoBuku(rt.id)) + '</div>' +
        (s.budgetTotal ? '<div class="br-bar' + (used > 1 ? ' over' : '') + '" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="' + Math.min(pct, 100) + '" aria-label="Budget rumah tangga terpakai ' + pct + ' persen"><i style="width:' + Math.min(100, pct) + '%"></i></div>' +
          '<div class="br-foot"><span>Terpakai ' + pct + '%</span><span>dari budget ' + rp(s.budgetTotal) + '</span></div>'
          : '<div class="br-foot"><span>Budget bulan ini belum diatur</span></div>') + '</div>' : '';
      var pribadi = '<div class="br-inset br-pribadi"><span class="br-lbl">Saldo pribadi ' + esc(user.nama) + '</span><span class="num">' + rp(saldoBuku(user.buku)) + '</span></div>';
      // transaksi terakhir: buku RT + buku pribadi user, urut terbaru
      var bukuSaya = [user.buku].concat(rt ? [rt.id] : []);
      var semua = [];
      Object.keys(S.months).sort().reverse().slice(0, 2).forEach(function (b) { semua = semua.concat(S.months[b].transaksi || []); });
      var last = semua.filter(function (t) { return bukuSaya.some(function (bk) { return C.txInBuku(d, t, bk); }); })
        .sort(function (a, b) { return (String(b.tanggal) + String(b.dibuat || '9')).localeCompare(String(a.tanggal) + String(a.dibuat || '9')); }).slice(0, 3);
      var rows = last.length ? last.map(function (t) {
        var k = kategoriOf(t.kategori), keluar = t.tipe === 'Pengeluaran', masuk = t.tipe === 'Pemasukan';
        var bk = bukuById(t.buku), label = bk && bk.tipe === 'Bersama' ? 'RT' : 'Pribadi';
        return '<button type="button" class="br-tx" data-tx="' + esc(t.id) + '"><span class="dot" style="background:' + esc(k ? k.warna : '#9AA3B2') + '"></span>' +
          '<span class="main"><span class="t1">' + esc(t.keterangan || (k ? k.nama : t.tipe)) + '</span><span class="t2">' + esc(dayLabel(t.tanggal)) + ' · ' + label + (k ? ' · ' + esc(k.nama) : '') + '</span></span>' +
          '<span class="amt num' + (masuk ? ' in' : '') + '">' + (keluar ? '−' : masuk ? '+' : '') + rp(t.nominal).replace('−', '') + '</span></button>';
      }).join('') : '<div class="br-empty">Belum ada transaksi bulan ini.</div>';
      box.innerHTML = head + '<div class="br-kantong-cols"><div>' + rtHtml + pribadi + '</div>' +
        '<div><div class="br-sub">Transaksi terakhir</div><div class="br-txs">' + rows + '</div></div></div>' +
        '<button type="button" class="br-btn primary" id="br-catat">' + ICON.plus + 'Catat transaksi</button>';
      $('#br-catat', box).addEventListener('click', openTxBaru);
      $$('[data-tx]', box).forEach(function (b) { b.addEventListener('click', function () { openTxSheet(findTx(b.getAttribute('data-tx'))); }); });
    },
    evalHtml: function () {
      var p = C.evaluasiPengingat(todos(), nowLocal());
      if (!p) return '';
      var tunda = LS.get('k_eval_tunda', null);
      if (tunda && tunda.id === p.todo.id && tunda.sampai > Date.now()) return '';
      var kc = LS.get('k_komitmen', null), kd = kc && kc.data;
      var info = kd ? ' · ' + kd.berlaku + ' kesepakatan aktif' + (kd.menunggu_ttd ? ' · ' + kd.menunggu_ttd + ' menunggu tanda tanganmu' : '') : '';
      return '<section class="br-card br-eval" aria-labelledby="br-eval-h"><div class="br-eval-top"><span class="br-ic" style="--c:#FCD34D;--cb:#2A2614">' + ICON.heart + '</span>' +
        '<div><h2 id="br-eval-h">' + esc(p.todo.judul) + ' · ' + esc(brSisa(p.menit)) + '</h2><div class="br-eval-d">' + esc(brTanggal(p.todo)) + info + '</div></div></div>' +
        '<p>Siapkan catatan: mana kesepakatan yang jalan, mana yang perlu dibahas ulang.</p>' +
        '<div class="br-eval-act"><a class="br-btn amber" href="komitmen.html">Lihat kesepakatan</a>' +
        '<button type="button" class="br-btn ghost" data-eval-tunda="' + esc(p.todo.id) + '">Ingatkan nanti</button></div></section>';
    },
    bindEval: function (el) {
      $$('[data-eval-tunda]', el).forEach(function (b) { b.addEventListener('click', function () {
        LS.set('k_eval_tunda', { id: b.getAttribute('data-eval-tunda'), sampai: Date.now() + 60 * 60000 });
        toast('Diingatkan lagi 1 jam lagi'); BerandaView.update($('#view'));
      }); });
    },
    renderTodo: function (box) {
      var f = todoFilter(), today = todayISO();
      var head = '<div class="br-card-h"><h2 id="br-todo-h"><span class="br-ic" style="--c:#93C5FD;--cb:#1A2433">' + ICON.check + '</span>To-do</h2>';
      if (S.todos === null) { box.innerHTML = head + '</div><div class="br-skel-line"></div><div class="br-skel-line"></div>'; return; }
      var semua = todos().filter(function (t) { return todoMatch(t, f); });
      var tugas = semua.filter(function (t) { return C.todoTipe(t) !== 'catatan'; });
      var buka = todoSorted(tugas.filter(function (t) { return !C.bool(t.selesai); }));
      var beres = tugas.filter(function (t) { return C.bool(t.selesai) && String(t.diubah || '').slice(0, 10) === today; });
      var notes = semua.filter(function (t) { return C.todoTipe(t) === 'catatan'; })
        .sort(function (a, b) { return String(b.diubah || b.dibuat || '').localeCompare(String(a.diubah || a.dibuat || '')); });
      var tampil = buka.slice(0, 6).concat(beres.slice(0, 2));
      box.innerHTML = head + '<span class="br-count">' + beres.length + ' dari ' + (buka.length + beres.length) + ' selesai</span></div>' +
        '<div class="br-chips" role="group" aria-label="Filter to-do">' + [['untukku', 'Untukku'], ['bersama', 'Bersama'], ['semua', 'Semua']].map(function (x) {
          return '<button type="button" data-brtf="' + x[0] + '" aria-pressed="' + (f === x[0]) + '">' + x[1] + '</button>';
        }).join('') + '</div>' +
        (tampil.length ? '<div class="br-todos">' + tampil.map(brTodoRow).join('') + '</div>' : '<div class="br-empty">' + (buka.length + beres.length ? '' : 'Belum ada to-do. Tulis satu di bawah.') + '</div>') +
        (buka.length > 6 ? '<a class="br-more" href="kantong.html#todo">+' + (buka.length - 6) + ' to-do lainnya</a>' : '') +
        (notes.length ? '<div class="br-sub" style="margin-top:6px">Catatan</div><div class="br-todos">' + notes.slice(0, 3).map(brNoteRow).join('') + '</div>' +
          (notes.length > 3 ? '<a class="br-more" href="kantong.html#todo">Semua catatan (' + notes.length + ')</a>' : '') : '');
      $$('[data-brtf]', box).forEach(function (b) { b.addEventListener('click', function () {
        S.prefs.todoFilter = b.getAttribute('data-brtf'); persist(); BerandaView.renderTodo(box);
      }); });
      $$('[data-tdone]', box).forEach(function (b) { b.addEventListener('click', function () { toggleTodoDone(findTodo(b.getAttribute('data-tdone'))); }); });
      $$('[data-todo]', box).forEach(function (b) { b.addEventListener('click', function () { var t = findTodo(b.getAttribute('data-todo')); if (t) openTodoSheet(t); }); });
    },
    renderAdd: function (box) {
      var self = this, a = this.add, user = me();
      if (!a.pemilik) a.pemilik = user.id;
      var p = todoPemilikInfo(a.pemilik), isTodo = a.tipe === 'todo';
      box.innerHTML = '<div class="br-seg" role="group" aria-label="Jenis">' + [['todo', 'To-do'], ['catatan', 'Catatan']].map(function (x) {
          return '<button type="button" data-addt="' + x[0] + '" aria-pressed="' + (a.tipe === x[0]) + '">' + x[1] + '</button>';
        }).join('') + '</div>' +
        '<div class="br-add-row">' + (isTodo
          ? '<input id="br-add-in" class="br-input" type="text" maxlength="120" autocomplete="off" enterkeyhint="done" placeholder="Tambah to-do…" aria-label="To-do baru">'
          : '<textarea id="br-add-in" class="br-input" rows="3" maxlength="2000" placeholder="Tulis catatan…" aria-label="Catatan baru"></textarea>') +
        '</div><div class="br-add-opts">' +
          (isTodo ? '<button type="button" class="br-pill blue" id="br-add-time">' + ICON.cal + 'Atur waktu</button>' : '') +
          '<button type="button" class="br-pill" id="br-add-who" aria-label="Untuk ' + esc(p.nama) + '. Ketuk untuk ganti">' + ICON.user + 'Untuk: ' + esc(p.id === user.id ? user.nama : p.nama) + '</button>' +
          '<button type="button" class="br-btn primary small" id="br-add-save">Simpan</button>' +
        '</div><p class="br-help">' + (isTodo ? 'Tanpa waktu: disimpan di app saja. Atur waktu → masuk Google Calendar.' : 'Catatan tidak masuk kalender. Pilih "Bersama" supaya bisa dibaca berdua.') + '</p>';
      var inp = $('#br-add-in', box);
      function simpan() {
        var v = inp.value.trim(); if (!v) { inp.focus(); return; }
        var ok = simpanTodo(isTodo ? { tipe: 'todo', judul: v, pemilik: a.pemilik, aturWaktu: false, durasi: C.TODO_DURASI }
          : { tipe: 'catatan', isi: v, pemilik: a.pemilik, aturWaktu: false, durasi: C.TODO_DURASI }, null);
        if (ok) { inp.value = ''; inp.focus(); }
      }
      $$('[data-addt]', box).forEach(function (b) { b.addEventListener('click', function () { a.tipe = b.getAttribute('data-addt'); var v = inp.value; self.renderAdd(box); $('#br-add-in', box).value = v; }); });
      inp.addEventListener('keydown', function (e) { if (isTodo && e.key === 'Enter') { e.preventDefault(); simpan(); } });
      $('#br-add-save', box).addEventListener('click', simpan);
      $('#br-add-who', box).addEventListener('click', function () {
        var list = todoPemilikList().map(function (x) { return x.id; });
        a.pemilik = list[(list.indexOf(a.pemilik) + 1) % list.length];
        var v = inp.value; self.renderAdd(box); var ni = $('#br-add-in', box); ni.value = v;
      });
      var tm = $('#br-add-time', box);
      if (tm) tm.addEventListener('click', function () { openTodoSheet(null, { tipe: 'todo', judul: inp.value.trim(), pemilik: a.pemilik, aturWaktu: true }); inp.value = ''; });
    },
    renderMood: function (box) {
      var self = this, cur = this.mood;
      box.innerHTML = '<div class="br-card-h"><h2 id="br-mood-h"><span class="br-ic" style="--c:#C4B5FD;--cb:#252137">' + ICON.book + '</span>Ruang Catat</h2></div>' +
        '<p class="br-q">Gimana rasanya hari ini?</p>' +
        '<div class="br-moods" role="radiogroup" aria-label="Mood hari ini">' + MOODS.map(function (m) {
          return '<button type="button" role="radio" aria-checked="' + (cur === m[0]) + '" data-mood="' + m[0] + '" style="--c:' + m[2] + '"><span class="face">' + moodSvg(m) + '</span><span>' + m[1] + '</span></button>';
        }).join('') + '</div>' +
        (cur ? '<a class="br-btn violet" href="' + RUANG_CATAT_URL + '?mood=' + cur + '">Lanjut tulis di Ruang Catat <i class="ext">' + ICON.ext + '</i></a>'
          : '<p class="br-help">Pilih satu, lalu lanjut menulis di Ruang Catat. Mood tidak disimpan di Beranda.</p>');
      $$('[data-mood]', box).forEach(function (b) { b.addEventListener('click', function () {
        var m = b.getAttribute('data-mood'); self.mood = self.mood === m ? '' : m; self.renderMood(box);
        var nb = $('[data-mood="' + m + '"]', box); if (nb) nb.focus();
      }); });
    }
  };
  function brTodoRow(t) {
    var bisa = canWriteTodo(t), selesai = C.bool(t.selesai), p = todoPemilikInfo(t.pemilik), ev = C.todoTipe(t) === 'evaluasi';
    var meta;
    if (t.tanggal) {
      var gagal = !t._pending && t.gcal_status === 'gagal';
      meta = '<span class="br-when' + (gagal || todoTerlewat(t) ? ' bad' : '') + '">' + (gagal ? ICON.calx : ICON.cal) + esc(todoWaktuLabel(t)) + '</span>' +
        (t.pemilik !== me().id ? '<span class="br-owner">' + esc(p.nama) + '</span>' : '');
    } else meta = '<span class="br-owner">' + esc(p.id === me().id ? me().nama : p.nama) + '</span>';
    if (ev) meta = '<span class="br-owner amber">' + ICON.heart + 'Evaluasi</span>' + meta;
    return '<div class="br-todo' + (selesai ? ' done' : '') + '">' +
      '<button type="button" class="br-chk" role="checkbox" aria-checked="' + selesai + '" data-tdone="' + esc(t.id) + '" aria-label="' + (selesai ? 'Batalkan selesai' : 'Tandai selesai') + ': ' + esc(t.judul) + '"' + (bisa ? '' : ' disabled') + '><i>' + ICON_CHECK + '</i></button>' +
      '<button type="button" class="br-todo-main" data-todo="' + esc(t.id) + '"><span class="t1">' + esc(t.judul) + '</span><span class="t2">' + meta + '</span></button></div>';
  }
  function brNoteRow(t) {
    var p = todoPemilikInfo(t.pemilik);
    return '<div class="br-todo note"><span class="br-note-ic">' + ICON.note + '</span>' +
      '<button type="button" class="br-todo-main" data-todo="' + esc(t.id) + '"><span class="t1">' + esc(t.judul) + '</span><span class="t2"><span class="br-owner">' + esc(p.id === me().id ? 'Pribadi' : p.nama) + '</span></span></button></div>';
  }
  var ICON_CHECK = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12l5 5 9-10"/></svg>';

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
        // API bisa Supabase Edge Function (…/functions/v1/kantong) atau Apps Script lama (script.google.com)
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

  // ================= demo seed (data contoh, bukan data asli) =================
  function makeDemoSeed() {
    var P = 'riki,istri', ALL = 'riki,istri,rt';
    var kat = [['makan-jajan', 'Makan/jajan', P], ['ojol-taxi', 'Ojol/taxi', P], ['kendaraan-pribadi', 'Kendaraan pribadi', P], ['paket-data', 'Paket data', P],
      ['subscription', 'Subscription', P], ['kesehatan', 'Kesehatan', P], ['personal-care', 'Personal care', P], ['work', 'Work', 'riki'],
      ['belanja-dapur', 'Belanja dapur', 'rt'], ['listrik-air', 'Listrik & air', 'rt'], ['kebutuhan-rumah', 'Kebutuhan rumah', 'rt'], ['lain-lain', 'Lain-lain', ALL]]
      .map(function (k, i) { return { id: k[0], nama: k[1], tipe: 'Pengeluaran', buku: k[2], warna: PALETTE[i], hitung: true, aktif: true, urutan: i + 1 }; })
      .concat([{ id: 'gaji', nama: 'Gaji', tipe: 'Pemasukan', buku: ALL, warna: '#34D399', hitung: true, aktif: true, urutan: 20 },
        { id: 'pendapatan-lain', nama: 'Pendapatan lain', tipe: 'Pemasukan', buku: ALL, warna: '#5EEAD4', hitung: true, aktif: true, urutan: 21 },
        { id: C.KAT_REIMBURSE, nama: 'Reimburse masuk', tipe: 'Pemasukan', buku: ALL, warna: '#9CA3AF', hitung: false, aktif: true, urutan: 99 }]);
    var per = C.addDays(thisMonth() + '-01', -1);
    var kan = [['cash-riki', 'Cash', 'Cash', 'riki', 350000, 0], ['bca', 'BCA', 'Debit', 'riki', 4200000, 0], ['kk-bca', 'Kartu Kredit BCA', 'Kredit', 'riki', -850000, 10000000],
      ['cash-istri', 'Cash', 'Cash', 'istri', 200000, 0], ['rek-istri', 'Rekening', 'Debit', 'istri', 2500000, 0], ['kas-rt', 'Dompet RT', 'Debit', 'rt', 600000, 0]]
      .map(function (k, i) { return { id: k[0], nama: k[1], jenis: k[2], buku: k[3], saldo_awal: k[4], per_tanggal: per, limit: k[5], aktif: true, urutan: i + 1 }; });
    var bm = thisMonth(), bud = [];
    [['riki', { 'makan-jajan': 600000, 'ojol-taxi': 300000, 'kendaraan-pribadi': 200000, 'paket-data': 150000, 'subscription': 250000, 'work': 400000, 'setoran-rt': 5300000 }],
      ['istri', { 'makan-jajan': 500000, 'personal-care': 300000, 'kesehatan': 200000, 'setoran-rt': 1000000 }],
      ['rt', { 'belanja-dapur': 3000000, 'listrik-air': 800000, 'kebutuhan-rumah': 700000 }]].forEach(function (x) {
      Object.keys(x[1]).forEach(function (k) { bud.push({ id: bm + '|' + x[0] + '|' + k, bulan: bm, buku: x[0], kategori: k, nominal: x[1][k] }); });
    });
    var seedN = 7, rnd = function () { seedN = (seedN * 16807) % 2147483647; return seedN / 2147483647; };
    var tx = [], today = new Date().getDate();
    var add = function (day, tipe, n, buku, kat, kantong, ket, oleh, tujuan) {
      tx.push({ id: 'demo-' + tx.length, tanggal: bm + '-' + pad(day), tipe: tipe, nominal: n, buku: buku, kategori: kat || '', kantong: kantong, kantong_tujuan: tujuan || '',
        keterangan: ket, reimburse: false, oleh: oleh, sumber: 'demo', dibuat: bm + '-' + pad(day) + 'T0' + (tx.length % 9) + ':00:00+07:00', diubah: '', dihapus: '', terbayar: '', tx_balik: '' });
    };
    add(1, 'Transfer', 5300000, 'riki', '', 'bca', 'Topup rumah tangga', 'riki', 'kas-rt');
    add(1, 'Transfer', 1000000, 'istri', '', 'rek-istri', 'Topup rumah tangga', 'istri', 'kas-rt');
    add(1, 'Pengeluaran', 50000, 'riki', 'subscription', 'bca', 'Netflix', 'riki');
    for (var dday = 1; dday <= today; dday++) {
      if (rnd() < 0.8) add(dday, 'Pengeluaran', Math.round((15 + rnd() * 45)) * 1000, 'riki', 'makan-jajan', rnd() < .3 ? 'cash-riki' : 'bca', ['indomaret', 'bakso', 'kopi', 'nasi padang'][Math.floor(rnd() * 4)], 'riki');
      if (rnd() < 0.35) { var j = Math.floor(rnd() * 3); add(dday, 'Pengeluaran', Math.round((20 + rnd() * 40)) * 1000, 'riki', ['ojol-taxi', 'work', 'kendaraan-pribadi'][j], 'bca', ['gojek', 'fore', 'bensin'][j], 'riki'); }
      if (rnd() < 0.5) add(dday, 'Pengeluaran', Math.round((40 + rnd() * 160)) * 1000, 'rt', 'belanja-dapur', 'kas-rt', ['pasar', 'sayur', 'superindo'][Math.floor(rnd() * 3)], rnd() < .7 ? 'istri' : 'riki');
      if (rnd() < 0.4) { var q = Math.floor(rnd() * 2); add(dday, 'Pengeluaran', Math.round((10 + rnd() * 50)) * 1000, 'istri', ['makan-jajan', 'personal-care'][q], 'rek-istri', ['jajan', 'skincare'][q], 'istri'); }
    }
    add(Math.min(today, 5), 'Pengeluaran', 420000, 'rt', 'listrik-air', 'kas-rt', 'token listrik', 'istri');
    // talangan: belanja RT dibayar pakai uang pribadi (muncul di daftar talangan, per transaksi)
    add(Math.min(today, 4), 'Pengeluaran', 85000, 'rt', 'kebutuhan-rumah', 'bca', 'galon & sabun', 'riki');
    add(Math.min(today, 6), 'Pengeluaran', 132500, 'rt', 'belanja-dapur', 'bca', 'superindo mingguan', 'riki');
    add(Math.min(today, 8), 'Pengeluaran', 47000, 'rt', 'belanja-dapur', 'cash-riki', 'buah tukang sayur', 'riki');
    add(Math.min(today, 9), 'Pengeluaran', 215000, 'rt', 'kebutuhan-rumah', 'bca', 'lampu & colokan', 'riki');
    add(Math.min(today, 5), 'Pengeluaran', 60000, 'rt', 'belanja-dapur', 'rek-istri', 'sayur pasar', 'istri');
    // reimburse kantor: satu menunggu, satu sudah terbayar
    add(Math.min(today, 3), 'Pengeluaran', 828000, 'riki', 'work', 'bca', 'hotel dinas Purwokerto', 'riki');
    tx[tx.length - 1].reimburse = true;
    add(Math.min(today, 2), 'Pengeluaran', 350000, 'riki', 'work', 'bca', 'kereta dinas', 'riki');
    var pd = tx[tx.length - 1]; pd.reimburse = true; pd.terbayar = bm + '-' + pad(Math.min(today, 4)); pd.tx_balik = 'rb-' + pd.id;
    tx.push({ id: pd.tx_balik, tanggal: pd.terbayar, tipe: 'Pemasukan', nominal: 350000, buku: 'riki', kategori: C.KAT_REIMBURSE, kantong: 'bca', kantong_tujuan: '',
      keterangan: 'Reimburse: kereta dinas', reimburse: false, oleh: 'riki', sumber: 'auto', dibuat: pd.terbayar + 'T09:00:00+07:00', diubah: '', dihapus: '', terbayar: '', tx_balik: '' });
    // to-do contoh: campuran dengan waktu, tanpa waktu, bersama, dan yang sudah selesai
    var t0 = todayISO(), td = [];
    var tdAdd = function (n, judul, pemilik, tanggal, jam, selesai, tipe, isi) {
      var kapan = (tanggal || t0) + 'T08:0' + n + ':00+07:00';
      td.push({ id: 'demo-td-' + n, tipe: tipe || 'todo', isi: isi || '', judul: judul, pemilik: pemilik, tanggal: tanggal, jam: jam, durasi: tipe === 'evaluasi' ? 60 : 30,
        selesai: !!selesai, selesai_oleh: selesai ? 'istri' : '', gcal_event_id: tanggal ? 'demo-ev-' + n : '',
        gcal_status: tanggal ? 'ok' : '', gcal_error: '', oleh: pemilik === 'bersama' ? 'riki' : pemilik,
        dibuat: kapan, diubah: kapan, dihapus: '' });
    };
    tdAdd(1, 'Bayar listrik & air', 'bersama', t0, '19:00');
    tdAdd(2, 'Beli galon', 'riki', '', '');
    tdAdd(3, 'Jemput paket di agen', 'istri', C.addDays(t0, 1), '10:00');
    tdAdd(4, 'Servis AC kamar', 'bersama', C.addDays(t0, 3), '');
    tdAdd(5, 'Transfer arisan', 'istri', C.addDays(t0, -1), '16:00', true);
    // agenda evaluasi ~3 jam lagi supaya kartu pengingat terlihat di demo
    var ev = new Date(Date.now() + 3 * 3600000);
    tdAdd(6, 'Evaluasi bulanan', 'bersama', ev.getFullYear() + '-' + pad(ev.getMonth() + 1) + '-' + pad(ev.getDate()), pad(ev.getHours()) + ':00', false, 'evaluasi');
    tdAdd(7, 'Ide kado ulang tahun Ibu', 'bersama', '', '', false, 'catatan', 'Ide kado ulang tahun Ibu\nSyal rajut atau voucher pijat');
    tdAdd(8, 'Ukuran gorden kamar', 'riki', '', '', false, 'catatan', 'Ukuran gorden kamar\n2 x 140 cm, tinggi 240 cm');
    return {
      buku: [{ id: 'riki', nama: 'Riki', tipe: 'Pribadi', pemilik: 'riki', urutan: 1 }, { id: 'istri', nama: 'Febie', tipe: 'Pribadi', pemilik: 'istri', urutan: 2 }, { id: 'rt', nama: 'Rumah Tangga', tipe: 'Bersama', pemilik: '', urutan: 3 }],
      users: [{ id: 'riki', nama: 'Riki', buku: 'riki' }, { id: 'istri', nama: 'Febie', buku: 'istri' }],
      kategori: kat, kantong: kan, budget: bud, transaksi: tx, todo: td
    };
  }

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
})();
