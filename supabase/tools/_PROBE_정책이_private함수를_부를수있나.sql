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

-- ═══ 1단계 — revoke 상태 ═══
revoke all on function private._probe_helper() from public, anon, authenticated;
set local role anon;
do $$
declare n int;
begin
  select count(*) into n from public._probe_rls;
  raise notice '1단계 [revoke] 성공(행 %) — 예상 밖. 소유자 권한으로 평가된다는 뜻', n;
exception when insufficient_privilege then
  raise notice '1단계 [revoke] 거부 ✅ 예상대로 — 정책은 요청 역할 권한으로 함수를 부른다';
  raise notice '            (%)', sqlerrm;
end $$;
reset role;

-- ═══ 2단계 — grant 뒤. schema USAGE 는 여전히 없음 ═══
grant execute on function private._probe_helper() to anon;
set local role anon;
do $$
declare n int;
begin
  select count(*) into n from public._probe_rls;
  raise notice '2단계 [grant]  성공 ✅ 행 % — **함수 grant 만으로 된다. schema USAGE 불필요**', n;
  raise notice '───────────────────────────────────────────────────────────';
  raise notice '결론: 최종 전환 SQL 에 아래 두 줄을 넣으면 된다';
  raise notice '  grant execute on function private.request_session_user_id() to anon, authenticated;';
  raise notice '  grant execute on function private.request_is_admin()        to anon, authenticated;';
  raise notice '───────────────────────────────────────────────────────────';
exception when insufficient_privilege then
  raise notice '2단계 [grant]  거부 ⚠ **함수 grant 만으로는 부족하다 — schema USAGE 도 필요**', sqlerrm;
  raise notice '  → 그러면 private 스키마를 여는 셈이라 설계를 다시 봐야 한다';
end $$;
reset role;

-- anon 이 함수를 **직접** 부를 수는 없어야 한다 (USAGE 가 없으니)
set local role anon;
do $$
declare b boolean;
begin
  select private._probe_helper() into b;
  raise notice '3단계 [직접호출] 성공 ⚠ anon 이 helper 를 직접 부를 수 있다';
exception when others then
  raise notice '3단계 [직접호출] 거부 ✅ — 정책 안에서만 쓰이고 밖으로는 안 열린다';
end $$;
reset role;

rollback;
