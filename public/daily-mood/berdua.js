/* Couple Journaling — tab "Berdua" di Daily Mood.
   Evaluasi harian (±30 detik), check-in mingguan terpandu (30 menit), review bulanan, editor pertanyaan
   (draft → preview → publish), pohon tumbuh bersama, lencana, ekspor untuk konselor.
   Data: tabel jurnal_pasangan lewat Edge Function kantong (aksi cj.*). Aturan privasi dijalankan di server (shared/core.js › cjAksi).
   Mode demo: logika yang sama (KantongCore.handle) dengan penyimpanan di HP ini, bisa "lihat sebagai" pasangan.
   Dipanggil app.js: Berdua.render(view). Atribut data-* di sini selalu berawalan data-cj supaya tidak bentrok dengan app.js. */
(function () {
  'use strict';
  var C = window.KantongCore, J = C && C.CJ;
  if (!J) { window.Berdua = { render: function (el) { el.innerHTML = '<p class="muted">Couple Journaling belum termuat. Muat ulang halaman.</p>'; } }; return; }

  // ================= util =================
  var BULAN = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
  var HARI = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
  function pad(n) { return String(n).padStart(2, '0'); }
  function isoLokal(d) { d = d || new Date(); return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); }
  function nowIso() {
    var d = new Date(), off = -d.getTimezoneOffset(), s = off >= 0 ? '+' : '-', a = Math.abs(off);
    return isoLokal(d) + 'T' + pad(d.getHours()) + ':' + pad(d.getMinutes()) + ':' + pad(d.getSeconds()) + s + pad(Math.floor(a / 60)) + ':' + pad(a % 60);
  }
  function tgl(iso) { var p = iso.split('-'); return new Date(+p[0], +p[1] - 1, +p[2]); }
  function fmtTgl(iso) { var d = tgl(iso); return HARI[d.getDay()] + ', ' + d.getDate() + ' ' + BULAN[d.getMonth()]; }
  function fmtPendek(iso) { var d = tgl(iso); return d.getDate() + ' ' + BULAN[d.getMonth()].slice(0, 3); }
  function fmtBulan(m) { return BULAN[+m.slice(5, 7) - 1] + ' ' + m.slice(0, 4); }
  function fmtMinggu(w) { var h = J.hariDalam(w); return fmtPendek(h[0]) + ' – ' + fmtPendek(h[6]); }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function salin(o) { return JSON.parse(JSON.stringify(o)); }
  function ls(k, def) { try { var v = JSON.parse(localStorage.getItem(k)); return v == null ? def : v; } catch (e) { return def; } }
  function lsSet(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* penuh */ } }
  function acakId() { return Math.random().toString(36).slice(2, 8) + Date.now().toString(36).slice(-4); }
  function toast(msg) {
    var el = document.getElementById('toast'); if (!el) return;
    el.textContent = msg; el.classList.add('show'); clearTimeout(toast.t); toast.t = setTimeout(function () { el.classList.remove('show'); }, 2200);
  }
  var MOON = { 4: '🌕', 3: '🌔', 2: '🌓', 1: '🌒', 0: '🌑' };
  var KEJ = { ya: '✓', tidak: '✕', belum: '–' };
  var MOOD_LABEL = ['', 'Berat', 'Kurang', 'Biasa', 'Baik', 'Sangat baik'];

  // ================= koneksi =================
  var CONN = ls('k_conn', null), BOOT = ls('k_boot', null);
  var REMOTE = !!(CONN && CONN.mode === 'remote' && BOOT && BOOT.user && BOOT.user.id);
  var DEMO_KEY = 'k_cj_demo', DEMO_AS = 'k_cj_demo_as';
  function demoUser() {
    var as = ls(DEMO_AS, 'riki');
    return as === 'istri' ? { id: 'istri', nama: 'Febie', buku: 'istri' } : { id: 'riki', nama: 'Riki', buku: 'riki' };
  }
  function rpc(action, payload) {
    if (REMOTE) {
      return fetch(CONN.api, { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify({ token: CONN.token, action: action, payload: payload || {} }) })
        .then(function (r) { if (!r.ok) throw new Error('Server ' + r.status); return r.json(); }, function () { var e = new Error('Sedang offline'); e.offline = true; throw e; })
        .then(function (j) { if (!j.ok) { var e = new Error(j.error || 'Gagal'); e.server = true; throw e; } return j.data; });
    }
    return Promise.resolve().then(function () {
      var seed = ls(DEMO_KEY, null) || {};
      seed.Users = [{ id: 'riki', nama: 'Riki', buku: 'riki' }, { id: 'istri', nama: 'Febie', buku: 'istri' }];
      var st = C.memoryStore(seed);
      var hasil = C.handle(st, demoUser(), action, payload || {}, nowIso());
      lsSet(DEMO_KEY, { JurnalPasangan: st.data.JurnalPasangan });
      if (action === 'batch') hasil.results.forEach(function (r) { if (!r.ok) { var e = new Error(r.error); e.server = true; throw e; } });
      return salin(hasil);
    });
  }
  function uidSaya() { return REMOTE ? BOOT.user.id : demoUser().id; }
  var CACHE_KEY = function () { return 'cj-cache-' + (REMOTE ? 'r-' : 'd-') + uidSaya(); };
  var OUTBOX_KEY = function () { return 'cj-outbox-' + (REMOTE ? 'r-' : 'd-') + uidSaya(); };

  // ================= state =================
  var V = ls(CACHE_KEY(), null);           // view dari server (cjView)
  var S = { scr: 'home', memuat: !V, err: '' };   // layar & keadaan sementara
  var VIEW = null;                          // elemen view milik app.js
  var sibuk = false;

  function terima(v) {
    if (!v || typeof v !== 'object' || !('aktif' in v)) return;
    V = v;
    // isian yang masih antre di HP menang (belum sempat terkirim)
    ls(OUTBOX_KEY(), []).forEach(function (o) { terapkanLokal(o.payload); });
    lsSet(CACHE_KEY(), V);
  }
  function terapkanLokal(p) {
    if (!V || !V.isian) return;
    var k = J.uraiKunci(p.kunci); if (!k) return;
    var id = 'cj|isi|' + V.saya.id + '|' + p.kunci, ada = V.isian.filter(function (x) { return x.id === id; })[0];
    var row = ada || { id: id, pemilik: V.saya.id, kunci: p.kunci, periode: k.periode, nilai: k.nilai, dibagikan: false, berat: false };
    row.jawaban = p.jawaban || {}; row.observer = p.observer || {}; row.mood = p.mood || 0;
    if (p.selesai) { row.terisi = true; row.selesai_at = row.selesai_at || nowIso(); }
    row.antre = true;
    if (!ada) V.isian.push(row);
  }
  function muat(diam) {
    var ob = ls(OUTBOX_KEY(), []);
    var p = ob.length ? rpc('batch', { ops: ob.map(function (o, i) { return { opId: 'o' + i, action: 'cj.isi', payload: o.payload }; }).concat([{ opId: 's', action: 'cj.state' }]) })
      .then(function (d) {
        var gagal = [];
        d.results.forEach(function (r) { if (r.opId !== 's' && !r.ok) gagal.push(r.error); });
        lsSet(OUTBOX_KEY(), []);
        if (gagal.length) toast('Isian tertunda ditolak: ' + gagal[0]);
        return d.results.filter(function (r) { return r.opId === 's'; })[0].data;
      }) : rpc('cj.state');
    return p.then(function (v) { terima(v); S.memuat = false; S.err = ''; gambar(); }, function (e) {
      S.memuat = false; S.err = e.offline ? 'offline' : e.message; if (!diam) gambar();
    });
  }
  // aksi yang butuh server: kunci tombol, kirim, gambar ulang
  function aksi(action, payload, pesan, lalu) {
    if (sibuk) return Promise.resolve();
    sibuk = true;
    return rpc(action, payload).then(function (v) {
      sibuk = false; terima(v); if (pesan) toast(pesan); if (lalu) lalu(); gambar();
    }, function (e) { sibuk = false; toast(e.offline ? 'Butuh koneksi internet untuk ini' : e.message); });
  }
  // isian: jalan offline (antre), dikirim saat online
  function kirimIsian(payload, lalu) {
    var ob = ls(OUTBOX_KEY(), []).filter(function (o) { return o.payload.kunci !== payload.kunci; });
    return rpc('cj.isi', payload).then(function (v) { terima(v); lalu(); gambar(); }, function (e) {
      if (!e.offline) { toast(e.message); return; }
      ob.push({ payload: payload }); lsSet(OUTBOX_KEY(), ob); terapkanLokal(payload); lsSet(CACHE_KEY(), V);
      toast('Offline: tersimpan di HP, dikirim saat online'); lalu(); gambar();
    });
  }

  // ================= data turunan =================
  function sets() { return (V && V.sets) || []; }
  function targets() { return (V && V.target) || {}; }
  function me() { return V.saya; }
  function ps() { return V.pasangan; }
  function namaDari(uid) { return uid === me().id ? me().nama : uid === ps().id ? ps().nama : uid === 'berdua' ? 'Berdua' : ''; }
  function isian(uid, kunci) { return ((V && V.isian) || []).filter(function (x) { return x.pemilik === uid && x.kunci === kunci; })[0] || null; }
  function setAktif(periode, nilai) { return J.setUntuk(sets(), periode, nilai); }
  function hariIni() { return isoLokal(); }
  function mingguIni() { return J.minggu(hariIni()); }
  function sesi(w) { return ((V && V.sesi) || []).filter(function (s) { return s.minggu === w; })[0] || null; }
  function moodHariIni(iso) {
    try { var st = JSON.parse(localStorage.getItem(window.DM_DATA.KEY)); var e = st && st.entries && st.entries[iso]; return e ? e.mood : 0; } catch (e) { return 0; }
  }
  function antrianTopik(w) {
    return ((V && V.topik) || []).filter(function (t) { return (t.status === 'antri' || t.status === 'ditunda') && (t.minggu || '') <= w; })
      .sort(function (a, b) { return (a.dibuat || '') < (b.dibuat || '') ? -1 : 1; });
  }
  function bothFilled(iso) { var a = isian(me().id, 'H:' + iso), b = isian(ps().id, 'H:' + iso); return !!(a && a.terisi && b && b.terisi); }
  function hariTerisi(uid, w) { return J.hariDalam(w).filter(function (d) { var x = isian(uid, 'H:' + d); return x && x.terisi; }).length; }
  function mingguAktif(w) { var s = sesi(w); return !!(s && s.selesai_at) || (hariTerisi(me().id, w) >= 3 && hariTerisi(ps().id, w) >= 3); }
  function streak() {
    var w = mingguIni(), n = 0;
    if (!mingguAktif(w)) w = J.mingguGeser(w, -1);
    for (var i = 0; i < 104 && mingguAktif(w); i++) { n++; w = J.mingguGeser(w, -1); }
    return n;
  }
  function pertumbuhan() {
    var tanggal = {};
    ((V && V.isian) || []).forEach(function (x) { if (x.periode === 'harian') tanggal[x.nilai] = 1; });
    return {
      daun: Object.keys(tanggal).filter(bothFilled).length,
      cabang: ((V && V.sesi) || []).filter(function (s) { return s.selesai_at; }).length,
      bunga: ((V && V.bulanan) || []).filter(function (b) { return b.selesai_at; }).length
    };
  }
  // rata-rata tingkat (0-4) di beberapa minggu: dipakai rekap bulanan, bukan ditampilkan sebagai skor
  function rata(arr) { return arr.length ? arr.reduce(function (s, x) { return s + x; }, 0) / arr.length : null; }
  function rekapTarget(m) {   // B5: kesimpulan target personal sebulan
    var out = [], ids = [me().id, ps().id];
    ids.forEach(function (uid) {
      var lain = uid === ids[0] ? ids[1] : ids[0], perQ = {};
      J.mingguDalamBulan(m).forEach(function (w) {
        var set = setAktif('mingguan', w), a = isian(uid, 'M:' + w), b = isian(lain, 'M:' + w);
        J.itemObserver(set, 'mingguan', uid, targets()).forEach(function (q) {
          var x = perQ[q.id] || (perQ[q.id] = { q: q, diri: [], pas: [] });
          if (a && a.jawaban && a.jawaban[q.id]) x.diri.push(a.jawaban[q.id].n);
          if (b && b.observer && b.observer[q.id]) x.pas.push(b.observer[q.id].n);
        });
      });
      Object.keys(perQ).forEach(function (id) {
        var x = perQ[id], d = rata(x.diri), p = rata(x.pas);
        if (d == null || p == null) return;
        out.push({ pemilik: uid, qid: id, teks: J.teksItem(x.q, targets(), uid), diri: Math.round(d), pasangan: Math.round(p), hasil: J.kesimpulan(Math.round(d), Math.round(p)) });
      });
    });
    return out;
  }
  // item Bersama berskala frekuensi (mingguan + bulanan): rata-rata tingkat berdua per bulan
  function trenBulan(m) {
    var hasil = {}, ids = [me().id, ps().id];
    function catat(q, n) { var h = hasil[q.id] || (hasil[q.id] = { q: q, nilai: [] }); h.nilai.push(n); }
    J.mingguDalamBulan(m).forEach(function (w) {
      var set = setAktif('mingguan', w);
      ids.forEach(function (uid) { var x = isian(uid, 'M:' + w); if (!x || !x.jawaban) return;
        ((set && set.pertanyaan) || []).forEach(function (q) { if (q.jenis === 'bersama' && q.skala === 'frekuensi' && x.jawaban[q.id]) catat(q, x.jawaban[q.id].n); }); });
    });
    var setB = setAktif('bulanan', m);
    ids.forEach(function (uid) { var x = isian(uid, 'B:' + m); if (!x || !x.jawaban) return;
      ((setB && setB.pertanyaan) || []).forEach(function (q) { if (q.jenis === 'bersama' && q.skala === 'frekuensi' && x.jawaban[q.id]) catat(q, x.jawaban[q.id].n); }); });
    Object.keys(hasil).forEach(function (id) { hasil[id].rata = rata(hasil[id].nilai); });
    return hasil;
  }
  function saranBulan(m) {
    var ini = trenBulan(m), lalu = trenBulan(J.bulanGeser(m, -1));
    var daftar = Object.keys(ini).map(function (id) { var a = ini[id], b = lalu[id]; return { id: id, teks: a.q.teks, rata: a.rata, delta: b ? a.rata - b.rata : null }; });
    var membaik = daftar.filter(function (x) { return x.delta != null && x.delta > 0; }).sort(function (a, b) { return b.delta - a.delta; });
    if (membaik.length < 2) membaik = membaik.concat(daftar.filter(function (x) { return membaik.indexOf(x) < 0 && x.rata >= 3; }).sort(function (a, b) { return b.rata - a.rata; }));
    var fokus = rekapTarget(m).filter(function (r) { return r.hasil === 'perlu'; }).map(function (r) { return { teks: 'Target ' + namaDari(r.pemilik) + ': ' + r.teks }; })
      .concat(daftar.filter(function (x) { return x.rata < 2.5; }).sort(function (a, b) { return a.rata - b.rata; }));
    return { membaik: membaik.slice(0, 4).map(function (x) { return x.teks; }), fokus: fokus.slice(0, 4).map(function (x) { return x.teks; }) };
  }
  function lencana() {
    var tp = (V && V.topik) || [], rangkum = tp.filter(function (t) { return t.rangkum; }).length;
    var run = 0, maxRun = 0, w = mingguIni();
    for (var i = 0; i < 104; i++) { var s = sesi(w); if (s && s.selesai_at) { run++; maxRun = Math.max(maxRun, run); } else if (i > 0) run = 0; w = J.mingguGeser(w, -1); }
    var refleksi = 0;
    ((V && V.isian) || []).forEach(function (x) {
      if (x.pemilik !== me().id || !x.jawaban) return;
      var set = setAktif(x.periode, x.nilai), pq = {}; ((set && set.pertanyaan) || []).forEach(function (q) { pq[q.id] = q; });
      Object.keys(x.jawaban).forEach(function (id) { if (pq[id] && pq[id].jenis === 'personal') refleksi++; });
    });
    var bln = hariIni().slice(0, 7), selarasRun = 0, maxSel = 0;
    for (var j = 0; j < 24; j++) {
      var r = rekapTarget(bln);
      if (r.length && r.every(function (x) { return x.hasil === 'selaras'; })) { selarasRun++; maxSel = Math.max(maxSel, selarasRun); } else if (j > 0) selarasRun = 0;
      bln = J.bulanGeser(bln, -1);
    }
    return [
      { id: 'pendengar', nama: 'Pendengar Baik', ket: '5 kali merangkum ulang', n: rangkum, target: 5, ikon: '👂' },
      { id: 'tuntas', nama: 'Tuntas', ket: '4 check-in berturut-turut', n: maxRun, target: 4, ikon: '🤝' },
      { id: 'jujur', nama: 'Jujur pada Diri', ket: '10 refleksi personal', n: refleksi, target: 10, ikon: '🪞' },
      { id: 'selaras', nama: 'Selaras', ket: 'Target personal selaras 2 bulan', n: maxSel, target: 2, ikon: '🌿' }
    ];
  }

  // ================= ilustrasi (SVG inline, warna mengikuti tema) =================
  function svgDaun() {
    return '<svg class="cj-ill grow" viewBox="0 0 160 120" aria-hidden="true"><ellipse cx="80" cy="108" rx="46" ry="6" fill="var(--line)"/>' +
      '<path d="M62 84h36l-5 22H67z" fill="#C98B5E"/><rect x="58" y="78" width="44" height="8" rx="3" fill="#B07448"/>' +
      '<path d="M80 78V48" stroke="#5CA36F" stroke-width="4" stroke-linecap="round"/>' +
      '<path d="M80 58C66 58 56 48 56 34c14 0 24 10 24 24z" fill="var(--m4)"/><path d="M80 50c0-15 10-25 26-25 0 15-10 25-26 25z" fill="var(--m5)"/>' +
      '<circle class="spark" cx="114" cy="24" r="3" fill="var(--accent)"/></svg>';
  }
  function svgBulan() {
    return '<svg class="cj-ill" viewBox="0 0 160 120" aria-hidden="true"><path d="M98 18a26 26 0 1 0 22 40 22 22 0 0 1-22-40z" fill="#F4CF4C"/>' +
      '<circle cx="40" cy="26" r="2" fill="var(--muted)"/><circle cx="58" cy="14" r="1.6" fill="var(--muted)"/><circle cx="132" cy="22" r="1.8" fill="var(--muted)"/>' +
      '<path d="M18 92c14-16 32-16 46-6s32 10 46-2 30-8 34 8v18H18z" fill="var(--accent)" opacity=".85"/>' +
      '<path d="M18 100c18-10 38-6 52 0s36 6 52-2 22-4 22 2v12H18z" fill="var(--accent-2)"/></svg>';
  }
  function svgTeh() {
    return '<svg class="cj-ill" viewBox="0 0 160 120" aria-hidden="true"><rect x="16" y="88" width="128" height="8" rx="4" fill="#B07448"/>' +
      '<path d="M34 58h32v18a14 14 0 0 1-14 14h-4a14 14 0 0 1-14-14z" fill="var(--m5)"/><path d="M66 64h6a7 7 0 0 1 0 14h-6" fill="none" stroke="var(--m5)" stroke-width="4"/>' +
      '<path d="M90 58h32v18a14 14 0 0 1-14 14h-4a14 14 0 0 1-14-14z" fill="var(--accent)"/><path d="M122 64h6a7 7 0 0 1 0 14h-6" fill="none" stroke="var(--accent)" stroke-width="4"/>' +
      '<path d="M46 50c-4-6 4-10 0-16M58 50c-4-6 4-10 0-16M102 50c-4-6 4-10 0-16M114 50c-4-6 4-10 0-16" stroke="var(--muted)" stroke-width="2.4" fill="none" stroke-linecap="round" opacity=".7"/></svg>';
  }
  function svgPohonBunga() { return pohon({ daun: 40, cabang: 6, bunga: 14 }, 'cj-ill'); }
  // pohon kalian: daun = hari berdua mengisi, cabang = check-in mingguan, bunga = review bulanan
  var CABANG = [[150, 150, 112, 118], [150, 140, 190, 108], [150, 126, 104, 92], [150, 120, 200, 84], [150, 108, 122, 70], [150, 104, 182, 64], [150, 160, 96, 140], [150, 158, 206, 134], [150, 96, 150, 56]];
  function pohon(g, cls) {
    var nC = Math.min(g.cabang, CABANG.length), nD = Math.min(g.daun, 120), nB = Math.min(g.bunga, 30);
    var seed = 7; function rnd() { seed = (seed * 9301 + 49297) % 233280; return seed / 233280; }
    var ujung = [[150, 96]].concat(CABANG.slice(0, nC).map(function (c) { return [c[2], c[3]]; }));
    var s = '<svg class="' + (cls || 'cj-tree') + '" viewBox="0 0 300 220" role="img" aria-label="Pohon kalian: ' + g.daun + ' daun, ' + g.cabang + ' cabang, ' + g.bunga + ' bunga">';
    s += '<ellipse cx="150" cy="206" rx="110" ry="9" fill="var(--line)"/>';
    s += '<path d="M141 206 C144 170 145 130 147 92 L153 92 C155 130 156 170 159 206 Z" fill="#9A6F4C"/>';
    CABANG.slice(0, nC).forEach(function (c) {
      s += '<path d="M' + c[0] + ' ' + c[1] + ' Q' + ((c[0] + c[2]) / 2) + ' ' + (c[1] - 6) + ' ' + c[2] + ' ' + c[3] + '" stroke="#9A6F4C" stroke-width="5" fill="none" stroke-linecap="round"/>';
    });
    var posDaun = [];
    for (var i = 0; i < nD; i++) {
      var u = ujung[i % ujung.length], r = 6 + rnd() * (14 + Math.min(nD, 60) / 4), a = rnd() * Math.PI * 2;
      var x = u[0] + Math.cos(a) * r, y = u[1] + Math.sin(a) * r * 0.8, rot = Math.round(rnd() * 360);
      posDaun.push([x, y]);
      s += '<ellipse cx="' + x.toFixed(1) + '" cy="' + y.toFixed(1) + '" rx="7.5" ry="4.2" transform="rotate(' + rot + ' ' + x.toFixed(1) + ' ' + y.toFixed(1) + ')" fill="' + (i % 3 ? 'var(--m4)' : 'var(--m5)') + '"/>';
    }
    s += '<path d="M150 92c-10 0-16-7-16-16 10 0 16 7 16 16zM150 88c0-10 7-16 17-16 0 10-7 16-17 16z" fill="var(--m4)"/>';
    for (var k = 0; k < nB && posDaun.length; k++) {
      var p = posDaun[Math.floor(rnd() * posDaun.length)];
      s += '<g transform="translate(' + p[0].toFixed(1) + ' ' + p[1].toFixed(1) + ')"><circle r="4.2" fill="#F5A9C4"/><circle r="1.8" fill="#F4CF4C"/></g>';
    }
    return s + '</svg>';
  }

  // ================= komponen =================
  function skalaHtml(q, nilai, nama, opt) {
    opt = opt || {};
    var dis = opt.preview ? '' : '';
    if (q.skala === 'frekuensi') {
      return '<div class="cj-scale f5" role="radiogroup" aria-label="' + esc(opt.label || q.teks) + '">' + J.SKALA.frekuensi.map(function (o) {
        return '<button type="button" role="radio" class="cj-opt" data-cj="pilih" data-cj-q="' + q.id + '" data-cj-grup="' + nama + '" data-cj-v="' + o.v + '" aria-checked="' + (nilai === o.v) + '" title="' + esc(o.arti) + '"' + dis + '>' +
          '<span class="em" aria-hidden="true">' + MOON[o.v] + '</span><span>' + o.label + '</span></button>';
      }).join('') + '</div>';
    }
    var opsi = J.SKALA.kejadian.filter(function (o) { return !q.topik || o.v !== 'belum'; });
    return '<div class="cj-scale f' + opsi.length + '" role="radiogroup" aria-label="' + esc(opt.label || q.teks) + '">' + opsi.map(function (o) {
      return '<button type="button" role="radio" class="cj-opt" data-cj="pilih" data-cj-q="' + q.id + '" data-cj-grup="' + nama + '" data-cj-v="' + o.v + '" aria-checked="' + (nilai === o.v) + '" title="' + esc(o.arti) + '">' +
        '<span class="em" aria-hidden="true">' + KEJ[o.v] + '</span><span>' + (q.topik && o.v === 'tidak' ? 'Tidak ada' : o.label) + '</span></button>';
    }).join('') + '</div>';
  }
  function lencanaJenis(q) {
    var b = [];
    if (q.wajib) b.push('<span class="cj-badge">Wajib</span>');
    b.push('<span class="cj-badge soft">' + (q.jenis === 'bersama' ? 'Bersama' : 'Personal') + '</span>');
    if (q.privat) b.push('<span class="cj-badge lock">🔒 Privat</span>');
    return b.join('');
  }
  // satu kartu pertanyaan. grup = 'jawaban' | 'observer'
  function kartuPertanyaan(q, f, grup, opt) {
    opt = opt || {};
    var a = (f[grup] || {})[q.id] || {}, buka = f.buka[grup + q.id] || !!a.c;
    var teks = opt.teks || q.teks;
    var h = '<div class="card cj-q' + (q.privat ? ' privat' : '') + '"><div class="cj-qh"><h3>' + esc(teks) + '</h3><div class="cj-badges">' + (opt.badge || lencanaJenis(q)) + '</div></div>';
    if (opt.sub) h += '<p class="small muted">' + opt.sub + '</p>';
    h += skalaHtml(q, a.n, grup, { label: teks });
    if (q.topik) {
      if (a.n === 'ya') h += '<label class="small muted" for="cj-c-' + grup + q.id + '">Apa yang ingin dibahas? <b>Masuk antrian topik check-in dan terlihat oleh pasangan.</b></label>' +
        '<textarea id="cj-c-' + grup + q.id + '" class="cj-note" data-cj-note="' + q.id + '" data-cj-grup="' + grup + '" maxlength="' + J.CATATAN_MAKS + '" placeholder="Contoh: rencana mudik akhir tahun">' + esc(a.c || '') + '</textarea>' + hitung(a.c);
    } else if (q.catatan) {
      if (buka) h += '<textarea id="cj-c-' + grup + q.id + '" class="cj-note" aria-label="Catatan untuk ' + esc(teks) + '" data-cj-note="' + q.id + '" data-cj-grup="' + grup + '" maxlength="' + J.CATATAN_MAKS + '" placeholder="Catatan singkat (opsional)">' + esc(a.c || '') + '</textarea>' + hitung(a.c);
      else h += '<button type="button" class="cj-link" data-cj="buka-catatan" data-cj-q="' + q.id + '" data-cj-grup="' + grup + '">+ Catatan</button>';
    }
    return h + '</div>';
  }
  function hitung(t) { var n = (t || '').length; return '<span class="cj-count small muted" aria-live="polite">' + n + '/' + J.CATATAN_MAKS + '</span>'; }
  function judulLayar(judul, sub, kembali) {
    return '<div class="cj-top"><button type="button" class="btn ghost sm" data-cj="ke" data-cj-v="' + (kembali || 'home') + '">‹ Kembali</button></div>' +
      '<div><h1 class="cj-h1">' + judul + '</h1>' + (sub ? '<p class="muted small">' + sub + '</p>' : '') + '</div>';
  }
  function stepper(daftar, aktif) {
    return '<ol class="cj-steps" aria-label="Langkah">' + daftar.map(function (s, i) {
      var idx = daftar.indexOf(aktif);
      return '<li class="' + (s === aktif ? 'on' : i < idx ? 'done' : '') + '"' + (s === aktif ? ' aria-current="step"' : '') + '>' + s + '</li>';
    }).join('') + '</ol>';
  }

  // ================= layar =================
  function gambar() {
    if (!VIEW || !VIEW.isConnected || !document.querySelector('.cj-root, .cj-boot')) return;
    var html;
    if (!V) html = S.memuat ? '<p class="muted">Memuat Couple Journaling…</p>' : '<div class="card"><h3>Belum bisa memuat</h3><p class="muted small">' + esc(S.err === 'offline' ? 'Sedang offline. Couple Journaling perlu tersambung sekali dulu.' : S.err) + '</p><button type="button" class="btn" data-cj="muat">Coba lagi</button></div>';
    else if (!V.aktif) html = layarSetuju();
    else if (S.scr === 'home' && perluOnboard()) html = layarOnboard();
    else html = ({ home: layarHome, harian: layarHarian, mingguan: layarMingguan, bulanan: layarBulanan, atur: layarAtur, preview: layarPreview,
      fondasi: layarFondasi, ekspor: layarEkspor, bantuan: layarBantuan, privasi: layarPrivasi }[S.scr] || layarHome)();
    VIEW.innerHTML = '<div class="cj-root">' + demoBar() + html + '</div>' + (S.pesan ? pesanHtml(S.pesan) : '');
    if (S.atas) { VIEW.scrollTop = 0; S.atas = false; }
    if (S.fokus) { var f = VIEW.querySelector(S.fokus); if (f) f.focus(); S.fokus = null; }
    timer();
  }
  function demoBar() {
    if (REMOTE) return '';
    var u = demoUser();
    return '<div class="cj-demo"><span class="small">Mode demo · lihat sebagai</span><div class="chips">' +
      [['riki', 'Riki'], ['istri', 'Febie']].map(function (x) { return '<button type="button" class="chip" data-cj="demo-as" data-cj-v="' + x[0] + '" aria-pressed="' + (u.id === x[0]) + '">' + x[1] + '</button>'; }).join('') + '</div></div>';
  }

  function layarSetuju() {
    var m = V.saya, p = V.pasangan;
    var stat = function (nama, ok) { return '<li><span class="cj-dot ' + (ok ? 'ok' : '') + '" aria-hidden="true"></span>' + esc(nama) + ': ' + (ok ? 'sudah setuju' : 'belum') + '</li>'; };
    return '<div class="hero">' + (window.ilus ? ilus('onboarding-05-daily-mood', 'lg') : '') + '<h2>Couple Journaling</h2>' +
      '<p class="muted">Ritme refleksi berdua: harian ±30 detik, check-in mingguan 30 menit, review bulanan. Hasilnya jadi bahan fokus bulan berikutnya, <b>bukan vonis</b>.</p></div>' +
      '<div class="card"><h3>Cara kerjanya</h3><ul class="cj-list">' +
      '<li>Tanpa persentase. Semua memakai kategori (Selalu … Tidak dilakukan).</li>' +
      '<li>Target personal dinilai dua sisi: dirimu dan pasangan sebagai observer, lalu dibandingkan tanpa mencari siapa yang salah.</li>' +
      '<li>Isian harian privat sampai kamu membagikannya saat check-in. Item kesehatan selalu privat.</li>' +
      '<li>Mood dari Daily Mood privat, kecuali kamu memilih membagikannya.</li></ul></div>' +
      '<div class="card"><h3>Aktif kalau kalian berdua setuju</h3><ul class="cj-status">' + stat(m.nama + ' (kamu)', !!m.setuju) + stat(p.nama, !!p.setuju) + '</ul>' +
      (!p.ada ? '<p class="small muted">Belum ada akun pasangan. Minta admin membuatkan akun dulu.</p>' :
        m.setuju ? '<p class="small muted">Menunggu ' + esc(p.nama) + ' menyetujui dari HP-nya (Daily Mood › Berdua).</p><button type="button" class="btn ghost wide" data-cj="setuju" data-cj-v="0">Batalkan persetujuanku</button>'
          : '<button type="button" class="btn wide" data-cj="setuju" data-cj-v="1">Saya setuju, aktifkan</button>') + '</div>';
  }

  function perluOnboard() {
    var t = targets()[me().id];
    return !(t && t.t1 && t.t1.teks) || !ls('cj-onb-' + me().id, false);
  }
  function layarOnboard() {
    var step = S.onb || 0, f = V.fondasi || {}, t = targets()[me().id] || {}, tp = targets()[ps().id] || {};
    var head = '<div><span class="tag">Persiapan · ' + (step + 1) + ' dari 3</span></div>';
    if (step === 0) {
      var misi = (f.misi && f.misi.length ? f.misi : ['', '', '']);
      return head + '<div><h1 class="cj-h1">Fondasi keluarga</h1><p class="muted small">Diisi bersama, bisa diubah kapan saja. ' + (f.visi ? 'Sudah diisi ' + esc(namaDari(V.atur_oleh)) + ', cek lagi kalau perlu.' : 'Opsional, tapi membantu memberi arah.') + '</p></div>' +
        '<div class="card"><label for="cj-tujuan"><h3>Tujuan</h3></label><input type="text" id="cj-tujuan" maxlength="200" value="' + esc(f.tujuan) + '" placeholder="Contoh: tenang dan damai menjalani hidup masing-masing">' +
        '<label for="cj-visi"><h3>Visi</h3></label><input type="text" id="cj-visi" maxlength="200" value="' + esc(f.visi) + '" placeholder="Contoh: keluarga samawa">' +
        '<h3>Misi</h3>' + misi.map(function (x, i) { return '<input type="text" class="cj-misi" aria-label="Misi ' + (i + 1) + '" maxlength="200" value="' + esc(x) + '" placeholder="' + ['Domain keahlian untuk bertumbuh & saling menginspirasi', 'Komunikasi terbuka yang rutin', 'Peran yang saling melengkapi & berkeadilan'][i % 3] + '">'; }).join('') +
        '<button type="button" class="cj-link" data-cj="tambah-misi">+ Misi</button></div>' +
        '<div class="row"><button type="button" class="btn ghost" data-cj="onb-lewat">Lewati</button><button type="button" class="btn" style="flex:1" data-cj="onb-fondasi">Simpan & lanjut</button></div>';
    }
    if (step === 1) {
      return head + '<div><h1 class="cj-h1">Target pengembangan dirimu</h1><p class="muted small">Pilih 1–2 hal yang ingin kamu latih. ' + esc(ps().nama) + ' akan diundang menjadi observer: ikut menilai tiap minggu, lalu dibandingkan dengan penilaianmu.</p></div>' +
        '<div class="card"><label for="cj-t1"><h3>Target 1 <span class="cj-badge">Wajib</span></h3></label><input type="text" id="cj-t1" maxlength="120" value="' + esc(t.t1 ? t.t1.teks : '') + '" placeholder="Contoh: mendengar sampai selesai sebelum menanggapi">' +
        '<label for="cj-t2"><h3>Target 2 <span class="cj-badge soft">Opsional</span></h3></label><input type="text" id="cj-t2" maxlength="120" value="' + esc(t.t2 ? t.t2.teks : '') + '" placeholder="Contoh: tidur sebelum jam 23"></div>' +
        (tp.t1 ? '<div class="card"><h3>Target ' + esc(ps().nama) + '</h3><p class="small">' + esc(tp.t1.teks) + (tp.t2 ? '<br>' + esc(tp.t2.teks) : '') + '</p><p class="small muted">Kamu menjadi observer untuk target ini.</p></div>' : '') +
        '<div class="row"><button type="button" class="btn ghost" data-cj="onb-ke" data-cj-v="0">Kembali</button><button type="button" class="btn" style="flex:1" data-cj="onb-target">Simpan & lanjut</button></div>';
    }
    var set = sets()[sets().length - 1], opsional = ((V.draft ? V.draft.pertanyaan : set.pertanyaan) || []).filter(function (q) { return !q.wajib && q.bawaan && q.skala !== 'otomatis' && q.sumber !== 'target2'; });
    var pilih = S.onbPilih || (S.onbPilih = opsional.reduce(function (m, q) { m[q.id] = q.tampil; return m; }, {}));
    return head + '<div><h1 class="cj-h1">Hari check-in & item opsional</h1><p class="muted small">Check-in mingguan 30 menit di hari yang sama tiap minggu.</p></div>' +
      '<div class="card"><h3>Hari check-in</h3><div class="chips">' + [1, 2, 3, 4, 5, 6, 0].map(function (d) { return '<button type="button" class="chip" data-cj="hari" data-cj-v="' + d + '" aria-pressed="' + (V.hari === d) + '">' + HARI[d] + '</button>'; }).join('') + '</div></div>' +
      '<div class="card"><h3>Item opsional</h3><p class="small muted">Wajib: harian 3 tap, mingguan 4, bulanan 2. Tambahkan yang relevan saja. Perubahan item Bersama perlu disetujui ' + esc(ps().nama) + '.</p>' +
      ['harian', 'mingguan', 'bulanan'].map(function (p) {
        return '<p class="tag">' + p + '</p>' + opsional.filter(function (q) { return q.periode === p; }).map(function (q) {
          return '<label class="chk"><input type="checkbox" data-cj-chk="' + q.id + '"' + (pilih[q.id] ? ' checked' : '') + '><span><b>' + esc(q.teks) + '</b><br><span class="small muted">' + (q.jenis === 'personal' ? 'Personal' : 'Bersama') + (q.privat ? ' · privat' : '') + '</span></span></label>';
        }).join('');
      }).join('') + '</div>' +
      '<div class="row"><button type="button" class="btn ghost" data-cj="onb-ke" data-cj-v="1">Kembali</button><button type="button" class="btn" style="flex:1" data-cj="onb-selesai">Selesai</button></div>';
  }

  function layarHome() {
    var today = hariIni(), w = mingguIni(), g = pertumbuhan(), sk = streak(), mi = isian(me().id, 'H:' + today), pi = isian(ps().id, 'H:' + today);
    var h = '';
    if (V.draft && V.draft.oleh !== me().id && V.draft.perlu_setuju && !V.draft.setuju_oleh)
      h += '<button type="button" class="card cj-alert" data-cj="ke" data-cj-v="atur"><b>' + esc(ps().nama) + ' mengusulkan perubahan pertanyaan</b><span class="small muted">Lihat preview lalu setujui atau diskusikan dulu ›</span></button>';
    if (pi && pi.terisi && !(mi && mi.terisi)) h += '<div class="card cj-nudge">' + pohon(g, 'cj-mini') + '<p><b>Pasanganmu sudah mengisi.</b> Giliranmu melengkapi pohon kalian 🌳</p></div>';
    h += '<div class="card cj-treecard">' + pohon(g) + '<div class="row between"><span class="small muted">🍃 ' + g.daun + ' daun · 🌿 ' + g.cabang + ' cabang · 🌸 ' + g.bunga + ' bunga</span>' +
      '<span class="cj-streak small">' + (sk ? sk + ' minggu berturut-turut' : 'Mulai minggu ini') + '</span></div>' +
      '<p class="small muted">Daun tumbuh saat kalian berdua mengisi harian, cabang dari check-in mingguan, bunga dari review bulanan. Terlewat sehari tidak mereset apa pun.</p></div>';
    // harian
    h += '<div class="card"><div class="row between"><h3>Evaluasi harian</h3><span class="small muted">±30 detik</span></div>' +
      '<p class="small">' + (mi && mi.terisi ? '✓ Sudah diisi' + (mi.antre ? ' · menunggu koneksi' : '') : 'Belum diisi malam ini') + ' · ' + esc(ps().nama) + ': ' + (pi && pi.terisi ? 'sudah mengisi' : 'belum') + '</p>' +
      '<button type="button" class="btn ' + (mi && mi.terisi ? 'ghost ' : '') + 'wide" data-cj="buka-harian">' + (mi && mi.terisi ? 'Ubah isian hari ini' : 'Isi sekarang') + '</button></div>';
    // mingguan
    var s = sesi(w), q = antrianTopik(w);
    h += '<div class="card"><div class="row between"><h3>Check-in mingguan</h3><span class="small muted">' + HARI[V.hari] + ' · 30 menit</span></div>' +
      '<p class="small">' + (s && s.selesai_at ? '✓ Terlaksana minggu ini (' + s.durasi + ' menit)' : s ? 'Sedang berjalan' : (new Date().getDay() === V.hari ? 'Hari ini jadwalnya' : 'Jadwal: ' + HARI[V.hari])) + ' · ' + q.length + ' topik di antrian</p>' +
      (q.length ? '<ul class="cj-topiklist small">' + q.slice(0, 3).map(function (t) { return '<li>' + esc(t.judul) + '</li>'; }).join('') + (q.length > 3 ? '<li class="muted">+' + (q.length - 3) + ' lagi</li>' : '') + '</ul>' : '') +
      '<div class="row"><button type="button" class="btn ' + (s && s.selesai_at ? 'ghost ' : '') + '" style="flex:1" data-cj="buka-mingguan">' + (s && s.selesai_at ? 'Lihat ringkasan' : s ? 'Lanjutkan' : 'Mulai check-in') + '</button>' +
      '<button type="button" class="btn ghost" data-cj="tambah-topik-home">+ Topik</button></div>' +
      (S.topikBaru ? formTopikBaru() : '') + '</div>';
    // bulanan
    var mb = bulanTarget(), rb = (V.bulanan || []).filter(function (b) { return b.bulan === mb; })[0];
    h += '<div class="card"><div class="row between"><h3>Review bulanan</h3><span class="small muted">±60 menit</span></div>' +
      '<p class="small">' + fmtBulan(mb) + ': ' + (rb && rb.selesai_at ? '✓ Selesai' : 'belum') + '</p>' +
      '<button type="button" class="btn ghost wide" data-cj="buka-bulanan">' + (rb && rb.selesai_at ? 'Lihat hasil' : 'Mulai review ' + BULAN[+mb.slice(5) - 1]) + '</button></div>';
    h += kartuTren();
    h += '<div class="card"><h3>Lencana proses</h3><div class="cj-badgegrid">' + lencana().map(function (b) {
      var ok = b.n >= b.target;
      return '<div class="cj-lencana' + (ok ? ' ok' : '') + '"><span class="ic" aria-hidden="true">' + b.ikon + '</span><b>' + b.nama + '</b><span class="small muted">' + b.ket + '</span>' +
        '<span class="cj-prog" role="progressbar" aria-valuemin="0" aria-valuemax="' + b.target + '" aria-valuenow="' + Math.min(b.n, b.target) + '" aria-label="' + b.nama + '"><i style="width:' + Math.min(100, Math.round(b.n / b.target * 100)) + '%"></i></span>' +
        '<span class="small muted">' + Math.min(b.n, b.target) + '/' + b.target + '</span></div>';
    }).join('') + '</div></div>';
    h += '<div class="card cj-menu">' +
      menuBaris('fondasi', 'Fondasi, target & hari check-in', 'Visi, misi, target personal') +
      menuBaris('atur', 'Atur pertanyaan', V.draft ? 'Ada draft' + (V.draft.perlu_setuju && !V.draft.setuju_oleh ? ' · menunggu persetujuan' : '') : 'Tampilkan, ubah, tambah') +
      menuBaris('ekspor', 'Ekspor ringkasan', 'PDF/teks untuk konselor') +
      menuBaris('privasi', 'Privasi & data', 'Apa yang terlihat pasangan') +
      menuBaris('bantuan', 'Butuh bantuan?', 'Konselor & layanan krisis') + '</div>';
    return h;
  }
  function menuBaris(scr, judul, ket) { return '<button type="button" class="cj-mrow" data-cj="ke" data-cj-v="' + scr + '"><span><b>' + judul + '</b><span class="small muted">' + ket + '</span></span><span aria-hidden="true">›</span></button>'; }
  function bulanTarget() {
    var today = hariIni(), m = today.slice(0, 7), lalu = J.bulanGeser(m, -1);
    var rb = (V.bulanan || []).filter(function (b) { return b.bulan === lalu; })[0];
    return +today.slice(8) <= 7 && !(rb && rb.selesai_at) ? lalu : m;
  }
  function formTopikBaru() {
    return '<div class="cj-inline"><label for="cj-topik" class="small muted">Topik untuk check-in (terlihat oleh pasangan)</label><input type="text" id="cj-topik" maxlength="160" placeholder="Contoh: pembagian tugas pagi">' +
      '<div class="row"><button type="button" class="btn ghost sm" data-cj="topik-batal">Batal</button><button type="button" class="btn sm" data-cj="topik-simpan">Tambah ke antrian</button></div></div>';
  }
  // tren mingguan: 8 minggu terakhir, kategori per orang (bukan skor), minggu berat ditandai
  function kartuTren() {
    var minggu = []; for (var i = 7; i >= 0; i--) minggu.push(J.mingguGeser(mingguIni(), -i));
    var ada = minggu.some(function (w) { return isian(me().id, 'M:' + w) || isian(ps().id, 'M:' + w); });
    if (!ada) return '<div class="card"><h3>Tren mingguan</h3><p class="small muted">Muncul setelah evaluasi mingguan pertama. Harian tidak ditampilkan sebagai skor, hanya jadi bahan check-in.</p></div>';
    var set = setAktif('mingguan', mingguIni()), qs = ((set && set.pertanyaan) || []).filter(function (q) { return q.periode === 'mingguan' && q.tampil && q.jenis === 'bersama' && q.skala === 'frekuensi'; });
    var berat = minggu.map(function (w) { var a = isian(me().id, 'M:' + w), b = isian(ps().id, 'M:' + w); return !!((a && a.berat) || (b && b.berat)); });
    var kepala = '<div class="cj-trow head"><span></span>' + minggu.map(function (w, i) { return '<span title="' + fmtMinggu(w) + '">' + (berat[i] ? '⚑' : fmtPendek(J.senin(w)).split(' ')[0]) + '</span>'; }).join('') + '</div>';
    var baris = qs.map(function (q) {
      return '<div class="cj-trow"><span class="small">' + esc(q.teks) + '</span>' + minggu.map(function (w) {
        var a = isian(me().id, 'M:' + w), b = isian(ps().id, 'M:' + w), na = a && a.jawaban && a.jawaban[q.id], nb = b && b.jawaban && b.jawaban[q.id];
        var lbl = me().nama + ': ' + (na ? J.labelNilai(q, na.n) : '-') + ', ' + ps().nama + ': ' + (nb ? J.labelNilai(q, nb.n) : '-');
        return '<span class="cj-cell" title="' + esc(fmtMinggu(w) + ' · ' + lbl) + '" aria-label="' + esc(fmtMinggu(w) + ' · ' + lbl) + '"><i style="--lv:' + (na ? na.n : -1) + '"></i><i style="--lv:' + (nb ? nb.n : -1) + '"></i></span>';
      }).join('') + '</div>';
    }).join('');
    return '<div class="card"><h3>Tren mingguan</h3><p class="small muted">Tiap kotak: kiri ' + esc(me().nama) + ', kanan ' + esc(ps().nama) + '. Makin pekat = makin sering dilakukan. ⚑ = minggu dengan kondisi berat (baca dalam konteks).</p>' +
      '<div class="cj-tren">' + kepala + baris + '</div><div class="cj-legend small muted">' + [0, 1, 2, 3, 4].map(function (v) { return '<span><i style="--lv:' + v + '"></i>' + J.SKALA.frekuensi[4 - v].label + '</span>'; }).join('') + '</div></div>';
  }

  // ---------- formulir isian (harian / mingguan / bulanan) ----------
  function siapkanForm(kunci, periode) {
    if (S.form && S.form.kunci === kunci) return S.form;
    var ex = isian(me().id, kunci);
    S.form = { kunci: kunci, periode: periode, jawaban: salin((ex && ex.jawaban) || {}), observer: salin((ex && ex.observer) || {}), buka: {} };
    return S.form;
  }
  function daftarForm(periode, nilai, setOverride) {
    var set = setOverride || setAktif(periode, nilai);
    return { set: set, items: J.item(set, periode, me().id, targets()), obs: J.itemObserver(set, periode, ps().id, targets()) };
  }
  function isiFormHtml(periode, nilai, f, setOverride) {
    var d = daftarForm(periode, nilai, setOverride), h = '';
    d.items.forEach(function (q) {
      if (q.sumber === 'mood') {
        var md = moodHariIni(nilai);
        h += '<div class="card cj-q"><div class="cj-qh"><h3>' + esc(q.teks) + '</h3><div class="cj-badges"><span class="cj-badge soft">Otomatis</span>' + (me().bagikan_mood ? '' : '<span class="cj-badge lock">🔒 Privat</span>') + '</div></div>' +
          '<p class="small">' + (md ? 'Dari Daily Mood: <b>' + MOOD_LABEL[md] + '</b>' : 'Belum ada mood di Daily Mood hari ini (opsional, isi di tab Hari ini).') + '</p>' +
          '<p class="small muted">' + (me().bagikan_mood ? 'Dibagikan ke ' + esc(ps().nama) + ' bersama isian harianmu.' : 'Hanya kamu yang melihat. Ubah di Privasi & data.') + '</p></div>';
        return;
      }
      if (q.skala === 'otomatis') return;
      h += kartuPertanyaan(q, f, 'jawaban', { teks: J.teksItem(q, targets(), me().id), sub: q.sumber ? 'Target pengembangan dirimu · nilai seberapa sering kamu menjalankannya' : '' });
    });
    if (d.obs.length) {
      h += '<div class="cj-sec"><h2>Sebagai observer</h2><p class="small muted">Nilai target ' + esc(ps().nama) + ' dari yang kamu amati. Hasilnya dibandingkan dengan penilaian dirinya: selaras, hampir selaras, atau perlu dibicarakan.</p></div>';
      d.obs.forEach(function (q) {
        h += kartuPertanyaan(q, f, 'observer', { teks: J.teksItem(q, targets(), ps().id), badge: (q.wajib ? '<span class="cj-badge">Wajib</span>' : '') + '<span class="cj-badge soft">Target ' + esc(ps().nama) + '</span>' });
      });
    }
    return h;
  }
  function adaNilai(o) { return !!(o && o.n !== undefined && o.n !== null); }
  function hanyaTerjawab(m) { var o = {}; Object.keys(m || {}).forEach(function (k) { if (adaNilai(m[k])) o[k] = m[k].c ? { n: m[k].n, c: m[k].c.trim() } : { n: m[k].n }; }); return o; }
  function payloadForm(f, nilai, selesai) {
    var p = { kunci: f.kunci, jawaban: hanyaTerjawab(f.jawaban), observer: hanyaTerjawab(f.observer), selesai: !!selesai };
    if (f.periode === 'harian') p.mood = moodHariIni(nilai) || 0;
    return p;
  }
  function cekForm(f, nilai) {
    var d = daftarForm(f.periode, nilai);
    var kurang = d.items.filter(function (q) { return q.wajib && q.skala !== 'otomatis' && !adaNilai(f.jawaban[q.id]); })[0];
    if (kurang) return 'Lengkapi dulu: ' + J.teksItem(kurang, targets(), me().id);
    if (d.obs.some(function (q) { return q.wajib && !adaNilai(f.observer[q.id]); })) return 'Lengkapi dulu penilaianmu untuk target ' + ps().nama;
    var tq = d.items.filter(function (q) { return q.topik; })[0];
    if (tq && adaNilai(f.jawaban[tq.id]) && f.jawaban[tq.id].n === 'ya' && !(f.jawaban[tq.id].c || '').trim()) return 'Tulis singkat hal yang ingin dibahas';
    return '';
  }

  function layarHarian() {
    var nilai = S.tgl || hariIni(), f = siapkanForm('H:' + nilai, 'harian'), ex = isian(me().id, 'H:' + nilai);
    var pil = '<div class="chips">' + [0, 1, 2].map(function (n) { var d = isoLokal(new Date(Date.now() - n * 864e5)); var x = isian(me().id, 'H:' + d);
      return '<button type="button" class="chip" data-cj="tgl" data-cj-v="' + d + '" aria-pressed="' + (d === nilai) + '">' + (n === 0 ? 'Hari ini' : n === 1 ? 'Kemarin' : fmtPendek(d)) + (x && x.terisi ? ' ✓' : '') + '</button>'; }).join('') + '</div>';
    return judulLayar('Evaluasi harian', fmtTgl(nilai) + ' · ±30 detik · privat sampai kamu bagikan saat check-in') + pil +
      isiFormHtml('harian', nilai, f) +
      '<button type="button" class="btn wide" data-cj="simpan-harian">' + (ex && ex.terisi ? 'Simpan perubahan' : 'Simpan') + '</button>';
  }

  // ---------- check-in mingguan ----------
  var LANGKAH_M = ['Mulai', 'Topik', 'Evaluasi', 'Ringkasan'];
  function layarMingguan() {
    var w = S.w || mingguIni(), s = sesi(w);
    if (!S.mstep) S.mstep = s && s.selesai_at ? 'Ringkasan' : s ? 'Topik' : 'Mulai';
    var h = judulLayar('Check-in mingguan', fmtMinggu(w) + ' · 30 menit · satu topik per layar') + stepper(LANGKAH_M, S.mstep);
    if (s && !s.selesai_at) h += '<div class="cj-timer" id="cj-timer" aria-live="off" data-mulai="' + esc(s.mulai_at) + '"></div>';
    if (S.mstep === 'Mulai') h += mStepMulai(w, s);
    else if (S.mstep === 'Topik') h += mStepTopik(w);
    else if (S.mstep === 'Evaluasi') h += mStepEvaluasi(w);
    else h += mStepRingkasan(w, s);
    return h;
  }
  function rekapHarian(uid, w) {
    var set = setAktif('harian', J.hariDalam(w)[0]), qs = J.item(set, 'harian', uid, targets()).filter(function (q) { return q.skala !== 'otomatis' && !q.topik && !(uid !== me().id && q.privat); });
    var rows = J.hariDalam(w).map(function (d) { return isian(uid, 'H:' + d); }).filter(function (x) { return x && x.terisi; });
    if (!rows.length) return '<p class="small muted">Belum ada isian harian minggu ini.</p>';
    if (uid !== me().id && !rows.some(function (x) { return x.jawaban; })) return '<p class="small muted">' + rows.length + ' hari terisi · belum dibagikan.</p>';
    return '<p class="small muted">' + rows.length + ' dari 7 hari terisi</p>' + qs.map(function (q) {
      var c = {}; rows.forEach(function (x) { var a = x.jawaban && x.jawaban[q.id]; if (a) c[a.n] = (c[a.n] || 0) + 1; });
      var urut = q.skala === 'frekuensi' ? [4, 3, 2, 1, 0] : ['ya', 'tidak', 'belum'];
      var catatan = rows.map(function (x) { var a = x.jawaban && x.jawaban[q.id]; return a && a.c ? fmtPendek(x.nilai) + ': ' + a.c : ''; }).filter(Boolean);
      return '<div class="cj-rek"><span class="small">' + esc(q.teks) + '</span><span class="small">' + urut.filter(function (v) { return c[v]; }).map(function (v) {
        return '<span class="cj-pill" title="' + esc(J.labelNilai(q, v)) + '">' + (q.skala === 'frekuensi' ? MOON[v] : KEJ[v]) + '×' + c[v] + '</span>';
      }).join(' ') + '</span>' + (catatan.length ? '<span class="small muted">' + catatan.map(esc).join(' · ') + '</span>' : '') + '</div>';
    }).join('');
  }
  function mStepMulai(w, s) {
    var dibagi = J.hariDalam(w).some(function (d) { var x = isian(me().id, 'H:' + d); return x && x.dibagikan; });
    var bagi = S.bagi == null ? true : S.bagi;
    return '<div class="card"><h3>Sebelum mulai</h3><ul class="cj-list small"><li>Siapkan 30 menit tanpa gangguan. Timer hanya pengingat, bukan batas keras.</li><li>Satu topik tuntas sebelum ganti topik.</li>' +
      '<li>Yang menyampaikan: fakta → dampak → permintaan. Yang mendengar: rangkum ulang dulu sebelum merespons.</li></ul>' +
      (s ? '' : '<label class="switch"><input type="checkbox" id="cj-bagi"' + (bagi ? ' checked' : '') + '> Bagikan isian harianku minggu ini ke ' + esc(ps().nama) + ' (item privat tetap tersembunyi)</label>') +
      (s && !dibagi ? '<button type="button" class="btn ghost sm" data-cj="bagikan" data-cj-v="' + w + '">Bagikan isian harianku minggu ini</button>' : '') + '</div>' +
      (s ? '<div class="card"><h3>Isian harian minggu ini</h3><p class="tag">' + esc(me().nama) + '</p>' + rekapHarian(me().id, w) + '<p class="tag">' + esc(ps().nama) + '</p>' + rekapHarian(ps().id, w) + '</div>' : '') +
      '<button type="button" class="btn wide" data-cj="m-mulai" data-cj-v="' + w + '">' + (s ? 'Lanjut ke topik' : 'Mulai check-in · 30 menit') + '</button>';
  }
  function mStepTopik(w) {
    var q = antrianTopik(w), dibahas = (V.topik || []).filter(function (t) { return t.status === 'dibahas' && t.dibahas_minggu === w; });
    var idx = S.tIdx || 0, t = q[idx];
    var h = '';
    if (!t) {
      h += '<div class="card"><h3>' + (q.length ? 'Sisa topik ditunda ke minggu depan' : dibahas.length ? 'Semua topik minggu ini tuntas' : 'Antrian topik kosong') + '</h3><p class="small muted">' + (dibahas.length ? dibahas.length + ' topik dibahas.' : 'Tambahkan topik kalau ada yang ingin dibicarakan, atau lanjut ke evaluasi.') + '</p>' +
        '<button type="button" class="btn ghost sm" data-cj="tambah-topik-m">+ Tambah topik</button>' + (S.topikBaru ? formTopikBaru() : '') + '</div>';
      return h + '<button type="button" class="btn wide" data-cj="m-step" data-cj-v="Evaluasi">Lanjut ke evaluasi</button>';
    }
    var sub = S.tSub || 1, dari = t.sumber === 'selisih' ? 'Otomatis · persepsi diri vs pasangan berbeda ≥2 tingkat' : t.sumber === 'harian' ? 'Dari isian harian ' + esc(namaDari(t.dari)) + (t.tanggal ? ' · ' + fmtPendek(t.tanggal) : '') : 'Ditambahkan ' + esc(namaDari(t.dari));
    var penyampai = t.dari ? namaDari(t.dari) : 'Pemilik target';
    h += '<div class="card cj-topic"><span class="tag">Topik ' + (idx + 1) + ' dari ' + q.length + (t.status === 'ditunda' ? ' · ditunda sebelumnya' : '') + '</span><h2>' + esc(t.judul) + '</h2><p class="small muted">' + dari + '</p>' +
      '<ol class="cj-substeps"><li class="' + (sub === 1 ? 'on' : 'done') + '">Sampaikan</li><li class="' + (sub === 2 ? 'on' : sub > 2 ? 'done' : '') + '">Rangkum ulang</li><li class="' + (sub === 3 ? 'on' : '') + '">Tindak lanjut</li></ol></div>';
    function fld(nama, label, ph) { return '<label for="cj-f-' + nama + '"><h3>' + label + '</h3></label><textarea id="cj-f-' + nama + '" class="cj-note" data-cj-tf="' + nama + '" maxlength="' + J.CATATAN_MAKS + '" placeholder="' + ph + '">' + esc(t[nama] || '') + '</textarea>'; }
    if (sub === 1) h += '<div class="card"><p class="small muted">' + esc(penyampai) + ' menyampaikan dengan format fakta → dampak → permintaan.</p>' +
      fld('fakta', 'Fakta', 'Yang terjadi, tanpa menilai. Contoh: minggu ini tiga kali rencana makan malam batal') +
      fld('dampak', 'Dampak', 'Yang kurasakan. Contoh: aku merasa tidak diprioritaskan') +
      fld('permintaan', 'Permintaan', 'Yang konkret. Contoh: kabari paling lambat jam 5 kalau batal') + '</div>';
    else if (sub === 2) h += '<div class="card"><p class="small muted">Pendengar merangkum ulang dengan kata-katanya sendiri, sebelum merespons. Penyampai mengoreksi kalau kurang pas.</p>' +
      (t.fakta || t.dampak || t.permintaan ? '<div class="cj-quote small">' + [t.fakta, t.dampak, t.permintaan].filter(Boolean).map(esc).join(' → ') + '</div>' : '') +
      fld('rangkum', 'Rangkuman pendengar', 'Jadi yang kamu rasakan … dan kamu minta …') + '</div>';
    else h += '<div class="card">' + fld('tindakan', 'Tindak lanjut', 'Langkah konkret berikutnya') +
      '<h3>PIC (pemilik tindakan)</h3><div class="chips">' + [me().id, ps().id, 'berdua'].map(function (u) { return '<button type="button" class="chip" data-cj="pic" data-cj-v="' + u + '" aria-pressed="' + (t.pic === u) + '">' + esc(namaDari(u)) + '</button>'; }).join('') + '</div>' +
      '<label for="cj-tenggat"><h3>Tenggat <span class="cj-badge soft">Opsional</span></h3></label><input type="date" id="cj-tenggat" value="' + esc(t.tenggat || '') + '" min="' + hariIni() + '"></div>';
    h += '<div class="row">' + (sub > 1 ? '<button type="button" class="btn ghost" data-cj="t-sub" data-cj-v="' + (sub - 1) + '">Sebelumnya</button>' : '<button type="button" class="btn ghost" data-cj="t-tunda" data-cj-v="' + esc(t.id) + '">Tunda ke minggu depan</button>') +
      (sub < 3 ? '<button type="button" class="btn" style="flex:1" data-cj="t-sub" data-cj-v="' + (sub + 1) + '">Lanjut</button>' : '<button type="button" class="btn" style="flex:1" data-cj="t-tuntas" data-cj-v="' + esc(t.id) + '">Tuntas · topik berikutnya</button>') + '</div>';
    return h + '<button type="button" class="cj-link" data-cj="m-step" data-cj-v="Evaluasi">Lewati sisa topik, lanjut ke evaluasi ›</button>';
  }
  function mStepEvaluasi(w) {
    var f = siapkanForm('M:' + w, 'mingguan'), ex = isian(me().id, 'M:' + w);
    return '<p class="small muted">Diisi masing-masing di HP sendiri. ' + esc(ps().nama) + ' melihat jawabanmu setelah kamu menekan Selesai (item privat tidak).</p>' +
      isiFormHtml('mingguan', w, f) +
      '<button type="button" class="btn wide" data-cj="simpan-mingguan" data-cj-v="' + w + '">' + (ex && ex.terisi ? 'Simpan perubahan' : 'Selesai evaluasi') + '</button>';
  }
  function kartuBanding(list) {
    if (!list.length) return '';
    return list.map(function (b) {
      var k = J.KESIMPULAN[b.hasil];
      return '<div class="cj-band ' + b.hasil + '"><div class="row between"><b class="small">' + esc(namaDari(b.pemilik)) + ': ' + esc(b.teks) + '</b><span class="cj-chip-h">' + k.label + '</span></div>' +
        '<span class="small muted">Diri: ' + J.SKALA.frekuensi[4 - b.diri].label + ' · Pasangan: ' + J.SKALA.frekuensi[4 - b.pasangan].label + ' → ' + k.lanjut + '</span></div>';
    }).join('');
  }
  function mStepRingkasan(w, s) {
    var a = isian(me().id, 'M:' + w), b = isian(ps().id, 'M:' + w), set = setAktif('mingguan', w), map = {};
    map[me().id] = a; map[ps().id] = b;
    var band = a && a.terisi && b && b.terisi ? J.banding(set, 'mingguan', map, [me().id, ps().id], targets()) : [];
    var dibahas = (V.topik || []).filter(function (t) { return t.status === 'dibahas' && t.dibahas_minggu === w; });
    var h = '<div class="card"><h3>Diri vs pasangan</h3>' + (band.length ? kartuBanding(band) + '<p class="small muted">"Perlu dibicarakan" otomatis masuk agenda check-in minggu depan.</p>'
      : '<p class="small muted">' + (!(a && a.terisi) ? 'Selesaikan evaluasimu dulu.' : 'Menunggu ' + esc(ps().nama) + ' menyelesaikan evaluasinya.') + '</p><button type="button" class="btn ghost sm" data-cj="muat">Muat ulang</button>') + '</div>';
    h += '<div class="card"><h3>Tindak lanjut minggu ini</h3>' + (dibahas.length ? '<ul class="cj-list small">' + dibahas.map(function (t) {
      return '<li><b>' + esc(t.tindakan) + '</b> · PIC ' + esc(namaDari(t.pic)) + (t.tenggat ? ' · ' + fmtPendek(t.tenggat) : '') + '<br><span class="muted">' + esc(t.judul) + '</span></li>'; }).join('') + '</ul>' : '<p class="small muted">Belum ada topik yang dibahas.</p>') + '</div>';
    if (s && s.selesai_at) return h + '<p class="small muted">✓ Check-in tercatat · ' + s.durasi + ' menit.</p>';
    return h + '<button type="button" class="btn wide" data-cj="m-selesai" data-cj-v="' + w + '">Selesaikan check-in</button>';
  }

  // ---------- review bulanan ----------
  var LANGKAH_B = ['Isi', 'Rekap', 'Keputusan'];
  function layarBulanan() {
    var m = S.m || bulanTarget(), rb = (V.bulanan || []).filter(function (b) { return b.bulan === m; })[0];
    if (!S.bstep) S.bstep = rb && rb.selesai_at ? 'Keputusan' : isian(me().id, 'B:' + m) && isian(me().id, 'B:' + m).terisi ? 'Rekap' : 'Isi';
    var h = judulLayar('Review bulanan', fmtBulan(m) + ' · ±60 menit · hasilnya fokus bulan depan, bukan vonis') + stepper(LANGKAH_B, S.bstep);
    if (S.bstep === 'Isi') {
      var f = siapkanForm('B:' + m, 'bulanan');
      h += isiFormHtml('bulanan', m, f) + '<button type="button" class="btn wide" data-cj="simpan-bulanan" data-cj-v="' + m + '">Simpan & lihat rekap</button>';
    } else if (S.bstep === 'Rekap') h += bRekap(m);
    else h += bKeputusan(m, rb);
    return h;
  }
  function bRekap(m) {
    var ws = J.mingguDalamBulan(m), sesiOk = ws.filter(function (w) { var s = sesi(w); return s && s.selesai_at; }).length;
    var tren = trenBulan(m), lalu = trenBulan(J.bulanGeser(m, -1)), rek = rekapTarget(m);
    var berat = ws.filter(function (w) { var a = isian(me().id, 'M:' + w), b = isian(ps().id, 'M:' + w); return (a && a.berat) || (b && b.berat); });
    var dib = (V.topik || []).filter(function (t) { return t.status === 'dibahas' && t.dibahas_minggu && J.bulanDariMinggu(t.dibahas_minggu) === m; }).length;
    var h = '<div class="card"><div class="stats"><div class="stat"><span class="small muted">Check-in</span><b>' + sesiOk + '/' + ws.length + '</b><span class="small muted">minggu</span></div>' +
      '<div class="stat"><span class="small muted">Topik dibahas</span><b>' + dib + '</b></div><div class="stat"><span class="small muted">Minggu berat</span><b>' + berat.length + '</b></div></div>' +
      (berat.length ? '<p class="small muted">⚑ ' + berat.map(fmtMinggu).join(', ') + ': ada kondisi berat, baca angka minggu itu dalam konteks.</p>' : '') + '</div>';
    h += '<div class="card"><h3>Rekap target personal</h3>' + (rek.length ? kartuBanding(rek) : '<p class="small muted">Belum ada pasangan penilaian diri + observer bulan ini.</p>') + '</div>';
    var ids = Object.keys(tren);
    h += '<div class="card"><h3>Tren kategori (berdua)</h3>' + (ids.length ? ids.map(function (id) {
      var x = tren[id], l = lalu[id], lv = Math.round(x.rata), arah = l ? (x.rata - l.rata > 0.4 ? '↑ membaik' : l.rata - x.rata > 0.4 ? '↓ menurun' : '→ stabil') : '';
      return '<div class="cj-rek"><span class="small">' + esc(x.q.teks) + '</span><span class="small"><span class="cj-pill">' + MOON[lv] + ' ' + J.SKALA.frekuensi[4 - lv].label + '</span> <span class="muted">' + arah + '</span></span></div>';
    }).join('') : '<p class="small muted">Belum ada data mingguan/bulanan bulan ini.</p>') + '<p class="small muted">Kategori terdekat dari rata-rata kalian berdua, bukan persentase.</p></div>';
    return h + '<button type="button" class="btn wide" data-cj="b-step" data-cj-v="Keputusan">Lanjut ke keputusan</button>';
  }
  function bKeputusan(m, rb) {
    var sar = saranBulan(m), o = S.bform || (S.bform = rb ? salin({ membaik: rb.membaik || [], fokus: rb.fokus || [], target: rb.target || {}, konselor: rb.konselor || '', catatan: rb.catatan || '' })
      : { membaik: sar.membaik.slice(0, 2), fokus: sar.fokus.slice(0, 1), target: {}, konselor: '', catatan: '' });
    var nPerlu = rekapTarget(m).filter(function (r) { return r.hasil === 'perlu'; }).length;
    function pilihan(field, saran, maks) {
      var semua = saran.concat(o[field].filter(function (x) { return saran.indexOf(x) < 0; }));
      return '<div class="chips">' + semua.map(function (x) { return '<button type="button" class="chip" data-cj="b-pilih" data-cj-f="' + field + '" data-cj-v="' + esc(x) + '" aria-pressed="' + (o[field].indexOf(x) >= 0) + '">' + esc(x) + '</button>'; }).join('') + '</div>' +
        '<div class="row"><input type="text" id="cj-b-' + field + '" maxlength="160" placeholder="Tulis sendiri" style="flex:1"><button type="button" class="btn ghost sm" data-cj="b-tambah" data-cj-f="' + field + '" data-cj-max="' + maks + '">Tambah</button></div>';
    }
    var h = '<div class="card"><h3>1. Dua hal yang paling membaik</h3><p class="small muted">Saran dari tren, boleh diganti.</p>' + pilihan('membaik', sar.membaik, 2) + '</div>' +
      '<div class="card"><h3>2. Fokus bulan depan (1–2)</h3>' + pilihan('fokus', sar.fokus, 2) + '</div>' +
      '<div class="card"><h3>3. Target personal</h3>' + [me(), ps()].map(function (u) {
        var t = targets()[u.id]; if (!t || !t.t1) return '';
        return '<p class="small"><b>' + esc(u.nama) + '</b>: ' + esc(t.t1.teks) + (t.t2 ? ' · ' + esc(t.t2.teks) : '') + '</p><div class="chips">' + [['tetap', 'Tetap'], ['ganti', 'Diganti'], ['naik', 'Dinaikkan']].map(function (x) {
          return '<button type="button" class="chip" data-cj="b-target" data-cj-u="' + u.id + '" data-cj-v="' + x[0] + '" aria-pressed="' + (o.target[u.id] === x[0]) + '">' + x[1] + '</button>'; }).join('') + '</div>';
      }).join('') + '<p class="small muted">Mengganti teks target: menu Fondasi & target.</p></div>' +
      '<div class="card"><h3>4. Perlu bantuan pihak ketiga (konselor)?</h3>' + (nPerlu >= 2 ? '<p class="small muted">Bulan ini ada ' + nPerlu + ' target yang perlu dibicarakan. Ngobrol dengan konselor bisa membantu, bukan tanda gagal.</p>' : '') +
      '<div class="chips">' + [['tidak', 'Belum perlu'], ['nanti', 'Dipertimbangkan'], ['ya', 'Ya, cari bantuan']].map(function (x) {
        return '<button type="button" class="chip" data-cj="b-konselor" data-cj-v="' + x[0] + '" aria-pressed="' + (o.konselor === x[0]) + '">' + x[1] + '</button>'; }).join('') + '</div>' +
      (o.konselor === 'ya' ? '<button type="button" class="cj-link" data-cj="ke" data-cj-v="bantuan">Lihat kontak konselor & layanan ›</button>' : '') + '</div>' +
      '<div class="card"><label for="cj-b-catatan"><h3>Catatan <span class="cj-badge soft">Opsional</span></h3></label><textarea id="cj-b-catatan" class="cj-note" maxlength="' + J.CATATAN_MAKS + '">' + esc(o.catatan) + '</textarea></div>';
    return h + (rb && rb.selesai_at ? '<p class="small muted">Disimpan ' + esc(namaDari(rb.oleh)) + '. Kalian bisa memperbaruinya.</p>' : '') +
      '<button type="button" class="btn wide" data-cj="b-simpan" data-cj-v="' + m + '">' + (rb && rb.selesai_at ? 'Perbarui hasil' : 'Simpan hasil bulan ini') + '</button>' +
      '<button type="button" class="btn ghost wide" data-cj="ke" data-cj-v="ekspor">Ekspor untuk konselor</button>';
  }

  // ---------- editor pertanyaan ----------
  function siapkanEditor() {
    if (S.ed) return;
    var akhir = sets()[sets().length - 1];
    S.ed = salin(V.draft ? V.draft.pertanyaan : (akhir ? akhir.pertanyaan : []));
    S.edP = S.edP || 'harian'; S.edDirty = false; S.edBuka = null;
  }
  function layarAtur() {
    siapkanEditor();
    var d = V.draft, akhir = sets()[sets().length - 1], p = S.edP;
    var perlu = J.perluSetuju(S.ed, akhir ? akhir.pertanyaan : [], me().id);
    var h = judulLayar('Atur pertanyaan', 'Perubahan jadi draft dulu, berlaku mulai periode berikutnya agar data lama tetap sebanding.');
    // status draft
    if (d) {
      var st = !d.perlu_setuju ? 'Item personal milik ' + esc(namaDari(d.oleh)) + ': bisa langsung terbit oleh pemiliknya.'
        : d.setuju_oleh ? '✓ Disetujui ' + esc(namaDari(d.setuju_oleh)) + '. Siap terbit.'
          : d.oleh === me().id ? 'Menunggu persetujuan ' + esc(ps().nama) + ' (item Bersama).' : esc(ps().nama) + ' meminta persetujuanmu.';
      h += '<div class="card cj-draft"><div class="row between"><b>Draft oleh ' + esc(namaDari(d.oleh)) + '</b><span class="small muted">belum tampil di check-in</span></div><p class="small">' + st + '</p>' +
        '<div class="row"><button type="button" class="btn ghost sm" data-cj="preview">Preview</button>' +
        (d.perlu_setuju && !d.setuju_oleh && d.oleh !== me().id ? '<button type="button" class="btn sm" data-cj="draft-setuju">Setujui & terbitkan</button>' : '') +
        ((!d.perlu_setuju && d.oleh === me().id) || (d.perlu_setuju && d.setuju_oleh) ? '<button type="button" class="btn sm" data-cj="draft-publish">Publish</button>' : '') +
        '<button type="button" class="btn danger sm" data-cj="draft-batal">Buang draft</button></div></div>';
    }
    h += '<nav class="cj-seg" aria-label="Frekuensi">' + J.PERIODE.map(function (x) { return '<button type="button" data-cj="ed-p" data-cj-v="' + x + '" aria-pressed="' + (x === p) + '">' + x.charAt(0).toUpperCase() + x.slice(1) + '</button>'; }).join('') + '</nav>';
    var list = S.ed.filter(function (q) { return q.periode === p; });
    h += '<div class="card cj-edlist">' + (list.length ? list.map(function (q) { return barisEditor(q); }).join('') : '<p class="small muted">Belum ada pertanyaan ' + p + '.</p>') + '</div>';
    if (S.edBuka === 'baru') h += formEditor(S.ef, true);
    h += '<div class="row"><button type="button" class="btn ghost sm" data-cj="ed-baru">+ Buat pertanyaan</button><button type="button" class="btn ghost sm" data-cj="ed-tpl">Tambah dari template</button></div>';
    if (S.edTpl) h += '<div class="card"><h3>Template ' + p + '</h3>' + J.TEMPLATE_TAMBAHAN.filter(function (t) { return t.periode === p; }).map(function (t, i) {
      var ada = S.ed.some(function (q) { return q.teks === t.teks; });
      return '<div class="li"><span class="small">' + esc(t.teks) + '<br><span class="muted">' + (t.jenis === 'bersama' ? 'Bersama' : 'Personal') + ' · ' + t.skala + '</span></span>' +
        (ada ? '<span class="small muted">Sudah ada</span>' : '<button type="button" class="btn ghost sm" data-cj="ed-tpl-add" data-cj-v="' + J.TEMPLATE_TAMBAHAN.indexOf(t) + '">Tambah</button>') + '</div>';
    }).join('') + '</div>';
    h += '<div class="card"><p class="small">' + (S.edDirty ? 'Ada perubahan yang belum disimpan.' : 'Tidak ada perubahan baru.') + ' ' + (perlu ? 'Menyentuh item Bersama → perlu persetujuan ' + esc(ps().nama) + '.' : 'Hanya item personal milikmu → cukup kamu.') + '</p>' +
      '<div class="row"><button type="button" class="btn" style="flex:1" data-cj="ed-simpan"' + (S.edDirty ? '' : ' disabled') + '>Simpan draft</button><button type="button" class="btn ghost" data-cj="preview">Preview</button></div></div>';
    h += '<div class="card"><h3>Riwayat versi</h3>' + sets().slice().reverse().map(function (s) {
      var b = s.berlaku || {};
      return '<div class="li"><span class="small"><b>Versi ' + s.versi + '</b>' + (s === akhir ? ' · terbaru' : '') + '<br><span class="muted">Terbit ' + (s.terbit_at ? fmtPendek(s.terbit_at.slice(0, 10)) : '-') + ' · berlaku harian ' + (b.harian ? fmtPendek(b.harian) : '-') + ', mingguan ' + (b.mingguan ? fmtPendek(J.senin(b.mingguan)) : '-') + ', bulanan ' + (b.bulanan ? fmtBulan(b.bulanan) : '-') + '</span></span>' +
        (s !== akhir ? '<button type="button" class="btn ghost sm" data-cj="ed-pulih" data-cj-v="' + s.versi + '">Pulihkan</button>' : '') + '</div>';
    }).join('') + '</div>';
    return h;
  }
  function barisEditor(q) {
    var milikLain = q.milik !== 'bersama' && q.milik !== me().id;
    var idx = S.ed.indexOf(q), sama = S.ed.filter(function (x) { return x.periode === q.periode; }), pos = sama.indexOf(q);
    var info = [q.jenis === 'bersama' ? 'Bersama' : 'Personal', q.skala === 'otomatis' ? 'Otomatis' : q.skala === 'frekuensi' ? 'Frekuensi' : 'Kejadian'];
    if (q.wajib) info.unshift('Wajib'); if (q.privat) info.push('🔒 privat'); if (q.observer) info.push('diri + pasangan');
    if (q.milik === me().id) info.push('hanya kamu'); if (milikLain) info.push('milik ' + namaDari(q.milik));
    if (q.sumber === 'target2') info.push('muncul kalau ada target kedua');
    var h = '<div class="cj-edrow' + (q.tampil ? '' : ' off') + '"><button type="button" class="cj-sw" role="switch" aria-checked="' + q.tampil + '" aria-label="Tampilkan ' + esc(q.teks) + '" data-cj="ed-tampil" data-cj-v="' + idx + '"' + (milikLain ? ' disabled' : '') + '><i></i></button>' +
      '<span class="cj-edtx"><b class="small">' + esc(q.teks) + '</b><span class="small muted">' + info.join(' · ') + '</span></span>' +
      '<span class="cj-edbtn">' + (pos > 0 ? '<button type="button" class="iconbtn sm" aria-label="Naikkan" data-cj="ed-naik" data-cj-v="' + idx + '">↑</button>' : '') +
      (pos < sama.length - 1 ? '<button type="button" class="iconbtn sm" aria-label="Turunkan" data-cj="ed-turun" data-cj-v="' + idx + '">↓</button>' : '') +
      (!milikLain ? '<button type="button" class="iconbtn sm" aria-label="Ubah" data-cj="ed-ubah" data-cj-v="' + idx + '">✎</button>' : '') + '</span></div>';
    if (S.edBuka === idx) h += formEditor(q, false);
    return h;
  }
  function formEditor(q, baru) {
    var khusus = q.bawaan && J.khusus(q), otomatis = q.skala === 'otomatis';
    function chips(field, opsi, dis) {
      return '<div class="chips">' + opsi.map(function (o) { return '<button type="button" class="chip" data-cj="ef" data-cj-f="' + field + '" data-cj-v="' + o[0] + '" aria-pressed="' + (String(S.ef[field]) === String(o[0])) + '"' + (dis ? ' disabled' : '') + '>' + o[1] + '</button>'; }).join('') + '</div>';
    }
    if (!S.ef || S.ef.id !== q.id) S.ef = salin(q);
    var e = S.ef;
    return '<div class="card cj-ef"><label for="cj-ef-teks"><h3>Teks pertanyaan</h3></label><input type="text" id="cj-ef-teks" maxlength="160" value="' + esc(e.teks) + '" placeholder="Contoh: Saya menepati jam pulang yang disepakati">' +
      (khusus ? '<p class="small muted">Item khusus (target/mood/topik/penanda): hanya teks, tampil, dan catatan yang bisa diubah.</p>' : '') +
      '<h3>Jenis</h3>' + chips('jenis', [['bersama', 'Bersama'], ['personal', 'Personal']], khusus) +
      (otomatis ? '' : '<h3>Skala</h3>' + chips('skala', [['frekuensi', 'Frekuensi (5)'], ['kejadian', 'Kejadian (3)']], khusus)) +
      '<h3>Frekuensi</h3>' + chips('periode', [['harian', 'Harian'], ['mingguan', 'Mingguan'], ['bulanan', 'Bulanan']], khusus) +
      (baru && e.jenis === 'personal' ? '<h3>Untuk</h3>' + chips('milik', [['bersama', 'Kami berdua (masing-masing)'], [me().id, 'Saya saja']]) : '') +
      (otomatis || q.topik ? '' : '<label class="switch"><input type="checkbox" data-cj-ef="catatan"' + (e.catatan ? ' checked' : '') + '> Kolom catatan (maks ' + J.CATATAN_MAKS + ' karakter)</label>') +
      (e.jenis === 'personal' && !(q.bawaan && q.privat) && !otomatis ? '<label class="switch"><input type="checkbox" data-cj-ef="privat"' + (e.privat ? ' checked' : '') + '> Privat (tidak pernah terlihat pasangan)</label>' : '') +
      (!q.bawaan && e.jenis === 'personal' && e.skala === 'frekuensi' && !e.privat ? '<label class="switch"><input type="checkbox" data-cj-ef="observer"' + (e.observer ? ' checked' : '') + '> Dinilai juga oleh pasangan (diri + observer)</label>' : '') +
      '<div class="row">' + (!q.bawaan && !baru ? '<button type="button" class="btn danger sm" data-cj="ef-hapus">Hapus</button>' : '') +
      '<span style="flex:1"></span><button type="button" class="btn ghost sm" data-cj="ef-batal">Batal</button><button type="button" class="btn sm" data-cj="ef-ok" data-cj-v="' + (baru ? 'baru' : 'ubah') + '">' + (baru ? 'Tambahkan' : 'Terapkan') + '</button></div></div>';
  }
  // preview: layar check-in persis seperti nanti, termasuk ucapan & ilustrasi
  function layarPreview() {
    siapkanEditor();
    var p = S.prevP || S.edP || 'harian', nilai = p === 'harian' ? hariIni() : p === 'mingguan' ? mingguIni() : hariIni().slice(0, 7);
    var setP = { versi: 0, pertanyaan: S.ed, berlaku: {} };
    if (!S.prevForm || S.prevForm.periode !== p) S.prevForm = { kunci: 'preview', periode: p, jawaban: {}, observer: {}, buka: {} };
    var judul = { harian: 'Evaluasi harian', mingguan: 'Evaluasi mingguan', bulanan: 'Review bulanan' }[p];
    var d = daftarForm(p, nilai, setP), wajib = d.items.filter(function (q) { return q.wajib && q.skala !== 'otomatis'; }).length;
    return judulLayar('Preview', 'Tidak tersimpan · begini tampilannya di check-in', 'atur') +
      '<nav class="cj-seg" aria-label="Frekuensi">' + J.PERIODE.map(function (x) { return '<button type="button" data-cj="prev-p" data-cj-v="' + x + '" aria-pressed="' + (x === p) + '">' + x.charAt(0).toUpperCase() + x.slice(1) + '</button>'; }).join('') + '</nav>' +
      '<div class="cj-frame"><div><h1 class="cj-h1">' + judul + '</h1><p class="muted small">' + wajib + ' wajib · ' + (d.items.length + d.obs.length) + ' pertanyaan</p></div>' +
      isiFormHtml(p, nilai, S.prevForm, setP) + '<button type="button" class="btn wide" disabled>Simpan</button>' +
      '<p class="tag">Ucapan setelah mengisi</p>' + pesanKartu(p === 'harian' ? 'daun' : p === 'mingguan' ? 'teh' : 'bunga') + (p === 'harian' ? pesanKartu('berat') : '') + '</div>';
  }

  // ---------- lain-lain ----------
  function layarFondasi() {
    var f = V.fondasi || {}, t = targets()[me().id] || {}, tp = targets()[ps().id] || {}, k = V.konselor || {};
    var misi = f.misi && f.misi.length ? f.misi : [''];
    return judulLayar('Fondasi & target', V.atur_oleh ? 'Terakhir diubah ' + esc(namaDari(V.atur_oleh)) : '') +
      '<div class="card"><label for="cj-tujuan"><h3>Tujuan</h3></label><input type="text" id="cj-tujuan" maxlength="200" value="' + esc(f.tujuan) + '">' +
      '<label for="cj-visi"><h3>Visi</h3></label><input type="text" id="cj-visi" maxlength="200" value="' + esc(f.visi) + '"><h3>Misi</h3>' +
      misi.map(function (x, i) { return '<input type="text" class="cj-misi" aria-label="Misi ' + (i + 1) + '" maxlength="200" value="' + esc(x) + '">'; }).join('') +
      '<button type="button" class="cj-link" data-cj="tambah-misi">+ Misi</button><button type="button" class="btn sm" data-cj="simpan-fondasi">Simpan fondasi</button></div>' +
      '<div class="card"><h3>Target pengembangan dirimu</h3><label for="cj-t1" class="small muted">Target 1</label><input type="text" id="cj-t1" maxlength="120" value="' + esc(t.t1 ? t.t1.teks : '') + '">' +
      '<label for="cj-t2" class="small muted">Target 2 (opsional)</label><input type="text" id="cj-t2" maxlength="120" value="' + esc(t.t2 ? t.t2.teks : '') + '">' +
      (t.t1 ? '<p class="small muted">Sejak ' + fmtPendek(t.t1.sejak) + '. Mengganti teks = target baru; yang lama tersimpan di riwayat.</p>' : '') +
      '<button type="button" class="btn sm" data-cj="simpan-target">Simpan target</button></div>' +
      '<div class="card"><h3>Target ' + esc(ps().nama) + '</h3>' + (tp.t1 ? '<p class="small">' + esc(tp.t1.teks) + (tp.t2 ? '<br>' + esc(tp.t2.teks) : '') + '</p><p class="small muted">Kamu observer untuk target ini.</p>' : '<p class="small muted">Belum diisi.</p>') + '</div>' +
      '<div class="card"><h3>Hari check-in mingguan</h3><div class="chips">' + [1, 2, 3, 4, 5, 6, 0].map(function (d) { return '<button type="button" class="chip" data-cj="hari" data-cj-v="' + d + '" aria-pressed="' + (V.hari === d) + '">' + HARI[d] + '</button>'; }).join('') + '</div></div>' +
      '<div class="card"><h3>Konselor kalian <span class="cj-badge soft">Opsional</span></h3><label for="cj-kn" class="small muted">Nama</label><input type="text" id="cj-kn" maxlength="80" value="' + esc(k.nama) + '">' +
      '<label for="cj-kk" class="small muted">Kontak (nomor/WA/email)</label><input type="text" id="cj-kk" maxlength="80" value="' + esc(k.kontak) + '"><button type="button" class="btn sm" data-cj="simpan-konselor">Simpan kontak</button></div>';
  }
  function layarPrivasi() {
    return judulLayar('Privasi & data', '') +
      '<div class="card"><h3>Yang terlihat oleh ' + esc(ps().nama) + '</h3><ul class="cj-list small">' +
      '<li><b>Harian</b>: hanya status sudah/belum mengisi, sampai kamu membagikan isian minggu itu saat check-in.</li>' +
      '<li><b>Mingguan & bulanan</b>: terlihat setelah kamu menekan Selesai.</li>' +
      '<li><b>Item privat</b> (perawatan diri, kondisi berat) dan catatannya tidak pernah dikirim ke pasangan. Untuk kondisi berat, yang terlihat hanya tanda ⚑ pada minggu itu sebagai konteks.</li>' +
      '<li><b>Topik</b> yang kamu tulis untuk dibahas dan <b>target personal</b> terlihat, karena memang untuk berdua.</li>' +
      '<li>Aturan ini dijalankan di server, bukan hanya disembunyikan di tampilan. Data tersimpan di Supabase lewat koneksi terenkripsi (HTTPS). Pemilik project Supabase secara teknis tetap bisa membuka tabel.</li></ul></div>' +
      '<div class="card"><label class="switch"><input type="checkbox" id="cj-mood"' + (me().bagikan_mood ? ' checked' : '') + '> Bagikan mood Daily Mood (H7) bersama isian harian yang kubagikan</label><p class="small muted">Default mati: mood tetap privat.</p></div>' +
      '<div class="card"><h3>Berhenti atau hapus</h3><p class="small muted">Mencabut persetujuan menonaktifkan Couple Journaling untuk kalian berdua. Data tetap ada sampai dihapus.</p>' +
      '<button type="button" class="btn ghost wide" data-cj="setuju" data-cj-v="0">Cabut persetujuanku</button>' +
      '<button type="button" class="btn danger wide" data-cj="hapus-saya">Hapus semua isianku</button></div>';
  }
  function layarBantuan() {
    var k = V.konselor || {}, tel = (k.kontak || '').replace(/[^\d+]/g, '');
    return judulLayar('Butuh bantuan?', 'Tidak perlu menunggu "parah" untuk minta bantuan.') +
      '<div class="card cj-sos"><h3>Darurat atau ada pikiran menyakiti diri</h3><a class="btn wide" href="tel:112">Telepon 112 (darurat)</a>' +
      '<a class="btn ghost wide" href="tel:119,8">Healing119 · 119 ext. 8</a><a class="btn ghost wide" href="https://healing119.id" target="_blank" rel="noopener">healing119.id (WhatsApp)</a>' +
      '<p class="small muted">Healing119 adalah layanan dukungan psikologis awal Kementerian Kesehatan, gratis, terbuka untuk siapa saja. Bukan pengganti diagnosis atau terapi; untuk lanjutan bisa ke Puskesmas atau rumah sakit.</p></div>' +
      '<div class="card"><h3>Konselor kalian</h3>' + (k.nama || k.kontak ? '<p><b>' + esc(k.nama || 'Konselor') + '</b><br><span class="small">' + esc(k.kontak) + '</span></p>' + (tel.length >= 8 ? '<a class="btn ghost wide" href="tel:' + esc(tel) + '">Hubungi</a>' : '') : '<p class="small muted">Belum diisi. Tambahkan di Fondasi & target.</p>') +
      '<button type="button" class="btn ghost wide" data-cj="ke" data-cj-v="ekspor">Siapkan ringkasan untuk konselor</button></div>';
  }

  // ---------- ekspor ----------
  function ringkasanTeks(m) {
    var L = [], f = V.fondasi || {}, ws = J.mingguDalamBulan(m), rb = (V.bulanan || []).filter(function (b) { return b.bulan === m; })[0];
    L.push('RINGKASAN COUPLE JOURNALING', fmtBulan(m) + ' · ' + me().nama + ' & ' + ps().nama, 'Bukan penilaian hubungan; bahan diskusi dengan konselor.', '');
    if (f.tujuan || f.visi) { L.push('FONDASI'); if (f.tujuan) L.push('Tujuan: ' + f.tujuan); if (f.visi) L.push('Visi: ' + f.visi); (f.misi || []).forEach(function (x, i) { L.push('Misi ' + (i + 1) + ': ' + x); }); L.push(''); }
    L.push('RITME', 'Check-in mingguan terlaksana: ' + ws.filter(function (w) { var s = sesi(w); return s && s.selesai_at; }).length + ' dari ' + ws.length + ' minggu.');
    var berat = ws.filter(function (w) { var a = isian(me().id, 'M:' + w), b = isian(ps().id, 'M:' + w); return (a && a.berat) || (b && b.berat); });
    if (berat.length) L.push('Minggu dengan kondisi berat (konteks): ' + berat.map(fmtMinggu).join(', ') + '.');
    L.push('', 'TREN KATEGORI PER MINGGU (' + me().nama + ' / ' + ps().nama + ')');
    var set = setAktif('mingguan', ws[ws.length - 1] || mingguIni());
    ((set && set.pertanyaan) || []).filter(function (q) { return q.periode === 'mingguan' && q.tampil && q.jenis === 'bersama' && q.skala !== 'otomatis'; }).forEach(function (q) {
      L.push('- ' + q.teks + ': ' + ws.map(function (w) {
        var a = isian(me().id, 'M:' + w), b = isian(ps().id, 'M:' + w), na = a && a.jawaban && a.jawaban[q.id], nb = b && b.jawaban && b.jawaban[q.id];
        return fmtPendek(J.senin(w)) + ' ' + (na ? J.labelNilai(q, na.n) : '-') + '/' + (nb ? J.labelNilai(q, nb.n) : '-');
      }).join('; '));
    });
    var rek = rekapTarget(m);
    L.push('', 'TARGET PERSONAL (diri vs pasangan)');
    if (rek.length) rek.forEach(function (r) { L.push('- ' + namaDari(r.pemilik) + ': ' + r.teks + ' → ' + J.KESIMPULAN[r.hasil].label + ' (diri ' + J.SKALA.frekuensi[4 - r.diri].label + ', pasangan ' + J.SKALA.frekuensi[4 - r.pasangan].label + ')'); });
    else L.push('-');
    var tp = (V.topik || []).filter(function (t) { return t.status === 'dibahas' && t.dibahas_minggu && J.bulanDariMinggu(t.dibahas_minggu) === m; });
    L.push('', 'TOPIK YANG DIBAHAS & TINDAK LANJUT');
    if (tp.length) tp.forEach(function (t) { L.push('- ' + t.judul + (t.permintaan ? ' | permintaan: ' + t.permintaan : '') + ' | tindakan: ' + t.tindakan + ' (PIC ' + namaDari(t.pic) + (t.tenggat ? ', ' + fmtPendek(t.tenggat) : '') + ')'); });
    else L.push('-');
    L.push('', 'HASIL REVIEW BULANAN');
    if (rb) {
      L.push('Paling membaik: ' + ((rb.membaik || []).join('; ') || '-'), 'Fokus bulan depan: ' + ((rb.fokus || []).join('; ') || '-'));
      Object.keys(rb.target || {}).forEach(function (u) { L.push('Target ' + namaDari(u) + ': ' + ({ tetap: 'tetap', ganti: 'diganti', naik: 'dinaikkan' })[rb.target[u]]); });
      L.push('Bantuan konselor: ' + ({ ya: 'ya, mencari bantuan', tidak: 'belum perlu', nanti: 'dipertimbangkan' }[rb.konselor] || '-'));
      if (rb.catatan) L.push('Catatan: ' + rb.catatan);
    } else L.push('Belum diisi.');
    L.push('', 'Isian harian dan item privat tidak disertakan.');
    return L.join('\n');
  }
  function layarEkspor() {
    var m = S.exM || bulanTarget(), opsi = [0, 1, 2].map(function (n) { return J.bulanGeser(hariIni().slice(0, 7), -n); });
    return judulLayar('Ekspor ringkasan', 'Untuk dibawa ke konselor/psikolog. Isian harian & item privat tidak disertakan.') +
      '<div class="chips">' + opsi.map(function (x) { return '<button type="button" class="chip" data-cj="ex-m" data-cj-v="' + x + '" aria-pressed="' + (x === m) + '">' + fmtBulan(x) + '</button>'; }).join('') + '</div>' +
      '<div class="card"><pre class="cj-pre">' + esc(ringkasanTeks(m)) + '</pre></div>' +
      '<button type="button" class="btn wide" data-cj="ex-pdf" data-cj-v="' + m + '">Unduh / bagikan PDF</button>' +
      (navigator.share ? '<button type="button" class="btn ghost wide" data-cj="ex-share" data-cj-v="' + m + '">Bagikan sebagai teks</button>' : '') +
      '<button type="button" class="btn ghost wide" data-cj="ex-copy" data-cj-v="' + m + '">Salin teks</button>';
  }
  function buatPdf(m) {
    var JP = window.jspdf && window.jspdf.jsPDF; if (!JP) throw new Error('nolib');
    var doc = new JP({ unit: 'mm', format: 'a4' }), M = 18, PW = 174, y = 22;
    function need(h) { if (y + h > 282) { doc.addPage(); y = 20; } }
    var baris = ringkasanTeks(m).split('\n');
    doc.setFont('helvetica', 'bold'); doc.setFontSize(18); doc.setTextColor(43, 37, 64); doc.text('Ringkasan Couple Journaling', M, y); y += 8;
    baris.slice(1).forEach(function (l) {
      var judul = /^[A-Z][A-Z &()\/.\-A-Za-z]*$/.test(l) && l === l.toUpperCase() && l.length > 3;
      if (!l) { y += 2; return; }
      if (judul) { need(12); y += 3; doc.setFont('helvetica', 'bold'); doc.setFontSize(10.5); doc.setTextColor(91, 75, 219); doc.text(l, M, y); y += 2; doc.setDrawColor(225, 221, 242); doc.line(M, y, M + PW, y); y += 5; doc.setTextColor(43, 37, 64); return; }
      doc.setFont('helvetica', 'normal'); doc.setFontSize(10);
      doc.splitTextToSize(l.replace(/→/g, '->'), PW).forEach(function (s) { need(5.5); doc.text(s, M, y); y += 4.8; });
    });
    return doc.output('blob');
  }
  function simpanFile(blob, nama) {
    try { var file = new File([blob], nama, { type: blob.type }); if (navigator.canShare && navigator.canShare({ files: [file] })) return navigator.share({ files: [file], title: nama }).then(function () { return 'shared'; }, function (e) { return e && e.name === 'AbortError' ? 'batal' : 'gagal'; }); } catch (e) { /* lanjut unduh */ }
    var url = URL.createObjectURL(blob), a = document.createElement('a'); a.href = url; a.download = nama; document.body.appendChild(a); a.click(); a.remove();
    setTimeout(function () { URL.revokeObjectURL(url); }, 4000);
    return Promise.resolve('unduh');
  }

  // ---------- ucapan setelah mengisi ----------
  var PESAN = {
    daun: { svg: svgDaun, teks: 'Terima kasih sudah jujur hari ini. Satu daun baru tumbuh 🌱' },
    berat: { svg: svgBulan, teks: 'Hari yang berat tetap layak dicatat. Istirahat ya 🌙' },
    teh: { svg: svgTeh, teks: 'Kalian meluangkan 30 menit untuk satu sama lain. Itu berarti 🤝' },
    bunga: { svg: svgPohonBunga, teks: 'Satu bulan bertumbuh bersama. Lihat apa yang membaik ✨' },
    evaluasi: { svg: svgDaun, teks: 'Evaluasi mingguanmu tersimpan. Lanjut ke ringkasan berdua.' }
  };
  function pesanKartu(jenis) { var p = PESAN[jenis]; return '<div class="card cj-msgcard">' + p.svg() + '<p>' + p.teks + '</p></div>'; }
  function pesanHtml(jenis) {
    var p = PESAN[jenis];
    return '<div class="cj-modal" role="dialog" aria-modal="true" aria-labelledby="cj-msg"><div class="cj-modalbox">' + p.svg() + '<p id="cj-msg">' + p.teks + '</p><button type="button" class="btn wide" data-cj="tutup-pesan">Oke</button></div></div>';
  }

  // ---------- timer check-in ----------
  var tick = null;
  function timer() {
    clearInterval(tick);
    var el = VIEW && VIEW.querySelector('#cj-timer'); if (!el) return;
    var mulai = Date.parse(el.getAttribute('data-mulai')), total = J.SESI_MENIT * 60;
    function upd() {
      if (!el.isConnected) { clearInterval(tick); return; }
      var lewat = Math.floor((Date.now() - mulai) / 1000), sisa = total - lewat;
      el.className = 'cj-timer' + (sisa <= 0 ? ' habis' : sisa < 300 ? ' hampir' : '');
      el.innerHTML = sisa > 0 ? '<span>⏱ ' + pad(Math.floor(sisa / 60)) + ':' + pad(sisa % 60) + '</span><span class="small">tersisa dari 30 menit</span>'
        : '<span>⏱ 30 menit sudah lewat</span><span class="small">Boleh lanjut, atau tunda topik ke minggu depan</span>';
      var bar = Math.max(0, Math.min(100, lewat / total * 100));
      el.style.setProperty('--p', bar + '%');
    }
    upd(); tick = setInterval(upd, 1000);
  }

  // ================= event =================
  function ke(scr, extra) {
    S.scr = scr; S.form = null; S.ef = null;
    if (scr !== 'atur' && scr !== 'preview') { S.ed = null; S.edTpl = false; S.edBuka = null; }
    if (scr === 'mingguan') { S.mstep = null; S.tIdx = 0; S.tSub = 1; S.w = mingguIni(); }
    if (scr === 'bulanan') { S.bstep = null; S.bform = null; S.m = bulanTarget(); }
    if (scr === 'harian') S.tgl = hariIni();
    Object.keys(extra || {}).forEach(function (k) { S[k] = extra[k]; });
    gambar(); if (VIEW) VIEW.scrollTop = 0;
  }
  function nilaiInput(id) { var el = VIEW.querySelector('#' + id); return el ? el.value.trim() : ''; }
  function simpanFieldTopik() {
    var t = antrianTopik(S.w || mingguIni())[Math.min(S.tIdx || 0, 99)]; if (!t) return Promise.resolve();
    var p = { id: t.id }, ubah = false;
    VIEW.querySelectorAll('[data-cj-tf]').forEach(function (el) { var k = el.getAttribute('data-cj-tf'); if ((t[k] || '') !== el.value.trim()) { p[k] = el.value.trim(); ubah = true; } });
    var tg = VIEW.querySelector('#cj-tenggat'); if (tg && (t.tenggat || '') !== tg.value) { p.tenggat = tg.value; ubah = true; }
    if (!ubah) return Promise.resolve();
    return rpc('cj.topik.update', p).then(terima, function (e) { toast(e.offline ? 'Butuh koneksi untuk menyimpan topik' : e.message); throw e; });
  }
  function onClick(ev) {
    if (!ev.target.closest('.cj-root, .cj-modal')) return;
    var b = ev.target.closest('[data-cj]'); if (!b || b.disabled) return;
    var a = b.getAttribute('data-cj'), v = b.getAttribute('data-cj-v');
    switch (a) {
      case 'muat': S.memuat = true; gambar(); muat(); break;
      case 'ke': ke(v); break;
      case 'demo-as': lsSet(DEMO_AS, v); V = ls(CACHE_KEY(), null); S = { scr: 'home', memuat: true }; gambar(); muat(); break;
      case 'setuju':
        if (v === '0' && !confirm('Cabut persetujuan? Couple Journaling nonaktif untuk kalian berdua sampai disetujui lagi. Data tetap tersimpan.')) return;
        aksi('cj.setuju', { setuju: v === '1' }, v === '1' ? 'Persetujuan tersimpan' : 'Persetujuan dicabut', function () { S.scr = 'home'; }); break;
      case 'hapus-saya':
        if (!confirm('Hapus semua isian harian/mingguan/bulananmu? Tidak bisa dibatalkan.')) return;
        aksi('cj.hapus_saya', {}, 'Isianmu dihapus'); break;
      // onboarding
      case 'tambah-misi': { var wrap = b.parentNode, inp = document.createElement('input'); inp.type = 'text'; inp.className = 'cj-misi'; inp.maxLength = 200; inp.setAttribute('aria-label', 'Misi baru'); wrap.insertBefore(inp, b); inp.focus(); break; }
      case 'onb-lewat': S.onb = 1; gambar(); break;
      case 'onb-ke': S.onb = +v; gambar(); break;
      case 'onb-fondasi': case 'simpan-fondasi': {
        var fd = { tujuan: nilaiInput('cj-tujuan'), visi: nilaiInput('cj-visi'), misi: [].map.call(VIEW.querySelectorAll('.cj-misi'), function (x) { return x.value.trim(); }).filter(Boolean) };
        aksi('cj.fondasi', { fondasi: fd }, 'Fondasi tersimpan', function () { if (a === 'onb-fondasi') S.onb = 1; }); break;
      }
      case 'onb-target': case 'simpan-target': {
        var t1 = nilaiInput('cj-t1'), t2 = nilaiInput('cj-t2');
        if (!t1) { toast('Isi target pertama dulu'); S.fokus = '#cj-t1'; VIEW.querySelector('#cj-t1').focus(); return; }
        aksi('cj.target', { t1: t1, t2: t2 }, 'Target tersimpan', function () { if (a === 'onb-target') S.onb = 2; }); break;
      }
      case 'hari': aksi('cj.fondasi', { hari: +v }, 'Hari check-in: ' + HARI[+v]); break;
      case 'onb-selesai': {
        var akhir = sets()[sets().length - 1], basis = salin(V.draft ? V.draft.pertanyaan : akhir.pertanyaan), ubah = false;
        basis.forEach(function (q) { if (S.onbPilih && q.id in S.onbPilih && q.tampil !== S.onbPilih[q.id]) { q.tampil = S.onbPilih[q.id]; ubah = true; } });
        lsSet('cj-onb-' + me().id, true); S.onb = 0;
        if (ubah) aksi('cj.draft', { aksi: 'simpan', pertanyaan: basis }, 'Item opsional jadi draft · perlu persetujuan ' + ps().nama);
        else { toast('Siap. Selamat bertumbuh bersama'); gambar(); }
        break;
      }
      // isian
      case 'buka-harian': ke('harian'); break;
      case 'tgl': S.tgl = v; S.form = null; gambar(); break;
      case 'pilih': {
        var f = S.scr === 'preview' ? S.prevForm : S.form, g = b.getAttribute('data-cj-grup'), qid = b.getAttribute('data-cj-q');
        var val = /^\d$/.test(v) ? +v : v, cur = f[g][qid] || {};
        f[g][qid] = { n: cur.n === val ? undefined : val, c: cur.c || '' };
        var y = VIEW.scrollTop; gambar(); VIEW.scrollTop = y;
        var nb = VIEW.querySelector('[data-cj="pilih"][data-cj-q="' + qid + '"][data-cj-grup="' + g + '"][data-cj-v="' + v + '"]'); if (nb) nb.focus();
        break;
      }
      case 'buka-catatan': { var ff = S.scr === 'preview' ? S.prevForm : S.form; ff.buka[b.getAttribute('data-cj-grup') + b.getAttribute('data-cj-q')] = true; S.fokus = '#cj-c-' + b.getAttribute('data-cj-grup') + b.getAttribute('data-cj-q'); var y2 = VIEW.scrollTop; gambar(); VIEW.scrollTop = y2; break; }
      case 'simpan-harian': {
        var fh = S.form, nl = S.tgl || hariIni(), e1 = cekForm(fh, nl);
        if (e1) { toast(e1); return; }
        var md = moodHariIni(nl), h1 = fh.jawaban.H1 ? fh.jawaban.H1.n : 4;
        kirimIsian(payloadForm(fh, nl, true), function () { S.form = null; S.scr = 'home'; S.atas = true; S.pesan = (md && md <= 2) || h1 <= 1 ? 'berat' : 'daun'; });
        break;
      }
      // mingguan
      case 'buka-mingguan': ke('mingguan'); break;
      case 'm-mulai': {
        var cb = VIEW.querySelector('#cj-bagi'), w = v;
        if (sesi(w)) { S.mstep = 'Topik'; gambar(); return; }
        rpc('cj.sesi', { minggu: w, aksi: 'mulai' }).then(function (d) { terima(d); return cb && cb.checked ? rpc('cj.bagikan', { minggu: w }).then(terima) : null; })
          .then(function () { S.mstep = 'Mulai'; gambar(); toast('Check-in dimulai · timer 30 menit'); }, function (e) { toast(e.offline ? 'Butuh koneksi untuk check-in' : e.message); });
        break;
      }
      case 'bagikan': aksi('cj.bagikan', { minggu: v }, 'Isian harian minggu ini dibagikan'); break;
      case 'm-step': simpanFieldTopik().then(function () { S.mstep = v; S.form = null; gambar(); VIEW.scrollTop = 0; }, function () {}); break;
      case 't-sub': simpanFieldTopik().then(function () { S.tSub = +v; gambar(); VIEW.scrollTop = 0; }, function () {}); break;
      case 'pic': { var tt = antrianTopik(S.w)[S.tIdx || 0]; if (!tt) return; simpanFieldTopik().then(function () { return aksi('cj.topik.update', { id: tt.id, pic: v }); }, function () {}); break; }
      case 't-tunda': simpanFieldTopik().then(function () { return aksi('cj.topik.update', { id: v, status: 'ditunda' }, 'Topik ditunda ke minggu depan', function () { S.tIdx = (S.tIdx || 0) + 1; S.tSub = 1; }); }, function () {}); break;
      case 't-tuntas': simpanFieldTopik().then(function () {
        var t = (V.topik || []).filter(function (x) { return x.id === v; })[0];
        if (!t || !t.tindakan || !t.pic) { toast('Isi tindak lanjut dan PIC dulu'); return; }
        return aksi('cj.topik.update', { id: v, status: 'dibahas' }, 'Topik tuntas', function () { S.tSub = 1; });
      }, function () {}); break;
      case 'tambah-topik-home': case 'tambah-topik-m': S.topikBaru = true; S.fokus = '#cj-topik'; gambar(); break;
      case 'topik-batal': S.topikBaru = false; gambar(); break;
      case 'topik-simpan': {
        var jd = nilaiInput('cj-topik'); if (!jd) { toast('Tulis topiknya dulu'); return; }
        aksi('cj.topik', { id: acakId(), judul: jd, minggu: mingguIni() }, 'Masuk antrian topik', function () { S.topikBaru = false; }); break;
      }
      case 'simpan-mingguan': {
        var fm = S.form, e2 = cekForm(fm, v); if (e2) { toast(e2); return; }
        kirimIsian(payloadForm(fm, v, true), function () { S.form = null; S.mstep = 'Ringkasan'; S.atas = true; S.pesan = 'evaluasi'; });
        break;
      }
      case 'm-selesai': aksi('cj.sesi', { minggu: v, aksi: 'selesai' }, '', function () { S.pesan = 'teh'; S.scr = 'home'; S.atas = true; }); break;
      // bulanan
      case 'buka-bulanan': ke('bulanan'); break;
      case 'simpan-bulanan': {
        var fb = S.form, e3 = cekForm(fb, v); if (e3) { toast(e3); return; }
        kirimIsian(payloadForm(fb, v, true), function () { S.form = null; S.bstep = 'Rekap'; S.atas = true; });
        break;
      }
      case 'b-step': S.bstep = v; gambar(); VIEW.scrollTop = 0; break;
      case 'b-pilih': {
        var fl = b.getAttribute('data-cj-f'), arr = S.bform[fl], i = arr.indexOf(v);
        if (i >= 0) arr.splice(i, 1); else { if (arr.length >= 2) { toast('Pilih maksimal 2'); return; } arr.push(v); }
        var y3 = VIEW.scrollTop; gambar(); VIEW.scrollTop = y3; break;
      }
      case 'b-tambah': {
        var fl2 = b.getAttribute('data-cj-f'), tx = nilaiInput('cj-b-' + fl2); if (!tx) return;
        if (S.bform[fl2].length >= 2) { toast('Pilih maksimal 2. Lepas salah satu dulu.'); return; }
        S.bform[fl2].push(tx); var y4 = VIEW.scrollTop; gambar(); VIEW.scrollTop = y4; break;
      }
      case 'b-target': S.bform.target[b.getAttribute('data-cj-u')] = v; var y5 = VIEW.scrollTop; gambar(); VIEW.scrollTop = y5; break;
      case 'b-konselor': S.bform.konselor = v; var y6 = VIEW.scrollTop; gambar(); VIEW.scrollTop = y6; break;
      case 'b-simpan': {
        var bf = S.bform; bf.catatan = nilaiInput('cj-b-catatan');
        if (!bf.fokus.length) { toast('Pilih minimal 1 fokus bulan depan'); return; }
        if (!bf.konselor) { toast('Jawab soal bantuan konselor dulu'); return; }
        aksi('cj.bulan', { bulan: v, membaik: bf.membaik, fokus: bf.fokus, target: bf.target, konselor: bf.konselor, catatan: bf.catatan, selesai: true }, '', function () { S.pesan = 'bunga'; S.atas = true; });
        break;
      }
      // editor
      case 'ed-p': S.edP = v; S.edBuka = null; S.edTpl = false; gambar(); break;
      case 'ed-tampil': {
        var q = S.ed[+v];
        if (q.tampil && q.wajib && !confirm('"' + q.teks + '" adalah item wajib bawaan. Tetap sembunyikan? Data periode berikutnya tidak bisa dibandingkan untuk item ini.')) return;
        q.tampil = !q.tampil; S.edDirty = true; gambar(); break;
      }
      case 'ed-naik': case 'ed-turun': {
        var idx = +v, qq = S.ed[idx], sama = S.ed.filter(function (x) { return x.periode === qq.periode; }), pos = sama.indexOf(qq), lain = sama[pos + (a === 'ed-naik' ? -1 : 1)];
        if (!lain) return; var j = S.ed.indexOf(lain); S.ed[idx] = lain; S.ed[j] = qq; S.edDirty = true; S.edBuka = null; gambar();
        var fb2 = VIEW.querySelector('[data-cj="' + a + '"][data-cj-v="' + j + '"]'); if (fb2) fb2.focus(); break;
      }
      case 'ed-ubah': S.edBuka = S.edBuka === +v ? null : +v; S.ef = null; gambar(); break;
      case 'ed-baru':
        S.edBuka = 'baru'; S.fokus = '#cj-ef-teks';
        S.ef = { id: 'q-' + acakId().slice(0, 10), teks: '', periode: S.edP, jenis: 'bersama', skala: 'frekuensi', catatan: true, tampil: true, privat: false, observer: false, milik: 'bersama', bawaan: false };
        gambar(); break;
      case 'ed-tpl': S.edTpl = !S.edTpl; gambar(); break;
      case 'ed-tpl-add': {
        var tp = J.TEMPLATE_TAMBAHAN[+v];
        S.ed.push({ id: 'q-' + acakId().slice(0, 10), teks: tp.teks, periode: tp.periode, jenis: tp.jenis, skala: tp.skala, catatan: true, tampil: true, privat: false, observer: false, milik: 'bersama', bawaan: false });
        S.edDirty = true; toast('Ditambahkan ke draft'); gambar(); break;
      }
      case 'ef': S.ef[b.getAttribute('data-cj-f')] = v; S.ef.teks = nilaiInput('cj-ef-teks'); gambar(); break;
      case 'ef-batal': S.edBuka = null; S.ef = null; gambar(); break;
      case 'ef-hapus': {
        if (!confirm('Hapus pertanyaan ini dari draft?')) return;
        S.ed.splice(S.edBuka, 1); S.edBuka = null; S.ef = null; S.edDirty = true; gambar(); break;
      }
      case 'ef-ok': {
        var e = S.ef; e.teks = nilaiInput('cj-ef-teks');
        if (!e.teks) { toast('Teks pertanyaan tidak boleh kosong'); return; }
        if (e.jenis !== 'personal') { e.privat = false; e.observer = false; if (v === 'baru') e.milik = 'bersama'; }
        if (e.privat || e.skala !== 'frekuensi') e.observer = false;
        if (v === 'baru') S.ed.push(e); else S.ed[S.edBuka] = e;
        S.edP = e.periode; S.edBuka = null; S.ef = null; S.edDirty = true; gambar(); break;
      }
      case 'ed-simpan': aksi('cj.draft', { aksi: 'simpan', pertanyaan: S.ed }, 'Draft tersimpan', function () { S.ed = null; }); break;
      case 'ed-pulih': if (!confirm('Muat versi ' + v + ' sebagai draft? Draft yang ada diganti.')) return; aksi('cj.draft', { aksi: 'pulihkan', versi: +v }, 'Versi ' + v + ' dimuat sebagai draft', function () { S.ed = null; }); break;
      case 'draft-setuju':
        rpc('cj.draft', { aksi: 'setuju' }).then(function () { return rpc('cj.draft', { aksi: 'publish' }); })
          .then(function (v) { terima(v); S.ed = null; toast('Disetujui & terbit'); gambar(); }, function (e) { toast(e.offline ? 'Butuh koneksi internet untuk ini' : e.message); muat(true); });
        break;
      case 'draft-batal': if (!confirm('Buang draft?')) return; aksi('cj.draft', { aksi: 'batal' }, 'Draft dibuang', function () { S.ed = null; }); break;
      case 'draft-publish':
        if (S.edDirty && !confirm('Ada perubahan yang belum disimpan ke draft. Terbitkan draft terakhir saja?')) return;
        aksi('cj.draft', { aksi: 'publish' }, 'Terbit · berlaku mulai periode berikutnya', function () { S.ed = null; }); break;
      case 'preview': S.prevP = S.edP; S.prevForm = null; ke('preview'); break;
      case 'prev-p': S.prevP = v; S.prevForm = null; gambar(); break;
      // ekspor
      case 'ex-m': S.exM = v; gambar(); break;
      case 'ex-copy': navigator.clipboard.writeText(ringkasanTeks(v)).then(function () { toast('Teks disalin'); }, function () { toast('Browser menolak menyalin'); }); break;
      case 'ex-share': navigator.share({ title: 'Ringkasan Couple Journaling', text: ringkasanTeks(v) }).catch(function () {}); break;
      case 'ex-pdf': {
        var blob; try { blob = buatPdf(v); } catch (er) { toast('PDF belum bisa dibuat, pakai Salin teks'); return; }
        simpanFile(blob, 'Couple Journaling ' + v + '.pdf').then(function (r) { toast(r === 'batal' ? 'Dibatalkan' : r === 'shared' ? 'PDF siap dikirim' : 'PDF diunduh'); }); break;
      }
      case 'simpan-konselor': aksi('cj.fondasi', { konselor: { nama: nilaiInput('cj-kn'), kontak: nilaiInput('cj-kk') } }, 'Kontak konselor tersimpan'); break;
      case 'tutup-pesan': S.pesan = null; gambar(); break;
    }
  }
  function onInput(ev) {
    var t = ev.target; if (!t.closest || !t.closest('.cj-root')) return;
    if (t.hasAttribute('data-cj-note')) {
      var f = S.scr === 'preview' ? S.prevForm : S.form, g = t.getAttribute('data-cj-grup'), q = t.getAttribute('data-cj-note');
      if (!f) return;
      var cur = f[g][q] || {}; f[g][q] = { n: cur.n, c: t.value };
      var cnt = t.nextElementSibling; if (cnt && cnt.classList.contains('cj-count')) cnt.textContent = t.value.length + '/' + J.CATATAN_MAKS;
    }
  }
  function onChange(ev) {
    var t = ev.target; if (!t.closest || !t.closest('.cj-root')) return;
    if (t.hasAttribute('data-cj-chk')) { S.onbPilih[t.getAttribute('data-cj-chk')] = t.checked; return; }
    if (t.hasAttribute('data-cj-ef')) { S.ef[t.getAttribute('data-cj-ef')] = t.checked; S.ef.teks = nilaiInput('cj-ef-teks'); gambar(); return; }
    if (t.id === 'cj-bagi') { S.bagi = t.checked; return; }
    if (t.id === 'cj-mood') aksi('cj.pref', { bagikan_mood: t.checked }, t.checked ? 'Mood dibagikan bersama isian harian' : 'Mood kembali privat');
  }
  function onKey(ev) {
    if (ev.key === 'Escape' && S.pesan) { S.pesan = null; gambar(); return; }
    if (ev.key === 'Enter' && ev.target.id === 'cj-topik') { ev.preventDefault(); var b = VIEW.querySelector('[data-cj="topik-simpan"]'); if (b) b.click(); }
  }

  var dipasang = false, dimuat = false;
  window.Berdua = {
    render: function (el) {
      VIEW = el;
      if (!dipasang) {
        dipasang = true;
        el.addEventListener('click', onClick); el.addEventListener('input', onInput); el.addEventListener('change', onChange); document.addEventListener('keydown', onKey);
        window.addEventListener('online', function () { if (document.querySelector('.cj-root')) muat(true); });
        document.addEventListener('visibilitychange', function () { if (document.visibilityState === 'visible' && document.querySelector('.cj-root')) muat(true); });
      }
      el.innerHTML = '<div class="cj-boot"></div>';
      gambar();
      if (!dimuat) { dimuat = true; muat(); }
    },
    // dipakai Pengaturan & tes
    _state: function () { return { V: V, S: S }; }
  };
})();
