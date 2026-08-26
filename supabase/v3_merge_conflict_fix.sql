-- =============================================================
-- 중복 주소 건물 병합 — 한 트랜잭션으로
--
-- 2026-08-25 고침: 흡수될 건물끼리의 호수 충돌을 놓치고 있었다.
--   기준 201 · 흡수A 101 · 흡수B 101호 → 충돌 아님으로 보고 둘 다 옮겼다.
--   이제 묶음 전체를 정규화 값으로 묶어, 두 건물 이상에 나타나면 충돌로 본다.
--
-- 왜 필요한가
--   지금은 클라이언트가 이름변경 → 호수이동 → 건물삭제를 순서대로 쏜다.
--   중간에 실패하면 앞의 변경이 남고, DB 와 화면이 어긋난다. rollback 이 없다.
--
--   그리고 클라이언트가 세운 계획은 **화면이 들고 있던 옛 데이터** 기준이다.
--   계획을 세운 뒤 다른 사람이 호수를 추가하면, 서버에는 충돌이 생겼는데
--   클라이언트는 모르고 병합을 진행한다. 그래서 여기서 잠그고 다시 판정한다.
--
-- 정책 (2026-08-24 사용자가 정함)
--   같은 호수 번호가 양쪽에 있으면 **그 주소 묶음은 통째로 건드리지 않는다.**
--   units 는 visit_histories · regular_visits 에 on delete cascade 로 물려 있어서,
--   겹치는 호수를 두고 원본을 지우면 방문 기록이 조용히 사라진다.
--   무엇을 남길지는 사람이 볼 판단이라 자동으로 정하지 않는다.
--
--   호수 비교는 표기 차이를 무시한다 (101 = 101호 = B02/B02호).
--   실제 데이터가 섞여 있다 — 숫자만 394 · '호' 붙은 것 337 · 그 밖 735.
--   src/utils/duplicateBuildingMerge.ts 의 normalizeUnitNumber 와 같은 규칙이다.
--
-- 적용: Supabase SQL Editor 에서 통째로 실행
-- =============================================================

-- ── 호수 표기 정규화 (충돌 판정 전용) ───────────────────────────
create or replace function public.normalize_unit_number(p_raw text)
returns text
language sql
immutable
as $$
  select case
    -- B02호 · 101호 · 0101 → B2 · 101 · 101
    when regexp_replace(coalesce(p_raw, ''), '\s', '', 'g') ~ '^[A-Za-z]*0*\d+호?$'
      then upper((regexp_match(regexp_replace(coalesce(p_raw, ''), '\s', '', 'g'),
                               '^([A-Za-z]*)0*(\d+)호?$'))[1])
           || (regexp_match(regexp_replace(coalesce(p_raw, ''), '\s', '', 'g'),
                            '^([A-Za-z]*)0*(\d+)호?$'))[2]
    -- '호별 방문' 같은 글자 라벨은 공백만 없앤다
    else regexp_replace(coalesce(p_raw, ''), '\s', '', 'g')
  end;
$$;

comment on function public.normalize_unit_number is
  '호수 표기 정규화. 병합 충돌 판정에만 쓴다 — 화면 표시는 원래 값 그대로.';

-- ── 주소 정규화 ─────────────────────────────────────────────────
create or replace function public.normalize_building_address(p_raw text)
returns text
language sql
immutable
as $$
  select replace(regexp_replace(lower(btrim(coalesce(p_raw, ''))), '\s', '', 'g'), '‐', '-');
$$;

