-- 검토 항목은 모두가 읽되 관리자·개발자만 쓴다.
--
-- 이 표는 지금 **화면이 없다** — DesktopHome 이 프롭 여섯 개를 받아 전부 버린다
-- (`reviewTasks: _rt` …). 그래도 표와 mutation 은 살아 있으므로, 로그인만 하면
-- 아무나 고치고 지울 수 있는 상태로 두지 않는다. 나중에 화면을 되살릴 때
-- 관리자 전용이면 곤란하다면 그때 정책을 넓히면 된다 — 좁혀 두는 쪽이 안전하다.
--
-- 읽기는 공개로 둔다 (다른 표와 같은 이유: Realtime 이 SELECT RLS 를 보는데
-- WebSocket 에는 세션 헤더가 안 붙는다).

alter table public.review_tasks enable row level security;

revoke truncate, references, trigger on public.review_tasks from public, anon, authenticated;

drop policy if exists review_tasks_select_all on public.review_tasks;
create policy review_tasks_select_all on public.review_tasks
  for select to public
  using (true);

drop policy if exists "TEMP_session_gate_review_tasks_ins" on public.review_tasks;
drop policy if exists role_admin_review_tasks_insert on public.review_tasks;
create policy role_admin_review_tasks_insert on public.review_tasks
  for insert to public
  with check ((select private.request_is_admin()));

drop policy if exists "TEMP_session_gate_review_tasks_upd" on public.review_tasks;
drop policy if exists role_admin_review_tasks_update on public.review_tasks;
create policy role_admin_review_tasks_update on public.review_tasks
  for update to public
  using ((select private.request_is_admin()))
  with check ((select private.request_is_admin()));

drop policy if exists "TEMP_session_gate_review_tasks_del" on public.review_tasks;
drop policy if exists role_admin_review_tasks_delete on public.review_tasks;
create policy role_admin_review_tasks_delete on public.review_tasks
  for delete to public
  using ((select private.request_is_admin()));

do $$
declare
  v_policies text[];
begin
  select array_agg(policyname order by policyname)
  into v_policies
  from pg_policies
  where schemaname = 'public'
    and tablename = 'review_tasks';

  if v_policies is distinct from array[
    'review_tasks_select_all',
    'role_admin_review_tasks_delete',
    'role_admin_review_tasks_insert',
    'role_admin_review_tasks_update'
  ]::text[] then
    raise exception 'review_tasks 정책 구성이 예상과 다릅니다: %', v_policies;
  end if;

  if exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'review_tasks'
      and policyname like 'TEMP\_session\_gate\_%'
  ) then
    raise exception 'review_tasks 임시 세션 정책이 남았습니다';
  end if;

  -- RLS 가 막지 못하는 권한은 회수돼야 한다 (TRUNCATE 는 정책을 통째로 우회한다)
  if has_table_privilege('anon', 'public.review_tasks', 'TRUNCATE')
     or has_table_privilege('authenticated', 'public.review_tasks', 'TRUNCATE')
     or has_table_privilege('anon', 'public.review_tasks', 'REFERENCES')
     or has_table_privilege('authenticated', 'public.review_tasks', 'REFERENCES')
     or has_table_privilege('anon', 'public.review_tasks', 'TRIGGER')
     or has_table_privilege('authenticated', 'public.review_tasks', 'TRIGGER') then
    raise exception 'review_tasks 에 불필요한 테이블 권한이 남았습니다';
  end if;
end $$;

notify pgrst, 'reload schema';
