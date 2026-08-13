-- =============================================================
-- v2 신 배정 모델 — 비공식 + 식당
-- 작성일: 2026-05-16
--
-- 추가 사항:
--  1) buildings.is_restaurant boolean (식당 마킹)
--  2) informal_assets (자료 풀)
--  3) event_informal_assignments
--  4) event_restaurant_assignments
--  5) notifications.type CHECK 확장 (assignment_informal, assignment_restaurant)
--  6) 알림 트리거 (notify_on_informal/restaurant_assignment)
--  7) Realtime publication + REPLICA IDENTITY FULL
--  8) Storage 버킷 informal-assets (수동 생성 필요 — 가이드 주석)
-- =============================================================

-- ─── 1. buildings 식당 마킹 ────────────────────────────────
alter table public.buildings
  add column if not exists is_restaurant boolean not null default false;

-- ─── 2. informal_assets (자료 풀) ──────────────────────────
create table if not exists public.informal_assets (
  id           serial primary key,
  name         text not null,
  image_url    text not null,
  image_path   text not null,
  uploaded_by  text not null default '',
  created_at   timestamptz default now(),
  archived     boolean not null default false
);

alter table public.informal_assets enable row level security;
drop policy if exists open_access on public.informal_assets;
create policy open_access on public.informal_assets
  for all to anon using (true) with check (true);

-- ─── 3. event_informal_assignments ─────────────────────────
create table if not exists public.event_informal_assignments (
  id            serial primary key,
  event_id      integer references public.calendar_events(id) on delete cascade not null,
  user_name     text not null,
  asset_id      integer references public.informal_assets(id) on delete cascade not null,
  assigned_by   text not null default '',
  assigned_at   timestamptz default now(),
  memo          text not null default '',
  unique(event_id, user_name, asset_id)
);

alter table public.event_informal_assignments enable row level security;
drop policy if exists open_access on public.event_informal_assignments;
create policy open_access on public.event_informal_assignments
  for all to anon using (true) with check (true);

create index if not exists event_informal_assignments_event_idx
  on public.event_informal_assignments(event_id);

-- ─── 4. event_restaurant_assignments ───────────────────────
create table if not exists public.event_restaurant_assignments (
  id            serial primary key,
  event_id      integer references public.calendar_events(id) on delete cascade not null,
  user_name     text not null,
  building_id   integer references public.buildings(id) on delete cascade not null,
  assigned_by   text not null default '',
  assigned_at   timestamptz default now(),
  memo          text not null default ''
);

alter table public.event_restaurant_assignments enable row level security;
drop policy if exists open_access on public.event_restaurant_assignments;
create policy open_access on public.event_restaurant_assignments
  for all to anon using (true) with check (true);

create index if not exists event_restaurant_assignments_event_idx
  on public.event_restaurant_assignments(event_id);

-- ─── 5. notifications.type CHECK 확장 ─────────────────────
alter table public.notifications drop constraint if exists notifications_type_check;
alter table public.notifications add constraint notifications_type_check
  check (type in (
    'notice', 'event_change', 'comment', 'mention', 'chat',
    'service_started', 'service_ended', 'assignment',
    'assignment_informal', 'assignment_restaurant'
  ));

-- ─── 6. 알림 트리거 ─────────────────────────────────────────

-- 8-A. 비공식 자료 배정
create or replace function public.notify_on_informal_assignment()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_recipient_id integer;
  v_assigner_id integer;
  v_event_title text;
  v_event_date date;
  v_event_time text;
  v_asset_name text;
  v_title text;
  v_body text;
  v_link text;
begin
  select id into v_recipient_id
  from public.app_users
  where name = new.user_name
    and coalesce(is_active, true) is true
  limit 1;

  if v_recipient_id is null then
    return new;
  end if;

  if coalesce(new.assigned_by, '') <> '' then
    select id into v_assigner_id from public.app_users
    where name = new.assigned_by limit 1;
  end if;

  if v_assigner_id is not null and v_assigner_id = v_recipient_id then
    return new;
  end if;

  select title, event_date, time into v_event_title, v_event_date, v_event_time
  from public.calendar_events where id = new.event_id;

  select name into v_asset_name from public.informal_assets where id = new.asset_id;

  v_title := '비공식 증거 카드가 배정되었습니다';
  v_body := coalesce(v_event_title, '봉사 일정')
    || case when v_event_date is not null
         then ' · ' || to_char(v_event_date, 'YYYY-MM-DD')
              || coalesce(' ' || v_event_time, '')
         else '' end
    || case when v_asset_name is not null
         then ' · ' || v_asset_name
         else '' end;
  v_link := '/territory?assignmentEvent=' || new.event_id;

  perform public.insert_notifications(
    array[v_recipient_id], 'assignment_informal', v_title, v_body, v_link, new.event_id
  );
  perform public.dispatch_push_notification(
    array[v_recipient_id], 'assignment_informal', v_title, v_body, v_link, new.event_id
  );
  return new;
