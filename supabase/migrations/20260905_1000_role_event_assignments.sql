-- 봉사 배정(비공식·식당)은 인도자와 관리자가 한다.
--
-- 코드에서 읽은 계약 (src/hooks/storeMutations/v2Assignments.ts, calendar.ts):
--   assignInformalToUser / assignRestaurantToUser        INSERT
--   removeInformalAssignment / removeRestaurantAssignment DELETE
--   removeParticipant (calendar.ts)                       DELETE (참가 취소 뒷정리)
--   UPDATE 하는 화면 경로는 **없다** — 이름 바꾸기 폴백 하나뿐이다
--
-- 화면: /assignment 의 DesktopLeaderAssignment · AssignmentEditor · 모바일
-- AdminMobileCalendar. 인도자가 팀에 나눠 주는 자리라 admin 만으로는 좁다.
--
-- ⚠ 라우터는 탭만 가리고 주소는 막지 않는다 — `user` 가 /assignment 를 직접
--   치면 인도자 화면이 그대로 뜬다. 그래서 여기서 막는 것이 실질적인 문이다.
--
-- ⚠ UPDATE 를 관리자에게만 남긴다. 화면은 안 쓰지만 useAuth 의 이름 바꾸기
--   **클라이언트 폴백**(rename RPC 가 없는 DB 용)이 user_name 을 갱신한다.
--   이름을 바꾸는 사람은 관리자뿐이라 그 경로는 살아 있다.
--   (표만 보고 닫혔다고 하면 안 된다 — RPC 와 폴백 경로까지 세야 한다.)

create or replace function public.session_can_assign_service()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(private.request_session_role() in ('admin', 'developer', 'leader'), false)
$$;
revoke all on function public.session_can_assign_service() from public;
grant execute on function public.session_can_assign_service() to anon, authenticated;

do $$
declare
  v_table text;
begin
  foreach v_table in array array['event_informal_assignments', 'event_restaurant_assignments'] loop
    execute format('alter table public.%I enable row level security', v_table);
    execute format(
      'revoke truncate, references, trigger on public.%I from public, anon, authenticated', v_table);

    execute format('drop policy if exists %I on public.%I', v_table || '_select_all', v_table);
    execute format(
      'create policy %I on public.%I for select to anon, authenticated using (true)',
      v_table || '_select_all', v_table);

    execute format('drop policy if exists %I on public.%I',
      'TEMP_session_gate_' || v_table || '_ins', v_table);
    execute format('drop policy if exists %I on public.%I', 'role_' || v_table || '_insert', v_table);
    execute format(
      'create policy %I on public.%I for insert to anon, authenticated
         with check ((select public.session_can_assign_service()))',
      'role_' || v_table || '_insert', v_table);

    execute format('drop policy if exists %I on public.%I',
      'TEMP_session_gate_' || v_table || '_upd', v_table);
    execute format('drop policy if exists %I on public.%I', 'role_' || v_table || '_update', v_table);
    execute format(
      'create policy %I on public.%I for update to anon, authenticated
         using ((select private.request_is_admin()))
         with check ((select private.request_is_admin()))',
      'role_' || v_table || '_update', v_table);

    execute format('drop policy if exists %I on public.%I',
      'TEMP_session_gate_' || v_table || '_del', v_table);
    execute format('drop policy if exists %I on public.%I', 'role_' || v_table || '_delete', v_table);
    execute format(
      'create policy %I on public.%I for delete to anon, authenticated
         using ((select public.session_can_assign_service()))',
      'role_' || v_table || '_delete', v_table);
  end loop;
end $$;

do $$
declare
  v_table text;
  v_actual text[];
begin
  foreach v_table in array array['event_informal_assignments', 'event_restaurant_assignments'] loop
    select array_agg(policyname order by policyname)
    into v_actual
    from pg_policies
    where schemaname = 'public' and tablename = v_table;

    -- 이름 순이다. 표 이름이 'event_…' 라 select_all 이 'role_…' 앞에 온다.
    if v_actual is distinct from array[
      v_table || '_select_all',
      'role_' || v_table || '_delete',
      'role_' || v_table || '_insert',
      'role_' || v_table || '_update'
    ]::text[] then
      raise exception '% 정책 구성이 예상과 다릅니다: %', v_table, v_actual;
    end if;

    if exists (
      select 1 from pg_policies
      where schemaname = 'public' and tablename = v_table
        and policyname like 'TEMP\_session\_gate\_%'
    ) then
      raise exception '% 임시 세션 정책이 남았습니다', v_table;
    end if;

    if has_table_privilege('anon', 'public.' || quote_ident(v_table), 'TRUNCATE')
       or has_table_privilege('authenticated', 'public.' || quote_ident(v_table), 'TRUNCATE')
       or has_table_privilege('anon', 'public.' || quote_ident(v_table), 'REFERENCES')
       or has_table_privilege('authenticated', 'public.' || quote_ident(v_table), 'REFERENCES')
       or has_table_privilege('anon', 'public.' || quote_ident(v_table), 'TRIGGER')
       or has_table_privilege('authenticated', 'public.' || quote_ident(v_table), 'TRIGGER') then
      raise exception '%에 불필요한 테이블 권한이 남았습니다', v_table;
    end if;
  end loop;

  -- 도우미가 PUBLIC 에 열려 있으면 revoke 가 헛돈 것이다
  if exists (
    select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    cross join lateral aclexplode(coalesce(p.proacl, acldefault('f', p.proowner))) acl
    where n.nspname = 'public' and p.proname = 'session_can_assign_service'
      and acl.grantee = 0 and acl.privilege_type = 'EXECUTE'
  ) then
    raise exception 'session_can_assign_service 가 PUBLIC 에 열려 있습니다';
  end if;
end $$;

notify pgrst, 'reload schema';
