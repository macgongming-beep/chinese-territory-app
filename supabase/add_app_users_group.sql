-- 사용자 집단(회중 내 그룹: 처인/신갈/동백/동탄 등) 관리
-- Supabase SQL Editor 에서 실행
--
-- 설계: 한 사용자 = 한 집단 (group_name 텍스트, NULL/'' = 미지정)
--       집단 목록은 app_settings.user_groups (JSON 배열) 에 저장 → 앱에서 편집 가능
-- 기존 사용자는 전부 미지정으로 시작 (기본값 없음, 데이터 영향 없음)

alter table public.app_users
  add column if not exists group_name text;

-- ⚠️ 필수: app_users 는 pin 차단을 위해 컬럼 단위로 SELECT 를 부여한다.
-- 새 컬럼은 목록에 넣어 다시 부여하지 않으면 저장은 되지만 읽히지 않아
-- 화면에서 계속 '미지정'으로 보인다. (auth_lockdown.sql / approval_status 선례와 동일)
grant select (id, login_id, name, role, approval_status, group_name, last_login_at, created_at, phone)
  on public.app_users to anon, authenticated;

-- 집단 목록 기본값 (이미 있으면 유지)
insert into app_settings (key, value)
values ('user_groups', '["처인","신갈","동백","동탄"]')
on conflict (key) do nothing;
