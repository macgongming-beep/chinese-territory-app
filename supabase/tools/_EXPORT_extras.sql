-- 위 쿼리가 못 담는 나머지 (읽기 전용).
-- pg_cron / storage 는 public 스키마 밖이라 따로 뽑는다.
-- 하나가 실패해도 나머지는 나오게 분리해 뒀다 — 따로따로 실행할 것.

-- ① 예약 작업 (매일 04:00 데이터 정리 등)
select coalesce(string_agg(
         format('select cron.schedule(%L, %L, %L);', jobname, schedule, command),
         E'\n' order by jobid), '-- 예약 작업 없음') as cron_jobs
from cron.job;

-- ② 스토리지 버킷 (채팅 첨부 등)
select coalesce(string_agg(
         format('insert into storage.buckets (id, name, public) values (%L, %L, %L) on conflict (id) do nothing;',
                id, name, public),
         E'\n' order by id), '-- 버킷 없음') as buckets
from storage.buckets;
