-- ⚠ **테스트 DB 에서만.** (확인: select count(*) from app_users; → 운영 62 · 테스트 1~2)
--
-- 무엇을 판가름하는가:
--   RLS 정책 식은 **요청 역할(anon)의 권한**으로 함수를 호출하는가?
--   `security definer` 는 함수에 **들어간 다음부터** 소유자 권한이다.
--   → 그렇다면 `revoke all` 한 private helper 를 정책이 부를 때 anon 은 문 앞에서 막힌다.
--
--   ⚠ 그래도 앱이 '백지' 가 되지는 않는다. 최종 전환 SQL 은 SELECT 정책에서
--     helper 를 부르지 않으므로 **조회는 살고 모든 쓰기가 실패**한다. 양상이 다르다.
--
-- 세 가지를 본다 (한둘만 보면 절반만 증명한다):
--   1  revoke 상태  → 거부되어야 한다
--   2  grant 뒤     → 되어야 한다. 단 **schema USAGE 는 회수한 채로**
--   3  anon 이 helper 를 **직접** 부르는 것 → 여전히 막혀야 한다
--
-- ⚠ 전부 **한 DO 블록** 안에서 한다. 문장 사이에 표를 만들어 결과를 주고받으려다
--   세 번 헛돌았다 (임시 스키마 이름·별칭·가시성). 변수만 쓰면 그 문제가 없다.
--
-- 아무것도 안 남긴다 (마지막에 되돌린다).

do $$
declare
  ok1 boolean; det1 text;
  ok2 boolean; det2 text;
  ok3 boolean; det3 text;
  n int; b boolean; bad text := '';
begin
  -- ── 준비 ──
  execute 'drop table if exists public._probe_rls cascade';
  execute 'create table public._probe_rls (id int primary key, v text)';
  execute 'insert into public._probe_rls values (1, ''x'')';
  execute 'alter table public._probe_rls enable row level security';
  execute 'create or replace function private._probe_helper() returns boolean '
       || 'language sql stable security definer set search_path = public as $f$ select true $f$';
  execute 'create policy _probe_select on public._probe_rls for select to anon '
       || 'using ((select private._probe_helper()))';
  execute 'grant select on public._probe_rls to anon';
  -- schema USAGE 는 **끝까지 회수한 채로 둔다** (2가 이것 없이 되는지가 핵심)
  execute 'revoke usage on schema private from public, anon, authenticated';

  -- ── 1  revoke 상태 → 거부되어야 한다 ──
  execute 'revoke all on function private._probe_helper() from public, anon, authenticated';
  begin
    set local role anon;
    select count(*) into n from public._probe_rls;
    reset role;
    ok1 := false; det1 := format('거부 안 됨. 행 %s 을 읽었다', n);
  exception when insufficient_privilege then
    reset role;
    ok1 := true; det1 := sqlerrm;
  end;

  -- ── 2  grant 뒤 → 되어야 한다 (schema USAGE 는 여전히 없음) ──
  execute 'grant execute on function private._probe_helper() to anon';
  begin
    set local role anon;
    select count(*) into n from public._probe_rls;
    reset role;
    ok2 := (n = 1); det2 := format('행 %s', n);
  exception when others then
    reset role;
    ok2 := false; det2 := format('%s / %s', sqlstate, sqlerrm);
  end;

  -- ── 3  anon 이 직접 부르는 것 → 막혀야 한다 (USAGE 가 없으니) ──
  begin
    set local role anon;
    select private._probe_helper() into b;
    reset role;
    ok3 := false; det3 := 'anon 이 직접 부를 수 있다 — private 이 밖으로 열려 있다';
  exception when others then
    reset role;
    ok3 := true; det3 := sqlstate;
  end;

  -- ── 뒷정리 ──
  execute 'drop table if exists public._probe_rls cascade';
  execute 'drop function if exists private._probe_helper()';

  -- ── 판정 ──
  raise notice '  % 1_revoke_거부      %', case when ok1 then '✅' else '❌' end, det1;
  raise notice '  % 2_grant_성공       %', case when ok2 then '✅' else '❌' end, det2;
  raise notice '  % 3_직접호출_거부    %', case when ok3 then '✅' else '❌' end, det3;

  if not ok1 then bad := bad || '1 '; end if;
  if not ok2 then bad := bad || '2 '; end if;
  if not ok3 then bad := bad || '3 '; end if;

  if bad = '' then
    raise notice '───────────────────────────────────────────────────────────';
    raise notice '✅ 판정: 함수 grant 만으로 된다. schema USAGE 는 필요 없다.';
    raise notice '   최종 전환 SQL 의 grant 두 줄이 맞다:';
    raise notice '     grant execute on function private.request_session_user_id() to anon, authenticated;';
    raise notice '     grant execute on function private.request_is_admin()        to anon, authenticated;';
    raise notice '───────────────────────────────────────────────────────────';
  else
    -- ⚠ 던진다. NOTICE 만 찍으면 사람이 안 읽고 넘어간다.
    raise exception E'예상 밖: % 이(가) 실패\n'
      '  1 이 실패 → 정책이 **소유자 권한**으로 돈다. grant 불필요 — 설계를 다시 본다\n'
      '  2 가 실패 → 함수 grant 만으로는 부족. schema USAGE 도 필요 = private 을 여는 셈\n'
      '  3 이 실패 → private 이 밖으로 열려 있다', bad;
  end if;
end $$;
