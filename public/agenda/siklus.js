/* Siklus — catatan haid istri, tampil sebagai lapisan di Kalender Agenda, kartu di Beranda, dan bagian di Pengaturan.
   Data dari server (aksi siklus.*), aturan siapa boleh melihat ada di core.js. Perubahan lewat antrean offline (enqueue).
   Skrip biasa (bukan modul): nama top-level dipakai bersama file js/ lain. Urutan muat ada di tiap index.html halaman. */
'use strict';

var SKC = C.Siklus, SKK = C.Siklus.K;
var SK_DISCLAIMER = 'Perkiraan dari catatan, bukan diagnosis dan bukan alat kontrasepsi.';

// ---------- status ----------
function skV() { return S.siklus || null; }
function skPemilik() { return !!S.siklus && S.siklus.peran === 'pemilik'; }
function skAktif() { var v = skV(); return !!v && (v.peran === 'pemilik' ? !!v.aktif : !!v.dibagikan); }
function skTampil() { var v = skV(); return !!v && v.tampil !== false; }
function skLapis() { return skAktif() && skTampil(); }   // tampil di kalender, Beranda
function skRows() { var v = skV(); return (v && v.siklus) || []; }
function skNamaPemilik() { var v = skV(); return v && v.pemilik ? v.pemilik.nama : 'Istri'; }
function skNamaPasangan() { var m = me(), u = db().Users.filter(function (x) { return !m || x.id !== m.id; })[0]; return u ? u.nama : 'pasangan'; }
function skTgl(iso) { var p = iso.split('-'); return (+p[2]) + ' ' + BULAN[+p[1] - 1].slice(0, 3); }
function skRentang(a, z) { return a === z ? skTgl(a) : a.slice(5, 7) === z.slice(5, 7) ? (+a.slice(8)) + '–' + skTgl(z) : skTgl(a) + ' – ' + skTgl(z); }
function skLagi(n) { return n === 0 ? 'hari ini' : n === 1 ? 'besok' : n > 0 ? 'dalam ' + n + ' hari' : ''; }

// ---------- antrean offline: perubahan langsung terlihat di HP ini ----------
function siklusApplyLocal(op) {
  var v = S.siklus; if (!v) return;
  var p = op.payload || {};
  if (op.action === 'siklus.atur') {
    ['tampil', 'bagikan_jadwal', 'bagikan_catatan'].forEach(function (k) { if (k in p) v[k] = !!p[k]; });
    if (p.setuju) v.versi_teks = p.setuju;
    if ('aktif' in p) v.aktif = !!p.aktif;
  } else if (op.action === 'siklus.save') {
    var lama = v.siklus.filter(function (r) { return r.id === p.id; })[0];
    v.siklus = v.siklus.filter(function (r) { return r.id !== p.id; }).concat([{ id: p.id, mulai: p.mulai, akhir: p.akhir || '', abaikan_jarak: !!p.abaikan_jarak,
      catatan: p.catatan == null ? (lama ? lama.catatan : '') : String(p.catatan).trim(), _pending: true }]);
    v.siklus = SKC.urut(v.siklus);
  } else if (op.action === 'siklus.delete') {
    v.siklus = v.siklus.filter(function (r) { return r.id !== p.id; });
  } else if (op.action === 'siklus.hapus_semua') {
    v.siklus = []; v.aktif = false; v.versi_teks = 0; v.bagikan_jadwal = true; v.bagikan_catatan = false;
  }
}
function skKirim(action, payload, pesan) { enqueue(action, payload); if (pesan) toast(pesan); }

