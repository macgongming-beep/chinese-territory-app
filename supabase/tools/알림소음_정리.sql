-- 옛 이름 일괄 정리 때 잘못 나간 '일정이 변경되었습니다' 알림을 지운다.
-- 폰에 이미 뜬 푸시는 거둘 수 없다. 앱 안 알림 목록만 정리한다.
--
-- ① 먼저 이것만 실행해서 뭘 지울지 본다.

select date_trunc('minute', created_at) as 분,
       count(*)                          as 건수,
       count(distinct user_id)            as 받은사람
from public.notifications
where type = 'event_change'
  and created_at > now() - interval '12 hours'
group by 1
order by 1;
