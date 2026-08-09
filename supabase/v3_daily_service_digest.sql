-- 오늘의 봉사 마련 아침 알림 (밴드 예약 게시글 대체)
-- Supabase SQL Editor 에서 실행
--
-- 동작:
--   매일 정해진 시각(기본 09:00 KST)에 그날 일정이 있으면 전체 사용자에게
--   "오늘 봉사 마련 N건 / 시간 · 제목 · 장소 · 인도자" 알림을 1회 보낸다.
--   일정이 없는 날은 아무것도 보내지 않는다.
--
-- 구조:
--   1) notification_preferences.push_daily_service — 사용자별 on/off (기본 켜짐)
--   2) app_private_settings — 관리자용 사용여부/시각/마지막 발송일
--   3) send_daily_service_digest() — 실제 판단+발송 (pg_cron 이 5분마다 호출)
--   4) get/update_daily_service_settings — 관리자 설정 화면용 RPC
--
-- 왜 5분마다 도는가: 관리자가 시각을 바꿔도 스케줄을 다시 잡을 필요가 없고,
--   서버가 잠깐 밀려 한 번 걸러도 그날 안에 따라잡는다. "오늘 이미 보냄"
--   기록이 있어 중복 발송은 되지 않는다.

-- ─── 1. 사용자별 on/off 컬럼 ─────────────────────────────────
alter table public.notification_preferences
  add column if not exists push_daily_service boolean not null default true;

-- 알림 종류 목록에 daily_service 추가
alter table public.notifications drop constraint if exists notifications_type_check;
alter table public.notifications add constraint notifications_type_check
  check (type in (
    'notice', 'event_change', 'comment', 'mention', 'chat',
    'service_started', 'service_ended', 'assignment',
    'assignment_informal', 'assignment_restaurant',
    'daily_service'
  ));

-- 알림 설정 저장 RPC 에 새 항목 추가
-- (기존 시그니처는 지운다 — 같은 이름 함수가 둘이면 호출이 모호해진다.
--  새 인자에 기본값이 있어 배포 전 옛 클라이언트가 빼고 호출해도 동작한다)
drop function if exists public.update_my_notification_prefs(uuid, boolean, boolean, boolean, boolean, boolean, boolean, time, time);

