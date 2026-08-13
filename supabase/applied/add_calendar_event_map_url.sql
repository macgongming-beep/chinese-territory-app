alter table public.calendar_events
  add column if not exists meeting_map_url text;
