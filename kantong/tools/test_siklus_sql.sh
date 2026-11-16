#!/usr/bin/env bash
# Tes modul Siklus (supabase/migrations/*_siklus.sql) di Postgres lokal, dengan auth.users & auth.uid() tiruan.
# Pakai: kantong/tools/test_siklus_sql.sh   (atau PGURL=postgres://... untuk server yang sudah ada)
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
SQL="$ROOT/supabase/migrations/20261117000100_siklus.sql"
TMP=""
if [ -z "${PGURL:-}" ]; then
  TMP="$(mktemp -d)"
  PGBIN="$(ls -d /usr/lib/postgresql/*/bin | tail -1)"
  RUN=""
  if [ "$(id -u)" = "0" ]; then RUN="runuser -u postgres --"; chown postgres "$TMP"; fi
  $RUN "$PGBIN/initdb" -D "$TMP/data" -A trust -U postgres >/dev/null
  $RUN "$PGBIN/pg_ctl" -D "$TMP/data" -o "-k $TMP -p 54330 -c listen_addresses=''" -l "$TMP/log" start >/dev/null
  PGURL="postgres://postgres@/postgres?host=$TMP&port=54330"
  trap '$RUN "$PGBIN/pg_ctl" -D "$TMP/data" stop -m immediate >/dev/null; rm -rf "$TMP"' EXIT
fi

# tiruan bagian Supabase yang dirujuk migrasi
psql -q -v ON_ERROR_STOP=1 "$PGURL" <<'SQL'
do $$ begin
  if not exists (select 1 from pg_roles where rolname='anon') then create role anon nologin; end if;
  if not exists (select 1 from pg_roles where rolname='authenticated') then create role authenticated nologin; end if;
end $$;
create schema if not exists auth;
create table if not exists auth.users (id uuid primary key, email text);
create or replace function auth.uid() returns uuid language sql stable as
  $f$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $f$;
grant usage on schema auth to anon, authenticated;
grant execute on function auth.uid() to anon, authenticated;
grant usage on schema public to anon, authenticated;
insert into auth.users values
  ('00000000-0000-0000-0000-00000000000f', 'febie@contoh.test'),
  ('00000000-0000-0000-0000-00000000000a', 'riki@contoh.test'),
  ('00000000-0000-0000-0000-0000000000ee', 'orang@lain.test') on conflict do nothing;
SQL

psql -q -v ON_ERROR_STOP=1 "$PGURL" -f "$SQL"
psql -q -v ON_ERROR_STOP=1 "$PGURL" -f "$SQL"
echo "✓ migrasi Siklus jalan dua kali tanpa error"

F=00000000-0000-0000-0000-00000000000f; R=00000000-0000-0000-0000-00000000000a; X=00000000-0000-0000-0000-0000000000ee
q() { psql -qtA -v ON_ERROR_STOP=1 "$PGURL" -c "$1"; }
# jalankan sebagai user login tertentu (role authenticated + sub di JWT)
sebagai() { psql -qtA -v ON_ERROR_STOP=1 "$PGURL" -c "set role authenticated; set request.jwt.claim.sub = '$1'; $2"; }
jsonq() { node -e "const o=JSON.parse(process.argv[1]); console.log(eval(process.argv[2]))" "$1" "$2"; }

q "select siklus_atur_anggota('Febie@contoh.test', 'pemilik')" >/dev/null
q "select siklus_atur_anggota('riki@contoh.test', 'pembaca')" >/dev/null
if q "select siklus_atur_anggota('riki@contoh.test', 'pemilik')" 2>/dev/null; then echo "pemilik harus satu"; exit 1; fi
if sebagai "$R" "select siklus_atur_anggota('riki@contoh.test', 'pemilik')" 2>/dev/null; then echo "user app tidak boleh mengatur anggota"; exit 1; fi
echo "✓ anggota: satu pemilik, hanya pemilik project yang bisa mendaftarkan"

# bukan anggota & anon
[ "$(jsonq "$(sebagai "$X" "select siklus_muat()")" 'o.peran === null && o.siklus.length === 0')" = "true" ] || { echo "bukan anggota harus kosong"; exit 1; }
if psql -qtA -v ON_ERROR_STOP=1 "$PGURL" -c "set role anon; select siklus_muat()" >/dev/null 2>&1; then echo "anon tidak boleh memuat"; exit 1; fi
[ "$(psql -qtA "$PGURL" -c "set role anon; select siklus_ping()")" = "ok" ] || { echo "ping anon harus jalan"; exit 1; }
if sebagai "$F" "select count(*) from siklus" >/dev/null 2>&1; then echo "tabel tidak boleh dibaca langsung"; exit 1; fi
echo "✓ bukan anggota kosong, anon hanya bisa ping, tabel tertutup"

