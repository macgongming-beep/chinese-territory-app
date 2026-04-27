-- 카드의 인도자 배정을 정리하는 SQL
-- Supabase SQL Editor에서 실행하세요.

-- 1) 유효하지 않은 인도자명만 제거
--    (app_users에 존재하지 않거나, role이 leader/admin이 아닌 경우)
update public.cards c
set leader_name = null
where c.leader_name is not null
  and not exists (
    select 1
    from public.app_users u
    where u.name = c.leader_name
      and u.role in ('leader', 'admin')
  );

-- 2) 선택: 카드 상태 보정(인도자도 없고, 재배정 사용자도 없으면 미배정)
--    원하지 않으면 아래 블록은 실행하지 마세요.
-- update public.cards c
-- set status = '미배정'
-- where c.leader_name is null
--   and not exists (
--     select 1
--     from public.card_assignments ca
--     where ca.card_id = c.id
--   );

-- 3) 참고: 모든 인도자 배정을 초기화하고 싶을 때(주의)
-- update public.cards set leader_name = null;
