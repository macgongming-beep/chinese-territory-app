-- v2 event_teams 폐기 (UI 미연결 — 추후 필요 시 다시 도입)
-- Supabase SQL Editor 에서 실행 필요

alter table public.event_card_assignments       drop column if exists team_id;
alter table public.event_informal_assignments   drop column if exists team_id;
alter table public.event_restaurant_assignments drop column if exists team_id;

drop table if exists public.event_teams cascade;
