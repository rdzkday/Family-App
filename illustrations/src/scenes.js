// Daftar ilustrasi. Kanvas 320×240, tanah y≈208, cahaya dari kiri-atas.
// Tiap entri: slug (nama file), kategori, judul (alt text), saran pakai, fitur (warna latar), draw(T).
const L = require('./lib.js');
const P = require('./props.js');
const { circle, ellipse, rect, line, path, stroke, g, shadow, backdrop, sparkle, heart, koin, kantong, coin, card, checkbox, f } = L;

const GROUND = 208;
const dust = (T, x, y, s = 1) => g(circle(0, 0, 5, T.paperD) + circle(7, -2, 6.5, T.paperD) + circle(14, 1, 4.5, T.paperD), `transform="translate(${x} ${y}) scale(${s})" opacity=".9"`);
const dashLine = (d, c, w = 2.5) => stroke(d, c, w, `stroke-dasharray="1 7"`);

// kartu mini: ringkasan budget (donut + bar)
function budgetCard(T, x, y, w, h) {
  let s = rect(0, 3, w, h, 12, T.paperD) + rect(0, 0, w, h, 12, T.paper);
  s += P.donut(T, 22, h / 2, 12, [[5, T.mint], [3, T.sky], [2, T.amber]], 7);
  s += rect(44, 14, w - 56, 6, 3, T.sub) + rect(44, 26, w - 56, 8, 4, T.paperD) + rect(44, 26, (w - 56) * 0.62, 8, 4, T.mint);
  s += rect(44, 40, (w - 56) * 0.5, 5, 2.5, T.sub);
  return g(s, `transform="translate(${x} ${y})"`);
}