-- ── 병합 ────────────────────────────────────────────────────────
create or replace function public.merge_duplicate_buildings_tx(
  p_token uuid,
  p_scope_card_id integer default null,          -- null 이면 전체
  p_name_overrides jsonb default '{}'::jsonb,    -- { "<기준건물id>": "새 이름" }
  p_selected_primary_ids integer[] default null  -- null 이면 전부
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor_id integer;
  v_role text;
  v_group record;
  v_new_name text;
  v_merged integer := 0;
  v_moved integer := 0;
  v_conflicts jsonb := '[]'::jsonb;
begin
  -- 1) 인증 — 관리자만
  v_actor_id := public.verify_session(p_token);
  if v_actor_id is null then
    raise exception '세션이 유효하지 않습니다';
  end if;

  select role into v_role from public.app_users where id = v_actor_id;
  if v_role not in ('admin', 'developer') then
    raise exception '권한이 없습니다 (관리자 전용)';
  end if;

  -- 2) 대상 건물을 **잠근다.** id 순서로 잠가 교착을 피한다.
  --    잠근 뒤에 판정해야 다른 사람이 방금 넣은 호수까지 본다.
  perform 1
  from public.buildings b
  where (p_scope_card_id is null or b.card_id = p_scope_card_id)
  order by b.id
  for update;

  perform 1
  from public.units u
  join public.buildings b on b.id = u.building_id
  where (p_scope_card_id is null or b.card_id = p_scope_card_id)
  order by u.id
  for update of u;

  -- 3) 같은 카드·같은 주소끼리 묶고, 잠근 최신 데이터로 충돌을 다시 판정한다
  for v_group in
    with grouped as (
      select
        b.card_id,
        public.normalize_building_address(b.address) as addr,
        array_agg(b.id order by b.id) as ids
      from public.buildings b
      where p_scope_card_id is null or b.card_id = p_scope_card_id
      group by 1, 2
      having count(*) > 1
    ),
    picked as (
      select g.*, g.ids[1] as primary_id, g.ids[2:] as absorbed_ids
      from grouped g
      where p_selected_primary_ids is null or g.ids[1] = any(p_selected_primary_ids)
    )
    select
      p.primary_id,
      p.absorbed_ids,
      -- 묶음 **전체**(기준 + 흡수될 것들)를 정규화한 호수로 묶고,
      -- 두 건물 이상에 나타나는 값을 충돌로 본다.
      --
      -- 예전에는 흡수될 것들을 기준 건물하고만 비교했다. 그래서
      --   기준 201 · 흡수A 101 · 흡수B 101호
      -- 를 충돌이 아니라고 보고 둘 다 옮겨, 한 건물에 같은 호수가 둘 생겼다.
      -- 클라이언트 순수 함수는 이걸 잡고 있었다 — 같은 규칙이 아니었다.
      (
        select coalesce(array_agg(distinct x.number order by x.number), '{}')
        from (
          select u.number, public.normalize_unit_number(u.number) as norm
          from public.units u
          where u.building_id = p.primary_id or u.building_id = any(p.absorbed_ids)
        ) x
        where x.norm in (
          select public.normalize_unit_number(u2.number)
          from public.units u2
          where u2.building_id = p.primary_id or u2.building_id = any(p.absorbed_ids)
          group by public.normalize_unit_number(u2.number)
          having count(distinct u2.building_id) > 1
        )
      ) as conflicting
    from picked p
  loop
    -- 4) 겹치면 이 묶음은 통째로 건드리지 않는다
    if coalesce(array_length(v_group.conflicting, 1), 0) > 0 then
      v_conflicts := v_conflicts || jsonb_build_object(
        'primaryId', v_group.primary_id,
        'conflictingNumbers', to_jsonb(v_group.conflicting)
      );
      continue;
    end if;

    -- 5) 이름 바꾸기 (지정했을 때만)
    v_new_name := p_name_overrides ->> v_group.primary_id::text;
    if v_new_name is not null and length(btrim(v_new_name)) > 0 then
      update public.buildings
      set name = btrim(v_new_name)
      where id = v_group.primary_id and name is distinct from btrim(v_new_name);
    end if;

    -- 6) 호수를 기준 건물로 옮긴다
    with moved as (
      update public.units
      set building_id = v_group.primary_id
      where building_id = any(v_group.absorbed_ids)
      returning 1
    )
    select v_moved + count(*) into v_moved from moved;

    -- 7) 빈 건물을 지운다.
    --    여기까지 왔으면 호수가 남아 있지 않다 — 남아 있으면 cascade 로
    --    방문 기록이 사라지므로, 만약을 위해 확인하고 아니면 통째로 되돌린다.
    if exists (select 1 from public.units where building_id = any(v_group.absorbed_ids)) then
      raise exception '호수가 남은 채로 건물을 지우려 했습니다 (건물 %) — 중단합니다',
        v_group.absorbed_ids;
    end if;

    delete from public.buildings where id = any(v_group.absorbed_ids);
    v_merged := v_merged + coalesce(array_length(v_group.absorbed_ids, 1), 0);
  end loop;

  return jsonb_build_object(
    'ok', true,
    'mergedBuildings', v_merged,
    'movedUnits', v_moved,
    'conflicts', v_conflicts
  );
end;
$$;

comment on function public.merge_duplicate_buildings_tx is
  '중복 주소 건물 병합. 한 트랜잭션이라 중간에 실패하면 전부 되돌아간다.
   호수가 겹치는 묶음은 건드리지 않고 conflicts 로 돌려준다.';

revoke all on function public.merge_duplicate_buildings_tx(uuid, integer, jsonb, integer[]) from public;
grant execute on function public.merge_duplicate_buildings_tx(uuid, integer, jsonb, integer[]) to anon, authenticated;
