// Props/objek pendukung. Aturan sama dengan lib.js: flat, 2-tone (warna + bayangan sewarna), tanpa outline hitam.
const L = require('./lib.js');
const { f, circle, ellipse, rect, line, path, stroke, g, sparkle, heart, id, rad } = L;

const MOOD = ['coral', 'orange', 'amber', 'green', 'mint'];

function cloud(T, cx, cy, w, fill = T.paper, shade = T.paperD) {
  const s = w / 100;
  const body = (dy, c) =>
    circle(cx - 22 * s, cy + 4 * s + dy, 20 * s, c) + circle(cx + 4 * s, cy - 8 * s + dy, 28 * s, c) +
    circle(cx + 30 * s, cy + 6 * s + dy, 18 * s, c) + rect(cx - 42 * s, cy + 4 * s + dy, 88 * s, 20 * s, 10 * s, c);
  return body(4 * s, shade) + body(0, fill);
}

function phone(T, x, y, w, h, screen = '', o = {}) {
  const { tilt = 0 } = o;
  let s = rect(0, h * 0.03, w, h, w * 0.18, T.navyD) + rect(0, 0, w, h, w * 0.18, T.navy);
  s += rect(w * 0.08, w * 0.08, w * 0.84, h - w * 0.16, w * 0.12, T.paper);
  s += rect(w * 0.36, w * 0.13, w * 0.28, w * 0.06, w * 0.03, T.navy);
  s += g(screen, `transform="translate(${f(w * 0.08)} ${f(w * 0.08)})"`);
  return g(s, `transform="translate(${f(x)} ${f(y)}) rotate(${tilt} ${f(w / 2)} ${f(h / 2)})"`);
}

function calendar(T, x, y, w, h, accent = T.sky, o = {}) {
  const { marks = [], cols = 4, rows = 3, blank = false, tilt = 0, heartAt = -1 } = o;
  const hd = h * 0.26;
  let s = rect(0, h * 0.04, w, h, 10, T.paperD) + rect(0, 0, w, h, 10, T.paper);
  s += path(`M0 10Q0 0 10 0H${f(w - 10)}Q${f(w)} 0 ${f(w)} 10V${f(hd)}H0Z`, accent);
  [0.3, 0.7].forEach((k) => (s += rect(w * k - 3, -6, 6, 14, 3, T.ink)));
  if (!blank) {
    const gx = w * 0.12, gy = hd + h * 0.1, cw = (w * 0.76) / (cols - 1), ch = (h - hd - h * 0.24) / (rows - 1);
    for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
      const i = r * cols + c, cx = gx + c * cw, cy = gy + r * ch;
      if (i === heartAt) s += heart(cx, cy, 11, T.coral);
      else if (marks.includes(i)) s += circle(cx, cy, 6, accent);
      else s += circle(cx, cy, 3, T.sub);
    }
  }
  return g(s, `transform="translate(${f(x)} ${f(y)}) rotate(${tilt} ${f(w / 2)} ${f(h / 2)})"`);
}

function padlock(T, cx, cy, s, color = T.amber, shade = T.amberD, open = false) {
  const w = s, h = s * 0.82;
  let o = stroke(open ? `M${f(-w * 0.26)} ${f(-h * 0.3)}V${f(-h * 0.62)}A${f(w * 0.26)} ${f(w * 0.26)} 0 0 1 ${f(w * 0.26)} ${f(-h * 0.7)}V${f(-h * 0.8)}`
    : `M${f(-w * 0.26)} ${f(-h * 0.3)}V${f(-h * 0.55)}A${f(w * 0.26)} ${f(w * 0.26)} 0 0 1 ${f(w * 0.26)} ${f(-h * 0.55)}V${f(-h * 0.3)}`, T.paperD, w * 0.13);
  o += rect(-w / 2, -h * 0.36 + h * 0.06, w, h, w * 0.2, shade) + rect(-w / 2, -h * 0.36, w, h, w * 0.2, color);
  o += circle(0, h * 0.06, w * 0.1, T.ink) + rect(-w * 0.04, h * 0.08, w * 0.08, h * 0.2, w * 0.04, T.ink);
  return g(o, `transform="translate(${f(cx)} ${f(cy)})"`);
}

