-- request.headers 가 ① RPC 안에서 ② **정책 안에서** 실제로 오는지 증명한다.
-- **테스트 DB 에서만.** 끝나면 아래 뒷정리를 돌린다.
--
-- ⚠ SQL Editor 에서 set_config 로 흉내내면 증명이 안 된다.
--   진짜 HTTP 요청으로 와야 한다 → npm run smoke:headers 가 부른다.

do $$
declare v_env text;
begin
  select value into v_env from public.app_private_settings where key = 'environment';
  if coalesce(v_env, '') <> 'test' then
    raise exception '이 DB 에는 테스트 표식이 없습니다 — 중단합니다.';
  end if;
end $$;

-- ① 헤더가 오는지 그대로 돌려주는 탐침
create or replace function public._probe_headers()
returns jsonb
language sql
stable
as $$
  select coalesce(nullif(current_setting('request.headers', true), ''), '{}')::jsonb
$$;
grant execute on function public._probe_headers() to anon;

-- ② 정책 안에서도 읽히는지 — 부작용 없는 읽기 전용 helper (실제로 쓸 모양 그대로)
create schema if not exists private;
revoke all on schema private from public, anon, authenticated;   -- ⚠ 운영과 같은 권한으로 시험해야 한다

create or replace function private.request_session_token()
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select nullif(
           coalesce(nullif(current_setting('request.headers', true), ''), '{}')::jsonb
             ->> 'x-session-token',
           ''
         )::uuid
$$;

-- 잘못된 UUID 가 와도 예외 대신 null 이 되게 감싼다
create or replace function private.request_session_user_id()
returns integer
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_token uuid;
  v_user_id integer;
begin
  begin
    v_token := private.request_session_token();
  exception when others then
    return null;   -- 형식이 이상한 헤더는 '없는 것' 으로 본다
  end;
  if v_token is null then return null; end if;

  -- 읽기만 한다. verify_session 과 달리 지우지도 쓰지도 던지지도 않는다.
  select s.user_id into v_user_id
  from public.auth_sessions s
  join public.app_users u on u.id = s.user_id
  where s.token = v_token
    and s.expires_at > now()
    and coalesce(u.is_active, true) is true
    and coalesce(u.approval_status, 'approved') = 'approved';

  return v_user_id;
end;
$$;

-- ③ 정책이 실제로 그 helper 를 보는지 — 시험용 표
drop table if exists public._probe_gate;
create table public._probe_gate (id bigint generated always as identity primary key, memo text);
alter table public._probe_gate enable row level security;
grant select, insert on table public._probe_gate to anon;
grant usage, select on sequence public._probe_gate_id_seq to anon;

create policy probe_read on public._probe_gate for select to anon using (true);
create policy probe_write on public._probe_gate for insert to anon
  with check ((select private.request_session_user_id()) is not null);

notify pgrst, 'reload schema';

-- ═══ 끝나면 이걸로 치운다 ═══
-- drop table if exists public._probe_gate;
-- drop function if exists public._probe_headers();
