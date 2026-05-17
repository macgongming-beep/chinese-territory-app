-- 비공식 자료 삭제 보안 패치
-- SELECT/INSERT/UPDATE 는 기존처럼 유지하고, DELETE 만 admin/developer RPC 로 잠근다.
-- Supabase SQL Editor 에서 실행 필요

drop policy if exists "informal_assets_anon_delete" on storage.objects;

create or replace function public.delete_informal_asset_secure(
  p_token uuid,
  p_asset_id integer
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id integer;
  v_role text;
begin
  v_user_id := public.verify_session(p_token);

  select role
    into v_role
  from public.app_users
  where id = v_user_id;

  if v_role not in ('admin', 'developer') then
    raise exception 'permission denied';
  end if;

  delete from public.informal_assets
  where id = p_asset_id;

  -- Storage 파일은 환경별 삭제 함수 지원 여부가 달라 여기서는 DB row 삭제만 수행한다.
  -- 필요 시 service_role Edge Function 또는 정리 cron 으로 image_path orphan 을 청소한다.
  return true;
end;
$$;

revoke all on function public.delete_informal_asset_secure(uuid, integer) from public;
grant execute on function public.delete_informal_asset_secure(uuid, integer) to anon, authenticated;
