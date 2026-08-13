-- 갈라진 사용자 이름 합치기 + 테스트 기록 정리
-- Supabase SQL Editor 에서 실행
--
-- ⚠ 실행 전 백업 권장: npm run backup
--
-- 배경: 이 앱은 배정·기록을 user_id 가 아니라 이름 문자열로 저장한다.
--       그런데 닉네임을 바꿀 때 그 기록이 따라가지 않아, 같은 사람의 기록이
--       옛 이름과 새 이름으로 갈라졌다. 통계가 두 사람으로 쪼개지고,
--       구역 인도자 배정을 잃어버리는 일까지 있었다.
--       (원인이 된 코드는 commit a0f49fb 에서 고쳤다 — 앞으로는 자동으로 따라간다)
--
-- 이 파일이 하는 일:
--   1) 확인용 조회 — 먼저 이것만 돌려서 눈으로 확인
--   2) 갈라진 이름 합치기 (옛 한국어 이름 → 현재 계정 이름)
--      ※ 한자는 계정에 저장된 표기를 그대로 쓴다. 사용자가 알려준 것과
--        글자가 다른 것이 셋 있었다 (계정 쪽이 기준):
--          吴世昶 → 吳世昶 / 崔智慧 → 崔智惠 / 崔瑜真 → 崔愉真
--   3) 정기방문 담당자의 호칭 정리 (최윤민형제 → 최윤민)
--   4) 테스트 계정 기록 삭제 (인도자·사용자1~5·김민준)
--   5) 결과 확인

-- ─────────────────────────────────────────────────────────────
-- 1) 먼저 확인 — 이 조회부터 돌려 보세요
-- ─────────────────────────────────────────────────────────────
with mapping(old_name, new_name) as (values
  ('이현우',       '이현우 (李諼友）'),
  ('심창현',       '심창현沈昌炫'),
  ('임성준',       '임성준任成俊'),
  ('도완오',       '도완오都玩奡'),
  ('홍윤아',       '홍윤아洪润娥'),
  ('양소은',       '양소은杨笑恩'),
  ('최윤민형제',   '최윤민'),
  ('심창현형제',   '심창현沈昌炫'),
  ('오세창',       '吳世昶'),
  ('나의성',       '罗义成'),
  ('최지혜',       '崔智惠'),
  ('최유진',       '崔愉真'),
  ('최지원',       '崔芝园'),
  ('김수연A',      '金秀妍A'),
  ('돌돌이',       '김무혁'),
  ('최유진자매',   '崔愉真'),
  ('최지원자매',   '崔芝园')
)
select m.old_name, m.new_name,
       (select count(*) from public.visit_histories            where visitor_name = m.old_name) as 방문기록,
       (select count(*) from public.service_sessions           where user_name    = m.old_name) as 봉사세션,
       (select count(*) from public.regular_visits             where visitor_name = m.old_name) as 정기방문,
       (select count(*) from public.card_leader_assignments    where user_name    = m.old_name) as 인도자배정,
       (select count(*) from public.event_participants         where user_name    = m.old_name) as 일정참가,
       (select count(*) from public.event_card_assignments     where user_name    = m.old_name) as 카드배정
from mapping m
order by 1;

-- 1-2) 합칠 때 부딪히는 행 — 같은 사람이 옛·새 이름으로 둘 다 들어간 경우.
--      이 행들은 옮기지 않고 옛 이름 쪽을 지운다 (내용이 같은 중복이라 잃는 정보 없음).
with mapping(old_name, new_name) as (values
  ('이현우','이현우 (李諼友）'),('심창현','심창현沈昌炫'),('임성준','임성준任成俊'),
  ('도완오','도완오都玩奡'),('홍윤아','홍윤아洪润娥'),('양소은','양소은杨笑恩'),
  ('최윤민형제','최윤민'),('심창현형제','심창현沈昌炫'),('오세창','吳世昶'),('나의성','罗义成'),
  ('최지혜','崔智惠'),('최유진','崔愉真'),('최지원','崔芝园'),('김수연A','金秀妍A'),
  ('돌돌이','김무혁'),('최유진자매','崔愉真'),('최지원자매','崔芝园')
)
select '일정 참가' as 표, count(*) as 충돌 from public.event_participants o join mapping m on o.user_name = m.old_name
  where exists (select 1 from public.event_participants c where c.event_id = o.event_id and c.user_name = m.new_name)
