-- Siklus: modul terpisah di project Supabase yang sama dengan Kantong.
-- Tidak lewat Edge Function Kantong; app memanggil fungsi siklus_* langsung dengan login Supabase Auth (OTP).
-- Catatan: pemilik project (Riki) secara teknis bisa membuka tabel ini lewat dashboard.
--
-- Aturan (dijalankan di server, bukan cuma di tampilan):
--  * pemilik (Febie): baca + tulis semua catatannya.
--  * pembaca (Riki) : baca JADWAL (tanggal mulai/selesai) setelah Febie mengaktifkan Siklus.
--                     Catatan hanya terkirim kalau Febie menyalakan "Bagikan catatan".
--  * selain anggota : tidak mendapat apa pun.
-- Semua tabel memakai RLS tanpa policy: akses hanya lewat fungsi di bawah (security definer + cek auth.uid()).
-- Aman dijalankan berulang.

create table if not exists siklus_anggota (
  user_id uuid primary key references auth.users (id) on delete cascade,
  peran text not null check (peran in ('pemilik', 'pembaca')),
  dibuat timestamptz not null default now()
);
create unique index if not exists siklus_satu_pemilik on siklus_anggota (peran) where peran = 'pemilik';

create table if not exists siklus (
  id uuid primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  mulai date not null,
  selesai date,                                  -- kosong = belum dicatat selesai
  abaikan_jarak boolean not null default false,  -- true = ada catatan terlewat sebelum ini; jaraknya tidak dihitung
  dibuat timestamptz not null default now(),
  diubah timestamptz not null default now(),
  constraint siklus_urut check (selesai is null or selesai >= mulai)
);
create index if not exists siklus_user_mulai_idx on siklus (user_id, mulai);

create table if not exists siklus_catatan (
  siklus_id uuid primary key references siklus (id) on delete cascade,
  catatan text not null default ''
);

create table if not exists siklus_pengaturan (
  user_id uuid primary key references auth.users (id) on delete cascade,
  aktif boolean not null default false,
  bagikan_catatan boolean not null default false,
  setuju_at timestamptz,                         -- kapan Febie menyetujui teks privasi
  versi_teks integer not null default 0,         -- versi teks privasi yang disetujui
  diubah timestamptz not null default now()
);

alter table siklus_anggota enable row level security;
alter table siklus enable row level security;
alter table siklus_catatan enable row level security;
alter table siklus_pengaturan enable row level security;
revoke all on siklus_anggota, siklus, siklus_catatan, siklus_pengaturan from anon, authenticated;

-- ---------- bantuan ----------
create or replace function siklus_peran_()
returns text language sql stable security definer set search_path = public as $$
  select peran from siklus_anggota where user_id = auth.uid();
$$;
create or replace function siklus_pemilik_()
returns uuid language sql stable security definer set search_path = public as $$
  select user_id from siklus_anggota where peran = 'pemilik';
$$;

-- ---------- baca: semua yang BOLEH dilihat pemanggil ----------
create or replace function siklus_muat()
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  v_peran text := siklus_peran_();
  v_pem uuid := siklus_pemilik_();
  v_aktif boolean := false;
  v_bagikan boolean := false;
  v_setuju timestamptz;
  v_versi integer := 0;
begin
  if v_peran is null or v_pem is null then
    return jsonb_build_object('peran', v_peran, 'pengaturan', jsonb_build_object('aktif', false), 'siklus', '[]'::jsonb, 'catatan', '{}'::jsonb);
  end if;
  select p.aktif, p.bagikan_catatan, p.setuju_at, p.versi_teks into v_aktif, v_bagikan, v_setuju, v_versi
    from siklus_pengaturan p where p.user_id = v_pem;
  v_aktif := coalesce(v_aktif, false); v_bagikan := coalesce(v_bagikan, false); v_versi := coalesce(v_versi, 0);

  if v_peran = 'pembaca' and not v_aktif then
    return jsonb_build_object('peran', v_peran, 'pengaturan', jsonb_build_object('aktif', false), 'siklus', '[]'::jsonb, 'catatan', '{}'::jsonb);
  end if;

  return jsonb_build_object(
    'peran', v_peran,
    'pengaturan', case when v_peran = 'pemilik'
      then jsonb_build_object('aktif', v_aktif, 'bagikan_catatan', v_bagikan, 'setuju_at', v_setuju, 'versi_teks', v_versi)
      else jsonb_build_object('aktif', v_aktif, 'bagikan_catatan', v_bagikan) end,
    'siklus', (select coalesce(jsonb_agg(jsonb_build_object('id', s.id, 'mulai', s.mulai, 'selesai', s.selesai,
                 'abaikan_jarak', s.abaikan_jarak, 'diubah', s.diubah) order by s.mulai), '[]'::jsonb)
               from siklus s where s.user_id = v_pem),
    'catatan', case when v_peran = 'pemilik' or v_bagikan
      then (select coalesce(jsonb_object_agg(c.siklus_id, c.catatan), '{}'::jsonb)
              from siklus_catatan c join siklus s on s.id = c.siklus_id
             where s.user_id = v_pem and c.catatan <> '')
      else '{}'::jsonb end
  );
end;
$$;