// cek di HP sebelum dikirim (aturan yang sama dijalankan lagi di server)
function skCek(f) {
  var today = todayISO();
  if (!f.mulai) return 'Isi tanggal mulai';
  if (f.mulai > today) return 'Tanggal mulai tidak boleh di masa depan';
  if (f.akhir) {
    if (f.akhir < f.mulai || SKC.selisih(f.mulai, f.akhir) >= SKK.MAKS_DURASI) return 'Tanggal selesai harus 1–' + SKK.MAKS_DURASI + ' hari sejak mulai';
    if (f.akhir > today) return 'Tanggal selesai tidak boleh di masa depan';
  }
  var ujung = f.akhir || f.mulai, salah = '';
  skRows().forEach(function (o) {
    if (salah || o.id === f.id) return;
    if (o.mulai === f.mulai) salah = 'Sudah ada catatan yang mulai di tanggal itu';
    else if (f.mulai <= (o.akhir || o.mulai) && ujung >= o.mulai) salah = 'Tanggalnya bertabrakan dengan catatan ' + skRentang(o.mulai, o.akhir || o.mulai);
  });
  return salah;
}

// ---------- kalender ----------
function siklusTandaBulan(b) {
  if (!skLapis()) return {};
  var p = b.split('-'), akhir = b + '-' + pad(new Date(+p[0], +p[1], 0).getDate());
  return SKC.tanda(skRows(), todayISO(), b + '-01', akhir);
}
// kartu status di atas kalender & Beranda
function siklusStatus() {
  var rows = skRows(), today = todayISO(), jalan = SKC.berjalan(rows, today), r = SKC.ringkas(rows);
  var di = SKC.catatanDi(rows, today, r.durasi), p = SKC.perkiraan(rows, today);
  if (di) return { jenis: 'jalan', hari: SKC.selisih(di.mulai, today) + 1, row: di, berjalan: jalan === di };
  if (!p) return { jenis: 'kosong' };
  return { jenis: 'kira', p: p, lagi: SKC.selisih(today, p.dari) };
}
function siklusKartuHtml(ringkas) {
  var v = skV(); if (!v) return '';
  var pemilik = skPemilik(), siapa = pemilik ? '' : ' ' + esc(skNamaPemilik());
  if (pemilik && !v.aktif) {
    if (ringkas || !skTampil() || LS.get('k_sk_tawar', 0)) return '';
    var ulang = v.versi_teks > 0 && v.versi_teks < v.versi_wajib;
    return '<section class="sk-card" aria-label="Siklus"><div class="sk-top"><span class="sk-ic" aria-hidden="true">' + ICON.drop + '</span><div><b>' + (ulang ? 'Teks privasi Siklus diperbarui' : 'Baru: catat haid di kalender') + '</b>' +
      '<span class="sk-sub">' + (ulang ? 'Baca dan setujui lagi untuk melanjutkan.' : 'Catat tanggal haid, lihat perkiraan berikutnya. Kamu yang pilih apa yang dibagikan ke ' + esc(skNamaPasangan()) + '.') + '</span></div></div>' +
      '<div class="sk-act"><button type="button" class="br-btn primary small sk-solid" data-skc="aktifkan">' + (ulang ? 'Baca & setujui' : 'Aktifkan') + '</button>' +
      (ulang ? '' : '<button type="button" class="br-btn small" data-skc="nanti">Nanti</button>') + '</div></section>';
  }
  if (!skLapis()) return '';
  var st = siklusStatus(), h;
  if (st.jenis === 'jalan') {
    h = '<b>Siklus' + siapa + ' · hari ke-' + st.hari + '</b><span class="sk-sub">' + (st.row.akhir ? skRentang(st.row.mulai, st.row.akhir) : 'Mulai ' + skTgl(st.row.mulai) + (st.berjalan ? ', belum dicatat selesai' : '')) + '</span>';
  } else if (st.jenis === 'kira') {
    h = '<b>Perkiraan' + siapa + ': ' + esc(skRentang(st.p.dari, st.p.sampai)) + '</b>' +
      '<span class="sk-sub">' + (st.p.telat ? 'Sudah lewat ' + st.p.telat + ' hari dari perkiraan' : st.lagi > 0 ? skLagi(st.lagi).replace(/^d/, 'D') : 'Masuk rentang perkiraan') +
      ' · ' + (st.p.kasar ? 'perkiraan kasar (' + SKK.BAKU_SIKLUS + ' hari)' : 'rata-rata ' + st.p.panjang + ' hari') + '</span>';
  } else h = '<b>Siklus' + siapa + '</b><span class="sk-sub">' + (pemilik ? 'Belum ada catatan. Tap tanggal hari pertama haid terakhir di kalender, lalu "Mulai haid".' : 'Belum ada catatan.') + '</span>';
  var act = '';
  if (pemilik && !ringkas) {
    var jalan = SKC.berjalan(skRows(), todayISO());
    act = '<div class="sk-act">' + (jalan ? '<button type="button" class="br-btn small sk-solid" data-skc="selesai">Haid selesai hari ini</button>'
      : st.jenis === 'jalan' ? '' : '<button type="button" class="br-btn small sk-solid" data-skc="mulai">Mulai haid hari ini</button>') +
      '<button type="button" class="br-btn small" data-skc="riwayat">Riwayat</button></div>';
  } else if (!ringkas && skRows().length) act = '<div class="sk-act"><button type="button" class="br-btn small" data-skc="riwayat">Riwayat</button></div>';
  return '<section class="sk-card" aria-label="Siklus"><div class="sk-top"><span class="sk-ic" aria-hidden="true">' + ICON.drop + '</span><div>' + h +
    (ringkas ? '' : '<span class="sk-note">' + SK_DISCLAIMER + '</span>') + '</div></div>' + act + '</section>';
}
function bindSiklusKartu(root, onUbah) {
  $$('[data-skc]', root).forEach(function (b) { b.addEventListener('click', function () {
    var a = b.getAttribute('data-skc'), today = todayISO();
    if (a === 'aktifkan') bukaAktivasiSiklus(onUbah);
    else if (a === 'nanti') { LS.set('k_sk_tawar', 1); toast('Bisa diaktifkan kapan saja di Pengaturan › Siklus'); if (onUbah) onUbah(); }
    else if (a === 'mulai') { skMulaiDi(today); if (onUbah) onUbah(); }
    else if (a === 'selesai') { var j = SKC.berjalan(skRows(), today); if (j) skKirim('siklus.save', { id: j.id, mulai: j.mulai, akhir: today, abaikan_jarak: j.abaikan_jarak }, 'Dicatat selesai ' + skTgl(today)); if (onUbah) onUbah(); }
    else if (a === 'riwayat') bukaRiwayatSiklus();
  }); });
}
// bagian Siklus di panel hari terpilih
function siklusPanelHari(d) {
  if (!skLapis()) return '';
  var rows = skRows(), r = SKC.ringkas(rows), t = siklusTandaBulan(d.slice(0, 7))[d], pemilik = skPemilik();
  var siapa = pemilik ? '' : ' ' + esc(skNamaPemilik()), isi = '';
  if (t === 'catat') {
    var row = SKC.catatanDi(rows, d, r.durasi), hari = SKC.selisih(row.mulai, d) + 1, n = SKC.selisih(row.mulai, SKC.akhir(row, r.durasi)) + 1;
    isi = '<b>Siklus' + siapa + ' · hari ke-' + hari + '</b><span class="sk-sub">' +
      (row.akhir ? skRentang(row.mulai, row.akhir) + ' (' + n + ' hari)' : 'Mulai ' + skTgl(row.mulai) + ', selesai belum dicatat') + '</span>' +
      (row.catatan ? '<span class="sk-cat">' + esc(row.catatan) + '</span>' : '') +
      (row.akhir && n > 7 ? '<span class="sk-note">Haid lebih dari 7 hari sebaiknya dikonsultasikan ke dokter.</span>' : '');
  } else if (t === 'kira') {
    var p = SKC.perkiraan(rows, todayISO());
    isi = '<b>Perkiraan siklus' + siapa + '</b><span class="sk-sub">' + (p.kasar ? 'Belum ada 2 catatan, memakai ' + SKK.BAKU_SIKLUS + ' hari.' : 'Rata-rata ' + p.panjang + ' hari dari ' + p.dipakai + ' jarak terakhir.') + '</span>' +
      '<span class="sk-note">' + SK_DISCLAIMER + '</span>';
  }
  var tombol = '';
  if (pemilik && d <= todayISO()) {
    var jalan = SKC.berjalan(rows, d), di = SKC.catatanDi(rows, d, r.durasi);
    if (jalan && d > jalan.mulai) tombol = '<button type="button" class="br-pill sk-pill" data-skh="selesai">' + ICON.drop + 'Haid selesai di tanggal ini</button>';
    if (di) tombol += '<button type="button" class="br-pill sk-pill" data-skh="ubah" data-skid="' + esc(di.id) + '">' + ICON.drop + 'Ubah catatan haid</button>';
    else if (!jalan) tombol = '<button type="button" class="br-pill sk-pill" data-skh="mulai">' + ICON.drop + 'Mulai haid di tanggal ini</button>';
  }
  if (!isi && !tombol) return '';
  return '<div class="sk-hari">' + (isi ? '<div class="sk-top"><span class="sk-dot' + (t === 'kira' ? ' kira' : '') + '" aria-hidden="true"></span><div>' + isi + '</div></div>' : '') +
    (tombol ? '<div class="sk-act">' + tombol + '</div>' : '') + '</div>';
}
function bindSiklusHari(box, d, onUbah) {
  $$('[data-skh]', box).forEach(function (b) { b.addEventListener('click', function () {
    var a = b.getAttribute('data-skh');
    if (a === 'mulai') skMulaiDi(d);
    else if (a === 'selesai') { var j = SKC.berjalan(skRows(), d); if (j) skKirim('siklus.save', { id: j.id, mulai: j.mulai, akhir: d, abaikan_jarak: j.abaikan_jarak }, 'Dicatat selesai ' + skTgl(d)); }
    else if (a === 'ubah') { bukaCatatanSiklus(skRows().filter(function (r) { return r.id === b.getAttribute('data-skid'); })[0]); return; }
    if (onUbah) onUbah();
  }); });
}