union all
select '카드 배정', count(*) from public.event_card_assignments o join mapping m on o.user_name = m.old_name
  where exists (select 1 from public.event_card_assignments c where c.event_id = o.event_id and c.user_name = m.new_name)
union all
select '봉사 세션', count(*) from public.service_sessions o join mapping m on o.user_name = m.old_name
  where exists (select 1 from public.service_sessions c where c.service_date is not distinct from o.service_date
    and c.time_slot is not distinct from o.time_slot and c.primary_card_id is not distinct from o.primary_card_id
    and c.user_name = m.new_name);

-- ─────────────────────────────────────────────────────────────
-- 2~3) 이름 합치기 — 위 결과를 확인한 뒤 여기부터 실행
-- ─────────────────────────────────────────────────────────────
do $$
declare
  m record;
  v_moved integer := 0;
  v_total integer := 0;
begin
  for m in
    select * from (values
      ('이현우',       '이현우 (李諼友）'),
      ('심창현',       '심창현沈昌炫'),
      ('임성준',       '임성준任成俊'),
      ('도완오',       '도완오都玩奡'),
      ('홍윤아',       '홍윤아洪润娥'),
      ('양소은',       '양소은杨笑恩'),
      ('최윤민형제',   '최윤민'),
      ('심창현형제',   '심창현沈昌炫'),
      ('오세창',       '吳世昶'),
      ('나의성',       '罗义成'),
      ('최지혜',       '崔智惠'),
      ('최유진',       '崔愉真'),
      ('최지원',       '崔芝园'),
      ('김수연A',      '金秀妍A'),
      ('돌돌이',       '김무혁'),
      ('최유진자매',   '崔愉真'),
      ('최지원자매',   '崔芝园')
    ) as t(old_name, new_name)
  loop
    update public.visit_histories         set visitor_name = m.new_name where visitor_name = m.old_name;
    get diagnostics v_moved = row_count; v_total := v_total + v_moved;
    update public.regular_visits          set visitor_name = m.new_name where visitor_name = m.old_name;
    get diagnostics v_moved = row_count; v_total := v_total + v_moved;
    update public.cards                   set leader_name  = m.new_name where leader_name  = m.old_name;
    get diagnostics v_moved = row_count; v_total := v_total + v_moved;

    -- ── 유니크 제약이 걸린 표들 ────────────────────────────
    -- 같은 사람이 옛 이름·새 이름으로 둘 다 들어가 있는 행이 있다.
    -- 그대로 이름만 바꾸면 같은 키가 두 줄이 되어 오류가 난다
    -- (실제로 확인해 보니 내용까지 똑같은 중복이었다 — 옛 행을 지운다).
    -- null 이 섞인 키가 있어 = 대신 is not distinct from 으로 비교한다.
    delete from public.card_leader_assignments o
    where o.user_name = m.old_name and exists (select 1 from public.card_leader_assignments c
      where c.card_id = o.card_id and c.user_name = m.new_name);
    update public.card_leader_assignments set user_name = m.new_name where user_name = m.old_name;
    get diagnostics v_moved = row_count; v_total := v_total + v_moved;

    delete from public.card_assignments o
    where o.user_name = m.old_name and exists (select 1 from public.card_assignments c
      where c.card_id = o.card_id and c.user_name = m.new_name);
    update public.card_assignments set user_name = m.new_name where user_name = m.old_name;
    get diagnostics v_moved = row_count; v_total := v_total + v_moved;

    delete from public.event_participants o
    where o.user_name = m.old_name and exists (select 1 from public.event_participants c
      where c.event_id = o.event_id and c.user_name = m.new_name);
    update public.event_participants set user_name = m.new_name where user_name = m.old_name;
    get diagnostics v_moved = row_count; v_total := v_total + v_moved;

    delete from public.event_card_assignments o
    where o.user_name = m.old_name and exists (select 1 from public.event_card_assignments c
      where c.event_id = o.event_id and c.user_name = m.new_name);
    update public.event_card_assignments set user_name = m.new_name where user_name = m.old_name;
    get diagnostics v_moved = row_count; v_total := v_total + v_moved;

    delete from public.event_card_assignment_cards o
    where o.user_name = m.old_name and exists (select 1 from public.event_card_assignment_cards c
      where c.event_id = o.event_id and c.card_id = o.card_id and c.user_name = m.new_name);
    update public.event_card_assignment_cards set user_name = m.new_name where user_name = m.old_name;
    get diagnostics v_moved = row_count; v_total := v_total + v_moved;

    delete from public.event_informal_assignments o
    where o.user_name = m.old_name and exists (select 1 from public.event_informal_assignments c
      where c.event_id = o.event_id and c.asset_id = o.asset_id and c.user_name = m.new_name);
    update public.event_informal_assignments set user_name = m.new_name where user_name = m.old_name;
    get diagnostics v_moved = row_count; v_total := v_total + v_moved;

    delete from public.event_restaurant_assignments o
    where o.user_name = m.old_name and exists (select 1 from public.event_restaurant_assignments c
      where c.event_id = o.event_id and c.building_id = o.building_id and c.user_name = m.new_name);
    update public.event_restaurant_assignments set user_name = m.new_name where user_name = m.old_name;
    get diagnostics v_moved = row_count; v_total := v_total + v_moved;

    delete from public.service_sessions o
    where o.user_name = m.old_name and exists (select 1 from public.service_sessions c
      where c.service_date is not distinct from o.service_date
        and c.time_slot is not distinct from o.time_slot
        and c.primary_card_id is not distinct from o.primary_card_id
        and c.user_name = m.new_name);
    update public.service_sessions set user_name = m.new_name where user_name = m.old_name;
    get diagnostics v_moved = row_count; v_total := v_total + v_moved;

  end loop;
  raise notice '이름 합치기 완료: 총 % 건 이관', v_total;
