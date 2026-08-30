-- 긴급 개방(`EMERGENCY_open_*`)을 걷어내 **다시 잠근다.**
--
-- ⚠ **돌리기 전 조건** — 이걸 안 보고 들어가서 2026-08-30 봉사가 깨졌다:
--   토큰 없이 로그인 상태로 남아 있던 사람이 62명 중 38명이었다.
--   지금은 앱이 토큰 없으면 로그인시키지만, **그 새 앱을 받은 뒤**여야 한다.
--
--   아래를 먼저 보고, 두 숫자가 가깝지 않으면 **돌리지 말 것.**
--   ⚠ 그래도 이 숫자는 '기기에 토큰이 저장돼 있다' 는 증거가 아니다.
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
declare r record; n int := 0;
begin
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

  -- 세션 관문이 살아 있어야 한다 (이게 없으면 그냥 열린 채가 된다)
  if (select count(*) from pg_policies
      where schemaname='public' and policyname like 'TEMP\_session\_gate\_%') < 80 then
    raise exception '세션 관문이 모자란다 — 이대로 지우면 쓰기가 통째로 열린다';
  end if;

  raise notice '✅ 다시 잠겼다';
end $$;

notify pgrst, 'reload schema';
