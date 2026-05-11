-- ===============================================================
-- V1+ Day 1~2 schema
-- 실행: Supabase SQL Editor 에서 전체 복사 후 Run
--
-- 신규 9개 테이블:
--   auth_sessions, comments, chat_messages, chat_read_status,
--   chat_room_mutes, push_subscriptions, notifications,
--   notification_preferences, service_logs
--
-- 보안 방향:
--   - 현재 앱은 Supabase Auth가 아니라 app_users + RPC 로그인 구조다.
--   - 일반 기능 테이블은 RLS open_access로 기존 클라이언트 흐름과 호환한다.
--   - auth_sessions / service_logs는 직접 접근을 차단하고 RPC로만 접근한다.
-- ===============================================================

create extension if not exists pgcrypto;

-- ─── app_users: 승인/활성 상태 ──────────────────────────────────
alter table public.app_users
add column if not exists approval_status text not null default 'approved';

alter table public.app_users
add column if not exists is_active boolean not null default true;

alter table public.app_users
add column if not exists last_login_at timestamptz;

alter table public.app_users
drop constraint if exists app_users_approval_status_check;

alter table public.app_users
add constraint app_users_approval_status_check
check (approval_status in ('pending', 'approved', 'blocked'));

alter table public.app_users
drop constraint if exists app_users_role_check;

alter table public.app_users
add constraint app_users_role_check
check (role in ('user', 'leader', 'admin', 'developer'));

update public.app_users
set approval_status = 'approved'
where approval_status is null;

update public.app_users
set is_active = true
where is_active is null;

-- pin은 SELECT 권한을 주지 않는다.
grant select (id, login_id, name, role, approval_status, is_active, last_login_at, created_at, phone)
on public.app_users to anon, authenticated;

-- ─── auth_sessions: 세션 토큰 ───────────────────────────────────
create table if not exists public.auth_sessions (
  token uuid primary key default gen_random_uuid(),
  user_id integer not null references public.app_users(id) on delete cascade,
  device_label text,
  user_agent text,
  created_at timestamptz not null default now(),
  last_used_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '30 days')
);

create index if not exists idx_auth_sessions_user
on public.auth_sessions(user_id);

create index if not exists idx_auth_sessions_expires
on public.auth_sessions(expires_at);

alter table public.auth_sessions enable row level security;
revoke all on public.auth_sessions from anon, authenticated;

