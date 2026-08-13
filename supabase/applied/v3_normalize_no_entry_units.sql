-- 들어갈 수 없는 건물로 적어둔 세대 이름을 '출입불가' 로 통일
-- Supabase SQL Editor 에서 실행
--
-- 배경: 출입불가 버튼이 생기기 전에는 손으로 적었기 때문에 표현이 제각각이다.
--       ('들어가지 못함', '출입하지못함', '출입 불가' …)
--       이름이 다르면 나중에 세는 것도, 찾는 것도 어긋난다.
--
-- 대상 (2026-08-10 기준 6건, 전부 이미 status='대상외'):
--   '들어가지 못함'   4건
--   '출입하지못함'    1건
--   '출입 불가'       1건
--
-- ⚠ 바꾸지 않는 것: '들어가 왼쪽 첫집', '들어가서 오른쪽' 은 실제 세대를 가리키는
--   설명이라 그대로 둔다 (상태도 '부재' 라 출입불가와 무관).

-- 1) 바꾸기 전에 확인 (먼저 이것만 실행해 보길 권함)
select id, number, status
from public.units
where number in ('들어가지 못함', '출입하지못함', '출입 불가', '출입불가')
order by number;

-- 2) 이름 통일 + 대상외 상태 보장
update public.units
set number = '출입불가',
    status = '대상외'
where number in ('들어가지 못함', '출입하지못함', '출입 불가');

-- 3) 결과 확인
select number, status, count(*)
from public.units
where number = '출입불가'
group by number, status;

-- 참고: 앞으로는 세대 추가 줄의 [출입불가] 버튼을 쓰면
--       이름과 상태가 자동으로 맞춰진다.
