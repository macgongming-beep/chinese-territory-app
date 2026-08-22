-- 이름이 빈 칸인 봉사 세션 치우기
-- Supabase SQL Editor 에서 실행
--
-- 어디서 왔나: 인도자를 정하지 않은 일정은 leader_name 이 null 이 아니라
-- 빈 글자('') 로 저장된다. 옛 트리거는 `if v_leader is not null` 로만 걸러서
-- 빈 글자를 사람 이름으로 보고 세션을 만들었다.
-- v3_fix_multi_leader_sessions.sql 의 새 트리거는 빈 조각을 버리므로
-- 앞으로는 안 생긴다. 이미 생긴 5건만 치운다.
--
-- 지워도 되는 이유: user_name 이 빈 세션은 누구의 봉사도 아니다.
-- 통계에서 이름 없는 줄로 잡히기만 한다. 전부 status='ended' 라
-- 진행 중인 봉사를 끊을 일도 없다.

delete from public.service_sessions
where coalesce(btrim(user_name), '') = '';

-- ─── 확인 ───────────────────────────────────────────────────
select '이름이 빈 세션 (0 이어야 함)' as 구분, count(*) as 개수
  from public.service_sessions where coalesce(btrim(user_name), '') = ''
union all
select '계정에 없는 이름의 세션 (0 이어야 함)', count(*)
  from public.service_sessions s
 where not exists (select 1 from public.app_users u where u.name = s.user_name);
