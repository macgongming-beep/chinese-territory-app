-- =============================================================
-- v1+ 모든 채팅방 읽음 처리 RPC
-- 작성일: 2026-05-29
--
-- 목적:
--   채팅 패널에서 "모두 읽음" 한 번 누르면 본인이 참여한 모든
--   채팅방의 last_read_at을 now()로 갱신.
--
-- 사용:
--   클라이언트가 본인이 참여중인 event_ids 배열을 넘김.
--
-- 적용:
--   Supabase SQL Editor에서 통째로 실행.
-- =============================================================

create or replace function public.mark_all_chats_read(
  p_token uuid,
  p_event_ids integer[]
)
returns void
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

  insert into public.chat_read_status (event_id, user_id, last_read_at)
  select event_id, v_user_id, now()
  from unnest(p_event_ids) as t(event_id)
  on conflict (event_id, user_id) do update
    set last_read_at = now();
end;
$$;

grant execute on function public.mark_all_chats_read(uuid, integer[]) to anon, authenticated;
