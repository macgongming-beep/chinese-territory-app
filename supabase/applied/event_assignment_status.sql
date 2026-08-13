-- Store whether a service assignment has been shared to the event detail page.
alter table public.calendar_events
  add column if not exists assignment_status text not null default 'draft',
  add column if not exists assignment_shared_at timestamptz,
  add column if not exists assignment_shared_by text;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'calendar_events_assignment_status_check'
  ) then
    alter table public.calendar_events
      add constraint calendar_events_assignment_status_check
      check (assignment_status in ('draft', 'confirmed', 'shared'));
  end if;
end $$;
