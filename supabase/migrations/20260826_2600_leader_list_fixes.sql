-- 인도자를 이름 하나처럼 비교하던 곳의 나머지.
--
-- calendar_events.leader_name 은 "가, 나" 쉼표 목록인데
-- `u.name = ce.leader_name` 으로 비교하고 있었다. 인도자가 둘 이상이면
-- 아무하고도 안 맞는다. 우리 일정은 대부분 인도자가 둘 이상이다.
--
-- ① 채팅방 입장 권한 — 인도자가 **자기 일정 채팅방에 못 들어갔다.**
--    (신청도 한 사람은 참가자로 걸려 들어가졌다. 그래서 눈에 안 띄었다)
-- ② 채팅 알림 — 인도자가 채팅 알림을 못 받았다.
--
-- ⚠ 20260826_2500 (user_ids_in_name_list) 이 먼저 올라가 있어야 한다.

CREATE OR REPLACE FUNCTION public.can_access_chat_event(p_user_id integer, p_event_id integer)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_user_name text;
  v_role text;
begin
  select name, role
  into v_user_name, v_role
  from public.app_users
  where id = p_user_id;

  if v_user_name is null then
    return false;
  end if;

  if v_role in ('admin', 'developer') then
    return true;
  end if;

  if exists (
    select 1
    from public.event_participants ep
    where ep.event_id = p_event_id
      and ep.user_name = v_user_name
  ) then
    return true;
  end if;

  if exists (
    select 1
    from public.calendar_events ce
    where ce.id = p_event_id
      -- 인도자는 "가, 나" 쉼표 목록이다. 통짜로 비교하면 인도자가
      -- 둘 이상인 일정은 인도자가 자기 채팅방에 못 들어갔다
      and v_user_name = any (select btrim(v) from unnest(string_to_array(ce.leader_name, ',')) v)
  ) then
    return true;
  end if;

  return false;
end;
$function$;

CREATE OR REPLACE FUNCTION public.notify_on_chat_message()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_recipient_ids integer[];
  v_body text;
  v_link text;
begin
  -- ★ 시스템 메시지는 알림 + 푸시 생성 안 함
  if new.message_type = 'system' then
    return new;
  end if;

  select array_agg(distinct recipient_id)
  into v_recipient_ids
  from (
    select u.id as recipient_id
    from public.event_participants ep
    join public.app_users u on u.name = ep.user_name
    where ep.event_id = new.event_id

    union

    -- 인도자 전원. 예전엔 쉼표 목록을 통짜로 비교해
    -- 인도자가 둘 이상인 일정은 인도자가 채팅 알림을 못 받았다
    select unnest(public.user_ids_in_name_list(ce.leader_name)) as recipient_id
    from public.calendar_events ce
    where ce.id = new.event_id

    union

    select unnest(coalesce(new.mention_ids, '{}'::integer[])) as recipient_id
  ) recipients
  where recipient_id is not null
    and recipient_id is distinct from new.author_id
    and not exists (
      select 1
      from public.chat_room_mutes m
      where m.event_id = new.event_id
        and m.user_id = recipient_id
    );

  if v_recipient_ids is null or cardinality(v_recipient_ids) = 0 then
    return new;
  end if;

  v_body := new.author_name || ': ' || left(coalesce(new.content, '사진 메시지'), 50);
  v_link := '/calendar?openChat=' || new.event_id;

  perform public.insert_notifications(
    v_recipient_ids,
    case when cardinality(coalesce(new.mention_ids, '{}'::integer[])) > 0 then 'mention' else 'chat' end,
    case when cardinality(coalesce(new.mention_ids, '{}'::integer[])) > 0 then '채팅에서 언급됨' else '새 채팅 메시지' end,
    v_body,
    v_link,
    new.id::integer
  );

  perform public.dispatch_push_notification(
    v_recipient_ids,
    case when cardinality(coalesce(new.mention_ids, '{}'::integer[])) > 0 then 'mention' else 'chat' end,
    case when cardinality(coalesce(new.mention_ids, '{}'::integer[])) > 0 then '채팅에서 언급됨' else '새 채팅 메시지' end,
    v_body,
    v_link,
    new.id::integer
  );

  return new;
end;
$function$;
