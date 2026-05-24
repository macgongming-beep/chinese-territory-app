-- v1+ 댓글 알림 링크 보정
-- 문제: 일정 댓글 알림이 /calendar?openChat=... 으로 생성되어
--       댓글 멘션도 채팅 알림처럼 그룹화/이동됨.
-- 해결: 일정 댓글은 /calendar?openEvent=... 로 이동시킨다.

create or replace function public.notify_on_comment()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_target_author_id integer;
  v_recipient_ids integer[];
  v_link text;
  v_type text;
begin
  v_target_author_id := public.get_comment_target_author_id(new.target_type, new.target_id);

  select array_agg(distinct recipient_id)
  into v_recipient_ids
  from (
    select unnest(coalesce(new.mention_ids, '{}'::integer[])) as recipient_id
    union all
    select v_target_author_id
  ) recipients
  where recipient_id is not null
    and recipient_id is distinct from new.author_id;

  if v_recipient_ids is null or cardinality(v_recipient_ids) = 0 then
    return new;
  end if;

  v_link := case new.target_type
    when 'notice' then '/notices?noticeId=' || new.target_id
    when 'calendar_event' then '/calendar?openEvent=' || new.target_id
    else null
  end;

  v_type := case
    when cardinality(coalesce(new.mention_ids, '{}'::integer[])) > 0 then 'mention'
    else 'comment'
  end;

  perform public.insert_notifications(
    v_recipient_ids,
    v_type,
    case when v_type = 'mention' then '댓글에서 언급됨' else '새 댓글' end,
    new.author_name || ': ' || left(new.content, 50),
    v_link,
    new.id::integer
  );

  perform public.dispatch_push_notification(
    v_recipient_ids,
    v_type,
    case when v_type = 'mention' then '댓글에서 언급됨' else '새 댓글' end,
    new.author_name || ': ' || left(new.content, 50),
    v_link,
    new.id::integer
  );

  return new;
end;
$$;

drop trigger if exists on_comment_insert on public.comments;
create trigger on_comment_insert
after insert on public.comments
for each row execute function public.notify_on_comment();
