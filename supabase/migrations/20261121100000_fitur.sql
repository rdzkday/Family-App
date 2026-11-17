-- Fitur modular: admin memilih fitur mana yang aktif untuk rumah tangga ini (Kantong, Agenda, Komitmen, Daily Mood).
-- Beranda & Pengaturan selalu ada. Fitur nonaktif: hilang dari menu, halaman ditutup, dan aksinya ditolak server.
-- Daftar id fitur harus sama dengan FITUR di public/shared/core.js.

create table if not exists app_setting (
  kunci  text primary key,
  nilai  jsonb not null,
  diubah timestamptz not null default now()
);
alter table app_setting enable row level security;   -- tanpa policy: hanya service_role (Edge Function)
revoke all on app_setting from public, anon, authenticated;

insert into app_setting (kunci, nilai)
values ('fitur', '{"kantong": true, "agenda": true, "komitmen": true, "mood": true}'::jsonb)
on conflict (kunci) do nothing;

-- Dibaca Edge Function setiap request (untuk bootstrap & menolak aksi fitur nonaktif).
create or replace function kantong_fitur()
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select coalesce((select nilai from app_setting where kunci = 'fitur'), '{}'::jsonb);
$$;

-- Admin panel: p_fitur null = baca saja; objek {id: boolean} = simpan.
create or replace function kantong_admin_fitur(p_hash text, p_fitur jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  ids constant text[] := array['kantong', 'agenda', 'komitmen', 'mood'];
  baru jsonb := '{}'::jsonb;
  k text;
begin
  if not exists (select 1 from sesi s join login l on l.user_id = s.user_id where s.token_hash = p_hash and l.aktif and l.admin) then
    return jsonb_build_object('ok', false, 'code', 'AUTH', 'error', 'Bukan admin atau sesi berakhir');
  end if;
  if exists (select 1 from sesi s join login l on l.user_id = s.user_id where s.token_hash = p_hash and l.wajib_ganti) then
    return jsonb_build_object('ok', false, 'code', 'GANTI_PW', 'error', 'Buat password baru dulu');
  end if;
  update sesi set dipakai = now() where token_hash = p_hash;

  if p_fitur is not null and jsonb_typeof(p_fitur) = 'object' then
    foreach k in array ids loop
      baru := baru || jsonb_build_object(k, coalesce((p_fitur->>k)::boolean, true));
    end loop;
    insert into app_setting (kunci, nilai, diubah) values ('fitur', baru, now())
      on conflict (kunci) do update set nilai = excluded.nilai, diubah = now();
  end if;
  return jsonb_build_object('ok', true, 'fitur', kantong_fitur());
end;
$$;

revoke all on function kantong_fitur() from public, anon, authenticated;
revoke all on function kantong_admin_fitur(text, jsonb) from public, anon, authenticated;
grant execute on function kantong_fitur() to service_role;
grant execute on function kantong_admin_fitur(text, jsonb) to service_role;
