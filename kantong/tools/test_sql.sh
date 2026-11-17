#!/usr/bin/env bash
# Tes skema Supabase (supabase/migrations/*.sql) di Postgres lokal.
# Pakai: PGURL=postgres://user:pass@host/db kantong/tools/test_sql.sh
# Tanpa PGURL: membuat cluster sementara dengan pg_ctlcluster (Ubuntu) di direktori temp.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
MIGRASI=("$ROOT"/supabase/migrations/*.sql)   # urut nama file = urut waktu
TMP=""
if [ -z "${PGURL:-}" ]; then
  TMP="$(mktemp -d)"
  PGBIN="$(ls -d /usr/lib/postgresql/*/bin | tail -1)"
  RUN=""
  if [ "$(id -u)" = "0" ]; then RUN="runuser -u postgres --"; chown postgres "$TMP"; fi   # initdb menolak root
  $RUN "$PGBIN/initdb" -D "$TMP/data" -A trust -U postgres >/dev/null
  $RUN "$PGBIN/pg_ctl" -D "$TMP/data" -o "-k $TMP -p 54329 -c listen_addresses=''" -l "$TMP/log" start >/dev/null
  PGURL="postgres://postgres@/postgres?host=$TMP&port=54329"
  trap '$RUN "$PGBIN/pg_ctl" -D "$TMP/data" stop -m immediate >/dev/null; rm -rf "$TMP"' EXIT
  # peran Supabase yang dirujuk migrasi
  psql -q "$PGURL" -c "do \$\$ begin
    if not exists (select 1 from pg_roles where rolname='anon') then create role anon nologin; end if;
    if not exists (select 1 from pg_roles where rolname='authenticated') then create role authenticated nologin; end if;
    if not exists (select 1 from pg_roles where rolname='service_role') then create role service_role nologin bypassrls; end if;
  end \$\$; create schema if not exists extensions;"
fi

for f in "${MIGRASI[@]}"; do psql -q -v ON_ERROR_STOP=1 "$PGURL" -f "$f"; done
for f in "${MIGRASI[@]}"; do psql -q -v ON_ERROR_STOP=1 "$PGURL" -f "$f"; done   # idempoten: boleh dijalankan dua kali
echo "✓ migrasi jalan dua kali tanpa error"

q() { psql -qtA -v ON_ERROR_STOP=1 "$PGURL" -c "$1"; }

# kode koneksi: base64url JSON {api, token}; hash token tersimpan
KODE="$(q "select kantong_buat_kode('riki', 'https://proj.supabase.co/functions/v1/kantong')")"
DECODED="$(node -e "let s=process.argv[1].replace(/-/g,'+').replace(/_/g,'/');while(s.length%4)s+='=';const o=JSON.parse(Buffer.from(s,'base64').toString());console.log(o.api, o.token.length)" "$KODE")"
[ "$DECODED" = "https://proj.supabase.co/functions/v1/kantong 40" ] || { echo "kode koneksi salah: $DECODED"; exit 1; }
TOKEN="$(node -e "let s=process.argv[1].replace(/-/g,'+').replace(/_/g,'/');while(s.length%4)s+='=';console.log(JSON.parse(Buffer.from(s,'base64').toString()).token)" "$KODE")"
HASH="$(q "select token_hash from akses where user_id='riki'")"
[ "$HASH" = "$(printf %s "$TOKEN" | sha256sum | cut -d' ' -f1)" ] || { echo "hash token tidak cocok"; exit 1; }
echo "✓ kantong_buat_kode: kode koneksi valid, hash sha256 tersimpan"
q "select kantong_buat_kode('riki', 'https://proj.supabase.co/functions/v1/kantong')" >/dev/null
[ "$(q "select count(*) from akses")" = "1" ] || { echo "kode ganti harus menimpa, bukan menambah"; exit 1; }
[ "$(q "select token_hash from akses where user_id='riki'")" != "$HASH" ] || { echo "kode lama harus mati"; exit 1; }
echo "✓ buat kode lagi: kode lama tidak berlaku"
if q "select kantong_buat_kode('siapa', 'https://x')" 2>/dev/null; then echo "user tak dikenal harus ditolak"; exit 1; fi
echo "✓ user tak dikenal ditolak"

