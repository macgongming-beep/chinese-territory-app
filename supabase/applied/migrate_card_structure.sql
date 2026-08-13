-- 카드 구조를 대권역 -> 동 -> 번호 형식으로 바꾸는 마이그레이션
-- Supabase SQL Editor에서 1회 실행하세요.

do $$
declare
  constraint_name text;
begin
  select conname
    into constraint_name
  from pg_constraint
  where conrelid = 'public.cards'::regclass
    and contype = 'c'
    and pg_get_constraintdef(oid) like '%type%';

  if constraint_name is not null then
    execute format('alter table public.cards drop constraint %I', constraint_name);
  end if;
end $$;

update public.cards
set type = '전체';

alter table public.cards
add constraint cards_type_check
check (type in ('전체'));

update public.cards
set
  region = case
    when area in ('고림동', '김량장동', '역북동', '유방동', '포곡읍') then '처인구'
    when area in ('신갈동', '상하동', '구갈동', '보정동', '동백동') then '기흥구'
    when area in ('풍덕천동', '죽전동', '상현동', '성복동') then '수지구'
    when area in ('매탄동', '영통동', '원천동') then '영통구'
    when area in ('병점동', '동탄동', '진안동', '봉담읍') then '화성시'
    else region
  end;

with numbered_cards as (
  select
    id,
    row_number() over (partition by region, area order by id) as card_number
  from public.cards
)
update public.cards as cards
set name = cards.region || ' ' || cards.area || ' ' || numbered_cards.card_number
from numbered_cards
where cards.id = numbered_cards.id;
