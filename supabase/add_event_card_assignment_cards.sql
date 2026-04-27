create table if not exists public.event_card_assignment_cards (
  id        serial primary key,
  event_id  integer references public.calendar_events(id) on delete cascade not null,
  user_name text not null,
  card_id   integer references public.cards(id) on delete cascade not null,
  created_at timestamptz default now(),
  unique(event_id, user_name, card_id)
);

alter table public.event_card_assignment_cards enable row level security;

drop policy if exists "open_access" on public.event_card_assignment_cards;
create policy "open_access"
on public.event_card_assignment_cards
for all
to anon
using (true)
with check (true);
