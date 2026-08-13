-- v3 식당봉사 기능
-- Supabase SQL Editor 에서 실행 필요

-- 1. 방문이력에 타입 구분 (카드 호별방문 vs 식당봉사)
ALTER TABLE visit_histories
  ADD COLUMN IF NOT EXISTS visit_type text DEFAULT 'card'
    CHECK (visit_type IN ('card', 'restaurant'));

-- 기존 데이터 마이그레이션 (모두 'card' 로)
UPDATE visit_histories SET visit_type = 'card' WHERE visit_type IS NULL;

-- 2. 봉사자 식당 추가 신청 대기 테이블
CREATE TABLE IF NOT EXISTS restaurant_requests (
  id            serial PRIMARY KEY,
  name          text NOT NULL,
  address       text NOT NULL,
  requested_by  text NOT NULL,
  requested_at  timestamptz DEFAULT now(),
  status        text DEFAULT 'pending'
                  CHECK (status IN ('pending', 'approved', 'rejected')),
  memo          text,
  visited_at    timestamptz DEFAULT now(),
  reviewer      text,
  reviewed_at   timestamptz,
  building_id   integer REFERENCES buildings(id) ON DELETE SET NULL
);

-- RLS: anon 도 조회·삽입 가능 (로그인 없는 앱이라 필요)
ALTER TABLE restaurant_requests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "restaurant_requests_select" ON restaurant_requests;
DROP POLICY IF EXISTS "restaurant_requests_insert" ON restaurant_requests;
DROP POLICY IF EXISTS "restaurant_requests_update" ON restaurant_requests;
DROP POLICY IF EXISTS "restaurant_requests_delete" ON restaurant_requests;

CREATE POLICY "restaurant_requests_select" ON restaurant_requests FOR SELECT USING (true);
CREATE POLICY "restaurant_requests_insert" ON restaurant_requests FOR INSERT WITH CHECK (true);
CREATE POLICY "restaurant_requests_update" ON restaurant_requests FOR UPDATE USING (true);
CREATE POLICY "restaurant_requests_delete" ON restaurant_requests FOR DELETE USING (true);
