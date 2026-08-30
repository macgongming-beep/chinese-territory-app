-- 관리자용 파괴적 관리 함수를 다시 열되, HTTP 호출은 서버에서 관리자를 확인한다.
--
-- SECURITY DEFINER 안의 current_user 는 호출자가 아니라 함수 소유자다. 따라서
-- `current_user = 'postgres'` 로 cron 을 구분하면 anon 호출도 통과한다. cron 과
-- 관리자 UI 가 공유하던 cleanup_old_data 는 private core + public wrapper 로 나눈다.

create or replace function private.cleanup_old_data_core()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_enabled boolean;
  v_chat_days integer;
  v_notif_read integer;
  v_notif_max integer;
  v_service_days integer;
  v_login_days integer;
  v_chat_deleted integer := 0;
  v_notif_deleted integer := 0;
  v_service_deleted integer := 0;
  v_login_deleted integer := 0;
begin
  select value = 'true' into v_enabled
  from public.app_settings where key = 'retention_enabled';
  select value::integer into v_chat_days
  from public.app_settings where key = 'retention_chat_days';
  select value::integer into v_notif_read
  from public.app_settings where key = 'retention_notif_read_days';
  select value::integer into v_notif_max
  from public.app_settings where key = 'retention_notif_max_days';
  select value::integer into v_service_days
  from public.app_settings where key = 'retention_service_logs_days';
  select value::integer into v_login_days
  from public.app_settings where key = 'retention_login_logs_days';

  if not coalesce(v_enabled, false) then
    return jsonb_build_object('skipped', true, 'reason', 'retention_disabled');
  end if;

  if coalesce(v_chat_days, 0) > 0 then
    delete from public.chat_messages
    where created_at < now() - (v_chat_days || ' days')::interval;
    get diagnostics v_chat_deleted = row_count;
  end if;

  delete from public.notifications
  where (is_read is true and coalesce(v_notif_read, 0) > 0
         and created_at < now() - (v_notif_read || ' days')::interval)
     or (coalesce(v_notif_max, 0) > 0
         and created_at < now() - (v_notif_max || ' days')::interval);
  get diagnostics v_notif_deleted = row_count;

  if coalesce(v_service_days, 0) > 0 then
    delete from public.service_logs
    where created_at < now() - (v_service_days || ' days')::interval;
    get diagnostics v_service_deleted = row_count;
  end if;

  if coalesce(v_login_days, 0) > 0 then
    delete from public.login_logs
    where logged_in_at < now() - (v_login_days || ' days')::interval;
    get diagnostics v_login_deleted = row_count;
  end if;

  return jsonb_build_object(
    'skipped', false,
    'ran_at', now(),
    'chat_deleted', v_chat_deleted,
    'notifications_deleted', v_notif_deleted,
    'service_logs_deleted', v_service_deleted,
    'login_logs_deleted', v_login_deleted
  );
end;
$$;

revoke all on function private.cleanup_old_data_core() from public, anon, authenticated;

-- 기존 함수는 date 컬럼을 text cutoff와 비교해 실제 경로에서 연산자 오류가 났다.
-- 테스트 DB cron은 설정값이 없어 일찍 반환했기 때문에 성공으로만 보였었다.
create or replace function public.auto_reset_met_units()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_enabled boolean;
  v_days integer;
  v_cutoff date;
begin
  select value = 'true' into v_enabled
  from public.app_settings where key = 'visit_reset_enabled';
  select value::integer into v_days
  from public.app_settings where key = 'visit_reset_days_met';

  if not coalesce(v_enabled, false) or coalesce(v_days, 0) <= 0 then
    return;
  end if;

  v_cutoff := current_date - v_days;
  update public.units u
  set status = '미방문'
  where u.status = '만남'
    and not exists (
      select 1
      from public.visit_histories vh
      where vh.unit_id = u.id
        and vh.result = '만남'
        and vh.visited_at > v_cutoff
    );
end;
$$;
revoke all on function public.auto_reset_met_units() from public, anon, authenticated;

create or replace function public.count_old_visit_histories(cutoff_date text)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_count integer;
  v_cutoff date;
begin
  begin
    v_cutoff := cutoff_date::date;
  exception when invalid_datetime_format or datetime_field_overflow then
    raise exception '올바른 기준 날짜가 아닙니다' using errcode = '22007';
  end;

  select count(*) into v_count
  from public.visit_histories where visited_at < v_cutoff;
  return v_count;
end;
$$;
revoke all on function public.count_old_visit_histories(text) from public, anon, authenticated;
grant execute on function public.count_old_visit_histories(text) to anon, authenticated;

create or replace function public.cleanup_old_data()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not coalesce(private.request_is_admin(), false) then
    raise exception '관리자만 할 수 있습니다' using errcode = '42501';
  end if;
  return private.cleanup_old_data_core();
