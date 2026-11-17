/* Family App — To-do & catatan rumah tangga.
   Skrip biasa (bukan modul): nama top-level dipakai bersama file js/ lain. Urutan muat ada di index.html & kantong.html. */
'use strict';

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