// ---------- catat / ubah ----------
function skTanyaJarak(h, lanjut) {
  openSheet('Ada yang terlewat?', function (sh) {
    sh.el.innerHTML = '<p class="sk-p">Jarak dari haid sebelumnya <b>' + h + ' hari</b>, di luar rentang yang umum (' + SKK.NORMAL_MIN + '–' + SKK.NORMAL_MAX + ' hari). Ada catatan yang terlewat?</p>' +
      '<p class="hint">Kalau ya, jarak ini tidak dipakai untuk menghitung perkiraan.</p>' +
      '<button type="button" class="btn" id="sk-ya">Ya, ada yang terlewat</button><button type="button" class="btn ghost" id="sk-tidak" style="margin-top:10px">Tidak, memang segitu</button>';
    $('#sk-ya', sh.el).addEventListener('click', function () { sh.close(); lanjut(true); });
    $('#sk-tidak', sh.el).addEventListener('click', function () { sh.close(); lanjut(false); });
  });
}
function skMulaiDi(d) {
  var f = { id: uid(), mulai: d, akhir: '' }, salah = skCek(f);
  if (salah) { toast(salah, true); return; }
  var simpan = function (abaikan) { skKirim('siklus.save', { id: f.id, mulai: d, akhir: '', abaikan_jarak: abaikan, catatan: '' }, 'Haid dicatat mulai ' + skTgl(d)); refresh(); };
  var h = SKC.jarakAneh(skRows(), d, null);
  if (h) skTanyaJarak(h, simpan); else simpan(false);
}
function bukaCatatanSiklus(r) {
  var baru = !r, today = todayISO();
  var f = r ? { id: r.id, mulai: r.mulai, akhir: r.akhir || '', catatan: r.catatan || '', abaikan_jarak: !!r.abaikan_jarak }
    : { id: uid(), mulai: today, akhir: '', catatan: '', abaikan_jarak: false };
  var v = skV();
  openSheet(baru ? 'Tambah catatan haid' : 'Ubah catatan haid', function (sh) {
    sh.el.innerHTML = '<div class="field row2" style="margin-top:4px"><div><label for="sk-m">Mulai</label><input id="sk-m" class="input" type="date" max="' + today + '" value="' + esc(f.mulai) + '"></div>' +
      '<div><label for="sk-s">Selesai</label><input id="sk-s" class="input" type="date" max="' + today + '" value="' + esc(f.akhir) + '"></div></div>' +
      '<p class="hint">Selesai boleh kosong. Kalau kosong, dianggap ' + SKC.ringkas(skRows()).durasi + ' hari (rata-rata catatanmu).</p>' +
      '<div class="field"><label for="sk-c">Catatan <span class="faint">(opsional, ' + (v.bagikan_jadwal && v.bagikan_catatan ? 'terlihat juga oleh ' + esc(skNamaPasangan()) : 'hanya kamu') + ')</span></label>' +
      '<textarea id="sk-c" class="input" maxlength="' + SKK.CATATAN_MAKS + '" rows="2" placeholder="mis. kram hari pertama">' + esc(f.catatan) + '</textarea></div>' +
      '<div class="err" id="sk-err" role="alert"></div><button type="button" class="btn" id="sk-save">Simpan</button>' +
      (baru ? '' : '<button type="button" class="btn danger" id="sk-del">Hapus catatan ini</button>');
    $('#sk-save', sh.el).addEventListener('click', function () {
      var mulaiLama = f.mulai;
      f.mulai = $('#sk-m', sh.el).value; f.akhir = $('#sk-s', sh.el).value; f.catatan = $('#sk-c', sh.el).value.trim();
      var salah = skCek(f);
      if (salah) { $('#sk-err', sh.el).textContent = salah; return; }
      var kirim = function (abaikan) {
        f.abaikan_jarak = abaikan;
        skKirim('siklus.save', { id: f.id, mulai: f.mulai, akhir: f.akhir, abaikan_jarak: abaikan, catatan: f.catatan }, 'Catatan haid disimpan');
        sh.close(); refresh();
      };
      var h = baru || mulaiLama !== f.mulai ? SKC.jarakAneh(skRows(), f.mulai, f.id) : 0;
      if (h) skTanyaJarak(h, kirim); else kirim(f.abaikan_jarak);
    });
    var del = $('#sk-del', sh.el);
    if (del) del.addEventListener('click', function () {
      if (!confirm('Hapus catatan ' + skRentang(r.mulai, r.akhir || r.mulai) + '? Tidak bisa dikembalikan.')) return;
      skKirim('siklus.delete', { id: r.id }, 'Catatan dihapus'); sh.close(); refresh();
    });
  });
}
function bukaRiwayatSiklus() {
  openSheet('Riwayat siklus', function (sh) {
    var pemilik = skPemilik(), r = SKC.ringkas(skRows()), list = skRows().slice().reverse();
    var jarak = {}; SKC.jarak(skRows()).forEach(function (j) { jarak[j.ke] = j; });
    sh.el.innerHTML = (pemilik ? '<button type="button" class="btn small ghost" id="sk-add" style="margin:4px 0 12px">' + ICON.plus + 'Tambah catatan lama</button>' : '') +
      (list.length ? '<p class="hint" style="margin-top:0">' + (r.kasar ? 'Belum ada jarak antar siklus.' : 'Rata-rata ' + r.panjang + ' hari dari ' + r.dipakai + ' jarak terakhir · lama haid ±' + r.durasi + ' hari.') + '</p>' +
        '<div class="list">' + list.map(function (z) {
          var akhir = SKC.akhir(z, r.durasi), n = SKC.selisih(z.mulai, akhir) + 1, j = jarak[z.mulai];
          return '<button type="button" class="wallet sk-row" data-skr="' + esc(z.id) + '"' + (pemilik ? '' : ' disabled') + '><span class="sk-dot" aria-hidden="true"></span><span class="main"><span class="t1" style="display:block">' + esc(skRentang(z.mulai, akhir)) + ' ' + z.mulai.slice(0, 4) + '</span>' +
            '<span class="t2">' + n + ' hari' + (z.akhir ? '' : ' (selesai belum dicatat)') + (j ? ' · jarak ' + j.hari + ' hari' + (j.abaikan ? ' (tidak dihitung)' : '') : '') + (z.catatan ? ' · ' + esc(z.catatan) : '') + '</span></span></button>';
        }).join('') + '</div>' : '<div class="list"><div class="empty">Belum ada catatan.</div></div>') +
      '<p class="hint">' + SK_DISCLAIMER + '</p>';
    var add = $('#sk-add', sh.el);
    if (add) add.addEventListener('click', function () { sh.close(); setTimeout(function () { bukaCatatanSiklus(null); }, 280); });
    $$('[data-skr]', sh.el).forEach(function (b) { b.addEventListener('click', function () {
      var z = skRows().filter(function (q) { return q.id === b.getAttribute('data-skr'); })[0];
      sh.close(); setTimeout(function () { bukaCatatanSiklus(z); }, 280);
    }); });
  });
}