create or replace function public.update_my_notification_prefs(
  p_token uuid,
  p_push_new_notice boolean,
  p_push_event_change boolean,
  p_push_comment boolean,
  p_push_chat boolean,
  p_push_mention boolean,
  p_push_service_status boolean,
  p_quiet_hours_start time default null,
  p_quiet_hours_end time default null,
  p_push_daily_service boolean default true
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id integer;
begin
  v_user_id := public.verify_session(p_token);

  insert into public.notification_preferences (
    user_id, push_new_notice, push_event_change, push_comment,
    push_chat, push_mention, push_service_status,
    quiet_hours_start, quiet_hours_end, push_daily_service, updated_at
  )
  values (
    v_user_id, p_push_new_notice, p_push_event_change, p_push_comment,
    p_push_chat, p_push_mention, p_push_service_status,
    p_quiet_hours_start, p_quiet_hours_end, coalesce(p_push_daily_service, true), now()
  )
  on conflict (user_id) do update
  set
    push_new_notice = excluded.push_new_notice,
    push_event_change = excluded.push_event_change,
    push_comment = excluded.push_comment,
    push_chat = excluded.push_chat,
    push_mention = excluded.push_mention,
    push_service_status = excluded.push_service_status,
    quiet_hours_start = excluded.quiet_hours_start,
    quiet_hours_end = excluded.quiet_hours_end,
    push_daily_service = excluded.push_daily_service,
    updated_at = now();
end;
$$;

grant execute on function public.update_my_notification_prefs(uuid, boolean, boolean, boolean, boolean, boolean, boolean, time, time, boolean) to anon, authenticated;

-- ─── 2. 운영 설정 (관리자만 접근 가능한 테이블) ──────────────
insert into public.app_private_settings (key, value)
values
  ('daily_service_enabled', 'true'),
  ('daily_service_time', '09:00')
on conflict (key) do nothing;

-- ─── 3. 발송 함수 ────────────────────────────────────────────
create or replace function public.send_daily_service_digest(p_force boolean default false)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_enabled boolean;
  v_send_time time;
  v_last_sent text;
  v_now timestamp;
  v_today date;
  v_count integer;
  v_title text;
  v_body text;
  v_link text;
  v_first_event integer;
  v_recipients integer[];
begin
  v_now := (now() at time zone 'Asia/Seoul');
  v_today := v_now::date;

  select coalesce((select value = 'true' from public.app_private_settings where key = 'daily_service_enabled'), true)
    into v_enabled;
  select coalesce((select value from public.app_private_settings where key = 'daily_service_time'), '09:00')::time
    into v_send_time;
  select value into v_last_sent from public.app_private_settings where key = 'daily_service_last_sent';

  if not p_force then
    if not v_enabled then
      return jsonb_build_object('ok', true, 'sent', 0, 'reason', 'disabled');
    end if;
    if v_now::time < v_send_time then
      return jsonb_build_object('ok', true, 'sent', 0, 'reason', 'too_early');
    end if;
    if v_last_sent = v_today::text then
      return jsonb_build_object('ok', true, 'sent', 0, 'reason', 'already_sent_today');
    end if;
  end if;

  -- 오늘 일정 모으기 (시간 순)
  select count(*), min(id)
    into v_count, v_first_event
  from public.calendar_events
  where event_date = v_today;

  -- 발송 시각이 지났다는 기록은 일정 유무와 관계없이 남긴다
  -- (하루 한 번만 판단 → 낮에 일정이 추가돼도 뒤늦게 알림이 튀지 않는다)
  if not p_force then
    insert into public.app_private_settings (key, value)
    values ('daily_service_last_sent', v_today::text)
    on conflict (key) do update set value = excluded.value, updated_at = now();
  end if;

  if coalesce(v_count, 0) = 0 then
    return jsonb_build_object('ok', true, 'sent', 0, 'reason', 'no_events');
  end if;

  select string_agg(line, E'\n' order by ord)
    into v_body
  from (
    select
      e.time as ord,
      coalesce(e.time, '') || ' ' || coalesce(e.title, '봉사') ||
      coalesce(' · ' || nullif(e.place, ''), '') ||
      coalesce(' (' || nullif(e.leader_name, '') || ')', '') as line
    from public.calendar_events e
    where e.event_date = v_today
  ) s;

  v_title := '오늘 봉사 마련 ' || v_count || '건';
  v_link := case when v_count = 1 then '/calendar?openEvent=' || v_first_event else '/calendar' end;

  -- 받을 사람: 활성 사용자 중 이 알림을 끄지 않은 사람
  select array_agg(u.id)
    into v_recipients
  from public.app_users u
  left join public.notification_preferences p on p.user_id = u.id
  where coalesce(u.is_active, true) is true
    and coalesce(u.approval_status, 'approved') = 'approved'
    and coalesce(p.push_daily_service, true) is true;

  if v_recipients is null or cardinality(v_recipients) = 0 then
    return jsonb_build_object('ok', true, 'sent', 0, 'reason', 'no_recipients');
  end if;

  -- 받을 사람은 위에서 이미 걸렀다 (insert_notifications 의 종류별 필터에는
  -- daily_service 항목이 없어 그대로 통과하므로, 여기서 거른 목록을 그대로 쓴다)
  perform public.insert_notifications(v_recipients, 'daily_service', v_title, v_body, v_link, null::integer);
  perform public.dispatch_push_notification(v_recipients, 'daily_service', v_title, v_body, v_link, null::integer);

  return jsonb_build_object(
    'ok', true,
    'sent', cardinality(v_recipients),
    'events', v_count,
    'title', v_title,
    'body', v_body
  );
end;
$$;

revoke all on function public.send_daily_service_digest(boolean) from anon, authenticated;

-- ─── 4. 관리자 설정 RPC ──────────────────────────────────────
create or replace function public.get_daily_service_settings(p_token text)
returns table (enabled boolean, send_time text, last_sent text)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_role text;
  v_token uuid;
begin
  begin
    v_token := p_token::uuid;
  exception when others then
    raise exception 'invalid session';
  end;

  select u.role into v_role
  from public.auth_sessions s
  join public.app_users u on u.id = s.user_id
  where s.token = v_token
    and (s.expires_at is null or s.expires_at > now())
    and coalesce(u.is_active, true) = true
  limit 1;

  if v_role not in ('admin', 'developer') then
    raise exception 'permission denied';
  end if;

  return query
  select
    coalesce((select aps.value = 'true' from public.app_private_settings aps where aps.key = 'daily_service_enabled'), true),
    coalesce((select aps.value from public.app_private_settings aps where aps.key = 'daily_service_time'), '09:00'),
    (select aps.value from public.app_private_settings aps where aps.key = 'daily_service_last_sent');
end;
$$;

grant execute on function public.get_daily_service_settings(text) to anon, authenticated;

create or replace function public.update_daily_service_settings(
  p_token text,
  p_enabled boolean,
  p_send_time text
)
returns table (enabled boolean, send_time text, last_sent text)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_role text;
  v_token uuid;
  v_time time;
begin
  begin
    v_token := p_token::uuid;
  exception when others then
    raise exception 'invalid session';
  end;

  select u.role into v_role
  from public.auth_sessions s
  join public.app_users u on u.id = s.user_id
  where s.token = v_token
    and (s.expires_at is null or s.expires_at > now())
    and coalesce(u.is_active, true) = true
  limit 1;

  if v_role not in ('admin', 'developer') then
    raise exception 'permission denied';
  end if;

  begin
    v_time := p_send_time::time;
  exception when others then
    raise exception 'invalid time';
  end;

  insert into public.app_private_settings (key, value)
  values ('daily_service_enabled', case when p_enabled then 'true' else 'false' end)
  on conflict (key) do update set value = excluded.value, updated_at = now();

  insert into public.app_private_settings (key, value)
  values ('daily_service_time', to_char(v_time, 'HH24:MI'))
  on conflict (key) do update set value = excluded.value, updated_at = now();

  return query select * from public.get_daily_service_settings(p_token);
end;
$$;

grant execute on function public.update_daily_service_settings(text, boolean, text) to anon, authenticated;

-- ─── 5. pg_cron: 5분마다 판단 (실제 발송은 하루 1회) ─────────
SELECT cron.unschedule('daily-service-digest')
WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'daily-service-digest');

SELECT cron.schedule(
  'daily-service-digest',
  '*/5 * * * *',
  'SELECT public.send_daily_service_digest()'
);

-- ─── 검증 (알림을 실제로 보내지 않고 확인) ───────────────────
-- 설정 확인:
--   select key, value from public.app_private_settings where key like 'daily_service%';
-- 스케줄 확인:
--   select jobname, schedule, active from cron.job where jobname = 'daily-service-digest';
-- 오늘 보낼 내용 미리보기 (발송 안 함):
--   select e.time, e.title, e.place, e.leader_name
--   from public.calendar_events e
--   where e.event_date = (now() at time zone 'Asia/Seoul')::date
--   order by e.time;
--
-- ⚠ 지금 즉시 실제 발송해서 시험하려면 (알림이 전체에게 갑니다):
--   select public.send_daily_service_digest(true);
