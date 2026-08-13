-- 읽은 알림 전체 삭제 RPC
-- 다른 알림 RPC 와 동일하게 p_token uuid + verify_session() 패턴 사용

create or replace function public.clear_read_notifications(p_token uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id integer;
begin
  v_user_id := public.verify_session(p_token);

  delete from public.notifications
  where user_id = v_user_id
    and is_read = true;
end;
$$;

grant execute on function public.clear_read_notifications(uuid) to anon, authenticated;
