/*
 * Handler API Kantong (protokol sama dengan Apps Script lama):
 *   POST { token, action, payload }  ->  { ok, data } | { ok:false, error, code? }
 * Dipisah dari index.ts supaya bisa dites di Node dengan fetch tiruan.
 */
import KantongCore from './core.mjs';
import { createStore, rpc } from './store.mjs';

const TZ_OFFSET_MIN = 7 * 60;   // Asia/Jakarta, tanpa DST

export function nowIsoJakarta(ms) {
  const d = new Date((ms === undefined ? Date.now() : ms) + TZ_OFFSET_MIN * 60000);
  const p = (n) => String(n).padStart(2, '0');
  return d.getUTCFullYear() + '-' + p(d.getUTCMonth() + 1) + '-' + p(d.getUTCDate()) + 'T' +
    p(d.getUTCHours()) + ':' + p(d.getUTCMinutes()) + ':' + p(d.getUTCSeconds()) + '+07:00';
}

export async function sha256Hex(text, cryptoImpl) {
  const buf = await (cryptoImpl || globalThis.crypto).subtle.digest('SHA-256', new TextEncoder().encode(text));
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, '0')).join('');
}

// Core memanggil calendar.upsert/remove secara sinkron, sedangkan Google Calendar butuh await.
// Adapter ini hanya MENCATAT niat; setelah core selesai, niat dijalankan dan hasilnya ditulis ke baris to-do.
function calendarPlanner() {
  const plan = [];
  return {
    plan,
    sync: {
      upsert(eventId, spec, todo) { plan.push({ op: 'upsert', eventId, spec, idTodo: todo.id }); return eventId || 'pending'; },
      remove(eventId, todo) { plan.push({ op: 'remove', eventId, idTodo: todo.id }); }
    }
  };
}

async function jalankanPlan(store, calendar, plan, data) {
  for (const p of plan) {
    const t = store.all('Todo').find((x) => x.id === p.idTodo);
    if (!t) continue;
    try {
      if (p.op === 'remove') { await calendar.remove(p.eventId); continue; }
      const id = await calendar.upsert(p.eventId, p.spec);
      t.gcal_event_id = String(id || ''); t.gcal_status = 'ok'; t.gcal_error = '';
    } catch (e) {
      // gagal: simpan id event lama (kalau ada) supaya "Coba lagi" bisa melanjutkan
      t.gcal_event_id = p.eventId || ''; t.gcal_status = 'gagal'; t.gcal_error = String(e && e.message ? e.message : e).slice(0, 200);
    }
    store.upsert('Todo', t);
    perbaruiData(data, t);
  }
}

// hasil handle memuat salinan to-do (data.todo / data.todos / data.results[].data.*); samakan dengan baris terbaru
function perbaruiData(data, t) {
  const ganti = (o) => {
    if (!o || typeof o !== 'object') return;
    if (o.todo && o.todo.id === t.id) o.todo = { ...t };
    if (Array.isArray(o.todos)) o.todos = o.todos.map((x) => (x.id === t.id ? { ...t } : x));
  };
  ganti(data);
  if (data && Array.isArray(data.results)) data.results.forEach((r) => ganti(r.data));
}

