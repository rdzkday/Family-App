/*
 * Tes Edge Function Supabase (api.mjs + store.mjs + calendar.mjs) di Node dengan fetch tiruan.
 * Tidak butuh Supabase/Google sungguhan. Jalankan: node kantong/tools/test_supabase.js
 * Data di sini sintetis.
 */
const path = require('path');
const assert = require('assert');
const crypto = require('crypto');
const FN = path.join(__dirname, '..', '..', 'supabase', 'functions', 'kantong');

let lulus = 0;
const t = async (nama, fn) => { await fn(); lulus++; console.log('✓', nama); };
const sha = (s) => crypto.createHash('sha256').update(s).digest('hex');

// ---------- Postgres tiruan: hanya endpoint RPC yang dipakai store.mjs ----------
function mockDb() {
  const tabel = {
    buku: [{ id: 'riki', nama: 'Riki', tipe: 'Pribadi', pemilik: 'riki', urutan: 1 }, { id: 'istri', nama: 'Febie', tipe: 'Pribadi', pemilik: 'istri', urutan: 2 }, { id: 'rt', nama: 'Rumah Tangga', tipe: 'Bersama', pemilik: '', urutan: 3 }],
    users: [{ id: 'riki', nama: 'Riki', buku: 'riki' }, { id: 'istri', nama: 'Febie', buku: 'istri' }],
    kategori: [{ id: 'makan', nama: 'Makan', tipe: 'Pengeluaran', buku: 'riki,istri,rt', warna: '#FFC2B0', hitung: true, aktif: true, urutan: 1 }],
    kantong: [{ id: 'bca', nama: 'BCA', jenis: 'Debit', buku: 'riki', saldo_awal: 1000000, per_tanggal: '2026-10-31', limit: 0, aktif: true, urutan: 1 },
      { id: 'kas-rt', nama: 'Dompet RT', jenis: 'Debit', buku: 'rt', saldo_awal: 0, per_tanggal: '2026-10-31', limit: 0, aktif: true, urutan: 2 }],
    budget: [], transaksi: [], todo: [],
    // Komitmen: bentuk persis dari Postgres (nomor pasal integer, terkunci boolean). Isi placeholder.
    komitmen_bab: [{ id: 'bab-1', nomor: 'I', judul: 'Perjanjian Pranikah', urutan: 1, dibuat_at: '', dihapus: '' }],
    komitmen_pasal: [{ id: 'p-1', nomor: 1, bab_id: 'bab-1', tipe: 'kesepakatan', judul: 'Contoh', kata_kunci: 'harta', sumber_asal: 'pranikah',
      rujukan_asli: 'Pasal 1 Perjanjian Pranikah', terkunci: true, status: 'berlaku', versi_berlaku_id: 'v-1', dibuat_oleh: 'riki', dibuat_at: '', diubah_at: '', dihapus: '' }],
    komitmen_versi: [{ id: 'v-1', pasal_id: 'p-1', versi: 1, isi_ayat: '["[placeholder] ayat satu"]', alasan: '', jenis: 'baru', sumber: 'pranikah',
      evaluasi_id: '', pengesahan_id: 's-1', status: 'berlaku', berlaku_sejak: '2026-12-01T20:00:00+07:00', dibuat_oleh: 'riki', dibuat_at: '' }],
    komitmen_keterangan: [{ id: 'k-1', pasal_id: 'p-1', isi: '[placeholder] keterangan usulan', menggantikan_id: '', jenis: 'baru', evaluasi_id: '',
      pengesahan_id: 's-2', status: 'usulan', berlaku_sejak: '', dibuat_oleh: 'riki', dibuat_at: '' }],
    pengesahan: [{ id: 's-1', judul: 'Perjanjian Pranikah', jenis: 'pranikah', evaluasi_id: '', ttd_riki: 'M0 0L1 1', ttd_riki_at: 'x', ttd_febie: 'M1 1L0 0',
      ttd_febie_at: 'y', isi_hash: '', status: 'sah', dibuat_at: '' }, { id: 's-2', judul: 'Usulan', jenis: 'tunggal', evaluasi_id: '', ttd_riki: 'M0 0',
      ttd_riki_at: 'x', ttd_febie: '', ttd_febie_at: '', isi_hash: '', status: 'menunggu', dibuat_at: '' }],
    evaluasi: [], jurnal: [], siklus: [], siklus_atur: [],
    sesi: [],
    akses: [{ user_id: 'riki', token_hash: sha('r'.repeat(40)) }, { user_id: 'istri', token_hash: sha('i'.repeat(40)) }]
  };
  const calls = [];
  const fetch = async (url, opt) => {
    calls.push({ url, opt });
    const m = url.match(/\/rest\/v1\/rpc\/(\w+)$/);
    assert.ok(m, 'url rpc tidak dikenal: ' + url);
    assert.strictEqual(opt.headers.Authorization, 'Bearer SERVICE', 'service key harus dikirim');
    if (m[1] === 'kantong_muat') return { ok: true, status: 200, text: async () => JSON.stringify(tabel) };
    if (m[1] === 'kantong_fitur') return { ok: true, status: 200, text: async () => JSON.stringify(tabel.fitur || {}) };
    if (m[1] === 'kantong_login') {
      const a = JSON.parse(opt.body);
      const ok = a.p_username === 'febie' && a.p_password === 'rahasia123';
      const r = ok ? { ok: true, token: 's'.repeat(64), user_id: 'istri' } : { ok: false, alasan: 'salah' };
      if (ok) tabel.sesi.push({ token_hash: sha('s'.repeat(64)), user_id: 'istri' });
      return { ok: true, status: 200, text: async () => JSON.stringify(r) };
    }
    if (m[1] === 'kantong_sesi') {
      const s = tabel.sesi.find((x) => x.token_hash === JSON.parse(opt.body).p_hash);
      return { ok: true, status: 200, text: async () => JSON.stringify(s ? { user_id: s.user_id, wajib_ganti: !!s.wajib_ganti } : null) };
    }
    if (m[1] === 'kantong_ganti_password') {
      const a = JSON.parse(opt.body); const s = tabel.sesi.find((x) => x.token_hash === a.p_hash);
      if (!s || a.p_lama !== 'rahasia123') return { ok: true, status: 200, text: async () => JSON.stringify({ ok: false, error: 'Password lama salah' }) };
      s.wajib_ganti = false;
      return { ok: true, status: 200, text: async () => JSON.stringify({ ok: true }) };
    }
    if (m[1] === 'kantong_logout') {
      const h = JSON.parse(opt.body).p_hash; tabel.sesi = tabel.sesi.filter((x) => x.token_hash !== h);
      return { ok: true, status: 200, text: async () => '' };
    }
    if (m[1] === 'kantong_simpan') {
      const rows = JSON.parse(opt.body).rows;
      for (const r of rows) {
        assert.ok(tabel[r.tabel], 'tabel tidak dikenal ' + r.tabel);
        const i = tabel[r.tabel].findIndex((x) => x.id === r.baris.id);
        if (i >= 0) tabel[r.tabel][i] = r.baris; else tabel[r.tabel].push(r.baris);
      }
      return { ok: true, status: 200, text: async () => String(rows.length) };
    }
    return { ok: false, status: 404, text: async () => 'not found' };
  };
  return { tabel, calls, fetch };
}

