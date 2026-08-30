-- 2026-08-30 관리자 관리 함수 보강 결과를 읽기 전용으로 확인한다.
-- 파괴적 함수는 호출하지 않는다. 한 행이라도 나오면 적용이 덜 된 것이다.

with expected(signature, anon_execute) as (
  values
    ('public.cleanup_old_data()', true),
    ('public.manual_reset_met_units()', true),
    ('public.delete_old_visit_histories(text)', true),
    ('public.count_old_visit_histories(text)', true),
    ('public.auto_reset_met_units()', false),
    ('public.update_daily_service_settings(text,boolean,text)', true),
    ('public.update_global_push_quiet_settings(text,boolean,text,text)', true),
    ('public.get_login_logs(integer,timestamp with time zone,integer)', true),
    ('public.auto_close_stale_sessions()', true),
    ('private.cleanup_old_data_core()', false)
), mismatches as (
  select
    signature,
    anon_execute as expected_anon_execute,
    has_function_privilege('anon', signature, 'execute') as actual_anon_execute
  from expected
)
select *
from mismatches
where actual_anon_execute is distinct from expected_anon_execute;

-- SECURITY DEFINER 함수가 PUBLIC 기본 실행권한을 다시 얻지 않았는지 확인한다.
select n.nspname as schema_name, p.proname, pg_get_function_identity_arguments(p.oid) as args
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname in ('public', 'private')
  and p.prosecdef
  and p.proname in (
    'cleanup_old_data_core',
    'cleanup_old_data',
    'manual_reset_met_units',
    'delete_old_visit_histories',
    'count_old_visit_histories',
    'auto_reset_met_units',
    'update_daily_service_settings',
    'update_global_push_quiet_settings',
    'get_login_logs',
    'auto_close_stale_sessions'
  )
  and exists (
    select 1
    from aclexplode(coalesce(p.proacl, acldefault('f', p.proowner))) acl
    where acl.grantee = 0
      and acl.privilege_type = 'EXECUTE'
  );

-- cron은 외부 wrapper가 아니라 비공개 core를, core 소유자 역할로 호출해야 한다.
select j.jobid, j.jobname, j.username, j.command,
       pg_get_userbyid(p.proowner) as expected_username
from cron.job j
join pg_proc p on p.proname = 'cleanup_old_data_core' and p.pronargs = 0
join pg_namespace n on n.oid = p.pronamespace and n.nspname = 'private'
where j.jobname = 'cleanup-old-data'
  and (
    j.username is distinct from pg_get_userbyid(p.proowner)
    or lower(regexp_replace(j.command, '[[:space:];]+', '', 'g'))
       <> 'selectprivate.cleanup_old_data_core()'
  );

select j.jobid, j.jobname, j.username, j.command,
       pg_get_userbyid(p.proowner) as expected_username
from cron.job j
join pg_proc p on p.proname = 'auto_reset_met_units' and p.pronargs = 0
join pg_namespace n on n.oid = p.pronamespace and n.nspname = 'public'
where j.jobname = 'auto-reset-met-units'
  and (
    j.username is distinct from pg_get_userbyid(p.proowner)
    or lower(regexp_replace(j.command, '[[:space:];]+', '', 'g'))
       not in ('selectauto_reset_met_units()', 'selectpublic.auto_reset_met_units()')
  );
