-- Agenda + Momen + ID Febie. Aman dijalankan berulang.
--  1. todo.selesai_at  : kapan to-do dicentang selesai (untuk riwayat di kalender Agenda)
--  2. tabel momen      : tanggal penting (satu hari atau rentang), opsional event tahunan di "Rumah Kita"
--  3. id user 'istri' -> 'febie' (id buku 'istri' tetap). Kode koneksi Febie tetap berlaku.

-- boleh null: Edge Function versi lama (belum tahu kolom ini) tetap bisa menyimpan to-do selama masa transisi
alter table todo add column if not exists selesai_at text default '';

create table if not exists momen (
  id text primary key,
  judul text not null default '',
  cerita text not null default '',
  tanggal date,
  tanggal_selesai date,                          -- null = satu hari
  kategori text not null default 'kita',         -- kita | keluarga | pekerjaan | lainnya
  pemilik text not null default 'bersama',       -- id user atau 'bersama'
  tahunan boolean not null default false,        -- true = event tahunan di Google Calendar
  gcal_event_id text not null default '',
  gcal_status text not null default '',
  gcal_error text not null default '',
  oleh text not null default '',
  dibuat text not null default '',
  diubah text not null default '',
  dihapus text not null default ''
);
create index if not exists momen_tanggal_idx on momen (tanggal);
alter table momen enable row level security;

-- ---------- ganti id user istri -> febie ----------
-- akses.user_id merujuk users.id: ubah FK supaya ikut berganti (on update cascade).
alter table akses drop constraint if exists akses_user_id_fkey;
alter table akses add constraint akses_user_id_fkey
  foreign key (user_id) references users (id) on delete cascade on update cascade;

do $$
begin
  if exists (select 1 from users where id = 'istri') and not exists (select 1 from users where id = 'febie') then
    update users set id = 'febie', nama = case when nama in ('', 'Istri') then 'Febie' else nama end where id = 'istri';
    update buku set pemilik = 'febie' where pemilik = 'istri';
    update transaksi set oleh = 'febie' where oleh = 'istri';
    update todo set pemilik = 'febie' where pemilik = 'istri';
    update todo set oleh = 'febie' where oleh = 'istri';
    update todo set selesai_oleh = 'febie' where selesai_oleh = 'istri';
    update momen set pemilik = 'febie' where pemilik = 'istri';
    update momen set oleh = 'febie' where oleh = 'istri';
  end if;
end $$;
update buku set nama = 'Febie' where id = 'istri' and nama = 'Istri';

-- ---------- RPC: ikut memuat & menyimpan momen ----------
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
    'momen',     (select coalesce(jsonb_agg(to_jsonb(t) order by t.tanggal, t.dibuat), '[]'::jsonb) from momen t),
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
    if tabel is null or tabel not in ('buku', 'users', 'kategori', 'kantong', 'budget', 'transaksi', 'todo', 'momen') then
      raise exception 'tabel tidak dikenal: %', coalesce(tabel, '(kosong)');
    end if;
    if coalesce(r->'baris'->>'id', '') = '' then
      raise exception 'baris tanpa id untuk tabel %', tabel;
    end if;
    select string_agg(format('%I = excluded.%I', column_name, column_name), ', ')
      into cols
      from information_schema.columns
     where table_schema = 'public' and table_name = tabel and column_name <> 'id';
    -- kolom diisi berdasarkan nama (bukan urutan), jadi kolom baru di akhir tabel tetap aman
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
grant execute on function kantong_muat() to service_role;
grant execute on function kantong_simpan(jsonb) to service_role;