end;
$$;
revoke all on function public.cleanup_old_data() from public, anon, authenticated;
grant execute on function public.cleanup_old_data() to anon, authenticated;

-- 기존 예약 작업은 공개 wrapper가 아니라 외부에 열리지 않은 core를 호출한다.
-- cron.job의 실제 username은 운영 적용 전에 별도 preflight로 확인한다.
do $$
declare
  v_job record;
  v_core_owner text;
  v_job_count integer;
  v_auto_owner text;
  v_auto_count integer;
begin
  if to_regnamespace('cron') is null then
    raise exception 'pg_cron이 없어 cleanup-old-data 예약 작업을 안전하게 이관할 수 없습니다';
  end if;

  select pg_get_userbyid(p.proowner)
  into v_core_owner
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'private'
    and p.proname = 'cleanup_old_data_core'
    and p.pronargs = 0;

  select count(*) into v_job_count
  from cron.job where jobname = 'cleanup-old-data';
  if v_job_count <> 1 then
    raise exception 'cleanup-old-data cron 작업은 정확히 1개여야 합니다 (현재 %개)', v_job_count;
  end if;

  for v_job in
    select jobid, username from cron.job where jobname = 'cleanup-old-data'
  loop
    if v_job.username is distinct from v_core_owner then
      raise exception
        'cleanup-old-data cron 역할(%)이 core 소유자(%)와 달라 실행권한을 보장할 수 없습니다',
        v_job.username, v_core_owner;
    end if;

    perform cron.alter_job(
      v_job.jobid,
      command := 'select private.cleanup_old_data_core()'
    );
  end loop;

  select pg_get_userbyid(p.proowner)
  into v_auto_owner
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public'
    and p.proname = 'auto_reset_met_units'
    and p.pronargs = 0;

  select count(*) into v_auto_count
  from cron.job where jobname = 'auto-reset-met-units';
  if v_auto_count <> 1 then
    raise exception 'auto-reset-met-units cron 작업은 정확히 1개여야 합니다 (현재 %개)', v_auto_count;
  end if;
  if exists (
    select 1 from cron.job
    where jobname = 'auto-reset-met-units'
      and username is distinct from v_auto_owner
  ) then
    raise exception 'auto-reset-met-units cron 역할과 함수 소유자가 다릅니다';
  end if;
end;
$$;

create or replace function public.manual_reset_met_units()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_count integer;
begin
  if not coalesce(private.request_is_admin(), false) then
    raise exception '관리자만 할 수 있습니다' using errcode = '42501';
  end if;

  update public.units set status = '미방문' where status = '만남';
  get diagnostics v_count = row_count;
  return v_count;
end;
$$;
revoke all on function public.manual_reset_met_units() from public, anon, authenticated;
grant execute on function public.manual_reset_met_units() to anon, authenticated;

create or replace function public.delete_old_visit_histories(cutoff_date text)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_count integer;
  v_affected_ids integer[];
  v_cutoff date;
begin
  if not coalesce(private.request_is_admin(), false) then
    raise exception '관리자만 할 수 있습니다' using errcode = '42501';
  end if;

  begin
    v_cutoff := cutoff_date::date;
  exception when invalid_datetime_format or datetime_field_overflow then
    raise exception '올바른 기준 날짜가 아닙니다' using errcode = '22007';
  end;

  select array_agg(distinct unit_id) into v_affected_ids
  from public.visit_histories where visited_at < v_cutoff;

  delete from public.visit_histories where visited_at < v_cutoff;
  get diagnostics v_count = row_count;

  if v_affected_ids is not null then
    update public.units u
    set status = coalesce(
      (select result from public.visit_histories
       where unit_id = u.id
       order by visited_at desc, created_at desc
       limit 1),
      '미방문'
    )
    where u.id = any(v_affected_ids);
  end if;

  return v_count;
end;
$$;
revoke all on function public.delete_old_visit_histories(text) from public, anon, authenticated;
grant execute on function public.delete_old_visit_histories(text) to anon, authenticated;

-- 실행권한과 함수 형태만 확인한다. 파괴적 함수는 운영 검증에서 직접 호출하지 않는다.
do $$
begin
  if not has_function_privilege('anon', 'public.cleanup_old_data()', 'execute')
     or not has_function_privilege('anon', 'public.manual_reset_met_units()', 'execute')
     or not has_function_privilege('anon', 'public.delete_old_visit_histories(text)', 'execute')
     or not has_function_privilege('anon', 'public.count_old_visit_histories(text)', 'execute') then
    raise exception '관리자 관리 함수 실행권한 복구 실패';
  end if;
  if has_function_privilege('anon', 'private.cleanup_old_data_core()', 'execute')
     or has_function_privilege('anon', 'public.auto_reset_met_units()', 'execute') then
    raise exception '예약 작업 전용 함수가 anon에 노출되었습니다';
  end if;
end;
$$;

notify pgrst, 'reload schema';
