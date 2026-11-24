/* Onboarding: pengenalan fitur, tampil sekali per HP setelah masuk (akun atau demo).
   Slide mengikuti fitur aktif dari admin (shared/fitur.js). Buka lagi: Pengaturan › Umum › Panduan aplikasi.
   Butuh: base.js (LS, $), ilustrasi.js (ilus), fitur.js (Fitur). */
'use strict';

var Onboarding = (function () {
  var VERSI = 1;               // naikkan kalau isi onboarding berubah besar → tampil lagi sekali
  var KEY = 'k_onboard';
  var CEK = '<svg viewBox="0 0 16 16" fill="none" aria-hidden="true"><path d="M3.5 8.5l3 3 6-7" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg>';
  var TETES = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 3.5c3 3.6 6 7 6 10.5a6 6 0 0 1-12 0c0-3.5 3-6.9 6-10.5z"/></svg>';
  var AWAN = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M7 18a4 4 0 0 1-.6-8A6 6 0 0 1 18 9.5a4.3 4.3 0 0 1-.5 8.5z"/><path d="M9.5 13.5l2 2 3.5-4"/></svg>';

  // fitur: null = selalu tampil. warna: token di tokens.css
  var SLIDE = [
    { il: 'onboarding-01-selamat-datang', warna: '--br-kantong', fitur: null,
      judul: 'Rumah tangga, diurus berdua',
      isi: 'Family App menyatukan keuangan, agenda, dan kesepakatan kalian dalam satu tempat. Geser untuk kenalan dengan fiturnya.' },
    { il: 'onboarding-02-kantong', fitur: 'kantong',
      judul: 'Uang keluar-masuk, jelas berdua',
      poin: ['Catat pengeluaran, pemasukan, dan transfer dalam hitungan detik',
        'Buku pribadi masing-masing plus buku Rumah Tangga',
        'Budget bulanan, talangan & reimburse, ringkasan per kategori'] },
    { il: 'onboarding-03-agenda', fitur: 'agenda',
      judul: 'To-do & jadwal bersama',
      poin: ['To-do untukku, bersama, atau semua',
        'Catatan yang bisa dibaca berdua',
        'Kalender agenda, bisa tersambung ke Google Calendar'] },
    { il: 'onboarding-siklus', fitur: 'agenda', nama: 'Siklus', ikon: TETES, warna: '--br-siklus',
      judul: 'Siklus haid di kalender',
      poin: ['Tandai hari pertama haid, perkiraan berikutnya dihitung otomatis',
        'Pemiliknya yang atur: tampil atau sembunyi, dibagikan atau tidak',
        'Tidak pernah masuk Google Calendar'] },
    { il: 'onboarding-04-komitmen', fitur: 'komitmen',
      judul: 'Kesepakatan berbentuk pasal',
      poin: ['Tulis kesepakatan & definisi seperti pasal, gampang dicari',
        'Berlaku setelah ditandatangani berdua',
        'Riwayat tiap pasal tersimpan, tidak ada yang hilang'] },
    { il: 'onboarding-05-daily-mood', fitur: 'mood',
      judul: 'Jurnal mood, hanya untukmu',
      poin: ['Pilih mood harian dan tulis yang kamu rasakan',
        'Kalender mood dan rangkuman periode, bisa diunduh PDF',
        'Pribadi: pasangan tidak bisa membaca'] },
    { il: 'onboarding-06-offline', fitur: null, nama: 'Offline & sinkron', ikon: AWAN, warna: '--br-agenda',
      judul: 'Tetap jalan tanpa sinyal',
      poin: ['Catatan masuk antrean di HP saat offline',
        'Terkirim otomatis begitu online, tanpa data dobel',
        'Pasang di layar utama HP supaya terasa seperti aplikasi'] },
  ];

  var el = null, idx = 0, daftar = [], fokusAsal = null;

  function slides() {
    return SLIDE.filter(function (s) { return !s.fitur || Fitur.aktif(s.fitur); }).map(function (s) {
      var f = s.fitur ? Fitur.info(s.fitur) : null;
      return {
        il: s.il, judul: s.judul, isi: s.isi, poin: s.poin,
        nama: s.nama || (f && f.nama) || '', ikon: s.ikon || (f && Fitur.IKON[f.id]) || '',
        warna: s.warna || (f && f.warna) || '--br-kantong',
      };
    });
  }

  function slideHtml(s, i) {
    var akhir = i === daftar.length - 1;
    return '<div class="ob-stage ob-in" style="--c:var(' + s.warna + ')">' +
      '<div class="ob-art">' + ilus(s.il) + '</div>' +
      '<div class="ob-txt">' +
        (s.nama ? '<span class="ob-chip">' + s.ikon + s.nama + '</span>' : '') +
        '<h1 id="ob-t" tabindex="-1">' + s.judul + '</h1>' +
        (s.isi ? '<p class="ob-isi">' + s.isi + '</p>' : '') +
        (s.poin ? '<ul class="ob-poin">' + s.poin.map(function (p) { return '<li>' + CEK + '<span>' + p + '</span></li>'; }).join('') + '</ul>' : '') +
      '</div></div>' +
      '<div class="ob-bot" style="--c:var(' + s.warna + ')">' +
        '<div class="ob-dots" aria-hidden="true">' + daftar.map(function (_, j) { return '<i' + (j === i ? ' class="on"' : '') + '></i>'; }).join('') + '</div>' +
        '<div class="ob-btns">' +
          (i ? '<button type="button" class="btn ghost" data-ob="prev">Kembali</button>' : '') +
          '<button type="button" class="btn ob-next" data-ob="' + (akhir ? 'done' : 'next') + '">' + (akhir ? 'Mulai pakai' : 'Lanjut') + '</button>' +
        '</div></div>';
  }

  function render(fokus) {
    var s = daftar[idx];
    $('.ob-step', el).textContent = (idx + 1) + ' dari ' + daftar.length;
    $('.ob-skip', el).hidden = idx === daftar.length - 1;
    $('.ob-body', el).innerHTML = slideHtml(s, idx);
    if (fokus !== false) { var h = $('#ob-t', el); if (h) h.focus({ preventScroll: true }); }
  }

  function ke(i) {
    if (i < 0 || i >= daftar.length || i === idx) return;
    idx = i; render();
  }

  function tutup() {
    if (!el) return;
    LS.set(KEY, VERSI);
    el.remove(); el = null;
    document.body.classList.remove('ob-open');
    document.removeEventListener('keydown', onKey, true);
    if (fokusAsal && fokusAsal.focus) fokusAsal.focus();
  }

  function onKey(e) {
    if (!el) return;
    if (e.key === 'Escape') { e.preventDefault(); tutup(); return; }
    if (e.key === 'ArrowRight') { e.preventDefault(); ke(idx + 1); return; }
    if (e.key === 'ArrowLeft') { e.preventDefault(); ke(idx - 1); return; }
    if (e.key === 'Tab') {   // fokus tetap di dalam dialog
      var f = Array.prototype.slice.call(el.querySelectorAll('button:not([hidden]), [tabindex="-1"]'));
      if (!f.length) return;
      var a = f[0], z = f[f.length - 1];
      if (e.shiftKey && document.activeElement === a) { e.preventDefault(); z.focus(); }
      else if (!e.shiftKey && document.activeElement === z) { e.preventDefault(); a.focus(); }
    }
  }

  function buka() {
    if (el) return;
    daftar = slides(); idx = 0;
    fokusAsal = document.activeElement;
    el = document.createElement('div');
    el.className = 'ob';
    el.setAttribute('role', 'dialog');
    el.setAttribute('aria-modal', 'true');
    el.setAttribute('aria-labelledby', 'ob-t');
    el.innerHTML = '<div class="ob-top"><span class="ob-step"></span><button type="button" class="ob-skip" data-ob="skip">Lewati</button></div>' +
      '<div class="ob-body" aria-live="polite"></div>';
    document.body.appendChild(el);
    document.body.classList.add('ob-open');
    el.addEventListener('click', function (e) {
      var b = e.target.closest('[data-ob]'); if (!b) return;
      var a = b.getAttribute('data-ob');
      if (a === 'next') ke(idx + 1);
      if (a === 'prev') ke(idx - 1);
      if (a === 'skip' || a === 'done') tutup();
    });
    // geser kiri/kanan di layar sentuh
    var x0 = null, y0 = 0;
    el.addEventListener('pointerdown', function (e) { if (e.pointerType !== 'mouse') { x0 = e.clientX; y0 = e.clientY; } });
    el.addEventListener('pointerup', function (e) {
      if (x0 == null) return;
      var dx = e.clientX - x0, dy = e.clientY - y0; x0 = null;
      if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy) * 1.5) ke(idx + (dx < 0 ? 1 : -1));
    });
    document.addEventListener('keydown', onKey, true);
    render();
  }

  // Dipanggil renderShell: tampil sekali setelah masuk.
  function otomatis() {
    if (el || !S.conn || LS.get(KEY, 0) >= VERSI) return;
    buka();
  }

  return { buka: buka, tutup: tutup, otomatis: otomatis };
})();
