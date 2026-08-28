-- 읽기만. 전환 SQL 이 **통째로 롤백됐나, 아니면 절반 적용됐나**.
select
  (select count(*) from pg_policies where schemaname='public' and cmd='ALL'
     and tablename not like '\_probe%')                                  as FOR_ALL,
  (select count(*) from pg_policies where schemaname='public'
     and policyname like 'TEMP\_session\_gate\_%')                        as 세션관문,
  (select count(*) from pg_policies where schemaname='public'
     and policyname like '%\_select\_all')                               as SELECT_재현,
  (select count(*) from pg_trigger
     where tgname='app_users_guard_privilege' and not tgisinternal)      as 트리거,
  (select count(*) from information_schema.role_routine_grants
     where grantee='anon' and routine_schema='private')                  as helper_grant;

-- 읽어내는 법:
--   FOR_ALL 28 · 세션관문 0 · SELECT_재현 0 · 트리거 0
--     → ✅ **통째로 롤백됐다.** 트랜잭션이 지켜졌다. 아무것도 안 바뀌었다.
--
--   세션관문이나 SELECT_재현이 0 이 아니면
--     → ⚠ **절반 적용됐다.** begin/commit 이 안 지켜진 것이다.
--        아래로 되돌린 다음, 넣는 방법을 바꿔야 한다 (psql 로 파일 통째로).

-- ── 절반 적용됐을 때만 쓰는 되돌리기 (그때 알려줄 것. 지금은 돌리지 말 것) ──
-- do $$
-- declare r record;
-- begin
--   for r in select tablename, policyname from pg_policies
--            where schemaname='public'
--              and (policyname like 'TEMP\_session\_gate\_%' or policyname like '%\_select\_all')
--   loop
--     execute format('drop policy %I on public.%I', r.policyname, r.tablename);
--   end loop;
--   -- 그다음 baseline.sql 의 열린 정책들을 다시 만들어야 한다 (내가 생성해 줄 것)
-- end $$;
