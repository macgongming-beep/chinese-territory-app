-- 알림이 새는 마지막 구멍: 푸시가 수신자 필터를 안 거쳤다.
--
-- insert_notifications 만 '알림 껐는지·활성인지·승인됐는지' 를 보고,
-- dispatch_push_notification 은 **원본 목록**을 그대로 받아 보냈다.
-- 그래서 앱 안 알림 목록에는 안 생기는데 **휴대폰은 울렸다.**
-- 댓글·채팅·카드배정·비공식배정·식당배정·공지·일정변경·매일요약 여덟 경로가 전부 그랬다.
--
-- 여덟 함수를 각각 고치면 새 알림 종류가 생길 때 또 빠진다.
-- **거르는 자리를 두 함수 안으로 옮겨** 부르는 쪽이 잊을 수 없게 한다.
-- 규칙 자체는 filter_notification_recipients 한 곳에만 있다.

-- 필터에 daily_service 를 더한다.
--
-- 매일 요약은 send_daily_service_digest 가 **자기가 먼저** push_daily_service 로
-- 걸렀고, 필터 함수에는 그 종류가 없어 else true 로 통과했다.
-- 지금까지는 맞게 돌았지만 '주석으로 지키는 규칙' 이었다 —
-- 다른 데서 daily_service 로 부르면 끈 사람에게도 간다.
-- 규칙을 필터 안에 넣어 부르는 쪽이 잊을 수 없게 한다.
create or replace function public.filter_notification_recipients(
  p_user_ids integer[], p_type text
)
returns integer[]
language sql
stable
as $$
  select coalesce(array_agg(distinct u.id), '{}'::integer[])
  from unnest(coalesce(p_user_ids, '{}'::integer[])) as t(uid)
  join public.app_users u on u.id = t.uid
  left join public.notification_preferences pref on pref.user_id = u.id
  where coalesce(u.is_active, true) is true
    and coalesce(u.approval_status, 'approved') = 'approved'
    and case p_type
      when 'notice' then coalesce(pref.push_new_notice, true)
      when 'event_change' then coalesce(pref.push_event_change, true)
      when 'comment' then coalesce(pref.push_comment, true)
      when 'mention' then coalesce(pref.push_mention, true)
      when 'chat' then coalesce(pref.push_chat, true)
      when 'service_started' then coalesce(pref.push_service_status, true)
      when 'service_ended' then coalesce(pref.push_service_status, true)
      when 'daily_service' then coalesce(pref.push_daily_service, true)
      else true
    end
$$;

revoke all on function public.filter_notification_recipients(integer[], text) from public, anon, authenticated;

CREATE OR REPLACE FUNCTION public.dispatch_push_notification(p_user_ids integer[], p_type text, p_title text, p_body text DEFAULT NULL::text, p_link text DEFAULT NULL::text, p_related_id integer DEFAULT NULL::integer)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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

  -- ⚠ 여기서 거르는 것이 핵심이다.
  --   지금까지 insert_notifications 만 걸렀고 푸시는 **원본 목록**을 그대로 받았다.
  --   그래서 '이 알림 끄기' 를 해도 휴대폰은 울렸고, 비활성·미승인 사용자의
  --   옛 구독에도 갔다. 댓글·채팅·배정·공지·일정 여덟 경로가 전부 그랬다.
  --   여덟 곳을 고치는 대신 **여기 한 곳**에서 닫는다 — 새 알림 종류가 생겨도 샐 수 없다.
  p_user_ids := public.filter_notification_recipients(p_user_ids, p_type);

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
$function$;

CREATE OR REPLACE FUNCTION public.insert_notifications(p_user_ids integer[], p_type text, p_title text, p_body text DEFAULT NULL::text, p_link text DEFAULT NULL::text, p_related_id integer DEFAULT NULL::integer)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_inserted integer;
begin
  if p_user_ids is null or cardinality(p_user_ids) = 0 then
    return 0;
  end if;

  -- 거르는 규칙을 여기 또 적지 않는다. 두 곳에 적혀 있으면 한쪽만 고쳐져
  -- 인앱과 푸시가 갈라진다 (실제로 그런 상태였다).
  with filtered as (
    select unnest(public.filter_notification_recipients(p_user_ids, p_type)) as user_id
  ),
  inserted as (
    insert into public.notifications (user_id, type, title, body, link, related_id)
    select user_id, p_type, p_title, p_body, p_link, p_related_id
    from filtered
    returning 1
  )
  select count(*) into v_inserted from inserted;

  return coalesce(v_inserted, 0);
end;
$function$;
