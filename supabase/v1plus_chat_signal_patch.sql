-- =============================================================
-- v1+ Chat Signal Patch
-- 작성일: 2026-05-15
--
-- chat_messages 본문 SELECT 는 계속 닫아두고, Realtime 즉시 갱신용
-- 신호만 별도 테이블에 기록한다.
-- 신호에는 event_id/message_id/created_at 만 들어가며 메시지 본문은 없다.
-- =============================================================

create table if not exists public.chat_message_signals (
  id bigserial primary key,
  event_id integer not null references public.calendar_events(id) on delete cascade,
  message_id bigint not null,
  created_at timestamptz not null default now()
);

create index if not exists idx_chat_message_signals_event
on public.chat_message_signals(event_id, created_at desc);

alter table public.chat_message_signals enable row level security;
alter table public.chat_message_signals replica identity full;

grant select on public.chat_message_signals to anon, authenticated;
revoke insert, update, delete on public.chat_message_signals from anon, authenticated;

drop policy if exists chat_message_signals_read on public.chat_message_signals;
create policy chat_message_signals_read
  on public.chat_message_signals
  for select
  to anon, authenticated
  using (true);

do $$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'chat_message_signals'
  ) then
    alter publication supabase_realtime add table public.chat_message_signals;
  end if;
end
$$;

create or replace function public.emit_chat_message_signal()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.chat_message_signals (event_id, message_id)
  values (new.event_id, new.id);

  -- 신호 테이블은 실시간 트리거 용도라 너무 오래 쌓이지 않게 가볍게 정리한다.
  delete from public.chat_message_signals
  where created_at < now() - interval '7 days';

  return new;
end;
$$;

drop trigger if exists on_chat_message_signal on public.chat_messages;
create trigger on_chat_message_signal
after insert on public.chat_messages
for each row execute function public.emit_chat_message_signal();
