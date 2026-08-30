-- 긴급 개방(`EMERGENCY_open_*`)을 걷어내 **다시 잠근다.**
--
-- ⚠ **돌리기 전 조건** — 이걸 안 보고 들어가서 2026-08-30 봉사가 깨졌다:
--   토큰 없이 로그인 상태로 남아 있던 사람이 62명 중 38명이었다.
--   지금은 앱이 토큰 없으면 로그인시키지만, **그 새 앱을 받은 뒤**여야 한다.
--
--   모든 계정이 미리 로그인할 필요는 없다. 새 앱은 만료 토큰을 발견하면 재로그인시킨다.
--   다만 다음 봉사의 핵심 사용자로 그 흐름을 확인하고, 봉사 없는 시간에 적용한다.
--   ⚠ 토큰 수는 '기기에 토큰이 저장돼 있다' 는 증거가 아니다.
--     버려진 세션·다른 기기 세션도 세어진다. 참고값으로만 본다.

select (select count(*) from public.app_users
          where coalesce(is_active, true) and coalesce(approval_status,'approved')='approved')
                                                                     as 활성_승인_사용자,
       (select count(distinct user_id) from public.auth_sessions
          where expires_at > now())                                  as 유효토큰_가진사람,
       (select count(*) from public.app_users
          where (last_login_at at time zone 'Asia/Seoul')::date
                >= (now() at time zone 'Asia/Seoul')::date - 3)      as 최근3일_접속;

-- ── 확인했으면 여기부터 ──
do $$
declare
  r record;
  n int := 0;
  v_missing_gate text;
  v_missing_select text;
begin
  -- 운영에서 만든 긴급 복구 정책만 정확히 있어야 한다.
  select count(*) into n from pg_policies
  where schemaname = 'public' and policyname like 'EMERGENCY\_open\_%';
  if n <> 26 then
    raise exception '긴급 개방 정책은 26개여야 합니다 (현재 %개)', n;
  end if;
  if exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'app_users'
      and policyname like 'EMERGENCY\_open\_%'
  ) then
    raise exception 'app_users가 긴급 개방돼 있습니다. 재잠금 전에 원인을 확인하세요';
  end if;

  -- 긴급 정책을 지운 뒤 각 표의 I/U/D를 받을 세션 관문이 실제로 있는지 본다.
  with emergency_tables as (
    select distinct tablename from pg_policies
    where schemaname = 'public' and policyname like 'EMERGENCY\_open\_%'
  ), required as (
    select e.tablename, c.cmd
    from emergency_tables e
    cross join (values ('INSERT'), ('UPDATE'), ('DELETE')) c(cmd)
  )
  select string_agg(format('%s(%s)', q.tablename, q.cmd), ', ' order by q.tablename, q.cmd)
  into v_missing_gate
  from required q
  where not exists (
    select 1 from pg_policies p
    where p.schemaname = 'public'
      and p.tablename = q.tablename
      and p.policyname like 'TEMP\_session\_gate\_%'
      and p.cmd in (q.cmd, 'ALL')
      and ('anon' = any(p.roles) or 'public' = any(p.roles))
      -- 이름만 TEMP인 using(true) 정책을 관문으로 오인하지 않는다.
      -- 이 정규식은 정적 안전망이고, 실제 차단 증명은 HTTP smoke가 맡는다.
      and (coalesce(p.qual, '') || ' ' || coalesce(p.with_check, ''))
          ~* 'request_session_user_id|request_is_admin'
  );
  if v_missing_gate is not null then
    raise exception '재잠금 뒤 쓰기 관문이 없는 조합: %', v_missing_gate;
  end if;

  -- Realtime과 일반 조회가 의존하는 SELECT 정책도 표마다 남아 있어야 한다.
  with emergency_tables as (
    select distinct tablename from pg_policies
    where schemaname = 'public' and policyname like 'EMERGENCY\_open\_%'
  )
  select string_agg(e.tablename, ', ' order by e.tablename)
  into v_missing_select
  from emergency_tables e
  where not exists (
    select 1 from pg_policies p
    where p.schemaname = 'public'
      and p.tablename = e.tablename
      and p.cmd in ('SELECT', 'ALL')
      and ('anon' = any(p.roles) or 'public' = any(p.roles))
      and coalesce(p.qual, '') !~* 'request_session|x-session-token'
  );
  if v_missing_select is not null then
    raise exception '재잠금 뒤 공개 SELECT가 없는 표: %', v_missing_select;
  end if;

  n := 0;
  for r in select tablename, policyname from pg_policies
           where schemaname='public' and policyname like 'EMERGENCY\_open\_%'
  loop
    execute format('drop policy %I on public.%I', r.policyname, r.tablename);
    n := n + 1;
  end loop;
  raise notice '긴급 개방 정책 %개를 지웠다', n;

  -- 남아 있으면 안 된다
  if exists (select 1 from pg_policies
             where schemaname='public' and policyname like 'EMERGENCY\_open\_%') then
    raise exception '아직 남아 있다';
  end if;

  raise notice '✅ 다시 잠겼다';
end $$;

notify pgrst, 'reload schema';
