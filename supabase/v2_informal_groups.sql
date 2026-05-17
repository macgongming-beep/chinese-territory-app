-- =============================================================
-- 비공식 자료 그룹화
-- 작성일: 2026-05-16
--
-- 비공식 카드를 그룹(예: "경희대", "강남대", "명지대") 으로 묶을 수 있게
-- - informal_groups 신규 테이블
-- - informal_assets.group_id 추가 (nullable = 미분류)
-- =============================================================

-- ─── 1. informal_groups 테이블 ────────────────────────────
create table if not exists public.informal_groups (
  id         serial primary key,
  name       text not null,
  position   integer not null default 0,
  created_by text not null default '',
  created_at timestamptz default now()
);

alter table public.informal_groups enable row level security;
drop policy if exists open_access on public.informal_groups;
create policy open_access on public.informal_groups
  for all to anon, authenticated using (true) with check (true);

-- ─── 2. informal_assets 에 group_id 추가 ──────────────────
alter table public.informal_assets
  add column if not exists group_id integer references public.informal_groups(id) on delete set null;

create index if not exists informal_assets_group_idx on public.informal_assets(group_id);

-- ─── 3. Realtime + REPLICA IDENTITY ───────────────────────
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'informal_groups'
  ) then
    alter publication supabase_realtime add table public.informal_groups;
  end if;
end
$$;

alter table public.informal_groups replica identity full;

-- ─── 검증 ────────────────────────────────────────────────
-- select column_name from information_schema.columns
-- where table_name='informal_assets' and column_name='group_id';
-- select * from informal_groups;
