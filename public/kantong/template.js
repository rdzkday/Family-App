/* Kantong — Onboarding manajer keuangan, pilih template kategori, rencana budget 40:30:20:10.
   Isi template & hitungan ada di shared/core.js (TEMPLATE_KATEGORI, bagiRencana), jadi server & layar ini selalu sama.
   Skrip biasa (bukan modul): nama top-level dipakai bersama file js/ lain. Urutan muat ada di tiap index.html halaman. */
'use strict';

var TPL_LEVEL_INFO = {
  simpel: ['Simpel', 'Kategori utama saja'],
  menengah: ['Menengah', 'Plus sub-kategori yang sering dipakai'],
  detail: ['Detail', 'Paling rinci, buat yang suka mencatat detail']
};
function bukuSistemNama(b) { return b.tipe === 'Bersama' ? b.nama : 'Pribadi ' + b.nama; }
function manajerOf(b) { return b && b.manajer ? userName(b.manajer) : ''; }
function bolehRencana(bukuId) { return C.bolehAturRencana(db(), me(), bukuId); }
function rencanaOf(bukuId) { return ((S.boot && S.boot.rencana) || {})[bukuId] || { penghasilan: 0, rasio: C.RASIO_BAKU }; }
function tplLewat() { S.prefs.tplLewat = S.prefs.tplLewat || {}; return S.prefs.tplLewat; }

// ---------- gerbang di halaman Kantong ----------
// Kembalikan { html, bind } kalau perlu layar khusus (manajer / template), null kalau Kantong normal.
function kantongGate() {
  var d = db(), user = me();
  if (!user || !d.Buku.length) return null;
  var tanpaManajer = d.Buku.filter(function (b) { return b.tipe === 'Bersama' && !b.manajer; })[0];
  if (tanpaManajer) return { kind: 'manajer', html: manajerHtml(tanpaManajer), bind: function (el) { bindManajer(el, tanpaManajer); } };
  var kosong = C.writableBuku(d, user).filter(function (b) { return C.bukuKosong(d, b.id) && !tplLewat()[b.id] && bolehRencana(b.id); })[0];
  if (kosong) {
    if (!S.tpl || S.tpl.buku !== kosong.id) S.tpl = tplBaru(kosong.id);
    return { kind: 'tpl-' + kosong.id, html: wizardHtml(), bind: bindWizard };
  }
  return null;
}
// kartu info untuk anggota yang menunggu manajer memilih template
function menungguTemplateHtml() {
  var d = db();
  return d.Buku.filter(function (b) { return b.tipe === 'Bersama' && b.manajer && canWrite(b.id) && !bolehRencana(b.id) && C.bukuKosong(d, b.id); })
    .map(function (b) {
      return '<div class="tpl-wait"><span class="dot" style="background:' + bukuColor(b.id) + '"></span><span>Menunggu <b>' + esc(manajerOf(b)) + '</b> memilih template kategori ' + esc(b.nama) + '.</span></div>';
    }).join('');
}

// ---------- pilih manajer keuangan ----------
function manajerHtml(b) {
  var us = db().Users;
  return '<div class="card tpl">' +
    '<div class="tpl-step">Sekali saja</div>' +
    '<h2 class="tpl-title">Siapa manajer keuangan ' + esc(b.nama.toLowerCase()) + '?</h2>' +
    '<p class="tpl-lead">Manajer memilih template kategori dan mengatur budget 40:30:20:10 untuk buku ' + esc(b.nama) + '. Semua anggota tetap bisa mencatat transaksi.</p>' +
    '<div class="tpl-pilih">' + us.map(function (u) {
      return '<button type="button" class="tpl-user" data-mj="' + esc(u.id) + '"><span class="av">' + esc(String(u.nama || u.id).charAt(0).toUpperCase()) + '</span>' +
        '<span class="main"><span class="t1">' + esc(u.nama) + (u.id === me().id ? ' <span class="faint">(kamu)</span>' : '') + '</span></span>' + ICON.right + '</button>';
    }).join('') + '</div>' +
    '<p class="faint tpl-note">Bisa diganti nanti oleh manajer (Pengaturan › Kantong) atau admin.</p><div class="err" id="mj-err"></div></div>';
}
function bindManajer(el, b) {
  $$('[data-mj]', el).forEach(function (btn) { btn.addEventListener('click', function () {
    var uid = btn.getAttribute('data-mj');
    if (!confirm('Jadikan ' + userName(uid) + ' manajer keuangan ' + b.nama + '?')) return;
    $$('[data-mj]', el).forEach(function (x) { x.disabled = true; });
    simpanManajer(b.id, uid).catch(function (e) {
      $$('[data-mj]', el).forEach(function (x) { x.disabled = false; });
      var er = $('#mj-err', el); if (er) er.textContent = e.message;
    });
  }); });
}
function simpanManajer(bukuId, uid) {
  return settingCall('buku.manajer', { buku: bukuId, user: uid }, 'Manajer keuangan: ' + userName(uid)).then(function () { refresh(); });
}

