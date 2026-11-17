-- Komitmen (claude/komitmen-brief.md §10 + §17): 6 tabel, nama = KantongCore.SCHEMA huruf kecil + garis bawah.
-- Sama seperti tabel Kantong: RLS tanpa policy, hanya Edge Function (service role) yang bisa membaca/menulis.
-- Stempel waktu (dibuat_at, berlaku_sejak, ttd_*_at, ...) disimpan sebagai text ISO '+07:00' persis dari core.
-- Isi asli kesepakatan/perjanjian pranikah TIDAK pernah ditaruh di file ini atau di repo.

create table if not exists komitmen_bab (
  id text primary key,
  nomor text not null default '',                 -- I, II, III, ...
  judul text not null default '',
  urutan integer not null default 0,
  dibuat_at text not null default '',
  dihapus text not null default ''
);

create table if not exists komitmen_pasal (
  id text primary key,
  nomor integer not null default 0,                -- nomor global, tetap selamanya, tidak dipakai ulang
  bab_id text not null default '',
  tipe text not null default 'kesepakatan' check (tipe in ('kesepakatan', 'definisi')),
  judul text not null default '',
  kata_kunci text not null default '',             -- dipisah koma
  sumber_asal text not null default 'app' check (sumber_asal in ('app', 'pranikah')),
  rujukan_asli text not null default '',           -- mis. 'Pasal 3 Perjanjian Pranikah'
  terkunci boolean not null default false,         -- TRUE untuk pasal pranikah: hanya bisa diberi keterangan
  status text not null default 'usulan' check (status in ('usulan', 'berlaku', 'dicabut')),
  versi_berlaku_id text not null default '',
  dibuat_oleh text not null default '',
  dibuat_at text not null default '',
  diubah_at text not null default '',
  dihapus text not null default ''
);
-- nomor unik (0 = belum diberi nomor)
create unique index if not exists komitmen_pasal_nomor_uq on komitmen_pasal (nomor) where nomor > 0;

create table if not exists komitmen_versi (
  id text primary key,
  pasal_id text not null default '',
  versi integer not null default 1,
  isi_ayat text not null default '[]',             -- JSON array teks ayat
  alasan text not null default '',
  jenis text not null default 'baru' check (jenis in ('baru', 'ubah', 'cabut')),
  sumber text not null default '',                 -- pranikah | evaluasi | luar_evaluasi
  evaluasi_id text not null default '',
  pengesahan_id text not null default '',
  status text not null default 'usulan' check (status in ('usulan', 'berlaku', 'ditunda', 'digantikan')),
  berlaku_sejak text not null default '',          -- waktu TTD kedua
  dibuat_oleh text not null default '',
  dibuat_at text not null default ''
);
create index if not exists komitmen_versi_pasal_idx on komitmen_versi (pasal_id);

create table if not exists komitmen_keterangan (
  id text primary key,
  pasal_id text not null default '',
  isi text not null default '',
  menggantikan_id text not null default '',
  jenis text not null default 'baru' check (jenis in ('baru', 'ganti', 'cabut')),
  evaluasi_id text not null default '',
  pengesahan_id text not null default '',
  status text not null default 'usulan' check (status in ('usulan', 'berlaku', 'ditunda', 'digantikan', 'dicabut')),
  berlaku_sejak text not null default '',
  dibuat_oleh text not null default '',
  dibuat_at text not null default ''
);
create index if not exists komitmen_keterangan_pasal_idx on komitmen_keterangan (pasal_id);

create table if not exists pengesahan (
  id text primary key,
  judul text not null default '',
  jenis text not null default 'tunggal' check (jenis in ('pranikah', 'evaluasi', 'tunggal')),
  evaluasi_id text not null default '',
  ttd_riki text not null default '',               -- path SVG
  ttd_riki_at text not null default '',
  ttd_febie text not null default '',              -- path SVG (user 'istri')
  ttd_febie_at text not null default '',
  isi_hash text not null default '',               -- "sidik jari" isi lembar; beda = TTD batal
  status text not null default 'menunggu' check (status in ('menunggu', 'sah', 'batal')),
  dibuat_at text not null default ''
);

create table if not exists evaluasi (
  id text primary key,
  tanggal date,
  catatan text not null default '',
  dibuat_oleh text not null default '',
  selesai_at text not null default ''
);

alter table komitmen_bab enable row level security;
alter table komitmen_pasal enable row level security;
alter table komitmen_versi enable row level security;
alter table komitmen_keterangan enable row level security;
alter table pengesahan enable row level security;
alter table evaluasi enable row level security;

-- ---------- RPC: tambah tabel Komitmen ke snapshot & daftar tabel yang boleh ditulis ----------

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
        'komitmen_bab', 'komitmen_pasal', 'komitmen_versi', 'komitmen_keterangan', 'pengesahan', 'evaluasi') then
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
