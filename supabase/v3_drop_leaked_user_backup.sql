-- 🚨 평문 PIN 이 담긴 옛 백업표 제거
-- Supabase SQL Editor 에서 **지금** 실행 (다른 작업보다 먼저)
--
-- 무슨 일이 있었나
--   2026-04-30 에 app_users.pin 을 bcrypt 해시로 바꾸면서, 바꾸기 전 상태를
--   app_users_backup_20260430 으로 남겨 뒀다. 본체(app_users)는 PIN 컬럼을
--   REVOKE 해 클라이언트가 못 읽게 막았지만, **사본에는 그 보호가 없었다.**
--
--   그래서 앱에 실려 나가는 anon 키로 누구나 이렇게 읽을 수 있었다:
--     GET /rest/v1/app_users_backup_20260430?select=name,pin
--     → [{"name":"...","pin":"0000"}]   ← 평문
--
--   그 안에 지금도 쓰는 admin 계정 3개가 들어 있다.
--
-- 왜 그냥 지우나
--   이 표는 4월 작업 때의 임시 사본이고, 원본은 app_users 에 그대로 있다.
--   되살릴 이유가 없고, 두면 평문 PIN 이 계속 남는다.

-- ─── 1. 지우기 전에 무엇이 사라지는지 눈으로 확인 ─────────────
select count(*) as 지워질_행수 from public.app_users_backup_20260430;

-- ─── 2. 제거 ──────────────────────────────────────────────────
drop table if exists public.app_users_backup_20260430;

-- ─── 3. 확인 ──────────────────────────────────────────────────
-- 아래가 0 이어야 한다. 그리고 평문 PIN 을 담은 표가 또 없는지도 본다.
select 'app_users_backup_20260430 남아 있음 (0 이어야 함)' as 구분,
       count(*) as 개수
  from information_schema.tables
 where table_schema = 'public' and table_name = 'app_users_backup_20260430'
union all
select 'pin 컬럼을 가진 다른 표 (app_users 만 있어야 함)',
       count(*)
  from information_schema.columns
 where table_schema = 'public' and column_name = 'pin' and table_name <> 'app_users';

-- ⚠️ 이 SQL 을 돌린 뒤, 위 백업표에 있던 관리자 3명(개발자·장웅·관리자)은
--    비밀번호를 바꾸는 것이 좋다. 그동안 노출돼 있었기 때문이다.