// ---------- wizard template ----------
function tplBaru(bukuId) {
  var r = rencanaOf(bukuId);
  return { buku: bukuId, step: 1, level: 'menengah', gaji: r.penghasilan || 0, rasio: String(r.rasio || C.RASIO_BAKU).split(',').map(Number), items: null, busy: false, error: '' };
}
function tplDaftar(st) { return C.templateDaftar(C.jenisTemplate(bukuById(st.buku)), st.level); }
function tplInduk(st) {   // induk Pengeluaran dari template (kunci = nama) untuk pratinjau pembagian
  return tplDaftar(st).filter(function (x) { return x.tipe === 'Pengeluaran' && !x.induk && x.pos; }).map(function (x) { return { key: x.nama, nama: x.nama, pos: x.pos }; });
}
function wizardHtml() {
  var st = S.tpl, b = bukuById(st.buku);
  var head = '<div class="tpl-step">Langkah ' + st.step + ' dari 4 · ' + esc(bukuSistemNama(b)) + '</div>';
  var body = '';
  if (st.step === 1) {
    body = '<h2 class="tpl-title">Pilih template kategori</h2><p class="tpl-lead">Kategori langsung terisi. Bisa diubah kapan saja di Pengaturan.</p>' +
      '<div class="tpl-levels">' + C.TEMPLATE_LEVEL.map(function (lv) {
        var n = C.templateDaftar(C.jenisTemplate(b), lv).length;
        return '<button type="button" class="tpl-level" data-lv="' + lv + '" aria-pressed="' + (st.level === lv) + '"><span class="t1">' + TPL_LEVEL_INFO[lv][0] + '</span>' +
          '<span class="t2">' + TPL_LEVEL_INFO[lv][1] + '</span><span class="n num">' + n + ' kategori</span></button>';
      }).join('') + '</div>' +
      '<div class="tpl-nav"><button type="button" class="btn ghost" data-tpl="kosong">Mulai kosong</button><button type="button" class="btn" data-tpl="next">Lihat isinya</button></div>';
  } else if (st.step === 2) {
    body = '<h2 class="tpl-title">Isi template ' + TPL_LEVEL_INFO[st.level][0] + '</h2><p class="tpl-lead">Yang namanya sudah ada di buku ini akan dilewati.</p>' +
      tplPreviewHtml(tplDaftar(st)) + '<div class="tpl-nav"><button type="button" class="btn ghost" data-tpl="back">Kembali</button><button type="button" class="btn" data-tpl="next">Lanjut</button></div>';
  } else if (st.step === 3) {
    body = '<h2 class="tpl-title">Penghasilan per bulan</h2><p class="tpl-lead">Dipakai untuk membagi budget 40:30:20:10 ke kategori. ' +
      (b.tipe === 'Bersama' ? 'Isi total uang yang masuk ke ' + esc(b.nama) + ' per bulan.' : 'Isi total penghasilanmu per bulan.') + '</p>' +
      '<div class="field"><label for="tpl-gaji">Penghasilan</label><input id="tpl-gaji" class="input num" inputmode="numeric" placeholder="0" value="' + (st.gaji ? fmt(st.gaji) : '') + '"></div>' +
      '<div class="tpl-nav"><button type="button" class="btn ghost" data-tpl="back">Kembali</button><button type="button" class="btn ghost" data-tpl="lewati">Lewati</button><button type="button" class="btn" data-tpl="next">Lanjut</button></div>';
  } else {
    body = '<h2 class="tpl-title">Cek pembagian budget</h2><p class="tpl-lead">Dari ' + rp(st.gaji) + ' per bulan. Rasio dan nominal per kategori bisa diubah.</p>' +
      pembagianHtml(st, tplInduk(st)) +
      '<div class="err" id="tpl-err">' + esc(st.error || '') + '</div>' +
      '<div class="tpl-nav"><button type="button" class="btn ghost" data-tpl="back">Kembali</button><button type="button" class="btn" data-tpl="simpan"' + (st.busy || !rasioOk(st) ? ' disabled' : '') + '>' + (st.busy ? 'Menyimpan…' : 'Simpan') + '</button></div>';
  }
  if (st.step === 3) body += '<div class="err" id="tpl-err">' + esc(st.error || '') + '</div>';
  return '<div class="card tpl">' + head + body + '</div>';
}
function tplPreviewHtml(list) {
  var keluar = list.filter(function (x) { return x.tipe === 'Pengeluaran'; }), masuk = list.filter(function (x) { return x.tipe === 'Pemasukan'; });
  var html = '<div class="tpl-prev">';
  keluar.forEach(function (x) {
    html += x.induk ? '<div class="tpl-row sub"><span class="ln"></span><span>' + esc(x.nama) + '</span></div>'
      : '<div class="tpl-row"><span class="dot" style="background:' + x.warna + '"></span><span class="nm">' + esc(x.nama) + '</span><span class="tag pos-' + x.pos + '">' + esc(C.POS_NAMA[x.pos] || '') + '</span></div>';
  });
  html += '<div class="tpl-h">Pemasukan</div>' + masuk.map(function (x) {
    return '<div class="tpl-row"><span class="dot" style="background:' + x.warna + '"></span><span class="nm">' + esc(x.nama) + '</span></div>';
  }).join('');
  return html + '</div>';
}
function rasioOk(st) { return st.rasio.length === 4 && st.rasio.reduce(function (s, x) { return s + (x || 0); }, 0) === 100; }
// pembagian: 4 pos, rasio bisa diubah, nominal per kategori bisa diubah. st.items: {key: nominal} hasil ubahan user.
function hitungPembagian(st, induk) {
  if (!rasioOk(st)) return null;
  var h = C.bagiRencana(induk, st.gaji, st.rasio.join(','));
  if (st.items) Object.keys(st.items).forEach(function (k) { if (k in h.items) h.items[k] = st.items[k]; });
  return h;
}
function pembagianHtml(st, induk) {
  var h = hitungPembagian(st, induk), total = st.rasio.reduce(function (s, x) { return s + (x || 0); }, 0);
  var html = '<div class="tpl-rasio" role="group" aria-label="Rasio budget">' + C.POS.map(function (p, i) {
    return '<label><span>' + C.POS_NAMA[p] + '</span><span class="pin"><input class="input num" inputmode="numeric" maxlength="3" data-rasio="' + i + '" value="' + st.rasio[i] + '" aria-label="Persen ' + C.POS_NAMA[p] + '">%</span></label>';
  }).join('') + '</div>' +
    (total !== 100 ? '<p class="tpl-warn">Total rasio ' + total + '%. Harus 100%.</p>' : '');
  if (!h) return html;
  html += h.pos.map(function (p) {
    var anggota = induk.filter(function (x) { return x.pos === p.pos; });
    var jml = anggota.reduce(function (s, x) { return s + (h.items[x.key] || 0); }, 0);
    return '<div class="tpl-pos pos-' + p.pos + '"><div class="tpl-pos-h"><span class="nm">' + p.nama + ' <span class="faint">' + p.persen + '%</span></span><span class="num">' + rp(anggota.length ? jml : p.nominal) + '</span></div>' +
      (anggota.length ? anggota.map(function (x) {
        return '<div class="budget-row"><span class="name"><span style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap">' + esc(x.nama) + '</span></span>' +
          '<input class="input num" inputmode="numeric" data-tplv="' + esc(x.key) + '" value="' + (h.items[x.key] ? fmt(h.items[x.key]) : '') + '" placeholder="0" aria-label="Budget ' + esc(x.nama) + '"></div>';
      }).join('') : '<p class="faint tpl-note">Belum ada kategori di pos ini, jadi ' + rp(p.nominal) + ' belum dialokasikan.</p>') + '</div>';
  }).join('');
  var semua = Object.keys(h.items).reduce(function (s, k) { return s + h.items[k]; }, 0);
  return html + '<div class="total-row"><span>Total budget</span><span class="num" style="color:var(--text);font-weight:700">' + rp(semua) + '</span></div>';
}
// pasang input rasio & nominal; onUbah dipanggil untuk menggambar ulang
function bindPembagian(el, st, onUbah) {
  $$('[data-rasio]', el).forEach(function (i) { i.addEventListener('change', function () {
    st.rasio[+i.getAttribute('data-rasio')] = Math.min(100, parseNum(i.value)); st.items = null; onUbah();
  }); });
  $$('[data-tplv]', el).forEach(function (i) {
    i.addEventListener('input', function () { var n = parseNum(i.value); i.value = n ? fmt(n) : ''; });
    i.addEventListener('change', function () { st.items = st.items || {}; st.items[i.getAttribute('data-tplv')] = parseNum(i.value); onUbah(); });
  });
}
function gambarUlang() { var el = $('#tpl-box'); if (el) { el.innerHTML = wizardHtml(); bindWizard(el); } }
function bindWizard(el) {
  var st = S.tpl;
  $$('[data-lv]', el).forEach(function (b) { b.addEventListener('click', function () { st.level = b.getAttribute('data-lv'); st.items = null; gambarUlang(); }); });
  var gaji = $('#tpl-gaji', el);
  if (gaji) gaji.addEventListener('input', function () { var n = parseNum(gaji.value); gaji.value = n ? fmt(n) : ''; st.gaji = n; });
  if (st.step === 4) bindPembagian(el, st, gambarUlang);
  $$('[data-tpl]', el).forEach(function (b) { b.addEventListener('click', function () {
    var a = b.getAttribute('data-tpl');
    st.error = '';
    if (a === 'kosong') {
      if (!confirm('Mulai tanpa template? Kategori bisa ditambah sendiri atau dari template nanti di Pengaturan › Kantong.')) return;
      tplLewat()[st.buku] = true; persist(); S.tpl = null; refresh(); return;
    }
    if (a === 'back') st.step = Math.max(1, st.step - 1);
    if (a === 'next') {
      if (st.step === 3 && !st.gaji) { st.error = 'Isi penghasilan, atau pilih Lewati'; gambarUlang(); return; }
      st.step = Math.min(4, st.step + 1); st.items = null;
    }
    if (a === 'lewati') { simpanTemplate(st, false); return; }
    if (a === 'simpan') { simpanTemplate(st, true); return; }
    gambarUlang(); window.scrollTo(0, 0);
  }); });
}
// simpan: 1) buat kategori dari template, 2) kalau penghasilan diisi, simpan rencana & budget
function simpanTemplate(st, denganBudget) {
  st.busy = true; gambarUlang();
  var bulan = thisMonth();
  rpc('kategori.template', { buku: st.buku, level: st.level }).then(function (r) {
    if (!denganBudget || !st.gaji) return r;
    var h = hitungPembagian(st, tplInduk(st)) || { items: {} };
    var items = {};   // nama induk -> id kategori di buku ini
    (r.kategori || []).forEach(function (k) {
      if (k.tipe === 'Pengeluaran' && !k.induk && k.buku === st.buku) {
        Object.keys(h.items).forEach(function (nm) { if (C.normNama(nm) === C.normNama(k.nama)) items[k.id] = h.items[nm]; });
      }
    });
    return rpc('budget.rencana', { buku: st.buku, penghasilan: st.gaji, rasio: st.rasio.join(','), bulan: bulan, items: items }).then(function () { return r; });
  }).then(function (r) {
    toast(r.dibuat + ' kategori dibuat' + (r.dilewati.length ? ', ' + r.dilewati.length + ' dilewati' : '') + (denganBudget && st.gaji ? ', budget terisi' : ''));
    S.tpl = null;
    return sync();
  }).catch(function (e) {
    st.busy = false; st.error = e.offline ? 'Perlu koneksi internet untuk menyimpan' : e.message; gambarUlang();
  });
}

