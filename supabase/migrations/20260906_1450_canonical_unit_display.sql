-- 세대 이름이 정확히 101호 / B03호 형태일 때만 끝의 '호'를 제거한다.
--
-- 주의: public.normalize_unit_number()와 합치지 않는다.
--   normalize_unit_number = 중복 비교용. 대소문자와 앞자리 0까지 무시한다.
--   canonical_unit_number = 저장·표시용. 사용자가 적은 B03/b03과 앞자리 0을 보존한다.

create or replace function public.canonical_unit_number(p_raw text)
returns text
language sql
immutable
set search_path = ''
as $$
  select case
    when btrim(coalesce(p_raw, '')) ~ '^\d+\s*호$'
      or btrim(coalesce(p_raw, '')) ~ '^[Bb]\d+\s*호$'
    then regexp_replace(btrim(coalesce(p_raw, '')), '\s*호$', '')
    else btrim(coalesce(p_raw, ''))
  end;
$$;

comment on function public.canonical_unit_number(text) is
  '저장·표시용 세대 이름. 101호→101, B03호→B03만 수행하며 대문자화·앞자리 0 제거를 하지 않는다.';

-- 호만 뗐을 때 같은 건물 안에서 충돌하는 자료가 있으면 아무것도 바꾸지 않는다.
do $$
declare
  v_conflicts jsonb;
begin
  select jsonb_agg(to_jsonb(x)) into v_conflicts
  from (
    select building_id, public.canonical_unit_number(number) as number, array_agg(id order by id) as ids
    from public.units
    group by building_id, public.canonical_unit_number(number)
    having count(*) > 1
  ) x;

  if v_conflicts is not null then
    raise exception '호수 표준화 뒤 중복되는 세대가 있습니다: %', v_conflicts;
  end if;
end;
$$;

create or replace function public.canonicalize_unit_number_on_write()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  new.number := public.canonical_unit_number(new.number);
  if new.number = '' then raise exception '호수를 입력하세요'; end if;
  return new;
end;
$$;

drop trigger if exists canonicalize_unit_number_on_write_trigger on public.units;
create trigger canonicalize_unit_number_on_write_trigger
before insert or update of number on public.units
for each row execute function public.canonicalize_unit_number_on_write();

-- 연결된 활동 정기방문의 unit_number는 세대 이름을 복사한 칸이다.
-- display_name은 끝이 예전 세대 이름과 정확히 같은 자동 표시명만 고친다.
-- nickname은 사용자가 쓴 별칭이므로 절대 건드리지 않는다.
create or replace function public.sync_linked_return_visit_unit_number()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.number is distinct from old.number then
    update public.return_visits
    set
      unit_number = new.number,
      display_name = case
        when right(display_name, length(old.number)) = old.number
          then left(display_name, length(display_name) - length(old.number)) || new.number
        else display_name
      end
    where unit_id = new.id;
  end if;
  return new;
end;
$$;

revoke all on function public.sync_linked_return_visit_unit_number()
  from public, anon, authenticated;

drop trigger if exists sync_linked_return_visit_unit_number_trigger on public.units;
create trigger sync_linked_return_visit_unit_number_trigger
after update of number on public.units
for each row execute function public.sync_linked_return_visit_unit_number();

-- 현재 운영 자료의 375개를 같은 규칙으로 정리한다. 위 트리거가 연결된
-- return_visits.unit_number와 조건에 맞는 display_name을 같은 트랜잭션에서 맞춘다.
update public.units
set number = public.canonical_unit_number(number)
where number is distinct from public.canonical_unit_number(number);

-- 세대 번호는 이미 정리됐지만 과거 연결 시점의 `101호`가 복제 칸에 남은 자료도 맞춘다.
-- display_name은 현재 복제 칸으로 정확히 끝나는 자동 표시명만 고치고 nickname은 보존한다.
update public.return_visits rv
set
  unit_number = u.number,
  display_name = case
    when right(rv.display_name, length(rv.unit_number)) = rv.unit_number
      then left(rv.display_name, length(rv.display_name) - length(rv.unit_number)) || u.number
    else rv.display_name
  end
from public.units u
where u.id = rv.unit_id
  and rv.unit_number is distinct from u.number;

do $$
begin
  if exists (
    select 1 from public.units
    where btrim(number) ~ '^\d+\s*호$' or btrim(number) ~ '^[Bb]\d+\s*호$'
  ) then
    raise exception '호가 남은 순수 호수 표기가 있습니다';
  end if;

  if exists (
    select 1
    from public.units
    group by building_id, public.normalize_unit_number(number)
    having count(*) > 1
  ) then
    raise exception '호수 표준화 뒤 정규화 중복이 생겼습니다';
  end if;

  if exists (
    select 1
    from public.return_visits rv
    join public.units u on u.id = rv.unit_id
    where rv.unit_number is distinct from u.number
  ) then
    raise exception '연결된 정기방문 호수가 세대와 다릅니다';
  end if;
end;
$$;

notify pgrst, 'reload schema';
