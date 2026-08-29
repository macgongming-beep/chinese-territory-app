-- 관리자 화면이 부르는 `security definer` 함수의 anon 실행권한을 **일단 회수한다.**
--
-- 왜 이렇게 급히 (2026-08-29 리뷰, P0):
--   이 다섯은 자료를 바꾸거나 지우는데 **권한 검사가 없고 anon 이 부를 수 있다.**
--   표 직접 쓰기를 막아도 definer 는 RLS 를 우회하므로 그대로 뚫려 있었다.
--     delete_old_visit_histories  ← 날짜 이전 **방문기록을 지운다.** 제일 아프다
--     cleanup_old_data            자료 정리(삭제)
--     manual_reset_met_units      '만남' 전체 초기화
--     update_daily_service_settings / update_global_push_quiet_settings
--                                 회중 전체 알림 설정을 바꾼다
--
-- ⚠ **이건 임시 조치다.** 제대로 된 답은 함수 안에서 관리자인지 확인하는 것이다
--   (`public.session_is_admin()`). 그건 본문을 건드리는 일이라 따로,
--   리뷰받고 한다. 그때 이 회수를 되돌리고 grant 를 다시 준다.
--
-- ⚠ **부작용을 알고 한다**: 이 회수로 아래 화면의 '실행' 이 오류를 낸다.
--     · 설정 → 데이터 관리 (정리·초기화·오래된 방문기록 삭제)
--     · 알림 설정의 **전역** 항목 (봉사 알림 시간, 조용 시간)
--   숫자를 보여주는 preview_data_cleanup / count_old_visit_histories 는 **남겨 둔다**
--   — 읽기만 하고, 화면이 통째로 죽는 것보다 낫다.
--   개인 알림 설정(update_my_notification_prefs)은 검사가 있어 그대로 된다.
--
-- 되돌리려면 (관리자 검사를 넣기 전에 급히 필요하면):
--   grant execute on function public.<이름>(<인자>) to anon;

revoke all on function public.delete_old_visit_histories(text)                        from public, anon, authenticated;
revoke all on function public.cleanup_old_data()                                      from public, anon, authenticated;
revoke all on function public.manual_reset_met_units()                                from public, anon, authenticated;
revoke all on function public.update_daily_service_settings(text, boolean, text)      from public, anon, authenticated;
revoke all on function public.update_global_push_quiet_settings(text, boolean, text, text) from public, anon, authenticated;

do $$
declare v text;
begin
  select string_agg(p.proname, ', ') into v
  from pg_proc p join pg_namespace n on n.oid=p.pronamespace
  where n.nspname='public'
    and p.proname in ('delete_old_visit_histories','cleanup_old_data','manual_reset_met_units',
                      'update_daily_service_settings','update_global_push_quiet_settings')
    and has_function_privilege('anon', p.oid, 'execute');
  if v is not null then raise exception '아직 anon 이 부를 수 있다: %', v; end if;
  raise notice '✅ 다섯 다 닫혔다';
end $$;