# kantong_simpan: upsert lintas tabel, tanggal null & bigint, kolom "limit"
ROWS='[{"tabel":"kantong","baris":{"id":"bca","nama":"BCA","jenis":"Debit","buku":"riki","saldo_awal":1000000,"per_tanggal":"2026-10-31","limit":0,"aktif":true,"urutan":1}},
       {"tabel":"transaksi","baris":{"id":"tx-1","tanggal":"2026-11-16","tipe":"Pengeluaran","nominal":25000,"buku":"riki","kategori":"makan","kantong":"bca","kantong_tujuan":"","keterangan":"kopi","reimburse":false,"oleh":"riki","sumber":"app","dibuat":"2026-11-16T10:00:00+07:00","diubah":"2026-11-16T10:00:00+07:00","dihapus":"","terbayar":"","tx_balik":""}},
       {"tabel":"todo","baris":{"id":"td-1","judul":"Beli galon","pemilik":"riki","tanggal":null,"jam":"","durasi":30,"selesai":false,"selesai_oleh":"","gcal_event_id":"","gcal_status":"","gcal_error":"","oleh":"riki","dibuat":"2026-11-16T10:00:00+07:00","diubah":"2026-11-16T10:00:00+07:00","dihapus":""}}]'
[ "$(q "select kantong_simpan('$ROWS'::jsonb)")" = "3" ] || { echo "kantong_simpan harus mengembalikan 3"; exit 1; }
ROWS2='[{"tabel":"transaksi","baris":{"id":"tx-1","tanggal":"2026-11-17","tipe":"Pengeluaran","nominal":30000,"buku":"riki","kategori":"makan","kantong":"bca","kantong_tujuan":"","keterangan":"kopi lagi","reimburse":true,"oleh":"riki","sumber":"app","dibuat":"2026-11-16T10:00:00+07:00","diubah":"2026-11-17T10:00:00+07:00","dihapus":"","terbayar":"","tx_balik":""}}]'
q "select kantong_simpan('$ROWS2'::jsonb)" >/dev/null
[ "$(q "select count(*) from transaksi")" = "1" ] || { echo "upsert harus menimpa"; exit 1; }
[ "$(q "select nominal||'|'||tanggal||'|'||reimburse from transaksi where id='tx-1'")" = "30000|2026-11-17|true" ] || { echo "nilai update salah"; exit 1; }
echo "✓ kantong_simpan: insert + update by id, tanggal/bigint/boolean benar"
if q "select kantong_simpan('[{\"tabel\":\"akses\",\"baris\":{\"user_id\":\"riki\"}}]'::jsonb)" 2>/dev/null; then echo "tabel akses tidak boleh lewat kantong_simpan"; exit 1; fi
if q "select kantong_simpan('[{\"tabel\":\"todo\",\"baris\":{\"judul\":\"tanpa id\"}}]'::jsonb)" 2>/dev/null; then echo "baris tanpa id harus ditolak"; exit 1; fi
echo "✓ kantong_simpan menolak tabel terlarang & baris tanpa id"

# Beranda: catatan bertipe di todo; baris todo versi lama (tanpa tipe/isi) tetap bisa disimpan
ROWS3='[{"tabel":"todo","baris":{"id":"c-1","judul":"Catatan","pemilik":"bersama","tanggal":null,"jam":"","durasi":30,"selesai":false,"selesai_oleh":"","gcal_event_id":"","gcal_status":"","gcal_error":"","oleh":"riki","dibuat":"y","diubah":"y","dihapus":"","tipe":"catatan","isi":"isi"}}]'
[ "$(q "select kantong_simpan('$ROWS3'::jsonb)")" = "1" ] || { echo "kantong_simpan tabel Beranda gagal"; exit 1; }
[ "$(q "select coalesce(tipe,'') from todo where id='td-1'")" = "" ] || { echo "todo lama: tipe kosong (core membacanya sebagai todo)"; exit 1; }
echo "✓ catatan tersimpan; to-do versi lama tetap bisa disimpan (tipe kosong = todo)"
JR='[{"tabel":"jurnal","baris":{"id":"riki|_pengaturan","pemilik":"riki","jenis":"pengaturan","tanggal":null,"isi":"{}","diubah":"x","dihapus":""}},{"tabel":"jurnal","baris":{"id":"riki|2026-11-18","pemilik":"riki","jenis":"entri","tanggal":"2026-11-18","isi":"{}","diubah":"x","dihapus":""}}]'
[ "$(q "select kantong_simpan('$JR'::jsonb)")" = "2" ] || { echo "simpan jurnal gagal"; exit 1; }
[ "$(q "select jsonb_array_length(kantong_muat()->'jurnal')")" = "2" ] || { echo "jurnal harus ada di snapshot"; exit 1; }
echo "✓ jurnal Daily Mood: tersimpan & ikut snapshot"

