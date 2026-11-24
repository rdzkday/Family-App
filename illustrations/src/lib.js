// Primitif ilustrasi Family App — flat, geometris, tanpa outline.
// Semua bentuk dibangun dari lingkaran, rounded-rect & kurva sederhana.
// Warna HANYA dari palet di bawah (diturunkan dari public/shared/tokens.css + icon.svg).

const BASE = {
  // maskot (dari icon.svg)
  riki: '#8FA2FF', rikiD: '#7388EE', rikiL: '#B6C2FF',
  febie: '#F28DB5', febieD: '#E071A0', febieL: '#F9BFD5',
  ink: '#2B2F55',          // mata, mulut, detail
  // aksen fitur (tokens.css, versi gelap = pastel)
  mint: '#7DD3A8', mintD: '#52B887',
  sky: '#93C5FD', skyD: '#64A6F0',
  amber: '#FCD34D', amberD: '#E9B92C',
  lav: '#C4B5FD', lavD: '#A28EF2',
  coral: '#F87171', coralD: '#E25858',
  orange: '#FB923C',
  // material kantong (icon.svg)
  cream: '#EFE7D4', creamD: '#DCD2BA',
  navy: '#2F3E75', navyD: '#26336A', navyL: '#3C4D8C',
  dark: '#25262E', darkL: '#34353F',
  paper: '#FFFFFF', paperD: '#E4E8F0',
  blush: '#FF9FB8',
  rose: '#F9A8D4', roseD: '#EC84BC',   // Siklus (tokens.css --br-siklus)
};

const THEMES = {
  light: {
    ...BASE,
    bd: { kantong: '#E2F3EA', agenda: '#E6EEFB', komit: '#FCEFC7', catat: '#EEEAFB', bad: '#FDECEC', neutral: '#EAEDF2', siklus: '#FCE7F3' },
    dot: 0.55,
    shadow: 'rgba(43,47,85,.16)',
    sub: '#C9CFDA',        // garis/teks tiruan di atas kertas
    foot: '#2B2F55',
    fade: 0.55,
    glass: 0.35,
    cable: '#2F3E75',
  },
  dark: {
    ...BASE,
    paper: '#F3F4F7', paperD: '#D9DEE8',
    dark: '#30323D', darkL: '#3D3F4B',
    bd: { kantong: '#1B2A23', agenda: '#1A2433', komit: '#2A2614', catat: '#252137', bad: '#2A1717', neutral: '#1D2129', siklus: '#2A1C25' },
    dot: 0.35,
    shadow: 'rgba(0,0,0,.38)',
    sub: '#C9CFDA',
    foot: '#5A619E',
    fade: 0.8,
    glass: 0.6,
    cable: '#6475BD',
  },
};

let uid = 0;
const id = (p = 'i') => `${p}${++uid}`;
const f = (n) => +n.toFixed(2);
const rad = (d) => (d * Math.PI) / 180;

// ---------- bentuk dasar ----------
const circle = (cx, cy, r, fill, extra = '') => `<circle cx="${f(cx)}" cy="${f(cy)}" r="${f(r)}" fill="${fill}" ${extra}/>`;
const ellipse = (cx, cy, rx, ry, fill, extra = '') => `<ellipse cx="${f(cx)}" cy="${f(cy)}" rx="${f(rx)}" ry="${f(ry)}" fill="${fill}" ${extra}/>`;
const rect = (x, y, w, h, r, fill, extra = '') => `<rect x="${f(x)}" y="${f(y)}" width="${f(w)}" height="${f(h)}" rx="${f(r)}" fill="${fill}" ${extra}/>`;
const line = (x1, y1, x2, y2, stroke, w, extra = '') => `<path d="M${f(x1)} ${f(y1)}L${f(x2)} ${f(y2)}" stroke="${stroke}" stroke-width="${w}" stroke-linecap="round" fill="none" ${extra}/>`;
const path = (d, fill, extra = '') => `<path d="${d}" fill="${fill}" ${extra}/>`;
const stroke = (d, color, w, extra = '') => `<path d="${d}" fill="none" stroke="${color}" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round" ${extra}/>`;
const g = (inner, extra = '') => `<g ${extra}>${inner}</g>`;

// bayangan tanah
const shadow = (T, cx, cy, rx, ry = rx * 0.14) => ellipse(cx, cy, rx, ry, T.shadow);

