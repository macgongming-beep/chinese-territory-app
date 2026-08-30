-- 손으로 적은 세대명 `들어갈 수 없음`을 앱의 표준값 `출입불가`로 통일한다.
-- 2026-08-31 운영 읽기 감사: 정확히 3건, 모두 대상외, 같은 건물 중복 0건.
-- 방문 기록은 unit_id FK로 연결되므로 세대명 변경의 영향을 받지 않는다.

do $$
declare
  v_total integer;
  v_safe integer;
  v_updated integer;
begin
  select count(*) into v_total
  from public.units
  where number = '들어갈 수 없음';

  select count(*) into v_safe
  from public.units u
  where u.number = '들어갈 수 없음'
    and u.status = '대상외'
    and not exists (
      select 1 from public.units other
      where other.building_id = u.building_id
        and other.number = '출입불가'
        and other.id <> u.id
    );

  if v_total <> 3 or v_safe <> 3 then
    raise exception
      '예상한 안전 대상 3건과 다릅니다 (전체 %, 안전 %). 다시 감사하세요',
      v_total, v_safe;
  end if;

  update public.units
  set number = '출입불가'
  where number = '들어갈 수 없음'
    and status = '대상외';
  get diagnostics v_updated = row_count;

  if v_updated <> 3 then
    raise exception '3건을 바꿔야 하는데 %건이 바뀌었습니다', v_updated;
  end if;
  if exists (select 1 from public.units where number = '들어갈 수 없음') then
    raise exception '옛 표기가 아직 남아 있습니다';
  end if;

  raise notice '✅ 세대명 3건을 출입불가로 통일했습니다';
end $$;
