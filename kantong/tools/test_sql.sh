#!/usr/bin/env bash
# Tes skema Supabase (supabase/migrations/*.sql) di Postgres lokal.
# Pakai: PGURL=postgres://user:pass@host/db kantong/tools/test_sql.sh
# Tanpa PGURL: membuat cluster sementara dengan pg_ctlcluster (Ubuntu) di direktori temp.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
SQL="$ROOT/supabase/migrations/20261116000000_kantong.sql"
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
  end \$\$;"
fi

psql -q -v ON_ERROR_STOP=1 "$PGURL" -f "$SQL"
psql -q -v ON_ERROR_STOP=1 "$PGURL" -f "$SQL"   # idempoten: boleh dijalankan dua kali
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

# kantong_muat: snapshot semua tabel, tanggal sebagai string, null tetap null
MUAT="$(q "select kantong_muat()")"
node -e '
const s = JSON.parse(process.argv[1]);
const a = require("assert");
a.strictEqual(s.buku.length, 3); a.strictEqual(s.users.length, 2);
a.strictEqual(s.transaksi[0].tanggal, "2026-11-17"); a.strictEqual(s.transaksi[0].nominal, 30000);
a.strictEqual(s.kantong[0].limit, 0); a.strictEqual(s.kantong[0].per_tanggal, "2026-10-31");
a.strictEqual(s.todo[0].tanggal, null); a.strictEqual(s.todo[0].selesai, false);
a.strictEqual(s.akses.length, 1); a.ok(s.akses[0].token_hash.length === 64);
' "$MUAT"
echo "✓ kantong_muat: snapshot lengkap, tipe kolom sesuai harapan core"

# RLS: anon tidak bisa baca apa pun, tidak bisa memanggil RPC
[ "$(psql -qtA "$PGURL" -c "set role anon; select count(*) from transaksi" 2>&1 | tr -d '\n' | grep -c 'permission denied\|^0$')" = "1" ] || { echo "anon harus ditolak/kosong"; exit 1; }
if psql -qtA -v ON_ERROR_STOP=1 "$PGURL" -c "set role anon; select kantong_muat()" >/dev/null 2>&1; then echo "anon tidak boleh memanggil kantong_muat"; exit 1; fi
if psql -qtA -v ON_ERROR_STOP=1 "$PGURL" -c "set role authenticated; select kantong_buat_kode('riki','https://x')" >/dev/null 2>&1; then echo "authenticated tidak boleh membuat kode"; exit 1; fi
echo "✓ RLS & hak akses: anon/authenticated ditolak"
echo
echo "semua tes SQL lulus"
