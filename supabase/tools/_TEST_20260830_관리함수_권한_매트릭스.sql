-- 2026-08-30 후속 관리자 함수 권한 매트릭스. **테스트 DB 전용**.
--
-- 파괴적 성공 경로는 일부러 예외를 내 서브트랜잭션을 롤백한다. 권한이 예상보다
-- 넓어도 삭제·초기화가 남지 않는다. 전체 시험도 한 DO 문이라 중간 실패 시 원자적이다.

do $$
declare
  v_env text;
  v_admin_id integer;
  v_developer_id integer;
  v_user_id integer;
  v_admin_token uuid := gen_random_uuid();
  v_developer_token uuid := gen_random_uuid();
  v_user_token uuid := gen_random_uuid();
begin
  select value into v_env
  from public.app_private_settings where key = 'environment';
  if coalesce(v_env, '') <> 'test' then
    raise exception '테스트 표식(environment=test)이 없는 DB입니다';
  end if;

  delete from public.auth_sessions
  where user_id in (select id from public.app_users where login_id like 'guard-mtx-%');
  delete from public.app_users where login_id like 'guard-mtx-%';

  insert into public.app_users (login_id, name, pin, role, approval_status, is_active)
  values ('guard-mtx-admin', '권한시험관리자', '1234', 'admin', 'approved', true)
  returning id into v_admin_id;
  insert into public.app_users (login_id, name, pin, role, approval_status, is_active)
  values ('guard-mtx-developer', '권한시험개발자', '1234', 'developer', 'approved', true)
  returning id into v_developer_id;
  insert into public.app_users (login_id, name, pin, role, approval_status, is_active)
  values ('guard-mtx-user', '권한시험일반', '1234', 'user', 'approved', true)
  returning id into v_user_id;

  insert into public.auth_sessions (token, user_id, expires_at) values
    (v_admin_token, v_admin_id, now() + interval '1 hour'),
    (v_developer_token, v_developer_id, now() + interval '1 hour'),
    (v_user_token, v_user_id, now() + interval '1 hour');

  -- 무헤더와 일반 사용자: 파괴적 관리 함수 셋 모두 42501이어야 한다.
  perform set_config('request.headers', '{}', true);
  perform public.count_old_visit_histories('1900-01-01');
  -- 자동 초기화의 실제 날짜 비교 경로를 태운 뒤 설정·변경을 함께 롤백한다.
  begin
    insert into public.app_settings (key, value) values
      ('visit_reset_enabled', 'true'),
      ('visit_reset_days_met', '90')
    on conflict (key) do update set value = excluded.value;
    perform public.auto_reset_met_units();
    raise exception 'rollback successful cron call' using errcode = 'ZX099';
  exception when sqlstate 'ZX099' then null;
  end;
  begin
    perform public.cleanup_old_data();
    raise exception '무헤더 cleanup_old_data가 통과했습니다' using errcode = 'ZX001';
  exception when insufficient_privilege then null;
            when sqlstate 'ZX001' then raise;
  end;

  perform set_config('request.headers', jsonb_build_object('x-session-token', v_user_token)::text, true);
  begin
    perform public.cleanup_old_data();
    raise exception '일반 사용자 cleanup_old_data가 통과했습니다' using errcode = 'ZX002';
  exception when insufficient_privilege then null;
            when sqlstate 'ZX002' then raise;
  end;
  begin
    perform public.manual_reset_met_units();
    raise exception '일반 사용자 manual_reset_met_units가 통과했습니다' using errcode = 'ZX003';
  exception when insufficient_privilege then null;
            when sqlstate 'ZX003' then raise;
  end;
  begin
    perform public.delete_old_visit_histories('1900-01-01');
    raise exception '일반 사용자 delete_old_visit_histories가 통과했습니다' using errcode = 'ZX004';
  exception when insufficient_privilege then null;
            when sqlstate 'ZX004' then raise;
  end;

  -- 관리자 성공 경로. 성공 직후 ZX099를 내서 함수가 한 변경까지 되돌린다.
  perform set_config('request.headers', jsonb_build_object('x-session-token', v_admin_token)::text, true);
  begin
    perform public.cleanup_old_data();
    raise exception 'rollback successful admin call' using errcode = 'ZX099';
  exception when sqlstate 'ZX099' then null;
  end;
  begin
    perform public.manual_reset_met_units();
    raise exception 'rollback successful admin call' using errcode = 'ZX099';
  exception when sqlstate 'ZX099' then null;
  end;
  begin
    perform public.delete_old_visit_histories('1900-01-01');
    raise exception 'rollback successful admin call' using errcode = 'ZX099';
  exception when sqlstate 'ZX099' then null;
  end;

  -- 전역 설정: 무효·일반 사용자는 거부, 관리자는 성공하되 원복한다.
  begin
    perform public.update_daily_service_settings('not-a-token', true, '09:00');
    raise exception '이상한 토큰이 daily 설정을 바꿨습니다' using errcode = 'ZX005';
  exception when insufficient_privilege then null;
            when sqlstate 'ZX005' then raise;
  end;
  begin
    perform public.update_global_push_quiet_settings(v_user_token::text, true, '22:00', '07:00');
    raise exception '일반 사용자가 quiet 설정을 바꿨습니다' using errcode = 'ZX006';
  exception when insufficient_privilege then null;
            when sqlstate 'ZX006' then raise;
  end;

  begin
    perform public.update_daily_service_settings(v_admin_token::text, false, '08:30');
    perform public.update_global_push_quiet_settings(v_admin_token::text, true, '21:30', '06:30');
    raise exception 'rollback successful admin call' using errcode = 'ZX099';
  exception when sqlstate 'ZX099' then null;
  end;

  -- 로그인 기록: 본인·developer만. admin도 다른 사람 기록은 볼 수 없다.
  perform set_config('request.headers', jsonb_build_object('x-session-token', v_user_token)::text, true);
  perform count(*) from public.get_login_logs(v_user_id, null, 20);
  begin
    perform count(*) from public.get_login_logs(v_admin_id, null, 20);
    raise exception '일반 사용자가 남의 로그인 기록을 봤습니다' using errcode = 'ZX007';
  exception when insufficient_privilege then null;
            when sqlstate 'ZX007' then raise;
  end;

  perform set_config('request.headers', jsonb_build_object('x-session-token', v_admin_token)::text, true);
  begin
    perform count(*) from public.get_login_logs(v_user_id, null, 20);
    raise exception 'admin이 developer 전용 로그인 기록을 봤습니다' using errcode = 'ZX008';
  exception when insufficient_privilege then null;
            when sqlstate 'ZX008' then raise;
  end;

  perform set_config('request.headers', jsonb_build_object('x-session-token', v_developer_token)::text, true);
  perform count(*) from public.get_login_logs(v_user_id, null, 20);

  -- 자동 종료는 무헤더 거부, 로그인 사용자는 성공. 성공 경로 변경은 롤백한다.
  perform set_config('request.headers', '{}', true);
  begin
    perform public.auto_close_stale_sessions();
    raise exception '무헤더 auto_close_stale_sessions가 통과했습니다' using errcode = 'ZX009';
  exception when insufficient_privilege then null;
            when sqlstate 'ZX009' then raise;
  end;

  perform set_config('request.headers', jsonb_build_object('x-session-token', v_user_token)::text, true);
  begin
    perform public.auto_close_stale_sessions();
    raise exception 'rollback successful user call' using errcode = 'ZX099';
  exception when sqlstate 'ZX099' then null;
  end;

  delete from public.auth_sessions where user_id in (v_admin_id, v_developer_id, v_user_id);
  delete from public.app_users where id in (v_admin_id, v_developer_id, v_user_id);
  raise notice '관리 함수 권한 매트릭스 통과';
end
$$;
