-- 비공식 장소 카드가 그 안의 점들을 품는다.
--
-- 지금까지는 모든 비공식 장소가 나란히 있었다. 그런데 실제로는
-- '경희대(홈플러스)' 라는 구역 하나 안에 거점 하나와 대화하기 좋은 자리 여럿이
-- 들어간다. 참고한 화면(spict)의 '건대입구역A' 도 같은 모양이다.
--
--   informal_groups   경희대
--     └ 장소 카드      경희대(홈플러스)   네모칸·중심거리를 가진 그릇
--          ├ 거점        롯데백화점
--          └ 대화장소    커먼그라운드
--
-- ⚠ 깊이는 한 단계만이다. 손자를 허용하면 화면이 트리가 되고, 지도에서
--   "이 구역에 속한 점" 을 세는 일이 재귀가 된다. 아래 트리거가 막는다.
--
-- ⚠ 부모를 지우면 자식도 지운다(cascade). 자식은 핀뿐이라 Storage 파일이
--   없지만, 나중에 자식에 사진을 붙이게 되면 삭제 RPC 가 자식 경로도
--   돌려주도록 함께 고쳐야 한다.

alter table public.informal_assets
  add column if not exists parent_id integer;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.informal_assets'::regclass
      and conname = 'informal_assets_parent_fk'
  ) then
    alter table public.informal_assets
      add constraint informal_assets_parent_fk
      foreign key (parent_id) references public.informal_assets(id) on delete cascade;
  end if;
end $$;

create index if not exists informal_assets_parent_idx
  on public.informal_assets (parent_id) where parent_id is not null;

-- 자기 자신을 부모로 삼거나, 이미 자식인 것을 부모로 삼는 것을 막는다.
create or replace function public.guard_informal_asset_depth()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_grandparent integer;
begin
  if new.parent_id is null then
    return new;
  end if;

  if new.parent_id = new.id then
    raise exception '자기 자신을 상위 장소로 둘 수 없습니다';
  end if;

  select parent_id into v_grandparent
  from public.informal_assets
  where id = new.parent_id;

  if v_grandparent is not null then
    raise exception '비공식 장소는 한 단계까지만 묶을 수 있습니다';
  end if;

  -- 자식을 가진 것은 남의 자식이 될 수 없다 (위 규칙의 반대 방향)
  if exists (select 1 from public.informal_assets where parent_id = new.id) then
    raise exception '이미 하위 장소를 가진 곳은 다른 곳에 넣을 수 없습니다';
  end if;

  return new;
end;
$$;

drop trigger if exists guard_informal_asset_depth on public.informal_assets;
create trigger guard_informal_asset_depth
  before insert or update on public.informal_assets
  for each row execute function public.guard_informal_asset_depth();

do $$
declare
  v_parent integer;
  v_child integer;
begin
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'informal_assets' and column_name = 'parent_id'
  ) then
    raise exception 'informal_assets.parent_id 가 없습니다';
  end if;

  if not exists (
    select 1 from pg_trigger
    where tgrelid = 'public.informal_assets'::regclass
      and tgname = 'guard_informal_asset_depth' and not tgisinternal
  ) then
    raise exception '깊이 제한 트리거가 없습니다';
  end if;

  if exists (
    select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'guard_informal_asset_depth' and p.prosecdef
  ) then
    raise exception 'guard_informal_asset_depth 가 security definer 입니다';
  end if;

  -- 깊이 제한이 실제로 무는지 본다. 안 물면 위 검사는 이름만 확인한 셈이다.
  -- ⚠ NOT NULL 인 칸을 전부 채운다 — 안 채우면 트리거가 아니라 NOT NULL 에
  --   먼저 걸려서 이 시험이 아무것도 증명하지 못한다.
  insert into public.informal_assets (name, image_url, image_path, uploaded_by, kind)
  values ('_깊이시험_부모', '', '_깊이시험', '_깊이시험', '비공식구역') returning id into v_parent;
  insert into public.informal_assets (name, image_url, image_path, uploaded_by, kind, parent_id)
  values ('_깊이시험_자식', '', '_깊이시험', '_깊이시험', '거점', v_parent) returning id into v_child;

  begin
    insert into public.informal_assets (name, image_url, image_path, uploaded_by, kind, parent_id)
    values ('_깊이시험_손자', '', '_깊이시험', '_깊이시험', '거점', v_child);
    raise exception '손자를 막지 못했습니다';
  exception
    when raise_exception then
      if sqlerrm = '손자를 막지 못했습니다' then raise; end if;
      -- 트리거가 막았다 — 기대한 동작
  end;

  delete from public.informal_assets where id in (v_child, v_parent);
end $$;

notify pgrst, 'reload schema';
