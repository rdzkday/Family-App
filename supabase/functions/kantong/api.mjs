/*
 * Handler API Kantong (protokol sama dengan Apps Script lama):
 *   POST { token, action, payload }  ->  { ok, data } | { ok:false, error, code? }
 * Dipisah dari index.ts supaya bisa dites di Node dengan fetch tiruan.
 */
import KantongCore from './core.mjs';
import { createStore } from './store.mjs';

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
// Adapter ini hanya MENCATAT niat; setelah core selesai, niat dijalankan dan hasilnya ditulis ke barisnya
// (tabel Todo atau Momen: spec.tabel saat upsert, argumen ketiga saat remove).
function calendarPlanner() {
  const plan = [];
  return {
    plan,
    sync: {
      upsert(eventId, spec, row) { plan.push({ op: 'upsert', eventId, spec, id: row.id, tabel: (spec && spec.tabel) || 'Todo' }); return eventId || 'pending'; },
      remove(eventId, row, tabel) { plan.push({ op: 'remove', eventId, id: row.id, tabel: tabel || 'Todo' }); }
    }
  };
}

async function jalankanPlan(store, calendar, plan, data) {
  for (const p of plan) {
    const t = store.all(p.tabel).find((x) => x.id === p.id);
    if (!t) continue;
    try {
      if (p.op === 'remove') { await calendar.remove(p.eventId); continue; }
      const id = await calendar.upsert(p.eventId, p.spec);
      t.gcal_event_id = String(id || ''); t.gcal_status = 'ok'; t.gcal_error = '';
    } catch (e) {
      // gagal: simpan id event lama (kalau ada) supaya "Coba lagi" bisa melanjutkan
      t.gcal_event_id = p.eventId || ''; t.gcal_status = 'gagal'; t.gcal_error = String(e && e.message ? e.message : e).slice(0, 200);
    }
    store.upsert(p.tabel, t);
    perbaruiData(data, t, p.tabel);
  }
}

// hasil handle memuat salinan baris (data.todo / data.todos / data.momen / data.results[].data.*); samakan dengan baris terbaru
function perbaruiData(data, t, tabel) {
  const kunci = tabel === 'Momen' ? 'momen' : 'todo';
  const ganti = (o) => {
    if (!o || typeof o !== 'object') return;
    if (o[kunci] && !Array.isArray(o[kunci]) && o[kunci].id === t.id) o[kunci] = { ...t };
    if (kunci === 'todo' && Array.isArray(o.todos)) o.todos = o.todos.map((x) => (x.id === t.id ? { ...t } : x));
    if (kunci === 'momen' && Array.isArray(o.momen)) o.momen = o.momen.map((x) => (x.id === t.id ? { ...t } : x));
  };
  ganti(data);
  if (data && Array.isArray(data.results)) data.results.forEach((r) => ganti(r.data));
}

export async function handleRequest(rawBody, deps) {
  // deps: { url, serviceKey, fetch, calendar (adapter async | null), now (ms, opsional), crypto (opsional) }
  let body;
  try { body = JSON.parse(rawBody || ''); } catch (e) { return { ok: false, error: 'Request tidak valid' }; }
  if (!body || typeof body !== 'object') return { ok: false, error: 'Request tidak valid' };
  const token = typeof body.token === 'string' ? body.token : '';
  if (token.length < 20) return { ok: false, error: 'Kode akses salah', code: 'AUTH' };

  let store;
  try { store = await createStore({ url: deps.url, serviceKey: deps.serviceKey, fetch: deps.fetch }); }
  catch (e) { return { ok: false, error: 'Kesalahan server: ' + e.message }; }

  const hash = await sha256Hex(token, deps.crypto);
  const ak = store.akses.find((a) => a.token_hash === hash);
  const u = ak && store.all('Users').find((x) => x.id === ak.user_id);
  if (!u) return { ok: false, error: 'Kode akses salah', code: 'AUTH' };
  const user = { id: u.id, nama: u.nama, buku: u.buku };

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

export function corsHeaders(origin) {
  return {
    'Access-Control-Allow-Origin': origin || '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'content-type, authorization, apikey, x-client-info',
    'Access-Control-Max-Age': '86400'
  };
}
