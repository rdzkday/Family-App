/* Agenda — halaman /agenda/: tab To-do, Catatan, Kalender (agenda berwaktu, evaluasi bulanan, lapisan Siklus).
   Skrip biasa (bukan modul): nama top-level dipakai bersama file js/ lain. Urutan muat ada di tiap index.html halaman. */
'use strict';

// judul + tab di atas setiap view Agenda (tab didaftarkan di bawah)
function agendaHead() { return fiturHead(longToday(), syncPill()); }
function agendaFilterSeg(attr) {
  return '<div class="seg" role="group" aria-label="Filter">' + [['untukku', 'Untukku'], ['bersama', 'Bersama'], ['semua', 'Semua']].map(function (x) {
    return '<button type="button" ' + attr + '="' + x[0] + '" aria-pressed="' + (todoFilter() === x[0]) + '">' + x[1] + '</button>';
  }).join('') + '</div>';
}

// ---------- Catatan: teks bebas, tidak masuk kalender ----------
var CatatanView = {
  render: function (el) {
    el.innerHTML = agendaHead() + agendaFilterSeg('data-cf') +
      '<button type="button" class="br-btn primary" id="ct-new" style="width:100%">' + ICON.plus + 'Tulis catatan</button>' +
      '<div id="ct-list" style="margin-top:14px"></div>';
    $$('[data-cf]', el).forEach(function (b) { b.addEventListener('click', function () {
      S.prefs.todoFilter = b.getAttribute('data-cf'); persist(); CatatanView.render(el);
    }); });
    $('#ct-new', el).addEventListener('click', function () { openTodoSheet(null, { tipe: 'catatan' }); });
    this.update(el);
  },
  update: function (el) {
    var box = $('#ct-list', el); if (!box) return this.render(el);
    if (S.todos === null) { box.innerHTML = skeleton(3); return; }
    var f = todoFilter();
    var notes = todos().filter(function (t) { return C.todoTipe(t) === 'catatan' && todoMatch(t, f); })
      .sort(function (a, b) { return String(b.diubah || b.dibuat || '').localeCompare(String(a.diubah || a.dibuat || '')); });
    box.innerHTML = notes.length ? '<div class="list todo-list">' + notes.map(catatanRow).join('') + '</div>'
      : '<div class="list"><div class="empty">Belum ada catatan. Pilih "Bersama" saat menulis supaya bisa dibaca berdua.</div></div>';
    bindTodoRows(box);
  }
};

