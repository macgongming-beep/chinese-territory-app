-- 새 가입 신청을 관리자·개발자가 놓치지 않도록 인앱 알림과 푸시를 보낸다.
-- 기존 pending 행에는 소급 발송하지 않고, 새로 pending 이 된 순간에만 한 번 보낸다.

create or replace function private.notify_admins_on_pending_signup()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_recipients integer[];
  v_body text;
begin
  if new.approval_status is distinct from 'pending'
     or (tg_op = 'UPDATE' and old.approval_status is not distinct from 'pending') then
    return new;
  end if;

  select coalesce(array_agg(u.id order by u.id), '{}'::integer[])
    into v_recipients
  from public.app_users u
  where u.role in ('admin', 'developer')
    and coalesce(u.is_active, true) is true
    and coalesce(u.approval_status, 'approved') = 'approved';

  if cardinality(v_recipients) = 0 then
    return new;
  end if;

  v_body := format('%s님의 가입 신청을 확인해 주세요.', coalesce(nullif(btrim(new.name), ''), '새 사용자'));

  perform public.insert_notifications(
    v_recipients, 'notice', '새 가입 승인 요청', v_body, '/signup-requests', new.id
  );
  perform public.dispatch_push_notification(
    v_recipients, 'notice', '새 가입 승인 요청', v_body, '/signup-requests', new.id
  );

  return new;
end;
$$;

revoke all on function private.notify_admins_on_pending_signup() from public, anon, authenticated;

drop trigger if exists notify_admins_on_pending_signup on public.app_users;
create trigger notify_admins_on_pending_signup
after insert or update of approval_status on public.app_users
for each row execute function private.notify_admins_on_pending_signup();

notify pgrst, 'reload schema';