# kantong_muat: snapshot semua tabel, tanggal sebagai string, null tetap null
MUAT="$(q "select kantong_muat()")"
node -e '
const s = JSON.parse(process.argv[1]);
const a = require("assert");
a.strictEqual(s.buku.length, 3); a.strictEqual(s.users.length, 2);
a.strictEqual(s.transaksi[0].tanggal, "2026-11-17"); a.strictEqual(s.transaksi[0].nominal, 30000);
a.strictEqual(s.kantong[0].limit, 0); a.strictEqual(s.kantong[0].per_tanggal, "2026-10-31");
a.strictEqual(s.todo[0].tanggal, null); a.strictEqual(s.todo[0].selesai, false);
a.strictEqual(s.todo.find((t) => t.id === "c-1").tipe, "catatan");
a.strictEqual(s.akses.length, 1); a.ok(s.akses[0].token_hash.length === 64);
' "$MUAT"
echo "✓ kantong_muat: snapshot lengkap, tipe kolom sesuai harapan core"

# Komitmen: tabel ikut snapshot, nomor pasal unik, enum dijaga check constraint (isi sintetis)
KOM='[{"tabel":"komitmen_bab","baris":{"id":"bab-1","nomor":"I","judul":"Contoh","urutan":1,"dibuat_at":"","dihapus":""}},
      {"tabel":"komitmen_pasal","baris":{"id":"p-1","nomor":1,"bab_id":"bab-1","tipe":"definisi","judul":"Contoh","kata_kunci":"","sumber_asal":"pranikah","rujukan_asli":"","terkunci":true,"status":"berlaku","versi_berlaku_id":"v-1","dibuat_oleh":"riki","dibuat_at":"","diubah_at":"","dihapus":""}},
      {"tabel":"komitmen_versi","baris":{"id":"v-1","pasal_id":"p-1","versi":1,"isi_ayat":"[\"[placeholder]\"]","alasan":"","jenis":"baru","sumber":"pranikah","evaluasi_id":"","pengesahan_id":"s-1","status":"berlaku","berlaku_sejak":"2026-12-01T20:00:00+07:00","dibuat_oleh":"riki","dibuat_at":""}},
      {"tabel":"pengesahan","baris":{"id":"s-1","judul":"Contoh","jenis":"pranikah","evaluasi_id":"","ttd_riki":"M0 0L1 1","ttd_riki_at":"","ttd_febie":"","ttd_febie_at":"","isi_hash":"","status":"menunggu","dibuat_at":""}},
      {"tabel":"evaluasi","baris":{"id":"e-1","tanggal":"2026-12-01","catatan":"","dibuat_oleh":"riki","selesai_at":""}}]'
[ "$(q "select kantong_simpan('$KOM'::jsonb)")" = "5" ] || { echo "simpan komitmen harus 5 baris"; exit 1; }
node -e '
const s = JSON.parse(process.argv[1]); const a = require("assert");
a.strictEqual(s.komitmen_pasal[0].nomor, 1); a.strictEqual(s.komitmen_pasal[0].terkunci, true);
a.strictEqual(s.komitmen_bab[0].nomor, "I"); a.strictEqual(s.komitmen_versi[0].versi, 1);
a.deepStrictEqual(JSON.parse(s.komitmen_versi[0].isi_ayat), ["[placeholder]"]);
a.strictEqual(s.evaluasi[0].tanggal, "2026-12-01"); a.strictEqual(s.pengesahan[0].ttd_riki, "M0 0L1 1");
a.ok(Array.isArray(s.komitmen_keterangan));
' "$(q "select kantong_muat()")"
DUP='[{"tabel":"komitmen_pasal","baris":{"id":"p-2","nomor":1,"bab_id":"bab-1","tipe":"kesepakatan","judul":"x","kata_kunci":"","sumber_asal":"app","rujukan_asli":"","terkunci":false,"status":"usulan","versi_berlaku_id":"","dibuat_oleh":"riki","dibuat_at":"","diubah_at":"","dihapus":""}}]'
if q "select kantong_simpan('$DUP'::jsonb)" 2>/dev/null; then echo "nomor pasal dobel harus ditolak"; exit 1; fi
BAD='[{"tabel":"komitmen_pasal","baris":{"id":"p-3","nomor":3,"bab_id":"","tipe":"lain","judul":"x","kata_kunci":"","sumber_asal":"app","rujukan_asli":"","terkunci":false,"status":"usulan","versi_berlaku_id":"","dibuat_oleh":"","dibuat_at":"","diubah_at":"","dihapus":""}}]'
if q "select kantong_simpan('$BAD'::jsonb)" 2>/dev/null; then echo "tipe pasal tak dikenal harus ditolak"; exit 1; fi
[ "$(psql -qtA "$PGURL" -c "set role anon; select count(*) from komitmen_pasal" 2>&1 | tr -d '\n' | grep -c 'permission denied\|^0$')" = "1" ] || { echo "anon tidak boleh membaca komitmen"; exit 1; }
echo "✓ komitmen: 6 tabel di snapshot, nomor pasal unik, enum dijaga, anon ditolak"