// blob organik deterministik (Catmull-Rom → Bezier)
function blob(cx, cy, rx, ry, seed = 1, n = 9, amp = 0.09) {
  let s = seed * 9301 + 49297;
  const rnd = () => ((s = (s * 9301 + 49297) % 233280) / 233280);
  const pts = [];
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2 - Math.PI / 2;
    const k = 1 - amp + rnd() * amp * 2;
    pts.push([cx + Math.cos(a) * rx * k, cy + Math.sin(a) * ry * k]);
  }
  let d = `M${f(pts[0][0])} ${f(pts[0][1])}`;
  for (let i = 0; i < n; i++) {
    const p0 = pts[(i - 1 + n) % n], p1 = pts[i], p2 = pts[(i + 1) % n], p3 = pts[(i + 2) % n];
    const c1 = [p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6];
    const c2 = [p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6];
    d += `C${f(c1[0])} ${f(c1[1])} ${f(c2[0])} ${f(c2[1])} ${f(p2[0])} ${f(p2[1])}`;
  }
  return d + 'Z';
}

// latar: blob + titik dekor
function backdrop(T, feature = 'neutral', o = {}) {
  const { cx = 160, cy = 122, rx = 128, ry = 96, seed = 3 } = o;
  const col = T.bd[feature];
  return path(blob(cx, cy, rx, ry, seed), col);
}

// kilau bintang 4 sudut
function sparkle(x, y, s, fill, extra = '') {
  const a = s, b = s * 0.28;
  return path(`M${f(x)} ${f(y - a)}Q${f(x + b)} ${f(y - b)} ${f(x + a)} ${f(y)}Q${f(x + b)} ${f(y + b)} ${f(x)} ${f(y + a)}Q${f(x - b)} ${f(y + b)} ${f(x - a)} ${f(y)}Q${f(x - b)} ${f(y - b)} ${f(x)} ${f(y - a)}Z`, fill, extra);
}

function heart(x, y, s, fill, extra = '') {
  // titik (x,y) = tengah; s = lebar
  const w = s / 2;
  return path(`M${f(x)} ${f(y + w * 0.9)}C${f(x - w * 1.6)} ${f(y - w * 0.1)} ${f(x - w * 0.8)} ${f(y - w * 1.3)} ${f(x)} ${f(y - w * 0.45)}C${f(x + w * 0.8)} ${f(y - w * 1.3)} ${f(x + w * 1.6)} ${f(y - w * 0.1)} ${f(x)} ${f(y + w * 0.9)}Z`, fill, extra);
}