// ---------- rencana budget untuk kategori yang sudah ada (Pengaturan › Budget) ----------
function openRencanaSheet(bukuId, bulan) {
  var st = tplBaru(bukuId);
  openSheet('Budget otomatis 40:30:20:10', function (sh) {
    function draw() {
      var induk = C.indukRencana(db(), bukuId);
      sh.el.innerHTML = '<p class="faint" style="font-size:13px;margin:0 0 12px">' + esc(bukuSistemNama(bukuById(bukuId))) + ', mulai ' + monthName(bulan) + '. Pengeluaran di sub-kategori masuk ke budget induknya.</p>' +
        '<div class="field"><label for="rc-gaji">Penghasilan per bulan</label><input id="rc-gaji" class="input num" inputmode="numeric" placeholder="0" value="' + (st.gaji ? fmt(st.gaji) : '') + '"></div>' +
        (st.gaji ? pembagianHtml(st, induk) : '<p class="faint tpl-note">Isi penghasilan untuk melihat pembagian.</p>') +
        (induk.length ? '' : '<p class="tpl-warn">Belum ada kategori induk dengan pos. Atur pos di tiap kategori dulu.</p>') +
        '<div class="err" id="rc-err"></div><button class="btn" id="rc-save"' + (st.gaji && rasioOk(st) ? '' : ' disabled') + '>Simpan budget</button>';
      var g = $('#rc-gaji', sh.el);
      g.addEventListener('input', function () { var n = parseNum(g.value); g.value = n ? fmt(n) : ''; });
      g.addEventListener('change', function () { st.gaji = parseNum(g.value); st.items = null; draw(); });
      bindPembagian(sh.el, st, draw);
      $('#rc-save', sh.el).addEventListener('click', function () {
        var btn = this; btn.disabled = true;
        settingCall('budget.rencana', { buku: bukuId, penghasilan: st.gaji, rasio: st.rasio.join(','), bulan: bulan, items: st.items || {} }, 'Budget disimpan')
          .then(function () { sh.close(); refresh(); }, function (e) { btn.disabled = false; $('#rc-err', sh.el).textContent = e.message; });
      });
    }
    draw();
  });
}