# pemilik belum aktif: pembaca tidak mendapat apa pun
sebagai "$F" "select siklus_simpan('{\"id\":\"11111111-1111-1111-1111-111111111111\",\"mulai\":\"2026-08-01\",\"selesai\":\"2026-08-05\",\"catatan\":\"kram\"}')" >/dev/null
[ "$(jsonq "$(sebagai "$R" "select siklus_muat()")" 'o.siklus.length + ":" + o.pengaturan.aktif')" = "0:false" ] || { echo "pembaca tidak boleh melihat sebelum aktif"; exit 1; }
echo "✓ sebelum Febie mengaktifkan: pembaca tidak mendapat data"

sebagai "$F" "select siklus_atur('{\"aktif\":true,\"setuju\":true,\"versi_teks\":1}')" >/dev/null
sebagai "$F" "select siklus_simpan('{\"id\":\"22222222-2222-2222-2222-222222222222\",\"mulai\":\"2026-08-30\"}')" >/dev/null
M="$(sebagai "$F" "select siklus_muat()")"
[ "$(jsonq "$M" 'o.peran + ":" + o.siklus.length + ":" + o.catatan["11111111-1111-1111-1111-111111111111"] + ":" + o.pengaturan.versi_teks + ":" + !!o.pengaturan.setuju_at')" = "pemilik:2:kram:1:true" ] || { echo "pemilik harus melihat semua: $M"; exit 1; }
echo "✓ pemilik: aktif + persetujuan tercatat, melihat semua catatan"

P="$(sebagai "$R" "select siklus_muat()")"
[ "$(jsonq "$P" 'o.peran + ":" + o.siklus.length + ":" + Object.keys(o.catatan).length + ":" + ("setuju_at" in o.pengaturan)')" = "pembaca:2:0:false" ] || { echo "pembaca: jadwal saja, tanpa catatan: $P"; exit 1; }
if echo "$P" | grep -q kram; then echo "isi catatan tidak boleh terkirim ke pembaca"; exit 1; fi
echo "✓ pembaca: jadwal terbaca, catatan TIDAK terkirim (bagikan = off)"

sebagai "$F" "select siklus_atur('{\"bagikan_catatan\":true}')" >/dev/null
[ "$(jsonq "$(sebagai "$R" "select siklus_muat()")" 'o.catatan["11111111-1111-1111-1111-111111111111"]')" = "kram" ] || { echo "bagikan on: catatan harus terbaca"; exit 1; }
sebagai "$F" "select siklus_atur('{\"bagikan_catatan\":false}')" >/dev/null
echo "✓ bagikan catatan on/off diikuti server"

if sebagai "$R" "select siklus_simpan('{\"id\":\"33333333-3333-3333-3333-333333333333\",\"mulai\":\"2026-09-01\"}')" 2>/dev/null; then echo "pembaca tidak boleh menulis"; exit 1; fi
if sebagai "$R" "select siklus_hapus('11111111-1111-1111-1111-111111111111')" 2>/dev/null; then echo "pembaca tidak boleh menghapus"; exit 1; fi
if sebagai "$R" "select siklus_atur('{\"bagikan_catatan\":true}')" 2>/dev/null; then echo "pembaca tidak boleh mengatur"; exit 1; fi
if sebagai "$F" "select siklus_simpan('{\"id\":\"44444444-4444-4444-4444-444444444444\",\"mulai\":\"2026-09-10\",\"selesai\":\"2026-09-01\"}')" 2>/dev/null; then echo "selesai sebelum mulai harus ditolak"; exit 1; fi
echo "✓ pembaca hanya baca; validasi tanggal di server"

sebagai "$F" "select siklus_simpan('{\"id\":\"11111111-1111-1111-1111-111111111111\",\"mulai\":\"2026-08-01\",\"selesai\":\"2026-08-05\",\"catatan\":\"\"}')" >/dev/null
[ "$(q "select count(*) from siklus_catatan")" = "0" ] || { echo "catatan kosong harus dihapus"; exit 1; }
sebagai "$F" "select siklus_hapus('22222222-2222-2222-2222-222222222222')" >/dev/null
[ "$(q "select count(*) from siklus")" = "1" ] || { echo "hapus satu catatan"; exit 1; }
sebagai "$F" "select siklus_hapus_semua()" >/dev/null
[ "$(q "select count(*) || ':' || (select aktif from siklus_pengaturan) || ':' || coalesce((select setuju_at::text from siklus_pengaturan), 'null') from siklus")" = "0:false:null" ] || { echo "hapus semua harus mengosongkan & menarik persetujuan"; exit 1; }
[ "$(jsonq "$(sebagai "$R" "select siklus_muat()")" 'o.siklus.length')" = "0" ] || { echo "setelah hapus semua pembaca kosong"; exit 1; }
echo "✓ hapus satu / hapus semua (persetujuan ditarik)"
echo
echo "semua tes SQL Siklus lulus"
