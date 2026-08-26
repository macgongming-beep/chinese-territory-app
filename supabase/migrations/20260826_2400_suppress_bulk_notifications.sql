-- 일괄 정리가 알림 폭탄을 쏘던 문제.
--
-- 무슨 일이 있었나: 옛 이름 정리로 calendar_events.leader_name 을 갈아끼웠더니
-- on_calendar_event_update 트리거가 일정마다 '일정이 변경되었습니다' 를 쏘았다.
-- 이름 표기만 바뀐 건데 참가자 전원에게 푸시가 갔다. 지난 일정까지 포함해서.
--
-- 두 가지를 막는다.
--   ① 관리 작업은 알림을 끈 채로 돈다 (트랜잭션 안에서만 유효한 표식)
--   ② 이미 지난 일정이 바뀐 것은 애초에 알리지 않는다
--      (끝난 모임의 시간이 바뀌었다고 알려봐야 할 일이 없다)

create or replace function public.notify_on_calendar_event_change()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_recipient_ids integer[];
  v_link text;
begin
  -- ① 일괄 정리 중에는 알리지 않는다
  if coalesce(current_setting('app.suppress_notifications', true), '') = 'on' then
    return new;
  end if;

  -- ② 이미 지난 일정은 알리지 않는다
  if new.event_date < current_date then
    return new;
  end if;

  if old.event_date is not distinct from new.event_date
    and old.time is not distinct from new.time
    and old.place is not distinct from new.place
    and old.meeting_map_url is not distinct from new.meeting_map_url
    and old.leader_name is not distinct from new.leader_name
    and old.title is not distinct from new.title
  then
    return new;
  end if;

  select array_agg(distinct recipient_id)
  into v_recipient_ids
  from (
    select u.id as recipient_id
    from public.event_participants ep
    join public.app_users u on u.name = ep.user_name
    where ep.event_id = new.id
    union
    select u.id as recipient_id
    from public.app_users u
    where u.name = new.leader_name
  ) recipients
  where recipient_id is not null;

  if v_recipient_ids is null or cardinality(v_recipient_ids) = 0 then
    return new;
  end if;

  v_link := '/calendar?openChat=' || new.id;

  perform public.insert_notifications(
    v_recipient_ids, 'event_change', '일정이 변경되었습니다',
    new.title || ' · ' || new.event_date || ' ' || new.time, v_link, new.id);

  perform public.dispatch_push_notification(
    v_recipient_ids, 'event_change', '일정이 변경되었습니다',
    new.title || ' · ' || new.event_date || ' ' || new.time, v_link, new.id);

  return new;
end;
$function$;

-- 정리 RPC 두 개는 각자의 마이그레이션(2200 / 2300)에서 표식을 세운다.
-- 그 두 파일을 (다시) 실행해야 이 억제가 실제로 걸린다.
