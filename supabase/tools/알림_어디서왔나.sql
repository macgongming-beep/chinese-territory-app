-- 최근 알림이 언제·무엇 때문에 나갔는지, 그리고 억제 장치가 실제로 붙어 있는지.

-- ① 최근 3시간 알림을 분 단위로
select date_trunc('minute', created_at) as 분,
       type                              as 종류,
       count(*)                          as 건수,
       count(distinct user_id)           as 받은사람,
       min(title)                        as 제목표본,
       min(related_id)                   as 관련id
from public.notifications
where created_at > now() - interval '3 hours'
group by 1, 2
order by 1 desc;

-- ② 억제 장치가 트리거 함수에 실제로 들어 있나 (2400 이 제대로 올라갔나)
select
  position('suppress_notifications' in prosrc) > 0 as 억제검사_있음,
  position('event_date < current_date' in prosrc) > 0 as 지난일정_거름,
  position('user_ids_in_name_list' in prosrc) > 0 as 인도자목록_고침
from pg_proc where proname = 'notify_on_calendar_event_change';

-- ③ 이름 정리 RPC 가 억제 표식을 세우나 (2200/2300 이 제대로 올라갔나)
select proname,
       position('suppress_notifications' in prosrc) > 0 as 표식세움
from pg_proc
where proname in ('rename_user_name_references', 'purge_user_name_references')
order by proname;

-- ④ 최근에 손댄 일정이 있나
select id, event_date, title, left(leader_name, 40) as 인도자
from public.calendar_events
order by id desc limit 5;