function key(T, x, y, s, angle = 0, color = T.amber, shade = T.amberD) {
  let o = circle(0, s * 0.03, s * 0.24, shade) + circle(0, 0, s * 0.24, color) + circle(0, 0, s * 0.09, T.bdHole || 'rgba(0,0,0,.18)');
  o += rect(s * 0.18, -s * 0.06, s * 0.78, s * 0.12, s * 0.06, color);
  o += rect(s * 0.68, s * 0.04, s * 0.09, s * 0.16, s * 0.03, color) + rect(s * 0.84, s * 0.04, s * 0.09, s * 0.12, s * 0.03, color);
  return g(o, `transform="translate(${f(x)} ${f(y)}) rotate(${angle})"`);
}

function magnifier(T, cx, cy, r, angle = 40) {
  let o = rect(r * 0.85, -r * 0.16, r * 1.1, r * 0.32, r * 0.16, T.navy);
  o += circle(0, 0, r, T.sky, `opacity="${T.glass}"`) + circle(0, 0, r, 'none', `stroke="${T.navyL}" stroke-width="${f(r * 0.22)}"`);
  o += path(`M${f(-r * 0.55)} ${f(-r * 0.1)}A${f(r * 0.56)} ${f(r * 0.56)} 0 0 1 ${f(-r * 0.1)} ${f(-r * 0.55)}`, 'none', `stroke="#fff" stroke-opacity=".8" stroke-width="${f(r * 0.12)}" stroke-linecap="round"`);
  return g(o, `transform="translate(${f(cx)} ${f(cy)}) rotate(${angle})"`);
}

function openBook(T, cx, cy, w, h, cover = T.amber, coverD = T.amberD, o = {}) {
  const { lines = true, lineCol = T.sub } = o;
  const hw = w / 2;
  let s = path(`M${f(-hw - 6)} ${f(-h / 2 + 8)}Q${f(-hw / 2)} ${f(-h / 2)} 0 ${f(-h / 2 + 8)}Q${f(hw / 2)} ${f(-h / 2)} ${f(hw + 6)} ${f(-h / 2 + 8)}V${f(h / 2 + 8)}Q${f(hw / 2)} ${f(h / 2)} 0 ${f(h / 2 + 10)}Q${f(-hw / 2)} ${f(h / 2)} ${f(-hw - 6)} ${f(h / 2 + 8)}Z`, cover);
  s += path(`M${f(-hw)} ${f(-h / 2 + 2)}Q${f(-hw / 2)} ${f(-h / 2 - 6)} 0 ${f(-h / 2 + 2)}V${f(h / 2 + 2)}Q${f(-hw / 2)} ${f(h / 2 - 6)} ${f(-hw)} ${f(h / 2 + 2)}Z`, T.paper);
  s += path(`M${f(hw)} ${f(-h / 2 + 2)}Q${f(hw / 2)} ${f(-h / 2 - 6)} 0 ${f(-h / 2 + 2)}V${f(h / 2 + 2)}Q${f(hw / 2)} ${f(h / 2 - 6)} ${f(hw)} ${f(h / 2 + 2)}Z`, T.paperD);
  s += rect(-1, -h / 2 + 2, 2, h, 1, coverD);
  if (lines) for (let i = 0; i < 4; i++) {
    const yy = -h / 2 + 14 + i * 10;
    s += rect(-hw + 9, yy, hw - 18 - (i === 3 ? 12 : 0), 4, 2, lineCol);
    s += rect(9, yy, hw - 18 - (i === 2 ? 14 : 0), 4, 2, lineCol);
  }
  return g(s, `transform="translate(${f(cx)} ${f(cy)})"`);
}

function pencil(T, x, y, len, angle = -45, body = T.amber, o = {}) {
  const w = len * 0.16;
  let s = rect(0, -w / 2, len * 0.74, w, w * 0.2, body) + rect(0, 0, len * 0.74, w / 2, 0, o.shade || T.amberD, 'opacity=".55"');
  s += rect(-len * 0.12, -w / 2, len * 0.14, w, w * 0.35, T.febieL);
  s += rect(-len * 0.01, -w / 2, len * 0.05, w, 0, T.paperD);
  s += path(`M${f(len * 0.74)} ${f(-w / 2)}L${f(len)} 0L${f(len * 0.74)} ${f(w / 2)}Z`, T.cream);
  s += path(`M${f(len * 0.91)} ${f(-w * 0.17)}L${f(len)} 0L${f(len * 0.91)} ${f(w * 0.17)}Z`, T.ink);
  return g(s, `transform="translate(${f(x)} ${f(y)}) rotate(${angle})"`);
}

