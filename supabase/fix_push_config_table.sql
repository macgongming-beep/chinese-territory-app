-- 푸시 알림 설정을 DB 설정값(GUC) → 비공개 테이블로 이전
--
-- 배경: dispatch_push_notification 은 current_setting('app.push_edge_function_*') 로
--       Edge Function URL/키를 읽는데, 최신 Supabase 는 SQL Editor 에서
--       `alter database ... set` 을 막아(42501) 값을 넣을 수 없다.
--       값이 비면 함수가 조용히 종료 → 알림(notifications)은 쌓이는데 푸시만 안 감.
--
-- 해결: private 스키마의 설정 테이블에서 읽도록 변경.
--       · private 스키마는 PostgREST 에 노출되지 않아 anon/authenticated 가 못 읽음
--         (service_role 키가 앱에 노출되지 않도록)
--       · GUC 가 설정돼 있으면 그것을 우선 사용 → 기존 환경과도 호환
--
-- 실행: Supabase SQL Editor 에서 아래 전체 실행 후, 맨 아래 INSERT 의 값을 채워 실행.

-- ─── 1. 비공개 설정 테이블 ────────────────────────────────
create schema if not exists private;

create table if not exists private.app_secrets (
  key        text primary key,
  value      text not null,
  updated_at timestamptz not null default now()
);

-- anon/authenticated 는 접근 불가 (service_role 과 함수 소유자만)
revoke all on schema private from anon, authenticated;
revoke all on all tables in schema private from anon, authenticated;
alter table private.app_secrets enable row level security;

-- ─── 2. dispatch_push_notification: 테이블에서 설정 읽기 ──
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
  -- GUC 우선(기존 환경 호환), 없으면 비공개 테이블
  v_url := nullif(current_setting('app.push_edge_function_url', true), '');
  v_key := nullif(current_setting('app.push_edge_function_key', true), '');

  if v_url is null then
    select value into v_url from private.app_secrets where key = 'push_edge_function_url';
  end if;
  if v_key is null then
    select value into v_key from private.app_secrets where key = 'push_edge_function_key';
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

-- ─── 3. 설정 진단용 함수 (값 자체는 노출하지 않음) ────────
create or replace function public.push_config_status()
returns table (url_set boolean, key_set boolean, source text)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_guc_url text := nullif(current_setting('app.push_edge_function_url', true), '');
  v_tbl_url text;
  v_guc_key text := nullif(current_setting('app.push_edge_function_key', true), '');
  v_tbl_key text;
begin
  select value into v_tbl_url from private.app_secrets where key = 'push_edge_function_url';
  select value into v_tbl_key from private.app_secrets where key = 'push_edge_function_key';
  return query select
    coalesce(v_guc_url, v_tbl_url) is not null,
    coalesce(v_guc_key, v_tbl_key) is not null,
    case when v_guc_url is not null then 'guc' when v_tbl_url is not null then 'table' else 'none' end;
end;
$$;

revoke all on function public.push_config_status() from anon, authenticated;

-- ─── 4. 값 입력 (아래 두 줄의 <...> 를 실제 값으로 바꿔 실행) ──
-- URL: Supabase Dashboard → Edge Functions → send-push 의 URL
-- KEY: Edge Function 환경변수 PUSH_EDGE_FUNCTION_KEY 와 동일한 값
--
-- insert into private.app_secrets (key, value) values
--   ('push_edge_function_url', 'https://<프로젝트ref>.supabase.co/functions/v1/send-push'),
--   ('push_edge_function_key', '<PUSH_EDGE_FUNCTION_KEY 값>')
-- on conflict (key) do update set value = excluded.value, updated_at = now();

-- ─── 5. 확인 ──────────────────────────────────────────────
-- select * from public.push_config_status();   -- url_set/key_set 이 true 여야 함