const scenes = [
  // ───────────── LOADING (animasi) ─────────────
  {
    slug: 'loading-kantong', cat: 'Loading', feature: 'kantong',
    title: 'Koin berjatuhan masuk ke Kantong',
    use: 'Layar memuat penuh (splash / "Memuat data…").',
    style: `
      .c{animation:drop 1.8s cubic-bezier(.5,0,.75,.4) infinite;opacity:0}
      .c2{animation-delay:.6s}.c3{animation-delay:1.2s}
      @keyframes drop{0%{transform:translateY(-40px);opacity:0}15%{opacity:1}55%{transform:translateY(46px);opacity:1}62%{transform:translateY(54px);opacity:0}100%{opacity:0}}
      .k{animation:squash 1.8s ease-in-out infinite;transform-origin:160px 196px}
      @keyframes squash{0%,52%,100%{transform:scale(1,1)}60%{transform:scale(1.04,.96)}70%{transform:scale(.98,1.02)}}
      @media (prefers-reduced-motion:reduce){.c,.k{animation:none}.c{opacity:1}}`,
    draw: (T) =>
      backdrop(T, 'kantong') + shadow(T, 160, 198, 52) +
      g(coin(T, 160, 58, 13, 'amber'), 'class="c"') + g(coin(T, 160, 58, 13, 'riki'), 'class="c c2"') + g(coin(T, 160, 58, 13, 'febie'), 'class="c c3"') +
      g(kantong(T, { x: 116, y: 88, w: 88, h: 108 }), 'class="k"') +
      sparkle(84, 70, 8, T.amber) + sparkle(242, 96, 6, T.mint) + circle(232, 58, 3, T.lav) + circle(92, 132, 3, T.sky),
  },
  {
    slug: 'loading-sinkron', cat: 'Loading', feature: 'agenda',
    title: 'Riki dan Febie mengoper koin bolak-balik',
    use: 'Sedang sinkron antrean offline ke server.',
    style: `
      .r{animation:bob 1.6s ease-in-out infinite}.fb{animation:bob 1.6s ease-in-out infinite .8s}
      @keyframes bob{0%,100%{transform:translateY(0)}50%{transform:translateY(-6px)}}
      @media (prefers-reduced-motion:reduce){.r,.fb{animation:none}}`,
    draw: (T) => {
      const arc = 'M100 120Q160 34 220 120';
      return backdrop(T, 'agenda') + shadow(T, 92, GROUND, 30) + shadow(T, 228, GROUND, 30) +
        dashLine(arc, T.skyD, 3) +
        g(koin(T, { x: 92, y: 170, who: 'riki', mood: 'happy', arms: { l: 120, r: -40 } }), 'class="r"') +
        g(koin(T, { x: 228, y: 170, who: 'febie', mood: 'happy', arms: { l: -40, r: 60 } }), 'class="fb"') +
        g(coin(T, 0, 0, 11, 'amber') + `<animateMotion dur="1.6s" repeatCount="indefinite" path="${arc}" keyPoints="0;1;0" keyTimes="0;.5;1" calcMode="spline" keySplines=".45 0 .55 1;.45 0 .55 1"/>`) +
        sparkle(160, 150, 6, T.amber) + circle(52, 80, 3, T.lav) + circle(270, 70, 3, T.mint);
    },
  },
  {
    slug: 'loading-mini', cat: 'Loading', feature: null, w: 120, h: 56,
    title: 'Dua koin memantul bergantian',
    use: 'Loader kecil di tombol/kartu (ganti spinner). Ukuran 120×56.',
    style: `
      .a{animation:hop .9s ease-in-out infinite}.b{animation:hop .9s ease-in-out infinite .45s}
      @keyframes hop{0%,100%{transform:translateY(0)}45%{transform:translateY(-12px)}}
      @media (prefers-reduced-motion:reduce){.a,.b{animation:none}}`,
    draw: (T) =>
      ellipse(42, 50, 12, 2.5, T.shadow) + ellipse(78, 50, 12, 2.5, T.shadow) +
      g(koin(T, { x: 42, y: 32, r: 14, who: 'riki', mood: 'happy', arms: {}, legs: false }), 'class="a"') +
      g(koin(T, { x: 78, y: 32, r: 14, who: 'febie', mood: 'happy', arms: {}, legs: false }), 'class="b"'),
  },

  // ───────────── ONBOARDING ─────────────
  {
    slug: 'onboarding-01-selamat-datang', cat: 'Onboarding', feature: 'kantong',
    title: 'Riki dan Febie menyapa di depan Kantong',
    use: 'Onboarding 1 — "Selamat datang di Family App".',
    draw: (T) =>
      backdrop(T, 'kantong') + shadow(T, 160, 184, 50) +
      kantong(T, { x: 118, y: 66, w: 84, h: 116 }) +
      heart(160, 40, 26, T.coral) + sparkle(130, 34, 6, T.amber) + sparkle(194, 46, 5, T.amber) +
      shadow(T, 92, GROUND, 30) + shadow(T, 228, GROUND, 30) +
      koin(T, { x: 92, y: 170, who: 'riki', mood: 'happy', arms: { l: -70, r: 80 } }) +
      koin(T, { x: 228, y: 170, who: 'febie', mood: 'happy', arms: { l: 100, r: -70 } }) +
      sparkle(40, 96, 7, T.mint) + circle(282, 92, 3.5, T.lav) + circle(56, 150, 3, T.sky),
  },
  {
    slug: 'onboarding-02-kantong', cat: 'Onboarding', feature: 'kantong',
    title: 'Riki memasukkan koin ke Kantong, kartu budget melayang',
    use: 'Onboarding 2 — Kantong: catat uang & budget berdua.',
    draw: (T) =>
      backdrop(T, 'kantong', { seed: 5 }) + shadow(T, 110, 200, 50) +
      kantong(T, { x: 66, y: 82, w: 90, h: 116 }) +
      coin(T, 126, 62, 11, 'amber') + coin(T, 100, 44, 9, 'amber') +
      budgetCard(T, 182, 30, 112, 58) +
      shadow(T, 238, GROUND, 30) +
      koin(T, { x: 238, y: 170, who: 'riki', mood: 'happy', look: -1, arms: { l: { a: -35, len: 0.9 }, r: 70 }, hands: { l: (x, y) => coin(T, x - 6, y - 8, 10, 'amber') } }) +
      sparkle(46, 60, 6, T.mint) + circle(170, 120, 3, T.sky),
  },
  {
    slug: 'onboarding-03-agenda', cat: 'Onboarding', feature: 'agenda',
    title: 'Daftar to-do bersama, Febie mencentang dengan pensil besar',
    use: 'Onboarding 3 — Agenda: to-do, catatan, jadwal.',
    draw: (T) => {
      let list = rect(0, 5, 120, 146, 14, T.paperD) + rect(0, 0, 120, 146, 14, T.paper) + path('M0 14Q0 0 14 0H106Q120 0 120 14V28H0Z', T.sky);
      [0, 1, 2].forEach((i) => {
        const yy = 44 + i * 32;
        list += checkbox(T, 14, yy, 18, i < 2, T.sky) + rect(42, yy + 3, i === 1 ? 50 : 62, 6, 3, T.sub) + rect(42, yy + 12, 34, 4, 2, T.paperD);
        if (i < 2) list += circle(102, yy + 9, 5, i ? T.febieL : T.rikiL);
      });
      return backdrop(T, 'agenda') +
        P.calendar(T, 26, 44, 58, 54, T.sky, { marks: [2, 5], heartAt: 9, cols: 4, rows: 3, tilt: -8 }) +
        g(list, 'transform="translate(100 34)"') +
        shadow(T, 66, GROUND, 26) + shadow(T, 258, GROUND, 28) +
        koin(T, { x: 66, y: 176, r: 26, who: 'riki', mood: 'happy', arms: { l: -60, r: -120 } }) +
        koin(T, { x: 258, y: 172, r: 28, who: 'febie', mood: 'focus', look: -1, arms: { l: { a: -20, len: 0.85 }, r: 70 }, hands: { l: { behind: (x, y) => P.pencil(T, x + 14, y + 6, 64, 200, T.amber) } } }) +
        sparkle(286, 64, 6, T.amber) + circle(48, 132, 3, T.lav);
    },
  },
  {
    slug: 'onboarding-04-komitmen', cat: 'Onboarding', feature: 'komit',
    title: 'Lembar kesepakatan ditandatangani berdua',
    use: 'Onboarding 4 — Komitmen: pasal & tanda tangan berdua.',
    draw: (T) => {
      let doc = rect(0, 5, 124, 160, 12, T.paperD) + rect(0, 0, 124, 160, 12, T.paper);
      doc += circle(62, 24, 11, T.amber) + heart(62, 24, 10, T.ink, 'opacity=".8"');
      [46, 58, 70, 82].forEach((yy, i) => (doc += rect(16, yy, i % 2 ? 72 : 92, 5, 2.5, T.sub)));
      doc += P.signature(T, 14, 112, 40, T.rikiD, 1) + P.signature(T, 70, 112, 40, T.febieD, 2);
      doc += rect(14, 134, 42, 3, 1.5, T.paperD) + rect(68, 134, 42, 3, 1.5, T.paperD);
      return backdrop(T, 'komit') + g(doc, 'transform="translate(98 24) rotate(-2 62 80)"') +
        g(circle(0, 2.5, 17, T.amberD) + circle(0, 0, 17, T.amber) + circle(0, 0, 12, 'none', `stroke="${T.amberD}" stroke-width="2" stroke-dasharray="3 3"`) + heart(0, 0, 12, T.coral), 'transform="translate(216 168) rotate(-12)"') +
        shadow(T, 64, GROUND, 28) + shadow(T, 268, GROUND, 26) +
        koin(T, { x: 64, y: 170, who: 'riki', mood: 'smile', look: 1, arms: { l: 110, r: { a: -30, len: 0.9 } }, hands: { r: { behind: (x, y) => P.pencil(T, x - 4, y + 4, 42, -40, T.riki, { shade: T.rikiD }) } } }) +
        koin(T, { x: 268, y: 174, r: 26, who: 'febie', mood: 'happy', look: -1, arms: { l: -50, r: 70 } }) +
        sparkle(272, 62, 7, T.amber) + sparkle(56, 70, 5, T.amber) + circle(292, 110, 3, T.coral);
    },
  },
  {
    slug: 'onboarding-05-daily-mood', cat: 'Onboarding', feature: 'catat',
    title: 'Febie duduk menulis jurnal, wajah mood melayang',
    use: 'Onboarding 5 — Daily Mood: jurnal mood harian (pribadi).',
    draw: (T) => {
      let faces = '';
      [1, 2, 3, 4, 5].forEach((l, i) => {
        const x = 88 + i * 36, y = 52 + Math.abs(i - 2) * 9, big = l === 4;
        faces += P.moodFace(T, x, y, big ? 15 : 11, l);
        if (big) faces += circle(x, y, 20, 'none', `stroke="${T.lavD}" stroke-width="2.5" stroke-dasharray="2 5" stroke-linecap="round"`);
      });
      return backdrop(T, 'catat') + faces +
        shadow(T, 160, 204, 48) +
        ellipse(160, 198, 46, 10, T.lavD) + ellipse(160, 194, 46, 10, T.lav) +
        koin(T, { x: 160, y: 148, r: 34, who: 'febie', mood: 'calm', legs: 'sit', arms: { l: { a: 75, len: 0.78 }, r: { a: 105, len: 0.78 } },
          extra: (r) => P.openBook(T, 0, r * 1.08, 48, 20, T.lav, T.lavD, { lines: false }) }) +
        P.plant(T, 264, 186, 0.9) + sparkle(58, 110, 6, T.amber) + circle(262, 110, 3, T.febie);
    },
  },
  {
    slug: 'onboarding-06-offline', cat: 'Onboarding', feature: 'agenda',
    title: 'HP tetap mencatat, data naik ke awan saat online',
    use: 'Onboarding 6 — Offline & sinkron otomatis.',
    draw: (T) => {
      let scr = '';
      [0, 1, 2, 3].forEach((i) => {
        const yy = 26 + i * 22;
        scr += rect(6, yy, 46, 16, 5, T.paperD) + circle(14, yy + 8, 4, i < 2 ? T.mint : T.amber) + rect(22, yy + 6, 24, 4, 2, T.sub);
      });
      return backdrop(T, 'agenda', { seed: 7 }) + shadow(T, 104, 200, 40) +
        P.phone(T, 72, 54, 64, 140, scr, { tilt: -6 }) +
        dashLine('M140 96Q166 44 192 62', T.skyD, 3) + path('M186 54L198 66L183 68Z', T.skyD) +
        P.cloud(T, 236, 70, 92) + P.arrowsCycle(T, 240, 76, 13, T.skyD, 4.5) +
        shadow(T, 240, GROUND, 28) +
        koin(T, { x: 240, y: 172, r: 28, who: 'riki', mood: 'happy', arms: { l: -40, r: 60 } }) +
        sparkle(48, 70, 6, T.amber) + circle(288, 136, 3, T.lav);
    },
  },
  {
    slug: 'onboarding-07-siap', cat: 'Onboarding', feature: 'kantong',
    title: 'Riki dan Febie melompat gembira, konfeti',
    use: 'Onboarding terakhir / setup selesai — "Siap mulai!".',
    draw: (T) =>
      backdrop(T, 'kantong', { seed: 9 }) + P.confetti(T, 160, 96, 130, 76, 3, 22) +
      heart(160, 56, 30, T.coral) + sparkle(134, 44, 6, T.amber) + sparkle(188, 40, 7, T.amber) +
      ellipse(116, GROUND, 22, 3.5, T.shadow) + ellipse(204, GROUND, 22, 3.5, T.shadow) +
      koin(T, { x: 116, y: 134, who: 'riki', mood: 'happy', legs: 'jump', tilt: -8, arms: { l: -60, r: -110 } }) +
      koin(T, { x: 204, y: 128, who: 'febie', mood: 'happy', legs: 'jump', tilt: 8, arms: { l: -110, r: -60 } }),
  },

  // ───────────── LOGIN / LOGOUT ─────────────
  {
    slug: 'auth-masuk', cat: 'Login & Akun', feature: 'agenda',
    title: 'Riki membawa kunci besar ke Kantong yang digembok',
    use: 'Halaman login / hubungkan akun.',
    draw: (T) =>
      backdrop(T, 'agenda', { seed: 11 }) + shadow(T, 172, 184, 48) +
      kantong(T, { x: 128, y: 70, w: 88, h: 112 }) + P.padlock(T, 172, 118, 30) +
      shadow(T, 76, GROUND, 28) +
      koin(T, { x: 76, y: 170, who: 'riki', mood: 'happy', look: 1, arms: { l: 110, r: { a: -25, len: 0.85 } }, hands: { r: { behind: (x, y) => P.key(T, x - 2, y, 46, -25) } } }) +
      shadow(T, 262, GROUND, 24) +
      koin(T, { x: 262, y: 176, r: 24, who: 'febie', mood: 'wow', look: -1, arms: { l: -40, r: -130 } }) +
      sparkle(206, 56, 7, T.amber) + sparkle(110, 52, 5, T.amber) + circle(52, 96, 3, T.lav),
  },
  {
    slug: 'auth-keluar', cat: 'Login & Akun', feature: 'catat',
    title: 'Riki di ambang pintu melambai, Febie membalas',
    use: 'Konfirmasi / sesudah keluar akun (logout) — "Sampai jumpa".',
    draw: (T) =>
      backdrop(T, 'catat', { seed: 13 }) +
      path('M66 40A20 20 0 1 0 86 70A16 16 0 1 1 66 40Z', T.amber) + sparkle(104, 40, 5, T.amber) + circle(48, 84, 2.5, T.amber) + circle(122, 64, 2, T.amber) +
      P.door(T, 176, 62, 74, 140, 0.55) +
      shadow(T, 100, GROUND, 28) + shadow(T, 222, GROUND, 24) +
      koin(T, { x: 222, y: 174, r: 26, who: 'riki', mood: 'smile', look: -1, step: 1, arms: { l: -70, r: 80 } }) +
      koin(T, { x: 100, y: 170, who: 'febie', mood: 'happy', look: 1, arms: { l: 100, r: -60 } }) +
      heart(160, 120, 14, T.coral),
  },
  {
    slug: 'auth-sesi-berakhir', cat: 'Login & Akun', feature: 'neutral',
    title: 'Riki tertidur di samping jam pasir',
    use: 'Sesi habis / perlu login ulang.',
    draw: (T) =>
      backdrop(T, 'neutral', { seed: 15 }) + shadow(T, 116, 200, 34) + P.hourglass(T, 116, 136, 92) +
      shadow(T, 222, GROUND, 30) +
      koin(T, { x: 222, y: 170, who: 'riki', mood: 'sleepy', tilt: 10, arms: { l: 120, r: 70 } }) +
      P.zz(T, 250, 112, 12, T.lav) + sparkle(70, 66, 6, T.amber) + circle(276, 160, 3, T.sky),
  },
  {
    slug: 'auth-ganti-password', cat: 'Login & Akun', feature: 'kantong',
    title: 'Febie memegang kunci baru di depan perisai',
    use: 'Ganti password / password berhasil diubah.',
    draw: (T) =>
      backdrop(T, 'kantong', { seed: 17 }) + shadow(T, 186, 196, 44) +
      P.shield(T, 186, 106, 64) + P.padlock(T, 186, 112, 34, T.paper, T.paperD) +
      shadow(T, 84, GROUND, 28) +
      koin(T, { x: 84, y: 170, who: 'febie', mood: 'happy', arms: { l: 110, r: { a: -60, len: 0.85 } }, hands: { r: { behind: (x, y) => P.key(T, x, y - 2, 40, -70) } } }) +
      sparkle(250, 56, 7, T.amber) + sparkle(130, 50, 5, T.mint) + circle(262, 150, 3, T.lav),
  },

  // ───────────── EMPTY STATES ─────────────
  {
    slug: 'kosong-transaksi', cat: 'Empty state', feature: 'kantong',
    title: 'Riki mengintip ke dalam Kantong yang masih kosong',
    use: 'Kantong › Riwayat kosong ("Belum ada transaksi").',
    draw: (T) =>
      backdrop(T, 'kantong', { seed: 19 }) + shadow(T, 160, 206, 56) +
      koin(T, { x: 160, y: 76, who: 'riki', mood: 'wow', arms: {}, legs: false }) +
      kantong(T, { x: 108, y: 92, w: 104, h: 112 }) +
      circle(126, 94, 7.5, T.rikiD) + circle(126, 92, 7, T.riki) + circle(194, 94, 7.5, T.rikiD) + circle(194, 92, 7, T.riki) +
      dust(T, 222, 70) + dust(T, 82, 116, 0.8) + circle(236, 52, 3, T.paperD) +
      sparkle(70, 60, 6, T.amber),
  },
  {
    slug: 'kosong-todo', cat: 'Empty state', feature: 'agenda',
    title: 'Febie bersantai, semua to-do beres',
    use: 'Agenda › To-do kosong / semua selesai.',
    draw: (T) =>
      backdrop(T, 'agenda', { seed: 21 }) + shadow(T, 204, 178, 36) + P.checkBadge(T, 204, 118, 46, T.sky, T.skyD) +
      shadow(T, 116, 204, 40) +
      koin(T, { x: 116, y: 168, r: 32, who: 'febie', mood: 'calm', legs: 'sit', tilt: -6, arms: { l: 120, r: { a: -5, len: 0.85 } },
        hands: { r: { behind: (x, y) => rect(x - 7, y - 24, 18, 20, 5, T.coral) + stroke(`M${x + 11} ${y - 19}q7 0 7 6t-7 6`, T.coral, 3) + stroke(`M${x - 1} ${y - 30}q3 -4 0 -8`, T.sub, 2) + stroke(`M${x + 6} ${y - 30}q3 -4 0 -8`, T.sub, 2) } } }) +
      sparkle(262, 60, 7, T.amber) + sparkle(152, 64, 5, T.amber) + circle(60, 110, 3, T.lav) + circle(270, 178, 3, T.mint),
  },
  {
    slug: 'kosong-catatan', cat: 'Empty state', feature: 'agenda',
    title: 'Riki berpikir di samping catatan kosong',
    use: 'Agenda › Catatan kosong.',
    draw: (T) =>
      backdrop(T, 'agenda', { seed: 23 }) +
      card(T, 150, 50, 112, 136, { r: 14, lines: 0, tilt: 6 }) +
      g([0, 1, 2, 3, 4].map((i) => rect(166, 84 + i * 18, 80, 2.5, 1.25, T.paperD)).join(''), 'transform="rotate(6 206 118)"') +
      P.pencil(T, 236, 182, 62, -120, T.amber) +
      P.bubble(T, 40, 44, 66, 34, 'dotsR', T.paper, circle(58, 61, 4.5, T.sub) + circle(73, 61, 4.5, T.sub) + circle(88, 61, 4.5, T.sub)) +
      shadow(T, 100, GROUND, 28) +
      koin(T, { x: 100, y: 170, who: 'riki', mood: 'focus', look: -0.6, arms: { l: 110, r: { a: 150, len: 0.62, bend: -0.4 } } }) +
      circle(286, 64, 3, T.lav) + sparkle(130, 40, 5, T.amber),
  },
  {
    slug: 'kosong-jadwal', cat: 'Empty state', feature: 'agenda',
    title: 'Riki duduk santai di atas kalender kosong',
    use: 'Agenda › Jadwal kosong.',
    draw: (T) =>
      backdrop(T, 'agenda', { seed: 25 }) + shadow(T, 160, 204, 62) +
      P.calendar(T, 98, 92, 124, 108, T.sky, { cols: 5, rows: 3 }) +
      koin(T, { x: 150, y: 64, r: 28, who: 'riki', mood: 'calm', legs: 'sit', arms: { l: 120, r: 60 } }) +
      P.zz(T, 186, 34, 8, T.skyD) + sparkle(78, 70, 6, T.amber) + circle(252, 98, 3, T.lav) + circle(70, 150, 3, T.mint),
  },
  {
    slug: 'kosong-komitmen', cat: 'Empty state', feature: 'komit',
    title: 'Febie siap menulis di buku kesepakatan yang masih kosong',
    use: 'Komitmen › belum ada pasal / hasil pencarian pasal kosong.',
    draw: (T) =>
      backdrop(T, 'komit', { seed: 27 }) + shadow(T, 140, 200, 70) +
      P.openBook(T, 140, 150, 150, 70, T.amber, T.amberD, { lines: false }) +
      g(rect(-40, -2, 28, 4, 2, T.paperD) + rect(-40, 8, 20, 4, 2, T.paperD), 'transform="translate(110 140)" opacity=".8"') +
      shadow(T, 258, GROUND, 26) +
      koin(T, { x: 258, y: 172, r: 28, who: 'febie', mood: 'smile', look: -1, arms: { l: { a: -10, len: 0.9 }, r: 70 }, hands: { l: { behind: (x, y) => P.pencil(T, x + 10, y - 4, 50, 210, T.amber) } } }) +
      sparkle(84, 72, 7, T.amber) + sparkle(194, 70, 5, T.amber) + circle(282, 92, 3, T.coral),
  },
  {
    slug: 'kosong-mood', cat: 'Empty state', feature: 'catat',
    title: 'Slot mood hari ini masih kosong, Febie menunjuk',
    use: 'Daily Mood › belum ada entri / kalender mood kosong.',
    draw: (T) => {
      let s = backdrop(T, 'catat', { seed: 29 });
      s += circle(150, 104, 40, T.paper) + circle(150, 104, 40, 'none', `stroke="${T.lavD}" stroke-width="3.5" stroke-dasharray="2 9" stroke-linecap="round"`);
      s += line(150, 92, 150, 116, T.lavD, 5) + line(138, 104, 162, 104, T.lavD, 5);
      [[70, 70, 1], [86, 150, 2], [226, 58, 3], [240, 136, 5]].forEach(([x, y, l]) => (s += g(P.moodFace(T, x, y, 12, l), `opacity="${T.fade}"`)));
      s += shadow(T, 236, GROUND, 24) +
        koin(T, { x: 236, y: 176, r: 25, who: 'febie', mood: 'happy', look: -1, arms: { l: { a: -30, len: 0.9 }, r: 70 } });
      return s + sparkle(110, 46, 6, T.amber);
    },
  },
  {
    slug: 'kosong-pencarian', cat: 'Empty state', feature: 'neutral',
    title: 'Riki mencari dengan kaca pembesar',
    use: 'Pencarian tidak ditemukan (Riwayat, Komitmen, Agenda).',
    draw: (T) =>
      backdrop(T, 'neutral', { seed: 31 }) +
      P.question(T, 236, 74, 36, T.amber) + P.question(T, 272, 116, 20, T.lav) +
      shadow(T, 120, GROUND, 30) +
      koin(T, { x: 116, y: 170, who: 'riki', mood: 'wow', look: 1, arms: { l: 110, r: { a: -45, len: 0.8 } } }) +
      P.magnifier(T, 194, 106, 28, 128) +
      dust(T, 54, 120, 0.8) + sparkle(64, 70, 6, T.amber),
  },

  // ───────────── STATUS SISTEM ─────────────
  {
    slug: 'status-offline', cat: 'Status sistem', feature: 'neutral',
    title: 'Riki memegang steker yang terlepas, awan redup',
    use: 'Banner/halaman offline — "Kamu offline, data disimpan dulu di HP".',
    draw: (T) =>
      backdrop(T, 'neutral', { seed: 33 }) +
      g(P.cloud(T, 112, 62, 96, T.paperD, T.sub), 'opacity=".9"') + P.xBadge(T, 146, 74, 12) +
      P.socket(T, 262, 150, 36) +
      stroke('M150 172C128 214 84 212 34 206', T.cable, 5) +
      g(line(196, 150, 206, 146, T.coral, 3) + line(198, 162, 210, 166, T.coral, 3) + line(200, 156, 214, 156, T.coral, 3), 'opacity=".8"') +
      shadow(T, 110, GROUND, 28) +
      koin(T, { x: 110, y: 170, who: 'riki', mood: 'worry', look: 1, arms: { l: 110, r: { a: -12, len: 0.9 } }, hands: { r: { behind: (x, y) => P.plug(T, x + 6, y, 24, 0) } } }) +
      circle(276, 92, 3, T.lav) + circle(60, 120, 3, T.sky),
  },
  {
    slug: 'status-gagal', cat: 'Status sistem', feature: 'bad',
    title: 'Koin retak ditambal plester, Febie menenangkan',
    use: 'Error umum — "Gagal menyimpan, coba lagi".',
    draw: (T) => {
      const half = (side) => {
        const d = side < 0
          ? 'M0 -40L-8 -22L4 -8L-6 8L4 22L-4 40A40 40 0 0 1 0 -40Z'
          : 'M0 -40A40 40 0 0 1 -4 40L4 22L-6 8L4 -8L-8 -22Z';
        return path(d, T.amberD, 'transform="translate(0 5)"') + path(d, T.amber);
      };
      let c = g(half(-1), 'transform="translate(-6 0) rotate(-8)"') + g(half(1), 'transform="translate(6 0) rotate(8)"');
      c += g(rect(-32, -9, 64, 18, 9, '#F6C9A8') + rect(-9, -9, 18, 18, 3, '#EDB48D') + circle(-3, -3, 1.4, '#D99A72') + circle(3, 3, 1.4, '#D99A72') + circle(3, -3, 1.4, '#D99A72') + circle(-3, 3, 1.4, '#D99A72'), 'transform="rotate(-30)"');
      return backdrop(T, 'bad') + shadow(T, 132, 196, 40) + g(c, 'transform="translate(132 120)"') +
        shadow(T, 236, GROUND, 26) +
        koin(T, { x: 236, y: 174, r: 27, who: 'febie', mood: 'sad', look: -1, arms: { l: { a: -20, len: 0.8 }, r: 80 } }) +
        heart(214, 96, 14, T.coral) + circle(64, 82, 3, T.coral) + sparkle(84, 56, 5, T.amber);
    },
  },
  {
    slug: 'status-tersimpan', cat: 'Status sistem', feature: 'kantong',
    title: 'Centang besar dan Febie bersorak',
    use: 'Sukses — transaksi/catatan tersimpan.',
    draw: (T) =>
      backdrop(T, 'kantong', { seed: 35 }) + P.confetti(T, 138, 92, 100, 70, 11, 16) +
      shadow(T, 132, 168, 36) + P.checkBadge(T, 132, 104, 46) +
      shadow(T, 240, GROUND, 26) +
      koin(T, { x: 240, y: 168, r: 28, who: 'febie', mood: 'happy', legs: 'jump', arms: { l: -70, r: -110 } }),
  },
  {
    slug: 'status-sinkron-selesai', cat: 'Status sistem', feature: 'agenda',
    title: 'HP Riki dan HP Febie tersambung ke awan',
    use: 'Sinkron selesai — "Data kalian sudah sama di kedua HP".',
    draw: (T) => {
      const scr = (c, who) => rect(6, 20, 32, 30, 8, c) + koin(T, { x: 22, y: 35, r: 10, who, mood: 'happy', arms: {}, legs: false }) + rect(6, 58, 32, 5, 2.5, T.sub) + rect(6, 68, 22, 5, 2.5, T.sub);
      return backdrop(T, 'agenda', { seed: 37 }) +
        dashLine('M88 130Q100 86 136 80', T.skyD, 3) + dashLine('M232 130Q220 86 184 80', T.skyD, 3) +
        P.cloud(T, 160, 66, 100) + P.checkBadge(T, 162, 70, 15) +
        shadow(T, 76, 206, 26) + shadow(T, 244, 206, 26) +
        P.phone(T, 52, 116, 50, 88, scr(T.rikiL, 'riki'), { tilt: -8 }) + P.phone(T, 218, 116, 50, 88, scr(T.febieL, 'febie'), { tilt: 8 }) +
        sparkle(112, 40, 6, T.amber) + sparkle(214, 36, 5, T.amber) + circle(160, 150, 3, T.mint);
    },
  },
  {
    slug: 'status-404', cat: 'Status sistem', feature: 'neutral',
    title: 'Riki bingung di depan papan penunjuk jalan',
    use: 'Halaman tidak ditemukan.',
    draw: (T) =>
      backdrop(T, 'neutral', { seed: 39 }) + shadow(T, 196, 204, 26) + P.signpost(T, 196, 204, 136) +
      P.question(T, 116, 88, 26, T.amber) +
      shadow(T, 108, GROUND, 28) +
      koin(T, { x: 108, y: 170, who: 'riki', mood: 'worry', look: 1, arms: { l: { a: 248, len: 1.0, bend: -0.5 }, r: 80 } }) +
      P.plant(T, 270, 196, 0.8) + circle(52, 116, 3, T.lav) + sparkle(256, 60, 6, T.amber),
  },
  {
    slug: 'status-update', cat: 'Status sistem', feature: 'catat',
    title: 'Kotak hadiah terbuka berisi kilau, Febie terkejut senang',
    use: 'Versi baru tersedia / "Apa yang baru".',
    draw: (T) =>
      backdrop(T, 'catat', { seed: 41 }) + shadow(T, 140, 196, 44) +
      sparkle(140, 60, 12, T.amber) + sparkle(112, 76, 7, T.amber) + sparkle(168, 70, 8, T.mint) + circle(124, 50, 3, T.febie) + circle(158, 44, 2.5, T.sky) +
      P.giftbox(T, 140, 158, 76, T.lav, T.lavD, T.amber, true) +
      shadow(T, 248, GROUND, 26) +
      koin(T, { x: 248, y: 172, r: 28, who: 'febie', mood: 'wow', look: -1, arms: { l: -50, r: -130 } }) +
      circle(60, 96, 3, T.mint),
  },
  {
    slug: 'status-budget-lewat', cat: 'Status sistem', feature: 'bad',
    title: 'Kantong menggembung, koin tumpah, Riki cemas',
    use: 'Peringatan budget terlampaui.',
    draw: (T) =>
      backdrop(T, 'bad', { seed: 43 }) + shadow(T, 132, 202, 60) +
      coin(T, 118, 66, 10, 'amber') + coin(T, 142, 56, 9, 'amber') +
      g(kantong(T, { x: 0, y: 0, w: 96, h: 112, face: 'worry' }), 'transform="translate(84 84) scale(1.12 1) translate(-4 0)"') +
      coin(T, 74, 196, 10, 'amber') + coin(T, 196, 194, 9, 'amber') +
      shadow(T, 254, GROUND, 26) +
      koin(T, { x: 254, y: 172, r: 27, who: 'riki', mood: 'worry', look: -1, arms: { l: { a: -60, len: 0.75, bend: -0.5 }, r: { a: -120, len: 0.75, bend: 0.5 } } }) +
      circle(282, 96, 3, T.coral),
  },

  // ───────────── MOMEN KHUSUS ─────────────
  {
    slug: 'momen-ttd-sah', cat: 'Momen khusus', feature: 'komit',
    title: 'Lembar Pengesahan bertanda tangan berdua, Riki dan Febie berpelukan',
    use: 'Komitmen › Lembar Pengesahan sah (TTD kedua masuk).',
    draw: (T) => {
      let doc = rect(0, 4, 108, 122, 12, T.paperD) + rect(0, 0, 108, 122, 12, T.paper);
      [20, 32, 44].forEach((yy, i) => (doc += rect(14, yy, i % 2 ? 60 : 80, 5, 2.5, T.sub)));
      doc += P.signature(T, 10, 70, 38, T.rikiD, 1) + P.signature(T, 60, 70, 38, T.febieD, 2);
      doc += rect(10, 94, 38, 3, 1.5, T.paperD) + rect(60, 94, 38, 3, 1.5, T.paperD);
      return backdrop(T, 'komit', { seed: 45 }) + P.confetti(T, 160, 80, 140, 60, 5, 14) +
        g(doc, 'transform="translate(106 20) rotate(3 54 61)"') +
        g(circle(0, 2.5, 18, T.amberD) + circle(0, 0, 18, T.amber) + circle(0, 0, 13, 'none', `stroke="${T.amberD}" stroke-width="2" stroke-dasharray="3 3"`) + P.checkBadge(T, 0, -1, 8, T.amber, T.amber), 'transform="translate(212 118) rotate(10)"') +
        shadow(T, 160, GROUND, 58) +
        koin(T, { x: 136, y: 172, who: 'riki', mood: 'happy', tilt: 10, arms: { l: 110, r: { a: 10, len: 0.9 } } }) +
        koin(T, { x: 184, y: 172, who: 'febie', mood: 'love', tilt: -10, arms: { l: { a: 10, len: 0.9 }, r: 70 } }) +
        heart(160, 124, 16, T.coral) + heart(120, 120, 9, T.febie) + heart(200, 116, 8, T.coral);
    },
  },
  {
    slug: 'momen-evaluasi-bulanan', cat: 'Momen khusus', feature: 'komit',
    title: 'Riki dan Febie duduk berhadapan, ngobrol evaluasi bulanan',
    use: 'Pengingat / sesi evaluasi bulanan.',
    draw: (T) =>
      backdrop(T, 'komit', { seed: 47 }) +
      P.calendar(T, 132, 26, 56, 50, T.amber, { cols: 4, rows: 3, heartAt: 6 }) +
      P.bubble(T, 56, 70, 50, 32, 'bl', T.paper, heart(81, 86, 16, T.coral)) +
      P.bubble(T, 214, 70, 50, 32, 'br', T.paper, P.checkBadge(T, 239, 85, 9, T.mint, T.mint)) +
      ellipse(160, 196, 34, 6, T.amberD) +
      shadow(T, 92, 204, 36) + shadow(T, 228, 204, 36) +
      koin(T, { x: 88, y: 164, r: 30, who: 'riki', mood: 'smile', legs: 'sit', look: 1, arms: { l: 120, r: { a: 30, len: 0.8 } } }) +
      koin(T, { x: 232, y: 164, r: 30, who: 'febie', mood: 'smile', legs: 'sit', flip: true, look: 1, arms: { l: 120, r: { a: 30, len: 0.8 } } }) +
      g(rect(-14, -18, 28, 26, 7, T.sky) + stroke('M14 -12q8 0 8 7t-8 7', T.sky, 3.5) + stroke('M-4 -24q3 -4 0 -8', T.paperD, 2) + stroke('M5 -24q3 -4 0 -8', T.paperD, 2), 'transform="translate(160 192)"'),
  },
];

module.exports = scenes;
