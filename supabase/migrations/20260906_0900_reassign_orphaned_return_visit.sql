-- 전출·계정 삭제로 담당자가 끊긴 활동 정기방문을 관리자가 안전하게 재배정한다.
-- return_visits 와 세대의 regular_visits 를 한 트랜잭션에서 함께 맞춘다.
-- 결정 배경: docs/decisions/0001-preserve-orphaned-return-visits.md

create or replace function public.reassign_return_visit_tx(
  p_token uuid,
  p_return_visit_id integer,
  p_new_assignee text
)
returns jsonb
language plpgsql security definer
set search_path = ''
as $$
declare
  v_actor_id integer;
  v_actor_role text;
  v_new_assignee text := btrim(coalesce(p_new_assignee, ''));
  v_unit_id integer;
  v_previous_assignee text;
  v_created_by text;
begin
  v_actor_id := public.verify_session(p_token);
  select role into v_actor_role from public.app_users where id = v_actor_id;
  if not coalesce(v_actor_role in ('admin', 'developer'), false) then
    raise exception '관리자만 정기방문 담당자를 재배정할 수 있습니다' using errcode = '42501';
  end if;

  if v_new_assignee = '' or not exists (
    select 1
    from public.app_users
    where name = v_new_assignee
      and coalesce(is_active, true) is true
      and coalesce(approval_status, 'approved') = 'approved'
  ) then
    raise exception '재배정할 활성 사용자를 찾을 수 없습니다';
  end if;

  select unit_id, assigned_user_name, created_by
  into v_unit_id, v_previous_assignee, v_created_by
  from public.return_visits
  where id = p_return_visit_id
  for update;

  if not found then
    raise exception '정기방문을 찾을 수 없습니다';
  end if;

  update public.return_visits
  set assigned_user_name = v_new_assignee
  where id = p_return_visit_id;

  if v_unit_id is not null then
    insert into public.regular_visits (unit_id, visitor_name, registered_at)
    values (v_unit_id, v_new_assignee, now())
    on conflict (unit_id) do update
      set visitor_name = excluded.visitor_name,
          registered_at = excluded.registered_at;
  end if;

  return jsonb_build_object(
    'ok', true,
    'id', p_return_visit_id,
    'unit_id', v_unit_id,
    'previous_assignee', coalesce(nullif(btrim(v_previous_assignee), ''), nullif(btrim(v_created_by), '')),
    'new_assignee', v_new_assignee
  );
end;
$$;

revoke all on function public.reassign_return_visit_tx(uuid,integer,text) from public, anon, authenticated;
grant execute on function public.reassign_return_visit_tx(uuid,integer,text) to anon, authenticated;

notify pgrst, 'reload schema';