function signature(T, x, y, w, color, sd = 1) {
  const s = w / 60;
  const d = sd === 1
    ? `M0 ${f(10 * s)}C${f(6 * s)} ${f(-6 * s)} ${f(12 * s)} ${f(-4 * s)} ${f(10 * s)} ${f(12 * s)}C${f(9 * s)} ${f(20 * s)} ${f(20 * s)} ${f(-2 * s)} ${f(26 * s)} ${f(6 * s)}S${f(34 * s)} ${f(14 * s)} ${f(40 * s)} ${f(4 * s)}S${f(52 * s)} ${f(10 * s)} ${f(60 * s)} ${f(6 * s)}`
    : `M0 ${f(8 * s)}C${f(8 * s)} ${f(-8 * s)} ${f(16 * s)} ${f(18 * s)} ${f(22 * s)} ${f(4 * s)}C${f(26 * s)} ${f(-4 * s)} ${f(28 * s)} ${f(14 * s)} ${f(36 * s)} ${f(8 * s)}C${f(42 * s)} ${f(4 * s)} ${f(46 * s)} ${f(12 * s)} ${f(60 * s)} ${f(2 * s)}`;
  return stroke(d, color, Math.max(2.2, 3 * s), `transform="translate(${f(x)} ${f(y)})"`);
}

function confetti(T, cx, cy, rx, ry, seed = 7, n = 16) {
  let sd = seed * 7919;
  const rnd = () => ((sd = (sd * 16807) % 2147483647) / 2147483647);
  const cols = [T.amber, T.mint, T.sky, T.coral, T.lav, T.febie, T.riki];
  let s = '';
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2 + rnd() * 0.5, d = 0.55 + rnd() * 0.45;
    const x = cx + Math.cos(a) * rx * d, y = cy + Math.sin(a) * ry * d, c = cols[i % cols.length], k = i % 3;
    if (k === 0) s += rect(x - 3, y - 1.6, 6, 3.2, 1.6, c, `transform="rotate(${f(rnd() * 180)} ${f(x)} ${f(y)})"`);
    else if (k === 1) s += circle(x, y, 2.4, c);
    else s += stroke(`M${f(x - 5)} ${f(y)}q2.5 -4 5 0t5 0`, c, 2, `transform="rotate(${f(rnd() * 180)} ${f(x)} ${f(y)})"`);
  }
  return s;
}

function clock(T, cx, cy, r, hh = -60, mm = 30) {
  let s = circle(cx, cy + r * 0.08, r, T.paperD) + circle(cx, cy, r, T.paper) + circle(cx, cy, r * 0.82, 'none', `stroke="${T.sky}" stroke-width="${f(r * 0.12)}"`);
  for (let i = 0; i < 12; i += 3) { const a = rad(i * 30 - 90); s += circle(cx + Math.cos(a) * r * 0.6, cy + Math.sin(a) * r * 0.6, r * 0.06, T.sub); }
  s += line(cx, cy, cx + Math.cos(rad(hh)) * r * 0.36, cy + Math.sin(rad(hh)) * r * 0.36, T.ink, r * 0.11);
  s += line(cx, cy, cx + Math.cos(rad(mm)) * r * 0.55, cy + Math.sin(rad(mm)) * r * 0.55, T.ink, r * 0.08);
  return s + circle(cx, cy, r * 0.09, T.coral);
}

function bubble(T, x, y, w, h, tail = 'bl', fill = T.paper, inner = '') {
  const r = Math.min(14, h / 2);
  let t = '';
  if (tail === 'bl') t = path(`M${f(x + 12)} ${f(y + h - 2)}L${f(x + 6)} ${f(y + h + 9)}L${f(x + 22)} ${f(y + h - 2)}Z`, fill);
  if (tail === 'br') t = path(`M${f(x + w - 12)} ${f(y + h - 2)}L${f(x + w - 6)} ${f(y + h + 9)}L${f(x + w - 22)} ${f(y + h - 2)}Z`, fill);
  if (tail === 'dots') t = circle(x + 8, y + h + 8, 4, fill) + circle(x + 1, y + h + 16, 2.6, fill);
  if (tail === 'dotsR') t = circle(x + w - 10, y + h + 8, 4, fill) + circle(x + w - 3, y + h + 16, 2.6, fill);
  return rect(x, y, w, h, r, fill) + t + inner;
}

