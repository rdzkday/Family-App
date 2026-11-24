/* Registry fitur Family App: satu tempat untuk menu, pintasan, dan penjaga halaman.
   Fitur aktif ditentukan admin (Panel Admin › Fitur), dikirim server lewat bootstrap (k_boot.fitur).
   Belum ada setelan (mode demo / belum sinkron) = semua aktif. Id harus sama dengan FITUR di shared/core.js.
   Mandiri (tanpa dependensi) supaya bisa dipakai juga oleh Komitmen & Daily Mood. */
(function () {
  'use strict';
  var SVG = function (d) { return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + d + '</svg>'; };
  var IKON = {
    beranda: SVG('<path d="M4 11l8-7 8 7v8a2 2 0 0 1-2 2h-3v-6h-6v6H6a2 2 0 0 1-2-2z"/>'),
    kantong: SVG('<path d="M3 7h15a3 3 0 0 1 3 3v7a3 3 0 0 1-3 3H6a3 3 0 0 1-3-3V7z"/><path d="M3 7l12-4v4"/><circle cx="16.5" cy="13.5" r="1"/>'),
    agenda: SVG('<rect x="3" y="3" width="18" height="18" rx="6"/><path d="M8 12.5l3 3 5.5-6.5"/>'),
    komitmen: SVG('<path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10z"/>'),
    mood: SVG('<path d="M5 4h11a3 3 0 0 1 3 3v13H8a3 3 0 0 1-3-3V4z"/><path d="M5 17a3 3 0 0 1 3-3h11"/>')
  };
  // urutan = urutan di menu. warna: token di shared/tokens.css
  var DAFTAR = [
    { id: 'kantong', nama: 'Kantong', label: 'Kantong', path: 'kantong/', warna: '--br-kantong', bg: '--br-kantong-bg', ket: 'Catatan keuangan' },
    { id: 'agenda', nama: 'Agenda', label: 'Agenda', path: 'agenda/', warna: '--br-agenda', bg: '--br-agenda-bg', ket: 'To-do, catatan, jadwal' },
    { id: 'komitmen', nama: 'Komitmen', label: 'Komitmen', path: 'komitmen/', warna: '--br-komit', bg: '--br-komit-bg', ket: 'Kesepakatan berdua' },
    { id: 'mood', nama: 'Daily Mood', label: 'Mood', path: 'daily-mood/', warna: '--br-catat', bg: '--br-catat-bg', ket: 'Jurnal mood + Couple Journaling' }
  ];

  function root() { return window.KANTONG_ROOT != null ? window.KANTONG_ROOT : ''; }
  function setelan() {
    try { var b = JSON.parse(localStorage.getItem('k_boot')); return (b && b.fitur) || null; } catch (e) { return null; }
  }
  function aktif(id) { var s = setelan(); return !s || s[id] !== false; }
  function info(id) { return DAFTAR.filter(function (f) { return f.id === id; })[0] || null; }
  function url(id) { if (id === 'beranda') return root() || './'; var f = info(id); return f ? root() + f.path : root() || './'; }
  function daftar() { return DAFTAR.filter(function (f) { return aktif(f.id); }); }

  // Menu bawah: Beranda + fitur aktif. sekarang = id halaman yang sedang dibuka.
  function navHtml(sekarang) {
    var item = [{ id: 'beranda', label: 'Beranda' }].concat(daftar());
    return '<nav class="br-nav" aria-label="Menu utama" style="--n:' + item.length + '">' + item.map(function (f) {
      return '<a href="' + url(f.id) + '"' + (f.id === sekarang ? ' aria-current="page"' : '') + '><span class="ic">' + IKON[f.id] + '</span><span>' + f.label + '</span></a>';
    }).join('') + '</nav>';
  }
  // Pintasan bergaya ikon berwarna (Beranda)
  function ikonHtml(id) {
    var f = info(id);
    return '<span class="br-ic" style="--c:var(' + f.warna + ');--cb:var(' + f.bg + ')">' + IKON[id] + '</span>';
  }
  // Halaman fitur nonaktif: ganti isi el dengan pesan + tombol ke Beranda. Return true kalau aktif.
  function jaga(id, el) {
    if (aktif(id)) return true;
    var f = info(id);
    (el || document.body).innerHTML = '<div class="fitur-off"><h1>' + (f ? f.nama : 'Fitur') + ' tidak aktif</h1>' +
      '<p>Fitur ini dimatikan oleh admin. Minta admin menyalakannya di Panel Admin.</p>' +
      '<a class="fitur-off-btn" href="' + url('beranda') + '">Ke Beranda</a></div>' + navHtml('');
    return false;
  }

  window.Fitur = { DAFTAR: DAFTAR, IKON: IKON, aktif: aktif, info: info, url: url, daftar: daftar, navHtml: navHtml, ikonHtml: ikonHtml, jaga: jaga };
})();