export async function handleRequest(rawBody, deps) {
  // deps: { url, serviceKey, fetch, calendar (adapter async | null), now (ms, opsional), crypto (opsional) }
  let body;
  try { body = JSON.parse(rawBody || ''); } catch (e) { return { ok: false, error: 'Request tidak valid' }; }
  if (!body || typeof body !== 'object') return { ok: false, error: 'Request tidak valid' };
  const cfg = { url: deps.url, serviceKey: deps.serviceKey, fetch: deps.fetch };

  // Login: tanpa token. Username + password dicek di Postgres (bcrypt), hasilnya token sesi baru.
  if (body.action === 'login') {
    const p = body.payload || {};
    const username = typeof p.username === 'string' ? p.username.slice(0, 64) : '';
    const password = typeof p.password === 'string' ? p.password.slice(0, 200) : '';
    if (!username || !password) return { ok: false, error: 'Isi username dan password', code: 'LOGIN' };
    let r;
    try { r = await rpc(cfg, 'kantong_login', { p_username: username, p_password: password }); }
    catch (e) { return { ok: false, error: 'Kesalahan server: ' + e.message }; }
    if (!r || !r.ok) {
      const pesan = { terkunci: 'Terlalu banyak percobaan. Coba lagi 15 menit lagi.', nonaktif: 'Akun dinonaktifkan. Hubungi admin.' };
      return { ok: false, code: 'LOGIN', error: (r && pesan[r.alasan]) || 'Username atau password salah' };
    }
    return { ok: true, data: { token: r.token, user_id: r.user_id, admin: !!r.admin, wajib_ganti: !!r.wajib_ganti } };
  }

  const token = typeof body.token === 'string' ? body.token : '';
  if (token.length < 20) return { ok: false, error: 'Sesi tidak valid', code: 'AUTH' };
  const hash = await sha256Hex(token, deps.crypto);

  if (body.action === 'logout') {
    try { await rpc(cfg, 'kantong_logout', { p_hash: hash }); } catch (e) { /* abaikan */ }
    return { ok: true, data: {} };
  }

  // User ganti password sendiri (juga dipakai saat password sementara dari admin wajib diganti).
  if (body.action === 'password.ganti') {
    const p = body.payload || {};
    const lama = typeof p.lama === 'string' ? p.lama.slice(0, 200) : '';
    const baru = typeof p.baru === 'string' ? p.baru.slice(0, 200) : '';
    let r;
    try { r = await rpc(cfg, 'kantong_ganti_password', { p_hash: hash, p_lama: lama, p_baru: baru }); }
    catch (e) { return { ok: false, error: 'Kesalahan server: ' + e.message }; }
    if (!r || !r.ok) return { ok: false, error: (r && r.error) || 'Gagal', code: r && r.code };
    return { ok: true, data: {} };
  }

  // Admin panel: semua cek hak & aksi ada di Postgres (kantong_admin).
  if (body.action === 'admin') {
    const p = body.payload || {};
    let r;
    try { r = await rpc(cfg, 'kantong_admin', { p_hash: hash, p_aksi: String(p.aksi || ''), p_data: p.data || {} }); }
    catch (e) { return { ok: false, error: 'Kesalahan server: ' + e.message }; }
    if (!r || !r.ok) return { ok: false, error: (r && r.error) || 'Gagal', code: r && r.code };
    delete r.ok;
    return { ok: true, data: r };
  }

  let store, sesiUser;
  try {
    [store, sesiUser] = await Promise.all([createStore(cfg), rpc(cfg, 'kantong_sesi', { p_hash: hash })]);
  } catch (e) { return { ok: false, error: 'Kesalahan server: ' + e.message }; }

  const ak = store.akses.find((a) => a.token_hash === hash);   // kode koneksi lama (transisi)
  if (sesiUser && sesiUser.wajib_ganti) return { ok: false, error: 'Buat password baru dulu', code: 'GANTI_PW' };
  const uid = (sesiUser && sesiUser.user_id) || (ak && ak.user_id);
  const u = uid && store.all('Users').find((x) => x.id === uid);
  if (!u) return { ok: false, error: 'Sesi berakhir, silakan masuk lagi', code: 'AUTH' };
  const user = { id: u.id, nama: u.nama, buku: u.buku };

  if (typeof body.action === 'string' && body.action.indexOf('kalender.') === 0) return aksiKalender(deps.calendar, body.action, body.payload || {});

  const planner = calendarPlanner();
  if (deps.calendar) store.calendar = planner.sync;

  let data;
  try { data = KantongCore.handle(store, user, body.action, body.payload, nowIsoJakarta(deps.now)); }
  catch (err) { return { ok: false, error: err.userFacing ? err.message : 'Kesalahan server: ' + err.message }; }

  if (deps.calendar && planner.plan.length) await jalankanPlan(store, deps.calendar, planner.plan, data);

  try { await store.flush(); }
  catch (e) { return { ok: false, error: 'Gagal menyimpan ke database: ' + e.message }; }
  return { ok: true, data };
}

// Pengaturan > Agenda > Google Calendar: lihat / bagikan / cabut akses kalender "Rumah Kita" per email.
// Semua user yang login boleh (hanya Riki & Febie punya akun).
const EMAIL_RE = /^[^\s@<>(),;:"]+@[^\s@<>(),;:"]+\.[a-z]{2,}$/i;
export async function aksiKalender(calendar, action, p) {
  if (!calendar) return { ok: true, data: { siap: false, kunci: false, akses: [] } };
  const email = String(p.email || '').trim().toLowerCase();
  try {
    let st;
    if (action === 'kalender.status') st = await calendar.status();
    else if (action === 'kalender.bagikan' || action === 'kalender.cabut') {
      if (email.length > 254 || !EMAIL_RE.test(email)) return { ok: false, error: 'Alamat email tidak valid' };
      if (email === String(calendar.serviceEmail || '').toLowerCase()) return { ok: false, error: 'Itu email robot, pakai email Google kamu' };
      st = action === 'kalender.bagikan' ? await calendar.bagikan(email) : await calendar.cabut(email);
    } else return { ok: false, error: 'Aksi tidak dikenal' };
    return { ok: true, data: { ...st, kunci: true } };
  } catch (e) { return { ok: false, error: String(e && e.message ? e.message : e).slice(0, 200) }; }
}

export function corsHeaders(origin) {
  return {
    'Access-Control-Allow-Origin': origin || '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'content-type, authorization, apikey, x-client-info',
    'Access-Control-Max-Age': '86400'
  };
}
