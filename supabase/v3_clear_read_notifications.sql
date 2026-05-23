-- 읽은 알림 전체 삭제 RPC
-- 사용자가 자신의 읽음 처리된 알림을 직접 지울 수 있도록 함

create or replace function clear_read_notifications(p_token text)
returns void
language plpgsql
security definer
as $$
declare
  v_user_id int;
begin
  select user_id into v_user_id
  from auth_sessions
  where token = p_token and expires_at > now();

  if v_user_id is null then
    raise exception 'unauthorized';
  end if;

  delete from notifications
  where user_id = v_user_id
    and is_read = true;
end;
$$;
