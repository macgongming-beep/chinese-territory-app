-- 배정에 팀 구분 저장 (같은 구역을 여러 팀이 맡을 때 팀이 합쳐지는 문제 해결)
-- Supabase SQL Editor 에서 실행
--
-- 배경: event_card_assignments 에는 "누가 어떤 카드를 맡는지"만 저장되어,
--       불러올 때 "같은 카드 구성 = 같은 팀"으로 묶었다.
--       그래서 1팀·2팀이 똑같이 풍덕천12 만 맡으면 한 팀으로 합쳐져 버렸다.
-- 해결: 팀 식별자(team_key)를 함께 저장해 복원 시 팀을 그대로 나눈다.
--       (기존 행은 team_key 가 null → 예전처럼 카드 구성으로 묶여 하위호환)

alter table public.event_card_assignments
  add column if not exists team_key text;

-- 배정 저장 RPC: assignments 항목의 teamKey 를 함께 저장
create or replace function public.assign_cards_bulk_tx(
  p_token uuid,
  p_event_id integer,
  p_assignments jsonb,          -- [{ "userName": "장웅", "cardIds": [51,53], "teamKey": "t1" }, ...]
  p_status text default null,
  p_expected_shared_at text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor_id integer;
  v_actor_name text;
  v_current_shared_at timestamptz;
  v_expected timestamptz;
  v_item jsonb;
  v_card_id bigint;
  v_count integer := 0;
begin
  -- 1) 인증
  v_actor_id := public.verify_session(p_token);
  if v_actor_id is null then
    raise exception '세션이 유효하지 않습니다';
  end if;
  select name into v_actor_name from public.app_users where id = v_actor_id;

  -- 2) 낙관적 잠금
  if p_expected_shared_at is not null then
    select assignment_shared_at into v_current_shared_at
    from public.calendar_events where id = p_event_id;
    v_expected := p_expected_shared_at::timestamptz;
    if v_current_shared_at is not null
       and abs(extract(epoch from (v_current_shared_at - v_expected))) > 1 then
      return jsonb_build_object(
        'ok', false,
        'conflict', true,
        'server_shared_at', v_current_shared_at,
        'message', '편집하는 사이 다른 사람이 배정을 공유했습니다. 새로고침 후 다시 시도하세요.'
      );
    end if;
  end if;

  -- 3) 기존 배정 정리
  delete from public.event_card_assignment_cards where event_id = p_event_id;
  delete from public.event_card_assignments where event_id = p_event_id;

  -- 4) 새 배정 insert
  for v_item in select * from jsonb_array_elements(coalesce(p_assignments, '[]'::jsonb))
  loop
    declare
      v_user text := v_item->>'userName';
      v_cards jsonb := coalesce(v_item->'cardIds', '[]'::jsonb);
      v_team text := v_item->>'teamKey';
      v_first_card bigint;
    begin
      if v_user is null or length(trim(v_user)) = 0 then
        continue;
      end if;
      if jsonb_array_length(v_cards) > 0 then
        v_first_card := (v_cards->>0)::bigint;
        insert into public.event_card_assignments (event_id, user_name, assigned_card_id, assigned_by, team_key)
        values (p_event_id, v_user, v_first_card, v_actor_name, v_team);
        for v_card_id in select (value)::text::bigint from jsonb_array_elements(v_cards)
        loop
          insert into public.event_card_assignment_cards (event_id, user_name, card_id)
          values (p_event_id, v_user, v_card_id);
        end loop;
        v_count := v_count + 1;
      end if;
    end;
  end loop;

  -- 5) 공유 상태
  if p_status is not null then
    update public.calendar_events
    set assignment_status = p_status,
        assignment_shared_at = case when p_status = 'shared' then now() else null end,
        assignment_shared_by = case when p_status = 'shared' then v_actor_name else null end
    where id = p_event_id;
  end if;

  return jsonb_build_object('ok', true, 'count', v_count);
end;
$$;

grant execute on function public.assign_cards_bulk_tx(uuid, integer, jsonb, text, text) to anon, authenticated;
