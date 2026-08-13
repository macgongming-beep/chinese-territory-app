-- 개인 방해금지 시간이 적용되지 않던 문제 수정
-- Supabase SQL Editor 에서 실행
--
-- 원인: 푸시 발송 Edge Function(send-push) 이 개인 방해금지 시간을
--       public.user_notification_prefs 에서 읽는데 그런 테이블이 없다.
--       (진짜 설정은 public.notification_preferences 에 있다)
--       조회 실패를 무시하도록 돼 있어 조용히 넘어갔고, 결과적으로
--       개인이 설정한 방해금지 시간이 한 번도 적용되지 않았다.
--
-- 조치: 그 이름으로 볼 수 있는 뷰를 만들어 준다.
--       Edge Function 을 다시 배포하지 않아도 바로 동작한다.
--       (코드 쪽도 진짜 테이블을 보도록 함께 고쳐 두었으므로,
--        나중에 재배포해도 이 뷰가 남아 있어 문제 없다)

create or replace view public.user_notification_prefs as
select
  user_id,
  quiet_hours_start,
  quiet_hours_end
from public.notification_preferences;

-- 발송 함수는 service_role 로 접근한다. 일반 사용자에게는 열지 않는다.
revoke all on public.user_notification_prefs from anon, authenticated;

-- ─── 검증 ────────────────────────────────────────────────────
-- 뷰가 보이는지:
--   select count(*) from public.user_notification_prefs;
-- 방해금지를 켜 둔 사람 확인:
--   select user_id, quiet_hours_start, quiet_hours_end
--   from public.user_notification_prefs
--   where quiet_hours_start is not null;
