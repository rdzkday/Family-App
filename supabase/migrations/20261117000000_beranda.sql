-- Beranda: catatan & agenda evaluasi di tabel todo, kesepakatan (komitmen), jurnal Ruang Catat.
-- Hanya menambah kolom/tabel (data lama aman). Boleh dijalankan berulang.
-- Kolom baru di todo sengaja boleh null: Edge Function versi lama (belum tahu kolom ini) tetap bisa menyimpan.

alter table todo add column if not exists tipe text default 'todo';   -- todo | catatan | evaluasi (null/kosong = todo)
alter table todo add column if not exists isi text default '';

create table if not exists komitmen (
  id text primary key,
  judul text not null default '',
  isi text not null default '',
  berlaku_sejak date,
  diganti_oleh text not null default '',          -- id kesepakatan pengganti; kosong = masih berlaku
  oleh text not null default '',
  dibuat text not null default '',
  diubah text not null default '',
  dihapus text not null default ''
);

-- Ruang Catat. Pribadi: Edge Function hanya mengembalikan baris milik user yang login.
create table if not exists jurnal (
  id text primary key,
  pemilik text not null default '',
  tanggal date,
  mood text not null default '',                  -- berat | lelah | biasa | baik | senang | kosong
  isi text not null default '',
  dibuat text not null default '',
  diubah text not null default '',
  dihapus text not null default ''
);

alter table komitmen enable row level security;
alter table jurnal enable row level security;

create or replace function kantong_muat()
returns jsonb
language sql
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'buku',      (select coalesce(jsonb_agg(to_jsonb(t) order by t.urutan), '[]'::jsonb) from buku t),
    'users',     (select coalesce(jsonb_agg(to_jsonb(t)), '[]'::jsonb) from users t),
    'kategori',  (select coalesce(jsonb_agg(to_jsonb(t) order by t.urutan), '[]'::jsonb) from kategori t),
    'kantong',   (select coalesce(jsonb_agg(to_jsonb(t) order by t.urutan), '[]'::jsonb) from kantong t),
    'budget',    (select coalesce(jsonb_agg(to_jsonb(t)), '[]'::jsonb) from budget t),
    'transaksi', (select coalesce(jsonb_agg(to_jsonb(t) order by t.tanggal, t.dibuat), '[]'::jsonb) from transaksi t),
    'todo',      (select coalesce(jsonb_agg(to_jsonb(t) order by t.dibuat), '[]'::jsonb) from todo t),
    'komitmen',  (select coalesce(jsonb_agg(to_jsonb(t) order by t.dibuat), '[]'::jsonb) from komitmen t),
    'jurnal',    (select coalesce(jsonb_agg(to_jsonb(t) order by t.tanggal, t.dibuat), '[]'::jsonb) from jurnal t),
    'akses',     (select coalesce(jsonb_agg(jsonb_build_object('user_id', t.user_id, 'token_hash', t.token_hash)), '[]'::jsonb) from akses t)
  );
$$;

create or replace function kantong_simpan(rows jsonb)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  r jsonb;
  tabel text;
  cols text;
  n integer := 0;
begin
  perform pg_advisory_xact_lock(734001);
  for r in select * from jsonb_array_elements(coalesce(rows, '[]'::jsonb)) loop
    tabel := r->>'tabel';
    if tabel is null or tabel not in ('buku', 'users', 'kategori', 'kantong', 'budget', 'transaksi', 'todo', 'komitmen', 'jurnal') then
      raise exception 'tabel tidak dikenal: %', coalesce(tabel, '(kosong)');
    end if;
    if coalesce(r->'baris'->>'id', '') = '' then
      raise exception 'baris tanpa id untuk tabel %', tabel;
    end if;
    select string_agg(format('%I = excluded.%I', column_name, column_name), ', ')
      into cols
      from information_schema.columns
     where table_schema = 'public' and table_name = tabel and column_name <> 'id';
    execute format(
      'insert into %I select * from jsonb_populate_record(null::%I, $1) on conflict (id) do update set %s',
      tabel, tabel, cols) using r->'baris';
    n := n + 1;
  end loop;
  return n;
end;
$$;

revoke all on function kantong_muat() from public, anon, authenticated;
revoke all on function kantong_simpan(jsonb) from public, anon, authenticated;