// ---------- tambah dari template (Pengaturan › Kategori) ----------
function openTemplateSheet() {
  var d = db();
  var bisa = C.writableBuku(d, me()).filter(function (b) { return bolehRencana(b.id); });
  var f = { buku: (bisa[0] || {}).id, level: 'menengah' };
  openSheet('Tambah dari template', function (sh) {
    function draw() {
      if (!bisa.length) { sh.el.innerHTML = '<div class="empty">Hanya pemilik buku atau manajer keuangan yang bisa memakai template.</div>'; return; }
      var b = bukuById(f.buku), list = C.templateDaftar(C.jenisTemplate(b), f.level);
      var ada = d.Kategori.filter(function (k) { return !C.isSistem(k) && C.scopeOf(k).indexOf(f.buku) >= 0; });
      var namaAda = {}; ada.forEach(function (k) { var ind = k.induk ? kategoriOf(k.induk) : null; namaAda[C.normNama((ind ? ind.nama + '>' : '') + k.nama)] = 1; });
      var baru = list.filter(function (x) { return !namaAda[C.normNama((x.induk ? x.induk + '>' : '') + x.nama)]; }).length;
      sh.el.innerHTML = (bisa.length > 1 ? '<div class="field"><span class="lbl">Buku</span><div class="chips wrap">' + bisa.map(function (x) {
        return '<button type="button" class="chip" data-tb="' + esc(x.id) + '" aria-pressed="' + (f.buku === x.id) + '" style="--c:' + bukuColor(x.id) + '"><span class="dot" style="background:' + bukuColor(x.id) + '"></span>' + esc(x.nama) + '</button>';
      }).join('') + '</div></div>' : '') +
        '<div class="tpl-levels">' + C.TEMPLATE_LEVEL.map(function (lv) {
          return '<button type="button" class="tpl-level" data-lv="' + lv + '" aria-pressed="' + (f.level === lv) + '"><span class="t1">' + TPL_LEVEL_INFO[lv][0] + '</span><span class="t2">' + TPL_LEVEL_INFO[lv][1] + '</span><span class="n num">' + C.templateDaftar(C.jenisTemplate(b), lv).length + ' kategori</span></button>';
        }).join('') + '</div>' +
        '<p class="hint">' + baru + ' kategori baru, ' + (list.length - baru) + ' sudah ada (dilewati).</p>' + tplPreviewHtml(list) +
        '<div class="err" id="ts-err"></div><button class="btn" id="ts-save"' + (baru ? '' : ' disabled') + '>Tambahkan ' + baru + ' kategori</button>';
      $$('[data-tb]', sh.el).forEach(function (x) { x.addEventListener('click', function () { f.buku = x.getAttribute('data-tb'); draw(); }); });
      $$('[data-lv]', sh.el).forEach(function (x) { x.addEventListener('click', function () { f.level = x.getAttribute('data-lv'); draw(); }); });
      $('#ts-save', sh.el).addEventListener('click', function () {
        var btn = this; btn.disabled = true;
        rpc('kategori.template', { buku: f.buku, level: f.level }).then(function (r) {
          toast(r.dibuat + ' kategori ditambahkan' + (r.dilewati.length ? ', ' + r.dilewati.length + ' dilewati' : ''));
          sh.close(); return sync();
        }).catch(function (e) { btn.disabled = false; $('#ts-err', sh.el).textContent = e.offline ? 'Perlu koneksi internet' : e.message; });
      });
    }
    draw();
  });
}