// ---------- Google tiruan ----------
function mockGoogle() {
  const events = {}; let n = 0; const calls = [];
  let gagal = false;
  const fetch = async (url, opt) => {
    calls.push({ url, method: opt.method, body: opt.body && opt.headers['Content-Type'] === 'application/json' ? JSON.parse(opt.body) : null });
    if (url.startsWith('https://oauth2.googleapis.com/token')) {
      assert.ok(/assertion=[\w-]+\.[\w-]+\.[\w-]+/.test(opt.body), 'JWT tiga bagian');
      return { ok: true, status: 200, json: async () => ({ access_token: 'TOK', expires_in: 3600 }) };
    }
    if (gagal) return { ok: false, status: 403, text: async () => JSON.stringify({ error: { message: 'Kalender tidak di-share ke service account' } }) };
    assert.strictEqual(opt.headers.Authorization, 'Bearer TOK');
    const m = url.match(/\/calendars\/([^/]+)\/events(?:\/([^/?]+))?$/);
    assert.ok(m, 'url calendar: ' + url);
    assert.strictEqual(decodeURIComponent(m[1]), 'cal@group.calendar.google.com');
    if (opt.method === 'POST') { const id = 'ev' + (++n); events[id] = JSON.parse(opt.body); return { ok: true, status: 200, text: async () => JSON.stringify({ id }) }; }
    if (opt.method === 'PUT') {
      const id = decodeURIComponent(m[2]);
      if (!events[id]) return { ok: false, status: 404, text: async () => '{"error":{"message":"Not Found"}}' };
      events[id] = JSON.parse(opt.body); return { ok: true, status: 200, text: async () => JSON.stringify({ id }) };
    }
    if (opt.method === 'DELETE') { delete events[decodeURIComponent(m[2])]; return { ok: true, status: 204 }; }
    return { ok: false, status: 400, text: async () => 'bad' };
  };
  return { events, calls, fetch, setGagal: (v) => { gagal = v; } };
}