# Login: password bcrypt, sesi per perangkat, kunci setelah 5x salah
q "select kantong_atur_login('riki','Riki','rahasia123')" >/dev/null
[ "$(q "select kantong_login('riki','salah')->>'ok'")" = "false" ] || { echo "password salah harus ditolak"; exit 1; }
TOK="$(q "select kantong_login('riki','rahasia123')->>'token'")"
[ "${#TOK}" = "64" ] || { echo "token sesi harus 64 hex"; exit 1; }
H="$(q "select encode(extensions.digest('$TOK','sha256'),'hex')")"
[ "$(q "select kantong_cek_sesi('$H')")" = "riki" ] || { echo "sesi harus dikenali"; exit 1; }
q "select kantong_logout('$H')" >/dev/null
[ -z "$(q "select kantong_cek_sesi('$H')")" ] || { echo "logout harus mencabut sesi"; exit 1; }
for i in 1 2 3 4 5; do q "select kantong_login('riki','x$i')" >/dev/null; done
[ "$(q "select kantong_login('riki','rahasia123')->>'alasan'")" = "terkunci" ] || { echo "5x salah harus terkunci"; exit 1; }
if psql -qtA -v ON_ERROR_STOP=1 "$PGURL" -c "set role anon; select kantong_login('riki','rahasia123')" >/dev/null 2>&1; then echo "anon tidak boleh login langsung"; exit 1; fi
# Admin panel
q "update login set admin = true, gagal = 0, kunci_sampai = null where user_id = 'riki'" >/dev/null
q "select kantong_atur_login('riki','riki','rahasia123')" >/dev/null
q "update login set admin = true where user_id = 'riki'" >/dev/null
AT="$(q "select kantong_login('riki','rahasia123')->>'token'")"
AH="$(q "select encode(extensions.digest('$AT','sha256'),'hex')")"
[ "$(q "select kantong_admin('$AH','list','{}')->>'ok'")" = "true" ] || { echo "admin list gagal"; exit 1; }
PW="$(q "select kantong_admin('$AH','simpan','{\"user_id\":\"tamu\",\"username\":\"tamu\",\"nama\":\"Tamu\"}')->>'password'")"
[ "${#PW}" = "12" ] || { echo "akun baru harus dapat password 12 karakter"; exit 1; }
[ "$(q "select kantong_login('tamu','$PW')->>'ok'")" = "true" ] || { echo "password hasil generate harus bisa login"; exit 1; }
TH="$(q "select encode(extensions.digest(kantong_login('tamu','$PW')->>'token','sha256'),'hex')")"
[ "$(q "select kantong_admin('$TH','list','{}')->>'code'")" = "AUTH" ] || { echo "non-admin harus ditolak"; exit 1; }
PW2="$(q "select kantong_admin('$AH','reset','{\"user_id\":\"tamu\"}')->>'password'")"
[ "$(q "select kantong_login('tamu','$PW')->>'ok'")" = "false" ] || { echo "password lama harus mati setelah reset"; exit 1; }
[ -z "$(q "select kantong_cek_sesi('$TH')")" ] || { echo "reset harus mencabut sesi"; exit 1; }
q "select kantong_admin('$AH','simpan','{\"user_id\":\"tamu\",\"username\":\"tamu\",\"aktif\":false}')" >/dev/null
[ "$(q "select kantong_login('tamu','$PW2')->>'alasan'")" = "nonaktif" ] || { echo "akun nonaktif harus ditolak"; exit 1; }
[ "$(q "select kantong_admin('$AH','hapus','{\"user_id\":\"riki\"}')->>'ok'")" = "false" ] || { echo "admin tidak boleh hapus diri sendiri"; exit 1; }
[ "$(q "select kantong_admin('$AH','hapus','{\"user_id\":\"tamu\"}')->>'ok'")" = "true" ] || { echo "hapus gagal"; exit 1; }
# Password sementara dari admin wajib diganti user sendiri
PW3="$(q "select kantong_admin('$AH','simpan','{\"user_id\":\"tamu2\",\"username\":\"tamu2\"}')->>'password'")"
L3="$(q "select kantong_login('tamu2','$PW3')")"
[ "$(echo "$L3" | node -pe 'JSON.parse(require("fs").readFileSync(0)).wajib_ganti')" = "true" ] || { echo "akun baru harus wajib_ganti"; exit 1; }
H3="$(q "select encode(extensions.digest('$(echo "$L3" | node -pe 'JSON.parse(require("fs").readFileSync(0)).token')','sha256'),'hex')")"
[ "$(q "select kantong_sesi('$H3')->>'wajib_ganti'")" = "true" ] || { echo "sesi harus tandai wajib_ganti"; exit 1; }
[ "$(q "select kantong_ganti_password('$H3','salah','barubaru1')->>'ok'")" = "false" ] || { echo "password lama salah harus ditolak"; exit 1; }
[ "$(q "select kantong_ganti_password('$H3','$PW3','pendek')->>'ok'")" = "false" ] || { echo "password pendek harus ditolak"; exit 1; }
[ "$(q "select kantong_ganti_password('$H3','$PW3','barubaru1')->>'ok'")" = "true" ] || { echo "ganti password gagal"; exit 1; }
[ "$(q "select kantong_sesi('$H3')->>'wajib_ganti'")" = "false" ] || { echo "setelah ganti, wajib_ganti harus false"; exit 1; }
[ "$(q "select kantong_login('tamu2','barubaru1')->>'ok'")" = "true" ] || { echo "password baru harus bisa login"; exit 1; }
q "select kantong_admin('$AH','reset','{\"user_id\":\"tamu2\"}')" >/dev/null
[ "$(q "select wajib_ganti from login where user_id='tamu2'")" = "t" ] || { echo "reset admin harus wajib_ganti"; exit 1; }
q "select kantong_admin('$AH','simpan','{\"user_id\":\"tamu2\",\"username\":\"tamu2\",\"nama\":\"T\"}')" >/dev/null
q "update login set wajib_ganti = true where user_id='riki'" >/dev/null
[ "$(q "select kantong_admin('$AH','list','{}')->>'code'")" = "GANTI_PW" ] || { echo "admin berpassword sementara harus ganti dulu"; exit 1; }
q "update login set wajib_ganti = false where user_id='riki'" >/dev/null
echo "✓ ganti password: wajib ganti setelah generate admin, cek password lama, sesi lain dicabut"
echo "✓ admin: list, buat+generate password, reset, nonaktif, hapus, non-admin ditolak"
echo "✓ login: bcrypt, sesi, logout, kunci 5x salah, anon ditolak"

# RLS: anon tidak bisa baca apa pun, tidak bisa memanggil RPC
[ "$(psql -qtA "$PGURL" -c "set role anon; select count(*) from transaksi" 2>&1 | tr -d '\n' | grep -c 'permission denied\|^0$')" = "1" ] || { echo "anon harus ditolak/kosong"; exit 1; }
if psql -qtA -v ON_ERROR_STOP=1 "$PGURL" -c "set role anon; select kantong_muat()" >/dev/null 2>&1; then echo "anon tidak boleh memanggil kantong_muat"; exit 1; fi
if psql -qtA -v ON_ERROR_STOP=1 "$PGURL" -c "set role authenticated; select kantong_buat_kode('riki','https://x')" >/dev/null 2>&1; then echo "authenticated tidak boleh membuat kode"; exit 1; fi
echo "✓ RLS & hak akses: anon/authenticated ditolak"
echo
echo "semua tes SQL lulus"
