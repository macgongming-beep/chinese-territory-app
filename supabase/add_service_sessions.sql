-- 봉사 시작 세션 기능 추가
-- Supabase SQL Editor에서 실행하세요.

create table if not exists public.service_sessions (
  id              serial primary key,
  user_name       text not null,
  role            text not null default 'user' check (role in ('user', 'leader', 'admin')),
  calendar_event_id integer references public.calendar_events(id) on delete set null,
  started_at      timestamptz not null default now(),
  ended_at        timestamptz,
  service_date    date not null default current_date,
  time_slot       text not null check (time_slot in ('오전', '오후', '저녁')),
  status          text not null default 'active' check (status in ('active', 'ended', 'expired')),
  primary_card_id integer references public.cards(id) on delete set null,
  assigned_card_id integer references public.cards(id) on delete set null,
  assignment_id   integer,
  source          text not null default 'manual' check (source in ('assigned', 'manual', 'manual_override')),
  memo            text not null default '',
  created_at      timestamptz default now()
);

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'service_sessions_user_date_slot_card_unique'
  ) then
    alter table public.service_sessions
      add constraint service_sessions_user_date_slot_card_unique
      unique nulls not distinct (user_name, service_date, time_slot, primary_card_id);
  end if;
end $$;

alter table public.visit_histories
  add column if not exists service_session_id integer references public.service_sessions(id) on delete set null;

create table if not exists public.event_card_assignments (
  id               serial primary key,
  event_id         integer references public.calendar_events(id) on delete cascade not null,
  user_name        text not null,
  assigned_card_id integer references public.cards(id) on delete cascade not null,
  assigned_by      text not null default '',
  assigned_at      timestamptz default now(),
  memo             text not null default '',
  unique(event_id, user_name)
);

alter table public.service_sessions
  add column if not exists calendar_event_id integer references public.calendar_events(id) on delete set null,
  add column if not exists assigned_card_id integer references public.cards(id) on delete set null,
  add column if not exists assignment_id integer,
  add column if not exists source text not null default 'manual';

alter table public.service_sessions enable row level security;
alter table public.event_card_assignments enable row level security;

drop policy if exists "open_access" on public.service_sessions;
create policy "open_access" on public.service_sessions for all to anon using (true) with check (true);
drop policy if exists "open_access" on public.event_card_assignments;
create policy "open_access" on public.event_card_assignments for all to anon using (true) with check (true);