end;
$$;

drop trigger if exists on_informal_assignment_insert on public.event_informal_assignments;
create trigger on_informal_assignment_insert
after insert on public.event_informal_assignments
for each row execute function public.notify_on_informal_assignment();

-- 8-B. 식당 봉사 배정
create or replace function public.notify_on_restaurant_assignment()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_recipient_id integer;
  v_assigner_id integer;
  v_event_title text;
  v_event_date date;
  v_event_time text;
  v_building_name text;
  v_title text;
  v_body text;
  v_link text;
begin
  select id into v_recipient_id
  from public.app_users
  where name = new.user_name
    and coalesce(is_active, true) is true
  limit 1;

  if v_recipient_id is null then
    return new;
  end if;

  if coalesce(new.assigned_by, '') <> '' then
    select id into v_assigner_id from public.app_users
    where name = new.assigned_by limit 1;
  end if;

  if v_assigner_id is not null and v_assigner_id = v_recipient_id then
    return new;
  end if;

  select title, event_date, time into v_event_title, v_event_date, v_event_time
  from public.calendar_events where id = new.event_id;

  select coalesce(nullif(name, ''), address)
    into v_building_name from public.buildings where id = new.building_id;

  v_title := '식당 봉사가 배정되었습니다';
  v_body := coalesce(v_event_title, '봉사 일정')
    || case when v_event_date is not null
         then ' · ' || to_char(v_event_date, 'YYYY-MM-DD')
              || coalesce(' ' || v_event_time, '')
         else '' end
    || case when v_building_name is not null
         then ' · ' || v_building_name
         else '' end;
  v_link := '/territory?assignmentEvent=' || new.event_id;

  perform public.insert_notifications(
    array[v_recipient_id], 'assignment_restaurant', v_title, v_body, v_link, new.event_id
  );
  perform public.dispatch_push_notification(
    array[v_recipient_id], 'assignment_restaurant', v_title, v_body, v_link, new.event_id
  );
  return new;
end;
$$;

drop trigger if exists on_restaurant_assignment_insert on public.event_restaurant_assignments;
create trigger on_restaurant_assignment_insert
after insert on public.event_restaurant_assignments
for each row execute function public.notify_on_restaurant_assignment();

-- ─── 7. Realtime publication + REPLICA IDENTITY FULL ────────
do $$
declare
  v_tables text[] := array[
    'informal_assets',
    'event_informal_assignments',
    'event_restaurant_assignments'
  ];
  v_table text;
begin
  foreach v_table in array v_tables loop
    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime'
        and schemaname = 'public'
        and tablename = v_table
    ) then
      execute format('alter publication supabase_realtime add table public.%I', v_table);
    end if;
  end loop;
end
$$;

alter table public.informal_assets replica identity full;
alter table public.event_informal_assignments replica identity full;
alter table public.event_restaurant_assignments replica identity full;

-- ─── 8. Storage 버킷 (수동 생성 필요) ────────────────────
-- Supabase Dashboard → Storage → New bucket:
--   - Name: informal-assets
--   - Public: YES (이미지 직접 표시 위해)
--   - File size limit: 5 MB
--   - Allowed MIME: image/jpeg, image/png, image/webp
--
-- 또는 Storage 정책 SQL 로 만들기 (대시보드 권장):
-- insert into storage.buckets (id, name, public) values ('informal-assets','informal-assets', true);
--
-- 정책 (anon SELECT/INSERT 허용 + DELETE 는 delete_informal_asset_secure RPC 통해서):
-- create policy "informal_assets_public_read" on storage.objects
--   for select to anon using (bucket_id = 'informal-assets');
-- create policy "informal_assets_anon_write" on storage.objects
--   for insert to anon with check (bucket_id = 'informal-assets');

-- ─── 검증 ────────────────────────────────────────────────────
-- 1) 테이블 확인:
--    select table_name from information_schema.tables
--    where table_schema='public' and table_name in (
--      'informal_assets',
--      'event_informal_assignments','event_restaurant_assignments'
--    );
-- 2) 트리거 확인:
--    select tgname from pg_trigger
--    where tgname in ('on_informal_assignment_insert','on_restaurant_assignment_insert');
-- 3) buildings 마킹 확인:
--    select id, name, type, is_restaurant from buildings
--    where type = '상가' limit 5;