function zz(T, x, y, s, color = T.lav) {
  const z = (zx, zy, k) => stroke(`M${f(zx)} ${f(zy)}h${f(k)}l${f(-k)} ${f(k)}h${f(k)}`, color, Math.max(2, k * 0.22));
  return z(x, y, s) + z(x + s * 1.2, y - s * 1.3, s * 0.7) + z(x + s * 2.1, y - s * 2.3, s * 0.5);
}

function door(T, x, y, w, h, openAmt = 0.55) {
  let s = rect(x - 8, y - 8, w + 16, h + 8, 14, T.creamD) + rect(x - 4, y - 4, w + 8, h + 4, 12, T.cream);
  s += rect(x, y, w, h, 10, '#FFE7A8');
  // berkas cahaya dari pintu
  const ow = w * (1 - openAmt);
  s += path(`M${f(x + ow)} ${f(y)}L${f(x + w)} ${f(y)}V${f(y + h)}H${f(x + ow)}Z`, T.amber, 'opacity=".45"');
  s += path(`M${f(x)} ${f(y)}H${f(x + ow)}L${f(x + ow + 8)} ${f(y + 6)}V${f(y + h)}H${f(x)}Z`, T.navy);
  s += rect(x + 6, y + 10, ow - 10, h * 0.35, 6, T.navyL, 'opacity=".7"');
  s += circle(x + ow - 6, y + h * 0.55, 3.4, T.amber);
  return s;
}

function plant(T, x, y, s = 1) {
  let o = path(`M-12 0H12L9 22H-9Z`, T.coral) + rect(-14, -4, 28, 7, 3.5, T.coralD);
  o += path(`M0 -4C-2 -20 -14 -26 -20 -24C-20 -14 -10 -6 0 -4Z`, T.mintD);
  o += path(`M0 -4C2 -24 12 -34 20 -32C20 -18 10 -8 0 -4Z`, T.mint);
  o += path(`M0 -4C-1 -16 2 -30 6 -38C9 -28 6 -12 0 -4Z`, T.mintD);
  return g(o, `transform="translate(${f(x)} ${f(y)}) scale(${s})"`);
}

function giftbox(T, cx, cy, w, color = T.lav, shade = T.lavD, ribbon = T.amber, open = false) {
  const h = w * 0.72;
  let s = rect(-w / 2, -h / 2 + 6, w, h, 6, shade) + rect(-w / 2, -h / 2, w, h, 6, color);
  s += rect(-w * 0.09, -h / 2, w * 0.18, h, 0, ribbon);
  const lidY = open ? -h / 2 - w * 0.34 : -h / 2 - w * 0.2;
  const lid = rect(-w * 0.58, 0, w * 1.16, w * 0.22, 5, shade) + rect(-w * 0.58, -2, w * 1.16, w * 0.2, 5, color) + rect(-w * 0.1, -2, w * 0.2, w * 0.22, 0, ribbon);
  s += g(lid, `transform="translate(0 ${f(lidY)}) rotate(${open ? -14 : 0})"`);
  if (!open) {
    s += path(`M0 ${f(lidY)}C${f(-w * 0.3)} ${f(lidY - w * 0.3)} ${f(-w * 0.36)} ${f(lidY + w * 0.02)} 0 ${f(lidY)}Z`, ribbon);
    s += path(`M0 ${f(lidY)}C${f(w * 0.3)} ${f(lidY - w * 0.3)} ${f(w * 0.36)} ${f(lidY + w * 0.02)} 0 ${f(lidY)}Z`, ribbon);
  }
  return g(s, `transform="translate(${f(cx)} ${f(cy)})"`);
}

function donut(T, cx, cy, r, parts, w = r * 0.42) {
  let s = '', a0 = -90;
  const tot = parts.reduce((a, p) => a + p[0], 0);
  parts.forEach(([v, c]) => {
    const a1 = a0 + (v / tot) * 360 - 3;
    const p = (a) => [cx + Math.cos(rad(a)) * r, cy + Math.sin(rad(a)) * r];
    const [x0, y0] = p(a0), [x1, y1] = p(a1);
    s += `<path d="M${f(x0)} ${f(y0)}A${r} ${r} 0 ${a1 - a0 > 180 ? 1 : 0} 1 ${f(x1)} ${f(y1)}" stroke="${c}" stroke-width="${f(w)}" fill="none"/>`;
    a0 = a1 + 3;
  });
  return s;
}

