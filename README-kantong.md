# Kantong: catatan keuangan keluarga (PWA + Supabase)

- `public/`: PWA yang di-deploy (Vercel, project `dompet-app`, setting di `vercel.json`). Push ke `main` = otomatis rilis.
- `supabase/`: backend. Skema di `migrations/`, API di `functions/kantong/` (Edge Function). Panduan pasang: `kantong/PANDUAN.md`.
- `public/core.js`: logika bersama (aturan akses, hitungan, to-do). Salinannya untuk Edge Function dan Apps Script dibuat lewat `node kantong/tools/build_core.js`.
- `kantong/apps-script/`: backend lama (Google Sheets), masih kompatibel, tidak dikembangkan lagi.
- `kantong-pastel/`, `public/dark/`: varian tampilan lama.

Fitur to-do rumah tangga + sync ke Google Calendar "Rumah Kita": lihat `kantong/PANDUAN.md` §7.

Data keuangan pribadi tidak disertakan di repo ini.
