/*
 * Siklus — catatan siklus Febie + onboarding fitur baru.
 * Data TIDAK lewat backend Kantong: langsung ke project Supabase terpisah milik akun Febie
 * (supabase-siklus/), login kode OTP via email, aturan baca/tulis dijalankan server (fungsi siklus_*).
 * Perkiraan tidak disimpan: dihitung di HP dari catatan (SiklusCore, dites di kantong/tools/test_siklus.js).
 */
var SiklusCore = (function () {
  'use strict';
  var NORMAL_MIN = 21, NORMAL_MAX = 35;   // rentang siklus dewasa yang umum (Cleveland Clinic; ACOG)
  var BAKU_SIKLUS = 28, BAKU_DURASI = 5, JUMLAH = 6, RENTANG = 2, MAKS_DURASI = 15;

  function addDays(iso, n) { var p = iso.split('-'); return new Date(Date.UTC(+p[0], +p[1] - 1, +p[2] + n)).toISOString().slice(0, 10); }
  function selisih(a, b) {   // jumlah hari dari a ke b
    var pa = a.split('-'), pb = b.split('-');
    return Math.round((Date.UTC(+pb[0], +pb[1] - 1, +pb[2]) - Date.UTC(+pa[0], +pa[1] - 1, +pa[2])) / 86400000);
  }
  function urut(rows) {
    return (rows || []).filter(function (r) { return r && r.mulai; }).slice()
      .sort(function (a, b) { return a.mulai < b.mulai ? -1 : (a.mulai > b.mulai ? 1 : 0); });
  }
  function rata(arr) { return Math.round(arr.reduce(function (s, x) { return s + x; }, 0) / arr.length); }
  // jarak antar hari pertama berturut-turut; 'abaikan' = Febie bilang ada catatan terlewat sebelum siklus itu
  function jarak(rows) {
    var s = urut(rows), out = [];
    for (var i = 1; i < s.length; i++) out.push({ dari: s[i - 1].mulai, ke: s[i].mulai, hari: selisih(s[i - 1].mulai, s[i].mulai), abaikan: !!s[i].abaikan_jarak });
    return out;
  }
  // panjang siklus = rata-rata 6 jarak terakhir yang dipakai; < 1 jarak (kurang dari 2 catatan) = 28 hari, "perkiraan kasar"
  function ringkas(rows) {
    var s = urut(rows);
    var j = jarak(s).filter(function (x) { return !x.abaikan && x.hari > 0; }).slice(-JUMLAH);
    var d = s.filter(function (r) { return r.selesai; }).map(function (r) { return selisih(r.mulai, r.selesai) + 1; }).slice(-JUMLAH);
    return { jumlah: s.length, dipakai: j.length, kasar: j.length === 0, panjang: j.length ? rata(j.map(function (x) { return x.hari; })) : BAKU_SIKLUS,
      durasi: d.length ? Math.min(MAKS_DURASI, rata(d)) : BAKU_DURASI };
  }
  function akhirCatatan(r, durasi) { return r.selesai || addDays(r.mulai, durasi - 1); }
  function perkiraan(rows, today) {
    var s = urut(rows); if (!s.length) return null;
    var r = ringkas(s), berikut = addDays(s[s.length - 1].mulai, r.panjang);
    // terlambat <= 1 siklus: tampilkan apa adanya + "sudah lewat N hari".
    // terlambat > 1 siklus (kemungkinan lupa mencatat): geser ke perkiraan berikutnya yang belum lewat.
    var telat = selisih(berikut, today), geser = 0;
    if (telat > r.panjang) {
      while (selisih(berikut, today) > RENTANG && geser < 60) { berikut = addDays(berikut, r.panjang); geser++; }
      telat = 0;
    }
    return { berikut: berikut, dari: addDays(berikut, -RENTANG), sampai: addDays(berikut, RENTANG), kasar: r.kasar,
      panjang: r.panjang, durasi: r.durasi, jumlah: r.jumlah, dipakai: r.dipakai, telat: telat > RENTANG ? telat : 0 };
  }
  // tanda per tanggal di [awal, akhir]: 'catat' (tercatat) atau 'kira' (rentang perkiraan, 3 siklus ke depan)
  function tanda(rows, today, awal, akhir) {
    var s = urut(rows), r = ringkas(s), out = {}, akhirTerakhir = '';
    s.forEach(function (row) {
      var z = akhirCatatan(row, r.durasi);
      if (z > akhirTerakhir) akhirTerakhir = z;
      if (z < awal || row.mulai > akhir) return;
      for (var d = row.mulai; d <= z; d = addDays(d, 1)) if (d >= awal && d <= akhir) out[d] = 'catat';
    });
    var p = perkiraan(s, today);
    if (p) for (var k = 0; k < 3; k++) {
      var m = addDays(p.berikut, k * r.panjang);
      for (var i = -RENTANG; i <= RENTANG; i++) {
        var d2 = addDays(m, i);
        if (d2 >= awal && d2 <= akhir && !out[d2] && d2 > akhirTerakhir) out[d2] = 'kira';
      }
    }
    return out;
  }
  function catatanDi(rows, d, durasi) {
    var s = urut(rows), hit = null;
    s.forEach(function (row) { if (d >= row.mulai && d <= akhirCatatan(row, durasi)) hit = row; });
    return hit;
  }
  // catatan yang masih berjalan (belum dicatat selesai, belum lewat batas) pada tanggal d
  function berjalan(rows, d) {
    var s = urut(rows), last = s[s.length - 1];
    if (!last || last.selesai || d < last.mulai || selisih(last.mulai, d) > MAKS_DURASI) return null;
    return last;
  }
  // jarak tidak biasa ke hari pertama sebelumnya (di luar 21–35 hari) -> jumlah hari; 0 kalau wajar / tidak ada pembanding
  function jarakAneh(rows, mulaiBaru, kecualiId) {
    var prev = null;
    urut(rows).forEach(function (r) { if (r.id !== kecualiId && r.mulai < mulaiBaru) prev = r; });
    if (!prev) return 0;
    var h = selisih(prev.mulai, mulaiBaru);
    return h < NORMAL_MIN || h > NORMAL_MAX ? h : 0;
  }
  return { NORMAL_MIN: NORMAL_MIN, NORMAL_MAX: NORMAL_MAX, BAKU_SIKLUS: BAKU_SIKLUS, BAKU_DURASI: BAKU_DURASI, RENTANG: RENTANG, MAKS_DURASI: MAKS_DURASI,
    addDays: addDays, selisih: selisih, urut: urut, jarak: jarak, ringkas: ringkas, perkiraan: perkiraan, tanda: tanda,
    catatanDi: catatanDi, berjalan: berjalan, jarakAneh: jarakAneh, akhirCatatan: akhirCatatan };
})();
if (typeof module !== 'undefined' && module.exports) module.exports = SiklusCore;

