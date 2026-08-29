-- ❌ **되돌리려다 실패했다. 이 파일은 기록으로 남긴다 — 실행하지 말 것.**
--
-- 하려던 것: 전역 알림 설정 두 함수(update_daily_service_settings ·
-- update_global_push_quiet_settings)는 본문에 관리자 검사가 있으니 grant 를 되돌리기.
--
-- ⚠ **그 검사가 실제로는 안 먹는다.**
--
--   select u.role into v_role from auth_sessions s join app_users u ... where s.token = v_token;
--   if v_role not in ('admin','developer') then raise exception 'permission denied'; end if;
--
--   토큰이 없으면 `v_role` 이 **NULL** 이고, `NULL not in ('admin','developer')` 는
--   참이 아니라 **NULL** 이다. 그래서 `if` 를 안 타고 **그냥 통과한다.**
--   본문만 읽으면 검사가 있어 보이는데, 실제로는 아무나 부를 수 있었다.
--
--   확인 방법: 없는 토큰(`00000000-…`)으로 부르니 HTTP 200 이 오고 값이 바뀌었다.
--
-- 고칠 때는 `if v_role is null or v_role not in (...)` 로, 또는
-- `coalesce(v_role,'') not in (...)` 로 바꾸고 나서 grant 한다.
-- **그 전까지는 회수 상태를 유지한다.**

-- (이 파일은 실행하지 않는다. 아래 회수가 현재 상태다)
revoke all on function public.update_daily_service_settings(text, boolean, text)              from public, anon, authenticated;
revoke all on function public.update_global_push_quiet_settings(text, boolean, text, text)    from public, anon, authenticated;
