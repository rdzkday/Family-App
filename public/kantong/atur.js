/* Kantong — Pengaturan Kantong: daftar kantong, kategori, budget bulanan.
   Ditampilkan di Beranda (bagian Pengaturan > Kantong, expand-collapse). Form dibuka sebagai sheet.
   Skrip biasa (bukan modul): nama top-level dipakai bersama file js/ lain. Urutan muat ada di tiap index.html halaman. */
'use strict';

function settingCall(action, payload, okMsg) {
  return rpc(action, payload).then(function (d) { toast(okMsg); return sync().then(function () { return d; }); })
    .catch(function (e) { toast(e.offline ? 'Perlu koneksi internet untuk menyimpan pengaturan' : e.message, true); throw e; });
}

var AturKantong = {
  render: function (el) {
    var d = db(), saldo = S.boot.saldo || {};
    el.innerHTML = d.Buku.slice().sort(function (a, b) { return a.urutan - b.urutan; }).map(function (b) {
      var ks = d.Kantong.filter(function (k) { return k.buku === b.id; });
      return '<div class="atur-grp"><div class="section-h"><h2 style="display:flex;align-items:center;gap:8px"><span style="width:8px;height:8px;border-radius:50%;background:' + bukuColor(b.id) + '"></span>' + esc(b.nama) + '</h2>' +
        (canWrite(b.id) ? '<button class="btn small ghost" data-addk="' + esc(b.id) + '">+ Tambah</button>' : '<span class="aside">hanya lihat</span>') + '</div><div class="list">' +
        (ks.length ? ks.map(function (k) {
          var v = saldo[k.id] || 0;
          return '<button class="wallet" data-k="' + esc(k.id) + '"' + (C.bool(k.aktif) ? '' : ' style="opacity:.45"') + '><span class="main"><span class="t1" style="display:block">' + esc(k.nama) + '</span><span class="t2">' + k.jenis + (C.bool(k.aktif) ? '' : ', nonaktif') + '</span></span><span class="amt num' + (v < 0 ? ' neg' : '') + '">' + rp(v) + '</span></button>';
        }).join('') : '<div class="empty">Belum ada kantong.</div>') + '</div></div>';
    }).join('');
    $$('[data-k]', el).forEach(function (b) { b.addEventListener('click', function () { openKantongSheet(C.byId(db().Kantong)[b.getAttribute('data-k')]); }); });
    $$('[data-addk]', el).forEach(function (b) { b.addEventListener('click', function () { openKantongSheet(null, b.getAttribute('data-addk')); }); });
  }
};
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

var AturKategori = {
  render: function (el) {
    var d = db();
    el.innerHTML =
      '<div class="seg" style="margin-bottom:16px">' + ['Pengeluaran', 'Pemasukan'].map(function (t) { return '<button data-ct="' + t + '" aria-pressed="' + (S.catTab === t) + '">' + t + '</button>'; }).join('') + '</div>' +
      '<div class="list">' + d.Kategori.filter(function (k) { return k.tipe === S.catTab && k.id !== C.KAT_REIMBURSE; }).sort(function (a, b) { return C.bool(b.aktif) - C.bool(a.aktif) || a.urutan - b.urutan; }).map(function (k) {
        return '<button class="wallet" data-c="' + esc(k.id) + '"' + (C.bool(k.aktif) ? '' : ' style="opacity:.45"') + '><span style="width:12px;height:12px;border-radius:4px;background:' + k.warna + ';flex:none"></span><span class="main"><span class="t1" style="display:block">' + esc(k.nama) + '</span><span class="t2" style="display:flex;gap:6px;flex-wrap:wrap;margin-top:4px">' +
          C.scopeOf(k).map(function (b) { var bk = bukuById(b); return bk ? '<span class="tag" style="--c:' + bukuColor(b) + '"><i></i>' + esc(bk.nama) + '</span>' : ''; }).join('') +
          (C.bool(k.hitung) ? '' : '<span class="tag">tidak dihitung</span>') + (C.bool(k.aktif) ? '' : '<span class="tag">nonaktif</span>') + '</span></span>' + ICON.right.replace('<svg', '<svg width="18" height="18" style="color:var(--text-3)"') + '</button>';
      }).join('') + '</div>' +
      '<button class="btn ghost" id="add-cat">+ Tambah kategori ' + S.catTab.toLowerCase() + '</button>';
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
    this.el = el;
    el.innerHTML =
      '<div class="buku-tabs">' + writable.map(function (b) { return '<button data-bb="' + esc(b.id) + '" aria-pressed="' + (self.buku === b.id) + '" style="--c:' + bukuColor(b.id) + '"><i></i>' + esc(b.nama) + '</button>'; }).join('') + '</div>' +
      monthBar() + '<div id="be"></div>';
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
function openBudgetSheet() {
  openSheet('Budget bulanan', function (sh) { BudgetEdit.render(sh.el); });
}
