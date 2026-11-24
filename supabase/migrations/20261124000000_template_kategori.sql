-- Template kategori per buku + sub-kategori + rencana budget 40:30:20:10 + manajer keuangan.
-- Aman dijalankan berulang (if not exists). Data lama tidak diubah/dihapus.
-- kantong_muat (to_jsonb) & kantong_simpan (baca information_schema) otomatis ikut kolom baru, jadi tidak perlu diubah.

-- Sub-kategori (2 level): induk = id kategori induk, '' = kategori induk.
alter table kategori add column if not exists induk text not null default '';
-- Pos budget: kebutuhan | cicilan | tabungan | sosial | '' (pemasukan / tanpa pos). Sub ikut pos induknya.
alter table kategori add column if not exists pos text not null default '';

-- Manajer keuangan: id user (hanya terisi untuk buku tipe Bersama).
alter table buku add column if not exists manajer text not null default '';
-- Rencana budget per buku disimpan langsung di tabel buku (paling sederhana: 1 rencana per buku,
-- tidak perlu tabel & RPC baru). Budget per bulan tetap di tabel budget.
alter table buku add column if not exists penghasilan bigint not null default 0;
alter table buku add column if not exists rasio text not null default '40,30,20,10';
alter table buku add column if not exists rencana_diubah text not null default '';   -- stempel ISO '+07:00' seperti kolom waktu lain

-- Anti dobel nama dalam satu buku + induk yang sama (huruf kecil, trim, spasi ganda jadi satu).
-- Hanya baris aktif dan hanya kategori 1 buku (kategori lama/sistem multi-buku seperti setoran-rt dilewati).
-- Kalau data lama sudah dobel: migrasi BERHENTI dengan pesan daftar nama dobel (bukan gagal diam-diam).
do $$
declare
  dobel text;
begin
  select string_agg(format('%s / %s (%s baris)', buku, nama_kunci, n), '; ')
    into dobel
    from (
      select buku, lower(regexp_replace(trim(nama), '\s+', ' ', 'g')) as nama_kunci, count(*) as n
        from kategori
       where aktif and position(',' in buku) = 0
       group by buku, induk, lower(regexp_replace(trim(nama), '\s+', ' ', 'g'))
      having count(*) > 1
    ) d;
  if dobel is not null then
    raise exception 'Kategori dobel, rapikan dulu (nonaktifkan/ganti nama) lalu jalankan ulang: %', dobel;
  end if;
end $$;

create unique index if not exists kategori_nama_unik
  on kategori (buku, induk, lower(regexp_replace(trim(nama), '\s+', ' ', 'g')))
  where aktif and position(',' in buku) = 0;

-- Panel Admin: lihat / ganti manajer keuangan buku Bersama.
-- p_buku null = baca saja. p_user '' = kosongkan (onboarding muncul lagi).
create or replace function kantong_admin_manajer(p_hash text, p_buku text, p_user text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (select 1 from sesi s join login l on l.user_id = s.user_id where s.token_hash = p_hash and l.aktif and l.admin) then
    return jsonb_build_object('ok', false, 'code', 'AUTH', 'error', 'Bukan admin atau sesi berakhir');
  end if;
  if exists (select 1 from sesi s join login l on l.user_id = s.user_id where s.token_hash = p_hash and l.wajib_ganti) then
    return jsonb_build_object('ok', false, 'code', 'GANTI_PW', 'error', 'Buat password baru dulu');
  end if;
  update sesi set dipakai = now() where token_hash = p_hash;

  if p_buku is not null then
    if not exists (select 1 from buku where id = p_buku and tipe = 'Bersama') then
      return jsonb_build_object('ok', false, 'error', 'Buku bersama tidak ditemukan');
    end if;
    if coalesce(p_user, '') <> '' and not exists (select 1 from users where id = p_user) then
      return jsonb_build_object('ok', false, 'error', 'User tidak ditemukan');
    end if;
    update buku set manajer = coalesce(p_user, '') where id = p_buku;
  end if;
  return jsonb_build_object('ok', true,
    'buku', (select coalesce(jsonb_agg(jsonb_build_object('id', b.id, 'nama', b.nama, 'manajer', b.manajer) order by b.urutan), '[]'::jsonb)
               from buku b where b.tipe = 'Bersama'),
    'users', (select coalesce(jsonb_agg(jsonb_build_object('id', u.id, 'nama', u.nama) order by u.id), '[]'::jsonb) from users u));
end;
$$;

revoke all on function kantong_admin_manajer(text, text, text) from public, anon, authenticated;
grant execute on function kantong_admin_manajer(text, text, text) to service_role;