// ---------- ganti manajer (Pengaturan › Kantong) ----------
function manajerAturHtml() {
  return db().Buku.filter(function (b) { return b.tipe === 'Bersama'; }).map(function (b) {
    var nama = manajerOf(b) || 'belum dipilih', boleh = b.manajer === me().id;
    return aturBaris('Manajer keuangan: ' + esc(nama), esc(b.nama) + (boleh ? ' · ketuk untuk ganti' : ' · ganti lewat manajer atau admin'), boleh ? '' : '<span></span>', boleh ? ' data-gm="' + esc(b.id) + '"' : ' disabled');
  }).join('');
}
function bindManajerAtur(el) {
  $$('[data-gm]', el).forEach(function (btn) { btn.addEventListener('click', function () {
    var b = bukuById(btn.getAttribute('data-gm'));
    openSheet('Ganti manajer keuangan', function (sh) {
      sh.el.innerHTML = '<p class="faint" style="font-size:13px;margin:0 0 12px">Manajer memilih template & mengatur budget otomatis ' + esc(b.nama) + '.</p><div class="tpl-pilih">' + db().Users.map(function (u) {
        return '<button type="button" class="tpl-user" data-mj="' + esc(u.id) + '"' + (u.id === b.manajer ? ' aria-current="true"' : '') + '><span class="av">' + esc(String(u.nama).charAt(0).toUpperCase()) + '</span><span class="main"><span class="t1">' + esc(u.nama) + '</span></span>' + (u.id === b.manajer ? '<span class="chk">✓</span>' : '') + '</button>';
      }).join('') + '</div><div class="err" id="gm-err"></div>';
      $$('[data-mj]', sh.el).forEach(function (x) { x.addEventListener('click', function () {
        var uid = x.getAttribute('data-mj'); if (uid === b.manajer) { sh.close(); return; }
        if (!confirm('Serahkan peran manajer ke ' + userName(uid) + '? Kamu tidak bisa mengembalikannya sendiri.')) return;
        simpanManajer(b.id, uid).then(function () { sh.close(); }, function (e) { $('#gm-err', sh.el).textContent = e.message; });
      }); });
    });
  }); });
}
