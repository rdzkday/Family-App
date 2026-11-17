/* Beranda — Pengaturan semua fitur dalam satu kartu, expand-collapse per fitur:
   Umum · Kantong · Agenda · Komitmen · Daily Mood. Menggantikan tab Pengaturan Kantong & halaman Setelan.
   Skrip biasa (bukan modul): nama top-level dipakai bersama file js/ lain. Urutan muat ada di tiap index.html halaman. */
'use strict';

var CHEVRON = '<svg class="atur-chev" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 9l6 6 6-6"/></svg>';
var ATUR_FITUR = [
  // id, judul, ikon, warna, keterangan, isi
  ['umum', 'Umum', 'gear', '--br-muted', 'Tema, akun, sinkron', function (b) { AturUmum.render(b); }],
  ['kantong', 'Kantong', 'wallet', '--br-kantong', 'Kantong, kategori, budget bulanan', function (b) { AturKantongFitur.render(b); }],
  ['agenda', 'Agenda', 'check', '--br-agenda', 'Filter default, Google Calendar, evaluasi', function (b) { AturAgenda.render(b); }],
  ['komitmen', 'Komitmen', 'heart', '--br-komit', 'Kesepakatan & tanda tangan', function (b) { AturKomitmen.render(b); }],
  ['mood', 'Daily Mood', 'book', '--br-catat', 'Profil, kondisi, prompt, cadangan', function (b) { AturMood.render(b); }]
];
// bagian yang aman digambar ulang saat data sinkron (tidak ada kolom isian yang sedang diketik)
var ATUR_SEGAR = { umum: 1, kantong: 1, agenda: 1, komitmen: 1 };

function aturBuka() { S.prefs.aturBuka = S.prefs.aturBuka || {}; return S.prefs.aturBuka; }

var Pengaturan = {
  render: function (box) {
    if (!box) return;
    var buka = aturBuka();
    box.className = 'br-card br-atur';
    box.innerHTML = '<div class="br-card-h"><h2 id="br-atur-h"><span class="br-ic" style="--c:var(--br-muted);--cb:var(--br-inset)">' + ICON.gear + '</span>Pengaturan</h2></div>' +
      '<div class="atur">' + ATUR_FITUR.map(function (f) {
        var on = !!buka[f[0]];
        return '<div class="atur-item" data-atur="' + f[0] + '">' +
          '<button type="button" class="atur-head" aria-expanded="' + on + '" aria-controls="atur-b-' + f[0] + '" id="atur-h-' + f[0] + '">' +
            '<span class="br-ic" style="--c:var(' + f[3] + ');--cb:color-mix(in srgb, var(' + f[3] + ') 14%, transparent)">' + ICON[f[2]] + '</span>' +
            '<span class="main"><span class="t1">' + f[1] + '</span><span class="t2">' + f[4] + '</span></span>' + CHEVRON + '</button>' +
          '<div class="atur-body" id="atur-b-' + f[0] + '" role="region" aria-labelledby="atur-h-' + f[0] + '"' + (on ? '' : ' hidden') + '></div></div>';
      }).join('') + '</div>';
    ATUR_FITUR.forEach(function (f) { if (buka[f[0]]) f[5]($('#atur-b-' + f[0], box)); });
    $$('.atur-head', box).forEach(function (h) { h.addEventListener('click', function () {
      Pengaturan.toggle(box, h.closest('[data-atur]').getAttribute('data-atur'));
    }); });
  },
  toggle: function (box, id, paksa) {
    var buka = aturBuka(), on = paksa === undefined ? !buka[id] : paksa;
    buka[id] = on; persist();
    var h = $('#atur-h-' + id, box), b = $('#atur-b-' + id, box);
    if (!h || !b) return;
    h.setAttribute('aria-expanded', String(on));
    b.hidden = !on;
    if (on) ATUR_FITUR.filter(function (f) { return f[0] === id; })[0][5](b); else b.innerHTML = '';
  },
  update: function (box) {
    if (!box) return;
    var buka = aturBuka();
    ATUR_FITUR.forEach(function (f) {
      if (!buka[f[0]] || !ATUR_SEGAR[f[0]]) return;
      if (f[0] === 'kantong' && BudgetEdit.waiting && BudgetEdit.el) BudgetEdit.render(BudgetEdit.el);
      var b = $('#atur-b-' + f[0], box); if (b && !b.contains(document.activeElement)) f[5](b);
    });
  }
};
// #pengaturan atau #pengaturan/<fitur>: buka bagian itu lalu gulir ke sana
function bukaPengaturanDariHash() {
  var m = /^#pengaturan(?:\/(\w+))?$/.exec(location.hash), box = $('#pengaturan');
  if (!m || !box) return;
  if (m[1] && ATUR_FITUR.some(function (f) { return f[0] === m[1]; })) Pengaturan.toggle(box, m[1], true);
  setTimeout(function () { (m[1] ? $('[data-atur="' + m[1] + '"]', box) : box).scrollIntoView({ behavior: 'smooth', block: 'start' }); }, 60);
}
function aturBaris(label, sub, kanan, attr) {
  return '<button type="button" class="atur-row"' + (attr || '') + '><span class="main"><span class="t1">' + label + '</span>' + (sub ? '<span class="t2">' + sub + '</span>' : '') + '</span>' + (kanan || ICON.right) + '</button>';
}