// ---------- aktivasi + privasi ----------
function bukaAktivasiSiklus(onUbah) {
  var v = skV(); if (!v) return;
  var pas = skNamaPasangan(), f = { setuju: false, jadwal: v.bagikan_jadwal !== false, catatan: !!v.bagikan_catatan };
  openSheet('Aktifkan Siklus', function (sh) {
    function draw() {
      sh.el.innerHTML = '<p class="sk-p">Catat tanggal haid di kalender Agenda dan lihat perkiraan berikutnya (rentang ±' + SKK.RENTANG + ' hari).</p>' +
        '<div class="atur-lbl">Siapa yang bisa melihat?</div><ul class="sk-list">' +
        '<li>Disimpan di database Family App (Supabase), di tabel terpisah dari keuangan. Aturan siapa boleh melihat dijalankan di server.</li>' +
        '<li>' + esc(pas) + ' adalah pemilik project Supabase, jadi secara teknis bisa membuka tabelnya lewat dashboard.</li>' +
        '<li><b>Jadwal</b> (tanggal & perkiraan) hanya terlihat oleh ' + esc(pas) + ' kalau kamu bagikan.</li>' +
        '<li><b>Catatan</b> (mis. "kram hari pertama") hanya terlihat olehmu, kecuali kamu bagikan juga.</li>' +
        '<li>Tidak pernah masuk Google Calendar.</li>' +
        '<li>Kamu bisa mematikan atau menghapus semuanya kapan saja di Pengaturan › Siklus.</li></ul>' +
        '<div class="sk-warn">' + SK_DISCLAIMER + '</div>' +
        toggleHtml('ska-jadwal', 'Bagikan jadwal ke ' + esc(pas), 'Tanggal & perkiraan muncul di kalender ' + esc(pas), f.jadwal) +
        toggleHtml('ska-cat', 'Bagikan catatan ke ' + esc(pas), f.jadwal ? 'Default: tidak' : 'Nyalakan bagikan jadwal dulu', f.jadwal && f.catatan).replace('<button ', f.jadwal ? '<button ' : '<button disabled ') +
        '<label class="sk-cek"><input type="checkbox" id="ska-setuju"' + (f.setuju ? ' checked' : '') + '><span>Aku paham dan setuju</span></label>' +
        '<button type="button" class="btn" id="ska-ok"' + (f.setuju ? '' : ' disabled') + '>Aktifkan Siklus</button>';
      $('#ska-jadwal', sh.el).addEventListener('click', function () { f.jadwal = !f.jadwal; if (!f.jadwal) f.catatan = false; draw(); });
      $('#ska-cat', sh.el).addEventListener('click', function () { f.catatan = !f.catatan; draw(); });
      $('#ska-setuju', sh.el).addEventListener('change', function (e) { f.setuju = e.target.checked; $('#ska-ok', sh.el).disabled = !f.setuju; });
      $('#ska-ok', sh.el).addEventListener('click', function () {
        skKirim('siklus.atur', { setuju: v.versi_wajib, aktif: true, tampil: true, bagikan_jadwal: f.jadwal, bagikan_catatan: f.jadwal && f.catatan }, 'Siklus aktif. Tap tanggal di kalender untuk mencatat.');
        sh.close(); if (onUbah) onUbah(); else refresh();
      });
    }
    draw();
  });
}
function skUnduhCadangan() {
  var isi = { app: 'family-app-siklus', dibuat: nowIso(), catatan: skRows().map(function (r) { return { mulai: r.mulai, selesai: r.akhir || '', catatan: r.catatan || '' }; }) };
  var url = URL.createObjectURL(new Blob([JSON.stringify(isi, null, 2)], { type: 'application/json' })), a = document.createElement('a');
  a.href = url; a.download = 'Cadangan Siklus ' + todayISO() + '.json'; document.body.appendChild(a); a.click(); a.remove();
  setTimeout(function () { URL.revokeObjectURL(url); }, 4000);
}

