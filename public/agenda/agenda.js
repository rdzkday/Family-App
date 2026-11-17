/* Agenda — halaman /agenda/: tab To-do, Catatan, Jadwal (to-do berwaktu & evaluasi bulanan).
   Skrip biasa (bukan modul): nama top-level dipakai bersama file js/ lain. Urutan muat ada di tiap index.html halaman. */
'use strict';

// judul + tab di atas setiap view Agenda
function agendaHead(aktif) {
  return '<div class="topbar"><div><div class="date">' + longToday() + '</div><h1>Agenda</h1></div><div class="top-actions">' + berandaBtn() + syncPill() + '</div></div>' +
    '<div class="seg ag-tabs" role="tablist" aria-label="Bagian Agenda">' + [['todo', 'To-do'], ['catatan', 'Catatan'], ['jadwal', 'Jadwal']].map(function (x) {
      return '<button type="button" role="tab" data-brgo="' + x[0] + '" aria-selected="' + (aktif === x[0]) + '" aria-pressed="' + (aktif === x[0]) + '">' + x[1] + '</button>';
    }).join('') + '</div>';
}
function agendaFilterSeg(attr) {
  return '<div class="seg" role="group" aria-label="Filter">' + [['untukku', 'Untukku'], ['bersama', 'Bersama'], ['semua', 'Semua']].map(function (x) {
    return '<button type="button" ' + attr + '="' + x[0] + '" aria-pressed="' + (todoFilter() === x[0]) + '">' + x[1] + '</button>';
  }).join('') + '</div>';
}

// ---------- Catatan: teks bebas, tidak masuk kalender ----------
var CatatanView = {
  render: function (el) {
    el.innerHTML = agendaHead('catatan') + agendaFilterSeg('data-cf') +
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

// ---------- Jadwal: to-do & evaluasi yang punya waktu, dikelompokkan per hari ----------
var JadwalView = {
  render: function (el) {
    var today = todayISO();
    var list = todoSorted(todos().filter(function (t) { return C.todoTipe(t) !== 'catatan' && t.tanggal && !C.bool(t.selesai) && t.tanggal >= C.addDays(today, -7); }));
    var html = agendaHead('jadwal') +
      '<p class="muted" style="margin:0 0 12px;font-size:14px">To-do berwaktu & evaluasi bulanan. Semuanya masuk Google Calendar "Rumah Kita".</p>' +
      '<button type="button" class="br-btn primary" id="ag-new" style="width:100%">' + ICON.plus + 'Tambah jadwal</button>';
    if (S.todos === null) html += skeleton(3);
    else if (!list.length) html += '<div class="list" style="margin-top:14px"><div class="empty">Belum ada jadwal. To-do yang diberi waktu muncul di sini.</div></div>';
    else {
      var hari = null, buka = false;
      list.forEach(function (t) {
        if (t.tanggal !== hari) {
          if (buka) html += '</div>';
          hari = t.tanggal; buka = true;
          var lbl = t.tanggal < today ? 'Terlewat · ' : '';
          html += '<div class="br-day' + (t.tanggal === today ? ' today' : '') + '">' + lbl + esc(todoWaktuLabel({ tanggal: t.tanggal, jam: '' }).replace(' · seharian', '')) + '</div><div class="list todo-list">';
        }
        html += todoRow(t);
      });
      if (buka) html += '</div>';
    }
    el.innerHTML = html;
    bindTodoRows(el);
    $('#ag-new', el).addEventListener('click', function () { openTodoSheet(null, { aturWaktu: true }); });
  }
};
