-- ② 위에서 본 폭주 구간을 지운다.
--    아래 두 시각을 ① 결과에 맞게 고칠 것. 넉넉히 잡지 말고 그 구간만 잡는다.
--    (정상적인 '일정 변경' 알림까지 지우지 않도록)

begin;

-- 지우기 전에 몇 건인지 확인
select count(*) as 지울건수, count(distinct user_id) as 대상자
from public.notifications
where type = 'event_change'
  and created_at >= '2026-08-26 00:00:00+09'   -- ← 시작 시각으로 고치기
  and created_at <  '2026-08-27 00:00:00+09';  -- ← 끝 시각으로 고치기

delete from public.notifications
where type = 'event_change'
  and created_at >= '2026-08-26 00:00:00+09'   -- ← 위와 똑같이
  and created_at <  '2026-08-27 00:00:00+09';

-- 숫자가 예상과 맞으면 commit, 아니면 rollback 을 실행한다.
commit;
