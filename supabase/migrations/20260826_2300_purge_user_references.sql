-- 사용자를 지웠을 때 이름 잔재를 정리한다.
--
-- 원칙: **지난 기록은 남기고, 앞으로의 것만 뗀다.**
--   지난 것(방문 이력·봉사 세션·댓글·채팅·공지·운영로그·이미 지난 일정의 참가)은
--   그 사람이 실제로 한 일이라 지우면 회중 기록이 사라진다. 그대로 둔다.
--   앞으로의 것(카드 담당, 오늘 이후 일정의 인도자·팀 배정)은 없는 사람이라 뗀다.
--
-- 왜 필요한가: 삭제 코드가 세 표만 치우고 있었다. 그래서 지운 사람이
-- 미래 일정의 인도자 줄과 팀 배정에 그대로 남았다 (인도자는 쉼표 목록이라 더 안 걸렸다).

-- 쉼표 목록에서 이름 하나를 뺀다.
create or replace function public.remove_from_name_list(p_list text, p_name text)
returns text
language sql
immutable
as $$
  select coalesce(string_agg(v, ', ' order by ord), '')
  from (
    select btrim(v) as v, ord
    from unnest(string_to_array(coalesce(p_list, ''), ',')) with ordinality as t(v, ord)
  ) x
  where v <> '' and v <> p_name
$$;

create or replace function public.purge_user_name_references(
  p_token uuid,
  p_name text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor_id   integer;
  v_actor_role text;
  v_removed    jsonb := '{}'::jsonb;
  n            integer;
begin
  -- 일괄 정리는 알림을 끈 채로 돈다. 이름 표기만 바뀐 걸 '일정이 변경되었습니다' 로
  -- 쏘아 회중 전체에 푸시가 갔던 적이 있다. 이 표식은 이 트랜잭션 안에서만 유효하다.
  perform set_config('app.suppress_notifications', 'on', true);

  v_actor_id := public.verify_session(p_token);
  if v_actor_id is null then
    raise exception '세션이 유효하지 않습니다';
  end if;
  select role into v_actor_role from public.app_users where id = v_actor_id;
  if v_actor_role not in ('admin', 'developer') then
    raise exception '사용자 정리는 관리자만 할 수 있습니다';
  end if;

  if p_name is null or btrim(p_name) = '' then
    return jsonb_build_object('ok', false, 'reason', 'invalid_name');
  end if;

  -- 아직 쓰는 사람이면 막는다. 실수로 산 사람 배정을 날리는 걸 방지한다.
  if exists (select 1 from public.app_users where name = p_name) then
    return jsonb_build_object('ok', false, 'reason', 'still_active',
      'message', '아직 있는 사용자입니다 — 계정을 먼저 지우세요');
  end if;

  -- 1) 카드 담당 (앞으로의 일)
  delete from public.card_leader_assignments where user_name = p_name;
  get diagnostics n = row_count; v_removed := v_removed || jsonb_build_object('card_leader_assignments', n);
  delete from public.card_assignments where user_name = p_name;
  get diagnostics n = row_count; v_removed := v_removed || jsonb_build_object('card_assignments', n);
  update public.cards set leader_name = null where leader_name = p_name;
  get diagnostics n = row_count; v_removed := v_removed || jsonb_build_object('cards.leader_name', n);

  -- 2) 정기방문 담당 — 담당자가 없는 정기방문은 뜻이 없어 줄째로 지운다
  delete from public.regular_visits where visitor_name = p_name;
  get diagnostics n = row_count; v_removed := v_removed || jsonb_build_object('regular_visits', n);
  update public.return_visits set assigned_user_name = '' where assigned_user_name = p_name;
  get diagnostics n = row_count; v_removed := v_removed || jsonb_build_object('return_visits.assigned', n);

  -- 3) 오늘 이후 일정만 뗀다. 지난 일정의 참가 기록은 그 사람이 실제로 나온 것이다
  delete from public.event_participants a
   where a.user_name = p_name
     and exists (select 1 from public.calendar_events e
                  where e.id = a.event_id and e.event_date >= current_date);
  get diagnostics n = row_count; v_removed := v_removed || jsonb_build_object('event_participants(예정)', n);

  delete from public.event_card_assignment_cards a
   where a.user_name = p_name
     and exists (select 1 from public.calendar_events e
                  where e.id = a.event_id and e.event_date >= current_date);
  get diagnostics n = row_count; v_removed := v_removed || jsonb_build_object('event_card_assignment_cards(예정)', n);

  delete from public.event_card_assignments a
   where a.user_name = p_name
     and exists (select 1 from public.calendar_events e
                  where e.id = a.event_id and e.event_date >= current_date);
  get diagnostics n = row_count; v_removed := v_removed || jsonb_build_object('event_card_assignments(예정)', n);

  delete from public.event_informal_assignments a
   where a.user_name = p_name
     and exists (select 1 from public.calendar_events e
                  where e.id = a.event_id and e.event_date >= current_date);
  get diagnostics n = row_count; v_removed := v_removed || jsonb_build_object('event_informal_assignments(예정)', n);

  delete from public.event_restaurant_assignments a
   where a.user_name = p_name
     and exists (select 1 from public.calendar_events e
                  where e.id = a.event_id and e.event_date >= current_date);
  get diagnostics n = row_count; v_removed := v_removed || jsonb_build_object('event_restaurant_assignments(예정)', n);

  -- 4) 일정 인도자 — 쉼표 목록. 여기가 예전 삭제 코드에서 통째로 빠져 있었다
  update public.calendar_events
     set leader_name = public.remove_from_name_list(leader_name, p_name)
   where event_date >= current_date
     and p_name = any (select btrim(v) from unnest(string_to_array(leader_name, ',')) v);
  get diagnostics n = row_count; v_removed := v_removed || jsonb_build_object('calendar_events.leader_name(예정)', n);

  return jsonb_build_object('ok', true, 'name', p_name, 'removed', v_removed);
end;
$$;

revoke all on function public.purge_user_name_references(uuid, text) from public;
grant execute on function public.purge_user_name_references(uuid, text) to anon, authenticated;
grant execute on function public.remove_from_name_list(text, text) to anon, authenticated;
