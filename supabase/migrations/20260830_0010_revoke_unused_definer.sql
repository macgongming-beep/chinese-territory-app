-- anon 이 부를 수 있는 `security definer` 함수 중 **앱이 전혀 안 부르는 것**을 닫는다.
--
-- 왜 급한가 (2026-08-29 리뷰에서 잡혔다):
--   표 직접 쓰기는 막았는데 **definer RPC 는 RLS 를 우회한다.**
--   즉 "표를 못 지운다" 와 "자료를 못 지운다" 는 다른 말이었다.
--   실측: anon 이 부를 수 있는 definer 함수가 **65개**.
--
-- 여기 있는 넷은 **앱 코드 어디서도 안 부른다.** 그러니 닫아도 아무것도 안 깨진다.
--   send_daily_service_digest  ← 제일 위험. **회중 전원에게 푸시를 쏜다**
--                                 (8/27 에 막았던 것과 같은 모양의 구멍이다)
--   cleanup_old_service_logs   봉사 기록을 지운다
--   cleanup_expired_auth_sessions  세션을 지운다 (전원 로그아웃)
--   auto_reset_met_units       '만남' 상태를 되돌린다
--
-- ⚠ pg_cron 이나 Edge Function 은 service_role 로 돌아서 영향이 없다.
--   (그 경로는 함수 실행권한이 아니라 role 로 통과한다)

revoke all on function public.send_daily_service_digest(boolean)   from public, anon, authenticated;
revoke all on function public.cleanup_old_service_logs()           from public, anon, authenticated;
revoke all on function public.cleanup_expired_auth_sessions()      from public, anon, authenticated;
revoke all on function public.auto_reset_met_units()               from public, anon, authenticated;

-- 확인: 넷 다 0 이어야 한다
do $$
declare v text;
begin
  select string_agg(p.proname, ', ') into v
  from pg_proc p join pg_namespace n on n.oid=p.pronamespace
  where n.nspname='public'
    and p.proname in ('send_daily_service_digest','cleanup_old_service_logs',
                      'cleanup_expired_auth_sessions','auto_reset_met_units')
    and has_function_privilege('anon', p.oid, 'execute');
  if v is not null then raise exception '아직 anon 이 부를 수 있다: %', v; end if;
  raise notice '✅ 넷 다 닫혔다';
end $$;