// ---------- Pengaturan › Siklus ----------
var AturSiklus = {
  render: function (el) {
    var v = skV(), self = this;
    if (!v) { el.innerHTML = '<p class="br-help">Memuat… (perlu sinkron sekali saat online)</p>'; return; }
    if (!v.pemilik.ada) { el.innerHTML = '<p class="br-help">Siklus butuh akun istri (id <b>' + esc(v.pemilik.id) + '</b>).</p>'; return; }
    var pas = skNamaPasangan(), h;
    if (skPemilik()) {
      if (!v.aktif) {
        h = '<p class="br-help">Catat tanggal haid di kalender Agenda dan lihat perkiraan berikutnya. Mati secara default; kamu yang pilih apa yang dibagikan ke ' + esc(pas) + '.</p>' +
          aturBaris(v.versi_teks > 0 && v.versi_teks < v.versi_wajib ? 'Baca & setujui teks privasi baru' : 'Aktifkan Siklus', 'Lihat dulu siapa yang bisa melihat', '', ' data-sks="aktifkan"') +
          (skRows().length ? aturBaris('Riwayat catatan', skRows().length + ' catatan tersimpan', '', ' data-sks="riwayat"') +
            aturBaris('<span style="color:var(--over)">Hapus semua catatan</span>', 'Tidak bisa dikembalikan', '', ' data-sks="hapus"') : '');
      } else {
        h = toggleHtml('sks-tampil', 'Tampilkan di kalender & Berandaku', 'Mati = disembunyikan dari tampilanmu; data tetap tersimpan', v.tampil !== false) +
          toggleHtml('sks-jadwal', 'Bagikan jadwal ke ' + esc(pas), 'Tanggal & perkiraan di kalender ' + esc(pas) + ' (' + esc(pas) + ' bisa menyembunyikannya sendiri)', !!v.bagikan_jadwal) +
          toggleHtml('sks-cat', 'Bagikan catatan ke ' + esc(pas), v.bagikan_jadwal ? 'Isi kolom catatan, mis. "kram hari pertama"' : 'Nyalakan bagikan jadwal dulu', v.bagikan_jadwal && v.bagikan_catatan).replace('<button ', v.bagikan_jadwal ? '<button ' : '<button disabled ') +
          aturBaris('Riwayat catatan', skRows().length + ' catatan', '', ' data-sks="riwayat"') +
          aturBaris('Tambah catatan lama', 'Isi beberapa catatan supaya perkiraan memakai rata-ratamu', '', ' data-sks="tambah"') +
          aturBaris('Unduh cadangan (JSON)', 'Salinan catatan ke HP', '', ' data-sks="unduh"') +
          aturBaris('Matikan Siklus', 'Berhenti mencatat & berbagi; data tidak dihapus', '', ' data-sks="matikan"') +
          aturBaris('<span style="color:var(--over)">Hapus semua catatan</span>', 'Semua tanggal & catatan dihapus, persetujuan ditarik', '', ' data-sks="hapus"') +
          '<p class="br-help" style="margin-top:8px">' + SK_DISCLAIMER + '</p>';
      }
    } else {
      var status = !v.dibagikan ? esc(skNamaPemilik()) + ' belum membagikan jadwal Siklus.'
        : 'Jadwal dibagikan oleh ' + esc(skNamaPemilik()) + (v.catatan_dibagikan ? ', termasuk catatan.' : '. Catatan tidak dibagikan.');
      h = '<p class="br-help">' + status + ' Hanya ' + esc(skNamaPemilik()) + ' yang bisa mencatat dan mengatur apa yang dibagikan.</p>' +
        toggleHtml('sks-tampil', 'Tampilkan Siklus di kalender & Berandaku', 'Pilihanmu sendiri; tidak mengubah apa pun di HP ' + esc(skNamaPemilik()), v.tampil !== false);
    }
    el.innerHTML = h;
    var tg = $('#sks-tampil', el);
    if (tg) tg.addEventListener('click', function () { var on = !skTampil(); skKirim('siklus.atur', { tampil: on }, on ? 'Siklus ditampilkan' : 'Siklus disembunyikan dari tampilanmu'); self.render(el); });
    var jd = $('#sks-jadwal', el);
    if (jd) jd.addEventListener('click', function () {
      var on = !v.bagikan_jadwal;
      skKirim('siklus.atur', on ? { bagikan_jadwal: true } : { bagikan_jadwal: false, bagikan_catatan: false }, on ? 'Jadwal dibagikan ke ' + pas : 'Jadwal tidak dibagikan lagi'); self.render(el);
    });
    var ct = $('#sks-cat', el);
    if (ct) ct.addEventListener('click', function () { var on = !v.bagikan_catatan; skKirim('siklus.atur', { bagikan_catatan: on }, on ? 'Catatan dibagikan ke ' + pas : 'Catatan tidak dibagikan lagi'); self.render(el); });
    $$('[data-sks]', el).forEach(function (b) { b.addEventListener('click', function () {
      var a = b.getAttribute('data-sks');
      if (a === 'aktifkan') bukaAktivasiSiklus(function () { self.render(el); });
      else if (a === 'riwayat') bukaRiwayatSiklus();
      else if (a === 'tambah') bukaCatatanSiklus(null);
      else if (a === 'unduh') skUnduhCadangan();
      else if (a === 'matikan') { if (confirm('Matikan Siklus? Catatan tetap tersimpan, ' + pas + ' tidak melihat jadwal lagi. Bisa diaktifkan kembali.')) { skKirim('siklus.atur', { aktif: false }, 'Siklus dimatikan'); self.render(el); } }
      else if (a === 'hapus') {
        if (!confirm('Hapus SEMUA catatan haid dan tarik persetujuanmu? Tidak bisa dikembalikan.')) return;
        if (skRows().length && !confirm('Yakin? Sebaiknya unduh cadangan dulu.')) return;
        skKirim('siklus.hapus_semua', {}, 'Semua catatan Siklus dihapus'); self.render(el);
      }
    }); });
  }
};

// ---------- Beranda ----------
function siklusBerandaRender(box) {
  if (!box) return;
  var html = siklusKartuHtml(true);
  box.hidden = !html;
  if (!html) { box.innerHTML = ''; return; }
  box.innerHTML = '<div class="br-card-h"><h2 id="br-siklus-h"><span class="br-ic" style="--c:var(--br-siklus);--cb:var(--br-siklus-bg)">' + ICON.drop + '</span>Siklus</h2>' +
    '<a class="br-lnk" href="' + ROOT + 'agenda/#jadwal">Kalender</a></div>' + html;
}
