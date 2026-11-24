/* Ilustrasi (Riki & Febie si koin). Sumber & panduan: illustrations/ di root repo.
   File di public/ilustrasi/{dark,light}/ disalin oleh `node illustrations/src/build.js`.
   Dua <img> per ilustrasi, CSS (shared/ilustrasi.css) menampilkan yang cocok dengan tema:
   tanpa data-theme = gelap, data-theme="light" = terang. Gambar tersembunyi tidak diunduh (loading=lazy). */
'use strict';

var IL_ROOT = window.KANTONG_ROOT || '';

// alt kosong: teks di sebelahnya sudah menjelaskan (ilustrasi dekoratif).
function ilus(slug, size) {
  var src = function (t) { return IL_ROOT + 'ilustrasi/' + t + '/' + slug + '.svg'; };
  return '<span class="ilus' + (size ? ' ' + size : '') + '" aria-hidden="true">' +
    '<img class="il-d" src="' + src('dark') + '" alt="" width="320" height="240" loading="lazy" decoding="async">' +
    '<img class="il-l" src="' + src('light') + '" alt="" width="320" height="240" loading="lazy" decoding="async"></span>';
}

// Empty state: ilustrasi di atas pesan. cls = kelas pembungkus (default "empty").
function emptyIl(slug, pesan, opt) {
  opt = opt || {};
  return '<div class="' + (opt.cls || 'empty') + ' empty-il"' + (opt.role ? ' role="' + opt.role + '"' : '') + '>' +
    ilus(slug, opt.size) + '<p>' + pesan + '</p>' + (opt.extra || '') + '</div>';
}
