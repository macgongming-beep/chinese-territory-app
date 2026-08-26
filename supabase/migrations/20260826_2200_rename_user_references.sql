-- 닉네임을 바꾸면 옛 이름으로 저장된 기록을 전부 새 이름으로 옮긴다.
--
-- 왜 필요한가:
--   이 앱은 배정·기록을 user_id 가 아니라 **이름 문자열**로 들고 있다.
--   그래서 이름을 바꾸면 옛 기록이 그 사람 것이 아니게 된다.
--   클라이언트가 테이블마다 update 를 날리고 있었는데 세 가지 구멍이 있었다:
--     ① calendar_events.leader_name 은 "가, 나, 다" 처럼 **쉼표로 이어붙인 목록**이라
--        '이름 = 옛이름' 으로는 안 걸린다. 실제로 인도자 줄에 옛 이름이 남았다.
--     ② chat_messages / service_logs 는 anon 쓰기 권한이 없어 조용히 실패했다.
--     ③ 댓글·공지·식당요청·전화조사 등 여덟 칸이 목록에서 빠져 있었다.
--   게다가 update 열한 번이 각각 따로라 중간에 실패하면 반만 옮겨진 채 끝났다.
--
-- 그래서 한 트랜잭션짜리 RPC 로 옮긴다. 유니크 제약이 있는 표는
-- **새 이름 줄이 이미 있으면 옛 줄을 지운다** (합쳐지는 게 맞다).

-- 쉼표 목록 안에서 이름 하나를 갈아끼우고 중복을 접는다.
-- 순서는 처음 나온 자리를 지킨다.
create or replace function public.rename_in_name_list(p_list text, p_old text, p_new text)
returns text
language sql
immutable
as $$
  select string_agg(name, ', ' order by first_pos)
  from (
    select name, min(pos) as first_pos
    from (
      select case when btrim(v) = p_old then p_new else btrim(v) end as name, ord as pos
      from unnest(string_to_array(coalesce(p_list, ''), ',')) with ordinality as t(v, ord)
      where btrim(v) <> ''
    ) x
    group by name
  ) y
$$;

