-- 푸시 발송 함수 복구 (fix_push_config_table.sql 되돌리기)
-- Supabase SQL Editor 에서 전체 실행
--
-- 배경: 실제 운영 중이던 dispatch_push_notification 은 public.app_private_settings
--       테이블에서 Edge Function URL/키를 읽고 있었다(5월부터 정상 동작).
--       진단 중 이를 GUC/private.app_secrets 를 읽는 버전으로 덮어써서
--       설정을 못 찾고 조용히 종료 → HTTP 호출 자체가 안 나가게 됐다.
--
-- 이 스크립트는 원래 동작(app_private_settings 우선)으로 되돌린다.
-- app_private_settings 의 값은 그대로 두므로 별도 입력은 필요 없다.

create or replace function public.dispatch_push_notification(
  p_user_ids integer[],
  p_type text,
  p_title text,
  p_body text default null,
  p_link text default null,
  p_related_id integer default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_url text;
  v_key text;
begin
  -- 운영 설정 위치: public.app_private_settings (anon/authenticated 접근 차단됨)
  select value into v_url from public.app_private_settings where key = 'push_edge_function_url';
  select value into v_key from public.app_private_settings where key = 'push_edge_function_key';

  -- 과거 GUC 방식으로 설정한 환경 호환 (테이블에 없을 때만)
  if v_url is null then
    v_url := nullif(current_setting('app.push_edge_function_url', true), '');
  end if;
  if v_key is null then
    v_key := nullif(current_setting('app.push_edge_function_key', true), '');
  end if;

  if v_url is null or v_key is null or p_user_ids is null or cardinality(p_user_ids) = 0 then
    return;
  end if;

  begin
    perform net.http_post(
      url := v_url,
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || v_key
      ),
      body := jsonb_build_object(
        'recipient_ids', p_user_ids,
        'type', p_type,
        'title', p_title,
        'body', p_body,
        'link', p_link,
        'related_id', p_related_id
      )
    );
  exception
    when others then
      raise notice 'push dispatch skipped: %', sqlerrm;
  end;
end;
$$;

revoke all on function public.dispatch_push_notification(integer[], text, text, text, text, integer) from anon, authenticated;

-- 진단 함수도 실제 설정 위치를 보도록 갱신 (값은 노출하지 않음)
create or replace function public.push_config_status()
returns table (url_set boolean, key_set boolean, source text)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tbl_url text;
  v_tbl_key text;
begin
  select value into v_tbl_url from public.app_private_settings where key = 'push_edge_function_url';
  select value into v_tbl_key from public.app_private_settings where key = 'push_edge_function_key';
  return query select
    v_tbl_url is not null,
    v_tbl_key is not null,
    'app_private_settings'::text;
end;
$$;

revoke all on function public.push_config_status() from anon, authenticated;

-- 진단용으로 만들었던 임시 스키마 제거 (사용하지 않음)
drop table if exists private.app_secrets;
drop schema if exists private cascade;

-- 확인
select * from public.push_config_status();
