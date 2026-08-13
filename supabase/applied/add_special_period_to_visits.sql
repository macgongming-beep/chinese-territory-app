-- ============================================================
-- 특별봉사 시즌 지원: visit_histories에 special_period_id 및 invitation_left 추가
-- ============================================================
-- 동작:
--   1) 관리자가 special_periods 테이블에 시즌 row 생성 (start_date, end_date 지정)
--   2) 그 기간에 발생하는 모든 방문은 자동으로 special_period_id가 채워짐
--   3) 기간 종료 후 새로운 방문은 special_period_id = NULL
--   4) 통계: WHERE special_period_id = X (시즌별), WHERE special_period_id IS NULL (일반)
-- ============================================================

-- visit_histories에 컬럼 추가
ALTER TABLE visit_histories
  ADD COLUMN IF NOT EXISTS special_period_id INT REFERENCES special_periods(id) ON DELETE SET NULL;

ALTER TABLE visit_histories
  ADD COLUMN IF NOT EXISTS invitation_left BOOLEAN DEFAULT FALSE;

-- 조회 성능용 인덱스
CREATE INDEX IF NOT EXISTS idx_visit_histories_special_period
  ON visit_histories(special_period_id);

-- 검증 쿼리 (실행 후 컬럼 확인용)
-- SELECT column_name, data_type, is_nullable
-- FROM information_schema.columns
-- WHERE table_name = 'visit_histories' AND column_name IN ('special_period_id', 'invitation_left');