// ---------- Umum ----------
var AturUmum = {
  render: function (el) {
    var demo = S.conn.mode === 'demo';
    var host = demo ? 'Mode demo, data contoh di HP ini' : (/supabase\.(co|in)\//.test(S.conn.api || '') ? 'Terhubung ke Supabase' : 'Terhubung ke server');
    el.innerHTML = '<div class="atur-akun"><b>' + esc(me().nama) + '</b><span>' + host + '</span></div>' +
      '<div class="atur-lbl">Tema</div><div class="seg" role="group" aria-label="Tema">' +
        [['dark', 'Gelap'], ['light', 'Terang']].map(function (x) { return '<button type="button" data-theme-set="' + x[0] + '" aria-pressed="' + (themePref() === x[0]) + '">' + x[1] + '</button>'; }).join('') +
      '</div><p class="br-help" style="margin:-6px 0 12px">Berlaku di Beranda, Kantong, Agenda, Komitmen, dan Daily Mood.</p>' +
      aturBaris('Sinkron sekarang', esc(S.lastSync ? 'Terakhir ' + agoLabel(S.lastSync) : 'Belum sinkron di sesi ini') + (S.outbox.length ? ', ' + S.outbox.length + ' belum terkirim' : ''), '', ' data-au="sync"') +
      aturBaris('<span style="color:var(--over)">' + (demo ? 'Keluar dari mode demo' : 'Putuskan koneksi di HP ini') + '</span>', '', '', ' data-au="out"') +
      '<p class="faint" style="font-size:12px;text-align:center;margin:12px 0 0">Kantong v' + esc((S.boot && S.boot.version) || C.VERSION) + '</p>';
    $$('[data-theme-set]', el).forEach(function (b) { b.addEventListener('click', function () { setTheme(b.getAttribute('data-theme-set')); AturUmum.render(el); }); });
    $$('[data-au]', el).forEach(function (b) { b.addEventListener('click', function () {
      var a = b.getAttribute('data-au');
      if (a === 'sync') { sync(); toast('Menyinkronkan…'); }
      if (a === 'out' && confirm(demo ? 'Keluar dari mode demo? Data demo dihapus.' : 'Putuskan koneksi? Perubahan yang belum terkirim akan hilang dari HP ini.')) disconnect();
    }); });
  }
};

// ---------- Kantong ----------
var AturKantongFitur = {
  render: function (el) {
    var nKat = db().Kategori.filter(function (k) { return C.bool(k.aktif) && k.id !== C.KAT_REIMBURSE; }).length;
    el.innerHTML = aturBaris('Budget bulanan', 'Atur budget per kategori, bulan berikutnya ikut otomatis', '', ' data-ak="budget"') +
      toggleHtml('ak-setoran', 'Tampilkan setoran Rumah Tangga di grafik', 'Ringkasan Kantong', showSetoran()) +
      '<div class="atur-lbl">Kantong</div><div id="ak-kantong"></div>' +
      '<div class="atur-lbl">Kategori <span class="faint">· ' + nKat + ' aktif</span></div><div id="ak-kategori"></div>';
    AturKantong.render($('#ak-kantong', el));
    AturKategori.render($('#ak-kategori', el));
    $('[data-ak="budget"]', el).addEventListener('click', openBudgetSheet);
    $('#ak-setoran', el).addEventListener('click', function () { setSetoran(!showSetoran()); this.setAttribute('aria-checked', String(showSetoran())); });
  }
};

// ---------- Agenda ----------
var AturAgenda = {
  render: function (el) {
    var f = todoFilter();
    var timed = todos().filter(function (t) { return C.todoPerluEvent(t); });
    var gagal = timed.filter(function (t) { return !t._pending && t.gcal_status === 'gagal'; });
    var status = S.conn.mode === 'demo' ? 'Mode demo, tidak terhubung ke Google Calendar'
      : gagal.length && /belum disiapkan/i.test(gagal[0].gcal_error || '') ? 'Belum disiapkan (lihat PANDUAN §7)'
      : gagal.length ? gagal.length + ' to-do gagal masuk kalender' : 'Tersinkron ke kalender "Rumah Kita"';
    el.innerHTML = '<div class="atur-lbl">Filter awal To-do & Catatan</div><div class="seg" role="group" aria-label="Filter awal">' +
        [['untukku', 'Untukku'], ['bersama', 'Bersama'], ['semua', 'Semua']].map(function (x) { return '<button type="button" data-ag-f="' + x[0] + '" aria-pressed="' + (f === x[0]) + '">' + x[1] + '</button>'; }).join('') + '</div>' +
      aturBaris('Google Calendar', esc(status), gagal.length ? '<span class="atur-badge bad">Coba lagi</span>' : '', ' data-ag="gcal"') +
      aturBaris('Jadwalkan evaluasi bulanan', 'Pengingat muncul di Beranda ' + C.EVALUASI_PENGINGAT_JAM + ' jam sebelumnya', '', ' data-ag="eval"') +
      aturBaris('Buka Agenda', 'To-do, catatan, jadwal', '', ' data-ag="buka"');
    $$('[data-ag-f]', el).forEach(function (b) { b.addEventListener('click', function () { S.prefs.todoFilter = b.getAttribute('data-ag-f'); persist(); refresh(); AturAgenda.render(el); }); });
    $$('[data-ag]', el).forEach(function (b) { b.addEventListener('click', function () {
      var a = b.getAttribute('data-ag');
      if (a === 'gcal') { gagal.forEach(function (t) { enqueue('todo.sync', { id: t.id }); }); if (!gagal.length) sync(); toast('Menyinkronkan…'); }
      if (a === 'eval') openTodoSheet(null, { tipe: 'evaluasi', pemilik: C.TODO_BERSAMA });
      if (a === 'buka') location.href = FITUR_URL.agenda;
    }); });
  }
};

// ---------- Komitmen ----------
var AturKomitmen = {
  render: function (el) {
    var kc = LS.get('k_komitmen', null), d = kc && kc.data;
    el.innerHTML = (d ? '<div class="atur-stats"><div><b class="num">' + (d.berlaku || 0) + '</b><span>kesepakatan aktif</span></div><div><b class="num">' + (d.menunggu_ttd || 0) + '</b><span>menunggu tanda tanganmu</span></div></div>'
        : '<p class="br-help">Data komitmen belum dimuat. Tunggu sinkron atau buka Komitmen.</p>') +
      aturBaris('Buka Komitmen', 'Baca & cari pasal, definisi A–Z', '', ' data-km="buka"') +
      '<p class="br-help" style="margin-top:8px">Usul, ubah, dan tanda tangan pasal menyusul (Fase 4b).</p>';
    $('[data-km="buka"]', el).addEventListener('click', function () { location.href = FITUR_URL.komitmen; });
  }
};

// ---------- Daily Mood ----------
// Memakai state lokal & antrean yang sama dengan app Daily Mood (daily-mood/app.js), lalu kirim baris
// '<user>|_pengaturan' ke tabel jurnal di Supabase. Gagal kirim → tetap antre, dikirim saat Daily Mood dibuka.
var DM = window.DM_DATA;
var AturMood = {
  el: null, ditarik: false, status: '',
  remote: function () { return !!(S.conn && S.conn.mode === 'remote' && me()); },
  state: function () { return LS.get(DM.KEY, null); },
  sy: function () { var s = LS.get(DM.SYNC_KEY, {}) || {}; return { snap: s.snap || {}, outbox: s.outbox || [], at: s.at || 0 }; },
  simpan: function (st, pesan) {
    LS.set(DM.KEY, st);
    if (!this.remote() || !st.profile) { if (pesan) toast(pesan); return; }
    var isi = DM.pengaturanIsi(st), sy = this.sy(), self = this;
    sy.outbox = sy.outbox.filter(function (o) { return o.k !== '_pengaturan'; }).concat([{ k: '_pengaturan', action: 'jurnal.save', isi: isi }]);
    sy.snap._pengaturan = isi; LS.set(DM.SYNC_KEY, sy);
    this.tandai('Menyimpan…');
    clearTimeout(this.t);
    this.t = setTimeout(function () {
      rpc('jurnal.save', { id: me().id + '|_pengaturan', isi: isi }).then(function () {
        var s2 = self.sy(); s2.outbox = s2.outbox.filter(function (o) { return !(o.k === '_pengaturan' && o.isi === isi); }); s2.at = Date.now(); LS.set(DM.SYNC_KEY, s2);
        self.tandai('Tersimpan di Supabase · hanya kamu'); if (pesan) toast(pesan);
      }, function (e) { self.tandai(e.offline ? 'Offline · dikirim saat online' : 'Belum terkirim: ' + e.message); });
    }, 500);
  },
  tandai: function (t) { this.status = t; var s = this.el && $('#dm-st', this.el); if (s) s.textContent = t; },
  // ambil pengaturan terbaru dari server (HP lain mungkin sudah mengubah)
  tarik: function () {
    if (!this.remote() || this.ditarik) return;
    this.ditarik = true;
    var self = this, id = me().id + '|_pengaturan';
    rpc('jurnal.list').then(function (d) {
      var row = (d.jurnal || []).filter(function (r) { return r.id === id; })[0];
      var sy = self.sy();
      if (!row || sy.outbox.some(function (o) { return o.k === '_pengaturan'; }) || row.isi === sy.snap._pengaturan) { self.tandai(row ? 'Tersimpan di Supabase · hanya kamu' : ''); return; }
      var v; try { v = JSON.parse(row.isi); } catch (e) { return; }
      var st = self.state() || { profile: null, entries: {}, custom: [], randomToo: true, demo: false };
      if (st.demo) { st.entries = {}; st.demo = false; }
      st.profile = v.profile || st.profile; st.custom = v.custom || []; st.randomToo = v.randomToo !== false; st.lastBackup = v.lastBackup || '';
      LS.set(DM.KEY, st); sy.snap._pengaturan = row.isi; LS.set(DM.SYNC_KEY, sy);
      self.status = 'Tersimpan di Supabase · hanya kamu';
      if (self.el && self.el.isConnected) self.render(self.el);
    }, function () { self.ditarik = false; });
  },
  render: function (el) {
    this.el = el;
    var st = this.state(), self = this, remote = this.remote();
    var privasi = remote ? 'Tersimpan di akunmu (Supabase). Hanya kamu yang bisa membaca, pasangan tidak.' : 'Mode demo: tersimpan di HP ini saja.';
    if (!st || !st.profile) {
      el.innerHTML = '<p class="br-help">' + (remote && !this.ditarik ? 'Memuat pengaturan…' : 'Daily Mood belum diatur. Kenalan dulu (2 pertanyaan) di Daily Mood, lalu atur detailnya di sini.') + '</p>' +
        '<a class="br-btn violet" style="width:100%;margin-top:10px" href="' + DAILY_MOOD_URL + '">Mulai Daily Mood</a>';
      this.tarik(); return;
    }
    var p = st.profile; p.conditions = p.conditions || []; p.extraTags = p.extraTags || []; st.custom = st.custom || [];
    el.innerHTML = '<p class="br-help" style="margin:0 0 4px">' + privasi + '</p>' + (remote ? '<p class="atur-st" id="dm-st" aria-live="polite">' + esc(this.status) + '</p>' : '') +
      '<div class="atur-lbl">Profil</div>' +
      '<div class="field"><label for="dm-nama">Nama panggilan</label><input id="dm-nama" class="input" maxlength="40" value="' + esc(p.name || '') + '" placeholder="Opsional"></div>' +
      '<div class="field"><span class="lbl">Usia</span><div class="chips wrap">' + DM.AGES.map(function (a) { return '<button type="button" class="chip" data-dm-age="' + a + '" aria-pressed="' + (p.age === a) + '">' + a + '</button>'; }).join('') + '</div></div>' +
      '<div class="atur-lbl">Kondisi yang sedang dijalani</div><p class="br-help" style="margin:-4px 0 10px">Menentukan pilihan "apa yang memengaruhi" di catatan harian.</p>' +
      DM.CONDITIONS.map(function (g) {
        var items = g.items.filter(function (it) { return !it.ages || it.ages.indexOf(p.age) >= 0 || p.conditions.indexOf(it.id) >= 0; });
        return '<div class="field"><span class="lbl">' + esc(g.group) + '</span><div class="chips wrap">' + items.map(function (it) {
          return '<button type="button" class="chip" data-dm-cond="' + it.id + '" aria-pressed="' + (p.conditions.indexOf(it.id) >= 0) + '">' + esc(it.label) + '</button>';
        }).join('') + '</div></div>';
      }).join('') +
      '<div class="field"><span class="lbl">Hal lain yang sering memengaruhi</span><div class="chips wrap">' +
        (p.extraTags.length ? p.extraTags.map(function (t, i) { return '<button type="button" class="chip" data-dm-rmtag="' + i + '" aria-pressed="true" aria-label="Hapus ' + esc(t) + '">' + esc(t) + ' ×</button>'; }).join('') : '<span class="faint" style="font-size:13px">Belum ada.</span>') +
      '</div><div class="atur-add"><input id="dm-tag" class="input" maxlength="30" placeholder="mis. Hobi, Ibadah" aria-label="Tag baru"><button type="button" class="btn small ghost" data-dm="tag">Tambah</button></div></div>' +
      '<div class="atur-lbl">Prompt</div><p class="br-help" style="margin:-4px 0 10px">Muncul berurutan di halaman Hari ini.</p>' +
      '<div class="list atur-prompts">' + (st.custom.length ? st.custom.map(function (x, i) {
        return '<div class="atur-prompt"><span>' + (i + 1) + '. ' + esc(x) + '</span>' + (i > 0 ? '<button type="button" class="atur-mini" data-dm-up="' + i + '" aria-label="Naikkan">↑</button>' : '') +
          '<button type="button" class="atur-mini bad" data-dm-del="' + i + '">Hapus</button></div>';
      }).join('') : '<div class="empty">Belum ada prompt custom. Hari ini memakai prompt acak.</div>') + '</div>' +
      '<div class="atur-add"><input id="dm-prompt" class="input" maxlength="160" placeholder="mis. titipan dari psikolog" aria-label="Prompt baru"><button type="button" class="btn small ghost" data-dm="prompt">Tambah</button></div>' +
      toggleHtml('dm-acak', 'Tambahkan 1 prompt acak di akhir', '', st.randomToo !== false) +
      '<div class="atur-lbl">Cadangan</div>' +
      aturBaris('Unduh cadangan (JSON)', st.lastBackup ? 'Terakhir ' + esc(st.lastBackup) : 'Salinan semua catatan di HP ini', '', ' data-dm="backup"') +
      '<a class="br-btn violet" style="width:100%;margin-top:12px" href="' + DAILY_MOOD_URL + '">Buka Daily Mood</a>';

    function ubah(fn, pesan, gambar) { var s = self.state(); fn(s); self.simpan(s, pesan); if (gambar !== false) self.render(el); }
    $('#dm-nama', el).addEventListener('change', function () { var v = this.value.trim(); ubah(function (s) { s.profile.name = v; }, 'Nama disimpan', false); });
    $$('[data-dm-age]', el).forEach(function (b) { b.addEventListener('click', function () { var a = b.getAttribute('data-dm-age'); ubah(function (s) { s.profile.age = a; }); }); });
    $$('[data-dm-cond]', el).forEach(function (b) { b.addEventListener('click', function () {
      var c = b.getAttribute('data-dm-cond');
      ubah(function (s) { var l = s.profile.conditions || []; s.profile.conditions = l.indexOf(c) >= 0 ? l.filter(function (x) { return x !== c; }) : l.concat(c); }, '', false);
      b.setAttribute('aria-pressed', String(b.getAttribute('aria-pressed') !== 'true'));
    }); });
    $$('[data-dm-rmtag]', el).forEach(function (b) { b.addEventListener('click', function () { var i = +b.getAttribute('data-dm-rmtag'); ubah(function (s) { s.profile.extraTags.splice(i, 1); }); }); });
    $$('[data-dm-del]', el).forEach(function (b) { b.addEventListener('click', function () { var i = +b.getAttribute('data-dm-del'); ubah(function (s) { s.custom.splice(i, 1); }, 'Prompt dihapus'); }); });
    $$('[data-dm-up]', el).forEach(function (b) { b.addEventListener('click', function () { var i = +b.getAttribute('data-dm-up'); ubah(function (s) { var x = s.custom[i]; s.custom[i] = s.custom[i - 1]; s.custom[i - 1] = x; }); }); });
    $('#dm-acak', el).addEventListener('click', function () { var on = this.getAttribute('aria-checked') !== 'true'; this.setAttribute('aria-checked', String(on)); ubah(function (s) { s.randomToo = on; }, '', false); });
    function tambah(id, fn, pesan) {
      var inp = $('#' + id, el), v = inp.value.trim(); if (!v) { inp.focus(); return; }
      ubah(function (s) { fn(s, v); }, pesan);
      var ni = $('#' + id, el); if (ni) ni.focus();
    }
    $('[data-dm="tag"]', el).addEventListener('click', function () { tambah('dm-tag', function (s, v) { if (s.profile.extraTags.indexOf(v) < 0) s.profile.extraTags.push(v); }, 'Tag ditambahkan'); });
    $('[data-dm="prompt"]', el).addEventListener('click', function () { tambah('dm-prompt', function (s, v) { s.custom.push(v); }, 'Prompt ditambahkan'); });
    $('#dm-tag', el).addEventListener('keydown', function (e) { if (e.key === 'Enter') { e.preventDefault(); $('[data-dm="tag"]', el).click(); } });
    $('#dm-prompt', el).addEventListener('keydown', function (e) { if (e.key === 'Enter') { e.preventDefault(); $('[data-dm="prompt"]', el).click(); } });
    $('[data-dm="backup"]', el).addEventListener('click', function () {
      var s = self.state();
      var blob = new Blob([JSON.stringify({ app: 'ruang-catat', version: 2, exportedAt: new Date().toISOString(), data: s }, null, 2)], { type: 'application/json' });
      var url = URL.createObjectURL(blob), a = document.createElement('a');
      a.href = url; a.download = 'Cadangan Daily Mood ' + todayISO() + '.json'; document.body.appendChild(a); a.click(); a.remove();
      setTimeout(function () { URL.revokeObjectURL(url); }, 4000);
      ubah(function (x) { x.lastBackup = todayISO(); }, 'Cadangan diunduh');
    });
    this.tarik();
  }
};