// ===================================================================== UI (dipanggil dari app.js)
if (typeof window !== 'undefined') window.SiklusModul = function (x) {
  'use strict';
  var K = SiklusCore, $ = x.$, $$ = x.$$, esc = x.esc, LS = x.LS;
  var VERSI_TEKS = 1;     // naikkan kalau teks privasi berubah -> Febie diminta setuju ulang
  var ONB_VERSI = 1;      // naikkan kalau ada pengenalan fitur baru
  var cfg = window.SIKLUS_CONFIG || {};
  var st = { data: LS.get('k_siklus_data', null), sesi: LS.get('k_siklus_sesi', null), terakhir: 0, sibuk: false };

  function demo() { return x.conn() && x.conn().mode === 'demo'; }
  function siap() { return demo() || !!(cfg.url && cfg.anonKey); }
  function idPemilik() { return cfg.pemilik || 'febie'; }
  function akuPemilik() { var m = x.me(); return !!m && m.id === idPemilik(); }
  function namaUser(id) { var u = x.users().filter(function (z) { return z.id === id; })[0]; return u ? u.nama : id; }
  function namaPemilik() { return namaUser(idPemilik()); }
  function namaPasangan() { var m = x.me(); var u = x.users().filter(function (z) { return !m || z.id !== m.id; })[0]; return u ? u.nama : 'pasangan'; }
  function tampil() { return x.prefs().siklusTampil !== false; }
  function peran() { return st.data && st.data.peran; }
  function atur() { return (st.data && st.data.pengaturan) || {}; }
  function rows() { return (st.data && st.data.siklus) || []; }
  function catatan(id) { return ((st.data && st.data.catatan) || {})[id] || ''; }
  function versiOk() { return peran() !== 'pemilik' || (atur().versi_teks || 0) >= VERSI_TEKS; }
  function aktif() { return !!(st.sesi && st.data && peran() && atur().aktif && versiOk()); }
  function err(m) { var e = new Error(m); e.user = true; return e; }

  // ---------- API: Supabase Auth (OTP) + RPC ----------
  function pesanError(j, status) {
    var m = j && (j.msg || j.message || j.error_description || j.error) || ('Server membalas ' + status);
    if (/signup|not allowed|user not found/i.test(m)) return 'Email ini belum didaftarkan untuk Siklus.';
    if (/expired|invalid/i.test(m) && /token|otp/i.test(m)) return 'Kode salah atau sudah kedaluwarsa. Minta kode baru.';
    if (/rate|too many|security purposes/i.test(m)) return 'Terlalu sering. Tunggu sebentar, lalu coba lagi.';
    return m;
  }
  function apiRemote() {
    var base = String(cfg.url || '').replace(/\/$/, '');
    function req(path, body, token) {
      return fetch(base + path, { method: 'POST', body: JSON.stringify(body || {}),
        headers: { apikey: cfg.anonKey, Authorization: 'Bearer ' + (token || cfg.anonKey), 'Content-Type': 'application/json' } })
        .then(function (r) {
          return r.text().then(function (t) {
            var j = null; try { j = t ? JSON.parse(t) : null; } catch (e) { j = null; }
            if (!r.ok) { var e2 = err(pesanError(j, r.status)); e2.status = r.status; throw e2; }
            return j;
          });
        }, function () { var e = err('Tidak ada koneksi internet'); e.offline = true; throw e; });
    }
    return {
      kirimKode: function (email) { return req('/auth/v1/otp', { email: email, create_user: false }); },
      verifikasi: function (email, kode) { return req('/auth/v1/verify', { type: 'email', email: email, token: kode }); },
      refresh: function (rt) { return req('/auth/v1/token?grant_type=refresh_token', { refresh_token: rt }); },
      rpc: function (nama, args, token) { return req('/rest/v1/rpc/' + nama, args || {}, token); }
    };
  }
  // mode demo: aturan yang sama dengan SQL, data di browser ini saja
  function apiDemo() {
    function db() {
      var d = LS.get('k_siklus_demo', null);
      if (d) return d;
      var t = x.todayISO(), s = [];
      [[-118, 5, ''], [-89, 5, 'kram hari pertama'], [-61, 6, ''], [-32, 5, '']].forEach(function (z, i) {
        var m = K.addDays(t, z[0]);
        s.push({ id: 'demo-sk-' + i, mulai: m, selesai: K.addDays(m, z[1] - 1), abaikan_jarak: false, diubah: m, catatan: z[2] });
      });
      return { siklus: s, pengaturan: { aktif: false, bagikan_catatan: false, setuju_at: null, versi_teks: 0 } };
    }
    function muat(d) {
      var p = akuPemilik() ? 'pemilik' : 'pembaca', a = d.pengaturan;
      if (p === 'pembaca' && !a.aktif) return { peran: p, pengaturan: { aktif: false }, siklus: [], catatan: {} };
      var cat = {};
      if (p === 'pemilik' || a.bagikan_catatan) d.siklus.forEach(function (r) { if (r.catatan) cat[r.id] = r.catatan; });
      return { peran: p, pengaturan: p === 'pemilik' ? a : { aktif: a.aktif, bagikan_catatan: a.bagikan_catatan },
        siklus: K.urut(d.siklus).map(function (r) { return { id: r.id, mulai: r.mulai, selesai: r.selesai || null, abaikan_jarak: !!r.abaikan_jarak, diubah: r.diubah }; }), catatan: cat };
    }
    function tulis(fn) {
      return new Promise(function (res, rej) {
        setTimeout(function () {
          try {
            var d = db();
            if (fn) { if (!akuPemilik()) throw err('Hanya pemilik yang bisa mengubah'); fn(d); LS.set('k_siklus_demo', d); }
            res(muat(d));
          } catch (e) { rej(e); }
        }, 150);
      });
    }
    return {
      kirimKode: function () { return new Promise(function (r) { setTimeout(r, 300); }); },
      verifikasi: function (email, kode) {
        if (!/^\d{6}$/.test(kode)) return Promise.reject(err('Kode 6 angka. Mode demo: angka apa saja.'));
        return Promise.resolve({ access_token: 'demo', refresh_token: 'demo', expires_at: Math.floor(Date.now() / 1000) + 86400 * 365, user: { email: email } });
      },
      refresh: function () { return Promise.resolve({ access_token: 'demo', refresh_token: 'demo', expires_at: Math.floor(Date.now() / 1000) + 86400 * 365 }); },
      rpc: function (nama, a) {
        if (nama === 'siklus_muat') return tulis(null);
        if (nama === 'siklus_simpan') return tulis(function (d) {
          if (a.selesai && (a.selesai < a.mulai || K.selisih(a.mulai, a.selesai) > K.MAKS_DURASI)) throw err('Tanggal selesai harus 0–15 hari setelah tanggal mulai');
          var r = d.siklus.filter(function (z) { return z.id === a.id; })[0];
          if (!r) { r = { id: a.id }; d.siklus.push(r); }
          r.mulai = a.mulai; r.selesai = a.selesai || null; r.abaikan_jarak = !!a.abaikan_jarak; r.diubah = x.nowIso();
          if ('catatan' in a) r.catatan = String(a.catatan || '').trim().slice(0, 300);
        });
        if (nama === 'siklus_hapus') return tulis(function (d) { d.siklus = d.siklus.filter(function (z) { return z.id !== a.p_id; }); });
        if (nama === 'siklus_atur') return tulis(function (d) {
          if ('aktif' in a) d.pengaturan.aktif = !!a.aktif;
          if ('bagikan_catatan' in a) d.pengaturan.bagikan_catatan = !!a.bagikan_catatan;
          if (a.setuju) { d.pengaturan.setuju_at = x.nowIso(); d.pengaturan.versi_teks = a.versi_teks; }
        });
        if (nama === 'siklus_hapus_semua') return tulis(function (d) { d.siklus = []; d.pengaturan = { aktif: false, bagikan_catatan: false, setuju_at: null, versi_teks: 0 }; });
        return Promise.reject(err('Aksi tidak dikenal'));
      }
    };
  }
  function api() { return demo() ? apiDemo() : apiRemote(); }
  function simpanSesi(j) {
    st.sesi = { access_token: j.access_token, refresh_token: j.refresh_token,
      expires_at: j.expires_at || (Math.floor(Date.now() / 1000) + (j.expires_in || 3600)), email: (j.user && j.user.email) || (st.sesi && st.sesi.email) || '' };
    LS.set('k_siklus_sesi', st.sesi); return st.sesi;
  }
  function token() {
    var s = st.sesi; if (!s) return Promise.reject(err('Belum masuk ke Siklus'));
    if (s.expires_at * 1000 - 60000 > Date.now()) return Promise.resolve(s.access_token);
    return api().refresh(s.refresh_token).then(function (j) { return simpanSesi(j).access_token; }, function (e) {
      if (e.status === 400 || e.status === 401 || e.status === 403) keluar(true);
      throw e;
    });
  }
  function setData(d) { st.data = d; st.terakhir = Date.now(); LS.set('k_siklus_data', d); return d; }
  function rpc(nama, args) {
    return token().then(function (t) { return api().rpc(nama, args || {}, t); }).then(function (d) {
      if (!d || typeof d !== 'object' || !('peran' in d)) throw err('Balasan server tidak dikenal');
      // sesi Siklus harus cocok dengan user Kantong di HP ini (pemilik <-> Febie, pembaca <-> pasangan)
      if (d.peran && (d.peran === 'pemilik') !== akuPemilik()) { keluar(true); throw err('Sesi Siklus bukan milik user ini. Masuk ulang.'); }
      return setData(d);
    });
  }
  function keluar(diam) {
    st.sesi = null; st.data = null; LS.del('k_siklus_sesi'); LS.del('k_siklus_data');
    if (!diam) { x.toast('Siklus dikeluarkan dari HP ini'); x.refresh(); }
  }
  function segarkan(paksa) {
    if (!st.sesi || !siap() || st.sibuk) return Promise.resolve();
    if (!paksa && Date.now() - st.terakhir < 120000) return Promise.resolve();
    st.sibuk = true;
    return rpc('siklus_muat').then(function () { st.sibuk = false; x.refresh(); }, function () { st.sibuk = false; });
  }
  function aksi(nama, args, okMsg) {
    return rpc(nama, args).then(function (d) { if (okMsg) x.toast(okMsg); x.refresh(); return d; },
      function (e) { x.toast(e.offline ? 'Perlu internet untuk menyimpan catatan siklus' : e.message, true); throw e; });
  }

  // ---------- tampilan di Agenda ----------
  function tglPendek(iso) { var p = iso.split('-'); return (+p[2]) + ' ' + x.BULAN[+p[1] - 1].slice(0, 3); }
  function rentangPendek(a, z) { return a.slice(5, 7) === z.slice(5, 7) ? (+a.slice(8)) + '–' + tglPendek(z) : tglPendek(a) + ' – ' + tglPendek(z); }
  var DISCLAIMER = 'Ini perkiraan dari catatan, bukan diagnosis dan bukan alat kontrasepsi.';
  function perkiraanHtml(p) {
    if (!p) return '';
    return '<b>Perkiraan berikutnya: ' + esc(rentangPendek(p.dari, p.sampai)) + '</b>' +
      (p.kasar ? ' <span class="tag">perkiraan kasar</span>' : '') +
      '<span class="sk-sub">' + (p.kasar ? 'Belum ada 2 catatan, jadi memakai ' + K.BAKU_SIKLUS + ' hari.' : 'Rata-rata ' + p.panjang + ' hari dari ' + p.dipakai + ' jarak terakhir.') +
      (p.telat ? ' Sudah lewat ' + p.telat + ' hari dari perkiraan.' : '') + '</span>';
  }
  var Siklus = {
    VERSI_TEKS: VERSI_TEKS,
    lapisTersedia: function () { return aktif() && tampil(); },
    bisaCatat: function () { return aktif() && peran() === 'pemilik'; },
    tandaBulan: function (b) { return K.tanda(rows(), x.todayISO(), b + '-01', x.akhirBulan(b)); },
    panelHari: function (d) {
      var r = K.ringkas(rows()), row = K.catatanDi(rows(), d, r.durasi), t = this.tandaBulan(d.slice(0, 7))[d];
      var siapa = peran() === 'pemilik' ? '' : ' ' + namaPemilik();
      if (!t) return '';
      var isi;
      if (t === 'catat' && row) {
        var hari = K.selisih(row.mulai, d) + 1, cat = catatan(row.id);
        isi = '<b>Siklus' + esc(siapa) + ' · hari ke-' + hari + '</b>' +
          '<span class="sk-sub">' + esc(row.selesai ? rentangPendek(row.mulai, row.selesai) : 'Mulai ' + tglPendek(row.mulai) + (K.berjalan(rows(), x.todayISO()) === row ? ', belum dicatat selesai' : '')) + '</span>' +
          (cat ? '<span class="sk-cat">' + esc(cat) + '</span>' : '');
      } else {
        isi = perkiraanHtml(K.perkiraan(rows(), x.todayISO())).replace('Perkiraan berikutnya', 'Perkiraan siklus' + esc(siapa)) +
          '<span class="sk-note">' + DISCLAIMER + '</span>';
      }
      return '<div class="list sk-panel"><span class="ldot l-siklus' + (t === 'kira' ? ' kira' : '') + '" aria-hidden="true"></span><div>' + isi + '</div></div>';
    },
    tombolHari: function (d) {
      if (d > x.todayISO()) return '';
      var jalan = K.berjalan(rows(), d), di = K.catatanDi(rows(), d, K.ringkas(rows()).durasi);
      if (jalan) return '<button type="button" class="btn small ghost sk-btn" data-sk="selesai"><span class="ldot l-siklus"></span>Selesai</button>';
      if (di) return '<button type="button" class="btn small ghost sk-btn" data-sk="ubah" data-skid="' + esc(di.id) + '"><span class="ldot l-siklus"></span>Ubah catatan</button>';
      return '<button type="button" class="btn small ghost sk-btn" data-sk="mulai"><span class="ldot l-siklus"></span>Mulai siklus</button>';
    },
    bindHari: function (box, d) {
      $$('[data-sk]', box).forEach(function (b) { b.addEventListener('click', function () {
        var a = b.getAttribute('data-sk');
        if (a === 'mulai') mulaiDi(d);
        else if (a === 'selesai') { var j = K.berjalan(rows(), d); aksi('siklus_simpan', { id: j.id, mulai: j.mulai, selesai: d, abaikan_jarak: j.abaikan_jarak }, 'Dicatat selesai ' + tglPendek(d)); }
        else if (a === 'ubah') bukaCatatan(rows().filter(function (r) { return r.id === b.getAttribute('data-skid'); })[0]);
      }); });
    },
    segarkan: segarkan,
    keluar: keluar,
    pengaturanHtml: function () { return pengaturanHtml(); },
    bindPengaturan: function (el) { bindPengaturan(el); },
    renderKartuBaru: function (root) { renderKartuBaru(root); },
    onboarding: function () { onboarding(); }
  };

  function tanyaJarak(h, lanjut) {
    x.openSheet('Ada yang terlewat?', function (sh) {
      sh.el.innerHTML = '<p class="sk-p">Jarak dari siklus sebelumnya <b>' + h + ' hari</b>, di luar rentang yang umum (' + K.NORMAL_MIN + '–' + K.NORMAL_MAX + ' hari). Ada catatan yang terlewat?</p>' +
        '<p class="hint" style="margin:8px 0 0">Kalau ya, jarak ini tidak dipakai untuk menghitung perkiraan.</p>' +
        '<button type="button" class="btn" id="sk-ya">Ya, ada yang terlewat</button><button type="button" class="btn ghost" id="sk-tidak" style="margin-top:10px">Tidak, memang segitu</button>';
      $('#sk-ya', sh.el).addEventListener('click', function () { sh.close(); lanjut(true); });
      $('#sk-tidak', sh.el).addEventListener('click', function () { sh.close(); lanjut(false); });
    });
  }
  function mulaiDi(d) {
    var h = K.jarakAneh(rows(), d, null);
    var simpan = function (abaikan) { aksi('siklus_simpan', { id: x.uid(), mulai: d, selesai: '', abaikan_jarak: abaikan }, 'Siklus dicatat mulai ' + tglPendek(d)); };
    if (h) tanyaJarak(h, simpan); else simpan(false);
  }
  function bukaCatatan(r) {
    var baru = !r;
    var f = r ? { id: r.id, mulai: r.mulai, selesai: r.selesai || '', catatan: catatan(r.id), abaikan_jarak: !!r.abaikan_jarak }
      : { id: x.uid(), mulai: x.todayISO(), selesai: '', catatan: '', abaikan_jarak: false };
    x.openSheet(baru ? 'Tambah catatan siklus' : 'Ubah catatan siklus', function (sh) {
      sh.el.innerHTML = '<div class="field row2" style="margin-top:4px"><div><label for="sk-m">Mulai</label><input id="sk-m" class="input" type="date" max="' + x.todayISO() + '" value="' + esc(f.mulai) + '"></div>' +
        '<div><label for="sk-s">Selesai</label><input id="sk-s" class="input" type="date" max="' + x.todayISO() + '" value="' + esc(f.selesai) + '"></div></div>' +
        '<p class="hint">Selesai boleh kosong. Kalau kosong, dianggap ' + K.ringkas(rows()).durasi + ' hari (rata-rata catatanmu).</p>' +
        '<div class="field"><label for="sk-c">Catatan <span class="faint">(opsional, hanya kamu' + (atur().bagikan_catatan ? ' dan ' + esc(namaPasangan()) : '') + ')</span></label><textarea id="sk-c" class="input" maxlength="300" rows="2">' + esc(f.catatan) + '</textarea></div>' +
        '<div class="err" id="sk-err" role="alert"></div><button type="button" class="btn" id="sk-save">Simpan</button>' +
        (baru ? '' : '<button type="button" class="btn danger" id="sk-del">Hapus catatan ini</button>');
      $('#sk-save', sh.el).addEventListener('click', function () {
        f.mulai = $('#sk-m', sh.el).value; f.selesai = $('#sk-s', sh.el).value; f.catatan = $('#sk-c', sh.el).value;
        if (!f.mulai) { $('#sk-err', sh.el).textContent = 'Isi tanggal mulai'; return; }
        if (f.selesai && (f.selesai < f.mulai || K.selisih(f.mulai, f.selesai) > K.MAKS_DURASI)) { $('#sk-err', sh.el).textContent = 'Tanggal selesai harus 0–' + K.MAKS_DURASI + ' hari setelah mulai'; return; }
        var kirim = function (abaikan) {
          f.abaikan_jarak = abaikan;
          aksi('siklus_simpan', f, 'Catatan siklus disimpan').then(function () { sh.close(); }, function () {});
        };
        var berubah = !r || r.mulai !== f.mulai, h = berubah ? K.jarakAneh(rows(), f.mulai, f.id) : 0;
        if (h) tanyaJarak(h, kirim); else kirim(f.abaikan_jarak);
      });
      var del = $('#sk-del', sh.el);
      if (del) del.addEventListener('click', function () {
        if (!confirm('Hapus catatan ini? Tidak bisa dikembalikan.')) return;
        aksi('siklus_hapus', { p_id: r.id }, 'Catatan dihapus').then(function () { sh.close(); }, function () {});
      });
    });
  }
  function riwayatSheet() {
    x.openSheet('Riwayat catatan siklus', function (sh) {
      function draw() {
        var r = K.ringkas(rows()), list = K.urut(rows()).reverse();
        sh.el.innerHTML = '<button type="button" class="btn small ghost" id="sk-add" style="margin:4px 0 12px">' + x.ICON.plus + 'Tambah catatan lama</button>' +
          (list.length ? '<div class="list">' + list.map(function (z) {
            var akhir = K.akhirCatatan(z, r.durasi), n = K.selisih(z.mulai, akhir) + 1;
            return '<button type="button" class="wallet" data-skr="' + esc(z.id) + '"><span class="ldot l-siklus"></span><span class="main"><span class="t1" style="display:block">' + esc(rentangPendek(z.mulai, akhir)) + ' ' + z.mulai.slice(0, 4) + '</span>' +
              '<span class="t2">' + n + ' hari' + (z.selesai ? '' : ' (perkiraan)') + (z.abaikan_jarak ? ' · jarak sebelumnya tidak dihitung' : '') + (catatan(z.id) ? ' · ada catatan' : '') + '</span></span></button>';
          }).join('') + '</div>' : '<div class="list"><div class="empty">Belum ada catatan.</div></div>');
        $('#sk-add', sh.el).addEventListener('click', function () { sh.close(); bukaCatatan(null); });
        $$('[data-skr]', sh.el).forEach(function (b) { b.addEventListener('click', function () {
          var z = rows().filter(function (q) { return q.id === b.getAttribute('data-skr'); })[0]; sh.close(); bukaCatatan(z);
        }); });
      }
      draw();
    });
  }
  function unduhCadangan() {
    var isi = { dibuat: x.nowIso(), catatan: K.urut(rows()).map(function (r) { return { mulai: r.mulai, selesai: r.selesai || '', catatan: catatan(r.id) }; }) };
    var a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([JSON.stringify(isi, null, 2)], { type: 'application/json' }));
    a.download = 'siklus-cadangan-' + x.todayISO() + '.json';
    document.body.appendChild(a); a.click(); setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 500);
  }

  // ---------- login OTP (dipakai onboarding & Pengaturan) ----------
  function formMasuk(box, judul, onMasuk) {
    var tahap = 'email', email = (st.sesi && st.sesi.email) || '';
    function draw() {
      box.innerHTML = (judul ? '<h2 class="onb-h2">' + judul + '</h2>' : '') +
        (tahap === 'email'
          ? '<p class="sk-p">Masukkan email' + (akuPemilik() ? 'mu' : '') + ' yang sudah didaftarkan untuk Siklus. Kode 6 angka akan dikirim ke email itu.</p>' +
            '<div class="field"><label for="sk-email">Email</label><input id="sk-email" class="input" type="email" autocomplete="email" inputmode="email" value="' + esc(email) + '"></div>' +
            '<div class="err" id="sk-lerr" role="alert"></div><button type="button" class="btn" id="sk-kirim">Kirim kode</button>'
          : '<p class="sk-p">Kode dikirim ke <b>' + esc(email) + '</b>. Buka email, lalu ketik kodenya di sini.' + (demo() ? ' <span class="faint">(Mode demo: 6 angka apa saja.)</span>' : '') + '</p>' +
            '<div class="field"><label for="sk-kode">Kode 6 angka</label><input id="sk-kode" class="input sk-kode" inputmode="numeric" autocomplete="one-time-code" maxlength="6" pattern="[0-9]*"></div>' +
            '<div class="err" id="sk-lerr" role="alert"></div><button type="button" class="btn" id="sk-masuk">Masuk</button>' +
            '<button type="button" class="btn ghost" id="sk-ganti" style="margin-top:10px">Ganti email / kirim ulang</button>');
      if (tahap === 'email') {
        var inp = $('#sk-email', box);
        $('#sk-kirim', box).addEventListener('click', function () {
          var btn = this; email = inp.value.trim().toLowerCase();
          if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { $('#sk-lerr', box).textContent = 'Email belum benar'; return; }
          btn.disabled = true; btn.textContent = 'Mengirim…';
          api().kirimKode(email).then(function () { tahap = 'kode'; draw(); setTimeout(function () { var k = $('#sk-kode', box); if (k) k.focus(); }, 50); },
            function (e) { btn.disabled = false; btn.textContent = 'Kirim kode'; $('#sk-lerr', box).textContent = e.message; });
        });
      } else {
        var kode = $('#sk-kode', box);
        kode.addEventListener('input', function () { kode.value = kode.value.replace(/\D/g, '').slice(0, 6); });
        $('#sk-masuk', box).addEventListener('click', function () {
          var btn = this; btn.disabled = true; btn.textContent = 'Memeriksa…';
          api().verifikasi(email, kode.value).then(function (j) {
            simpanSesi(j); return rpc('siklus_muat');
          }).then(function (d) {
            if (!d.peran) { keluar(true); throw err('Email ini belum didaftarkan untuk Siklus (minta pemilik project menambahkannya).'); }
            if (akuPemilik() && d.peran !== 'pemilik') { keluar(true); throw err('Email ini bukan pemilik catatan Siklus.'); }
            onMasuk(d);
          }).catch(function (e) { btn.disabled = false; btn.textContent = 'Masuk'; var l = $('#sk-lerr', box); if (l) l.textContent = e.message; });
        });
        $('#sk-ganti', box).addEventListener('click', function () { tahap = 'email'; draw(); });
      }
    }
    draw();
  }

  // ---------- Pengaturan ----------
  function pengaturanHtml() {
    var h = '<section class="section" id="set-siklus"><div class="section-h"><h2>Siklus</h2></div>';
    if (!siap()) return h + '<div class="menu"><div class="sk-info">Siklus belum disiapkan di HP ini. Langkah pasang ada di PANDUAN, bagian Siklus.</div></div></section>';
    if (akuPemilik()) {
      if (!aktif()) return h + '<div class="menu"><button data-sks="aktifkan"><span class="main">Aktifkan Siklus<div class="t2">Catat tanggal siklus dan lihat perkiraan berikutnya</div></span>' + x.ICON.right + '</button></div></section>';
      var p = K.perkiraan(rows(), x.todayISO());
      return h + '<div class="menu">' +
        '<div class="sk-info">' + (p ? perkiraanHtml(p) : 'Belum ada catatan.') + '<span class="sk-note">' + DISCLAIMER + '</span></div>' +
        x.toggleHtml('sks-tampil', 'Tampilkan Siklus di kalender', 'Mati = semua tanda Siklus hilang dari Agenda; data tetap tersimpan', tampil()) +
        x.toggleHtml('sks-bagi', 'Bagikan catatan ke ' + esc(namaPasangan()), 'Jadwal (tanggal & perkiraan) selalu terlihat oleh ' + esc(namaPasangan()), !!atur().bagikan_catatan) +
        '<button data-sks="riwayat"><span class="main">Riwayat catatan<div class="t2">' + rows().length + ' catatan</div></span>' + x.ICON.right + '</button>' +
        '<button data-sks="unduh"><span class="main">Unduh cadangan (JSON)<div class="t2">Simpan salinan catatan ke HP</div></span></button>' +
        '<button data-sks="matikan"><span class="main">Matikan Siklus<div class="t2">Berhenti mencatat; data tidak dihapus</div></span></button>' +
        '<button data-sks="hapus"><span class="main" style="color:var(--over)">Hapus semua catatan siklus</span></button>' +
        '<button data-sks="keluar"><span class="main">Keluar dari Siklus di HP ini</span></button></div></section>';
    }
    if (!st.sesi) return h + '<div class="menu"><button data-sks="masuk"><span class="main">Masuk untuk lihat jadwal<div class="t2">Jadwal dari catatan ' + esc(namaPemilik()) + '</div></span>' + x.ICON.right + '</button></div></section>';
    return h + '<div class="menu">' +
      (aktif() ? '<div class="sk-info">' + perkiraanHtml(K.perkiraan(rows(), x.todayISO())).replace('Perkiraan berikutnya', 'Perkiraan ' + esc(namaPemilik())) + '<span class="sk-note">' + DISCLAIMER + '</span></div>' +
        x.toggleHtml('sks-tampil', 'Tampilkan Siklus di kalender', 'Mati = semua tanda Siklus hilang dari Agenda', tampil())
        : '<div class="sk-info">' + esc(namaPemilik()) + ' belum mengaktifkan Siklus.</div>') +
      '<button data-sks="keluar"><span class="main">Keluar dari Siklus di HP ini</span></button></div></section>';
  }
  function bindPengaturan(el) {
    var tg = $('#sks-tampil', el);
    if (tg) tg.addEventListener('click', function () { x.prefs().siklusTampil = !tampil(); x.persist(); tg.setAttribute('aria-checked', String(tampil())); });
    var bg = $('#sks-bagi', el);
    if (bg) bg.addEventListener('click', function () {
      var v = !atur().bagikan_catatan;
      aksi('siklus_atur', { bagikan_catatan: v }, v ? 'Catatan dibagikan ke ' + namaPasangan() : 'Catatan tidak dibagikan lagi');
    });
    $$('[data-sks]', el).forEach(function (b) { b.addEventListener('click', function () {
      var a = b.getAttribute('data-sks');
      if (a === 'aktifkan') onboarding({ mulaiDari: 'tawaran' });
      else if (a === 'riwayat') riwayatSheet();
      else if (a === 'unduh') unduhCadangan();
      else if (a === 'matikan') { if (confirm('Matikan Siklus? Catatan tetap tersimpan dan bisa diaktifkan lagi.')) aksi('siklus_atur', { aktif: false }, 'Siklus dimatikan'); }
      else if (a === 'hapus') {
        if (!confirm('Hapus SEMUA catatan siklus dan tarik persetujuanmu? Tidak bisa dikembalikan.')) return;
        if (!confirm('Yakin? Sebaiknya unduh cadangan dulu.')) return;
        aksi('siklus_hapus_semua', {}, 'Semua catatan siklus dihapus');
      } else if (a === 'keluar') { if (confirm('Keluar dari Siklus di HP ini? Data di server tidak berubah.')) keluar(); }
      else if (a === 'masuk') x.openSheet('Masuk ke Siklus', function (sh) { formMasuk(sh.el, '', function () { sh.close(); x.toast('Masuk. Jadwal muncul di Agenda.'); x.refresh(); }); });
    }); });
  }

  // ---------- kartu "Ada yang baru" & onboarding ----------
  function kunciOnb() { var m = x.me(); return 'k_onb_' + (m ? m.id : ''); }
  function sudahOnb() { return LS.get(kunciOnb(), 0) >= ONB_VERSI; }
  function tandaiOnb() { LS.set(kunciOnb(), ONB_VERSI); }
  function renderKartuBaru(root) {
    if (!root) return;
    if (sudahOnb() || !x.fitur('agenda')) { root.innerHTML = ''; return; }
    root.innerHTML = '<section class="section"><div class="baru"><span class="eyebrow">Ada yang baru</span>' +
      '<p><b>Agenda</b>: kalender to-do & momen penting' + (akuPemilik() ? ', plus catatan siklus kalau kamu mau.' : '.') + '</p>' +
      '<div class="act"><button type="button" class="btn small" data-baru="lihat">Lihat</button><button type="button" class="btn small ghost" data-baru="nanti">Nanti</button></div></div></section>';
    $('[data-baru="lihat"]', root).addEventListener('click', function () { onboarding(); });
    $('[data-baru="nanti"]', root).addEventListener('click', function () { tandaiOnb(); root.innerHTML = ''; x.toast('Bisa dilihat lagi di Pengaturan'); });
  }
  function miniKal() {
    var d = [['Sen', ''], ['Sel', 't'], ['Rab', ''], ['Kam', 'tm'], ['Jum', ''], ['Sab', 'm'], ['Min', '']];
    return '<div class="onb-kal" aria-hidden="true">' + d.map(function (z, i) {
      return '<span><small>' + z[0] + '</small><b>' + (12 + i) + '</b><i>' + (z[1].indexOf('t') >= 0 ? '<em class="l-todo"></em>' : '') + (z[1].indexOf('m') >= 0 ? '<em class="l-momen"></em>' : '') + '</i></span>';
    }).join('') + '</div>';
  }
  function onboarding(opt) {
    opt = opt || {};
    var pemilik = akuPemilik(), pas = namaPasangan(), nama = x.me() ? x.me().nama : '';
    var urutan = pemilik ? ['sambutan', 'agenda', 'tawaran', 'privasi', 'masuk', 'bagikan', 'isi', 'selesai'] : ['sambutan', 'agenda', 'selesai'];
    var i = opt.mulaiDari ? urutan.indexOf(opt.mulaiDari) : 0;
    var hasil = { siklus: false, bagikan: false, setuju: false };
    var ov = document.createElement('div');
    ov.className = 'onb'; ov.setAttribute('role', 'dialog'); ov.setAttribute('aria-modal', 'true'); ov.setAttribute('aria-labelledby', 'onb-h');
    document.body.appendChild(ov); document.body.classList.add('onb-open');
    function tutup() { tandaiOnb(); ov.remove(); document.body.classList.remove('onb-open'); document.removeEventListener('keydown', esc1); x.refresh(); }
    function esc1(e) { if (e.key === 'Escape') tutup(); }
    document.addEventListener('keydown', esc1);
    function ke(nama2) { i = urutan.indexOf(nama2); draw(); }
    function lanjut() { i = Math.min(urutan.length - 1, i + 1); draw(); }
    function draw() {
      var lang = urutan[i];
      var prog = '<div class="onb-prog" aria-label="Langkah ' + (i + 1) + ' dari ' + urutan.length + '">' + urutan.map(function (z, k) { return '<i' + (k === i ? ' class="on"' : (k < i ? ' class="done"' : '')) + '></i>'; }).join('') + '</div>';
      ov.innerHTML = '<div class="onb-in"><div class="onb-top">' + prog + '<button type="button" class="iconbtn" data-onb="x" aria-label="Tutup pengenalan">✕</button></div><div class="onb-body" id="onb-body"></div></div>';
      var b = $('#onb-body', ov);
      $('[data-onb="x"]', ov).addEventListener('click', tutup);
      if (lang === 'sambutan') {
        b.innerHTML = '<h2 class="onb-h2" id="onb-h">Hai ' + esc(nama) + '</h2>' +
          '<p class="sk-p">Kantong sekarang punya <b>Agenda</b>: to-do, momen penting' + (pemilik ? ', dan (kalau kamu mau) catatan siklus.' : ', dan riwayatnya per bulan.') + '</p>' +
          '<div class="onb-act"><button type="button" class="btn" data-o="lanjut">Lanjut</button><button type="button" class="btn ghost" data-o="lewati">Lewati semua</button></div>' +
          (pemilik ? '<p class="hint" style="text-align:center">Lewati semua = Siklus tetap mati. Bisa diaktifkan nanti di Pengaturan.</p>' : '');
      } else if (lang === 'agenda') {
        b.innerHTML = '<h2 class="onb-h2" id="onb-h">Agenda & Momen</h2>' + miniKal() +
          '<p class="sk-p">Tiap tanggal punya titik: <span class="lg"><em class="l-todo"></em>to-do</span> dan <span class="lg"><em class="l-momen"></em>momen</span>. Tap tanggal untuk melihat isinya, termasuk bulan-bulan lalu.</p>' +
          '<p class="sk-p">Tandai hari penting, satu hari atau beberapa hari. Bisa diingatkan tiap tahun lewat Google Calendar "Rumah Kita".</p>' +
          '<div class="onb-act"><button type="button" class="btn" data-o="lanjut">Lanjut</button><button type="button" class="btn ghost" data-o="kembali">Kembali</button></div>';
      } else if (lang === 'tawaran') {
        if (!siap()) {
          b.innerHTML = '<h2 class="onb-h2" id="onb-h">Catatan siklus</h2><p class="sk-p">Siklus butuh database khusus di akunmu dulu (' + esc(pas) + ' bisa bantu memasangnya). Setelah siap, aktifkan dari <b>Pengaturan → Siklus</b>.</p>' +
            '<div class="onb-act"><button type="button" class="btn" data-o="selesai">Lanjut</button></div>';
        } else {
          b.innerHTML = '<h2 class="onb-h2" id="onb-h">Mau catat siklus di sini?</h2>' +
            '<ul class="onb-list"><li>Kamu catat tanggal mulai & selesai, plus catatan kalau mau.</li><li>Kamu dapat perkiraan siklus berikutnya, dalam rentang ±' + K.RENTANG + ' hari.</li><li>Di layar, labelnya cuma "Siklus".</li></ul>' +
            '<div class="sk-warn">Ini perkiraan, <b>bukan diagnosis</b> dan <b>bukan alat kontrasepsi</b>.</div>' +
            '<div class="onb-act"><button type="button" class="btn" data-o="lanjut">Ya, aktifkan</button><button type="button" class="btn ghost" data-o="selesai">Nanti saja</button></div>';
        }
      } else if (lang === 'privasi') {
        b.innerHTML = '<h2 class="onb-h2" id="onb-h">Siapa yang bisa melihat?</h2>' +
          '<ul class="onb-list"><li>Catatanmu disimpan di <b>database milik akunmu sendiri</b>, terpisah dari data keuangan.</li>' +
          '<li><b>Jadwal</b> (tanggal & perkiraan) <b>selalu terlihat oleh ' + esc(pas) + '</b>.</li>' +
          '<li><b>Catatan</b> hanya terlihat olehmu, kecuali kamu bagikan.</li>' +
          '<li>Tidak pernah masuk Google Calendar atau halaman Catat.</li>' +
          '<li>Kamu bisa menghapus semuanya kapan saja di Pengaturan → Siklus.</li></ul>' +
          '<label class="cek"><input type="checkbox" id="onb-setuju"' + (hasil.setuju ? ' checked' : '') + '><span>Aku paham dan setuju</span></label>' +
          '<div class="onb-act"><button type="button" class="btn" data-o="lanjut" id="onb-lanjut"' + (hasil.setuju ? '' : ' disabled') + '>Lanjut</button><button type="button" class="btn ghost" data-o="kembali">Kembali</button></div>';
        $('#onb-setuju', b).addEventListener('change', function (e) { hasil.setuju = e.target.checked; $('#onb-lanjut', b).disabled = !hasil.setuju; });
      } else if (lang === 'masuk') {
        var setelah = function () {
          aksi('siklus_atur', { aktif: true, setuju: true, versi_teks: VERSI_TEKS }).then(function () { hasil.siklus = true; ke('bagikan'); }, function () {});
        };
        if (st.sesi && peran() === 'pemilik') { b.innerHTML = '<p class="sk-p">Menyimpan…</p>'; setelah(); return; }
        formMasuk(b, 'Masuk ke Siklus', setelah);
        var h2 = $('.onb-h2', b); if (h2) h2.id = 'onb-h';
        b.insertAdjacentHTML('beforeend', '<button type="button" class="btn ghost" data-o="kembali" style="margin-top:10px">Kembali</button>');
      } else if (lang === 'bagikan') {
        b.innerHTML = '<h2 class="onb-h2" id="onb-h">Bagikan catatan ke ' + esc(pas) + '?</h2>' +
          '<p class="sk-p">Jadwal tetap terlihat oleh ' + esc(pas) + '. Ini hanya soal <b>catatan</b> (mis. "kram hari pertama").</p>' +
          '<div class="seg onb-seg" role="radiogroup" aria-label="Bagikan catatan"><button type="button" role="radio" data-bg="0" aria-pressed="' + !hasil.bagikan + '" aria-checked="' + !hasil.bagikan + '">Tidak</button><button type="button" role="radio" data-bg="1" aria-pressed="' + hasil.bagikan + '" aria-checked="' + hasil.bagikan + '">Ya</button></div>' +
          '<p class="hint">Bisa diubah kapan saja di Pengaturan → Siklus.</p>' +
          '<div class="onb-act"><button type="button" class="btn" data-o="simpan-bagi">Lanjut</button></div>';
        $$('[data-bg]', b).forEach(function (z) { z.addEventListener('click', function () { hasil.bagikan = z.getAttribute('data-bg') === '1'; draw(); }); });
      } else if (lang === 'isi') {
        var ada = rows().length;
        b.innerHTML = '<h2 class="onb-h2" id="onb-h">Isi catatan awal</h2>' +
          (ada ? '<p class="sk-p">Sudah ada ' + ada + ' catatan. Tambah lagi kalau ada yang belum.</p>' : '<p class="sk-p">Opsional. Dengan beberapa catatan, perkiraan memakai rata-ratamu sendiri, bukan angka baku ' + K.BAKU_SIKLUS + ' hari.</p>') +
          '<div class="field"><label for="onb-t0">Hari pertama siklus terakhir</label><input id="onb-t0" class="input onb-t" type="date" max="' + x.todayISO() + '"></div>' +
          '<div id="onb-lagi"></div><button type="button" class="btn small ghost" id="onb-tambah" style="margin-top:12px">' + x.ICON.plus + 'Tambah siklus sebelumnya</button>' +
          '<div class="err" id="onb-err" role="alert"></div>' +
          '<div class="onb-act"><button type="button" class="btn" data-o="simpan-isi">Simpan & lanjut</button><button type="button" class="btn ghost" data-o="lanjut">Lewati</button></div>';
        var n = 1;
        $('#onb-tambah', b).addEventListener('click', function () {
          if (n >= 6) return;
          $('#onb-lagi', b).insertAdjacentHTML('beforeend', '<div class="field"><label for="onb-t' + n + '">Sebelumnya (' + n + ')</label><input id="onb-t' + n + '" class="input onb-t" type="date" max="' + x.todayISO() + '"></div>');
          n++; if (n >= 6) this.hidden = true;
        });
      } else if (lang === 'selesai') {
        var sAktif = aktif() || hasil.siklus;
        b.innerHTML = '<h2 class="onb-h2" id="onb-h">Siap!</h2><ul class="onb-list">' +
          '<li><b>Agenda & Momen</b>: tab Agenda di menu bawah.</li>' +
          (pemilik ? (sAktif ? '<li><b>Siklus aktif.</b> Jadwal terlihat oleh ' + esc(pas) + '; catatan ' + (atur().bagikan_catatan ? 'dibagikan' : 'tidak dibagikan') + '.</li>' +
              '<li>Sembunyi cepat: chip <b>Siklus</b> di Agenda. Ubah semua: <b>Pengaturan → Siklus</b>.</li>'
            : '<li>Siklus tidak aktif. Bisa diaktifkan kapan saja di <b>Pengaturan → Siklus</b>.</li>') : '') +
          '</ul><div class="onb-act"><button type="button" class="btn" data-o="agenda">Buka Agenda</button><button type="button" class="btn ghost" data-o="tutup">Selesai</button></div>';
      }
      $$('[data-o]', b).forEach(function (z) { z.addEventListener('click', function () {
        var o = z.getAttribute('data-o');
        if (o === 'lanjut') lanjut();
        else if (o === 'kembali') { i = Math.max(0, i - 1); draw(); }
        else if (o === 'lewati' || o === 'tutup') tutup();
        else if (o === 'selesai') ke('selesai');
        else if (o === 'agenda') { tutup(); x.goAgenda(); }
        else if (o === 'simpan-bagi') {
          z.disabled = true;
          aksi('siklus_atur', { bagikan_catatan: hasil.bagikan }).then(lanjut, function () { z.disabled = false; });
        } else if (o === 'simpan-isi') {
          var tgl = $$('.onb-t', b).map(function (q) { return q.value; }).filter(Boolean)
            .filter(function (v, k, arr) { return arr.indexOf(v) === k; })
            .filter(function (v) { return !rows().some(function (r) { return r.mulai === v; }); }).sort();
          if (!tgl.length) { lanjut(); return; }
          z.disabled = true; z.textContent = 'Menyimpan…';
          var p = Promise.resolve();
          tgl.forEach(function (v) { p = p.then(function () { return rpc('siklus_simpan', { id: x.uid(), mulai: v, selesai: '' }); }); });
          p.then(function () { x.toast(tgl.length + ' catatan disimpan'); lanjut(); },
            function (e) { z.disabled = false; z.textContent = 'Simpan & lanjut'; $('#onb-err', b).textContent = e.message; });
        }
      }); });
      var fokus = $('h2', b); if (fokus) { fokus.setAttribute('tabindex', '-1'); fokus.focus(); }
    }
    draw();
  }
  return Siklus;
};
