-- =============================================================
-- v1+ 시스템 채팅 메시지의 알림·안 읽음 카운트 제외 패치
-- 작성일: 2026-05-29
--
-- 목적:
--   "OOO님이 배정되었습니다" 같은 system 타입 채팅 메시지가
--   알림(insert_notifications + dispatch_push_notification) 및
--   안 읽음 카운트에 잡히지 않도록 제외.
--
-- 영향:
--   - 채팅방 안에는 여전히 회색 시스템 메시지로 보임
--   - 종 알림 + 채팅 빨간 숫자 뱃지에는 안 잡힘
--   - 핸드폰 푸시도 안 감
--
-- 적용:
--   Supabase SQL Editor에서 통째로 실행
-- =============================================================

-- ─── 1. 채팅 알림 트리거: system 메시지 스킵 ───────────────
create or replace function public.notify_on_chat_message()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
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

    select u.id as recipient_id
    from public.calendar_events ce
    join public.app_users u on u.name = ce.leader_name
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
$$;

-- ─── 2. 안 읽음 카운트용 메타 RPC: system 메시지 제외 ─────
drop function if exists public.get_chat_message_meta(uuid, integer[]);
create function public.get_chat_message_meta(
  p_token uuid,
  p_event_ids integer[]
)
returns table (
  event_id integer,
  created_at timestamptz,
  author_id integer
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id integer;
begin
  v_user_id := public.verify_session(p_token);

  if coalesce(array_length(p_event_ids, 1), 0) = 0 then
    return;
  end if;

  return query
  select
    cm.event_id,
    cm.created_at,
    cm.author_id
  from public.chat_messages cm
  where cm.event_id = any(p_event_ids)
    and cm.deleted_at is null
    and cm.message_type != 'system'  -- ★ 시스템 메시지 안 읽음 카운트에서 제외
    and public.can_access_chat_event(v_user_id, cm.event_id)
  order by cm.created_at desc
  limit 1000;
end;
$$;

grant execute on function public.get_chat_message_meta(uuid, integer[]) to anon, authenticated;

-- ─── 검증 ────────────────────────────────────────────────
-- 1) 시스템 메시지를 직접 chat_messages에 INSERT 했을 때 notifications에
--    행이 추가되지 않는지 확인:
--    select * from public.notifications order by id desc limit 5;
--
-- 2) get_chat_message_meta 호출 결과에서 message_type='system'인 메시지가
--    제외되는지 확인.
