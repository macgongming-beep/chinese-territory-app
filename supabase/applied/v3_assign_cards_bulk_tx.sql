-- =============================================================
-- 배정 공유 — 단일 트랜잭션 + 낙관적 잠금(version check)
-- 작성일: 2026-06
--
-- 문제 (검토 P0-2, P0-3):
--   기존 클라이언트는 delete → delete → insert → insert → status update 를
--   따로 실행해서, 중간 실패 시 배정이 통째로 날아가거나
--   "대표만 저장됐는데 공유됨" 상태가 될 수 있었음.
--   또 편집 중 다른 사람이 먼저 공유하면 오래된 draft가 덮어씀.
--
-- 해결:
--   - 이 함수 하나로 묶음 (PL/pgSQL = 자동 트랜잭션, 실패 시 전체 롤백)
--   - p_expected_shared_at: 클라가 "편집 시작 때 본 공유시각"을 보냄.
--     서버의 현재 assignment_shared_at 과 다르면 → 그 사이 누가 공유함 → 거부.
--
-- 적용: Supabase SQL Editor 에서 통째로 실행
-- =============================================================

create or replace function public.assign_cards_bulk_tx(
  p_token uuid,
  p_event_id integer,
  p_assignments jsonb,          -- [{ "userName": "장웅", "cardIds": [51,53] }, ...]
  p_status text default null,    -- 'shared' | 'confirmed' | null
  p_expected_shared_at text default null  -- 클라가 본 shared_at (ISO) — 충돌 감지용. null이면 검사 안 함
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

  -- 2) 낙관적 잠금: 편집 시작 때 본 shared_at 과 현재 값 비교
  if p_expected_shared_at is not null then
    select assignment_shared_at into v_current_shared_at
    from public.calendar_events where id = p_event_id;
    v_expected := p_expected_shared_at::timestamptz;
    -- 둘 다 값이 있고 다르면 충돌 (그 사이 누가 공유함)
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

  -- 3) 기존 배정 정리 (트랜잭션 내 — 실패 시 자동 롤백)
  delete from public.event_card_assignment_cards where event_id = p_event_id;
  delete from public.event_card_assignments where event_id = p_event_id;

  -- 4) 새 배정 insert
  for v_item in select * from jsonb_array_elements(coalesce(p_assignments, '[]'::jsonb))
  loop
    declare
      v_user text := v_item->>'userName';
      v_cards jsonb := coalesce(v_item->'cardIds', '[]'::jsonb);
      v_first_card bigint;
    begin
      if v_user is null or length(trim(v_user)) = 0 then
        continue;
      end if;
      -- 대표 카드 = 첫 번째
      if jsonb_array_length(v_cards) > 0 then
        v_first_card := (v_cards->>0)::bigint;
        insert into public.event_card_assignments (event_id, user_name, assigned_card_id, assigned_by)
        values (p_event_id, v_user, v_first_card, v_actor_name);
        -- 다중 카드
        for v_card_id in select (value)::text::bigint from jsonb_array_elements(v_cards)
        loop
          insert into public.event_card_assignment_cards (event_id, user_name, card_id)
          values (p_event_id, v_user, v_card_id);
        end loop;
        v_count := v_count + 1;
      end if;
    end;
  end loop;

  -- 5) 공유 상태 (모든 insert 성공한 뒤에만)
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

-- ── 검증 ────────────────────────────────────────────────
-- select public.assign_cards_bulk_tx(
--   '토큰'::uuid, 42,
--   '[{"userName":"장웅","cardIds":[51,53]}]'::jsonb,
--   'shared', null
-- );
