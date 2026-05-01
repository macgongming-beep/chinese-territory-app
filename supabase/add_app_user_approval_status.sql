alter table public.app_users
add column if not exists approval_status text not null default 'approved';

alter table public.app_users
drop constraint if exists app_users_approval_status_check;

alter table public.app_users
add constraint app_users_approval_status_check
check (approval_status in ('pending', 'approved', 'blocked'));

update public.app_users
set approval_status = 'approved'
where approval_status is null;

grant select (id, login_id, name, role, approval_status, last_login_at, created_at, phone)
on public.app_users to anon, authenticated;

drop function if exists public.auth_login(text, text);

create function public.auth_login(p_login_id text, p_pin text)
returns table (
  id int,
  name text,
  login_id text,
  role text,
  approval_status text
)
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_id int;
  v_name text;
  v_login_id text;
  v_role text;
  v_pin text;
  v_approval_status text;
begin
  select
    u.id,
    u.name,
    coalesce(u.login_id, u.name),
    u.role,
    u.pin,
    coalesce(u.approval_status, 'approved')
  into v_id, v_name, v_login_id, v_role, v_pin, v_approval_status
  from public.app_users u
  where u.login_id = p_login_id
     or (u.login_id is null and u.name = p_login_id)
  limit 1;

  if v_id is null then
    return;
  end if;

  if v_pin is null or v_pin <> extensions.crypt(p_pin, v_pin) then
    return;
  end if;

  if v_approval_status <> 'approved' then
    return query select v_id, v_name, v_login_id, v_role, v_approval_status;
    return;
  end if;

  update public.app_users
  set last_login_at = now()
  where app_users.id = v_id;

  insert into public.login_logs (user_id, logged_in_at)
  values (v_id, now());

  return query select v_id, v_name, v_login_id, v_role, v_approval_status;
end;
$$;

grant execute on function public.auth_login(text, text) to anon, authenticated;
