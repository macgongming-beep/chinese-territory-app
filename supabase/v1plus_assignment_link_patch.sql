-- =============================================================
-- v1+ Assignment notification link patch
-- 작성일: 2026-05-15
--
-- 배정 알림 클릭 시 채팅방이 아니라 나의 봉사의 해당 배정으로 이동한다.
-- =============================================================

create or replace function public.notify_on_card_assignment()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_recipient_id integer;
  v_assigner_id integer;
  v_event_title text;
  v_event_date date;
  v_event_time text;
  v_card_name text;
  v_title text;
  v_body text;
  v_link text;
begin
  select id into v_recipient_id
  from public.app_users
  where name = new.user_name
    and coalesce(is_active, true) is true
  limit 1;

  if v_recipient_id is null then
    return new;
  end if;

  if coalesce(new.assigned_by, '') <> '' then
    select id into v_assigner_id
    from public.app_users
    where name = new.assigned_by
    limit 1;
  end if;

  if v_assigner_id is not null and v_assigner_id = v_recipient_id then
    return new;
  end if;

  select title, event_date, time
  into v_event_title, v_event_date, v_event_time
  from public.calendar_events
  where id = new.event_id;

  select name into v_card_name
  from public.cards
  where id = new.assigned_card_id;

  v_title := '봉사 카드가 배정되었습니다';
  v_body := coalesce(v_event_title, '봉사 일정') ||
            case when v_event_date is not null
              then ' · ' || to_char(v_event_date, 'YYYY-MM-DD') ||
                   coalesce(' ' || v_event_time, '')
              else ''
            end ||
            case when v_card_name is not null
              then ' · ' || v_card_name
              else ''
            end;
  v_link := '/territory?assignmentEvent=' || new.event_id;

  perform public.insert_notifications(
    array[v_recipient_id],
    'assignment',
    v_title,
    v_body,
    v_link,
    new.event_id
  );

  perform public.dispatch_push_notification(
    array[v_recipient_id],
    'assignment',
    v_title,
    v_body,
    v_link,
    new.event_id
  );

  return new;
end;
$$;