-- ---------- tulis: hanya pemilik ----------
-- p: {id (uuid dari app), mulai, selesai?, abaikan_jarak?, catatan?}
create or replace function siklus_simpan(p jsonb)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  v_id uuid := (p->>'id')::uuid;
  v_mulai date := (p->>'mulai')::date;
  v_selesai date := nullif(p->>'selesai', '')::date;
begin
  if siklus_peran_() is distinct from 'pemilik' then raise exception 'Hanya pemilik yang bisa mencatat siklus'; end if;
  if v_id is null or v_mulai is null then raise exception 'Tanggal mulai wajib diisi'; end if;
  if v_selesai is not null and (v_selesai < v_mulai or v_selesai - v_mulai > 15) then
    raise exception 'Tanggal selesai harus 0–15 hari setelah tanggal mulai';
  end if;
  if exists (select 1 from siklus where id = v_id and user_id <> v_uid) then raise exception 'Catatan tidak ditemukan'; end if;
  insert into siklus (id, user_id, mulai, selesai, abaikan_jarak)
    values (v_id, v_uid, v_mulai, v_selesai, coalesce((p->>'abaikan_jarak')::boolean, false))
    on conflict (id) do update set mulai = excluded.mulai, selesai = excluded.selesai,
      abaikan_jarak = excluded.abaikan_jarak, diubah = now();
  if p ? 'catatan' then
    if coalesce(btrim(p->>'catatan'), '') = '' then
      delete from siklus_catatan where siklus_id = v_id;
    else
      insert into siklus_catatan (siklus_id, catatan) values (v_id, left(p->>'catatan', 300))
        on conflict (siklus_id) do update set catatan = excluded.catatan;
    end if;
  end if;
  return siklus_muat();
end;
$$;

create or replace function siklus_hapus(p_id uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
begin
  if siklus_peran_() is distinct from 'pemilik' then raise exception 'Hanya pemilik yang bisa menghapus'; end if;
  delete from siklus where id = p_id and user_id = auth.uid();   -- catatan ikut terhapus (cascade)
  return siklus_muat();
end;
$$;

-- p: {aktif?, bagikan_catatan?, setuju?: true, versi_teks?}
create or replace function siklus_atur(p jsonb)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_uid uuid := auth.uid();
begin
  if siklus_peran_() is distinct from 'pemilik' then raise exception 'Hanya pemilik yang bisa mengatur Siklus'; end if;
  insert into siklus_pengaturan (user_id) values (v_uid) on conflict (user_id) do nothing;
  update siklus_pengaturan set
    aktif = case when p ? 'aktif' then (p->>'aktif')::boolean else aktif end,
    bagikan_catatan = case when p ? 'bagikan_catatan' then (p->>'bagikan_catatan')::boolean else bagikan_catatan end,
    setuju_at = case when coalesce((p->>'setuju')::boolean, false) then now() else setuju_at end,
    versi_teks = case when coalesce((p->>'setuju')::boolean, false) then coalesce((p->>'versi_teks')::integer, versi_teks) else versi_teks end,
    diubah = now()
  where user_id = v_uid;
  return siklus_muat();
end;
$$;

-- Tarik persetujuan: hapus semua catatan + matikan Siklus.
create or replace function siklus_hapus_semua()
returns jsonb language plpgsql security definer set search_path = public as $$
begin
  if siklus_peran_() is distinct from 'pemilik' then raise exception 'Hanya pemilik yang bisa menghapus'; end if;
  delete from siklus where user_id = auth.uid();
  update siklus_pengaturan set aktif = false, bagikan_catatan = false, setuju_at = null, versi_teks = 0, diubah = now()
   where user_id = auth.uid();
  return siklus_muat();
end;
$$;

-- Ping harian (Apps Script) supaya project gratis tidak di-pause. Tidak membaca data apa pun.
create or replace function siklus_ping()
returns text language sql stable as $$ select 'ok'::text; $$;

-- Daftarkan anggota. Jalankan di SQL Editor SETELAH user dibuat di Authentication > Users:
--   select siklus_atur_anggota('email-febie@contoh.com', 'pemilik');
--   select siklus_atur_anggota('email-riki@contoh.com', 'pembaca');
create or replace function siklus_atur_anggota(p_email text, p_peran text)
returns text language plpgsql security definer set search_path = public as $$
declare v_id uuid;
begin
  select id into v_id from auth.users where lower(email) = lower(btrim(p_email));
  if v_id is null then raise exception 'User % belum ada. Tambahkan dulu di Authentication > Users.', p_email; end if;
  if p_peran not in ('pemilik', 'pembaca') then raise exception 'Peran harus pemilik atau pembaca'; end if;
  insert into siklus_anggota (user_id, peran) values (v_id, p_peran)
    on conflict (user_id) do update set peran = excluded.peran;
  return p_email || ' = ' || p_peran;
end;
$$;

revoke all on function siklus_peran_(), siklus_pemilik_(), siklus_muat(), siklus_simpan(jsonb), siklus_hapus(uuid),
  siklus_atur(jsonb), siklus_hapus_semua(), siklus_ping(), siklus_atur_anggota(text, text) from public, anon, authenticated;
grant execute on function siklus_muat(), siklus_simpan(jsonb), siklus_hapus(uuid), siklus_atur(jsonb), siklus_hapus_semua() to authenticated;
grant execute on function siklus_ping() to anon, authenticated;