function shield(T, cx, cy, s, color = T.mint, shade = T.mintD) {
  const d = (k) => `M0 ${f(-s * k)}L${f(s * 0.8 * k)} ${f(-s * 0.62 * k)}V${f(s * 0.05 * k)}C${f(s * 0.8 * k)} ${f(s * 0.6 * k)} ${f(s * 0.3 * k)} ${f(s * 0.92 * k)} 0 ${f(s * 1.05 * k)}C${f(-s * 0.3 * k)} ${f(s * 0.92 * k)} ${f(-s * 0.8 * k)} ${f(s * 0.6 * k)} ${f(-s * 0.8 * k)} ${f(s * 0.05 * k)}V${f(-s * 0.62 * k)}Z`;
  let o = path(d(1), shade, `transform="translate(0 ${f(s * 0.08)})"`) + path(d(1), color);
  o += path(`M0 ${f(-s)}L${f(-s * 0.8)} ${f(-s * 0.62)}V${f(s * 0.05)}C${f(-s * 0.8)} ${f(s * 0.6)} ${f(-s * 0.3)} ${f(s * 0.92)} 0 ${f(s * 1.05)}Z`, '#fff', 'opacity=".18"');
  return g(o, `transform="translate(${f(cx)} ${f(cy)})"`);
}

// wajah mood 1..5 (dipakai Daily Mood)
function moodFace(T, cx, cy, r, lvl) {
  const cols = [T.coral, T.orange, T.amber, '#86EFAC', T.mint];
  const c = cols[lvl - 1];
  let s = circle(cx, cy + r * 0.1, r, 'rgba(0,0,0,.08)') + circle(cx, cy, r, c);
  s += circle(cx - r * 0.32, cy - r * 0.12, r * 0.11, T.ink) + circle(cx + r * 0.32, cy - r * 0.12, r * 0.11, T.ink);
  const curve = [-0.22, -0.1, 0, 0.14, 0.26][lvl - 1];
  s += stroke(`M${f(cx - r * 0.34)} ${f(cy + r * 0.3)}Q${f(cx)} ${f(cy + r * (0.3 + curve * 1.6))} ${f(cx + r * 0.34)} ${f(cy + r * 0.3)}`, T.ink, r * 0.12);
  return s;
}

function question(T, x, y, s, color = T.amber) {
  return stroke(`M${f(x - s * 0.32)} ${f(y - s * 0.4)}C${f(x - s * 0.32)} ${f(y - s * 0.9)} ${f(x + s * 0.4)} ${f(y - s * 0.9)} ${f(x + s * 0.4)} ${f(y - s * 0.42)}C${f(x + s * 0.4)} ${f(y - s * 0.1)} ${f(x)} ${f(y - s * 0.08)} ${f(x)} ${f(y + s * 0.18)}`, color, s * 0.2) +
    circle(x, y + s * 0.5, s * 0.12, color);
}

function checkBadge(T, cx, cy, r, color = T.mint, shade = T.mintD) {
  return circle(cx, cy + r * 0.1, r, shade) + circle(cx, cy, r, color) +
    stroke(`M${f(cx - r * 0.4)} ${f(cy + r * 0.02)}L${f(cx - r * 0.1)} ${f(cy + r * 0.32)}L${f(cx + r * 0.44)} ${f(cy - r * 0.3)}`, T.ink, r * 0.2);
}

function xBadge(T, cx, cy, r, color = T.coral, shade = T.coralD) {
  return circle(cx, cy + r * 0.1, r, shade) + circle(cx, cy, r, color) +
    line(cx - r * 0.3, cy - r * 0.3, cx + r * 0.3, cy + r * 0.3, T.ink, r * 0.2) + line(cx + r * 0.3, cy - r * 0.3, cx - r * 0.3, cy + r * 0.3, T.ink, r * 0.2);
}

function arrowsCycle(T, cx, cy, r, color = T.sky, w = r * 0.24) {
  const arc = (a0, a1) => {
    const p = (a) => [cx + Math.cos(rad(a)) * r, cy + Math.sin(rad(a)) * r];
    const [x0, y0] = p(a0), [x1, y1] = p(a1);
    const tip = (a) => {
      const [tx, ty] = p(a); const t = rad(a + 90), n = rad(a);
      const k = w * 1.25;
      return path(`M${f(tx + Math.cos(t) * k * 0.9)} ${f(ty + Math.sin(t) * k * 0.9)}L${f(tx + Math.cos(n) * k)} ${f(ty + Math.sin(n) * k)}L${f(tx - Math.cos(n) * k)} ${f(ty - Math.sin(n) * k)}Z`, color);
    };
    return stroke(`M${f(x0)} ${f(y0)}A${f(r)} ${f(r)} 0 0 1 ${f(x1)} ${f(y1)}`, color, w) + tip(a1);
  };
  return arc(200, 320) + arc(20, 140);
}