-- ─── comments: 공지/일정 댓글 ──────────────────────────────────
create table if not exists public.comments (
  id bigserial primary key,
  target_type text not null check (target_type in ('notice', 'calendar_event')),
  target_id integer not null,
  author_id integer references public.app_users(id) on delete set null,
  author_name text not null,
  content text not null,
  mention_ids integer[] not null default '{}',
  mention_names text[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create index if not exists idx_comments_target
on public.comments(target_type, target_id, created_at);

create index if not exists idx_comments_author
on public.comments(author_id, created_at);

alter table public.comments enable row level security;
drop policy if exists open_access on public.comments;
create policy open_access on public.comments
for all to anon, authenticated
using (true)
with check (true);

-- ─── chat_messages: 일정별 채팅 ────────────────────────────────
create table if not exists public.chat_messages (
  id bigserial primary key,
  event_id integer not null references public.calendar_events(id) on delete cascade,
  author_id integer references public.app_users(id) on delete set null,
  author_name text not null,
  message_type text not null default 'text' check (message_type in ('text', 'image', 'system')),
  content text,
  image_url text,
  image_expires_at timestamptz,
  image_expired boolean not null default false,
  mention_ids integer[] not null default '{}',
  mention_names text[] not null default '{}',
  created_at timestamptz not null default now(),
  deleted_at timestamptz
);

create index if not exists idx_chat_messages_event
on public.chat_messages(event_id, created_at);

create index if not exists idx_chat_messages_author
on public.chat_messages(author_id, created_at);

alter table public.chat_messages enable row level security;
drop policy if exists open_access on public.chat_messages;
drop policy if exists chat_messages_read on public.chat_messages;
create policy chat_messages_read on public.chat_messages
for select to anon, authenticated
using (true);

-- ─── chat_read_status: 채팅 읽음 상태 ───────────────────────────
create table if not exists public.chat_read_status (
  event_id integer not null references public.calendar_events(id) on delete cascade,
  user_id integer not null references public.app_users(id) on delete cascade,
  last_read_at timestamptz not null default now(),
  primary key (event_id, user_id)
);

alter table public.chat_read_status enable row level security;
drop policy if exists open_access on public.chat_read_status;
create policy open_access on public.chat_read_status
for all to anon, authenticated
using (true)
with check (true);

-- ─── chat_room_mutes: 일정 채팅방별 알림 끄기 ───────────────────
create table if not exists public.chat_room_mutes (
  event_id integer not null references public.calendar_events(id) on delete cascade,
  user_id integer not null references public.app_users(id) on delete cascade,
  muted_at timestamptz not null default now(),
  primary key (event_id, user_id)
);

alter table public.chat_room_mutes enable row level security;
drop policy if exists open_access on public.chat_room_mutes;
create policy open_access on public.chat_room_mutes
for all to anon, authenticated
using (true)
with check (true);

-- ─── push_subscriptions: 웹 푸시 구독 ───────────────────────────
create table if not exists public.push_subscriptions (
  id bigserial primary key,
  user_id integer not null references public.app_users(id) on delete cascade,
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  device_label text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  last_seen_at timestamptz
);

create index if not exists idx_push_subscriptions_user
on public.push_subscriptions(user_id);

alter table public.push_subscriptions enable row level security;
drop policy if exists open_access on public.push_subscriptions;
create policy open_access on public.push_subscriptions
for all to anon, authenticated
using (true)
with check (true);

-- ─── notifications: 앱 내 알림함 ───────────────────────────────
create table if not exists public.notifications (
  id bigserial primary key,
  user_id integer not null references public.app_users(id) on delete cascade,
  type text not null check (
    type in (
      'notice',
      'event_change',
      'comment',
      'mention',
      'chat',
      'service_started',
      'service_ended'
    )
  ),
  title text not null,
  body text,
  link text,
  related_id integer,
  is_read boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists idx_notifications_user
on public.notifications(user_id, is_read, created_at desc);

alter table public.notifications enable row level security;
drop policy if exists open_access on public.notifications;
create policy open_access on public.notifications
for all to anon, authenticated
using (true)
with check (true);

-- ─── notification_preferences: 사용자별 알림 설정 ──────────────
create table if not exists public.notification_preferences (
  user_id integer primary key references public.app_users(id) on delete cascade,
  push_new_notice boolean not null default true,
  push_event_change boolean not null default true,
  push_comment boolean not null default true,
  push_chat boolean not null default true,
  push_mention boolean not null default true,
  push_service_status boolean not null default true,
  quiet_hours_start time,
  quiet_hours_end time,
  updated_at timestamptz not null default now()
);

alter table public.notification_preferences enable row level security;
drop policy if exists open_access on public.notification_preferences;
create policy open_access on public.notification_preferences
for all to anon, authenticated
using (true)
with check (true);

-- ─── service_logs: 민감 봉사 로그 ──────────────────────────────
create table if not exists public.service_logs (
  id bigserial primary key,
  session_id integer references public.service_sessions(id) on delete set null,
  event_id integer references public.calendar_events(id) on delete set null,
  event_title text,
  event_date date,
  card_id integer references public.cards(id) on delete set null,
  card_name text,
  actor_id integer references public.app_users(id) on delete set null,
  actor_name text not null,
  action text not null,
  target_type text,
  target_id integer,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_service_logs_session
on public.service_logs(session_id, created_at desc);

create index if not exists idx_service_logs_event
on public.service_logs(event_id, created_at desc);

create index if not exists idx_service_logs_card
on public.service_logs(card_id, created_at desc);

create index if not exists idx_service_logs_actor
on public.service_logs(actor_id, created_at desc);

alter table public.service_logs enable row level security;
revoke all on public.service_logs from anon, authenticated;

-- 신규 open_access 테이블 권한. service_logs/auth_sessions 제외.
grant select, insert, update, delete on
  public.comments,
  public.chat_read_status,
  public.chat_room_mutes,
  public.push_subscriptions,
  public.notifications,
  public.notification_preferences
to anon, authenticated;

-- chat_messages는 클라이언트 직접 쓰기를 막고 RPC로만 작성한다.
grant select on public.chat_messages to anon, authenticated;

grant usage, select on sequence
  public.comments_id_seq,
  public.push_subscriptions_id_seq,
  public.notifications_id_seq
to anon, authenticated;

-- ─── Storage: 채팅 사진 첨부 버킷 ─────────────────────────────
-- V1에서는 getPublicUrl 기반으로 단순 운영한다.
-- 중장기에는 signed upload/download + 만료 Edge Function으로 강화한다.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'chat-attachments',
  'chat-attachments',
  true,
  10485760,
  array['image/jpeg', 'image/png', 'image/webp', 'image/gif']
)
on conflict (id) do update
set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists chat_attachments_public_read on storage.objects;
create policy chat_attachments_public_read on storage.objects
for select to anon, authenticated
using (bucket_id = 'chat-attachments');

drop policy if exists chat_attachments_upload on storage.objects;
create policy chat_attachments_upload on storage.objects
for insert to anon, authenticated
with check (bucket_id = 'chat-attachments');

-- ─── 만료 토큰 정리 함수 + pg_cron 스케줄 ─────────────────────
create or replace function public.cleanup_expired_auth_sessions()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_deleted integer;
begin
  delete from public.auth_sessions
  where expires_at < now() - interval '7 days';

  get diagnostics v_deleted = row_count;
  return v_deleted;
end;
$$;

revoke all on function public.cleanup_expired_auth_sessions() from anon, authenticated;

do $do$
begin
  if exists (select 1 from pg_namespace where nspname = 'cron') then
    begin
      execute 'select cron.unschedule(''cleanup-expired-auth-sessions'')';
    exception
      when others then
        null;
    end;

    execute 'select cron.schedule(''cleanup-expired-auth-sessions'', ''0 3 * * *'', ''select public.cleanup_expired_auth_sessions();'')';
  else
    raise notice 'pg_cron schema is not enabled. Enable pg_cron and schedule cleanup_expired_auth_sessions manually if needed.';
  end if;
end
$do$;
