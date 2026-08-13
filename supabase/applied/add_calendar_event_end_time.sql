-- 일정 종료 시간 컬럼 추가 (시간 범위 표시용)
-- 적용: Supabase Dashboard → SQL Editor → 붙여넣고 Run
-- 안전: 컬럼만 추가 (NULL 허용), 기존 행 영향 X

alter table public.calendar_events
  add column if not exists end_time text;

comment on column public.calendar_events.end_time
  is '일정 종료 시간 (HH:MM 형식, NULL 허용). NULL 이면 시작 시간만 표시.';
