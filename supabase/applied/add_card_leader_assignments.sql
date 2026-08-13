-- 카드 다수 인도자 배정 테이블
-- Supabase SQL Editor에서 실행하세요.

create table if not exists public.card_leader_assignments (
  id serial primary key,
  card_id integer references public.cards(id) on delete cascade not null,
  user_name text not null,
  created_at timestamptz default now(),
  unique(card_id, user_name)
);

alter table public.card_leader_assignments enable row level security;

do $$
begin
  if not exists (
    select from pg_policies
    where tablename = 'card_leader_assignments' and policyname = 'open_access'
  ) then
    create policy "open_access" on public.card_leader_assignments for all to anon using (true) with check (true);
  end if;
end $$;

-- 기존 cards.leader_name 데이터를 새 테이블로 이관
insert into public.card_leader_assignments (card_id, user_name)
select id, leader_name
from public.cards
where leader_name is not null
on conflict (card_id, user_name) do nothing;
