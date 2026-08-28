-- ⚠ **읽기만 한다.** 전환 SQL 을 넣기 전에 1분.
--
-- 전환 SQL 은 `drop policy` 를 34번 한다. **이름이 하나라도 다르면 통째로 실패**한다.
-- baseline.sql 기준으로 만들었으니, 그 뒤로 달라진 DB 에서는 어긋난다.
-- 무엇이 어긋나는지 **미리 이름으로** 본다.

with expected(tablename, policyname) as (values
  ('app_settings', $x$app_settings_write$x$),
  ('app_users', $x$open_access$x$),
  ('buildings', $x$open_access$x$),
  ('calendar_events', $x$open$x$),
  ('card_assignments', $x$open_access$x$),
  ('card_boundaries', $x$open_access$x$),
  ('card_leader_assignments', $x$open_access$x$),
  ('cards', $x$open_access$x$),
  ('chat_room_mutes', $x$open_access$x$),
  ('comments', $x$open_access$x$),
  ('event_card_assignment_cards', $x$open_access$x$),
  ('event_card_assignments', $x$open_access$x$),
  ('event_informal_assignments', $x$open_access$x$),
  ('event_participants', $x$open$x$),
  ('event_restaurant_assignments', $x$open_access$x$),
  ('informal_assets', $x$open_access$x$),
  ('informal_groups', $x$open_access$x$),
  ('notices', $x$anyone can delete notices$x$),
  ('notices', $x$anyone can insert notices$x$),
  ('notices', $x$delete$x$),
  ('notices', $x$insert$x$),
  ('phone_surveys', $x$open_access$x$),
  ('regular_visits', $x$open_access$x$),
  ('restaurant_requests', $x$restaurant_requests_delete$x$),
  ('restaurant_requests', $x$restaurant_requests_insert$x$),
  ('restaurant_requests', $x$restaurant_requests_update$x$),
  ('return_visit_logs', $x$allow all$x$),
  ('return_visits', $x$allow all$x$),
  ('review_tasks', $x$allow all$x$),
  ('service_sessions', $x$open_access$x$),
  ('service_suggestions', $x$Enable all operations for all$x$),
  ('territory_regions', $x$open_access$x$),
  ('units', $x$open_access$x$),
  ('visit_histories', $x$open_access$x$)
)
select
  coalesce(e.tablename, p.tablename)   as 표,
  coalesce(e.policyname, p.policyname) as 정책,
  case
    when p.policyname is null then '❌ 없다 — drop 이 실패한다'
    when e.policyname is null then '⚠ 예상 밖의 열린 쓰기 정책 — 안 막힌 채 남는다'
    else '✅'
  end as 상태
from expected e
full outer join (
  select tablename, policyname from pg_policies
  where schemaname = 'public'
    and cmd in ('ALL','INSERT','UPDATE','DELETE')
    and policyname <> 'app_private_settings_deny_all'
) p on p.tablename = e.tablename and p.policyname = e.policyname
where p.policyname is null or e.policyname is null   -- ✅ 인 것은 안 보여준다
order by 1, 2;

-- 결과가 **0행이면 그대로 넣어도 된다.**
-- 행이 나오면 그 표만 손보고 다시 확인한다.