// ---------- maskot koin (Riki = biru, Febie = pink) ----------
// arms: {l, r} sudut derajat (0 = kanan, 90 = bawah) relatif bahu, atau null
// arm item: {a: sudut, len, bend} — bend > 0 melengkung
function koin(T, o) {
  const {
    x, y, r = 30, who = 'riki', mood = 'smile', arms = { l: 115, r: 65 }, legs = true,
    look = 0, tilt = 0, acc = true, step = 0, hands = {}, flip = false, scale = 1,
  } = o;
  const C = who === 'riki' ? { b: T.riki, d: T.rikiD, l: T.rikiL } : { b: T.febie, d: T.febieD, l: T.febieL };
  const clip = id('kc');
  let s = '';

  // kaki: true | 'sit' | 'jump' | false
  if (legs) {
    const ly = r * 0.8, ll = r * 0.42;
    [-1, 1].forEach((sd, i) => {
      const dx = sd * r * 0.32;
      if (legs === 'sit') {
        s += line(dx, ly - r * 0.05, dx + r * 0.38, ly + r * 0.1, C.d, r * 0.16);
        s += ellipse(dx + r * 0.46, ly + r * 0.06, r * 0.1, r * 0.17, T.foot);
      } else if (legs === 'jump') {
        s += stroke(`M${f(dx)} ${f(ly - r * 0.05)}Q${f(dx + sd * r * 0.22)} ${f(ly + r * 0.2)} ${f(dx + sd * r * 0.08)} ${f(ly + r * 0.32)}`, C.d, r * 0.16);
        s += ellipse(dx + sd * r * 0.12, ly + r * 0.36, r * 0.17, r * 0.1, T.foot, `transform="rotate(${sd * -18} ${f(dx + sd * r * 0.12)} ${f(ly + r * 0.36)})"`);
      } else {
        const lift = step && i === (step > 0 ? 1 : 0) ? -r * 0.14 : 0;
        s += line(dx, ly, dx, ly + ll + lift, C.d, r * 0.16);
        s += ellipse(dx + sd * r * 0.06, ly + ll + lift + r * 0.02, r * 0.17, r * 0.1, T.foot);
      }
    });
  }

  // lengan: batang di belakang badan, tangan di depan
  const armGeo = (side, spec) => {
    const sp = typeof spec === 'number' ? { a: spec } : spec;
    const sx = side * r * 0.82, sy = r * 0.12;
    const ang = side === 1 ? sp.a : 180 - sp.a;
    const len = (sp.len || 0.8) * r;
    const ex = sx + Math.cos(rad(ang)) * len, ey = sy + Math.sin(rad(ang)) * len;
    const bend = (sp.bend ?? 0.18) * r * side;
    const mx = (sx + ex) / 2 - Math.sin(rad(ang)) * bend;
    const my = (sy + ey) / 2 + Math.cos(rad(ang)) * bend;
    return { sx, sy, ex, ey, mx, my };
  };
  const A = {};
  [['l', -1], ['r', 1]].forEach(([k, sd]) => {
    if (arms[k] == null) return;
    const G = (A[k] = armGeo(sd, arms[k]));
    s += stroke(`M${f(G.sx)} ${f(G.sy)}Q${f(G.mx)} ${f(G.my)} ${f(G.ex)} ${f(G.ey)}`, C.d, r * 0.17);
  });

  // badan + shading 2 tone (cahaya kiri atas)
  s += `<clipPath id="${clip}"><circle r="${f(r)}"/></clipPath>`;
  s += circle(0, 0, r, C.d);
  s += g(circle(-r * 0.12, -r * 0.14, r * 0.96, C.b), `clip-path="url(#${clip})"`);
  s += circle(0, 0, r * 0.7, 'none', `stroke="${C.d}" stroke-width="${f(r * 0.1)}" opacity=".75"`);
  s += path(`M${f(-r * 0.62)} ${f(-r * 0.2)}A${f(r * 0.66)} ${f(r * 0.66)} 0 0 1 ${f(-r * 0.2)} ${f(-r * 0.62)}`, 'none', `stroke="#fff" stroke-opacity=".55" stroke-width="${f(r * 0.09)}" stroke-linecap="round"`);

  if (acc && who === 'riki') {
    s += stroke(`M${f(-r * 0.05)} ${f(-r * 0.97)}Q${f(r * 0.05)} ${f(-r * 1.4)} ${f(r * 0.32)} ${f(-r * 1.3)}`, C.d, r * 0.13);
  }
  if (acc && who === 'febie') {
    const bx = r * 0.5, by = -r * 0.84, bs = r * 0.3;
    s += g(
      path(`M0 0L${f(-bs)} ${f(-bs * 0.7)}Q${f(-bs * 1.15)} 0 ${f(-bs)} ${f(bs * 0.7)}Z`, T.lav) +
      path(`M0 0L${f(bs)} ${f(-bs * 0.7)}Q${f(bs * 1.15)} 0 ${f(bs)} ${f(bs * 0.7)}Z`, T.lav) +
      circle(0, 0, bs * 0.32, T.lavD),
      `transform="translate(${f(bx)} ${f(by)}) rotate(25)"`
    );
  }

  s += face(T, r, mood, look);
  if (o.extra) s += o.extra(r);

  [['l', -1], ['r', 1]].forEach(([k]) => {
    const G = A[k]; if (!G) return;
    const hand = hands[k];
    if (hand && hand.behind) s += hand.behind(G.ex, G.ey, r);
    s += circle(G.ex, G.ey, r * 0.14, C.d) + circle(G.ex - r * 0.025, G.ey - r * 0.025, r * 0.105, C.l);
    const fn = typeof hand === 'function' ? hand : hand && hand.front;
    if (fn) s += fn(G.ex, G.ey, r);
  });

  return g(s, `transform="translate(${f(x)} ${f(y)}) rotate(${tilt})${flip ? ' scale(-1 1)' : ''}${scale !== 1 ? ` scale(${scale})` : ''}"`);
}

