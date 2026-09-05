-- 장소 삭제를 모든 열린 앱에 조용히 반영한다.
-- 공개 SELECT 계약은 유지하고, 클라이언트는 DELETE 신호만 받아 구역 slice를 재조회한다.

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'buildings'
  ) then
    alter publication supabase_realtime add table public.buildings;
  end if;

  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'units'
  ) then
    alter publication supabase_realtime add table public.units;
  end if;
end $$;

do $$
begin
  if (select count(*) from pg_publication_tables
      where pubname = 'supabase_realtime'
        and schemaname = 'public'
        and tablename in ('buildings', 'units')) <> 2 then
    raise exception 'buildings와 units가 supabase_realtime publication에 모두 있어야 합니다';
  end if;
end $$;
