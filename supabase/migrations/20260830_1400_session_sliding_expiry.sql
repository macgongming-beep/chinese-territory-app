-- 세션을 쓰면 만료를 밀어준다 (sliding expiry).
--
-- 무엇이 문제였나 (2026-08-30 봉사 중 터졌다):
--   세션은 30일 뒤 만료되는데 `verify_session` 은 `last_used_at` 만 갱신하고
--   `expires_at` 은 그대로 뒀다. 게다가 **클라이언트는 verify_session 을 아예
--   안 불렀다** — localStorage 만 믿고 자동 로그인했다.
--
--   그래서 30일 전에 로그인한 사람은 **토큰이 만료됐는데도 앱은 로그인 상태**로
--   보였다. 세션 관문을 걸자 그 사람들의 쓰기가 전부 실패했다.
--   실측: 활성 62명 중 유효한 토큰을 가진 사람 **24명**. 나머지 38명이
--   방문 기록도 배정도 저장하지 못했다.
--
-- 이 마이그레이션은 그중 절반을 고친다: **쓰면 안 끊긴다.**
-- 나머지 절반(토큰이 없으면 로그인시키기)은 클라이언트 쪽이다.
--
-- ⚠ 만료를 밀어주는 것은 "30일 동안 안 쓰면 로그아웃" 이라는 뜻이다.
--   매일 쓰는 사람은 다시는 안 끊긴다.

create or replace function public.verify_session(p_token uuid)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id integer;
  v_is_active boolean;
  v_approval_status text;
begin
  if p_token is null then
    raise exception '세션 토큰이 없습니다';
  end if;

  select s.user_id, coalesce(u.is_active, true), coalesce(u.approval_status, 'approved')
  into v_user_id, v_is_active, v_approval_status
  from public.auth_sessions s
  join public.app_users u on u.id = s.user_id
  where s.token = p_token
    and s.expires_at > now();

  if v_user_id is null then
    raise exception '세션 만료. 다시 로그인해주세요';
  end if;

  if v_is_active is false then
    delete from public.auth_sessions where token = p_token;
    raise exception '비활성화된 계정입니다';
  end if;

  if v_approval_status is distinct from 'approved' then
    delete from public.auth_sessions where token = p_token;
    raise exception '승인되지 않은 계정입니다';
  end if;

  -- ⚠ 여기가 바뀐 곳: 쓸 때마다 만료를 다시 30일 뒤로 민다.
  --   예전에는 last_used_at 만 갱신해서, 매일 쓰는 사람도 30일 뒤 조용히 끊겼다.
  update public.auth_sessions
  set last_used_at = now(),
      expires_at = now() + interval '30 days'
  where token = p_token;

  return v_user_id;
end;
$$;

-- 이 함수는 클라이언트가 불러야 한다 (자동 로그인 때 토큰을 확인·연장한다).
revoke all on function public.verify_session(uuid) from public;
grant execute on function public.verify_session(uuid) to anon, authenticated;
