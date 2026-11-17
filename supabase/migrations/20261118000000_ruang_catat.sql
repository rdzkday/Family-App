-- Ruang Catat pindah dari localStorage ke Supabase.
-- Satu baris per hari (jenis 'entri', isi = JSON catatan hari itu) + satu baris 'pengaturan' per orang
-- (profil, prompt sendiri). PRIBADI: Edge Function hanya mengembalikan baris milik user yang login.
-- Hanya menambah tabel; boleh dijalankan berulang.

create table if not exists jurnal (
  id text primary key,                         -- '<user>|YYYY-MM-DD' atau '<user>|_pengaturan'
  pemilik text not null default '',
  jenis text not null default 'entri',         -- entri | pengaturan
  tanggal date,                                -- kosong untuk pengaturan
  isi text not null default '',                -- JSON dari app Ruang Catat
  diubah text not null default '',
  dihapus text not null default ''
);
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
    'komitmen_bab',        (select coalesce(jsonb_agg(to_jsonb(t) order by t.urutan), '[]'::jsonb) from komitmen_bab t),
    'komitmen_pasal',      (select coalesce(jsonb_agg(to_jsonb(t) order by t.nomor), '[]'::jsonb) from komitmen_pasal t),
    'komitmen_versi',      (select coalesce(jsonb_agg(to_jsonb(t) order by t.pasal_id, t.versi), '[]'::jsonb) from komitmen_versi t),
    'komitmen_keterangan', (select coalesce(jsonb_agg(to_jsonb(t) order by t.dibuat_at), '[]'::jsonb) from komitmen_keterangan t),
    'pengesahan',          (select coalesce(jsonb_agg(to_jsonb(t) order by t.dibuat_at), '[]'::jsonb) from pengesahan t),
    'evaluasi',            (select coalesce(jsonb_agg(to_jsonb(t) order by t.tanggal), '[]'::jsonb) from evaluasi t),
    'jurnal',              (select coalesce(jsonb_agg(to_jsonb(t) order by t.tanggal nulls first, t.id), '[]'::jsonb) from jurnal t),
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
        'komitmen_bab', 'komitmen_pasal', 'komitmen_versi', 'komitmen_keterangan', 'pengesahan', 'evaluasi', 'jurnal') then
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
