// node illustrations/src/build.js → svg/light/*.svg, svg/dark/*.svg, manifest.json
const fs = require('fs');
const path = require('path');
const L = require('./lib.js');
const scenes = require('./scenes.js');

const ROOT = path.join(__dirname, '..');
const only = process.argv[2];

for (const theme of ['light', 'dark']) {
  const dir = path.join(ROOT, 'svg', theme);
  fs.mkdirSync(dir, { recursive: true });
  const T = L.THEMES[theme];
  for (const s of scenes) {
    if (only && !s.slug.includes(only)) continue;
    const out = L.svg(T, s.title, s.draw(T), { w: s.w || 320, h: s.h || 240, style: s.style ? s.style.replace(/\s+/g, ' ').trim() : '' });
    fs.writeFileSync(path.join(dir, `${s.slug}.svg`), out);
  }
}

// lembar karakter (model sheet) — referensi, bukan untuk dipakai di UI
for (const theme of ['light', 'dark']) {
  const T = L.THEMES[theme];
  const moods = ['smile', 'happy', 'wink', 'wow', 'calm', 'sleepy', 'focus', 'worry', 'sad', 'love'];
  let b = '';
  moods.forEach((m, i) => {
    const x = 56 + (i % 5) * 112, y = 70 + Math.floor(i / 5) * 128;
    b += L.shadow(T, x, y + 46, 24) + L.koin(T, { x, y, r: 28, who: i % 2 ? 'febie' : 'riki', mood: m, arms: { l: 115, r: 65 } });
  });
  fs.writeFileSync(path.join(ROOT, 'svg', theme, 'panduan-karakter.svg'), L.svg(T, 'Lembar ekspresi Riki dan Febie', b, { w: 560, h: 290 }));
}

const manifest = scenes.map(({ slug, cat, title, use, feature, w, h, style }) => ({
  slug, kategori: cat, judul: title, pakai_untuk: use, warna_latar: feature || 'transparan',
  ukuran: `${w || 320}x${h || 240}`, animasi: !!style,
}));
fs.writeFileSync(path.join(ROOT, 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n');
console.log(`${scenes.length} ilustrasi × 2 tema`);

// suntik manifest ke galeri (index.html) supaya selalu sinkron
const gal = path.join(ROOT, 'index.html');
if (fs.existsSync(gal)) {
  const html = fs.readFileSync(gal, 'utf8').replace(
    /(<script id="manifest" type="application\/json">)[\s\S]*?(<\/script>)/,
    (_, a, b) => a + JSON.stringify(manifest) + b
  );
  fs.writeFileSync(gal, html);
}

// salin ilustrasi yang DIPAKAI app ke public/ilustrasi/ (dipanggil lewat shared/ilustrasi.js)
const PAKAI = [
  'auth-masuk', 'auth-keluar', 'auth-sesi-berakhir',
  'kosong-transaksi', 'kosong-todo', 'kosong-catatan', 'kosong-jadwal', 'kosong-komitmen', 'kosong-pencarian',
  'status-offline', 'status-404', 'onboarding-05-daily-mood',
];
for (const theme of ['light', 'dark']) {
  const dst = path.join(ROOT, '..', 'public', 'ilustrasi', theme);
  fs.mkdirSync(dst, { recursive: true });
  for (const f of fs.readdirSync(dst)) if (!PAKAI.includes(f.replace(/\.svg$/, ''))) fs.unlinkSync(path.join(dst, f));
  for (const slug of PAKAI) fs.copyFileSync(path.join(ROOT, 'svg', theme, `${slug}.svg`), path.join(dst, `${slug}.svg`));
}
console.log(`${PAKAI.length} ilustrasi disalin ke public/ilustrasi/`);
