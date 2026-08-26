-- 구역 카드 없는 팀 — 비공식 봉사만 맡은 팀을 저장할 수 있게 한다
--
-- 문제: 팀에 비공식 카드만 주면 팀이 만들어지지 않았다.
--   event_card_assignments.assigned_card_id 가 NOT NULL 이라 구역 카드 없는
--   배정은 이 표에 들어갈 자리가 없었고, 클라이언트와 RPC 도 카드 0개인 사람을
--   통째로 버렸다. 비공식 배정(event_informal_assignments)은 별도 표라
--   팀 개념 밖에 있다.
--
-- 고침: 배정은 '이 일정에 이 사람이 참여한다' 가 본질이고, 구역 카드는
--   있을 수도 없을 수도 있다. NOT NULL 을 푼다.
--
-- 안전: 기존 행은 전부 값이 있으므로 영향 없다. 읽는 쪽은 이미 null 을 거르거나
--   (DesktopCalendar) 이번에 함께 고쳤다.

alter table public.event_card_assignments
  alter column assigned_card_id drop not null;

comment on column public.event_card_assignments.assigned_card_id is
  '대표 구역 카드. 비공식 봉사만 맡은 팀은 null 이다 (여러 카드는 event_card_assignment_cards).';

-- ── 배정 저장 RPC: 카드 0개인 사람도 넣는다 ─────────────────────
create or replace function public.assign_cards_bulk_tx(
  p_token uuid,
  p_event_id integer,
  p_assignments jsonb,
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
  v_old jsonb;
  v_new jsonb;
  v_skip jsonb;
begin
  v_actor_id := public.verify_session(p_token);
  if v_actor_id is null then
    raise exception '세션이 유효하지 않습니다';
  end if;
  select name into v_actor_name from public.app_users where id = v_actor_id;

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

  -- 이전 배정 지문
  with base as (
    select
      a.user_name,
      coalesce(
        (select array_agg(distinct c.card_id order by c.card_id)
         from public.event_card_assignment_cards c
         where c.event_id = a.event_id and c.user_name = a.user_name),
        case when a.assigned_card_id is null then array[]::bigint[]
             else array[a.assigned_card_id::bigint] end
      ) as cards,
      a.team_key
    from public.event_card_assignments a
    where a.event_id = p_event_id
  ),
  grp as (
    select user_name, cards,
           coalesce(nullif(team_key, ''), 'cards:' || array_to_string(cards, ',')) as gkey
    from base
  ),
  sig as (
    select g.user_name,
           array_to_string(g.cards, ',') || '|' ||
           (select string_agg(g2.user_name, ',' order by g2.user_name)
            from grp g2 where g2.gkey = g.gkey) as fingerprint
    from grp g
  )
  select coalesce(jsonb_object_agg(user_name, fingerprint), '{}'::jsonb)
  into v_old from sig;

  -- 새 배정 지문
  -- ⚠ 카드 0개인 사람도 넣는다. 예전에는 여기서 걸러서, 비공식만 맡은 팀이
  --   통째로 사라졌다.
  with items as (
    select
      v->>'userName' as user_name,
      coalesce(v->>'teamKey', '') as team_key,
      coalesce(
        (select array_agg(distinct e::bigint order by e::bigint)
         from jsonb_array_elements_text(coalesce(v->'cardIds', '[]'::jsonb)) e),
        array[]::bigint[]
      ) as cards
    from jsonb_array_elements(coalesce(p_assignments, '[]'::jsonb)) v
  ),
  valid as (
    select * from items
    where user_name is not null
      and length(trim(user_name)) > 0
  ),
  grp as (
    select user_name, cards,
           case when team_key = '' then 'cards:' || array_to_string(cards, ',') else team_key end as gkey
    from valid
  ),
  sig as (
    select g.user_name,
           array_to_string(g.cards, ',') || '|' ||
           (select string_agg(g2.user_name, ',' order by g2.user_name)
            from grp g2 where g2.gkey = g.gkey) as fingerprint
    from grp g
  )
  select coalesce(jsonb_object_agg(user_name, fingerprint), '{}'::jsonb)
  into v_new from sig;

  select coalesce(jsonb_agg(n.key), '[]'::jsonb)
  into v_skip
  from jsonb_each_text(v_new) n
  where v_old ? n.key and v_old->>n.key = n.value;

  perform set_config('app.skip_assignment_notify', v_skip::text, true);

  delete from public.event_card_assignment_cards where event_id = p_event_id;
  delete from public.event_card_assignments where event_id = p_event_id;

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

      -- 카드가 없으면 assigned_card_id 는 null 이다 (비공식만 맡은 팀)
      v_first_card := case when jsonb_array_length(v_cards) > 0
                           then (v_cards->>0)::bigint else null end;

      insert into public.event_card_assignments (event_id, user_name, assigned_card_id, assigned_by, team_key)
      values (p_event_id, v_user, v_first_card, v_actor_name, v_team);

      for v_card_id in select (value)::text::bigint from jsonb_array_elements(v_cards)
      loop
        insert into public.event_card_assignment_cards (event_id, user_name, card_id)
        values (p_event_id, v_user, v_card_id);
      end loop;
      v_count := v_count + 1;
    end;
  end loop;

  if p_status is not null then
    update public.calendar_events
    set assignment_status = p_status,
        assignment_shared_at = case when p_status = 'shared' then now() else null end,
        assignment_shared_by = case when p_status = 'shared' then v_actor_name else null end
    where id = p_event_id;
  end if;

  return jsonb_build_object(
    'ok', true,
    'count', v_count,
    'notified', v_count - jsonb_array_length(v_skip),
    'skipped_unchanged', jsonb_array_length(v_skip)
  );
end;
$$;
