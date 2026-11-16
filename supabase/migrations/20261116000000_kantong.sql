-- Kantong: skema Supabase (Postgres). Nama tabel & kolom = KantongCore.SCHEMA di public/core.js (huruf kecil).
-- Semua tabel memakai RLS tanpa policy: hanya service role (Edge Function) yang bisa membaca/menulis.
-- Tanggal disimpan sebagai date, stempel waktu (dibuat/diubah/dihapus) sebagai text ISO '+07:00' persis seperti dari app.

create table if not exists buku (
  id text primary key,
  nama text not null default '',
  tipe text not null default 'Pribadi',          -- Pribadi | Bersama
  pemilik text not null default '',              -- id user pemilik (kosong untuk Bersama)
  urutan integer not null default 0
);

create table if not exists users (
  id text primary key,
  nama text not null default '',
  buku text not null default ''                  -- id buku pribadi
);

create table if not exists kategori (
  id text primary key,
  nama text not null default '',
  tipe text not null default 'Pengeluaran',      -- Pengeluaran | Pemasukan
  buku text not null default '',                 -- daftar id buku dipisah koma
  warna text not null default '#7C9CFF',
  hitung boolean not null default true,
  aktif boolean not null default true,
  urutan integer not null default 0
);

create table if not exists kantong (
  id text primary key,
  nama text not null default '',
  jenis text not null default 'Debit',           -- Cash | Debit | E-wallet | Kredit
  buku text not null default '',
  saldo_awal bigint not null default 0,
  per_tanggal date,
  "limit" bigint not null default 0,
  aktif boolean not null default true,
  urutan integer not null default 0
);

create table if not exists budget (
  id text primary key,                           -- 'YYYY-MM|buku|kategori'
  bulan text not null default '',
  buku text not null default '',
  kategori text not null default '',
  nominal bigint not null default 0
);

create table if not exists transaksi (
  id text primary key,
  tanggal date,
  tipe text not null default '',
  nominal bigint not null default 0,
  buku text not null default '',
  kategori text not null default '',
  kantong text not null default '',
  kantong_tujuan text not null default '',
  keterangan text not null default '',
  reimburse boolean not null default false,
  oleh text not null default '',
  sumber text not null default '',
  dibuat text not null default '',
  diubah text not null default '',
  dihapus text not null default '',
  terbayar text not null default '',
  tx_balik text not null default ''
);
create index if not exists transaksi_tanggal_idx on transaksi (tanggal);

create table if not exists todo (
  id text primary key,
  judul text not null default '',
  pemilik text not null default '',              -- id user atau 'bersama'
  tanggal date,
  jam text not null default '',                  -- 'HH:MM' atau kosong (seharian)
  durasi integer not null default 30,
  selesai boolean not null default false,
  selesai_oleh text not null default '',
  gcal_event_id text not null default '',
  gcal_status text not null default '',          -- '' | ok | gagal
  gcal_error text not null default '',
  oleh text not null default '',
  dibuat text not null default '',
  diubah text not null default '',
  dihapus text not null default ''
);

-- Kode akses per user. Hanya hash yang disimpan; kode aslinya cuma muncul sekali saat dibuat.
create table if not exists akses (
  user_id text primary key references users (id) on delete cascade,
  token_hash text not null,
  dibuat timestamptz not null default now()
);

alter table buku enable row level security;
alter table users enable row level security;
alter table kategori enable row level security;
alter table kantong enable row level security;
alter table budget enable row level security;
alter table transaksi enable row level security;
alter table todo enable row level security;
alter table akses enable row level security;

-- Data awal (aman dijalankan berulang). Ganti nama 'Istri' lewat Table Editor kalau perlu; id jangan diubah.
insert into buku (id, nama, tipe, pemilik, urutan) values
  ('riki', 'Riki', 'Pribadi', 'riki', 1), ('istri', 'Istri', 'Pribadi', 'istri', 2), ('rt', 'Rumah Tangga', 'Bersama', '', 3)
  on conflict (id) do nothing;
insert into users (id, nama, buku) values ('riki', 'Riki', 'riki'), ('istri', 'Istri', 'istri')
  on conflict (id) do nothing;

-- ---------- RPC untuk Edge Function (service role) ----------

-- Satu panggilan memuat semua tabel sekaligus: satu snapshot yang konsisten.
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
    'akses',     (select coalesce(jsonb_agg(jsonb_build_object('user_id', t.user_id, 'token_hash', t.token_hash)), '[]'::jsonb) from akses t)
  );
$$;

-- Simpan banyak baris dari beberapa tabel dalam SATU transaksi (upsert by id), diserialkan dengan advisory lock.
-- rows: [{"tabel":"transaksi","baris":{...}}, ...]
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
    if tabel is null or tabel not in ('buku', 'users', 'kategori', 'kantong', 'budget', 'transaksi', 'todo') then
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

-- Buat/ganti kode akses user lalu kembalikan KODE KONEKSI siap tempel ke app.
-- Jalankan di SQL Editor:  select kantong_buat_kode('riki', 'https://xxxx.supabase.co/functions/v1/kantong');
-- Kode lama user itu langsung tidak berlaku (berguna kalau HP hilang).
create or replace function kantong_buat_kode(p_user text, p_api text)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  token text;
  kode text;
begin
  if not exists (select 1 from users where id = p_user) then
    raise exception 'user % tidak ada di tabel users', p_user;
  end if;
  if p_api !~ '^https://' then
    raise exception 'URL API harus diawali https://';
  end if;
  token := replace(gen_random_uuid()::text, '-', '') || substr(replace(gen_random_uuid()::text, '-', ''), 1, 8);
  insert into akses (user_id, token_hash) values (p_user, encode(sha256(convert_to(token, 'UTF8')), 'hex'))
    on conflict (user_id) do update set token_hash = excluded.token_hash, dibuat = now();
  kode := encode(convert_to(json_build_object('api', p_api, 'token', token)::text, 'UTF8'), 'base64');
  kode := translate(replace(kode, E'\n', ''), '+/', '-_');
  return rtrim(kode, '=');
end;
$$;

-- Hanya service role (Edge Function) dan pemilik project (SQL Editor) yang boleh memanggil fungsi-fungsi ini.
revoke all on function kantong_muat() from public, anon, authenticated;
revoke all on function kantong_simpan(jsonb) from public, anon, authenticated;
revoke all on function kantong_buat_kode(text, text) from public, anon, authenticated;
grant execute on function kantong_muat() to service_role;
grant execute on function kantong_simpan(jsonb) to service_role;
