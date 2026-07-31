-- 푸시 알림 진단 (읽기 전용) — Supabase SQL Editor 에서 실행
--
-- 푸시가 안 갈 때 어디서 끊겼는지 확인한다.
-- notifications 는 쌓이는데 폰에 안 오면 대부분 1) 설정값 누락 이다.

-- 1) DB 설정값 (이게 비어 있으면 dispatch_push_notification 이 조용히 종료됨)
select
  coalesce(nullif(current_setting('app.push_edge_function_url', true), ''), '(없음)') as push_url,
  case
    when nullif(current_setting('app.push_edge_function_key', true), '') is null then '(없음)'
    else '설정됨'
  end as push_key;

-- 2) pg_net 확장 설치 여부 (HTTP 호출에 필요)
select exists (select 1 from pg_extension where extname = 'pg_net') as pg_net_installed;

-- 3) 최근 HTTP 호출 결과 (pg_net) — 200 이 아니면 Edge Function 쪽 문제
select id, status_code, created, left(coalesce(content, ''), 200) as body
from net._http_response
order by created desc
limit 10;

-- 4) 실패/대기 중인 요청 큐
select count(*) as pending_requests from net.http_request_queue;
