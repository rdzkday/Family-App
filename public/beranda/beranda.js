/* Beranda (index.html) + shell navigasi yang juga dipakai halaman Agenda.
   Skrip biasa (bukan modul): nama top-level dipakai bersama file js/ lain. Urutan muat ada di tiap index.html halaman. */
'use strict';

// ================= Beranda (index.html) =================
// Satu pintu: ringkasan Kantong, pengingat evaluasi, to-do & catatan, mood → Daily Mood. Ikon gear → halaman Pengaturan (/pengaturan/).
// Memakai state, antrean offline, dan sheet yang sama dengan Kantong.
var DAILY_MOOD_URL = ROOT + 'daily-mood/';
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
  if (S.conn && S.conn.mode === 'demo') return '';   // sudah ada bar demo di atas
  else if (S.outbox.length) { txt = S.syncing || !S.lastError ? 'Menyinkronkan ' + S.outbox.length + ' perubahan…' : 'Offline · ' + S.outbox.length + ' perubahan menunggu koneksi'; cls = ' wait'; }
  else if (gagal.length && /belum disiapkan/i.test(gagal[0].gcal_error || '')) { txt = 'Google Calendar belum disiapkan'; cls = ' bad'; }
  else if (gagal.length) { txt = gagal.length + ' to-do gagal masuk Google Calendar'; cls = ' bad'; }
  else txt = 'Tersinkron ke Google Calendar' + (S.lastSync ? ' · ' + agoLabel(S.lastSync) : '');
  return '<button type="button" class="br-sync' + cls + '" data-act="sync" aria-label="' + esc(txt) + '. Ketuk untuk sinkron sekarang">' + ic + '<span>' + esc(txt) + '</span></button>';
}
function renderBerandaShell(app) {
  document.body.classList.add('br-page');
  var nav = [['beranda', 'Beranda', ICON.house], ['kantong', 'Kantong', ICON.wallet], ['agenda', 'Agenda', ICON.check], ['komitmen', 'Komitmen', ICON.heart], ['mood', 'Mood', ICON.book]];
  var aktif = PAGE === 'agenda' ? 'agenda' : 'beranda';
  app.innerHTML = (S.conn.mode === 'demo' ? '<div class="br-demo">Mode demo, data contoh. <button data-act="leave-demo">Keluar</button></div>' : '') +
    '<main id="view" class="br-view"></main>' +
    '<nav class="br-nav" aria-label="Menu utama">' + nav.map(function (x) {
      return '<button type="button" data-brnav="' + x[0] + '" aria-current="' + (aktif === x[0] ? 'page' : 'false') + '">' +
        '<span class="ic">' + x[2] + '</span><span>' + x[1] + '</span></button>';
    }).join('') + '</nav>';
  $$('[data-brnav]', app).forEach(function (b) { b.addEventListener('click', function () { brNav(b.getAttribute('data-brnav')); }); });
  renderView();
}
var FITUR_URL = { beranda: ROOT || './', kantong: ROOT + 'kantong/', agenda: ROOT + 'agenda/', komitmen: ROOT + 'komitmen/', mood: DAILY_MOOD_URL };
function brNav(id) {
  if (PAGE === 'agenda' && id === 'agenda') { brGo('todo'); return; }
  if (PAGE === 'beranda' && id === 'beranda') { window.scrollTo(0, 0); return; }
  location.href = FITUR_URL[id];
}
// pindah tab di halaman Agenda (#todo, #catatan, #jadwal)
function brGo(id) {
  if (PAGE !== 'agenda') return;
  if (AGENDA_RUTE.indexOf(id) < 0) id = 'todo';
  S.tab = id; S.sub = null;
  var h = id === 'todo' ? '' : id;
  if (location.hash.slice(1) !== h) history.replaceState(history.state, '', h ? '#' + h : location.pathname);
  renderView(); window.scrollTo(0, 0);
}
document.addEventListener('click', function (e) {
  if (PAGE !== 'agenda') return;
  var a = e.target.closest('[data-brgo]'); if (!a) return;
  e.preventDefault(); brGo(a.getAttribute('data-brgo'));
});
window.addEventListener('hashchange', function () {
  if (PAGE === 'agenda' && agendaRute() !== S.tab) brGo(agendaRute());
  if (PAGE === 'pengaturan') bukaPengaturanDariHash();
});

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
      }).join('') + '</div>' : '') + '<a class="br-gear" href="' + ROOT + 'pengaturan/" aria-label="Pengaturan">' + ICON.gear + '</a></header>' +
      '<div id="br-sync"></div>' +
      '<nav class="br-short" aria-label="Pintasan">' +
        '<a href="' + FITUR_URL.kantong + '" style="--c:var(--br-kantong);--cb:var(--br-kantong-bg)"><span class="ic">' + ICON.wallet + '</span>Kantong</a>' +
        '<a href="' + FITUR_URL.agenda + '" style="--c:var(--br-agenda);--cb:var(--br-agenda-bg)"><span class="ic">' + ICON.check + '</span>Agenda</a>' +
        '<a href="' + FITUR_URL.komitmen + '" style="--c:var(--br-komit);--cb:var(--br-komit-bg)"><span class="ic">' + ICON.heart + '</span>Komitmen</a>' +
        '<a href="' + DAILY_MOOD_URL + '" style="--c:var(--br-catat);--cb:var(--br-catat-bg)"><span class="ic">' + ICON.book + '</span><span>Daily Mood</span></a>' +
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
    var head = '<div class="br-card-h"><h2 id="br-kantong-h"><span class="br-ic" style="--c:var(--br-kantong);--cb:var(--br-kantong-bg)">' + ICON.wallet + '</span>Kantong</h2><a class="br-lnk" href="' + FITUR_URL.kantong + '">Buka</a></div>';
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
    return '<section class="br-card br-eval" aria-labelledby="br-eval-h"><div class="br-eval-top"><span class="br-ic" style="--c:var(--br-komit);--cb:var(--br-komit-bg)">' + ICON.heart + '</span>' +
      '<div><h2 id="br-eval-h">' + esc(p.todo.judul) + ' · ' + esc(brSisa(p.menit)) + '</h2><div class="br-eval-d">' + esc(brTanggal(p.todo)) + info + '</div></div></div>' +
      '<p>Siapkan catatan: mana kesepakatan yang jalan, mana yang perlu dibahas ulang.</p>' +
      '<div class="br-eval-act"><a class="br-btn amber" href="' + FITUR_URL.komitmen + '">Lihat kesepakatan</a>' +
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
    var head = '<div class="br-card-h"><h2 id="br-todo-h"><span class="br-ic" style="--c:var(--br-agenda);--cb:var(--br-agenda-bg)">' + ICON.check + '</span>To-do</h2>';
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
      (buka.length > 6 ? '<a class="br-more" href="' + FITUR_URL.agenda + '">+' + (buka.length - 6) + ' to-do lainnya</a>' : '') +
      (notes.length ? '<div class="br-sub" style="margin-top:6px">Catatan</div><div class="br-todos">' + notes.slice(0, 3).map(brNoteRow).join('') + '</div>' +
        (notes.length > 3 ? '<a class="br-more" href="' + FITUR_URL.agenda + '#catatan">Semua catatan (' + notes.length + ')</a>' : '') : '');
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
    box.innerHTML = '<div class="br-card-h"><h2 id="br-mood-h"><span class="br-ic" style="--c:var(--br-catat);--cb:var(--br-catat-bg)">' + ICON.book + '</span>Daily Mood</h2><a class="br-lnk" href="' + DAILY_MOOD_URL + '">Buka</a></div>' +
      '<p class="br-q">Gimana rasanya hari ini?</p>' +
      '<div class="br-moods" role="radiogroup" aria-label="Mood hari ini">' + MOODS.map(function (m) {
        return '<button type="button" role="radio" aria-checked="' + (cur === m[0]) + '" data-mood="' + m[0] + '" style="--c:' + m[2] + '"><span class="face">' + moodSvg(m) + '</span><span>' + m[1] + '</span></button>';
      }).join('') + '</div>' +
      (cur ? '<a class="br-btn violet" href="' + DAILY_MOOD_URL + '?mood=' + cur + '">Simpan & lanjut tulis di Daily Mood</a>'
        : '<p class="br-help">Pilih satu, lalu lanjut di Daily Mood. Tersimpan di akunmu (Supabase), pasangan tidak bisa membaca.</p>');
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
