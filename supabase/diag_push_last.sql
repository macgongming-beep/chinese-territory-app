-- 푸시 발송 로그 확인용 (읽기 전용) — Supabase SQL Editor 에서 실행
-- net 스키마는 REST 로 조회할 수 없어, 서비스 키로 호출 가능한 함수로 감싼다.

create or replace function public.push_recent_responses(p_limit int default 10)
returns table (id bigint, status_code int, created timestamptz, body text)
language sql
security definer
set search_path = public
as $$
  select r.id, r.status_code, r.created, left(coalesce(r.content, ''), 300)
  from net._http_response r
  order by r.created desc
  limit p_limit;
$$;

revoke all on function public.push_recent_responses(int) from anon, authenticated;

-- 확인
select * from public.push_recent_responses(10);
