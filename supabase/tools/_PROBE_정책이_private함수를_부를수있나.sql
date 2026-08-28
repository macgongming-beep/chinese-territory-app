-- ⚠ **테스트 DB 에서만.** (확인: select count(*) from app_users; → 운영 62 · 테스트 1~2)
--
-- 무엇을 판가름하는가:
--   RLS 정책 식은 **요청 역할(anon)의 권한**으로 함수를 호출한다.
--   `security definer` 는 함수에 **들어간 다음부터** 소유자 권한이다.
--   → 그러니 `revoke all` 한 helper 를 정책이 부르면 anon 은 문 앞에서 막힌다.
--
--   ⚠ 이 경우 앱이 '백지' 가 되지는 않는다. 최종 전환 SQL 은 SELECT 정책에서
--     helper 를 부르지 않으므로 **조회는 살고 모든 쓰기가 실패**한다. 양상이 다르다.
--
-- 두 단계를 **모두** 본다 (한쪽만 보면 절반만 증명한다):
--   1단계 revoke 상태  → 실패해야 한다
--   2단계 grant 뒤     → 성공해야 한다. 단 **schema USAGE 는 회수한 채로.**
--                        (USAGE 까지 필요하면 얘기가 달라진다)
--
-- 전부 롤백한다. 아무것도 안 남는다.

begin;

create table if not exists public._probe_rls (id int primary key, v text);
insert into public._probe_rls values (1, 'x') on conflict do nothing;
alter table public._probe_rls enable row level security;

create or replace function private._probe_helper() returns boolean
language sql stable security definer set search_path = public as $$ select true $$;

create policy _probe_select on public._probe_rls
  for select to anon using ((select private._probe_helper()));
grant select on public._probe_rls to anon;

-- schema USAGE 는 **끝까지 회수한 채로 둔다** (2단계가 이것 없이 되는지가 핵심)
revoke usage on schema private from public, anon, authenticated;

-- ⚠ NOTICE 로만 찍지 않는다. 사람이 안 읽으면 조용히 넘어간다.
--   결과를 모아 두고 **예상 밖이면 예외를 던진다.** 통과는 한 가지 모양뿐이다.

create temp table _probe_result (step text primary key, ok boolean, detail text);

-- ⚠ 검사는 `set local role anon` 상태에서 돈다. 그때 결과를 적으려면 anon 이
--   이 임시표에 쓸 수 있어야 한다. 없으면 **검사가 아니라 기록이 실패해서**
--   진짜 결과를 못 본다 (첫 실행에서 그랬다).
--   임시표라 rollback 과 함께 사라진다.
grant usage on schema pg_temp to anon;
grant insert on _probe_result to anon;

-- ═══ 1단계 — revoke 상태. **거부되어야 한다** ═══
revoke all on function private._probe_helper() from public, anon, authenticated;
set local role anon;
do $$
declare n int;
begin
  select count(*) into n from public._probe_rls;
  insert into _probe_result values ('1_revoke_거부', false, format('거부 안 됨. 행 %s 을 읽었다', n));
exception when insufficient_privilege then
  insert into _probe_result values ('1_revoke_거부', true, sqlerrm);
end $$;
reset role;

-- ═══ 2단계 — grant 뒤. **되어야 한다.** schema USAGE 는 여전히 없다 ═══
grant execute on function private._probe_helper() to anon;
set local role anon;
do $$
declare n int;
begin
  select count(*) into n from public._probe_rls;
  insert into _probe_result values ('2_grant_성공', n = 1, format('행 %s', n));
exception when others then
  insert into _probe_result values ('2_grant_성공', false, format('%s / %s', sqlstate, sqlerrm));
end $$;
reset role;

-- ═══ 3단계 — anon 이 helper 를 **직접** 부르지는 못해야 한다 (USAGE 없음) ═══
set local role anon;
do $$
declare b boolean;
begin
  select private._probe_helper() into b;
  insert into _probe_result values ('3_직접호출_거부', false, 'anon 이 직접 부를 수 있다 — private 이 열려 있다');
exception when others then
  insert into _probe_result values ('3_직접호출_거부', true, sqlstate);
end $$;
reset role;

-- ═══ 판정 — 예상 밖이면 던진다 ═══
do $$
declare
  v_bad text;
  r record;
begin
  for r in select * from _probe_result order by step loop
    raise notice '  % %  %', case when r.ok then '✅' else '❌' end, rpad(r.step, 18), r.detail;
  end loop;

  select string_agg(step, ', ' order by step) into v_bad from _probe_result where not ok;

  if (select count(*) from _probe_result) <> 3 then
    raise exception '세 단계가 다 안 돌았다 — 앞 단계가 트랜잭션을 깼을 수 있다';
  end if;

  if v_bad is null then
    raise notice '───────────────────────────────────────────────────────────';
    raise notice '✅ 판정: 함수 grant 만으로 된다. schema USAGE 는 필요 없다.';
    raise notice '   최종 전환 SQL 의 grant 두 줄이 맞다.';
    raise notice '───────────────────────────────────────────────────────────';
  else
    raise exception E'예상 밖: %\n  1 이 실패 → 정책이 소유자 권한으로 돈다 (grant 불필요, 설계 재검토)\n  2 가 실패 → 함수 grant 만으로는 부족. schema USAGE 도 필요 → private 을 여는 셈\n  3 이 실패 → private 이 밖으로 열려 있다', v_bad;
  end if;
end $$;

rollback;
