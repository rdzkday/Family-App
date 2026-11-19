/*
 * Import perjanjian pranikah ke Komitmen (claude/komitmen-brief.md §7). Sekali pakai.
 * Isi akta TIDAK disimpan di repo: skrip membaca file JSON dari luar repo lalu langsung kirim ke Supabase.
 *
 * Pakai:
 *   NODE_USE_ENV_PROXY=1 SUPABASE_ACCESS_TOKEN=sbp_xxx node kantong/tools/import_pranikah.mjs <project_ref> <file.json> [--kirim]
 * Tanpa --kirim: hanya cek & tampilkan ringkasan (tidak menulis apa pun).
 *
 * Format file:
 *   { "tanggal_akta": "2025-05-04",
 *     "bab":   [{ "id": "a02", "nomor": "I", "judul": "..." }],
 *     "pasal": [{ "nomor": 1, "bab": "a02" | "", "tipe": "kesepakatan" | "definisi", "judul": "...",
 *                 "rujukan": "Pasal 1 ...", "kata_kunci": "a, b", "pembuka": "teks tanpa nomor (boleh kosong)",
 *                 "ayat": ["teks ayat (1)", "teks ayat (2)"] }] }
 * Hasil: semua pasal berstatus USULAN + satu Lembar Pengesahan "Perjanjian Pranikah" (berlaku setelah TTD berdua).
 */
import fs from 'fs';
import { keDb, TABEL } from '../../supabase/functions/kantong/store.mjs';

const [ref, file] = process.argv.slice(2).filter((a) => !a.startsWith('--'));
const kirim = process.argv.includes('--kirim');
if (!ref || !file) { console.error('pakai: node kantong/tools/import_pranikah.mjs <project_ref> <file.json> [--kirim]'); process.exit(1); }
const token = process.env.SUPABASE_ACCESS_TOKEN || 'sbp_' + '0'.repeat(40);   // di sesi cloud, proxy mengganti token
const data = JSON.parse(fs.readFileSync(file, 'utf8'));

async function sql(query) {
  const res = await fetch('https://api.supabase.com/v1/projects/' + ref + '/database/query', {
    method: 'POST', headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' }, body: JSON.stringify({ query })
  });
  const text = await res.text();
  if (!res.ok) throw new Error('Database ' + res.status + ': ' + text.slice(0, 300));
  return JSON.parse(text);
}

// ---------- cek isi file ----------
const salah = [];
const babIds = new Set((data.bab || []).map((b) => b.id));
const nomorDipakai = new Set();
(data.pasal || []).forEach((p) => {
  const n = 'Pasal ' + p.nomor;
  if (!Number.isInteger(p.nomor) || p.nomor < 1) salah.push(n + ': nomor tidak valid');
  if (nomorDipakai.has(p.nomor)) salah.push(n + ': nomor dobel');
  nomorDipakai.add(p.nomor);
  if (!['kesepakatan', 'definisi'].includes(p.tipe)) salah.push(n + ': tipe harus kesepakatan/definisi');
  if (p.tipe === 'kesepakatan' && !babIds.has(p.bab)) salah.push(n + ': bab tidak dikenal');
  if (p.tipe === 'definisi' && p.bab) salah.push(n + ': definisi tidak punya bab');
  if (!String(p.judul || '').trim()) salah.push(n + ': judul kosong');
  if (!String(p.pembuka || '').trim() && !(p.ayat || []).length) salah.push(n + ': isi kosong');
});
if (!/^\d{4}-\d{2}-\d{2}$/.test(String(data.tanggal_akta || ''))) salah.push('tanggal_akta harus YYYY-MM-DD');
if (salah.length) { console.error('File tidak valid:\n- ' + salah.join('\n- ')); process.exit(1); }

// ---------- susun baris ----------
const now = new Date(Date.now() + 7 * 3600e3).toISOString().slice(0, 19) + '+07:00';
const SID = 'sah-pranikah';
const rows = [];
const add = (t, o) => rows.push({ tabel: TABEL[t], baris: keDb(t, o) });
(data.bab || []).forEach((b, i) => add('KomitmenBab', { id: 'pra-' + b.id, nomor: b.nomor, judul: b.judul, urutan: i + 1, dibuat_at: now, dihapus: '' }));
add('Pengesahan', { id: SID, judul: 'Perjanjian Pranikah', jenis: 'pranikah', evaluasi_id: '', ttd_riki: '', ttd_riki_at: '', ttd_febie: '', ttd_febie_at: '',
  isi_hash: '', status: 'menunggu', dibuat_at: now });
data.pasal.forEach((p) => {
  const pid = 'pra-p' + p.nomor;
  const isi = p.pembuka ? { pembuka: p.pembuka, ayat: p.ayat || [] } : (p.ayat || []);
  add('KomitmenVersi', { id: pid + '-v1', pasal_id: pid, versi: 1, isi_ayat: JSON.stringify(isi), alasan: 'Import perjanjian pranikah (akta ' + data.tanggal_akta + ')',
    jenis: 'baru', sumber: 'pranikah', evaluasi_id: '', pengesahan_id: SID, status: 'usulan', berlaku_sejak: '', dibuat_oleh: 'riki', dibuat_at: now });
  add('KomitmenPasal', { id: pid, nomor: p.nomor, bab_id: p.bab ? 'pra-' + p.bab : '', tipe: p.tipe, judul: p.judul, kata_kunci: p.kata_kunci || '',
    sumber_asal: 'pranikah', rujukan_asli: p.rujukan || '', terkunci: true, status: 'usulan', versi_berlaku_id: '', dibuat_oleh: 'riki',
    dibuat_at: now, diubah_at: now, dihapus: '' });
});

console.log(`${data.bab.length} bab, ${data.pasal.length} pasal (${data.pasal.filter((p) => p.tipe === 'definisi').length} definisi), 1 lembar pengesahan → ${rows.length} baris`);
data.pasal.forEach((p) => console.log(`  Pasal ${p.nomor} · ${p.tipe} · ${p.judul} · ${p.pembuka ? 'pembuka + ' : ''}${(p.ayat || []).length} ayat`));

(async () => {
  // nomor pasal tidak boleh dipakai ulang: tolak kalau bentrok dengan pasal yang sudah ada
  const ada = await sql('select id, nomor from komitmen_pasal');
  const bentrok = ada.filter((r) => nomorDipakai.has(r.nomor) && !String(r.id).startsWith('pra-'));
  if (bentrok.length) { console.error('Nomor sudah dipakai: ' + bentrok.map((r) => r.nomor).join(', ')); process.exit(1); }
  const sudah = await sql("select status from pengesahan where id = '" + SID + "'");
  if (sudah.length && sudah[0].status === 'sah') { console.error('Perjanjian pranikah sudah disahkan. Import ulang ditolak.'); process.exit(1); }
  if (!kirim) { console.log('\nCek saja (tanpa --kirim). Tidak ada yang ditulis.'); return; }
  const json = JSON.stringify(rows);
  if (json.includes('$imp$')) throw new Error('teks mengandung penanda kutip');
  const r = await sql('select kantong_simpan($imp$' + json + '$imp$::jsonb) as n');
  console.log('\nTersimpan: ' + r[0].n + ' baris. Status: USULAN, menunggu TTD berdua di Lembar Pengesahan.');
})().catch((e) => { console.error('Error:', e.message); process.exit(1); });