create or replace function public.rename_user_name_references(
  p_token uuid,
  p_old text,
  p_new text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor_id   integer;
  v_actor_name text;
  v_actor_role text;
  v_moved      jsonb := '{}'::jsonb;
  n            integer;
begin
  -- 1) 인증
  v_actor_id := public.verify_session(p_token);
  if v_actor_id is null then
    raise exception '세션이 유효하지 않습니다';
  end if;
  select name, role into v_actor_name, v_actor_role
  from public.app_users where id = v_actor_id;

  -- 2) 권한: 관리자거나, 자기 이름을 바꾼 경우만
  --    (이름은 이미 app_users 에서 바뀐 뒤라 본인 현재 이름 = p_new 다)
  if v_actor_role not in ('admin', 'developer') and v_actor_name is distinct from p_new then
    raise exception '다른 사람의 기록을 옮길 권한이 없습니다';
  end if;

  if p_old is null or p_new is null
     or btrim(p_old) = '' or btrim(p_new) = '' or p_old = p_new then
    return jsonb_build_object('ok', false, 'reason', 'invalid_names');
  end if;

  -- 3) 유니크 제약이 있는 표: 새 이름 줄이 이미 있으면 옛 줄을 버린다
  delete from public.event_participants a where a.user_name = p_old and exists (
    select 1 from public.event_participants b
    where b.event_id = a.event_id and b.user_name = p_new);
  delete from public.event_card_assignments a where a.user_name = p_old and exists (
    select 1 from public.event_card_assignments b
    where b.event_id = a.event_id and b.user_name = p_new);
  delete from public.event_card_assignment_cards a where a.user_name = p_old and exists (
    select 1 from public.event_card_assignment_cards b
    where b.event_id = a.event_id and b.user_name = p_new
      and b.card_id is not distinct from a.card_id);
  delete from public.event_informal_assignments a where a.user_name = p_old and exists (
    select 1 from public.event_informal_assignments b
    where b.event_id = a.event_id and b.user_name = p_new
      and b.asset_id is not distinct from a.asset_id);
  delete from public.card_assignments a where a.user_name = p_old and exists (
    select 1 from public.card_assignments b
    where b.card_id = a.card_id and b.user_name = p_new);
  delete from public.card_leader_assignments a where a.user_name = p_old and exists (
    select 1 from public.card_leader_assignments b
    where b.card_id = a.card_id and b.user_name = p_new);
  delete from public.service_sessions a where a.user_name = p_old and exists (
    select 1 from public.service_sessions b
    where b.user_name = p_new
      and b.service_date    is not distinct from a.service_date
      and b.time_slot       is not distinct from a.time_slot
      and b.primary_card_id is not distinct from a.primary_card_id);

  -- 4) 이름 한 칸짜리 표를 전부 옮긴다
  update public.event_participants          set user_name          = p_new where user_name          = p_old;
  get diagnostics n = row_count; v_moved := v_moved || jsonb_build_object('event_participants', n);
  update public.event_card_assignments      set user_name          = p_new where user_name          = p_old;
  get diagnostics n = row_count; v_moved := v_moved || jsonb_build_object('event_card_assignments', n);
  update public.event_card_assignment_cards set user_name          = p_new where user_name          = p_old;
  get diagnostics n = row_count; v_moved := v_moved || jsonb_build_object('event_card_assignment_cards', n);
  update public.event_informal_assignments  set user_name          = p_new where user_name          = p_old;
  get diagnostics n = row_count; v_moved := v_moved || jsonb_build_object('event_informal_assignments', n);
  update public.event_restaurant_assignments set user_name         = p_new where user_name          = p_old;
  get diagnostics n = row_count; v_moved := v_moved || jsonb_build_object('event_restaurant_assignments', n);
  update public.card_assignments            set user_name          = p_new where user_name          = p_old;
  get diagnostics n = row_count; v_moved := v_moved || jsonb_build_object('card_assignments', n);
  update public.card_leader_assignments     set user_name          = p_new where user_name          = p_old;
  get diagnostics n = row_count; v_moved := v_moved || jsonb_build_object('card_leader_assignments', n);
  update public.service_sessions            set user_name          = p_new where user_name          = p_old;
  get diagnostics n = row_count; v_moved := v_moved || jsonb_build_object('service_sessions', n);
  update public.cards                       set leader_name        = p_new where leader_name        = p_old;
  get diagnostics n = row_count; v_moved := v_moved || jsonb_build_object('cards', n);
  update public.visit_histories             set visitor_name       = p_new where visitor_name       = p_old;
  get diagnostics n = row_count; v_moved := v_moved || jsonb_build_object('visit_histories', n);
  update public.regular_visits              set visitor_name       = p_new where visitor_name       = p_old;
  get diagnostics n = row_count; v_moved := v_moved || jsonb_build_object('regular_visits', n);
  -- 여기부터는 예전에 빠져 있던 칸들
  update public.chat_messages               set author_name        = p_new where author_name        = p_old;
  get diagnostics n = row_count; v_moved := v_moved || jsonb_build_object('chat_messages', n);
  update public.comments                    set author_name        = p_new where author_name        = p_old;
  get diagnostics n = row_count; v_moved := v_moved || jsonb_build_object('comments', n);
  update public.notices                     set author             = p_new where author             = p_old;
  get diagnostics n = row_count; v_moved := v_moved || jsonb_build_object('notices', n);
  update public.service_logs                set actor_name         = p_new where actor_name         = p_old;
  get diagnostics n = row_count; v_moved := v_moved || jsonb_build_object('service_logs', n);
  update public.return_visits               set assigned_user_name = p_new where assigned_user_name = p_old;
  get diagnostics n = row_count; v_moved := v_moved || jsonb_build_object('return_visits.assigned', n);
  update public.return_visits               set created_by         = p_new where created_by         = p_old;
  get diagnostics n = row_count; v_moved := v_moved || jsonb_build_object('return_visits.created_by', n);
  update public.restaurant_requests         set requested_by       = p_new where requested_by       = p_old;
  get diagnostics n = row_count; v_moved := v_moved || jsonb_build_object('restaurant_requests.requested_by', n);
  update public.restaurant_requests         set reviewer           = p_new where reviewer           = p_old;
  get diagnostics n = row_count; v_moved := v_moved || jsonb_build_object('restaurant_requests.reviewer', n);
  update public.phone_surveys               set checked_by         = p_new where checked_by         = p_old;
  get diagnostics n = row_count; v_moved := v_moved || jsonb_build_object('phone_surveys.checked_by', n);
  update public.phone_surveys               set uploaded_by        = p_new where uploaded_by        = p_old;
  get diagnostics n = row_count; v_moved := v_moved || jsonb_build_object('phone_surveys.uploaded_by', n);

  -- 5) 쉼표 목록 (일정 인도자) — 이게 이번에 눈에 보인 그 줄이다
  update public.calendar_events
  set leader_name = public.rename_in_name_list(leader_name, p_old, p_new)
  where leader_name is not null
    -- 목록의 한 칸과 정확히 같을 때만. 이게 없으면 띄어쓰기만 다른 줄까지
    -- 애먼 일정이 전부 갱신된다 ('가,나' → '가, 나')
    and p_old = any (select btrim(v) from unnest(string_to_array(leader_name, ',')) v);
  get diagnostics n = row_count; v_moved := v_moved || jsonb_build_object('calendar_events.leader_name', n);

  return jsonb_build_object('ok', true, 'old', p_old, 'new', p_new, 'moved', v_moved);
end;
$$;

revoke all on function public.rename_user_name_references(uuid, text, text) from public;
grant execute on function public.rename_user_name_references(uuid, text, text) to anon, authenticated;
grant execute on function public.rename_in_name_list(text, text, text) to anon, authenticated;
