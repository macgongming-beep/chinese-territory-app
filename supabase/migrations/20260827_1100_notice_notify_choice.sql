-- 공지를 올릴 때 알림을 보낼지 고를 수 있게 한다.
--
-- 공지는 **활성 사용자 전원**에게 간다 (지금 60명). 되돌릴 수 없다.
-- 오타를 고쳐 다시 올리거나 시험 삼아 올려도 60명 폰이 울렸다.
--
-- 보낼 때는 기존 트리거가 그대로 돈다. 안 보낼 때만 억제를 켠다
-- (일정 수정 RPC 와 같은 방식).

create or replace function public.create_notice_tx(
  p_token    uuid,
  p_title    text,
  p_content  text,
  p_priority text,
  p_notify   boolean default true
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor_id   integer;
  v_actor_name text;
  v_new_id     integer;
begin
  v_actor_id := public.verify_session(p_token);
  if v_actor_id is null then
    raise exception '세션이 유효하지 않습니다';
  end if;
  select name into v_actor_name from public.app_users where id = v_actor_id;

  if btrim(coalesce(p_title, '')) = '' then
    return jsonb_build_object('ok', false, 'reason', 'empty_title');
  end if;

  if not p_notify then
    perform set_config('app.suppress_notifications', 'on', true);
  end if;

  insert into public.notices (title, content, priority, author)
  values (btrim(p_title), btrim(coalesce(p_content, '')), p_priority, v_actor_name)
  returning id into v_new_id;

  return jsonb_build_object('ok', true, 'id', v_new_id,
                            'notified', case when p_notify then 1 else 0 end);
end;
$$;

-- 공지 알림 트리거에 **억제 검사만** 얹는다.
-- ⚠ 나머지는 운영본 그대로다. 다시 쓰다가 '글쓴이 본인 제외' 와
--   '승인된 사용자만' 을 빠뜨릴 뻔했다 — 얹기만 할 것.
CREATE OR REPLACE FUNCTION public.notify_on_notice_insert()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_author_id integer;
  v_recipient_ids integer[];
  v_title text;
begin
  -- 올린 사람이 '알림 없이' 를 골랐으면 보내지 않는다 (create_notice_tx 가 표식을 세운다)
  if coalesce(current_setting('app.suppress_notifications', true), '') = 'on' then
    return new;
  end if;

  begin
    select id
    into v_author_id
    from public.app_users
    where name = new.author
    limit 1;
  exception
    when undefined_column then
      v_author_id := null;
  end;

  select array_agg(id)
  into v_recipient_ids
  from public.app_users
  where coalesce(is_active, true) is true
    and coalesce(approval_status, 'approved') = 'approved'
    and id is distinct from v_author_id;

  if v_recipient_ids is null or cardinality(v_recipient_ids) = 0 then
    return new;
  end if;

  begin
    v_title := coalesce(new.title, '새 공지');
  exception
    when undefined_column then
      v_title := '새 공지';
  end;

  perform public.insert_notifications(
    v_recipient_ids,
    'notice',
    '새 공지',
    v_title,
    '/notices?noticeId=' || new.id,
    new.id::integer
  );

  perform public.dispatch_push_notification(
    v_recipient_ids,
    'notice',
    '새 공지',
    v_title,
    '/notices?noticeId=' || new.id,
    new.id::integer
  );

  return new;
end;
$function$;

revoke all on function public.create_notice_tx(uuid, text, text, text, boolean) from public;
grant execute on function public.create_notice_tx(uuid, text, text, text, boolean) to anon, authenticated;
