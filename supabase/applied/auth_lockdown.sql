-- ===============================================================
-- Phase 1-2: 민감 데이터 차단 (anon 키로 접근 불가)
--
-- 1) app_users.pin 컬럼 SELECT 차단 (해시값 노출 방지)
-- 2) login_logs 직접 SELECT 차단 → RPC 호출만 허용
--
-- 참고: PIN 컬럼은 INSERT/UPDATE 는 허용해야 함 (createUser, resetPin 등이 동작)
--       트리거(hash_pin_if_plain)가 평문 → 해시 자동 변환
-- ===============================================================

-- ─── 1. app_users: pin 컬럼 SELECT 차단 ───────────────────────
-- 기존 권한 모두 회수 후 컬럼별로 다시 부여
REVOKE ALL ON public.app_users FROM anon, authenticated;

-- SELECT: pin 제외한 컬럼만 (anon, authenticated 모두)
GRANT SELECT (id, login_id, name, role, last_login_at, created_at, phone)
  ON public.app_users TO anon, authenticated;

-- INSERT / UPDATE / DELETE: 행 단위 (모든 컬럼 포함)
-- pin 컬럼에 평문이 들어와도 트리거가 자동 해싱
GRANT INSERT, UPDATE, DELETE ON public.app_users TO anon, authenticated;

-- ─── 2. login_logs: 직접 SELECT 차단 ─────────────────────────
REVOKE SELECT ON public.login_logs FROM anon, authenticated;

-- INSERT는 auth_login RPC(SECURITY DEFINER)에서만 발생하지만, 안전상 유지
GRANT INSERT ON public.login_logs TO anon, authenticated;

-- ─── 3. 로그인 기록 조회 RPC ─────────────────────────────────
-- 클라이언트는 이 함수를 통해서만 login_logs 조회 가능
-- (인증 검증은 이 RPC 안에서 추가하지 않음 — 80명 내부 사용 전제)
CREATE OR REPLACE FUNCTION public.get_login_logs(
  p_user_id int,
  p_since   timestamptz DEFAULT NULL,
  p_limit   int DEFAULT 50
)
RETURNS TABLE (
  id           bigint,
  logged_in_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT l.id, l.logged_in_at
  FROM public.login_logs l
  WHERE l.user_id = p_user_id
    AND (p_since IS NULL OR l.logged_in_at >= p_since)
  ORDER BY l.logged_in_at DESC
  LIMIT p_limit;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_login_logs(int, timestamptz, int) TO anon;
GRANT EXECUTE ON FUNCTION public.get_login_logs(int, timestamptz, int) TO authenticated;

-- ─── 검증 (정보 출력) ────────────────────────────────────────
-- 실행 후 다음 쿼리로 권한 확인:
-- SELECT grantee, privilege_type, column_name
-- FROM information_schema.column_privileges
-- WHERE table_name = 'app_users' AND column_name = 'pin';
-- → SELECT 권한이 anon/authenticated에 없어야 함