(async () => {
  const { handleRequest, nowIsoJakarta, sha256Hex } = await import(path.join(FN, 'api.mjs'));
  const { createCalendarAdapter, buatJwt, resetTokenCache } = await import(path.join(FN, 'calendar.mjs'));
  const { dariDb, keDb } = await import(path.join(FN, 'store.mjs'));

  const { privateKey } = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 });
  const SA = JSON.stringify({ client_email: 'kantong@proj.iam.gserviceaccount.com', private_key: privateKey.export({ type: 'pkcs8', format: 'pem' }) });

  const db = mockDb(), g = mockGoogle();
  const calendar = createCalendarAdapter({ saJson: SA, calendarId: 'cal@group.calendar.google.com', fetch: g.fetch });
  const deps = { url: 'https://proj.supabase.co/', serviceKey: 'SERVICE', fetch: db.fetch, calendar, now: Date.UTC(2026, 10, 16, 3, 0, 0) };
  const R = 'r'.repeat(40), I = 'i'.repeat(40);
  const call = (token, action, payload, d) => handleRequest(JSON.stringify({ token, action, payload }), d || deps);
  const ok = (res) => { if (!res.ok) throw new Error('harusnya ok: ' + res.error); return res.data; };

  await t('waktu server dalam zona Jakarta', async () => {
    assert.strictEqual(nowIsoJakarta(Date.UTC(2026, 10, 16, 3, 5, 9)), '2026-11-16T10:05:09+07:00');
    assert.strictEqual(await sha256Hex('abc'), sha('abc'));
  });
  await t('konversi kolom: tanggal kosong jadi null, null jadi string kosong', async () => {
    const row = keDb('Todo', { id: 'x', judul: 'A', pemilik: 'riki', tanggal: '', jam: '', durasi: '30', selesai: 'TRUE' });
    assert.strictEqual(row.tanggal, null); assert.strictEqual(row.durasi, 30); assert.strictEqual(row.selesai, true);
    const back = dariDb('Todo', { id: 'x', tanggal: null, selesai: null, durasi: null, gcal_event_id: null });
    assert.strictEqual(back.tanggal, ''); assert.strictEqual(back.selesai, false); assert.strictEqual(back.durasi, 0); assert.strictEqual(back.gcal_event_id, '');
  });
  await t('JWT service account valid (RS256, bisa diverifikasi)', async () => {
    const jwt = await buatJwt(JSON.parse(SA), Date.UTC(2026, 10, 16), globalThis.crypto);
    const [h, c, s] = jwt.split('.');
    const v = crypto.createVerify('RSA-SHA256'); v.update(h + '.' + c);
    assert.ok(v.verify(privateKey, Buffer.from(s.replace(/-/g, '+').replace(/_/g, '/'), 'base64')));
    const claim = JSON.parse(Buffer.from(c, 'base64').toString());
    assert.strictEqual(claim.scope, 'https://www.googleapis.com/auth/calendar');
  });
  await t('request rusak & token salah ditolak tanpa menyentuh data', async () => {
    assert.strictEqual((await handleRequest('{bukan json', deps)).ok, false);
    const r = await call('x'.repeat(40), 'bootstrap');
    assert.strictEqual(r.code, 'AUTH');
    assert.strictEqual(db.tabel.transaksi.length, 0);
  });
  await t('login username+password -> token sesi, logout mencabutnya', async () => {
    const salah = await call('', 'login', { username: 'febie', password: 'salah' });
    assert.strictEqual(salah.code, 'LOGIN');
    const d = ok(await call('', 'login', { username: 'febie', password: 'rahasia123' }));
    assert.strictEqual(d.user_id, 'istri');
    assert.strictEqual(ok(await call(d.token, 'bootstrap')).user.id, 'istri');
    db.tabel.sesi.find((x) => x.user_id === 'istri').wajib_ganti = true;
    assert.strictEqual((await call(d.token, 'bootstrap')).code, 'GANTI_PW');
    assert.strictEqual((await call(d.token, 'password.ganti', { lama: 'x', baru: 'barubaru1' })).ok, false);
    ok(await call(d.token, 'password.ganti', { lama: 'rahasia123', baru: 'barubaru1' }));
    assert.strictEqual(ok(await call(d.token, 'bootstrap')).user.id, 'istri');
    ok(await call(d.token, 'logout'));
    assert.strictEqual((await call(d.token, 'bootstrap')).code, 'AUTH');
  });
  await t('bootstrap memakai data dari kantong_muat', async () => {
    const d = ok(await call(R, 'bootstrap'));
    assert.strictEqual(d.user.id, 'riki'); assert.strictEqual(d.kantong.length, 2);
    assert.strictEqual(d.saldo.bca, 1000000);
  });
  await t('bootstrap tidak menulis (tidak ada panggilan kantong_simpan)', async () => {
    const sebelum = db.calls.length;
    ok(await call(I, 'bootstrap'));
    const tulis = db.calls.slice(sebelum).filter((c) => c.url.endsWith('kantong_simpan'));
    assert.strictEqual(tulis.length, 0);
  });
  const tx1 = { id: 'tx-1', tanggal: '2026-11-16', tipe: 'Pengeluaran', nominal: 25000, buku: 'riki', kategori: 'makan', kantong: 'bca', keterangan: 'kopi' };
  await t('tx.save tersimpan lewat kantong_simpan, tanggal utuh', async () => {
    const d = ok(await call(R, 'tx.save', tx1));
    assert.strictEqual(d.tx.oleh, 'riki');
    const row = db.tabel.transaksi.find((x) => x.id === 'tx-1');
    assert.strictEqual(row.tanggal, '2026-11-16'); assert.strictEqual(row.nominal, 25000); assert.strictEqual(row.reimburse, false);
    assert.strictEqual(ok(await call(R, 'bootstrap')).saldo.bca, 975000);
  });
  await t('aturan izin tetap jalan di server (Febie tidak bisa edit buku Riki)', async () => {
    const r = await call(I, 'tx.save', { ...tx1, nominal: 1 });
    assert.strictEqual(r.ok, false); assert.match(r.error, /hanya bisa melihat/);
    assert.strictEqual(db.tabel.transaksi[0].nominal, 25000);
  });
  await t('batch: satu request = satu muat + satu simpan', async () => {
    const sebelum = db.calls.length;
    const d = ok(await call(R, 'batch', { ops: [
      { opId: 'a', action: 'tx.save', payload: { ...tx1, id: 'tx-2', nominal: 1000 } },
      { opId: 'b', action: 'tx.save', payload: { ...tx1, id: 'tx-2', nominal: 2000 } },
      { opId: 'c', action: 'bootstrap' }, { opId: 'd', action: 'month', payload: { bulan: '2026-11' } }] }));
    assert.deepStrictEqual(d.results.map((r) => r.ok), [true, true, true, true]);
    const baru = db.calls.slice(sebelum);
    assert.strictEqual(baru.filter((c) => c.url.endsWith('kantong_muat')).length, 1);
    const simpan = baru.filter((c) => c.url.endsWith('kantong_simpan'));
    assert.strictEqual(simpan.length, 1);
    assert.strictEqual(JSON.parse(simpan[0].opt.body).rows.length, 1, 'baris sama dua kali cukup dikirim sekali');
    assert.strictEqual(d.results[3].data.transaksi.find((x) => x.id === 'tx-2').nominal, 2000);
  });
  await t('todo dengan waktu: event dibuat di Google Calendar, id tersimpan di database', async () => {
    const d = ok(await call(R, 'todo.save', { id: 'td-1', judul: 'Bayar listrik', pemilik: 'bersama', tanggal: '2026-11-18', jam: '19:00', durasi: 30 }));
    assert.strictEqual(d.todo.gcal_status, 'ok', d.todo.gcal_error); assert.strictEqual(d.todo.gcal_event_id, 'ev1');
    assert.strictEqual(db.tabel.todo[0].gcal_event_id, 'ev1');
    const ev = g.events.ev1;
    assert.strictEqual(ev.summary, '[B] Bayar listrik');
    assert.deepStrictEqual(ev.start, { dateTime: '2026-11-18T19:00:00', timeZone: 'Asia/Jakarta' });
    assert.deepStrictEqual(ev.end, { dateTime: '2026-11-18T19:30:00', timeZone: 'Asia/Jakarta' });
    assert.strictEqual(ev.colorId, '5');
  });
  await t('todo seharian: event tanggal penuh', async () => {
    const d = ok(await call(I, 'todo.save', { id: 'td-2', judul: 'Jemput paket', tanggal: '2026-11-30' }));
    const ev = g.events[d.todo.gcal_event_id];
    assert.deepStrictEqual(ev.start, { date: '2026-11-30' }); assert.deepStrictEqual(ev.end, { date: '2026-12-01' });
    assert.strictEqual(ev.summary, '[F] Jemput paket'); assert.strictEqual(ev.colorId, '4');
  });
  await t('ubah waktu memakai PUT ke event yang sama; token Google dipakai ulang', async () => {
    const sebelum = g.calls.length;
    ok(await call(R, 'todo.save', { id: 'td-1', judul: 'Bayar listrik', pemilik: 'bersama', tanggal: '2026-11-19', jam: '20:00', durasi: 60 }));
    const baru = g.calls.slice(sebelum);
    assert.strictEqual(baru.filter((c) => c.url.includes('oauth2')).length, 0, 'tidak login ulang');
    assert.strictEqual(baru[0].method, 'PUT');
    assert.strictEqual(g.events.ev1.end.dateTime, '2026-11-19T21:00:00');
    assert.strictEqual(Object.keys(g.events).length, 2);
  });
  await t('event dihapus manual di Google: dibuat ulang, bukan error', async () => {
    delete g.events.ev1;
    const d = ok(await call(R, 'todo.sync', { id: 'td-1' }));
    assert.strictEqual(d.todo.gcal_status, 'ok'); assert.notStrictEqual(d.todo.gcal_event_id, 'ev1');
    assert.ok(g.events[d.todo.gcal_event_id]);
  });
  await t('selesai: judul event diberi centang; hapus to-do: event dihapus', async () => {
    const d = ok(await call(I, 'todo.done', { id: 'td-1', selesai: true }));
    assert.strictEqual(g.events[d.todo.gcal_event_id].summary, '[B] ✓ Bayar listrik');
    ok(await call(I, 'todo.delete', { id: 'td-1' }));
    assert.strictEqual(g.events[d.todo.gcal_event_id], undefined);
    assert.ok(db.tabel.todo.find((x) => x.id === 'td-1').dihapus);
  });
  await t('Google gagal: to-do tetap tersimpan, status gagal + pesan, lalu coba lagi berhasil', async () => {
    g.setGagal(true);
    const d = ok(await call(R, 'todo.save', { id: 'td-3', judul: 'Dokter gigi', tanggal: '2026-11-20', jam: '15:00' }));
    assert.strictEqual(d.todo.gcal_status, 'gagal'); assert.match(d.todo.gcal_error, /tidak di-share/);
    assert.strictEqual(db.tabel.todo.find((x) => x.id === 'td-3').gcal_status, 'gagal');
    g.setGagal(false);
    const r = ok(await call(R, 'todo.sync', { id: 'td-3' }));
    assert.strictEqual(r.gcal_status === undefined ? r.todo.gcal_status : r.gcal_status, 'ok');
  });
  await t('batch berisi todo: hasil di results ikut diperbarui dengan id event', async () => {
    const d = ok(await call(R, 'batch', { ops: [
      { opId: 'a', action: 'todo.save', payload: { id: 'td-4', judul: 'Arisan', tanggal: '2026-11-22', jam: '16:00' } },
      { opId: 'b', action: 'todo.list' }] }));
    assert.match(d.results[0].data.todo.gcal_event_id, /^ev\d+$/);
    assert.strictEqual(d.results[1].data.todos.find((x) => x.id === 'td-4').gcal_status, 'ok');
  });
  await t('tanpa secret Google: adapter null, to-do berwaktu ditandai gagal dengan pesan jelas', async () => {
    assert.strictEqual(createCalendarAdapter({ saJson: '', calendarId: '', fetch: g.fetch }), null);
    const d = ok(await call(R, 'todo.save', { id: 'td-5', judul: 'X', tanggal: '2026-11-25' }, { ...deps, calendar: null }));
    assert.strictEqual(d.todo.gcal_status, 'gagal'); assert.match(d.todo.gcal_error, /belum disiapkan/);
    const e = ok(await call(R, 'todo.save', { id: 'td-6', judul: 'Tanpa waktu' }, { ...deps, calendar: null }));
    assert.strictEqual(e.todo.gcal_status, '');
  });
  await t('database gagal saat simpan: dilaporkan sebagai error, bukan ok palsu', async () => {
    const rusak = { ...deps, fetch: async (url, opt) => url.endsWith('kantong_simpan') ? { ok: false, status: 500, text: async () => 'boom' } : db.fetch(url, opt) };
    const r = await call(R, 'tx.save', { ...tx1, id: 'tx-9' }, rusak);
    assert.strictEqual(r.ok, false); assert.match(r.error, /Gagal menyimpan/);
  });
  await t('komitmen.list lewat Edge Function: tipe kolom benar, kotak TTD per user', async () => {
    const d = ok(await call(R, 'komitmen.list', {}));
    const p = d.pasal[0];
    assert.strictEqual(p.nomor, 1); assert.strictEqual(p.terkunci, true); assert.strictEqual(d.bab[0].nomor, 'I');
    assert.deepStrictEqual(p.ayat, ['[placeholder] ayat satu']);
    assert.strictEqual(d.pengesahan['s-1'].ttd_febie, 'M1 1L0 0');
    assert.strictEqual(d.menunggu_ttd, 0, 'Riki sudah TTD lembar s-2');
    assert.strictEqual(ok(await call(I, 'komitmen.list', {})).menunggu_ttd, 1, 'Febie belum TTD lembar s-2');
    assert.strictEqual(keDb('KomitmenPasal', { nomor: '7', terkunci: 'TRUE' }).nomor, 7);
    assert.strictEqual(keDb('KomitmenBab', { nomor: 'IV' }).nomor, 'IV');
    assert.strictEqual(dariDb('KomitmenVersi', { versi: 2 }).versi, 2);
  });
  await t('tanpa TODO_CAL_ID: email dari app -> robot buat "Rumah Kita", bagikan, sync jalan', async () => {
    resetTokenCache();
    const cals = {}, acl = {}, ev = {}; let n = 0, dibuat = 0;
    const res = (status, j) => ({ ok: status < 300, status, text: async () => JSON.stringify(j), json: async () => j });
    const gf = async (url, opt) => {
      if (url.startsWith('https://oauth2')) return res(200, { access_token: 'TOK', expires_in: 3600 });
      const u = url.replace('https://www.googleapis.com/calendar/v3', '');
      if (u.startsWith('/users/me/calendarList')) return res(200, { items: Object.keys(cals).map((id) => ({ id, summary: cals[id] })) });
      if (u === '/calendars' && opt.method === 'POST') { dibuat++; const id = 'auto' + dibuat + '@group.calendar.google.com'; cals[id] = JSON.parse(opt.body).summary; acl[id] = [{ role: 'owner', scope: { type: 'user', value: 'kantong@proj.iam.gserviceaccount.com' } }]; return res(200, { id }); }
      const m = u.match(/^\/calendars\/([^/]+)\/(acl|events)(?:\/([^/?]+))?/); assert.ok(m, u);
      const id = decodeURIComponent(m[1]); assert.ok(cals[id], 'kalender ada');
      if (m[2] === 'acl') {
        if (opt.method === 'GET') return res(200, { items: acl[id] });
        if (opt.method === 'POST') { assert.match(u, /sendNotifications=true/); const b = JSON.parse(opt.body); assert.strictEqual(b.role, 'writer'); acl[id].push(b); return res(200, b); }
        if (opt.method === 'DELETE') { const e = decodeURIComponent(m[3]).replace('user:', ''); acl[id] = acl[id].filter((a) => a.scope.value !== e); return { ok: true, status: 204 }; }
      }
      if (opt.method === 'POST') { const i = 'a' + (++n); ev[i] = JSON.parse(opt.body); return res(200, { id: i }); }
      return res(400, {});
    };
    const cal = createCalendarAdapter({ saJson: SA, calendarId: '', fetch: gf });
    const d2 = { ...deps, calendar: cal };
    assert.ok(cal, 'adapter tetap ada walau TODO_CAL_ID kosong');
    const s0 = ok(await call(R, 'kalender.status', {}, d2));
    assert.strictEqual(s0.siap, false); assert.strictEqual(s0.kunci, true); assert.strictEqual(dibuat, 0, 'status tidak membuat kalender');
    const t0 = ok(await call(R, 'todo.save', { id: 'td-k0', judul: 'Sebelum', tanggal: '2026-11-26' }, d2));
    assert.strictEqual(t0.todo.gcal_status, 'gagal'); assert.match(t0.todo.gcal_error, /belum disiapkan/);
    assert.strictEqual((await call(R, 'kalender.bagikan', { email: 'bukan-email' }, d2)).ok, false);
    assert.strictEqual((await call(R, 'kalender.bagikan', { email: 'kantong@proj.iam.gserviceaccount.com' }, d2)).ok, false);
    const s1 = ok(await call(R, 'kalender.bagikan', { email: ' Riki@Gmail.com ' }, d2));
    assert.strictEqual(s1.siap, true); assert.strictEqual(dibuat, 1);
    assert.deepStrictEqual(s1.akses, [{ email: 'riki@gmail.com', role: 'writer' }], 'email robot tidak ditampilkan');
    ok(await call(I, 'kalender.bagikan', { email: 'febie@gmail.com' }, d2));
    assert.strictEqual(dibuat, 1, 'kalender kedua tidak dibuat');
    // instance baru (cold start) menemukan kalender lewat calendarList
    resetTokenCache();
    const cal2 = createCalendarAdapter({ saJson: SA, calendarId: '', fetch: gf });
    const t1 = ok(await call(R, 'todo.sync', { id: 'td-k0' }, { ...deps, calendar: cal2 }));
    const td = t1.todo || (t1.todos || []).find((x) => x.id === 'td-k0');
    assert.strictEqual(td.gcal_status, 'ok', td.gcal_error); assert.ok(ev[td.gcal_event_id]);
    const s2 = ok(await call(R, 'kalender.cabut', { email: 'febie@gmail.com' }, d2));
    assert.deepStrictEqual(s2.akses.map((a) => a.email), ['riki@gmail.com']);
    assert.deepStrictEqual(ok(await call(R, 'kalender.status', {}, { ...deps, calendar: null })), { siap: false, kunci: false, akses: [] });
  });
  await t('fitur modular: aksi fitur mati ditolak server, bootstrap membawa setelan', async () => {
    db.tabel.fitur = { kantong: true, agenda: false, komitmen: true, mood: true };
    const boot = ok(await call(R, 'bootstrap', {}));
    assert.deepStrictEqual(boot.fitur, db.tabel.fitur);
    const r = await call(R, 'todo.list', {});
    assert.strictEqual(r.ok, false); assert.strictEqual(r.error, 'Fitur Agenda tidak aktif');
    const k = await call(R, 'kalender.status', {});
    assert.strictEqual(k.ok, false); assert.strictEqual(k.error, 'Fitur Agenda tidak aktif');
    ok(await call(R, 'month', { bulan: '2026-11' }));
    delete db.tabel.fitur;
    ok(await call(R, 'todo.list', {}));
  });
  await t('siklus lewat Edge Function: tanggal & boolean benar, suami hanya lihat jadwal yang dibagikan', async () => {
    const d0 = { ...deps, calendar: null };
    assert.strictEqual((await call(I, 'siklus.save', { id: 'sk-1', mulai: '2026-11-01' }, d0)).ok, false, 'belum aktif');
    ok(await call(I, 'siklus.atur', { aktif: true, setuju: 1 }, d0));
    ok(await call(I, 'siklus.save', { id: 'sk-1', mulai: '2026-10-05', akhir: '2026-10-09', catatan: 'pusing' }, d0));
    ok(await call(I, 'siklus.save', { id: 'sk-2', mulai: '2026-11-02' }, d0));
    const row = db.tabel.siklus.find((x) => x.id === 'sk-1'), row2 = db.tabel.siklus.find((x) => x.id === 'sk-2');
    assert.strictEqual(row.mulai, '2026-10-05'); assert.strictEqual(row.akhir, '2026-10-09'); assert.strictEqual(row.abaikan_jarak, false);
    assert.strictEqual(row2.akhir, null, 'selesai kosong -> null di Postgres');
    const atur = db.tabel.siklus_atur.find((x) => x.id === 'istri');
    assert.strictEqual(atur.aktif, true); assert.strictEqual(atur.versi_teks, 1); assert.strictEqual(atur.tampil, true);
    const vr = ok(await call(R, 'siklus.list', {}, d0));
    assert.strictEqual(vr.dibagikan, true); assert.deepStrictEqual(vr.siklus.map((x) => [x.mulai, x.akhir, x.catatan]), [['2026-10-05', '2026-10-09', ''], ['2026-11-02', '', '']]);
    assert.strictEqual((await call(R, 'siklus.save', { id: 'sk-3', mulai: '2026-11-03' }, d0)).ok, false, 'suami tidak bisa mencatat');
    ok(await call(R, 'siklus.atur', { tampil: false }, d0));
    assert.strictEqual(db.tabel.siklus_atur.find((x) => x.id === 'riki').tampil, false);
    assert.strictEqual(ok(await call(I, 'siklus.list', {}, d0)).tampil, true, 'pilihan suami tidak mengubah istri');
    ok(await call(I, 'siklus.delete', { id: 'sk-1' }, d0));
    const hapus = db.tabel.siklus.find((x) => x.id === 'sk-1');
    assert.deepStrictEqual([hapus.mulai, hapus.akhir, hapus.catatan], [null, null, ''], 'hapus: tanggal null, catatan kosong');
  });
  await t('template kategori lewat Edge Function: manajer, template, budget 40:30:20:10 tersimpan dengan tipe benar', async () => {
    assert.strictEqual(ok(await call(R, 'bootstrap', {})).buku.find((b) => b.id === 'rt').manajer, '', 'kolom lama kosong = belum ada manajer');
    const g = await call(R, 'kategori.template', { buku: 'rt', level: 'simpel' });
    assert.strictEqual(g.ok, false); assert.strictEqual(g.error, 'Pilih dulu manajer keuangan rumah tangga');
    ok(await call(I, 'buku.manajer', { buku: 'rt', user: 'istri' }));
    assert.strictEqual(db.tabel.buku.find((b) => b.id === 'rt').manajer, 'istri');
    const n = await call(R, 'kategori.template', { buku: 'rt', level: 'simpel' });
    assert.strictEqual(n.error, 'Hanya manajer keuangan yang bisa mengatur ini');
    const tp = ok(await call(R, 'kategori.template', { buku: 'riki', level: 'menengah' }));
    assert.ok(tp.dibuat > 10);
    const sub = db.tabel.kategori.find((k) => k.buku === 'riki' && k.induk);
    assert.ok(sub && sub.pos, 'induk & pos tersimpan di Postgres');
    const rb = ok(await call(R, 'budget.rencana', { buku: 'riki', penghasilan: 10000000, bulan: '2026-11' }));
    assert.strictEqual(rb.total, 10000000);
    const br = db.tabel.buku.find((b) => b.id === 'riki');
    assert.strictEqual(br.penghasilan, 10000000, 'penghasilan = angka (bigint)'); assert.strictEqual(br.rasio, '40,30,20,10');
    assert.strictEqual(ok(await call(R, 'bootstrap', {})).rencana.riki.penghasilan, 10000000);
  });
  resetTokenCache();
  console.log(`\n${lulus} test lulus`);
})().catch((e) => { console.error('GAGAL:', e); process.exit(1); });
