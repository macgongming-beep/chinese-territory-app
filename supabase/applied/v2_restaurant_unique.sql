-- v2 식당 배정 중복 방지
-- Supabase SQL Editor 에서 실행 필요

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'event_restaurant_assignments_unique'
  ) then
    alter table public.event_restaurant_assignments
      add constraint event_restaurant_assignments_unique
      unique (event_id, user_name, building_id);
  end if;
end $$;
