-- 로그인 기록은 인증 함수가 쓰고 get_login_logs RPC가 읽는다.
-- 클라이언트가 표를 직접 쓸 이유가 없으므로 RLS와 grant 양쪽에서 차단한다.

alter table public.login_logs enable row level security;

revoke insert, update, delete, truncate on public.login_logs from anon, authenticated;

do $$
begin
  if not (select relrowsecurity from pg_class where oid = 'public.login_logs'::regclass) then
    raise exception 'login_logs RLS가 켜지지 않았습니다';
  end if;

  if has_table_privilege('anon', 'public.login_logs', 'insert')
     or has_table_privilege('anon', 'public.login_logs', 'update')
     or has_table_privilege('anon', 'public.login_logs', 'delete')
     or has_table_privilege('authenticated', 'public.login_logs', 'insert')
     or has_table_privilege('authenticated', 'public.login_logs', 'update')
     or has_table_privilege('authenticated', 'public.login_logs', 'delete') then
    raise exception 'login_logs 직접 쓰기 권한이 남아 있습니다';
  end if;
end $$;

notify pgrst, 'reload schema';
