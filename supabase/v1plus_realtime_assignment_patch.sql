-- =============================================================
-- v1+ Realtime & Assignment Notification Patch
-- 작성일: 2026-05-14
--
-- 적용 내용:
--  1) Realtime publication: chat_messages / chat_read_status /
--     notifications / event_participants / calendar_events /
--     event_card_assignments / event_card_assignment_cards
--     테이블을 supabase_realtime publication 에 추가하여 클라이언트
--     postgres_changes 구독이 동작하게 한다.
--  2) 인도자가 봉사자에게 카드를 배정하면 푸시/인앱 알림을 보낸다.
--     event_card_assignments INSERT 시 user_name 으로 user_id 를
--     찾아 알림 발송.
-- =============================================================

-- ─── 1. Realtime publication ──────────────────────────────────
-- 이미 추가된 테이블이면 에러가 나므로 do 블록으로 안전 처리
do $$
declare
  v_tables text[] := array[
    'chat_messages',
    'chat_read_status',
    'notifications',
    'event_participants',
    'calendar_events',
    'event_card_assignments',
    'event_card_assignment_cards'
  ];
  v_table text;
begin
  foreach v_table in array v_tables loop
    if not exists (
      select 1
      from pg_publication_tables
      where pubname = 'supabase_realtime'
        and schemaname = 'public'
        and tablename = v_table
    ) then
      execute format('alter publication supabase_realtime add table public.%I', v_table);
    end if;
  end loop;
end
$$;

-- ─── 2. 배정 알림 트리거 ──────────────────────────────────────
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
  -- 배정 대상자(user_name) → user_id
  select id into v_recipient_id
  from public.app_users
  where name = new.user_name
    and coalesce(is_active, true) is true
  limit 1;

  if v_recipient_id is null then
    return new;
  end if;

  -- 배정한 사람(assigned_by) → user_id (자기 자신에게 보내지 않기 위해)
  if coalesce(new.assigned_by, '') <> '' then
    select id into v_assigner_id
    from public.app_users
    where name = new.assigned_by
    limit 1;
  end if;

  if v_assigner_id is not null and v_assigner_id = v_recipient_id then
    return new;
  end if;

  -- 일정 정보
  select title, event_date, time
  into v_event_title, v_event_date, v_event_time
  from public.calendar_events
  where id = new.event_id;

  -- 카드 이름
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
  v_link := '/calendar?openChat=' || new.event_id;

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

drop trigger if exists on_event_card_assignment_insert on public.event_card_assignments;
create trigger on_event_card_assignment_insert
after insert on public.event_card_assignments
for each row execute function public.notify_on_card_assignment();

-- ─── 검증 ────────────────────────────────────────────────────
-- 1) Realtime publication 확인:
--    select schemaname, tablename from pg_publication_tables
--    where pubname = 'supabase_realtime' order by tablename;
--
-- 2) 트리거 확인:
--    select tgname, tgrelid::regclass from pg_trigger
--    where tgname = 'on_event_card_assignment_insert';
