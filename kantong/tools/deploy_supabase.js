/*
 * Deploy Edge Function "kantong" lewat Supabase Management API, tanpa Supabase CLI.
 * Pakai:
 *   SUPABASE_ACCESS_TOKEN=sbp_xxx node kantong/tools/deploy_supabase.js <project_ref>
 *   node kantong/tools/deploy_supabase.js <project_ref> --cek      (hanya lihat status fungsi)
 * Token: supabase.com -> Account -> Access Tokens. Fungsi di-deploy dengan verify_jwt = false
 * (autentikasi memakai kode akses di body request, lihat supabase/functions/kantong/index.ts).
 */
const fs = require('fs');
const path = require('path');

const ref = process.argv[2];
const hanyaCek = process.argv.includes('--cek');
if (!ref) { console.error('pakai: node kantong/tools/deploy_supabase.js <project_ref> [--cek]'); process.exit(1); }
const token = process.env.SUPABASE_ACCESS_TOKEN || 'proxy-injected';
const API = 'https://api.supabase.com/v1/projects/' + ref + '/functions';
const DIR = path.join(__dirname, '..', '..', 'supabase', 'functions', 'kantong');
const FILES = ['index.ts', 'api.mjs', 'store.mjs', 'calendar.mjs', 'core.mjs'];

async function req(url, opt) {
  const res = await fetch(url, { ...opt, headers: { Authorization: 'Bearer ' + token, ...(opt && opt.headers) } });
  const text = await res.text();
  let json = null; try { json = JSON.parse(text); } catch (e) { /* bukan json */ }
  return { status: res.status, ok: res.ok, json, text };
}

(async () => {
  const daftar = await req(API);
  if (!daftar.ok) { console.error('Gagal membaca daftar fungsi:', daftar.status, daftar.text.slice(0, 300)); process.exit(1); }
  const ada = (daftar.json || []).find((f) => f.slug === 'kantong');
  console.log(ada ? 'Fungsi kantong sudah ada: versi ' + ada.version + ', status ' + ada.status + ', verify_jwt ' + ada.verify_jwt
    : 'Fungsi kantong belum ada.');
  if (hanyaCek) return;

  const form = new FormData();
  form.append('metadata', JSON.stringify({ name: 'kantong', entrypoint_path: 'index.ts', verify_jwt: false }));
  for (const f of FILES) {
    const isi = fs.readFileSync(path.join(DIR, f));
    form.append('file', new Blob([isi], { type: f.endsWith('.ts') ? 'application/typescript' : 'text/javascript' }), f);
  }
  const dep = await req(API + '/deploy?slug=kantong', { method: 'POST', body: form });
  if (!dep.ok) { console.error('Deploy gagal:', dep.status, dep.text.slice(0, 500)); process.exit(1); }
  console.log('Deploy sukses: versi', dep.json && dep.json.version, '| verify_jwt', dep.json && dep.json.verify_jwt);
  console.log('URL API: https://' + ref + '.supabase.co/functions/v1/kantong');
})().catch((e) => { console.error('Error:', e.message); process.exit(1); });
