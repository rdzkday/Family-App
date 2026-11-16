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
    budget: [], transaksi: [], todo: [], momen: [],
    akses: [{ user_id: 'riki', token_hash: sha('r'.repeat(40)) }, { user_id: 'istri', token_hash: sha('i'.repeat(40)) }]
  };
  const calls = [];
  const fetch = async (url, opt) => {
    calls.push({ url, opt });
    const m = url.match(/\/rest\/v1\/rpc\/(\w+)$/);
    assert.ok(m, 'url rpc tidak dikenal: ' + url);
    assert.strictEqual(opt.headers.Authorization, 'Bearer SERVICE', 'service key harus dikirim');
    if (m[1] === 'kantong_muat') return { ok: true, status: 200, text: async () => JSON.stringify(tabel) };
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
  await t('momen tahunan: event seharian berulang tiap tahun, rentang sampai hari terakhir', async () => {
    const d = ok(await call(R, 'momen.save', { id: 'mo-1', judul: 'Trip pertama', tanggal: '2025-06-01', tanggal_selesai: '2025-06-03', pemilik: 'bersama', kategori: 'kita', tahunan: true }));
    assert.match(d.momen.gcal_event_id, /^ev\d+$/); assert.strictEqual(d.momen.gcal_status, 'ok');
    const ev = g.events[d.momen.gcal_event_id];
    assert.deepStrictEqual(ev.start, { date: '2025-06-01' }); assert.deepStrictEqual(ev.end, { date: '2025-06-04' });
    assert.deepStrictEqual(ev.recurrence, ['RRULE:FREQ=YEARLY']); assert.strictEqual(ev.colorId, '6');
    const row = db.tabel.momen.find((x) => x.id === 'mo-1');
    assert.strictEqual(row.gcal_status, 'ok'); assert.strictEqual(row.tanggal_selesai, '2025-06-03'); assert.strictEqual(row.tahunan, true);
    const off = ok(await call(R, 'momen.save', { id: 'mo-1', judul: 'Trip pertama', tanggal: '2025-06-01', tanggal_selesai: '2025-06-03', pemilik: 'bersama', kategori: 'kita', tahunan: false }));
    assert.strictEqual(off.momen.gcal_event_id, ''); assert.strictEqual(g.events[d.momen.gcal_event_id], undefined);
    const satu = ok(await call(I, 'momen.save', { id: 'mo-2', judul: 'Kenangan biasa', tanggal: '2024-01-05', pemilik: 'istri', kategori: 'keluarga' }));
    assert.strictEqual(satu.momen.gcal_event_id, ''); assert.strictEqual(db.tabel.momen.find((x) => x.id === 'mo-2').tanggal_selesai, null);
  });
  await t('agenda.month & bootstrap.kenangan lewat Supabase', async () => {
    const a = ok(await call(R, 'agenda.month', { bulan: '2025-06' }));
    assert.deepStrictEqual(a.momen.map((x) => x.id), ['mo-1']);
    const b = ok(await call(R, 'bootstrap', {}));
    assert.ok(b.fitur.includes('agenda')); assert.ok(Array.isArray(b.kenangan));
  });
  await t('database gagal saat simpan: dilaporkan sebagai error, bukan ok palsu', async () => {
    const rusak = { ...deps, fetch: async (url, opt) => url.endsWith('kantong_simpan') ? { ok: false, status: 500, text: async () => 'boom' } : db.fetch(url, opt) };
    const r = await call(R, 'tx.save', { ...tx1, id: 'tx-9' }, rusak);
    assert.strictEqual(r.ok, false); assert.match(r.error, /Gagal menyimpan/);
  });
  resetTokenCache();
  console.log(`\n${lulus} test lulus`);
})().catch((e) => { console.error('GAGAL:', e); process.exit(1); });
