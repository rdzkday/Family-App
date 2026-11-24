-- Siklus: catatan haid istri (Febie) + perkiraan. Lewat Edge Function kantong yang sama dengan fitur lain.
-- Aturan siapa boleh melihat dijalankan di core.js (server):
--   * pemilik (istri) : baca + tulis semua catatannya.
--   * pasangan        : baca JADWAL hanya kalau Siklus aktif & jadwal dibagikan; catatan hanya kalau dibagikan juga.
--   * tiap user memilih sendiri Siklus ditampilkan atau tidak (siklus_atur.tampil).
-- Hapus = tombstone: tanggal & catatan dikosongkan (data kesehatan tidak tertinggal).
-- Catatan: pemilik project Supabase secara teknis bisa membuka tabel ini lewat dashboard.
-- Menggantikan rancangan lama (Supabase Auth OTP, tabel siklus_anggota/siklus_catatan/siklus_pengaturan) yang tidak pernah dipasang.
-- Hanya menambah tabel; aman dijalankan berulang.

create table if not exists siklus (
  id text primary key,
  pemilik text not null default '',
  mulai date,                                   -- kosong = catatan sudah dihapus
  akhir date,                                   -- kosong = belum dicatat selesai
  abaikan_jarak boolean not null default false, -- true = ada catatan terlewat sebelum ini; jaraknya tidak dihitung
  catatan text not null default '',
  dibuat text not null default '',
  diubah text not null default '',
  dihapus text not null default '',
  constraint siklus_urut check (akhir is null or (mulai is not null and akhir >= mulai))
);
create index if not exists siklus_pemilik_mulai_idx on siklus (pemilik, mulai);

create table if not exists siklus_atur (
  id text primary key references users (id) on delete cascade,   -- id user
  aktif boolean not null default false,
  bagikan_jadwal boolean not null default true,
  bagikan_catatan boolean not null default false,
  tampil boolean not null default true,
  setuju_at text not null default '',            -- kapan pemilik menyetujui teks privasi
  versi_teks integer not null default 0,         -- versi teks privasi yang disetujui
  diubah text not null default ''
);

alter table siklus enable row level security;
alter table siklus_atur enable row level security;
revoke all on siklus, siklus_atur from anon, authenticated;

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
    'komitmen_bab',        (select coalesce(jsonb_agg(to_jsonb(t) order by t.urutan), '[]'::jsonb) from komitmen_bab t),
    'komitmen_pasal',      (select coalesce(jsonb_agg(to_jsonb(t) order by t.nomor), '[]'::jsonb) from komitmen_pasal t),
    'komitmen_versi',      (select coalesce(jsonb_agg(to_jsonb(t) order by t.pasal_id, t.versi), '[]'::jsonb) from komitmen_versi t),
    'komitmen_keterangan', (select coalesce(jsonb_agg(to_jsonb(t) order by t.dibuat_at), '[]'::jsonb) from komitmen_keterangan t),
    'pengesahan',          (select coalesce(jsonb_agg(to_jsonb(t) order by t.dibuat_at), '[]'::jsonb) from pengesahan t),
    'evaluasi',            (select coalesce(jsonb_agg(to_jsonb(t) order by t.tanggal), '[]'::jsonb) from evaluasi t),
    'jurnal',              (select coalesce(jsonb_agg(to_jsonb(t) order by t.tanggal nulls first, t.id), '[]'::jsonb) from jurnal t),
    'siklus',              (select coalesce(jsonb_agg(to_jsonb(t) order by t.mulai nulls first, t.id), '[]'::jsonb) from siklus t),
    'siklus_atur',         (select coalesce(jsonb_agg(to_jsonb(t)), '[]'::jsonb) from siklus_atur t),
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
    if tabel is null or tabel not in ('buku', 'users', 'kategori', 'kantong', 'budget', 'transaksi', 'todo',
        'komitmen_bab', 'komitmen_pasal', 'komitmen_versi', 'komitmen_keterangan', 'pengesahan', 'evaluasi', 'jurnal',
        'siklus', 'siklus_atur') then
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
grant execute on function kantong_muat() to service_role;
grant execute on function kantong_simpan(jsonb) to service_role;

-- Rapikan (Supabase Security Advisor): fungsi trigger wajib ganti password memakai search_path tetap
-- dan tidak bisa dipanggil anon/authenticated.
do $$ begin
  if exists (select 1 from pg_proc where proname = 'kantong_admin_tandai') then
    alter function kantong_admin_tandai() set search_path = public;
    revoke all on function kantong_admin_tandai() from public, anon, authenticated;
  end if;
end $$;
