-- Login username + password, menggantikan kode koneksi.
-- Password di-hash bcrypt (pgcrypto). Tiap login membuat SESI baru (satu per perangkat); hanya hash token yang disimpan.
create extension if not exists pgcrypto with schema extensions;

create table if not exists login (
  user_id text primary key references users (id) on delete cascade,
  username text not null unique,
  pass_hash text not null,
  gagal integer not null default 0,
  kunci_sampai timestamptz,
  diubah timestamptz not null default now()
);

create table if not exists sesi (
  token_hash text primary key,
  user_id text not null references users (id) on delete cascade,
  dibuat timestamptz not null default now(),
  dipakai timestamptz not null default now()
);
create index if not exists sesi_user_idx on sesi (user_id);

alter table login enable row level security;
alter table sesi enable row level security;

-- Admin (SQL Editor): buat/ganti username & password. Semua sesi user itu ikut dicabut.
--   select kantong_atur_login('riki', 'riki', 'password-rahasia');
create or replace function kantong_atur_login(p_user text, p_username text, p_password text)
returns text
language plpgsql
security definer
set search_path = public, extensions
as $$
begin
  if not exists (select 1 from users where id = p_user) then raise exception 'user % tidak ada', p_user; end if;
  if coalesce(length(p_password), 0) < 8 then raise exception 'password minimal 8 karakter'; end if;
  if lower(trim(p_username)) !~ '^[a-z0-9._-]{3,32}$' then raise exception 'username 3-32 huruf kecil/angka/._-'; end if;
  insert into login (user_id, username, pass_hash) values (p_user, lower(trim(p_username)), crypt(p_password, gen_salt('bf', 10)))
    on conflict (user_id) do update set username = excluded.username, pass_hash = excluded.pass_hash, gagal = 0, kunci_sampai = null, diubah = now();
  delete from sesi where user_id = p_user;
  return 'ok: login ' || lower(trim(p_username)) || ' untuk ' || p_user;
end;
$$;

-- Edge Function: cek password. Berhasil -> token baru (kembali sekali). Gagal -> null. 5x salah = kunci 15 menit.
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
    perform crypt(coalesce(p_password, ''), gen_salt('bf', 10));   -- samakan waktu respon
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
  update login set gagal = 0, kunci_sampai = null where user_id = l.user_id;
  token := encode(gen_random_bytes(32), 'hex');
  insert into sesi (token_hash, user_id) values (encode(digest(token, 'sha256'), 'hex'), l.user_id);
  return jsonb_build_object('ok', true, 'token', token, 'user_id', l.user_id);
end;
$$;

-- Edge Function: token hash -> user_id (null kalau tidak ada sesi).
create or replace function kantong_cek_sesi(p_hash text)
returns text
language sql
security definer
set search_path = public
as $$
  update sesi set dipakai = now() where token_hash = p_hash returning user_id;
$$;

-- Edge Function: logout = hapus sesi perangkat ini.
create or replace function kantong_logout(p_hash text)
returns void
language sql
security definer
set search_path = public
as $$
  delete from sesi where token_hash = p_hash;
$$;

revoke all on function kantong_atur_login(text, text, text) from public, anon, authenticated;
revoke all on function kantong_login(text, text) from public, anon, authenticated;
revoke all on function kantong_cek_sesi(text) from public, anon, authenticated;
revoke all on function kantong_logout(text) from public, anon, authenticated;
grant execute on function kantong_login(text, text) to service_role;
grant execute on function kantong_cek_sesi(text) to service_role;
grant execute on function kantong_logout(text) to service_role;
