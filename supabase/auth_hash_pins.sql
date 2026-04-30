-- ===============================================================
-- 비밀번호(PIN) bcrypt 해싱 마이그레이션
--
-- 동작:
-- 1) pgcrypto 확장 활성화 (Supabase 기본 설치됨, extensions 스키마)
-- 2) app_users.pin 에 INSERT/UPDATE 될 때 자동으로 bcrypt 해싱하는 트리거
-- 3) 기존 평문 PIN 들을 일괄 해싱
-- 4) 로그인 검증 RPC (auth_login) — 해시된 PIN 비교는 서버에서만 가능
--
-- 실행: Supabase SQL Editor 에서 전체 복사 후 Run
-- 실행 전 권장 백업:
--   CREATE TABLE app_users_backup_YYYYMMDD AS SELECT * FROM app_users;
-- ===============================================================

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ─── 1. 자동 해싱 트리거 ──────────────────────────────────────────
-- 이미 해싱된 값($2a/$2b/$2y로 시작)이면 건드리지 않고,
-- 평문이면 bcrypt(cost=10)로 해싱
CREATE OR REPLACE FUNCTION public.hash_pin_if_plain()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
BEGIN
  IF NEW.pin IS NOT NULL AND NEW.pin !~ '^\$2[aby]\$' THEN
    NEW.pin := extensions.crypt(NEW.pin, extensions.gen_salt('bf', 10));
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS app_users_hash_pin ON public.app_users;
CREATE TRIGGER app_users_hash_pin
BEFORE INSERT OR UPDATE OF pin ON public.app_users
FOR EACH ROW
EXECUTE FUNCTION public.hash_pin_if_plain();

-- ─── 2. 기존 평문 PIN 일괄 해싱 ─────────────────────────────────
-- 트리거가 알아서 해시하므로, 그냥 같은 값으로 UPDATE 만 돌리면 됨
UPDATE public.app_users
SET pin = pin
WHERE pin IS NOT NULL AND pin !~ '^\$2[aby]\$';

-- ─── 3. 로그인 검증 RPC ────────────────────────────────────────
-- 클라이언트에서 평문 PIN 으로 호출 → 서버에서 crypt() 비교
-- 검증 성공 시: last_login_at 갱신 + login_logs 기록 + 사용자 정보 반환
-- 검증 실패 시: 빈 결과
CREATE OR REPLACE FUNCTION public.auth_login(p_login_id text, p_pin text)
RETURNS TABLE (
  id int,
  name text,
  login_id text,
  role text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_id        int;
  v_name      text;
  v_login_id  text;
  v_role      text;
  v_pin       text;
BEGIN
  -- login_id 또는 name 으로 검색 (구버전 호환)
  SELECT u.id, u.name, COALESCE(u.login_id, u.name), u.role, u.pin
    INTO v_id, v_name, v_login_id, v_role, v_pin
  FROM public.app_users u
  WHERE u.login_id = p_login_id
     OR (u.login_id IS NULL AND u.name = p_login_id)
  LIMIT 1;

  -- 사용자 없음
  IF v_id IS NULL THEN RETURN; END IF;

  -- PIN 불일치
  IF v_pin IS NULL OR v_pin <> extensions.crypt(p_pin, v_pin) THEN RETURN; END IF;

  -- 로그인 시각 기록
  UPDATE public.app_users SET last_login_at = now() WHERE app_users.id = v_id;
  INSERT INTO public.login_logs (user_id, logged_in_at) VALUES (v_id, now());

  RETURN QUERY SELECT v_id, v_name, v_login_id, v_role;
END;
$$;

-- 익명 사용자(클라이언트)가 호출할 수 있도록 권한 부여
GRANT EXECUTE ON FUNCTION public.auth_login(text, text) TO anon;
GRANT EXECUTE ON FUNCTION public.auth_login(text, text) TO authenticated;
