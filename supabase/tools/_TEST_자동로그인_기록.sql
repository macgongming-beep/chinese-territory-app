-- 자동 로그인 기록이 하루 한 번만 남는지 확인. **전부 롤백한다.**
do $$
declare
  v_user int;
  v_before int; v_after1 int; v_after2 int;
begin
  select id into v_user from public.app_users order by id limit 1;
  select count(*) into v_before from public.login_logs where user_id = v_user;

  perform public.auth_record_auto_login(v_user, 'probe', 'probe');
  select count(*) into v_after1 from public.login_logs where user_id = v_user;

  perform public.auth_record_auto_login(v_user, 'probe', 'probe');
  select count(*) into v_after2 from public.login_logs where user_id = v_user;

  raise notice '  기록 수: 처음 % → 한 번 부른 뒤 % → 두 번 부른 뒤 %', v_before, v_after1, v_after2;

  if v_after1 = v_after2 then
    raise notice '  ✅ 두 번 불러도 하루 한 번만 남는다';
  else
    raise exception '❌ 부를 때마다 쌓인다 (% → %)', v_after1, v_after2;
  end if;

  if v_after1 > v_before then
    raise notice '  ✅ 오늘 기록이 없으면 남긴다';
  else
    raise notice '  (오늘 이미 기록이 있어 안 늘었다 — 그것도 맞는 동작)';
  end if;
end $$;
