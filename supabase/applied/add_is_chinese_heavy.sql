-- 건물(building)에 중국인 밀집 여부 플래그 추가
-- PC 지도 화면에서만 표시/토글됨

ALTER TABLE buildings
  ADD COLUMN IF NOT EXISTS is_chinese_heavy boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN buildings.is_chinese_heavy IS '중국인 밀집 건물 여부 (PC 지도에서 관리자가 수동 표시)';
