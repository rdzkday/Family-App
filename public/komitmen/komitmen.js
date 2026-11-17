/*
 * Komitmen — Fase 4a: baca & cari (claude/komitmen-brief.md §8A, §9).
 * Data dari aksi `komitmen.list`, disimpan di cache HP (localStorage) supaya baca & cari jalan offline.
 * Mode demo / belum terhubung: data contoh di bawah (placeholder, BUKAN isi kesepakatan asli).
 */
(function () {
  'use strict';
  var C = KantongCore;
  var $ = function (s, el) { return (el || document).querySelector(s); };
  var $$ = function (s, el) { return Array.prototype.slice.call((el || document).querySelectorAll(s)); };
  var esc = function (s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  };
  var LS = {
    get: function (k, d) { try { var v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch (e) { return d; } },
    set: function (k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* penuh / diblokir */ } }
  };
  (function () { if (LS.get('k_theme', 'dark') === 'light') document.documentElement.setAttribute('data-theme', 'light'); })();

  var BLN = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
  function tgl(iso) { // '2026-10-12...' -> '12 Okt 2026'
    var m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(iso || ''));
    return m ? (+m[3]) + ' ' + BLN[+m[2] - 1] + ' ' + m[1] : '';
  }
  function agoLabel(ms) {
    var d = Math.round((Date.now() - ms) / 60000);
    return d < 1 ? 'baru saja' : d < 60 ? d + ' menit lalu' : d < 1440 ? Math.round(d / 60) + ' jam lalu' : Math.round(d / 1440) + ' hari lalu';
  }
  function toast(msg) {
    var el = $('#toast'); el.textContent = msg; el.className = 'toast show';
    clearTimeout(toast.t); toast.t = setTimeout(function () { el.className = 'toast'; }, 2200);
  }
  var ICON = {
    back: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M15 5l-7 7 7 7"/></svg>',
    search: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><circle cx="11" cy="11" r="7"/><path d="M20 20l-4-4"/></svg>',
    x: '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><path d="M6 6l12 12M18 6L6 18"/></svg>',
    lock: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/></svg>',
    pen: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 20h4L19 9l-4-4L4 16v4z"/><path d="M13 7l4 4"/></svg>'
  };

  // ================= data contoh (placeholder) =================
  function demoSeed() {
    var T0 = '2026-09-14T20:00:00+07:00', T1 = '2026-10-12T21:00:00+07:00', T2 = '2026-11-10T21:00:00+07:00';
    var bab = function (id, nomor, judul, u) { return { id: id, nomor: nomor, judul: judul, urutan: u, dibuat_at: T0, dihapus: '' }; };
    var pasal = [], versi = [];
    function P(nomor, bab_id, tipe, judul, ayat, o) {
      o = o || {};
      var id = 'p' + nomor, vs = o.versi || [{ ayat: ayat, sah: o.sah || 'sah-pra', at: o.at || T0, sumber: o.sumber || 'evaluasi' }];
      vs.forEach(function (v, i) {
        var last = i === vs.length - 1;
        versi.push({ id: id + '-v' + (i + 1), pasal_id: id, versi: i + 1, isi_ayat: JSON.stringify(v.ayat || []), alasan: v.alasan || '',
          jenis: v.jenis || (i ? 'ubah' : 'baru'), sumber: v.sumber || 'evaluasi', evaluasi_id: '', pengesahan_id: v.sah || 'sah-pra',
          status: v.status || (last ? 'berlaku' : 'digantikan'), berlaku_sejak: v.status === 'usulan' ? '' : (v.at || T0), dibuat_oleh: 'riki', dibuat_at: v.at || T0 });
      });
      var berlaku = versi.filter(function (v) { return v.pasal_id === id && v.status === 'berlaku'; }).pop();
      pasal.push({ id: id, nomor: nomor, bab_id: bab_id, tipe: tipe, judul: judul, kata_kunci: o.kunci || '', sumber_asal: o.pranikah ? 'pranikah' : 'app',
        rujukan_asli: o.pranikah ? 'Pasal ' + o.pranikah + ' Perjanjian Pranikah' : '', terkunci: !!o.pranikah, status: o.status || 'berlaku',
        versi_berlaku_id: berlaku ? berlaku.id : '', dibuat_oleh: 'riki', dibuat_at: T0, diubah_at: T0, dihapus: '' });
    }
    var pra = { sumber: 'pranikah' };
    P(1, 'b1', 'kesepakatan', '[Contoh] Harta bawaan', null, { pranikah: 1, kunci: 'harta, aset', versi: [{ sumber: 'pranikah', ayat: [
      '[Contoh teks akta] Harta yang dibawa masing-masing pihak sebelum perkawinan tetap menjadi milik pihak yang membawanya.',
      '[Contoh teks akta] Hasil dari harta bawaan mengikuti pemilik hartanya.'] }] });
    P(2, 'b1', 'kesepakatan', '[Contoh] Harta selama perkawinan', null, { pranikah: 2, kunci: 'harta', versi: [{ sumber: 'pranikah', ayat: [
      '[Contoh teks akta] Penghasilan masing-masing pihak selama perkawinan dikelola sesuai kesepakatan kedua pihak.'] }] });
    P(3, 'b1', 'kesepakatan', '[Contoh] Utang', null, { pranikah: 3, kunci: 'utang, pinjaman', versi: [{ sumber: 'pranikah', ayat: [
      '[Contoh teks akta] Utang yang dibuat sebelum perkawinan menjadi tanggungan pihak yang membuatnya.',
      '[Contoh teks akta] Utang selama perkawinan untuk keperluan rumah tangga ditanggung bersama.'] }] });
    P(4, '', 'definisi', 'Selingkuh', null, { versi: [{ ayat: ['Selingkuh adalah [definisi yang kalian sepakati].', 'Termasuk di dalamnya: [contoh perilaku].', 'Tidak termasuk: [contoh yang disepakati bukan selingkuh].'] }] });
    P(5, '', 'definisi', 'Lawan jenis', null, { versi: [{ ayat: ['Lawan jenis adalah [definisi yang kalian sepakati].', 'Termasuk: [contoh, misal rekan kerja, teman lama].'] }] });
    P(6, '', 'definisi', 'Waktu berkualitas', null, { kunci: 'quality time', versi: [{ ayat: ['Waktu berkualitas adalah [definisi yang kalian sepakati].'] }] });
    P(7, 'b3', 'kesepakatan', 'Chat pribadi dengan lawan jenis', null, { kunci: 'whatsapp, dm, pesan', versi: [
      { ayat: ['[Contoh versi lama] Chat pribadi dengan lawan jenis dibatasi.'], sah: 'sah-pra' },
      { ayat: ['[Contoh] Chat pribadi dengan lawan jenis hanya untuk urusan [yang disepakati].', '[Contoh] Percakapan yang bisa dianggap selingkuh tidak disembunyikan dari pasangan.'],
        sah: 'sah-okt', at: T1, alasan: 'Diperjelas batasannya' }] });
    P(8, 'b3', 'kesepakatan', 'Bertemu berdua dengan lawan jenis', null, { versi: [{ ayat: ['[Contoh] Bertemu berdua dengan lawan jenis diberitahukan ke pasangan [kapan/bagaimana].'], sah: 'sah-okt', at: T1 }] });
    P(9, 'b4', 'kesepakatan', 'Pengeluaran besar', null, { kunci: 'belanja, uang', versi: [{ ayat: ['[Contoh] Pengeluaran di atas [nominal] dibicarakan berdua dulu.', '[Contoh] Darurat kesehatan dikecualikan.'], sah: 'sah-okt', at: T1 }] });
    P(10, 'b4', 'kesepakatan', 'Catatan belanja harian', null, { status: 'dicabut', versi: [
      { ayat: ['[Contoh] Semua belanja harian dicatat di buku tulis.'], sah: 'sah-pra' },
      { jenis: 'cabut', ayat: [], sah: 'sah-okt', at: T1, alasan: 'Sudah pakai app Kantong' }] });
    P(11, 'b5', 'kesepakatan', 'Malam tanpa HP', null, { kunci: 'kencan, quality time', versi: [{ ayat: ['[Contoh] Satu malam per minggu tanpa HP, berdua saja.'], sah: 'sah-okt', at: T1 }] });
    P(12, 'b5', 'kesepakatan', 'Liburan tahunan', null, { status: 'usulan', versi: [{ ayat: ['[Contoh usulan] Liburan berdua minimal sekali setahun.'], sah: 'sah-nov', status: 'usulan', at: T2 }] });
    var ket = [
      { id: 'k1', pasal_id: 'p2', isi: '[Contoh keterangan] Cara kalian menjalankan pasal ini, tanpa mengubah teks aslinya.', menggantikan_id: '', jenis: 'baru', evaluasi_id: '',
        pengesahan_id: 'sah-okt', status: 'berlaku', berlaku_sejak: T1, dibuat_oleh: 'istri', dibuat_at: T1 },
      { id: 'k2', pasal_id: 'p3', isi: '[Contoh keterangan] Pinjaman ke teman atau keluarga, termasuk lawan jenis, diberitahukan ke pasangan.', menggantikan_id: '', jenis: 'baru',
        evaluasi_id: '', pengesahan_id: 'sah-okt', status: 'berlaku', berlaku_sejak: T1, dibuat_oleh: 'riki', dibuat_at: T1 },
      { id: 'k3', pasal_id: 'p9', isi: '[Contoh keterangan] Keterangan juga bisa ditempel di pasal biasa, misal cara menghitung batas nominal.', menggantikan_id: '',
        jenis: 'baru', evaluasi_id: '', pengesahan_id: 'sah-okt', status: 'berlaku', berlaku_sejak: T1, dibuat_oleh: 'istri', dibuat_at: T1 }
    ];
    var S1 = 'M14 78 C 30 30, 46 30, 52 72 S 70 100, 84 52 S 112 22, 120 70 C 126 96, 150 92, 168 60 S 200 40, 214 70 L 286 64';
    var S2 = 'M16 70 C 40 20, 60 110, 86 60 C 100 34, 118 34, 124 62 C 130 92, 160 88, 176 56 C 188 34, 206 44, 210 66 C 214 86, 250 80, 284 52';
    var sah = function (id, judul, jenis, at, riki, febie) {
      return { id: id, judul: judul, jenis: jenis, evaluasi_id: '', ttd_riki: riki ? S1 : '', ttd_riki_at: riki ? at : '', ttd_febie: febie ? S2 : '', ttd_febie_at: febie ? at : '',
        isi_hash: 'contoh', status: riki && febie ? 'sah' : 'menunggu', dibuat_at: at };
    };
    return {
      Buku: [{ id: 'riki', nama: 'Riki', tipe: 'Pribadi', pemilik: 'riki', urutan: 1 }, { id: 'istri', nama: 'Febie', tipe: 'Pribadi', pemilik: 'istri', urutan: 2 }],
      Users: [{ id: 'riki', nama: 'Riki', buku: 'riki' }, { id: 'istri', nama: 'Febie', buku: 'istri' }],
      KomitmenBab: [bab('b1', 'I', 'Perjanjian Pranikah', 1), bab('b3', 'II', 'Batasan dengan Lawan Jenis', 2),
        bab('b4', 'III', 'Keuangan', 3), bab('b5', 'IV', 'Waktu Bersama', 4)],
      KomitmenPasal: pasal, KomitmenVersi: versi, KomitmenKeterangan: ket,
      Pengesahan: [sah('sah-pra', 'Perjanjian Pranikah', 'pranikah', T0, true, true), sah('sah-okt', 'Evaluasi Okt 2026', 'evaluasi', T1, true, true),
        sah('sah-nov', 'Evaluasi Nov 2026', 'evaluasi', T2, false, true)],
      Evaluasi: []
    };
  }

  // ================= state =================
  var conn = LS.get('k_conn', null), boot = LS.get('k_boot', null);
  var remote = !!(conn && conn.mode !== 'demo' && conn.api && conn.token);
  var demo = !remote;
  var cache = remote ? LS.get('k_komitmen', null) : null;   // { data, at }
  var S = { data: null, q: '', filter: 'semua', tab: 'kesepakatan', status: '', fokus: null };
  var ME = (boot && boot.user) || { id: 'riki', nama: 'Riki', buku: 'riki' };

  // mode contoh: data disimpan di HP (k_km_demo) supaya simulasi tambah/tarik usulan tetap ada setelah reload
  var DEMO_KEY = 'k_km_demo';
  function demoStore() { return C.memoryStore(LS.get(DEMO_KEY, null) || demoSeed()); }
  function demoData() { return C.handle(demoStore(), ME, 'komitmen.list', {}, new Date().toISOString()); }
  function aksi(action, payload) { // Promise. Mode contoh: di HP; mode terhubung: kirim ke server lalu muat ulang daftar
    if (demo) {
      try {
        var st = demoStore(), res = C.handle(st, ME, action, payload, new Date().toISOString());
        LS.set(DEMO_KEY, st.data); S.data = demoData();
        return Promise.resolve(res);
      } catch (e) { return Promise.reject(e); }
    }
    return post(action, payload).then(function (res) {
      return fetchList().then(function (d) { S.data = d; cache = { data: d, at: Date.now() }; LS.set('k_komitmen', cache); S.status = ''; return res; },
        function () { return res; });
    }, function (e) { if (e.offline) e.message = 'Tidak ada koneksi. Usulan belum terkirim.'; throw e; });
  }
  function resetDemo() { try { localStorage.removeItem(DEMO_KEY); } catch (e) { /* abaikan */ } S.data = demoData(); location.hash = ''; render(); toast('Data contoh dikembalikan'); }
  function adaSimulasi() { return !!LS.get(DEMO_KEY, null); }
  function fetchList() { return post('komitmen.list', {}); }
  function post(action, payload) {
    var ctrl = new AbortController(), timer = setTimeout(function () { ctrl.abort(); }, 30000);
    return fetch(conn.api, {
      method: 'POST', redirect: 'follow', signal: ctrl.signal, headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({ token: conn.token, action: action, payload: payload || {} })
    }).then(function (r) { clearTimeout(timer); if (!r.ok) throw new Error('Server membalas ' + r.status); return r.json(); },
      function () { clearTimeout(timer); var e = new Error('Tidak ada koneksi'); e.offline = true; throw e; })
      .then(function (j) { if (!j.ok) throw new Error(j.error || 'Gagal'); return j.data; });
  }
  function load() {
    if (demo) { S.data = demoData(); render(); return; }
    if (cache) S.data = cache.data;
    S.status = cache ? 'Memuat…' : 'Memuat kesepakatan…';
    render();
    fetchList().then(function (d) {
      S.data = d; cache = { data: d, at: Date.now() }; LS.set('k_komitmen', cache); S.status = ''; render();
    }, function (e) {
      S.status = cache ? 'Offline · data ' + agoLabel(cache.at) : (e.offline ? 'Butuh internet untuk memuat pertama kali.' : e.message);
      render();
    });
  }

  // ================= util tampilan =================
  function babOf(id) { return (S.data.bab || []).filter(function (b) { return b.id === id; })[0]; }
  function lolosFilter(p) {
    switch (S.filter) {
      case 'pranikah': return p.status !== 'dicabut' && p.sumber_asal === 'pranikah';
      case 'usulan': return p.status === 'usulan' || p.ada_usulan;
      case 'dicabut': return p.status === 'dicabut';
      default: return p.status !== 'dicabut';
    }
  }
  function waktuLabel(p) {
    if (p.status === 'dicabut') return p.dicabut ? 'Dicabut ' + tgl(p.dicabut.tanggal) : 'Dicabut';
    if (p.status === 'usulan') return 'Usulan · belum berlaku';
    if (!p.berlaku_sejak) return '';
    return (p.versi >= 2 ? 'Diubah ' : 'Berlaku sejak ') + tgl(p.berlaku_sejak);
  }
  function sumberLabel(p) {
    if (p.sumber === 'pranikah' || p.sumber_asal === 'pranikah') return 'Perjanjian Pranikah';
    if (p.sumber === 'luar_evaluasi') return 'Di luar evaluasi';
    var s = S.data.pengesahan[p.pengesahan_id];
    return s && s.jenis === 'evaluasi' ? s.judul : 'Evaluasi';
  }
  function lokasiLabel(l) {
    return { nomor: 'nomor pasal', judul: 'di judul', kata_kunci: 'di kata kunci', rujukan: 'di rujukan asli', keterangan: 'di keterangan' }[l.di] ||
      (l.di === 'ayat' ? 'di ayat (' + (l.idx + 1) + ')' : '');
  }
  // highlight: cocokkan versi ternormalisasi (tanpa huruf besar/aksen) lalu petakan balik ke teks asli
  function hl(text, q) {
    text = String(text == null ? '' : text);
    var toks = C.normCari(q).split(' ').filter(Boolean);
    if (!toks.length) return esc(text);
    var norm = '', map = [];
    for (var i = 0; i < text.length; i++) { var n = C.normCari(text.charAt(i)) || (text.charAt(i) === ' ' ? ' ' : ''); for (var j = 0; j < n.length; j++) { norm += n.charAt(j); map.push(i); } }
    var on = new Array(text.length + 1).join('0').split('').map(Number);
    toks.forEach(function (t) {
      var re = new RegExp(/^\d+$/.test(t) ? '(^|[^0-9])(' + t + ')(?![0-9])' : '()(' + t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + ')', 'g'), m;
      while ((m = re.exec(norm))) {
        var a = m.index + m[1].length, b = a + m[2].length - 1;
        for (var k = map[a]; k <= map[b]; k++) on[k] = 1;
        if (re.lastIndex === m.index) re.lastIndex++;
      }
    });
    var out = '', open = false;
    for (var x = 0; x < text.length; x++) {
      if (on[x] && !open) { out += '<mark>'; open = true; }
      if (!on[x] && open) { out += '</mark>'; open = false; }
      out += esc(text.charAt(x));
    }
    return out + (open ? '</mark>' : '');
  }
  function potong(text, q) { // cuplikan di sekitar kata yang cocok
    var t = String(text || ''), toks = C.normCari(q).split(' ').filter(Boolean), nt = C.normCari(t), pos = -1;
    toks.forEach(function (k) { var i = nt.indexOf(k); if (i >= 0 && (pos < 0 || i < pos)) pos = i; });
    if (pos > 48) { var s = t.lastIndexOf(' ', pos - 30); return '…' + t.slice(s > 0 ? s + 1 : pos - 30); }
    return t;
  }
  function tags(p, besar) {
    var h = '';
    if (p.sumber_asal === 'pranikah') h += '<span class="tag">' + ICON.lock + 'Pranikah</span>';
    if (p.tipe === 'definisi') h += '<span class="tag">Definisi</span>';
    else if (besar) h += '<span class="tag">Kesepakatan</span>';
    if (p.status === 'usulan') h += '<span class="tag garis">Usulan</span>';
    else if (p.ada_usulan) h += '<span class="tag garis">Ada usulan</span>';
    if (p.status === 'dicabut') h += '<span class="tag">Dicabut</span>';
    return h;
  }
  function ttdSvg(d) {
    return '<svg viewBox="0 0 300 120" aria-hidden="true"><path d="' + esc(d) + '" fill="none" stroke="currentColor" stroke-width="7" stroke-linecap="round" stroke-linejoin="round"/></svg>';
  }

  // ================= daftar =================
  function rowHtml(p, hit) {
    var q = hit ? S.q : '', snip = p.ayat[0] || '', lok = '';
    if (hit) {
      var l = hit.lokasi.filter(function (x) { return x.di === 'ayat' || x.di === 'keterangan'; })[0];
      if (l) snip = potong(l.di === 'ayat' ? p.ayat[l.idx] : p.keterangan[l.idx].isi, q);
      lok = lokasiLabel(hit.lokasi[0]);
      if (hit.lokasi[0].di === 'nomor' && hit.lokasi[1]) lok = '';
    }
    var cur = String(currentNomor()) === String(p.nomor);
    return '<a class="row' + (p.status === 'usulan' ? ' usulan' : '') + (p.status === 'dicabut' ? ' dicabut' : '') + '" href="#p/' + p.nomor + '"' +
      (cur ? ' aria-current="true"' : '') + (hit ? ' data-fokus="' + esc(JSON.stringify(hit.lokasi[0])) + '"' : '') + '>' +
      '<div class="r1"><span class="no">' + hl('Pasal ' + p.nomor, hit && hit.tingkat === 0 ? String(p.nomor) : '') + '</span><span class="jd">' + hl(p.judul, q) + '</span>' + tags(p) + '</div>' +
      (snip ? '<p class="snip">' + hl(snip, q) + '</p>' : '') +
      '<div class="meta">' + (lok ? '<span class="lok">' + esc(lok) + '</span>' : '') + '<span>' + esc(waktuLabel(p)) + '</span></div></a>';
  }
  function listBab(items) {
    var by = {}; items.forEach(function (p) { (by[p.bab_id] = by[p.bab_id] || []).push(p); });
    var urut = (S.data.bab || []).map(function (b) { return b.id; });
    Object.keys(by).forEach(function (id) { if (urut.indexOf(id) < 0) urut.push(id); });
    return urut.filter(function (id) { return by[id]; }).map(function (id) {
      var b = babOf(id);
      return '<section class="bab" aria-label="' + esc(b ? 'Bab ' + b.nomor + ' ' + b.judul : 'Tanpa bab') + '"><h2 class="bab-h">' + esc(b ? 'Bab ' + b.nomor + ' – ' + b.judul : 'Tanpa bab') + '</h2>' +
        '<div class="rows">' + by[id].map(function (p) { return rowHtml(p); }).join('') + '</div></section>';
    }).join('');
  }
  function hurufAwal(s) { var c = C.normCari(String(s).replace(/^\[[^\]]*\]\s*/, '')).charAt(0).toUpperCase(); return /[A-Z]/.test(c) ? c : '#'; }
  function listAz(items) {
    var defs = items.filter(function (p) { return p.tipe === 'definisi'; })
      .sort(function (a, b) { return C.normCari(a.judul).localeCompare(C.normCari(b.judul), 'id'); });
    if (!defs.length) return '<div class="km-empty"><p>Belum ada definisi di daftar ini.</p></div>';
    var by = {}; defs.forEach(function (p) { var h = hurufAwal(p.judul); (by[h] = by[h] || []).push(p); });
    var huruf = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ#'.split('');
    return '<div class="az"><div class="az-list">' + huruf.filter(function (h) { return by[h]; }).map(function (h) {
      return '<section class="bab"><h2 class="az-h" id="az-' + (h === '#' ? 'lain' : h) + '">' + h + '</h2><div class="rows">' + by[h].map(function (p) { return rowHtml(p); }).join('') + '</div></section>';
    }).join('') + '</div><nav class="az-index" aria-label="Indeks huruf">' + huruf.map(function (h) {
      return '<button type="button" data-az="' + (h === '#' ? 'lain' : h) + '"' + (by[h] ? '' : ' disabled') + ' aria-label="Huruf ' + h + '">' + h + '</button>';
    }).join('') + '</nav></div>';
  }
  function hasilCari() {
    var semua = S.data.pasal, hits = C.cariKomitmen(semua, S.q).filter(function (h) { return lolosFilter(h.pasal); });
    var n = C.nomorDariKueri(S.q), note = '';
    if (n && !hits.some(function (h) { return h.tingkat === 0; })) {
      var ada = semua.filter(function (p) { return p.nomor === n; })[0];
      if (!ada) note = 'Pasal ' + n + ' tidak ada.';
      else if (ada.status === 'dicabut') note = 'Pasal ' + n + ' sudah dicabut. <a href="#p/' + n + '">Lihat arsipnya</a>';
      else note = 'Pasal ' + n + ' tidak masuk filter ini. <a href="#p/' + n + '">Buka Pasal ' + n + '</a>';
    }
    var html = note ? '<div class="km-note" role="status">' + note + '</div>' : '';
    if (!hits.length) {
      if (!note) html += '<div class="km-empty" role="status"><p>Tidak ada pasal tentang “' + esc(S.q) + '”.</p><p>' + '<button type="button" class="link" id="usul-dari-cari">Jadikan usulan pasal baru</button>' + '</p></div>';
      return html;
    }
    return html + '<p class="bab-h" role="status">' + hits.length + ' pasal ditemukan</p><div class="rows">' + hits.map(function (h) { return rowHtml(h.pasal, h); }).join('') + '</div>';
  }
  function itemsHtml() {
    if (!S.data) return '<div class="km-empty"><p>' + esc(S.status || 'Memuat…') + '</p></div>';
    if (!S.data.pasal.length) {
      return '<div class="km-empty"><p>Belum ada kesepakatan. Mulai dari evaluasi bulanan pertama kalian.</p></div>';
    }
    if (S.q.trim()) return hasilCari();
    var def = S.tab === 'definisi';
    var items = S.data.pasal.filter(function (p) { return lolosFilter(p) && (p.tipe === 'definisi') === def; });
    if (!items.length) return '<div class="km-empty"><p>' + ({ usulan: 'Tidak ada usulan yang menunggu.', dicabut: 'Belum ada yang dicabut.' }[S.filter] ||
      (def ? 'Belum ada definisi.' : 'Belum ada kesepakatan di sini.')) + '</p></div>';
    return def ? listAz(items) : listBab(items);
  }
  function jumlahLabel(d) {
    var k = 0, f = 0;
    d.pasal.forEach(function (p) { if (p.status === 'berlaku') { if (p.tipe === 'definisi') f++; else k++; } });
    return k + ' kesepakatan · ' + f + ' definisi berlaku';
  }
  function listHtml() {
    var d = S.data, FIL = [['semua', 'Semua'], ['pranikah', 'Pranikah'], ['usulan', 'Usulan'], ['dicabut', 'Dicabut']];
    return '<header class="km-head"><a class="back" href="../" aria-label="Kembali ke Beranda">' + ICON.back + '</a>' +
      '<div><h1>Komitmen</h1><p class="sub">' + (d ? jumlahLabel(d) : '&nbsp;') + '</p></div>' +
      (S.status ? '<span class="km-status" role="status">' + esc(S.status) + '</span>' : '') + '</header>' +
      (demo ? '<div class="km-demo">Data contoh, bukan isi kesepakatan asli.' + (conn ? '' : ' Hubungkan dulu di Kantong untuk melihat data kalian.') +
        (adaSimulasi() ? ' <button type="button" id="demo-reset">Kembalikan data contoh</button>' : '') + '</div>' : '') +
      (d && d.menunggu_ttd ? '<div class="km-banner" role="status">' + ICON.pen + '<span>' + d.menunggu_ttd + ' lembar menunggu tanda tanganmu</span></div>' : '') +
      '<form class="km-search" role="search" id="cari-form"><label for="cari" class="hidden">Cari pasal</label>' + ICON.search +
      '<input class="input" id="cari" type="search" placeholder="Cari kata atau nomor pasal" autocomplete="off" enterkeyhint="search" value="' + esc(S.q) + '">' +
      '<button type="button" class="clear' + (S.q ? '' : ' hidden') + '" id="cari-x" aria-label="Hapus pencarian">' + ICON.x + '</button></form>' +
      '<div class="chips" role="group" aria-label="Filter">' + FIL.map(function (f) {
        return '<button type="button" class="chip" data-filter="' + f[0] + '" aria-pressed="' + (S.filter === f[0]) + '">' + f[1] + '</button>';
      }).join('') + '</div>' +
      (S.q.trim() ? '' : '<div class="seg" role="group" aria-label="Modul"><button type="button" data-tab="kesepakatan" aria-pressed="' + (S.tab !== 'definisi') + '">Kesepakatan</button>' +
        '<button type="button" data-tab="definisi" aria-pressed="' + (S.tab === 'definisi') + '">Definisi A–Z</button></div>') +
      '<button type="button" class="btn baru" id="pasal-baru"' + (S.data ? '' : ' disabled') + '>+ Pasal baru</button>' +
      '<div id="items">' + itemsHtml() + '</div>' +
      '<button type="button" class="btn ghost eval" disabled>Mulai evaluasi <span class="dev-tag">Fase berikutnya</span></button>';
  }

  // ================= halaman pasal =================
  function currentNomor() { var m = /^#p\/(\d+)/.exec(location.hash); return m ? +m[1] : 0; }
  function pasalHtml(n) {
    var p = S.data && S.data.pasal.filter(function (x) { return x.nomor === n; })[0];
    if (!p) {
      return '<div class="pasal"><div class="pasal-top"><a class="back" href="#" aria-label="Kembali ke daftar">' + ICON.back + '</a></div>' +
        (S.data ? '<p class="km-empty">Pasal ' + n + ' tidak ada.</p>' : '<p class="km-empty">Memuat…</p>') + '</div>';
    }
    var q = S.fokus ? S.q : '', sah = S.data.pengesahan[p.pengesahan_id], w = waktuLabel(p);
    var info = '';
    if (p.sumber_asal === 'pranikah') info += '<p class="info">Teks asli perjanjian pranikah. Tidak bisa diubah, bisa diberi keterangan.</p>';
    if (p.status === 'usulan') info += '<p class="info kuning">Usulan. Belum berlaku sampai ditandatangani berdua.</p>';
    else if (p.ada_usulan) info += '<p class="info kuning">Ada usulan perubahan yang menunggu tanda tangan.</p>';
    if (p.status === 'dicabut' && p.dicabut) info += '<p class="info">Dicabut ' + esc(tgl(p.dicabut.tanggal)) + (p.dicabut.alasan ? ' · Alasan: ' + esc(p.dicabut.alasan) : '') + '</p>';
    var lihat = (p.lihat_juga || []).length ? '<div class="lihat">Lihat juga: ' + p.lihat_juga.map(function (x) { return '<a href="#p/' + x + '">Pasal ' + x + '</a>'; }).join(', ') + '</div>' : '';
    var ttd = sah && sah.status === 'sah' ? '<div class="ttd" aria-label="' + esc('Disahkan ' + tgl(p.berlaku_sejak) + ' oleh ' + namaPasangan()) + '">' +
      '<figure>' + ttdSvg(sah.ttd_riki) + '<figcaption>' + esc(namaSlot('riki')) + '</figcaption></figure>' +
      '<figure>' + ttdSvg(sah.ttd_febie) + '<figcaption>' + esc(namaSlot('febie')) + '</figcaption></figure></div>' : '';
    var acts = p.terkunci ? ['+ Keterangan', 'Riwayat'] : p.status === 'usulan' ? ['Riwayat'] : ['Ubah', 'Cabut', '+ Keterangan', 'Riwayat'];
    var tarik = p.status === 'usulan' && p.sumber_asal === 'app' ? '<button type="button" class="btn small ghost" id="tarik" data-id="' + esc(p.id) + '">Tarik usulan</button>' : '';
    return '<article class="pasal' + (p.status === 'dicabut' ? ' dicabut' : '') + '" aria-labelledby="pasal-judul">' +
      '<div class="pasal-top"><a class="back" href="#" aria-label="Kembali ke daftar">' + ICON.back + '</a><span class="no">Pasal ' + p.nomor +
      (p.tipe === 'definisi' ? ' · Definisi' : babOf(p.bab_id) ? ' · Bab ' + esc(babOf(p.bab_id).nomor) : '') + '</span></div>' +
      '<h2 id="pasal-judul">' + hl(p.judul, q) + '</h2><div class="tags">' + tags(p, true) + '</div>' +
      (p.rujukan_asli ? '<div class="rujukan">' + hl(p.rujukan_asli, q) + '</div>' : '') + info +
      '<ol class="ayat">' + p.ayat.map(function (a, i) {
        return '<li id="ayat-' + i + '"><span class="n">(' + (i + 1) + ')</span><p>' + hl(a, q) + '</p></li>';
      }).join('') + '</ol>' +
      p.keterangan.map(function (k, i) {
        return '<div class="ket" id="ket-' + i + '"><div class="lbl">Keterangan · disahkan ' + esc(tgl(k.berlaku_sejak)) + '</div><p>' + hl(k.isi, q) + '</p></div>';
      }).join('') + lihat +
      '<div class="pasal-foot"><div class="m">' + (w ? '<b>' + esc(w) + '</b>' : '') + (p.versi ? ' · Versi ' + p.versi : '') + ' · ' + esc(sumberLabel(p)) +
      (sah && sah.status === 'sah' ? '<br>Disahkan ' + esc(tgl(p.berlaku_sejak)) + ' · ' + esc(namaPasangan()) : '') + '</div>' + ttd + '</div>' +
      '<div class="pasal-acts">' + tarik + acts.map(function (a) { return '<button type="button" class="btn small" disabled>' + a + '</button>'; }).join('') +
      '<span class="cap">' + (p.status === 'usulan' ? 'Tanda tangan berdua hadir di tahap berikutnya.' : 'Ubah, cabut, keterangan & riwayat hadir di fase berikutnya.') + '</span></div></article>';
  }
  function users() { return (boot && boot.users) || [{ id: 'riki', nama: 'Riki', buku: 'riki' }, { id: 'istri', nama: 'Febie', buku: 'istri' }]; }
  function namaSlot(slot) { var u = users().filter(function (x) { return C.slotTtd(x) === slot; })[0]; return u ? u.nama : (slot === 'riki' ? 'Riki' : 'Febie'); }
  function namaPasangan() { return namaSlot('riki') + ' & ' + namaSlot('febie'); }

  // ================= form pasal baru (usulan) =================
  function bukaFormBaru(awal) {
    awal = awal || {};
    var F = { tipe: awal.tipe || 'kesepakatan', ayat: [''] };
    var babs = S.data.bab || [];
    var scrim = document.createElement('div'); scrim.className = 'scrim';
    var sh = document.createElement('div'); sh.className = 'sheet km-form'; sh.setAttribute('role', 'dialog'); sh.setAttribute('aria-modal', 'true'); sh.setAttribute('aria-labelledby', 'fb-h');
    var nomorBaru = S.data.pasal.reduce(function (m, p) { return Math.max(m, p.nomor); }, 0) + 1;   // perkiraan; nomor final dari server
    sh.innerHTML = '<div class="grab"></div><div class="sheet-h"><h3 id="fb-h">Pasal baru</h3><button type="button" class="iconbtn" data-close aria-label="Tutup">' + ICON.x + '</button></div>' +
      '<p class="fb-sub">Akan jadi <b>Pasal ' + nomorBaru + '</b> berstatus Usulan. Berlaku setelah ditandatangani berdua.</p>' +
      '<form id="fb" novalidate>' +
      '<div class="field"><span class="lbl">Jenis</span><div class="seg" role="group" aria-label="Jenis pasal">' +
        '<button type="button" data-tipe="kesepakatan">Kesepakatan</button><button type="button" data-tipe="definisi">Definisi</button></div></div>' +
      '<div class="field"><label for="fb-judul" id="fb-judul-l"></label><input class="input" id="fb-judul" maxlength="120" autocomplete="off" value="' + esc(awal.judul || '') + '"></div>' +
      '<div class="field" id="fb-bab-w"><label for="fb-bab">Bab</label><select class="input" id="fb-bab">' +
        babs.map(function (b) { return '<option value="' + esc(b.id) + '">Bab ' + esc(b.nomor) + ' – ' + esc(b.judul) + '</option>'; }).join('') +
        '<option value="__baru">+ Bab baru…</option></select>' +
        '<input class="input hidden" id="fb-bab-baru" placeholder="Nama bab baru, misal Pengasuhan Anak" maxlength="60" autocomplete="off" aria-label="Nama bab baru"></div>' +
      '<div class="field"><span class="lbl" id="fb-ayat-l">Isi ayat</span><div id="fb-ayat"></div>' +
        '<button type="button" class="btn small ghost" id="fb-ayat-add">+ Tambah ayat</button></div>' +
      '<div class="field"><label for="fb-kunci">Kata kunci <span class="opt">(opsional, pisahkan dengan koma)</span></label><input class="input" id="fb-kunci" placeholder="misal: uang, belanja" autocomplete="off"></div>' +
      '<div class="field"><label for="fb-alasan">Alasan <span class="opt">(opsional)</span></label><input class="input" id="fb-alasan" placeholder="Kenapa pasal ini perlu" autocomplete="off"></div>' +
      '<p class="fb-err" id="fb-err" role="alert"></p>' +
      '<button type="submit" class="btn">Simpan sebagai usulan</button></form>';
    document.body.appendChild(scrim); document.body.appendChild(sh);
    requestAnimationFrame(function () { scrim.classList.add('show'); sh.classList.add('show'); });
    var prevFocus = document.activeElement;
    function tutup() {
      scrim.classList.remove('show'); sh.classList.remove('show');
      document.removeEventListener('keydown', onKey);
      setTimeout(function () { scrim.remove(); sh.remove(); if (prevFocus && prevFocus.focus) prevFocus.focus(); }, 280);
    }
    function onKey(e) { if (e.key === 'Escape') tutup(); }
    document.addEventListener('keydown', onKey);
    scrim.addEventListener('click', tutup);
    $('[data-close]', sh).addEventListener('click', tutup);
    function syncAyat() { $$('#fb-ayat textarea', sh).forEach(function (t, i) { F.ayat[i] = t.value; }); }
    function drawAyat() {
      $('#fb-ayat', sh).innerHTML = F.ayat.map(function (a, i) {
        return '<div class="fb-ayat"><span class="n">(' + (i + 1) + ')</span><textarea class="input" rows="2" aria-label="Ayat ' + (i + 1) + '" placeholder="' +
          (i ? 'Ayat berikutnya' : F.tipe === 'definisi' ? 'misal: Selingkuh adalah …' : 'misal: Kami sepakat …') + '">' + esc(a) + '</textarea>' +
          (F.ayat.length > 1 ? '<button type="button" class="iconbtn" data-del="' + i + '" aria-label="Hapus ayat ' + (i + 1) + '">' + ICON.x + '</button>' : '') + '</div>';
      }).join('');
      $$('[data-del]', sh).forEach(function (b) { b.addEventListener('click', function () { syncAyat(); F.ayat.splice(+b.getAttribute('data-del'), 1); drawAyat(); }); });
    }
    function drawTipe() {
      var def = F.tipe === 'definisi';
      $$('[data-tipe]', sh).forEach(function (b) { b.setAttribute('aria-pressed', String(b.getAttribute('data-tipe') === F.tipe)); });
      $('#fb-judul-l', sh).textContent = def ? 'Istilah' : 'Judul';
      $('#fb-judul', sh).placeholder = def ? 'misal: Waktu pribadi' : 'misal: Tabungan darurat';
      $('#fb-bab-w', sh).classList.toggle('hidden', def);
      drawAyat();
    }
    $$('[data-tipe]', sh).forEach(function (b) { b.addEventListener('click', function () { syncAyat(); F.tipe = b.getAttribute('data-tipe'); drawTipe(); }); });
    var sel = $('#fb-bab', sh), babBaru = $('#fb-bab-baru', sh);
    if (!babs.length) sel.value = '__baru';
    function syncBab() { babBaru.classList.toggle('hidden', sel.value !== '__baru'); }
    sel.addEventListener('change', function () { syncBab(); if (sel.value === '__baru') babBaru.focus(); });
    syncBab();
    $('#fb-ayat-add', sh).addEventListener('click', function () { syncAyat(); F.ayat.push(''); drawAyat(); var t = $$('#fb-ayat textarea', sh); t[t.length - 1].focus(); });
    drawTipe();
    $('#fb', sh).addEventListener('submit', function (e) {
      e.preventDefault(); syncAyat();
      var errEl = $('#fb-err', sh), btn = $('#fb button[type=submit]', sh);
      errEl.textContent = ''; btn.disabled = true; btn.textContent = 'Menyimpan…';
      aksi('komitmen.usul_baru', {
          tipe: F.tipe, judul: $('#fb-judul', sh).value, ayat: F.ayat,
          bab_id: sel.value === '__baru' ? '' : sel.value, bab_baru: sel.value === '__baru' ? babBaru.value : '',
          kata_kunci: $('#fb-kunci', sh).value, alasan: $('#fb-alasan', sh).value
        }).then(function (r) {
          tutup(); S.q = ''; S.fokus = null; prevFocus = null;
          toast('Usulan Pasal ' + r.nomor + ' tersimpan');
          if (location.hash === '#p/' + r.nomor) render(); else location.hash = '#p/' + r.nomor;
        }, function (ex) { errEl.textContent = ex.message; btn.disabled = false; btn.textContent = 'Simpan sebagai usulan'; });
    });
    setTimeout(function () { $('#fb-judul', sh).focus(); }, 300);
  }

  // ================= render & event =================
  var root = $('#km');
  function render() {
    var n = currentNomor();
    root.setAttribute('data-view', n ? 'pasal' : 'list');
    var y = window.scrollY;
    root.innerHTML = '<div class="km-list">' + listHtml() + '</div><div class="km-detail">' +
      (n ? pasalHtml(n) : '<div class="km-empty"><p>Pilih pasal untuk membaca isinya.</p></div>') + '</div>';
    bind();
    if (!n) window.scrollTo(0, y);
  }
  function renderItems() { // ketik di kolom cari: hanya daftar yang diperbarui, fokus input tetap
    var it = $('#items'); if (!it) return render();
    it.innerHTML = itemsHtml();
    $('#cari-x').classList.toggle('hidden', !S.q);
    var seg = $('.km-list .seg');
    if (!!S.q.trim() === !!seg) { var v = $('#cari').value, pos = $('#cari').selectionStart; render(); var c = $('#cari'); c.focus(); c.value = v; c.setSelectionRange(pos, pos); return; }
    bindRows();
  }
  function bindRows() {
    var uc = $('#usul-dari-cari', root); if (uc) uc.addEventListener('click', function () { bukaFormBaru({ judul: S.q.trim() }); });
    $$('.row[data-fokus]', root).forEach(function (a) {
      a.addEventListener('click', function () { try { S.fokus = JSON.parse(a.getAttribute('data-fokus')); } catch (e) { S.fokus = null; } });
    });
    $$('.row:not([data-fokus])', root).forEach(function (a) { a.addEventListener('click', function () { S.fokus = null; }); });
    $$('[data-az]', root).forEach(function (b) { b.addEventListener('click', function () {
      var el = document.getElementById('az-' + b.getAttribute('data-az')); if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }); });
  }
  function bind() {
    var inp = $('#cari');
    inp.addEventListener('input', function () { S.q = inp.value; renderItems(); });
    $('#cari-form').addEventListener('submit', function (e) {
      e.preventDefault();
      if (!S.q.trim() || !S.data) return;
      var hits = C.cariKomitmen(S.data.pasal, S.q).filter(function (h) { return lolosFilter(h.pasal); });
      var n = C.nomorDariKueri(S.q), ada = n && S.data.pasal.filter(function (p) { return p.nomor === n; })[0];
      if (ada && (!hits.length || hits[0].tingkat !== 0)) { S.fokus = null; location.hash = '#p/' + n; inp.blur(); return; }
      if (hits.length) { S.fokus = hits[0].tingkat === 0 ? null : hits[0].lokasi[0]; location.hash = '#p/' + hits[0].pasal.nomor; inp.blur(); }
    });
    $('#cari-x').addEventListener('click', function () { S.q = ''; S.fokus = null; render(); $('#cari').focus(); });
    $$('[data-filter]', root).forEach(function (b) { b.addEventListener('click', function () { S.filter = b.getAttribute('data-filter'); LS.set('k_km_ui', { filter: S.filter, tab: S.tab }); render(); }); });
    $$('[data-tab]', root).forEach(function (b) { b.addEventListener('click', function () { S.tab = b.getAttribute('data-tab'); LS.set('k_km_ui', { filter: S.filter, tab: S.tab }); render(); }); });
    var bb = $('#pasal-baru'); if (bb) bb.addEventListener('click', function () { bukaFormBaru({ tipe: S.tab === 'definisi' ? 'definisi' : 'kesepakatan' }); });
    var dr = $('#demo-reset'); if (dr) dr.addEventListener('click', function () { if (confirm('Hapus semua simulasi dan kembali ke data contoh awal?')) resetDemo(); });
    var tk = $('#tarik'); if (tk) tk.addEventListener('click', function () {
      if (!confirm('Tarik usulan ini? Usulan hilang dari daftar dan lembar pengesahannya dibatalkan.')) return;
      tk.disabled = true;
      aksi('komitmen.tarik_usulan', { pasal_id: tk.getAttribute('data-id') }).then(function () { toast('Usulan ditarik'); if (location.hash) location.hash = ''; else render(); },
        function (e) { tk.disabled = false; toast(e.message); });
    });
    bindRows();
  }
  function scrollFokus() {
    var n = currentNomor(); if (!n) return;
    var det = $('.km-detail');
    if (window.matchMedia('(min-width: 900px)').matches) det.scrollTop = 0; else window.scrollTo(0, 0);
    var f = S.fokus, el = null;
    if (f && f.di === 'ayat') el = document.getElementById('ayat-' + f.idx);
    if (f && f.di === 'keterangan') el = document.getElementById('ket-' + f.idx);
    if (!el) return;
    el.scrollIntoView({ block: 'center' });
    el.classList.add('fokus'); setTimeout(function () { el.classList.remove('fokus'); }, 1600);
  }
  window.addEventListener('hashchange', function () {
    var listY = window.scrollY;
    render();
    if (currentNomor()) scrollFokus(); else { window.scrollTo(0, S.listY || 0); S.fokus = null; }
    if (currentNomor()) S.listY = S.listY || listY;
  });
  window.addEventListener('storage', function (e) { if (e.key === 'k_theme') location.reload(); });

  var ui = LS.get('k_km_ui', null);
  if (ui) { S.filter = ['semua', 'pranikah', 'usulan', 'dicabut'].indexOf(ui.filter) >= 0 ? ui.filter : 'semua'; S.tab = ui.tab === 'definisi' || ui.tab === 'az' ? 'definisi' : 'kesepakatan'; }
  load();
  if (currentNomor()) scrollFokus();
  // offline: halaman ikut cache service worker yang sama dengan app
  if ('serviceWorker' in navigator && location.protocol === 'https:') navigator.serviceWorker.register('../sw.js').catch(function () {});
})();
