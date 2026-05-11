-- ============================================================
-- V1+ Day 20~21 permission close-out patch
--
-- Apply after:
--   v1plus_schema.sql
--   v1plus_rpc.sql
--   v1plus_security_patch.sql
--
-- Includes:
--   1. delete_chat_message RPC
--      - author: only within 5 minutes
--      - leader/admin/developer: moderation delete
--      - locked rooms: no new normal author delete, moderator still allowed
-- ============================================================

create or replace function public.delete_chat_message(
  p_token uuid,
  p_message_id bigint
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor_id integer;
  v_actor_role text;
  v_message public.chat_messages%rowtype;
  v_is_moderator boolean;
begin
  v_actor_id := public.verify_session(p_token);

  select role
  into v_actor_role
  from public.app_users
  where id = v_actor_id;

  select *
  into v_message
  from public.chat_messages
  where id = p_message_id
    and deleted_at is null;

  if not found then
    raise exception '메시지를 찾을 수 없습니다';
  end if;

  v_is_moderator := v_actor_role in ('leader', 'admin', 'developer');

  if not v_is_moderator then
    if v_message.author_id is distinct from v_actor_id then
      raise exception '본인 메시지만 삭제할 수 있습니다';
    end if;

    if v_message.created_at < now() - interval '5 minutes' then
      raise exception '메시지는 작성 후 5분 안에만 삭제할 수 있습니다';
    end if;

    if public.is_chat_locked(v_message.event_id) then
      raise exception '잠긴 채팅방에서는 메시지를 삭제할 수 없습니다';
    end if;
  end if;

  update public.chat_messages
  set deleted_at = now()
  where id = p_message_id;

  begin
    perform public.log_service_action(
      p_token,
      null,
      v_message.event_id,
      null,
      'message_deleted',
      'chat_message',
      p_message_id::integer,
      jsonb_build_object(
        'author_id', v_message.author_id,
        'author_name', v_message.author_name,
        'moderated', v_is_moderator
      )
    );
  exception
    when others then
      raise notice 'message deletion log skipped: %', sqlerrm;
  end;
end;
$$;

grant execute on function public.delete_chat_message(uuid, bigint) to anon, authenticated;
