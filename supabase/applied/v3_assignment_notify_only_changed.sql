-- 배정 재공유 시 "바뀐 사람에게만" 알림 보내기
-- Supabase SQL Editor 에서 실행 (클라이언트 코드 변경 없음)
--
-- 배경:
--   assign_cards_bulk_tx 는 저장할 때 기존 배정을 전부 delete 후 다시 insert 한다.
--   event_card_assignments 의 INSERT 트리거가 알림을 보내므로,
--   팀도 구역도 그대로인 사람에게까지 "배정되었습니다" 알림이 매번 다시 갔다.
--
-- 해결:
--   저장 직전에 사람별 "배정 지문"을 만들어 이전 상태와 비교한다.
--     지문 = 맡은 카드 목록 + 같은 팀 사람 목록
--     (구역이 바뀌어도, 팀 구성이 바뀌어도 지문이 달라진다)
--   지문이 똑같은 사람 목록을 트랜잭션 로컬 설정에 담아 두고,
--   트리거가 그 목록에 있는 사람은 알림을 건너뛴다.
--   delete/insert 자체는 그대로라 team_key·순서 등 저장 로직은 영향 없다.
--
-- 주의: 팀 식별자(team_key)는 저장할 때마다 새로 만들어질 수 있어 비교 기준으로 쓰지 않는다.
--       대신 team_key 로 묶은 뒤 "같은 팀 사람 이름 목록"을 비교한다.

-- ─── 1. 트리거: 건너뛸 사람이면 알림 생략 ────────────────────
create or replace function public.notify_on_card_assignment()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_recipient_id integer;
  v_assigner_id integer;
  v_event_title text;
  v_event_date date;
  v_event_time text;
  v_card_name text;
  v_title text;
  v_body text;
  v_link text;
  v_skip text;
begin
  -- 배정 내용이 그대로인 사람은 알림 생략 (assign_cards_bulk_tx 가 목록을 넣어 준다)
  v_skip := current_setting('app.skip_assignment_notify', true);
  if coalesce(v_skip, '') <> '' then
    begin
      if (v_skip::jsonb) ? new.user_name then
        return new;
      end if;
    exception when others then
      null;  -- 설정값이 깨져 있으면 평소대로 알림
    end;
  end if;

  -- 배정 대상자(user_name) → user_id
  select id into v_recipient_id
  from public.app_users
  where name = new.user_name
    and coalesce(is_active, true) is true
  limit 1;

  if v_recipient_id is null then
    return new;
  end if;

  -- 배정한 사람(assigned_by) → user_id (자기 자신에게 보내지 않기 위해)
  if coalesce(new.assigned_by, '') <> '' then
    select id into v_assigner_id
    from public.app_users
    where name = new.assigned_by
    limit 1;
  end if;

  if v_assigner_id is not null and v_assigner_id = v_recipient_id then
    return new;
  end if;

  select title, event_date, time
  into v_event_title, v_event_date, v_event_time
  from public.calendar_events
  where id = new.event_id;

  select name into v_card_name
  from public.cards
  where id = new.assigned_card_id;

  v_title := '봉사 카드가 배정되었습니다';
  v_body := coalesce(v_event_title, '봉사 일정') ||
            case when v_event_date is not null
              then ' · ' || to_char(v_event_date, 'YYYY-MM-DD') ||
                   coalesce(' ' || v_event_time, '')
              else ''
            end ||
            case when v_card_name is not null
              then ' · ' || v_card_name
              else ''
            end;
  v_link := '/territory?assignmentEvent=' || new.event_id;

  perform public.insert_notifications(
    array[v_recipient_id], 'assignment', v_title, v_body, v_link, new.event_id
  );
  perform public.dispatch_push_notification(
    array[v_recipient_id], 'assignment', v_title, v_body, v_link, new.event_id
  );

  return new;
end;
$$;

-- ─── 2. 저장 RPC: 이전/새 배정 지문 비교 → 건너뛸 사람 계산 ──
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
  v_old jsonb;
  v_new jsonb;
  v_skip jsonb;
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

  -- 3) 이전 배정 지문 (사람 → 카드목록|같은팀사람목록)
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

  -- 4) 새 배정 지문 (같은 규칙)
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
      and coalesce(array_length(cards, 1), 0) > 0
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

  -- 5) 이전과 지문이 같은 사람 = 알림 생략 대상
  select coalesce(jsonb_agg(n.key), '[]'::jsonb)
  into v_skip
  from jsonb_each_text(v_new) n
  where v_old ? n.key and v_old->>n.key = n.value;

  -- 트랜잭션 로컬 설정 → 이 저장에서 실행되는 트리거만 읽는다
  perform set_config('app.skip_assignment_notify', v_skip::text, true);

  -- 6) 기존 배정 정리
  delete from public.event_card_assignment_cards where event_id = p_event_id;
  delete from public.event_card_assignments where event_id = p_event_id;

  -- 7) 새 배정 insert
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

  -- 8) 공유 상태
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

grant execute on function public.assign_cards_bulk_tx(uuid, integer, jsonb, text, text) to anon, authenticated;

-- ─── 검증 (알림을 실제로 보내지 않고 확인하는 법) ────────────
-- 저장 후 반환값에 skipped_unchanged 가 몇 명인지 나온다.
--   - 아무것도 안 바꾸고 배정 공유 → skipped_unchanged = 전체 인원, notified = 0
--   - 한 팀만 구역 변경 후 공유    → 그 팀 인원만 notified
--
-- 최근 알림이 누구에게 갔는지 확인:
--   select user_id, title, body, created_at from public.notifications
--   where type = 'assignment' order by created_at desc limit 20;
