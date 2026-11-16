/**
 * Ping harian ke project Supabase Siklus (akun Febie), supaya project gratis tidak di-pause
 * setelah 1 minggu tanpa aktivitas. Trik umum, bukan jaminan resmi Supabase.
 * Ping hanya memanggil siklus_ping() (balas "ok"); tidak membaca data apa pun.
 *
 * Pasang (sekali):
 *  1. Tempel file ini di project Apps Script mana saja (boleh project Kantong lama).
 *  2. Project Settings > Script Properties: SIKLUS_URL = https://xxxx.supabase.co, SIKLUS_ANON = anon public key.
 *  3. Jalankan pasangPingSiklus() sekali, izinkan akses.
 */
function pingSiklus() {
  var p = PropertiesService.getScriptProperties();
  var url = p.getProperty('SIKLUS_URL'), key = p.getProperty('SIKLUS_ANON');
  if (!url || !key) return;
  var res = UrlFetchApp.fetch(url.replace(/\/$/, '') + '/rest/v1/rpc/siklus_ping', {
    method: 'post', contentType: 'application/json', payload: '{}', muteHttpExceptions: true,
    headers: { apikey: key, Authorization: 'Bearer ' + key }
  });
  if (res.getResponseCode() !== 200) console.warn('Ping Siklus gagal: ' + res.getResponseCode() + ' ' + res.getContentText().slice(0, 200));
}

function pasangPingSiklus() {
  ScriptApp.getProjectTriggers().forEach(function (t) { if (t.getHandlerFunction() === 'pingSiklus') ScriptApp.deleteTrigger(t); });
  ScriptApp.newTrigger('pingSiklus').timeBased().everyDays(1).atHour(6).inTimezone('Asia/Jakarta').create();
  pingSiklus();
}
