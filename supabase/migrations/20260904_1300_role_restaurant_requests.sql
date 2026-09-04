-- 식당 신청은 봉사자가 올리고 관리자가 검토한다. 표 하나에 두 역할이 섞여 있다.
--
-- 코드에서 읽은 계약 (src/hooks/storeMutations/restaurantService.ts):
--   submitRestaurantRequest       봉사자   INSERT (requested_by = 본인)
--   updateRestaurantRequestMemo   봉사자   UPDATE memo 만
--   approveRestaurantRequest      관리자   UPDATE status/reviewer/reviewed_at/building_id
--   rejectRestaurantRequest       관리자   UPDATE status/reviewer/reviewed_at
--   (DELETE 하는 클라이언트 경로는 **없다**)
--
-- 화면 게이팅도 같다: MobileTerritory 는 leader/user 에게만 신청을 열고,
-- 승인·거절은 RestaurantsTab / AdminMobileZone(관리자 화면)에만 있다.
--
-- ⚠ "신청자는 memo 만" 은 RLS 로 표현할 수 없다 (정책은 칸 단위가 아니다).
--   트리거로 막는다.

alter table public.restaurant_requests enable row level security;

revoke truncate, references, trigger on public.restaurant_requests from public, anon, authenticated;

drop policy if exists restaurant_requests_select on public.restaurant_requests;
create policy restaurant_requests_select on public.restaurant_requests
  for select to public
  using (true);

-- 신청: 로그인한 사람이면 되지만 **남의 이름으로는 못 올린다**.
-- 예전에는 requested_by 를 localStorage 의 currentVisitor 에서 그대로 받아서,
-- 그 값을 바꾸면 아무 이름으로나 신청할 수 있었다.
drop policy if exists "TEMP_session_gate_restaurant_requests_insert" on public.restaurant_requests;
drop policy if exists role_restaurant_requests_insert on public.restaurant_requests;
create policy role_restaurant_requests_insert on public.restaurant_requests
  for insert to public
  with check (
    (select private.request_is_admin())
    or requested_by = (
      select u.name from public.app_users u
      where u.id = (select private.request_session_user_id())
    )
  );

-- 수정: 관리자는 전부, 신청자는 자기 신청 건만 (칸 제한은 아래 트리거가 본다)
drop policy if exists "TEMP_session_gate_restaurant_requests_update" on public.restaurant_requests;
drop policy if exists role_restaurant_requests_update on public.restaurant_requests;
create policy role_restaurant_requests_update on public.restaurant_requests
  for update to public
  using (
    (select private.request_is_admin())
    or requested_by = (
      select u.name from public.app_users u
      where u.id = (select private.request_session_user_id())
    )
  )
  with check (
    (select private.request_is_admin())
    or requested_by = (
      select u.name from public.app_users u
      where u.id = (select private.request_session_user_id())
    )
  );

-- 삭제: 쓰는 화면이 없다. 관리자에게만 남겨 둔다.
drop policy if exists "TEMP_session_gate_restaurant_requests_delete" on public.restaurant_requests;
drop policy if exists role_restaurant_requests_delete on public.restaurant_requests;
create policy role_restaurant_requests_delete on public.restaurant_requests
  for delete to public
  using ((select private.request_is_admin()));

-- 신청자가 자기 신청 건의 **memo 말고 다른 칸**을 바꾸지 못하게 한다.
-- 이게 없으면 신청자가 스스로 status='approved' 로 바꿔 승인을 통과시킬 수 있다.
--
-- ⚠ security invoker 여야 한다. definer 로 만들면 함수 안에서 current_user 가
--   소유자(postgres)가 되어 아래 통로가 **항상 열린다**.
-- ⚠ 본문은 private.* 를 직접 못 부른다 — anon 은 private 스키마 USAGE 가 없다.
--   (정책 식은 되지만 plpgsql 본문은 다르다.) public.session_is_admin() 래퍼를 쓴다.
create or replace function public.guard_restaurant_request_columns()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  -- rename_user_name_references(postgres 소유 definer)가 requested_by·reviewer 를
  -- 바꾼다. 이 표를 건드리는 definer 는 그 하나뿐이라 통로를 열어 둔다.
  if current_user in ('postgres', 'supabase_admin', 'service_role') then
    return new;
  end if;

  if public.session_is_admin() then
    return new;
  end if;

  if new.id is distinct from old.id
     or new.name is distinct from old.name
     or new.address is distinct from old.address
     or new.requested_by is distinct from old.requested_by
     or new.requested_at is distinct from old.requested_at
     or new.status is distinct from old.status
     or new.visited_at is distinct from old.visited_at
     or new.reviewer is distinct from old.reviewer
     or new.reviewed_at is distinct from old.reviewed_at
     or new.building_id is distinct from old.building_id then
    raise exception '신청자는 메모만 고칠 수 있습니다';
  end if;

  return new;
end;
$$;

drop trigger if exists guard_restaurant_request_columns on public.restaurant_requests;
create trigger guard_restaurant_request_columns
  before update on public.restaurant_requests
  for each row execute function public.guard_restaurant_request_columns();

do $$
declare
  v_policies text[];
begin
  select array_agg(policyname order by policyname)
  into v_policies
  from pg_policies
  where schemaname = 'public' and tablename = 'restaurant_requests';

  if v_policies is distinct from array[
    'restaurant_requests_select',
    'role_restaurant_requests_delete',
    'role_restaurant_requests_insert',
    'role_restaurant_requests_update'
  ]::text[] then
    raise exception 'restaurant_requests 정책 구성이 예상과 다릅니다: %', v_policies;
  end if;

  if exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'restaurant_requests'
      and policyname like 'TEMP\_session\_gate\_%'
  ) then
    raise exception 'restaurant_requests 임시 세션 정책이 남았습니다';
  end if;

  if has_table_privilege('anon', 'public.restaurant_requests', 'TRUNCATE')
     or has_table_privilege('authenticated', 'public.restaurant_requests', 'TRUNCATE')
     or has_table_privilege('anon', 'public.restaurant_requests', 'REFERENCES')
     or has_table_privilege('authenticated', 'public.restaurant_requests', 'REFERENCES')
     or has_table_privilege('anon', 'public.restaurant_requests', 'TRIGGER')
     or has_table_privilege('authenticated', 'public.restaurant_requests', 'TRIGGER') then
    raise exception 'restaurant_requests 에 불필요한 테이블 권한이 남았습니다';
  end if;

  -- 트리거가 invoker 인지 확인한다. definer 면 postgres 통로가 항상 열려 무용지물이다.
  if exists (
    select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'guard_restaurant_request_columns'
      and p.prosecdef
  ) then
    raise exception 'guard_restaurant_request_columns 가 security definer 입니다';
  end if;

  if not exists (
    select 1 from pg_trigger
    where tgrelid = 'public.restaurant_requests'::regclass
      and tgname = 'guard_restaurant_request_columns'
      and not tgisinternal
  ) then
    raise exception 'guard_restaurant_request_columns 트리거가 없습니다';
  end if;
end $$;

notify pgrst, 'reload schema';
