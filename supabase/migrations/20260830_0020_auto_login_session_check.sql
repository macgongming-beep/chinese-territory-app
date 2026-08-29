-- 자동 로그인 기록을 **남의 이름으로** 못 만들게 한다.
--
-- 무엇이 문제였나 (2026-08-29 리뷰):
--   `auth_record_auto_login` 은 anon 이 넘긴 `p_user_id` 를 그대로 믿고,
--   definer 권한으로 `app_users.last_login_at` 과 `login_logs` 를 쓴다.
--   즉 **아무나 남의 접속 기록을 위조**할 수 있었다.
--   (어제 만든 것이 아니라 원래 그랬는데, 어제 login_logs 까지 쓰게 되면서 커졌다)
--
-- 호출부는 이미 세션 헤더를 보낸다. 그러니 **서버에서 본인인지 확인**한다.
--
-- ⚠ 토큰이 없는 옛 세션이면 예외가 난다 — 클라이언트가 try/catch 로 감싸고 있어
--   자동 로그인 자체는 계속된다 (기록만 안 남는다). fail-closed 가 맞다.

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
  -- ⚠ 본인만. 이게 없으면 아무나 남의 기록을 만든다
  if p_user_id is distinct from (select private.request_session_user_id()) then
    raise exception '세션과 다른 사용자입니다';
  end if;

  update public.app_users
  set last_login_at = now()
  where id = p_user_id;

  -- 오늘(한국 시간) 기록이 없을 때만 남긴다.
  -- ⚠ 이 함수는 앱을 열 때마다 불린다. 그대로 넣으면 하루 열 줄씩 쌓여
  --   목록이 쓸모없어진다. 날짜는 UTC 가 아니라 한국 시간이어야 한다
  --   (UTC 면 아침 9시 전 접속이 '어제' 로 잡혀 하루에 두 번 남는다).
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
    -- 기록이 안 되는 것보다 로그인이 막히는 것이 훨씬 나쁘다.
    -- ⚠ 다만 **조용히** 삼키면 "왜 안 쌓이지" 를 영영 못 찾는다 (실제로 겪었다).
    --   흔적은 남긴다.
    raise warning 'login_logs 기록 실패 (user_id=%): %', p_user_id, sqlerrm;
  end;
end;
$$;

-- 권한: PUBLIC 회수 후 anon 에만 명시
revoke all on function public.auth_record_auto_login(integer, text, text) from public;
grant execute on function public.auth_record_auto_login(integer, text, text) to anon, authenticated;
