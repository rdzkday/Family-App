/*
 * Adapter Google Calendar untuk to-do, dipakai KantongCore.syncTodoCalendar lewat store.calendar:
 *   upsert(eventId, spec) -> eventId     remove(eventId)
 * Memakai service account (JWT RS256 lewat WebCrypto) + Calendar REST v3. Tanpa library.
 * Kalender "Rumah Kita" dibuat manual di akun Riki, lalu di-share ke email service account
 * dengan izin "Make changes to events". Lihat kantong/PANDUAN.md.
 */
const TOKEN_URL = 'https://oauth2.googleapis.com/token';
const API = 'https://www.googleapis.com/calendar/v3';
const TZ = 'Asia/Jakarta';
// id warna Google Calendar: 9 blueberry, 4 flamingo, 10 basil, 6 tangerine, 5 banana, 8 graphite
const WARNA = ['9', '4', '10', '6'];

function b64url(bytes) {
  let s = '';
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
function pemToDer(pem) {
  const b64 = pem.replace(/-----[A-Z ]+-----/g, '').replace(/\s+/g, '');
  const bin = atob(b64), out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out.buffer;
}
export async function buatJwt(sa, now, cryptoImpl) {
  const enc = new TextEncoder();
  const head = b64url(enc.encode(JSON.stringify({ alg: 'RS256', typ: 'JWT' })));
  const iat = Math.floor(now / 1000);
  const claim = b64url(enc.encode(JSON.stringify({
    iss: sa.client_email, scope: 'https://www.googleapis.com/auth/calendar', aud: TOKEN_URL, iat, exp: iat + 3600
  })));
  const key = await cryptoImpl.subtle.importKey('pkcs8', pemToDer(sa.private_key), { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['sign']);
  const sig = await cryptoImpl.subtle.sign('RSASSA-PKCS1-v1_5', key, enc.encode(head + '.' + claim));
  return head + '.' + claim + '.' + b64url(new Uint8Array(sig));
}

let cache = { token: '', exp: 0 };
export function resetTokenCache() { cache = { token: '', exp: 0 }; }

// cfg: { saJson, calendarId, fetch, crypto?, now? } -> adapter atau null kalau belum disetel
export function createCalendarAdapter(cfg) {
  if (!cfg || !cfg.saJson || !cfg.calendarId) return null;
  let sa;
  try { sa = typeof cfg.saJson === 'string' ? JSON.parse(cfg.saJson) : cfg.saJson; } catch (e) { return null; }
  if (!sa.client_email || !sa.private_key) return null;
  const f = cfg.fetch, cryptoImpl = cfg.crypto || globalThis.crypto, now = cfg.now || (() => Date.now());
  const calUrl = API + '/calendars/' + encodeURIComponent(cfg.calendarId) + '/events';

  async function token() {
    if (cache.token && cache.exp > now() + 60000) return cache.token;
    const jwt = await buatJwt(sa, now(), cryptoImpl);
    const res = await f(TOKEN_URL, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: 'grant_type=' + encodeURIComponent('urn:ietf:params:oauth:grant-type:jwt-bearer') + '&assertion=' + jwt });
    const j = await res.json().catch(() => ({}));
    if (!res.ok || !j.access_token) throw new Error('Login Google gagal: ' + (j.error_description || j.error || res.status));
    cache = { token: j.access_token, exp: now() + (Number(j.expires_in) || 3600) * 1000 };
    return cache.token;
  }
  async function call(method, url, body) {
    const res = await f(url, { method, headers: { Authorization: 'Bearer ' + await token(), 'Content-Type': 'application/json' },
      body: body ? JSON.stringify(body) : undefined });
    if (res.status === 204) return { ok: true, status: 204, json: null };
    const text = await res.text();
    let json = null; try { json = text ? JSON.parse(text) : null; } catch (e) { json = null; }
    return { ok: res.ok, status: res.status, json, text };
  }
  function body(spec) {
    const b = { summary: spec.judul, description: spec.deskripsi,
      colorId: spec.warna === 'bersama' ? '5' : (WARNA[spec.warna] || '8') };
    if (spec.seharian) {
      const p = spec.tanggal.split('-');
      const besok = new Date(Date.UTC(+p[0], +p[1] - 1, +p[2] + 1)).toISOString().slice(0, 10);
      b.start = { date: spec.tanggal }; b.end = { date: besok };
    } else {
      b.start = { dateTime: spec.mulai + ':00', timeZone: TZ };
      b.end = { dateTime: spec.akhir + ':00', timeZone: TZ };
    }
    return b;
  }
  return {
    async upsert(eventId, spec) {
      const b = body(spec);
      if (eventId) {
        const r = await call('PUT', calUrl + '/' + encodeURIComponent(eventId), b);
        if (r.ok && r.json && r.json.id) return r.json.id;
        // 404/410 = event sudah dihapus manual di Google Calendar: buat baru
        if (r.status !== 404 && r.status !== 410) throw new Error('Google Calendar ' + r.status + ': ' + pesan(r));
      }
      const c = await call('POST', calUrl, b);
      if (!c.ok || !c.json || !c.json.id) throw new Error('Google Calendar ' + c.status + ': ' + pesan(c));
      return c.json.id;
    },
    async remove(eventId) {
      const r = await call('DELETE', calUrl + '/' + encodeURIComponent(eventId));
      if (!r.ok && r.status !== 404 && r.status !== 410) throw new Error('Google Calendar ' + r.status + ': ' + pesan(r));
    }
  };
  function pesan(r) { return (r.json && r.json.error && r.json.error.message) || (r.text || '').slice(0, 120) || 'gagal'; }
}
