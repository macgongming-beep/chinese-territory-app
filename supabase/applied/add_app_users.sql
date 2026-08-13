-- ============================================================
-- 간편 로그인용 사용자 테이블 (app_users)
-- Supabase SQL Editor에서 이 파일 전체를 실행하세요
-- ============================================================

create table if not exists public.app_users (
  id serial primary key,
  login_id text unique,
  name text unique not null,
  phone text,
  role text not null default 'user' check (role in ('user', 'leader', 'admin')),
  pin text not null, -- 비밀번호 (길이 자유, 4자리도 가능)
  created_at timestamptz default now()
);

alter table public.app_users
  add column if not exists login_id text;

alter table public.app_users
  add column if not exists phone text;

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

-- RLS (보안 규칙) 설정: 앱 자체 로직으로 검증하므로 데이터는 읽기/쓰기 허용
alter table public.app_users enable row level security;

do $$
begin
  if not exists (
    select from pg_policies where tablename = 'app_users' and policyname = 'open_access'
  ) then
    create policy "open_access" on public.app_users for all to anon using (true) with check (true);
  end if;
end $$;

-- 기본 관리자 계정 생성 (초기 비밀번호: 0000)
insert into public.app_users (login_id, name, role, pin)
values ('admin', '관리자', 'admin', '0000')
on conflict (login_id) do update set
  name = excluded.name,
  role = excluded.role;
