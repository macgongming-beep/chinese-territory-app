-- Global push quiet hours
-- Run in Supabase SQL Editor after deploys that add the UI.
-- Push notifications are skipped during this window, but in-app notifications remain.

create table if not exists public.app_private_settings (
  key text primary key,
  value text not null,
  updated_at timestamptz not null default now()
);

alter table public.app_private_settings enable row level security;
revoke all on public.app_private_settings from anon, authenticated;

insert into public.app_private_settings (key, value)
values
  ('global_push_quiet_enabled', 'false'),
  ('global_push_quiet_start', '22:00'),
  ('global_push_quiet_end', '07:00')
on conflict (key) do nothing;

create or replace function public.get_global_push_quiet_settings(p_token text)
returns table (
  enabled boolean,
  quiet_start text,
  quiet_end text
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_role text;
begin
  select u.role
    into v_role
  from public.auth_sessions s
  join public.app_users u on u.id = s.user_id
  where s.token = p_token
    and (s.expires_at is null or s.expires_at > now())
    and coalesce(u.is_active, true) = true
  limit 1;

  if v_role not in ('admin', 'developer') then
    raise exception 'permission denied';
  end if;

  return query
  select
    coalesce((select aps.value = 'true' from public.app_private_settings aps where aps.key = 'global_push_quiet_enabled'), false) as enabled,
    coalesce((select aps.value from public.app_private_settings aps where aps.key = 'global_push_quiet_start'), '22:00') as quiet_start,
    coalesce((select aps.value from public.app_private_settings aps where aps.key = 'global_push_quiet_end'), '07:00') as quiet_end;
end;
$$;

create or replace function public.update_global_push_quiet_settings(
  p_token text,
  p_enabled boolean,
  p_quiet_start text,
  p_quiet_end text
)
returns table (
  enabled boolean,
  quiet_start text,
  quiet_end text
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_role text;
  v_start time;
  v_end time;
begin
  select u.role
    into v_role
  from public.auth_sessions s
  join public.app_users u on u.id = s.user_id
  where s.token = p_token
    and (s.expires_at is null or s.expires_at > now())
    and coalesce(u.is_active, true) = true
  limit 1;

  if v_role not in ('admin', 'developer') then
    raise exception 'permission denied';
  end if;

  begin
    v_start := p_quiet_start::time;
    v_end := p_quiet_end::time;
  exception when others then
    raise exception 'invalid quiet hour time';
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
  select
    p_enabled as enabled,
    to_char(v_start, 'HH24:MI') as quiet_start,
    to_char(v_end, 'HH24:MI') as quiet_end;
end;
$$;

grant execute on function public.get_global_push_quiet_settings(text) to anon, authenticated;
grant execute on function public.update_global_push_quiet_settings(text, boolean, text, text) to anon, authenticated;
