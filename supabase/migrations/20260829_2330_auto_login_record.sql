-- 자동 로그인도 '로그인 기록' 에 남긴다 — **하루 한 번만.**
--
-- 무엇이 문제였나 (2026-08-29 발견):
--   `auth_record_auto_login` 은 `last_login_at` 만 갱신하고 `login_logs` 에는
--   안 넣었다. 그래서 **자동 로그인만 하는 사람은 기록이 옛 날짜에 멈춰 보인다.**
--   실측: 그날 45명이 접속했는데 기록은 4건. 어떤 분은 8월 10일에 멈춰 있었다.
--   고장이 아니라 화면이 거짓을 말하는 상태였다.
--
-- ⚠ 하루 한 번인 이유: 이 함수는 **앱을 열 때마다** 불린다. 그대로 넣으면
--   한 사람이 하루에 열 번씩 쌓여 목록이 쓸모없어진다. 이 화면의 쓸모는
--   "이 사람이 언제 앱을 썼나" 이므로 날짜 단위면 충분하다.
--   (4개월에 283행이던 표다. 하루 한 번이면 한 달에 62×30 = 1,860행쯤)
--
-- ⚠ 날짜는 **한국 시간** 기준이다. UTC 로 하면 아침 9시 전에 연 것이
--   '어제' 로 잡혀 하루에 두 번 남는다.
--
-- ⚠ 기록에 실패해도 **로그인을 막지 않는다.** 여기서 예외가 나면 62명이
--   앱에 못 들어간다. 기록은 부가 기능이지 로그인의 조건이 아니다.
--
-- ⚠ `revoke` 하지 않는다 (집 규칙의 예외). 이 함수는 **anon 이 불러야 하는**
--   기존 함수다 — 자동 로그인 경로에서 부른다. 권한을 뺏으면 그 경로가 죽는다.
--   `create or replace` 는 기존 권한을 유지한다.

create or replace function public.auth_record_auto_login(
  p_user_id integer,
  p_device_label text default null,
  p_user_agent text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.app_users
  set last_login_at = now()
  where id = p_user_id;

  -- 오늘(한국 시간) 기록이 없을 때만 남긴다
  begin
    if not exists (
      select 1 from public.login_logs
      where user_id = p_user_id
        and (logged_in_at at time zone 'Asia/Seoul')::date
            = (now() at time zone 'Asia/Seoul')::date
    ) then
      insert into public.login_logs (user_id) values (p_user_id);
    end if;
  exception when others then
    -- 기록이 안 되는 것보다 로그인이 막히는 것이 훨씬 나쁘다
    null;
  end;
end;
$$;