function plug(T, x, y, s, angle = 0) {
  let o = rect(-s * 0.5, -s * 0.36, s * 0.7, s * 0.72, s * 0.16, T.paperD) + rect(-s * 0.5, -s * 0.36, s * 0.62, s * 0.72, s * 0.16, T.paper);
  o += rect(s * 0.18, -s * 0.24, s * 0.34, s * 0.11, s * 0.05, T.sub) + rect(s * 0.18, s * 0.13, s * 0.34, s * 0.11, s * 0.05, T.sub);
  return g(o, `transform="translate(${f(x)} ${f(y)}) rotate(${angle})"`);
}

function socket(T, x, y, s) {
  return rect(x - s / 2, y - s / 2, s, s, s * 0.24, T.paperD) + rect(x - s / 2, y - s / 2 - 2, s, s, s * 0.24, T.paper) +
    rect(x - s * 0.22, y - s * 0.25, s * 0.1, s * 0.3, s * 0.05, T.ink) + rect(x + s * 0.12, y - s * 0.25, s * 0.1, s * 0.3, s * 0.05, T.ink);
}

function signpost(T, x, y, h) {
  let s = rect(x - 4, y - h, 8, h, 4, T.creamD);
  s += path(`M${f(x - 40)} ${f(y - h + 6)}H${f(x + 30)}L${f(x + 42)} ${f(y - h + 18)}L${f(x + 30)} ${f(y - h + 30)}H${f(x - 40)}Z`, T.amber);
  s += path(`M${f(x + 34)} ${f(y - h + 40)}H${f(x - 30)}L${f(x - 42)} ${f(y - h + 52)}L${f(x - 30)} ${f(y - h + 64)}H${f(x + 34)}Z`, T.sky);
  s += rect(x - 30, y - h + 15, 44, 5, 2.5, T.amberD) + rect(x - 22, y - h + 49, 44, 5, 2.5, T.skyD);
  return s;
}

function hourglass(T, cx, cy, s) {
  let o = rect(-s * 0.5, -s * 0.62, s, s * 0.14, s * 0.06, T.navy) + rect(-s * 0.5, s * 0.48, s, s * 0.14, s * 0.06, T.navy);
  o += path(`M${f(-s * 0.38)} ${f(-s * 0.48)}H${f(s * 0.38)}C${f(s * 0.38)} ${f(-s * 0.16)} ${f(s * 0.08)} ${f(-s * 0.08)} ${f(s * 0.08)} 0C${f(s * 0.08)} ${f(s * 0.08)} ${f(s * 0.38)} ${f(s * 0.16)} ${f(s * 0.38)} ${f(s * 0.48)}H${f(-s * 0.38)}C${f(-s * 0.38)} ${f(s * 0.16)} ${f(-s * 0.08)} ${f(s * 0.08)} ${f(-s * 0.08)} 0C${f(-s * 0.08)} ${f(-s * 0.08)} ${f(-s * 0.38)} ${f(-s * 0.16)} ${f(-s * 0.38)} ${f(-s * 0.48)}Z`, T.paper, 'opacity=".9"');
  o += path(`M${f(-s * 0.22)} ${f(-s * 0.3)}H${f(s * 0.22)}C${f(s * 0.16)} ${f(-s * 0.16)} ${f(s * 0.04)} ${f(-s * 0.1)} 0 ${f(-s * 0.04)}C${f(-s * 0.04)} ${f(-s * 0.1)} ${f(-s * 0.16)} ${f(-s * 0.16)} ${f(-s * 0.22)} ${f(-s * 0.3)}Z`, T.amber);
  o += path(`M${f(-s * 0.3)} ${f(s * 0.48)}Q0 ${f(s * 0.18)} ${f(s * 0.3)} ${f(s * 0.48)}Z`, T.amber) + rect(-s * 0.02, -s * 0.04, s * 0.04, s * 0.4, s * 0.02, T.amber);
  return g(o, `transform="translate(${f(cx)} ${f(cy)})"`);
}

module.exports = {
  cloud, phone, calendar, padlock, key, magnifier, openBook, pencil, signature, confetti, clock, bubble, zz, door, plant,
  giftbox, donut, shield, moodFace, question, checkBadge, xBadge, arrowsCycle, plug, socket, signpost, hourglass, MOOD,
};
