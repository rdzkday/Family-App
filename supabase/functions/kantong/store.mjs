/*
 * Store adapter Supabase untuk KantongCore.handle():
 *   store.all(tabel)        -> baris (salinan), nama tabel sesuai SCHEMA (Buku, Users, ...)
 *   store.upsert(tabel, o)  -> ubah di memori + antre untuk ditulis
 *   store.flush()           -> satu panggilan RPC kantong_simpan (satu transaksi)
 * Semua baca lewat RPC kantong_muat (satu snapshot). Hanya memakai fetch, tanpa library.
 */
import KantongCore from './core.mjs';

export const TABEL = {
  Buku: 'buku', Users: 'users', Kategori: 'kategori', Kantong: 'kantong', Budget: 'budget', Transaksi: 'transaksi', Todo: 'todo',
  KomitmenBab: 'komitmen_bab', KomitmenPasal: 'komitmen_pasal', KomitmenVersi: 'komitmen_versi',
  KomitmenKeterangan: 'komitmen_keterangan', Pengesahan: 'pengesahan', Evaluasi: 'evaluasi'
};
const KOLOM_TANGGAL = { tanggal: 1, per_tanggal: 1 };
const KOLOM_BOOL = { hitung: 1, aktif: 1, reimburse: 1, selesai: 1, terkunci: 1 };
const KOLOM_ANGKA = { nominal: 1, saldo_awal: 1, limit: 1, urutan: 1, durasi: 1, versi: 1 };
// kolom yang tipenya beda per tabel: nomor pasal = angka, nomor bab = teks (I, II, ...)
const KOLOM_ANGKA_TABEL = { KomitmenPasal: { nomor: 1 } };
const angka = (tabel, h) => KOLOM_ANGKA[h] || (KOLOM_ANGKA_TABEL[tabel] && KOLOM_ANGKA_TABEL[tabel][h]);

// Postgres -> bentuk yang diharapkan core (null jadi '' / false / 0)
export function dariDb(tabel, row) {
  const o = {};
  for (const h of KantongCore.SCHEMA[tabel]) {
    const v = row[h];
    if (KOLOM_BOOL[h]) o[h] = v === true;
    else if (angka(tabel, h)) o[h] = Number(v) || 0;
    else o[h] = v === null || v === undefined ? '' : String(v);
  }
  return o;
}
// core -> Postgres ('' pada kolom tanggal jadi null)
export function keDb(tabel, obj) {
  const o = {};
  for (const h of KantongCore.SCHEMA[tabel]) {
    let v = obj[h];
    if (v === undefined) v = '';
    if (KOLOM_TANGGAL[h]) v = v ? String(v) : null;
    else if (KOLOM_BOOL[h]) v = v === true || v === 'TRUE' || v === 'true' || v === 1;
    else if (angka(tabel, h)) v = Math.round(Number(v) || 0);
    else v = String(v);
    o[h] = v;
  }
  return o;
}

export async function rpc(cfg, nama, args) {
  const res = await cfg.fetch(cfg.url.replace(/\/$/, '') + '/rest/v1/rpc/' + nama, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', apikey: cfg.serviceKey, Authorization: 'Bearer ' + cfg.serviceKey },
    body: JSON.stringify(args || {})
  });
  const text = await res.text();
  if (!res.ok) throw new Error('Database ' + res.status + ': ' + text.slice(0, 300));
  return text ? JSON.parse(text) : null;
}

// cfg: { url, serviceKey, fetch }
export async function createStore(cfg) {
  const snap = (await rpc(cfg, 'kantong_muat', {})) || {};
  const data = {};
  for (const t of Object.keys(KantongCore.SCHEMA)) data[t] = (snap[TABEL[t]] || []).map((r) => dariDb(t, r));
  const pending = [];
  return {
    akses: snap.akses || [],
    all(t) { return data[t].map((r) => ({ ...r })); },
    upsert(t, obj) {
      const row = keDb(t, obj);
      const clean = dariDb(t, row);
      const i = data[t].findIndex((r) => r.id === clean.id);
      if (i >= 0) data[t][i] = clean; else data[t].push(clean);
      // baris yang sama diubah dua kali dalam satu request: cukup kirim versi terakhir
      const j = pending.findIndex((p) => p.tabel === TABEL[t] && p.baris.id === row.id);
      if (j >= 0) pending[j] = { tabel: TABEL[t], baris: row }; else pending.push({ tabel: TABEL[t], baris: row });
      return clean;
    },
    get pendingCount() { return pending.length; },
    async flush() {
      if (!pending.length) return 0;
      const rows = pending.splice(0, pending.length);
      return rpc(cfg, 'kantong_simpan', { rows });
    }
  };
}
