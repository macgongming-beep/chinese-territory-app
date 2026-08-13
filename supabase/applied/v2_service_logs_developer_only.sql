-- ============================================================
-- 봉사 로그 (service_logs) 정리 패치
--
-- 1. get_service_logs RPC: developer 전용으로 축소
-- 2. 90일 보관 정책: cleanup_old_service_logs() 함수
-- 3. pg_cron 으로 매일 새벽 03:00 KST (= 18:00 UTC) 자동 실행
--    pg_cron 이 없으면 수동으로 select cleanup_old_service_logs(); 호출
-- ============================================================

-- ─── 1) get_service_logs: developer 전용 ───────────────────
create or replace function public.get_service_logs(
  p_token uuid,
  p_filter_event_id integer default null,
  p_filter_card_id integer default null,
  p_limit integer default 100
)
returns setof public.service_logs
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id integer;
  v_role text;
begin
  v_user_id := public.verify_session(p_token);

  select role
  into v_role
  from public.app_users
  where id = v_user_id;

  if v_role <> 'developer' then
    raise exception '권한 없음 (developer 전용)';
  end if;

  return query
  select sl.*
  from public.service_logs sl
  where (p_filter_event_id is null or sl.event_id = p_filter_event_id)
    and (p_filter_card_id is null or sl.card_id = p_filter_card_id)
  order by sl.created_at desc
  limit greatest(1, least(coalesce(p_limit, 100), 500));
end;
$$;

grant execute on function public.get_service_logs(uuid, integer, integer, integer) to anon, authenticated;

-- ─── 2) 90일 보관 정책 ─────────────────────────────────────
create or replace function public.cleanup_old_service_logs()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_deleted integer;
begin
  delete from public.service_logs
  where created_at < now() - interval '90 days';

  get diagnostics v_deleted = row_count;
  return v_deleted;
end;
$$;

-- 일반 클라이언트에서는 호출할 일 없음 (cron 또는 개발자 수동 실행)
revoke execute on function public.cleanup_old_service_logs() from anon, authenticated;

-- ─── 3) pg_cron 스케줄링 (확장 활성화돼 있어야 함) ─────────
-- Supabase Dashboard > Database > Extensions 에서 pg_cron 활성화 후 실행
do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    -- 기존 동일 잡 제거
    perform cron.unschedule(jobid)
    from cron.job
    where jobname = 'cleanup_service_logs_daily';

    -- 매일 18:00 UTC (KST 03:00) 실행
    perform cron.schedule(
      'cleanup_service_logs_daily',
      '0 18 * * *',
      $cron$ select public.cleanup_old_service_logs(); $cron$
    );
  else
    raise notice 'pg_cron 확장이 없어 자동 정리는 비활성화됨. 수동으로 select cleanup_old_service_logs(); 호출 필요';
  end if;
end
$$;