function face(T, r, mood, look = 0, inkC = null) {
  const ex = r * 0.26, ey = -r * 0.06, lx = look * r * 0.12;
  const ink = inkC || T.ink;
  let s = '';
  const dot = (x) => ellipse(x + lx, ey, r * 0.075, r * 0.1, ink) + circle(x + lx + r * 0.025, ey - r * 0.035, r * 0.025, '#fff');
  const arcUp = (x) => stroke(`M${f(x - r * 0.09 + lx)} ${f(ey + r * 0.03)}Q${f(x + lx)} ${f(ey - r * 0.1)} ${f(x + r * 0.09 + lx)} ${f(ey + r * 0.03)}`, ink, r * 0.06);
  const arcDown = (x) => stroke(`M${f(x - r * 0.09 + lx)} ${f(ey - r * 0.01)}Q${f(x + lx)} ${f(ey + r * 0.08)} ${f(x + r * 0.09 + lx)} ${f(ey - r * 0.01)}`, ink, r * 0.06);
  const blush = () => ellipse(-r * 0.43 + lx, r * 0.12, r * 0.11, r * 0.065, T.blush, 'opacity=".7"') + ellipse(r * 0.43 + lx, r * 0.12, r * 0.11, r * 0.065, T.blush, 'opacity=".7"');
  const my = r * 0.2;
  const smile = () => stroke(`M${f(-r * 0.11 + lx)} ${f(my - r * 0.02)}Q${f(lx)} ${f(my + r * 0.1)} ${f(r * 0.11 + lx)} ${f(my - r * 0.02)}`, ink, r * 0.06);
  const grin = () => path(`M${f(-r * 0.15 + lx)} ${f(my - r * 0.04)}Q${f(lx)} ${f(my + r * 0.24)} ${f(r * 0.15 + lx)} ${f(my - r * 0.04)}Z`, ink) + ellipse(lx, my + r * 0.07, r * 0.07, r * 0.035, T.coral);
  switch (mood) {
    case 'happy': s += arcUp(-ex) + arcUp(ex) + grin() + blush(); break;
    case 'wink': s += dot(-ex) + arcUp(ex) + grin() + blush(); break;
    case 'wow': s += dot(-ex) + dot(ex) + ellipse(lx, my + r * 0.03, r * 0.07, r * 0.09, ink) + blush(); break;
    case 'sleepy': s += arcDown(-ex) + arcDown(ex) + ellipse(lx, my + r * 0.02, r * 0.05, r * 0.04, ink) + blush(); break;
    case 'calm': s += arcDown(-ex) + arcDown(ex) + smile() + blush(); break;
    case 'sad':
      s += dot(-ex) + dot(ex);
      s += stroke(`M${f(-ex - r * 0.1 + lx)} ${f(ey - r * 0.17)}L${f(-ex + r * 0.08 + lx)} ${f(ey - r * 0.23)}`, ink, r * 0.045);
      s += stroke(`M${f(ex + r * 0.1 + lx)} ${f(ey - r * 0.17)}L${f(ex - r * 0.08 + lx)} ${f(ey - r * 0.23)}`, ink, r * 0.045);
      s += stroke(`M${f(-r * 0.1 + lx)} ${f(my + r * 0.06)}Q${f(lx)} ${f(my - r * 0.04)} ${f(r * 0.1 + lx)} ${f(my + r * 0.06)}`, ink, r * 0.06);
      s += blush();
      break;
    case 'worry':
      s += dot(-ex) + dot(ex);
      s += stroke(`M${f(-r * 0.13 + lx)} ${f(my + r * 0.04)}q${f(r * 0.065)} ${f(-r * 0.07)} ${f(r * 0.13)} 0t${f(r * 0.13)} 0`, ink, r * 0.055);
      s += path(`M${f(r * 0.62)} ${f(-r * 0.5)}q${f(r * 0.1)} ${f(r * 0.16)} 0 ${f(r * 0.22)}q${f(-r * 0.1)} ${f(-r * 0.06)} 0 ${f(-r * 0.22)}Z`, T.sky);
      s += blush();
      break;
    case 'love':
      s += heart(-ex + lx, ey, r * 0.2, T.coral) + heart(ex + lx, ey, r * 0.2, T.coral) + grin() + blush();
      break;
    case 'focus': s += dot(-ex) + dot(ex) + stroke(`M${f(-r * 0.07 + lx)} ${f(my + r * 0.02)}L${f(r * 0.07 + lx)} ${f(my + r * 0.02)}`, ink, r * 0.06) + blush(); break;
    default: s += dot(-ex) + dot(ex) + smile() + blush();
  }
  return s;
}

