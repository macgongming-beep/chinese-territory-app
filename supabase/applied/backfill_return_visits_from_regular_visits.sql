-- 기존 regular_visits 데이터를 활동 탭(return_visits) 목록으로 동기화합니다.
-- 중국인 포인트/세대에서 이름으로 등록해둔 정기방문자가 활동 탭에 보이지 않는 경우 실행하세요.

do $$
begin
  if to_regclass('public.return_visits') is null then
    raise notice 'public.return_visits table does not exist. skipped.';
    return;
  end if;

  insert into public.return_visits (
    unit_id,
    building_id,
    display_name,
    address,
    unit_number,
    assigned_user_name,
    created_by,
    created_at
  )
  select
    rv.unit_id,
    b.id,
    trim(concat(
      coalesce(
        nullif(regexp_replace(c.name, '^(처인구|기흥구|수지구|영통구|화성시)\s*', ''), ''),
        b.name
      ),
      ' ',
      u.number
    )),
    b.address,
    u.number,
    rv.visitor_name,
    rv.visitor_name,
    coalesce(rv.registered_at, now())
  from public.regular_visits rv
  join public.units u on u.id = rv.unit_id
  join public.buildings b on b.id = u.building_id
  left join public.cards c on c.id = b.card_id
  where trim(coalesce(rv.visitor_name, '')) <> ''
    and not exists (
      select 1
      from public.return_visits existing
      where existing.unit_id = rv.unit_id
    );
end $$;
