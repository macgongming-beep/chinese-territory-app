-- anon 이 부를 수 있는 `security definer` 함수 감사. **읽기만 한다.**
--
-- 왜 이 감사가 필요한가 (2026-08-29 에 크게 데었다):
--   표에 RLS 를 걸어도 **definer 함수는 그걸 우회한다.**
--   "표를 못 지운다" 와 "자료를 못 지운다" 는 다른 말이다.
--   anon 쓰기 차단을 끝냈다고 생각한 뒤에도 65개가 열려 있었고,
--   그중엔 **회중 전원에게 푸시를 쏘는 것**과 **방문기록을 지우는 것**이 있었다.
--
-- ⚠ **새 `security definer` 함수를 만들 때마다 이걸 돌릴 것.**
--   PostgreSQL 은 함수를 만들면 PUBLIC 에 실행권한을 준다 — 가만두면 열린다.

select p.proname as 함수,
       pg_get_function_identity_arguments(p.oid) as 인자,
       case
         when pg_get_function_result(p.oid) = 'trigger' then '트리거(직접 호출 불가)'
         when p.prosrc ~* '(delete|truncate)\s+(from\s+)?(public\.)?[a-z_]+' then '⚠ 삭제'
         when p.prosrc ~* 'update\s+(public\.)?[a-z_]+\s+set' then '⚠ 쓰기'
         when p.prosrc ~* 'insert\s+into' then '추가'
         else '읽기'
       end as 하는일,
       case
         when p.prosrc ~* 'request_is_admin|session_is_admin|request_session_user_id|verify_session'
           then '검사있음'
         else '⚠ 검사없음'
       end as 권한검사
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.prosecdef
  and has_function_privilege('anon', p.oid, 'execute')
order by
  case when pg_get_function_result(p.oid) = 'trigger' then 3
       when p.prosrc ~* 'request_is_admin|session_is_admin|request_session_user_id' then 2
       else 1 end,
  3, 1;

-- 봐야 할 것: **'⚠ 검사없음' 인데 '삭제'·'쓰기' 인 줄.**
-- 트리거 함수는 PostgreSQL 이 직접 호출을 거부하므로 급하지 않다.
-- auth_login · signup_tx 는 로그인 전에 불려야 하므로 열려 있는 것이 맞다.
