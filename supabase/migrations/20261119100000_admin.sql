-- Admin panel (/admin/): kelola akun login. Hanya akun dengan login.admin = true yang boleh.
alter table login add column if not exists admin boolean not null default false;
alter table login add column if not exists aktif boolean not null default true;

-- Password acak mudah dibaca (tanpa 0/O/1/l/I), 12 karakter.
create or replace function kantong_password_acak()
returns text
language plpgsql
set search_path = public, extensions
as $$
declare
  abjad text := 'abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  b bytea := gen_random_bytes(12);
  hasil text := '';
begin
  for i in 0..11 loop
    hasil := hasil || substr(abjad, 1 + (get_byte(b, i) % length(abjad)), 1);
  end loop;
  return hasil;
end;
$$;

-- Login: akun nonaktif ditolak; kembalikan flag admin.
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
  return jsonb_build_object('ok', true, 'token', token, 'user_id', l.user_id, 'admin', l.admin);
end;
$$;

-- Sesi hanya berlaku untuk akun aktif.
create or replace function kantong_cek_sesi(p_hash text)
returns text
language sql
security definer
set search_path = public
as $$
  update sesi s set dipakai = now() from login l
   where s.token_hash = p_hash and l.user_id = s.user_id and l.aktif
  returning s.user_id;
$$;

-- Semua aksi admin. p_aksi: list | simpan | reset | cabut | hapus
create or replace function kantong_admin(p_hash text, p_aksi text, p_data jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  saya text;
  d jsonb := coalesce(p_data, '{}'::jsonb);
  uid text := lower(trim(coalesce(d->>'user_id', '')));
  uname text := lower(trim(coalesce(d->>'username', '')));
  pw text;
  baru boolean;
begin
  select s.user_id into saya from sesi s join login l on l.user_id = s.user_id
   where s.token_hash = p_hash and l.aktif and l.admin;
  if saya is null then return jsonb_build_object('ok', false, 'code', 'AUTH', 'error', 'Bukan admin atau sesi berakhir'); end if;
  update sesi set dipakai = now() where token_hash = p_hash;

  if p_aksi = 'list' then
    return jsonb_build_object('ok', true, 'saya', saya, 'akun', coalesce((
      select jsonb_agg(jsonb_build_object(
        'user_id', u.id, 'nama', u.nama, 'username', l.username, 'admin', coalesce(l.admin, false),
        'aktif', coalesce(l.aktif, false), 'punya_login', l.user_id is not null,
        'terkunci', l.kunci_sampai is not null and l.kunci_sampai > now(),
        'sesi', (select count(*) from sesi s where s.user_id = u.id),
        'terakhir', (select max(dipakai) from sesi s where s.user_id = u.id),
        'diubah', l.diubah) order by u.id)
      from users u left join login l on l.user_id = u.id), '[]'::jsonb));

  elsif p_aksi = 'simpan' then
    if uid !~ '^[a-z0-9_-]{2,32}$' then return jsonb_build_object('ok', false, 'error', 'ID user 2-32 huruf kecil/angka/_-'); end if;
    if uname !~ '^[a-z0-9._-]{3,32}$' then return jsonb_build_object('ok', false, 'error', 'Username 3-32 huruf kecil/angka/._-'); end if;
    if exists (select 1 from login where username = uname and user_id <> uid) then
      return jsonb_build_object('ok', false, 'error', 'Username sudah dipakai');
    end if;
    if uid = saya and (coalesce((d->>'aktif')::boolean, true) = false or coalesce((d->>'admin')::boolean, true) = false) then
      return jsonb_build_object('ok', false, 'error', 'Tidak bisa menonaktifkan / mencabut admin akun sendiri');
    end if;
    -- user baru: buat baris users + buku pribadinya
    if not exists (select 1 from users where id = uid) then
      insert into buku (id, nama, tipe, pemilik, urutan)
        values (uid, coalesce(nullif(trim(d->>'nama'), ''), uid), 'Pribadi', uid, (select coalesce(max(urutan), 0) + 1 from buku))
        on conflict (id) do nothing;
      insert into users (id, nama, buku) values (uid, coalesce(nullif(trim(d->>'nama'), ''), uid), uid);
    elsif nullif(trim(d->>'nama'), '') is not null then
      update users set nama = trim(d->>'nama') where id = uid;
    end if;
    baru := not exists (select 1 from login where user_id = uid);
    if baru then
      pw := kantong_password_acak();
      insert into login (user_id, username, pass_hash, admin, aktif)
        values (uid, uname, crypt(pw, gen_salt('bf', 10)), coalesce((d->>'admin')::boolean, false), coalesce((d->>'aktif')::boolean, true));
    else
      update login set username = uname,
        admin = coalesce((d->>'admin')::boolean, admin), aktif = coalesce((d->>'aktif')::boolean, aktif), diubah = now()
        where user_id = uid;
      if not coalesce((d->>'aktif')::boolean, true) then delete from sesi where user_id = uid; end if;
    end if;
    return jsonb_build_object('ok', true, 'password', pw);   -- password hanya ada saat akun login baru dibuat

  elsif p_aksi = 'reset' then
    if not exists (select 1 from login where user_id = uid) then return jsonb_build_object('ok', false, 'error', 'Akun tidak ditemukan'); end if;
    pw := kantong_password_acak();
    update login set pass_hash = crypt(pw, gen_salt('bf', 10)), gagal = 0, kunci_sampai = null, diubah = now() where user_id = uid;
    delete from sesi where user_id = uid and token_hash <> p_hash;
    return jsonb_build_object('ok', true, 'password', pw);

  elsif p_aksi = 'cabut' then
    delete from sesi where user_id = uid and token_hash <> p_hash;
    return jsonb_build_object('ok', true);

  elsif p_aksi = 'hapus' then
    if uid = saya then return jsonb_build_object('ok', false, 'error', 'Tidak bisa menghapus akun sendiri'); end if;
    delete from sesi where user_id = uid;
    delete from login where user_id = uid;   -- data keuangan user tetap aman; hanya akses login yang dihapus
    return jsonb_build_object('ok', true);
  end if;
  return jsonb_build_object('ok', false, 'error', 'Aksi tidak dikenal');
end;
$$;

revoke all on function kantong_password_acak() from public, anon, authenticated;
revoke all on function kantong_login(text, text) from public, anon, authenticated;
revoke all on function kantong_cek_sesi(text) from public, anon, authenticated;
revoke all on function kantong_admin(text, text, jsonb) from public, anon, authenticated;
grant execute on function kantong_login(text, text) to service_role;
grant execute on function kantong_cek_sesi(text) to service_role;
grant execute on function kantong_admin(text, text, jsonb) to service_role;
