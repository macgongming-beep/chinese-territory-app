-- 전역 알림 설정 RPC의 NULL 권한 우회를 없애고 실행권한을 복구한다.
-- `NULL NOT IN (...)`은 true가 아니라 NULL이므로 IF가 실행되지 않는다. 직접
-- auth_sessions를 조회하지 말고 공통 verify_session으로 세션을 먼저 확정한다.

create or replace function public.update_daily_service_settings(
  p_token text,
  p_enabled boolean,
  p_send_time text
)
returns table (enabled boolean, send_time text, last_sent text)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_token uuid;
  v_user_id integer;
  v_role text;
  v_time time;
begin
  begin
    v_token := p_token::uuid;
  exception when invalid_text_representation then
    raise exception 'invalid session' using errcode = '42501';
  end;

  v_user_id := public.verify_session(v_token);
  select role into v_role from public.app_users where id = v_user_id;
  if not coalesce(v_role in ('admin', 'developer'), false) then
    raise exception 'permission denied' using errcode = '42501';
  end if;

  begin
    v_time := p_send_time::time;
  exception when invalid_datetime_format or datetime_field_overflow then
    raise exception 'invalid time' using errcode = '22007';
  end;

  insert into public.app_private_settings (key, value)
  values ('daily_service_enabled', case when p_enabled then 'true' else 'false' end)
  on conflict (key) do update set value = excluded.value, updated_at = now();

  insert into public.app_private_settings (key, value)
  values ('daily_service_time', to_char(v_time, 'HH24:MI'))
  on conflict (key) do update set value = excluded.value, updated_at = now();

  return query select * from public.get_daily_service_settings(p_token);
end;
$$;
revoke all on function public.update_daily_service_settings(text, boolean, text) from public, anon, authenticated;
grant execute on function public.update_daily_service_settings(text, boolean, text) to anon, authenticated;

create or replace function public.update_global_push_quiet_settings(
  p_token text,
  p_enabled boolean,
  p_quiet_start text,
  p_quiet_end text
)
returns table (enabled boolean, quiet_start text, quiet_end text)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_token uuid;
  v_user_id integer;
  v_role text;
  v_start time;
  v_end time;
begin
  begin
    v_token := p_token::uuid;
  exception when invalid_text_representation then
    raise exception 'invalid session' using errcode = '42501';
  end;

  v_user_id := public.verify_session(v_token);
  select role into v_role from public.app_users where id = v_user_id;
  if not coalesce(v_role in ('admin', 'developer'), false) then
    raise exception 'permission denied' using errcode = '42501';
  end if;

  begin
    v_start := p_quiet_start::time;
    v_end := p_quiet_end::time;
  exception when invalid_datetime_format or datetime_field_overflow then
    raise exception 'invalid quiet hour time' using errcode = '22007';
  end;

  insert into public.app_private_settings (key, value, updated_at)
  values
    ('global_push_quiet_enabled', case when p_enabled then 'true' else 'false' end, now()),
    ('global_push_quiet_start', to_char(v_start, 'HH24:MI'), now()),
    ('global_push_quiet_end', to_char(v_end, 'HH24:MI'), now())
  on conflict (key) do update
    set value = excluded.value,
        updated_at = now();

  return query
  select p_enabled, to_char(v_start, 'HH24:MI'), to_char(v_end, 'HH24:MI');
end;
$$;
revoke all on function public.update_global_push_quiet_settings(text, boolean, text, text) from public, anon, authenticated;
grant execute on function public.update_global_push_quiet_settings(text, boolean, text, text) to anon, authenticated;

notify pgrst, 'reload schema';
