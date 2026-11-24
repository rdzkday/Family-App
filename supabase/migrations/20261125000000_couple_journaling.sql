-- Couple Journaling (sub menu "Berdua" di Daily Mood): evaluasi harian, mingguan, bulanan untuk pasangan.
-- Satu tabel generik; isi = JSON. Aturan siapa boleh melihat/mengubah dijalankan di core.js (server, aksi cj.*):
--   * isian harian    : privat sampai pemiliknya membagikan saat check-in mingguan. Item privat (kesehatan) tidak pernah dikirim ke pasangan.
--   * isian mingguan/bulanan: terlihat pasangan setelah pemiliknya menekan Selesai (tanpa item privat).
--   * mood (H7)       : privat kecuali pemilik menyalakan "bagikan mood".
--   * set pertanyaan  : draft → (persetujuan pasangan untuk item Bersama) → publish, berlaku periode berikutnya.
-- Fitur aktif hanya kalau KEDUA pasangan menyetujui (baris cj|pref|<user>).
-- Hapus = tombstone (isi dikosongkan).
-- Hanya menambah tabel; aman dijalankan berulang.

create table if not exists jurnal_pasangan (
  id text primary key,                       -- cj|atur, cj|draft, cj|set|<versi>, cj|pref|<user>, cj|target|<user>,
                                             -- cj|isi|<user>|<H|M|B>:<periode>, cj|topik|..., cj|sesi|<minggu>, cj|bulan|<YYYY-MM>
  jenis text not null default '',            -- atur | draft | set | pref | target | isian | topik | sesi | bulan
  pemilik text not null default '',          -- id user ('' = bersama)
  kunci text not null default '',            -- periode: H:YYYY-MM-DD | M:YYYY-Www | B:YYYY-MM (isian), YYYY-Www (sesi/topik), ...
  isi text not null default '',              -- JSON
  dibuat text not null default '',
  diubah text not null default '',
  dihapus text not null default ''
);
create index if not exists jurnal_pasangan_jenis_idx on jurnal_pasangan (jenis, pemilik);
alter table jurnal_pasangan enable row level security;     -- tanpa policy: hanya service_role (Edge Function)
revoke all on jurnal_pasangan from anon, authenticated;

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
    'jurnal_pasangan',     (select coalesce(jsonb_agg(to_jsonb(t) order by t.id), '[]'::jsonb) from jurnal_pasangan t),
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
        'siklus', 'siklus_atur', 'jurnal_pasangan') then
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
