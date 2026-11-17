-- User ganti password sendiri. Password dari admin (akun baru / reset) bersifat sementara: wajib diganti saat login.
alter table login add column if not exists wajib_ganti boolean not null default false;

-- Sesi -> {user_id, wajib_ganti} (null kalau tidak ada / akun nonaktif).
create or replace function kantong_sesi(p_hash text)
returns jsonb
language sql
security definer
set search_path = public
as $$
  with u as (
    update sesi s set dipakai = now() from login l
     where s.token_hash = p_hash and l.user_id = s.user_id and l.aktif
    returning s.user_id, l.wajib_ganti
  ) select jsonb_build_object('user_id', user_id, 'wajib_ganti', wajib_ganti) from u;
$$;

-- Login: kembalikan juga wajib_ganti.
create or replace function kantong_login(p_username text, p_password text)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  l login%rowtype;
  token text;
begin
  select * into l from login where username = lower(trim(coalesce(p_username, ''))) for update;
  if not found then
    perform crypt(coalesce(p_password, ''), gen_salt('bf', 10));
    return jsonb_build_object('ok', false, 'alasan', 'salah');
  end if;
  if l.kunci_sampai is not null and l.kunci_sampai > now() then
    return jsonb_build_object('ok', false, 'alasan', 'terkunci', 'sampai', l.kunci_sampai);
  end if;
  if l.pass_hash <> crypt(coalesce(p_password, ''), l.pass_hash) then
    update login set gagal = case when gagal + 1 >= 5 then 0 else gagal + 1 end,
      kunci_sampai = case when gagal + 1 >= 5 then now() + interval '15 minutes' else null end
      where user_id = l.user_id;
    return jsonb_build_object('ok', false, 'alasan', 'salah');
  end if;
  if not l.aktif then return jsonb_build_object('ok', false, 'alasan', 'nonaktif'); end if;
  update login set gagal = 0, kunci_sampai = null where user_id = l.user_id;
  token := encode(gen_random_bytes(32), 'hex');
  insert into sesi (token_hash, user_id) values (encode(digest(token, 'sha256'), 'hex'), l.user_id);
  return jsonb_build_object('ok', true, 'token', token, 'user_id', l.user_id, 'admin', l.admin, 'wajib_ganti', l.wajib_ganti);
end;
$$;

-- User ganti password sendiri: wajib tahu password lama. Sesi di perangkat lain dicabut.
create or replace function kantong_ganti_password(p_hash text, p_lama text, p_baru text)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  l login%rowtype;
begin
  select l2.* into l from sesi s join login l2 on l2.user_id = s.user_id where s.token_hash = p_hash and l2.aktif for update of l2;
  if not found then return jsonb_build_object('ok', false, 'code', 'AUTH', 'error', 'Sesi berakhir, silakan masuk lagi'); end if;
  if l.pass_hash <> crypt(coalesce(p_lama, ''), l.pass_hash) then
    return jsonb_build_object('ok', false, 'error', 'Password lama salah');
  end if;
  if coalesce(length(p_baru), 0) < 8 then return jsonb_build_object('ok', false, 'error', 'Password baru minimal 8 karakter'); end if;
  if p_baru = p_lama then return jsonb_build_object('ok', false, 'error', 'Password baru harus beda dari yang lama'); end if;
  if lower(p_baru) = l.username then return jsonb_build_object('ok', false, 'error', 'Password tidak boleh sama dengan username'); end if;
  update login set pass_hash = crypt(p_baru, gen_salt('bf', 10)), wajib_ganti = false, gagal = 0, kunci_sampai = null, diubah = now()
    where user_id = l.user_id;
  delete from sesi where user_id = l.user_id and token_hash <> p_hash;
  return jsonb_build_object('ok', true);
end;
$$;

-- Admin: password hasil generate selalu sementara (wajib_ganti), admin dengan password sementara harus ganti dulu.
create or replace function kantong_admin_tandai()
returns trigger
language plpgsql
as $$
begin
  -- dipanggil hanya saat pass_hash diubah oleh kantong_admin (lihat GUC di bawah)
  if current_setting('kantong.dari_admin', true) = '1' then new.wajib_ganti := true; end if;
  return new;
end;
$$;
drop trigger if exists login_wajib_ganti on login;
create trigger login_wajib_ganti before insert or update of pass_hash on login
  for each row execute function kantong_admin_tandai();

-- Bungkus kantong_admin: tolak admin yang masih berpassword sementara; tandai password yang dibuat admin sebagai sementara.
do $$ begin
  if not exists (select 1 from pg_proc where proname = 'kantong_admin_inti') then
    alter function kantong_admin(text, text, jsonb) rename to kantong_admin_inti;
  end if;
end $$;
create or replace function kantong_admin(p_hash text, p_aksi text, p_data jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v jsonb;
begin
  if exists (select 1 from sesi s join login l on l.user_id = s.user_id where s.token_hash = p_hash and l.admin and l.wajib_ganti) then
    return jsonb_build_object('ok', false, 'code', 'GANTI_PW', 'error', 'Buat password baru dulu');
  end if;
  perform set_config('kantong.dari_admin', '1', true);
  v := kantong_admin_inti(p_hash, p_aksi, p_data);
  perform set_config('kantong.dari_admin', '0', true);
  if p_aksi = 'list' and (v->>'ok')::boolean then
    v := jsonb_set(v, '{akun}', coalesce((select jsonb_agg(a || jsonb_build_object('wajib_ganti', coalesce(l.wajib_ganti, false)))
      from jsonb_array_elements(v->'akun') a left join login l on l.user_id = a->>'user_id'), '[]'::jsonb));
  end if;
  return v;
end;
$$;

revoke all on function kantong_sesi(text) from public, anon, authenticated;
revoke all on function kantong_ganti_password(text, text, text) from public, anon, authenticated;
revoke all on function kantong_admin_inti(text, text, jsonb) from public, anon, authenticated;
revoke all on function kantong_admin(text, text, jsonb) from public, anon, authenticated;
revoke all on function kantong_login(text, text) from public, anon, authenticated;
grant execute on function kantong_sesi(text) to service_role;
grant execute on function kantong_ganti_password(text, text, text) to service_role;
grant execute on function kantong_admin(text, text, jsonb) to service_role;
grant execute on function kantong_login(text, text) to service_role;
