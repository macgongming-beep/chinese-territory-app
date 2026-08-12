-- 전화 조사 대장에 '식당' 표시 보관
-- Supabase SQL Editor 에서 실행
--
-- 왜 필요한가: 중국어 '있음' 인데 지도 등록을 깜빡한 곳을 앱이 다시 꺼내 줄 때,
-- 식당 여부를 같이 실어야 등록 후에도 식당 목록에 제대로 잡힌다.
-- 이 값이 없으면 다시 만든 파일로 등록해도 식당 표시가 빠진다.

alter table public.phone_surveys
  add column if not exists restaurant text;

select '조사 대장' as 구분, count(*) as 개수 from public.phone_surveys
union all
select '지도에 아직 없는 있음', count(*)
  from public.phone_surveys s
 where s.result = '있음'
   and not exists (select 1 from public.units u where u.naver_place_id = s.place_id);
