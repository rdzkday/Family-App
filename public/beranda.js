/* Beranda desktop Kantong: baca cache yang sama dengan app (localStorage), tanpa build step. */
(function () {
  'use strict';
  var C = KantongCore;
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
  var LS = {
    get: function (k, d) { try { var v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch (e) { return d; } },
    set: function (k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* penuh */ } }
  };
  var pad = function (n) { return String(n).padStart(2, '0'); };
  function todayISO() { var d = new Date(); return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); }
  function thisMonth() { return todayISO().slice(0, 7); }
  var BULAN = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
  var HARI = ['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab'];
  var HARI_P = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
  function longToday() { var d = new Date(); return HARI_P[d.getDay()] + ', ' + d.getDate() + ' ' + BULAN[d.getMonth()] + ' ' + d.getFullYear(); }
  function dayLabel(iso) {
    var t = todayISO();
    if (iso === t) return 'Hari ini';
    if (iso === C.addDays(t, -1)) return 'Kemarin';
    var p = iso.split('-'), d = new Date(+p[0], +p[1] - 1, +p[2]);
    return HARI[d.getDay()] + ', ' + d.getDate() + ' ' + BULAN[d.getMonth()].slice(0, 3);
  }
  function whenLabel(iso) { // 'YYYY-MM-DDTHH:MM'
    if (!iso) return '';
    var d = iso.slice(0, 10), t = iso.slice(11, 16);
    return dayLabel(d) + (t ? ', ' + t.replace(':', '.') : '');
  }
  function greeting() { var h = new Date().getHours(); return h < 11 ? 'Pagi' : h < 15 ? 'Siang' : h < 18 ? 'Sore' : 'Malam'; }
  function toast(msg) {
    var el = $('#toast'); el.textContent = msg; el.className = 'toast show';
    clearTimeout(toast.t); toast.t = setTimeout(function () { el.className = 'toast'; }, 2200);
  }

  // tema ikut pilihan di app
  (function () {
    var t = LS.get('k_theme', 'auto'), r = document.documentElement;
    if (t !== 'auto') r.setAttribute('data-theme', t);
  })();

  var RUANG_CATAT_URL = '';   // isi URL Ruang Catat kalau sudah ada; kosong = tombol tidak ke mana-mana
  var ICON = {
    wallet: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M3 7h15a3 3 0 0 1 3 3v7a3 3 0 0 1-3 3H6a3 3 0 0 1-3-3V7z"/><path d="M3 7l12-4v4"/><circle cx="16.5" cy="13.5" r="1"/></svg>',
    cal: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="5" width="18" height="16" rx="3"/><path d="M3 10h18M8 3v4M16 3v4"/></svg>',
    heart: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10z"/></svg>',
    book: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M5 4h11a3 3 0 0 1 3 3v13H8a3 3 0 0 1-3-3V4z"/><path d="M5 17a3 3 0 0 1 3-3h11"/></svg>',
    ext: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M7 17L17 7M9 7h8v8"/></svg>',
    check: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12l5 5 9-10"/></svg>',
    clock: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="8"/><path d="M12 8v4l3 2"/></svg>',
    x: '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M6 6l12 12M18 6L6 18"/></svg>',
    swap: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M7 7h12l-3-3M17 17H5l3 3"/></svg>'
  };

  // ================= data =================
  var boot = LS.get('k_boot', null), months = LS.get('k_months', {}), conn = LS.get('k_conn', null);
  var D = LS.get('k_dash', { user: '', todos: [], notes: [], mood: {}, evalTgl: '', evalTunda: '' });
  function save() { LS.set('k_dash', D); }
  function db() {
    var b = boot || {};
    return { Buku: b.buku || [], Users: b.users || [], Kategori: b.kategori || [], Kantong: b.kantong || [], Budget: [], Transaksi: [] };
  }
  function users() { return db().Users; }
  function curUser() { return users().filter(function (u) { return u.id === D.user; })[0] || (boot && boot.user) || users()[0] || null; }
  function bukuById(id) { return C.byId(db().Buku)[id]; }
  function kantongLabel(id) { var k = C.byId(db().Kantong)[id]; return k ? k.nama : id; }
  function kategoriOf(id) { return C.byId(db().Kategori)[id]; }
  function bukuColor(id) {
    var map = { riki: 'var(--b-riki)', istri: 'var(--b-istri)', rt: 'var(--b-rt)' };
    if (map[id]) return map[id];
    var i = db().Buku.findIndex(function (b) { return b.id === id; });
    return ['#8FA2FF', '#F28DB5', '#F2B544', '#5EEAD4', '#A78BFA'][Math.max(0, i) % 5];
  }
  function bersama() { return db().Buku.filter(function (b) { return b.tipe === 'Bersama'; })[0]; }
  function namaUser(id) { if (id === 'B') return 'Bersama'; var u = users().filter(function (x) { return x.id === id; })[0]; return u ? u.nama : id; }

  // ================= bagian =================
  function headHtml() {
    var u = curUser();
    return '<header class="dash-head"><div><div class="date">' + longToday() + '</div><h1>' + greeting() + (u ? ', ' + esc(u.nama) : '') + '</h1></div>' +
      '<div class="right"><span class="sync"><i></i>' + (conn ? (conn.mode === 'demo' ? 'Data demo' : 'Data dari cache HP ini') : 'Belum terhubung') + '</span>' +
      (users().length > 1 ? '<div class="seg" role="group" aria-label="Lihat sebagai">' + users().map(function (x) {
        return '<button data-user="' + esc(x.id) + '" aria-pressed="' + (u && u.id === x.id) + '">' + esc(x.nama) + '</button>';
      }).join('') + '</div>' : '') + '</div></header>';
  }
  function appsHtml() {
    var a = function (href, c, ic, t1, t2, ext, dev) {
      return '<a class="app' + (dev ? ' dev' : '') + '" href="' + href + '"' + (ext ? ' target="_blank" rel="noopener"' : '') + ' style="--c:' + c + '"><span class="ic">' + ic + '</span><span><span class="t1">' + t1 + (ext ? ICON.ext : '') +
        (dev ? '<span class="dev-tag">Dalam pengembangan</span>' : '') + '</span><span class="t2">' + t2 + '</span></span></a>';
    };
    return '<section class="apps" aria-label="Aplikasi">' +
      a('./', 'var(--b-riki)', ICON.wallet, 'Kantong', 'Keuangan') +
      a('#todo', '#C7D3FF', ICON.cal, 'Agenda', 'To-do & catatan, baru tersimpan di browser ini', false, true) +
      a('komitmen.html', 'var(--b-rt)', ICON.heart, 'Komitmen', 'Kesepakatan berdua: baca & cari pasal', false, true) +
      a(RUANG_CATAT_URL || '#ruangcatat', '#E4D7FF', ICON.book, 'Ruang Catat', RUANG_CATAT_URL ? 'App terpisah' : 'App terpisah, belum tersambung', !!RUANG_CATAT_URL, !RUANG_CATAT_URL) + '</section>';
  }
  function kantongHtml() {
    var u = curUser(), d = db(), m = months[thisMonth()], rt = bersama();
    if (!boot) return '<section class="panel" id="kantong"><div class="empty-state">Data Kantong belum ada di browser ini.<a class="btn" href="./">Buka Kantong dulu</a></div></section>';
    var saldo = (boot.saldo) || {};
    var left = '<div><div class="panel-h"><h2>Kantong</h2><span class="aside">' + BULAN[new Date().getMonth()] + '</span></div>';
    if (rt) {
      var s = m ? C.summarize(d, m.transaksi, m.budget, rt.id) : null;
      var sisaKantong = d.Kantong.filter(function (k) { return k.buku === rt.id && C.bool(k.aktif); }).reduce(function (a, k) { return a + (saldo[k.id] || 0); }, 0);
      left += '<span class="muted" style="font-size:13px;font-weight:700">Sisa dompet ' + esc(rt.nama.toLowerCase()) + '</span>' +
        '<span class="big-num num">' + rp(sisaKantong) + '</span>';
      if (s && s.budgetTotal) {
        var used = Math.min(1, s.pengeluaran / s.budgetTotal);
        left += '<div class="meter' + (s.sisaBudget < 0 ? ' over' : '') + '" style="--c:var(--b-rt)"><i style="width:' + (used * 100).toFixed(1) + '%"></i></div>' +
          '<span class="muted" style="font-size:13px;font-weight:700">' + Math.round(used * 100) + '% terpakai dari budget ' + rp(s.budgetTotal) + '</span>';
      } else if (s) {
        left += '<span class="muted" style="font-size:13px;font-weight:700">Pengeluaran bulan ini ' + rp(s.pengeluaran) + ', belum ada budget.</span>';
      }
    }
    if (u) {
      var pribadi = d.Kantong.filter(function (k) { return k.buku === u.buku && C.bool(k.aktif); }).reduce(function (a, k) { return a + (saldo[k.id] || 0); }, 0);
      left += '<div class="mini"><span class="t1">Saldo pribadi ' + esc(u.nama) + '</span><b class="num">' + rp(pribadi) + '</b></div>';
    }
    left += '<a class="btn" href="./">Catat transaksi</a></div>';

    var txs = m ? m.transaksi.filter(function (t) {
      if (t.dihapus) return false;
      if (rt && t.buku === rt.id) return true;
      return u && t.buku === u.buku;
    }).sort(function (a, b) { return (b.tanggal + b.dibuat).localeCompare(a.tanggal + a.dibuat); }).slice(0, 5) : [];
    var right = '<div><span class="muted" style="font-size:13px;font-weight:800">Transaksi terakhir</span>' +
      (txs.length ? txs.map(function (t) {
        var k = kategoriOf(t.kategori), b = bukuById(t.buku);
        var isTf = t.tipe === 'Transfer', color = isTf ? '#C7D3FF' : (k ? k.warna : '#94A3B8');
        var letter = isTf ? ICON.swap : esc(((k ? k.nama : '?')[0] || '?').toUpperCase());
        var title = t.keterangan || (isTf ? 'Transfer' : (k ? k.nama : 'Transaksi'));
        var meta = (b ? b.nama : '') + ' · ' + (isTf ? kantongLabel(t.kantong) + ' ke ' + kantongLabel(t.kantong_tujuan) : kantongLabel(t.kantong)) + ' · ' + dayLabel(t.tanggal);
        var cls = t.tipe === 'Pemasukan' ? ' in' : isTf ? ' tf' : '', sign = t.tipe === 'Pemasukan' ? '+' : isTf ? '' : '−';
        return '<div class="tx flat"><span class="ic" style="--c:' + color + '">' + letter + '</span><span class="main"><span class="t1">' + esc(title) + '</span><span class="t2">' + esc(meta) + '</span></span><span class="amt num' + cls + '">' + sign + fmt(t.nominal) + '</span></div>';
      }).join('') : '<div class="empty">Belum ada transaksi bulan ini.</div>') +
      '<a class="lnk" href="./" style="margin-top:8px">Lihat semua transaksi</a></div>';
    return '<section class="panel" id="kantong" aria-label="Ringkasan Kantong"><div class="kantong-grid">' + left + right + '</div></section>';
  }

  var T = { filter: 'mine', type: 'todo', withTime: false, when: '', text: '' };
  function todoHtml() {
    var u = curUser(), me = u ? u.id : '';
    var mineAll = D.todos.filter(function (t) { return t.o === 'B' || t.o === me; });
    var done = mineAll.filter(function (t) { return t.done; }).length;
    var visible = D.todos.filter(function (t) { return T.filter === 'all' || (T.filter === 'B' ? t.o === 'B' : (t.o === me || t.o === 'B')); });
    var isTodo = T.type === 'todo';
    var chips = [['mine', 'Untukku'], ['B', 'Bersama'], ['all', 'Semua']].map(function (f) {
      return '<button type="button" class="chip" data-filter="' + f[0] + '" aria-pressed="' + (T.filter === f[0]) + '">' + f[1] + '</button>';
    }).join('');
    return '<section class="panel" id="todo" aria-label="To-do dan catatan">' +
      '<div class="panel-h"><div><h2>To-do <span class="dev-tag">Dalam pengembangan</span></h2><span class="aside">' + done + ' dari ' + mineAll.length + ' selesai</span></div><div class="chips wrap">' + chips + '</div></div>' +
      '<form class="todo-bar" id="todo-form"><div class="seg" role="group" aria-label="Jenis">' +
      '<button type="button" data-type="todo" aria-pressed="' + isTodo + '">To-do</button><button type="button" data-type="note" aria-pressed="' + !isTodo + '">Catatan</button></div>' +
      '<input class="input" id="dq" type="text" autocomplete="off" value="' + esc(T.text) + '" aria-label="' + (isTodo ? 'To-do baru' : 'Catatan baru') + '" placeholder="' + (isTodo ? 'To-do baru… mis. Jemput ' + esc(users().filter(function (x) { return x.id !== me; }).map(function (x) { return x.nama; })[0] || 'pasangan') : 'Tulis catatan…') + '">' +
      (isTodo ? (T.withTime ? '<input class="input" id="dw" type="datetime-local" aria-label="Waktu" value="' + esc(T.when) + '" style="flex:0 1 220px">' : '') +
        '<button type="button" class="chip" id="dt" aria-pressed="' + T.withTime + '">' + ICON.clock + ' ' + (T.withTime ? 'Dengan waktu' : 'Atur waktu') + '</button>' +
        (users().length > 1 ? '<select class="input" id="do" aria-label="Untuk siapa" style="flex:0 1 150px;min-height:40px">' +
          '<option value="' + esc(me) + '">Untukku</option><option value="B">Bersama</option>' +
          users().filter(function (x) { return x.id !== me; }).map(function (x) { return '<option value="' + esc(x.id) + '">' + esc(x.nama) + '</option>'; }).join('') + '</select>' : '') : '') +
      '<button type="submit" class="btn small">Simpan</button></form>' +
      (isTodo ? '<span class="faint" style="font-size:12px;font-weight:600">' + (T.withTime ? 'Ada waktunya: nanti bisa disambungkan ke Google Calendar.' : 'Tanpa waktu: cuma disimpan di browser ini.') + '</span>' : '') +
      '<div>' + (visible.length ? visible.map(function (t) {
        return '<div class="todo' + (t.done ? ' done' : '') + '" data-id="' + esc(t.id) + '"><button type="button" class="box" data-toggle aria-label="Tandai selesai" aria-pressed="' + !!t.done + '">' + (t.done ? ICON.check : '') + '</button>' +
          '<span class="t1">' + esc(t.title) + '</span><span class="who">' + esc(namaUser(t.o)) + '</span>' +
          '<span class="when' + (t.when ? '' : ' none') + '">' + (t.when ? ICON.cal.replace('viewBox', 'width="13" height="13" viewBox') + ' ' + esc(whenLabel(t.when)) : 'Tanpa waktu') + '</span>' +
          '<button type="button" class="del" data-del aria-label="Hapus">' + ICON.x + '</button></div>';
      }).join('') : '<div class="empty">Belum ada to-do.</div>') + '</div>' +
      (D.notes.length ? '<div class="panel-h" style="margin-top:6px"><h2 style="font-size:15px">Catatan</h2></div><div>' + D.notes.slice(0, 5).map(function (n) {
        return '<div class="note-row" data-note="' + esc(n.id) + '"><span class="t2">' + esc(dayLabel(n.tgl)) + '</span><span class="main">' + esc(n.text) + '</span><button type="button" class="del" data-del-note aria-label="Hapus" style="opacity:1;color:var(--text-3)">' + ICON.x + '</button></div>';
      }).join('') + '</div>' : '') + '</section>';
  }

  // ringkasan dari cache halaman Komitmen (komitmen.js menyimpan hasil komitmen.list di k_komitmen)
  function komitRingkas() {
    var c = LS.get('k_komitmen', null), d = c && c.data;
    if (!d) return '';
    return '<p class="t2" style="margin:0">' + d.berlaku + ' kesepakatan aktif' +
      (d.menunggu_ttd ? ' · <b>' + d.menunggu_ttd + ' lembar menunggu tanda tanganmu</b>' : '') + '</p>';
  }
  function komitHtml() {
    var tgl = D.evalTgl, today = todayISO();
    if (D.evalTunda === today) return '';
    var head, body, sub;
    if (tgl) {
      var diff = Math.round((new Date(tgl) - new Date(today)) / 864e5);
      head = 'Evaluasi bulanan · ' + (diff < 0 ? 'lewat ' + (-diff) + ' hari' : diff === 0 ? 'hari ini' : diff + ' hari lagi');
      var p = tgl.split('-'), dd = new Date(+p[0], +p[1] - 1, +p[2]);
      sub = HARI_P[dd.getDay()] + ', ' + dd.getDate() + ' ' + BULAN[dd.getMonth()] + ' · ' + users().map(function (x) { return x.nama; }).join(' & ');
      body = 'Siapkan catatan: mana kesepakatan yang jalan, mana yang perlu dibahas ulang.';
    } else {
      head = 'Evaluasi bulanan'; sub = 'Belum dijadwalkan'; body = 'Atur tanggal ngobrol berdua soal kesepakatan rumah tangga, sebulan sekali.';
    }
    return '<section class="panel komit" id="komitmen" aria-label="Pengingat evaluasi bulanan"><div class="head"><span class="ic">' + ICON.heart + '</span><div><h2>' + esc(head) + ' <span class="dev-tag">Dalam pengembangan</span></h2><span class="t2">' + esc(sub) + '</span></div></div>' +
      '<p>' + body + '</p><div class="acts"><label class="btn primary" style="position:relative;cursor:pointer">' + (tgl ? 'Ubah tanggal' : 'Atur tanggal') +
      '<input type="date" id="eval-tgl" value="' + esc(tgl) + '" aria-label="Tanggal evaluasi" style="position:absolute;inset:0;opacity:0;width:100%;cursor:pointer"></label>' +
      (tgl ? '<button type="button" class="btn ghost" id="eval-tunda">Ingatkan besok</button>' : '') +
      '<a class="btn ghost" href="komitmen.html">Lihat kesepakatan</a></div>' + komitRingkas() + '</section>';
  }

  var MOODS = [['berat', 'Berat', '#FFADB9'], ['lelah', 'Lelah', '#FFD1C2'], ['biasa', 'Biasa', '#FFE29A'], ['baik', 'Baik', '#BDEBD3'], ['senang', 'Senang', '#8EE3BC']];
  function moodHtml() {
    var u = curUser(), key = todayISO() + '|' + (u ? u.id : ''), cur = D.mood[key];
    return '<section class="panel" id="ruangcatat" aria-label="Ruang Catat"><div class="panel-h"><h2 style="font-size:17px">Gimana rasanya hari ini?</h2><span class="dev-tag">Ruang Catat · dalam pengembangan</span></div>' +
      '<div class="moods">' + MOODS.map(function (m) {
        return '<button type="button" class="mood" data-mood="' + m[0] + '" aria-pressed="' + (cur === m[0]) + '" style="--c:' + m[2] + '"><i></i>' + m[1] + '</button>';
      }).join('') + '</div>' +
      (cur && RUANG_CATAT_URL ? '<a class="btn ghost" href="' + esc(RUANG_CATAT_URL) + '" target="_blank" rel="noopener" style="margin:0;min-height:46px;font-size:14px">Lanjut tulis di Ruang Catat ' + ICON.ext.replace('viewBox', 'width="14" height="14" viewBox') + '</a>' : '') + '</section>';
  }

  // ================= render & event =================
  function render() {
    var el = $('#dash');
    el.innerHTML = headHtml() + appsHtml() + '<div class="cols"><div class="col-main">' + kantongHtml() + todoHtml() + '</div><div class="col-side">' + komitHtml() + moodHtml() + '</div></div>';
    $$('[data-user]', el).forEach(function (b) { b.addEventListener('click', function () { D.user = b.getAttribute('data-user'); save(); render(); }); });
    $$('[data-filter]', el).forEach(function (b) { b.addEventListener('click', function () { T.filter = b.getAttribute('data-filter'); render(); }); });
    $$('[data-type]', el).forEach(function (b) { b.addEventListener('click', function () { T.type = b.getAttribute('data-type'); render(); $('#dq').focus(); }); });
    var dt = $('#dt', el); if (dt) dt.addEventListener('click', function () { T.withTime = !T.withTime; render(); });
    $('#dq', el).addEventListener('input', function (e) { T.text = e.target.value; });
    var dw = $('#dw', el); if (dw) dw.addEventListener('change', function () { T.when = dw.value; });
    $('#todo-form', el).addEventListener('submit', function (e) {
      e.preventDefault();
      var text = $('#dq', el).value.trim(); if (!text) return;
      if (T.type === 'todo') {
        var o = $('#do', el) ? $('#do', el).value : (curUser() ? curUser().id : 'B');
        D.todos.unshift({ id: 'td-' + Date.now().toString(36), title: text.slice(0, 200), o: o, when: T.withTime ? T.when : '', done: false });
        T.withTime = false; T.when = ''; T.text = '';
      } else {
        T.text = '';
        D.notes.unshift({ id: 'nt-' + Date.now().toString(36), text: text.slice(0, 1000), tgl: todayISO() });
      }
      save(); render(); toast('Tersimpan di browser ini'); $('#dq').focus();
    });
    $$('[data-toggle]', el).forEach(function (b) { b.addEventListener('click', function () {
      var id = b.closest('[data-id]').getAttribute('data-id'), t = D.todos.filter(function (x) { return x.id === id; })[0];
      if (t) { t.done = !t.done; save(); render(); }
    }); });
    $$('[data-del]', el).forEach(function (b) { b.addEventListener('click', function () {
      var id = b.closest('[data-id]').getAttribute('data-id');
      D.todos = D.todos.filter(function (x) { return x.id !== id; }); save(); render();
    }); });
    $$('[data-del-note]', el).forEach(function (b) { b.addEventListener('click', function () {
      var id = b.closest('[data-note]').getAttribute('data-note');
      D.notes = D.notes.filter(function (x) { return x.id !== id; }); save(); render();
    }); });
    var et = $('#eval-tgl', el); if (et) et.addEventListener('change', function () { D.evalTgl = et.value; D.evalTunda = ''; save(); render(); });
    var tunda = $('#eval-tunda', el); if (tunda) tunda.addEventListener('click', function () { D.evalTunda = todayISO(); save(); render(); toast('Oke, diingatkan lagi besok'); });
    $$('[data-mood]', el).forEach(function (b) { b.addEventListener('click', function () {
      var u = curUser(), key = todayISO() + '|' + (u ? u.id : ''), v = b.getAttribute('data-mood');
      if (D.mood[key] === v) delete D.mood[key]; else D.mood[key] = v;
      save(); render();
    }); });
  }
  render();
  // kalau app di tab lain sinkron, angka di sini ikut segar
  window.addEventListener('storage', function (e) {
    if (e.key === 'k_boot' || e.key === 'k_months' || e.key === 'k_conn' || e.key === 'k_theme') {
      boot = LS.get('k_boot', null); months = LS.get('k_months', {}); conn = LS.get('k_conn', null); render();
    }
  });
})();
