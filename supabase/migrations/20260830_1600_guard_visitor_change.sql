-- 방문 기록의 **방문자 이름**은 관리자·인도자만 바꿀 수 있다.
--
-- 왜 (2026-08-30 리뷰):
--   화면에서는 관리자·인도자에게만 '방문자' 칸을 보여 주지만, 저장은
--   `visit_histories` 를 **직접 UPDATE** 하고 RLS 는 '로그인했나' 만 본다.
--   즉 **일반 사용자도 API 로 남의 기록을 자기 것으로 돌릴 수 있다.**
--   화면에만 있는 권한은 권한이 아니다.
--
-- ⚠ 다른 칸(결과·시간대·메모·날짜)은 그대로 둔다. 그건 원래 누구나 고칠 수 있고,
--   이번에 좁히려는 것은 **누구 기록인가**뿐이다.
--
-- ⚠ 트리거는 invoker 로 둔다. definer 면 함수 안에서 current_user 가 언제나
--   소유자라 "누가 부르는가" 를 볼 수 없다. → anon 이 public.session_is_admin()
--   같은 창구를 부를 수 있어야 한다 (이미 grant 돼 있다).

create or replace function public.session_can_change_visitor()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(private.request_session_role() in ('admin', 'developer', 'leader'), false)
$$;
revoke all on function public.session_can_change_visitor() from public;
grant execute on function public.session_can_change_visitor() to anon, authenticated;

create or replace function public.guard_visit_visitor_change()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  -- 방문자가 그대로면 볼 것 없다 (결과·메모만 고치는 흔한 경우)
  if new.visitor_name is not distinct from old.visitor_name then
    return new;
  end if;

  -- DB 관리자·서버 키 (SQL Editor, 백업/배치·CSV 왕복 편집 등)
  if current_user in ('postgres', 'supabase_admin', 'service_role') then
    return new;
  end if;

  if (select public.session_can_change_visitor()) then
    return new;
  end if;

  raise exception '방문자는 관리자·인도자만 바꿀 수 있습니다';
end;
$$;

drop trigger if exists visit_histories_guard_visitor on public.visit_histories;
create trigger visit_histories_guard_visitor
  before update on public.visit_histories
  for each row execute function public.guard_visit_visitor_change();
