// Edge Function "kantong": API untuk PWA. Deploy: supabase functions deploy kantong --no-verify-jwt
// Keamanan: setiap request wajib membawa kode akses user (hash-nya ada di tabel akses). Tanpa kode, ditolak.
// Env otomatis: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY. Secret opsional untuk to-do -> Google Calendar:
//   GOOGLE_SA_JSON  = isi file JSON kunci service account (utuh)
//   TODO_CAL_ID     = id kalender "Rumah Kita" (Settings kalender > Integrate calendar > Calendar ID)
import { handleRequest, corsHeaders } from './api.mjs';
import { createCalendarAdapter } from './calendar.mjs';

const calendar = createCalendarAdapter({
  saJson: Deno.env.get('GOOGLE_SA_JSON') || '',
  calendarId: Deno.env.get('TODO_CAL_ID') || '',
  fetch: fetch
});

Deno.serve(async (req: Request) => {
  const headers = { ...corsHeaders(req.headers.get('origin') || '*'), 'Content-Type': 'application/json' };
  if (req.method === 'OPTIONS') return new Response('ok', { headers });
  if (req.method === 'GET') return new Response(JSON.stringify({ ok: true, app: 'Kantong API', backend: 'supabase' }), { headers });
  if (req.method !== 'POST') return new Response(JSON.stringify({ ok: false, error: 'Method tidak didukung' }), { status: 405, headers });
  const body = await req.text();
  const res = await handleRequest(body, {
    url: Deno.env.get('SUPABASE_URL') || '',
    serviceKey: Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '',
    fetch: fetch,
    calendar
  });
  return new Response(JSON.stringify(res), { headers });
});
