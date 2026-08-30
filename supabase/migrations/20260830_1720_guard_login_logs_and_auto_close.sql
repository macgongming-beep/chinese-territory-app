-- 클라이언트에만 있던 로그인 기록 권한과 무검사 자동 종료 RPC를 서버에서 막는다.

create or replace function public.get_login_logs(
  p_user_id integer,
  p_since timestamptz default null,
  p_limit integer default 50
)
returns table (id bigint, logged_in_at timestamptz)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor_id integer;
  v_actor_role text;
begin
  v_actor_id := private.request_session_user_id();
  if v_actor_id is null then
    raise exception '유효한 세션이 필요합니다' using errcode = '42501';
  end if;

  v_actor_role := private.request_session_role();
  if p_user_id is distinct from v_actor_id
     and v_actor_role is distinct from 'developer' then
    raise exception '다른 사용자의 로그인 기록을 볼 권한이 없습니다' using errcode = '42501';
  end if;

  return query
  select l.id, l.logged_in_at
  from public.login_logs l
  where l.user_id = p_user_id
    and (p_since is null or l.logged_in_at >= p_since)
  order by l.logged_in_at desc
  limit least(greatest(coalesce(p_limit, 50), 1), 200);
end;
$$;
revoke all on function public.get_login_logs(integer, timestamptz, integer) from public, anon, authenticated;
grant execute on function public.get_login_logs(integer, timestamptz, integer) to anon, authenticated;

create or replace function public.auto_close_stale_sessions()
returns json
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor_id integer;
  v_4h_closed integer := 0;
  v_next_closed integer := 0;
begin
  -- 이 함수는 모든 앱 사용자가 fetchAll 때 호출한다. 관리자 전용은 아니지만,
  -- 익명 호출이 전체 봉사 세션을 갱신하게 둘 이유도 없다.
  v_actor_id := private.request_session_user_id();
  if v_actor_id is null then
    raise exception '유효한 세션이 필요합니다' using errcode = '42501';
  end if;

  with closed as (
    update public.service_sessions
    set ended_at = started_at + interval '4 hours',
        status = 'ended'
    where status = 'active'
      and ended_at is null
      and started_at + interval '4 hours' < now()
    returning id
  )
  select count(*) into v_4h_closed from closed;

  with next_starts as (
    select
      s.id as session_id,
      (
        select min(
          (ce.event_date::text || ' ' || coalesce(nullif(ce.time, ''), '09:00'))::timestamp
          at time zone 'Asia/Seoul'
        )
        from public.calendar_events ce
        where ce.event_date = s.service_date
          and (
            (ce.event_date::text || ' ' || coalesce(nullif(ce.time, ''), '09:00'))::timestamp
            at time zone 'Asia/Seoul'
          ) > s.started_at
          and (
            (ce.event_date::text || ' ' || coalesce(nullif(ce.time, ''), '09:00'))::timestamp
            at time zone 'Asia/Seoul'
          ) <= now()
      ) as next_start
    from public.service_sessions s
    where s.status = 'active'
      and s.ended_at is null
  ),
  closed as (
    update public.service_sessions
    set ended_at = next_starts.next_start,
        status = 'ended'
    from next_starts
    where service_sessions.id = next_starts.session_id
      and next_starts.next_start is not null
    returning service_sessions.id
  )
  select count(*) into v_next_closed from closed;

  return json_build_object(
    'closed_4h', v_4h_closed,
    'closed_by_next', v_next_closed
  );
end;
$$;
revoke all on function public.auto_close_stale_sessions() from public, anon, authenticated;
grant execute on function public.auto_close_stale_sessions() to anon, authenticated;

notify pgrst, 'reload schema';
