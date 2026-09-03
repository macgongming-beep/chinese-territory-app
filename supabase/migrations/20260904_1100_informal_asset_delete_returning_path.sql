-- 비공식 자료를 지울 때 사진 경로를 함께 돌려준다.
--
-- 전에는 클라이언트가 (1) image_path 를 SELECT 하고 (2) 삭제 RPC 를 부르고
-- (3) Storage 파일을 지웠다. 세 가지가 어긋난다:
--   · (1) 이 네트워크 오류면 경로가 빈 값이 되는데 (2) 는 성공한다 → 행은 지워지고
--     **공개 버킷에 파일만 조용히 남는다**
--   · (1) 과 (2) 사이에 사진이 바뀌면 옛 파일을 지우고 새 파일이 남는다
--   · 일괄 삭제에서 왕복이 항목마다 하나씩 늘어난다
-- delete ... returning 이면 셋 다 사라진다.
--
-- ⚠ 기존 delete_informal_asset_secure 는 **지우지 않는다.** 홈화면 PWA 에
--   옛 번들이 남아 있을 수 있고, 그 앱은 boolean 을 기대한다. 반환형이 바뀌면
--   "삭제 실패" 를 띄우면서 행은 지워지는 최악의 모양이 된다.

create or replace function public.delete_informal_asset_secure_v2(
  p_token uuid,
  p_asset_id integer
)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id integer;
  v_role text;
  v_image_path text;
  v_deleted integer := 0;
begin
  v_user_id := public.verify_session(p_token);

  select role
    into v_role
  from public.app_users
  where id = v_user_id;

  if not coalesce(v_role in ('admin', 'developer'), false) then
    raise exception 'permission denied';
  end if;

  delete from public.informal_assets
  where id = p_asset_id
  returning coalesce(image_path, '') into v_image_path;

  get diagnostics v_deleted = row_count;
  if v_deleted = 0 then
    raise exception 'informal asset not found';
  end if;

  -- 사진이 없는 자료는 빈 글자를 돌려준다 (호출부가 Storage 를 건너뛴다)
  return coalesce(v_image_path, '');
end;
$$;

revoke all on function public.delete_informal_asset_secure_v2(uuid, integer) from public;
grant execute on function public.delete_informal_asset_secure_v2(uuid, integer) to anon, authenticated;

do $$
begin
  if not has_function_privilege('anon', 'public.delete_informal_asset_secure_v2(uuid,integer)', 'EXECUTE')
     or not has_function_privilege('authenticated', 'public.delete_informal_asset_secure_v2(uuid,integer)', 'EXECUTE') then
    raise exception 'delete_informal_asset_secure_v2 실행 권한이 예상과 다릅니다';
  end if;

  if exists (
    select 1
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    cross join lateral aclexplode(coalesce(p.proacl, acldefault('f', p.proowner))) acl
    where n.nspname = 'public'
      and p.proname = 'delete_informal_asset_secure_v2'
      and acl.grantee = 0
      and acl.privilege_type = 'EXECUTE'
  ) then
    raise exception 'delete_informal_asset_secure_v2 가 PUBLIC 에 열려 있습니다';
  end if;

  -- 옛 함수는 그대로 살아 있어야 한다 (캐시에 남은 앱이 부른다)
  if not exists (
    select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'delete_informal_asset_secure'
  ) then
    raise exception '옛 delete_informal_asset_secure 가 사라졌습니다';
  end if;
end $$;

notify pgrst, 'reload schema';
