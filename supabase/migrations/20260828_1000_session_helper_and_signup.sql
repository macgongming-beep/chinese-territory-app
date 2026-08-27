-- anon 쓰기 차단의 1단계: **더하기만 한다. 아직 아무것도 막지 않는다.**
--
-- 이 단계가 끝나도 옛 앱을 쓰는 사람은 그대로 돌아간다.
-- 실제로 막는 것은 다음 단계(open_access 제거 + 쓰기 정책)다.

-- ═══ ① 요청자를 알아내는 읽기 전용 helper ═══
--
-- ⚠ verify_session 을 정책에서 부르면 안 된다. 그 함수는 검사만 하지 않는다 —
--   세션을 지우고(비활성·미승인), last_used_at 을 쓰고, 실패하면 예외를 던진다.
--   RLS 는 행마다 평가될 수 있어 대량 UPDATE 에서 같은 세션 행을 반복 갱신하고
--   잠금 경합을 만든다. 그래서 부작용 없는 것을 따로 만든다.
--
-- private 스키마에 둔다 — PostgREST 는 public 만 노출하므로 밖에서 못 부른다.

create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

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

/**
 * 이 요청을 보낸 사람의 id. 없거나 이상하면 null.
 * 정책에서는 반드시 `(select private.request_session_user_id())` 로 감싼다 —
 * 그래야 statement 당 한 번만 평가된다 (행마다 돌면 느리다).
 */
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
  exception when invalid_text_representation then
    -- 형식이 이상한 헤더만 '없는 것' 으로 본다.
    -- when others 로 하면 권한·스키마 오류까지 '로그인 안 됨' 으로 숨긴다.
    return null;
  end;
  if v_token is null then return null; end if;

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

/** 이 요청을 보낸 사람의 역할. 없으면 null. 역할별 정책에서 쓴다 */
create or replace function private.request_session_role()
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select u.role
  from public.app_users u
  where u.id = private.request_session_user_id()
$$;

/** 관리자·개발자인가 */
create or replace function private.request_is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(private.request_session_role() in ('admin', 'developer'), false)
$$;

-- ═══ ② 가입을 RPC 로 ═══
--
-- 가입은 **로그인 전**이라 세션 헤더가 없다. 다음 단계에서 app_users 직접 쓰기를
-- 막으면 이 경로가 죽으므로 미리 옮긴다.
--
-- ⚠ 역할과 승인 상태를 **서버가 정한다.** 클라이언트가 role 을 보내게 두면
--   가입하면서 자기를 admin 으로 만들 수 있다.

create or replace function public.signup_tx(
  p_login_id text,
  p_name     text,
  p_pin      text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_login_id text := btrim(coalesce(p_login_id, ''));
  v_name     text := btrim(coalesce(p_name, ''));
  v_id       integer;
begin
  if v_login_id = '' or v_name = '' or coalesce(p_pin, '') = '' then
    return jsonb_build_object('ok', false, 'reason', 'empty',
                              'message', '아이디·이름·비밀번호를 모두 입력해 주세요.');
  end if;

  if exists (select 1 from public.app_users where login_id = v_login_id) then
    return jsonb_build_object('ok', false, 'reason', 'login_id_taken',
                              'message', '이미 사용 중인 아이디입니다.');
  end if;
  if exists (select 1 from public.app_users where name = v_name) then
    return jsonb_build_object('ok', false, 'reason', 'name_taken',
                              'message', '이미 사용 중인 닉네임입니다. 다른 이름을 사용해 주세요.');
  end if;

  -- role·approval_status 는 인자로 받지 않는다. 서버가 정한다.
  -- 위 검사와 insert 사이에 다른 요청이 끼어들 수 있다.
  -- 진짜 방어선은 DB 의 unique 다 (app_users_login_id_key / app_users_name_key).
  begin
    insert into public.app_users (login_id, name, pin, role, approval_status)
    values (v_login_id, v_name, p_pin, 'user', 'pending')
    returning id into v_id;
  exception when unique_violation then
    return jsonb_build_object('ok', false, 'reason', 'taken',
                              'message', '이미 사용 중인 아이디 또는 닉네임입니다.');
  end;

  return jsonb_build_object('ok', true, 'id', v_id);
end;
$$;

revoke all on function public.signup_tx(text, text, text) from public;
grant execute on function public.signup_tx(text, text, text) to anon, authenticated;

notify pgrst, 'reload schema';