// ---------- kantong (dompet, dari icon.svg) ----------
function kantong(T, o) {
  const { x, y, w = 100, h = 128, r = 16, tag = true, flap = false, face: fc = null } = o;
  const clip = id('kt');
  const top = h * 0.52, band = h * 0.17;
  let s = `<clipPath id="${clip}"><rect width="${f(w)}" height="${f(h)}" rx="${f(r)}"/></clipPath>`;
  s += g(
    rect(0, 0, w, top, 0, T.dark) + rect(0, 0, w * 0.055, top, 0, T.darkL, 'opacity=".8"') +
    rect(0, top - 1, w, band + 1, 0, T.cream) + rect(0, top + band - h * 0.035, w, h * 0.035, 0, T.creamD) +
    rect(0, top + band, w, h - top - band, 0, T.navy) + rect(0, top + band, w * 0.055, h - top - band, 0, T.navyL, 'opacity=".8"'),
    `clip-path="url(#${clip})"`
  );
  const m = w * 0.055;
  s += rect(m, m, w - m * 2, h - m * 2, r * 0.66, 'none', `stroke="#fff" stroke-opacity=".28" stroke-width="${f(w * 0.012 + 0.6)}" stroke-dasharray="${f(w * 0.05)} ${f(w * 0.04)}"`);
  if (tag) {
    const tw = w * 0.26, th = h * 0.11, tx = w - m * 1.8 - tw, ty = h - m * 1.8 - th;
    s += rect(tx, ty, tw, th, 2.5, '#17181E') + rect(tx + 2, ty + 2, tw - 4, th - 4, 1.5, 'none', `stroke="${T.cream}" stroke-opacity=".5" stroke-width=".8" stroke-dasharray="2.2 1.8"`);
  }
  if (fc) s += g(face(T, w * 0.42, fc, 0, T.cream), `transform="translate(${f(w / 2)} ${f(top * 0.55)})"`);
  return g(s, `transform="translate(${f(x)} ${f(y)})"`);
}

// koin polos (uang)
function coin(T, cx, cy, r, color = 'amber', extra = '') {
  const b = T[color], d = T[color + 'D'] || b;
  return g(circle(0, r * 0.12, r, d) + circle(0, 0, r, b) + circle(0, 0, r * 0.62, 'none', `stroke="${d}" stroke-width="${f(r * 0.16)}"`) +
    path(`M${f(-r * 0.55)} ${f(-r * 0.25)}A${f(r * 0.6)} ${f(r * 0.6)} 0 0 1 ${f(-r * 0.2)} ${f(-r * 0.58)}`, 'none', `stroke="#fff" stroke-opacity=".6" stroke-width="${f(r * 0.12)}" stroke-linecap="round"`),
    `transform="translate(${f(cx)} ${f(cy)})" ${extra}`);
}

// kartu/kertas dengan baris tiruan
function card(T, x, y, w, h, o = {}) {
  const { r = 10, lines = 3, fill = T.paper, accent = null, lineCol = T.sub, pad = 12, tilt = 0, check = null } = o;
  let s = rect(0, h * 0.04, w, h, r, T.paperD) + rect(0, 0, w, h, r, fill);
  if (accent) s += rect(0, 0, w, Math.min(18, h * 0.22), 0, accent, `clip-path="inset(0 round ${r}px ${r}px 0 0)"`);
  const top = accent ? Math.min(18, h * 0.22) + pad * 0.8 : pad;
  for (let i = 0; i < lines; i++) {
    const lw = (w - pad * 2) * (i === lines - 1 ? 0.55 : 0.9 - (i % 2) * 0.12);
    s += rect(pad, top + i * 11, lw, 5, 2.5, lineCol);
  }
  return g(s, `transform="translate(${f(x)} ${f(y)}) rotate(${tilt} ${f(w / 2)} ${f(h / 2)})"`);
}

function checkbox(T, x, y, s, done, color = T.sky) {
  if (!done) return rect(x, y, s, s, s * 0.3, 'none', `stroke="${T.sub}" stroke-width="${f(s * 0.14)}"`);
  return rect(x, y, s, s, s * 0.3, color) + stroke(`M${f(x + s * 0.25)} ${f(y + s * 0.52)}L${f(x + s * 0.43)} ${f(y + s * 0.7)}L${f(x + s * 0.76)} ${f(y + s * 0.32)}`, T.ink, s * 0.14);
}

// ---------- kanvas ----------
function svg(T, title, body, o = {}) {
  const { w = 320, h = 240, style = '' } = o;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}" role="img" aria-label="${title}" fill="none">
<title>${title}</title>${style ? `<style>${style}</style>` : ''}
${body}
</svg>
`;
}

module.exports = {
  THEMES, id, f, rad, circle, ellipse, rect, line, path, stroke, g, shadow, blob, backdrop, sparkle, heart,
  koin, face, kantong, coin, card, checkbox, svg,
};
