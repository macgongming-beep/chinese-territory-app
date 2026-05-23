-- 자동 로그인(Session Restore) 시 로그인 시간을 갱신하기 위한 함수
CREATE OR REPLACE FUNCTION public.auth_record_auto_login(
  p_user_id int,
  p_device_label text DEFAULT 'unknown',
  p_user_agent text DEFAULT null
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- 1. app_users 테이블의 최근 로그인 시간 업데이트
  UPDATE public.app_users 
  SET last_login_at = now() 
  WHERE id = p_user_id;

  -- 2. 로그인 로그 남기기 (에러 무시)
  BEGIN
    INSERT INTO public.login_logs (user_id, logged_in_at, device_info, ip_address)
    VALUES (
      p_user_id, 
      now(), 
      p_device_label || ' (auto-login)', 
      current_setting('request.headers', true)::json->>'x-forwarded-for'
    );
  EXCEPTION WHEN OTHERS THEN
    -- login_logs 테이블이 없거나 에러가 나도 진행
  END;
END;
$$;
