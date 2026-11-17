/* Kantong — Dasar: util, tema, state, API, antrean offline & sinkron.
   Skrip biasa (bukan modul): nama top-level dipakai bersama file js/ lain. Urutan muat ada di tiap index.html halaman. */
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
// Halaman per fitur: beranda (/), kantong (/kantong/), agenda (/agenda/). ROOT = jalur ke folder public dari halaman ini.
var PAGE = ['beranda', 'kantong', 'agenda', 'pengaturan'].indexOf(window.KANTONG_PAGE) >= 0 ? window.KANTONG_PAGE : 'kantong';
var ROOT = window.KANTONG_ROOT || '';
var AGENDA_RUTE = ['todo', 'catatan', 'jadwal'];
function agendaRute() { var h = location.hash.slice(1); return AGENDA_RUTE.indexOf(h) >= 0 ? h : 'todo'; }
// link lama: kantong#todo, kantong#pengaturan, beranda#todo/#agenda/#setelan
function alihkanLinkLama() {
  var h = location.hash;
  if (PAGE === 'kantong' && h === '#todo') location.replace(ROOT + 'agenda/');
  if (PAGE === 'kantong' && h === '#pengaturan') location.replace(ROOT + 'pengaturan/#kantong');
  if (PAGE === 'beranda' && h === '#todo') location.replace(ROOT + 'agenda/');
  if (PAGE === 'beranda' && h === '#agenda') location.replace(ROOT + 'agenda/#jadwal');
  // Pengaturan = halaman sendiri (/pengaturan/), link lama #pengaturan[/fitur] & #setelan dialihkan
  var mp = /^#(?:pengaturan|setelan)(?:\/(\w+))?$/.exec(h);
  if (PAGE === 'beranda' && mp) location.replace(ROOT + 'pengaturan/' + (mp[1] ? '#' + mp[1] : ''));
}
alihkanLinkLama();
window.addEventListener('hashchange', alihkanLinkLama);
function themePref() { return LS.get('k_theme', 'dark') === 'light' ? 'light' : 'dark'; }
function isDark() { return themePref() === 'dark'; }
function applyTheme() {
  var t = themePref(), r = document.documentElement;
  if (t === 'dark') r.removeAttribute('data-theme'); else r.setAttribute('data-theme', t);
  var m = document.querySelector('meta[name="theme-color"]'); if (m) m.setAttribute('content', isDark() ? '#0E1014' : '#F7F5FC');
}
function setTheme(t) { LS.set('k_theme', t); applyTheme(); }
function berandaBtn() { if (PAGE === 'beranda') return ''; return '<button class="theme-btn" data-act="beranda" aria-label="Ke Beranda"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 11l8-7 8 7v8a2 2 0 0 1-2 2h-3v-6h-6v6H6a2 2 0 0 1-2-2z"/></svg></button>'; }
function themeBtn() { return '<button class="theme-btn" data-act="theme" aria-label="Ganti tema terang/gelap">' + (isDark() ? SUN : MOON) + '</button>'; }
applyTheme();

// ================= state =================
var S = {
  conn: LS.get('k_conn', null),          // {mode:'remote', api, token} | {mode:'demo'}
  boot: LS.get('k_boot', null),
  months: LS.get('k_months', {}),
  outbox: LS.get('k_outbox', []),
  todos: LS.get('k_todos', null),        // null = belum pernah dimuat
  prefs: LS.get('k_prefs', { lastKantong: {}, demoUser: 'riki' }),
  tab: PAGE === 'beranda' ? 'beranda' : PAGE === 'agenda' ? agendaRute() : (({ '#ringkasan': 'ringkasan', '#riwayat': 'riwayat' })[location.hash] || 'home'), sub: null, bukuView: null, bulan: thisMonth(),
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
      else if (r.opId === '_komit') { if (r.ok) LS.set('k_komitmen', { data: r.data, at: Date.now() }); }   // cache yang sama dengan komitmen/
      else if (String(r.opId).indexOf('_m_') === 0) { if (r.ok) S.months[r.data.bulan] = r.data; }
      else if (!r.ok) toast('Tidak tersimpan: ' + r.error, true);
    });
    S.outbox = S.outbox.filter(function (o) { return !sent[o.opId]; });
    S.outbox.forEach(applyLocal);           // operasi yang masuk selama request
    S.lastError = null; S.lastSync = Date.now();
    persist();
  }).catch(function (e) {
    S.lastError = e.message;
    if (e.code === 'AUTH') { toast('Sesi berakhir. Silakan masuk lagi.', true); disconnect(); }
  }).then(function () {
    S.syncing = false; renderSync(); refresh();
    if (S.again) { S.again = false; sync(); }
  });
}