end $$;

-- ─────────────────────────────────────────────────────────────
-- 4) 테스트 계정 기록 삭제 (48건)
--    인도자 / 사용자1~5 / 김민준 — app_users 에 계정이 없는 이름들
-- ─────────────────────────────────────────────────────────────
do $$
declare
  v_names text[] := array['인도자','사용자1','사용자2','사용자3','사용자4','사용자5','김민준'];
  v_deleted integer := 0;
  v_n integer;
begin
  delete from public.event_card_assignment_cards where user_name = any(v_names);
  get diagnostics v_n = row_count; v_deleted := v_deleted + v_n;
  delete from public.event_card_assignments      where user_name = any(v_names);
  get diagnostics v_n = row_count; v_deleted := v_deleted + v_n;
  delete from public.event_restaurant_assignments where user_name = any(v_names);
  get diagnostics v_n = row_count; v_deleted := v_deleted + v_n;
  delete from public.event_informal_assignments  where user_name = any(v_names);
  get diagnostics v_n = row_count; v_deleted := v_deleted + v_n;
  delete from public.event_participants          where user_name = any(v_names);
  get diagnostics v_n = row_count; v_deleted := v_deleted + v_n;
  delete from public.service_sessions            where user_name = any(v_names);
  get diagnostics v_n = row_count; v_deleted := v_deleted + v_n;
  raise notice '테스트 기록 삭제: 총 % 건', v_deleted;
end $$;

-- ─────────────────────────────────────────────────────────────
-- 5) 결과 확인 — 합쳐졌는지, 옛 이름이 남았는지
-- ─────────────────────────────────────────────────────────────
select '남은 옛 이름' as 구분, visitor_name as 이름, count(*) as 건수
from public.visit_histories
where visitor_name in ('이현우','심창현','임성준','도완오','홍윤아','양소은','최윤민형제','심창현형제',
                       '오세창','나의성','최지혜','최유진','최지원','김수연A','돌돌이','최유진자매','최지원자매')
group by 1, 2
union all
select '봉사 세션', user_name, count(*)
from public.service_sessions
where user_name in ('이현우','심창현','임성준','도완오','홍윤아','양소은','오세창','나의성','최지혜',
                    '인도자','사용자1','김민준')
group by 1, 2;
-- ↑ 결과가 0행이면 정상

-- 참고: 아래는 이번에 건드리지 않았다
--   봉사 세션 이름 칸에 여러 명이 들어간 4건
--     예: '정찬양, 박진호' / '심창현, 임성준, 이현우, …'
--     → 이 세션들의 시간이 한 사람에게 몰려 잡힌다. 확인 후 별도 정리 필요.