// ---------- Kalender: grid bulan berisi agenda (to-do berwaktu & evaluasi) + lapisan Siklus, lalu agenda terdekat ----------
var HARI_KAL = ['Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab', 'Min'];   // minggu dimulai Senin
function agendaList(f) { return todos().filter(function (t) { return isAgenda(t) && todoMatch(t, f || todoFilter()); }); }
function kalHariLabel(d) { var o = dateObj(d); return HARI_P[o.getDay()] + ', ' + o.getDate() + ' ' + BULAN[o.getMonth()] + (o.getFullYear() !== new Date().getFullYear() ? ' ' + o.getFullYear() : ''); }
function agendaGrup(list, today) {
  var html = '', hari = null, buka = false;
  list.forEach(function (t) {
    if (t.tanggal !== hari) {
      if (buka) html += '</div>';
      hari = t.tanggal; buka = true;
      html += '<div class="br-day' + (t.tanggal === today ? ' today' : '') + '">' + (t.tanggal < today ? 'Terlewat · ' : '') + esc(todoWaktuLabel({ tanggal: t.tanggal, jam: '' }).replace(' · seharian', '')) + '</div><div class="list todo-list">';
    }
    html += todoRow(t);
  });
  return html + (buka ? '</div>' : '');
}
var KalenderView = {
  render: function (el) {
    var self = this, today = todayISO();
    if (!S.kalBulan) S.kalBulan = thisMonth();
    if (!S.kalPilih) S.kalPilih = today;
    el.innerHTML = agendaHead() + agendaFilterSeg('data-kf') +
      '<div id="kal-sk"></div>' +
      '<section class="kal" aria-label="Kalender"><div id="kal-grid"></div></section>' +
      '<section class="kal-hari" id="kal-hari" aria-live="polite"></section>' +
      '<section class="section"><div class="section-h"><h2>Agenda terdekat</h2><button type="button" class="aside lnk" id="ag-new2">' + ICON.plus + 'Tambah</button></div>' +
      '<div id="kal-dekat"></div><p class="br-help" style="margin-top:8px">Agenda masuk Google Calendar "Rumah Kita". Siklus tidak pernah masuk Google Calendar.</p></section>';
    $$('[data-kf]', el).forEach(function (b) { b.addEventListener('click', function () { S.prefs.todoFilter = b.getAttribute('data-kf'); persist(); self.render(el); }); });
    $('#ag-new2', el).addEventListener('click', function () { openTodoSheet(null, { agenda: true, tanggal: S.kalPilih >= today ? S.kalPilih : today }); });
    this.update(el);
  },
  update: function (el) {
    if (!$('#kal-grid', el)) return this.render(el);
    var self = this;
    var sk = $('#kal-sk', el);
    sk.innerHTML = typeof siklusKartuHtml === 'function' ? siklusKartuHtml(false) : '';
    if (sk.innerHTML) bindSiklusKartu(sk, function () { self.update(el); });
    this.grid(el); this.hari(el); this.dekat(el);
  },
  grid: function (el) {
    var self = this, b = S.kalBulan, today = todayISO(), p = b.split('-');
    var n = new Date(+p[0], +p[1], 0).getDate(), awal = (new Date(+p[0], +p[1] - 1, 1).getDay() + 6) % 7;
    var per = {};
    agendaList().forEach(function (t) { if (t.tanggal.slice(0, 7) === b) (per[t.tanggal] = per[t.tanggal] || []).push(t); });
    var sk = typeof siklusTandaBulan === 'function' ? siklusTandaBulan(b) : {};
    var adaKira = Object.keys(sk).some(function (k) { return sk[k] === 'kira'; });
    var lapis = typeof skAktif === 'function' && skAktif();
    var sel = '';
    for (var i = 0; i < awal; i++) sel += '<span class="kal-d kosong" aria-hidden="true"></span>';
    for (var d = 1; d <= n; d++) {
      var iso = b + '-' + pad(d), ag = per[iso] || [];
      var bukaAg = ag.filter(function (t) { return !C.bool(t.selesai); });
      var lbl = kalHariLabel(iso) + (ag.length ? ', ' + ag.length + ' agenda' : '') + (sk[iso] === 'catat' ? ', siklus tercatat' : sk[iso] === 'kira' ? ', perkiraan siklus' : '');
      var dots = '';
      if (ag.length) dots += '<i class="ag' + (bukaAg.length ? '' : ' beres') + '"></i>';
      if (ag.length > 1) dots += '<i class="ag' + (bukaAg.length > 1 ? '' : ' beres') + '"></i>';
      sel += '<button type="button" class="kal-d' + (iso === today ? ' hari-ini' : '') + (iso === S.kalPilih ? ' pilih' : '') + (sk[iso] ? ' sk-' + sk[iso] : '') +
        '" data-kd="' + iso + '" aria-label="' + esc(lbl) + '" aria-pressed="' + (iso === S.kalPilih) + '"><span class="n">' + d + '</span><span class="dots">' + dots + '</span></button>';
    }
    $('#kal-grid', el).innerHTML = '<div class="kal-nav"><button type="button" class="iconbtn" data-km="-1" aria-label="Bulan sebelumnya">' + ICON.left + '</button>' +
      '<strong>' + monthName(b) + '</strong>' +
      (b !== thisMonth() ? '<button type="button" class="kal-today" data-km="0">Hari ini</button>' : '') +
      '<button type="button" class="iconbtn" data-km="1" aria-label="Bulan berikutnya">' + ICON.right + '</button></div>' +
      '<div class="kal-w" aria-hidden="true">' + HARI_KAL.map(function (h) { return '<span>' + h + '</span>'; }).join('') + '</div>' +
      '<div class="kal-g">' + sel + '</div>' +
      '<div class="kal-leg"><span><i class="ag"></i>Agenda</span>' +
      (lapis ? '<button type="button" class="kal-chip" id="kal-sk-tg" role="switch" aria-checked="' + skTampil() + '" aria-label="Tampilkan Siklus di kalender"><i class="skc"></i>Siklus' + (skPemilik() ? '' : ' ' + esc(skNamaPemilik())) + '</button>' +
        (skTampil() && adaKira ? '<span><i class="skk"></i>Perkiraan</span>' : '') : '') + '</div>';
    $$('[data-km]', el).forEach(function (x) { x.addEventListener('click', function () {
      var m = +x.getAttribute('data-km');
      S.kalBulan = m === 0 ? thisMonth() : shiftMonth(S.kalBulan, m);
      if (m === 0) S.kalPilih = todayISO();
      self.grid(el); self.hari(el);
    }); });
    $$('[data-kd]', el).forEach(function (x) { x.addEventListener('click', function () {
      S.kalPilih = x.getAttribute('data-kd');
      $$('[data-kd]', el).forEach(function (y) { var on = y === x; y.classList.toggle('pilih', on); y.setAttribute('aria-pressed', String(on)); });
      self.hari(el);
    }); });
    var tg = $('#kal-sk-tg', el);
    if (tg) tg.addEventListener('click', function () {
      var on = !skTampil();
      skKirim('siklus.atur', { tampil: on }, on ? 'Siklus ditampilkan' : 'Siklus disembunyikan. Nyalakan lagi lewat chip ini atau Pengaturan.');
      self.update(el);
    });
  },
  hari: function (el) {
    var self = this, d = S.kalPilih, today = todayISO(), box = $('#kal-hari', el);
    if (d.slice(0, 7) !== S.kalBulan) { box.innerHTML = ''; return; }
    var list = todoSorted(agendaList().filter(function (t) { return t.tanggal === d; }));
    var skH = typeof siklusPanelHari === 'function' ? siklusPanelHari(d) : '';
    box.innerHTML = '<div class="kal-hari-h"><h2>' + esc(d === today ? 'Hari ini · ' + kalHariLabel(d) : kalHariLabel(d)) + '</h2>' +
      (d >= today ? '<button type="button" class="br-pill blue" id="kal-add">' + ICON.plus + 'Agenda</button>' : '') + '</div>' + skH +
      (S.todos === null ? skeleton(1) : list.length ? '<div class="list todo-list">' + list.map(todoRow).join('') + '</div>'
        : '<p class="br-empty" style="margin:0">Tidak ada agenda' + (d >= today ? '. Tambah lewat tombol Agenda.' : '.') + '</p>');
    bindTodoRows(box);
    if (skH) bindSiklusHari(box, d, function () { self.update(el); });
    var add = $('#kal-add', box);
    if (add) add.addEventListener('click', function () { openTodoSheet(null, { agenda: true, tanggal: d }); });
  },
  dekat: function (el) {
    var box = $('#kal-dekat', el), today = todayISO();
    if (S.todos === null) { box.innerHTML = skeleton(3); return; }
    var buka = todoSorted(agendaList().filter(function (t) { return !C.bool(t.selesai) && t.tanggal >= C.addDays(today, -7); }));
    var lewat = buka.filter(function (t) { return t.tanggal < today; });
    var datang = buka.filter(function (t) { return t.tanggal >= today; }).slice(0, 8);
    box.innerHTML = lewat.length || datang.length ? agendaGrup(lewat.concat(datang), today)
      : '<div class="list"><div class="empty">Belum ada agenda mendatang. Tap tanggal di kalender, lalu tambah agenda.</div></div>';
    bindTodoRows(box);
  }
};
var JadwalView = KalenderView;   // nama lama

// ---------- daftar halaman (shared/shell.js) ----------
// id tab 'jadwal' dipertahankan; #kalender & #siklus (link lama/baru) diarahkan ke sana
daftarHalaman('agenda', [['todo', 'To-do', TodoView], ['catatan', 'Catatan', CatatanView], ['jadwal', 'Kalender', KalenderView]], { kalender: 'jadwal', siklus: 'jadwal' });
