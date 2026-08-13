-- app_users: 아이디(login_id) / 닉네임(name) 분리 마이그레이션
-- Supabase SQL Editor에서 실행

alter table public.app_users
  add column if not exists login_id text;

update public.app_users
set login_id = name
where login_id is null or btrim(login_id) = '';

alter table public.app_users
  alter column login_id set not null;

do $$
begin
  if not exists (
    select from pg_indexes
    where schemaname = 'public'
      and tablename = 'app_users'
      and indexname = 'app_users_login_id_key'
  ) then
    create unique index app_users_login_id_key on public.app_users (login_id);
  end if;
end $$;
