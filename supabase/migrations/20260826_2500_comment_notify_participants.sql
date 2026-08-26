-- 일정 댓글 알림이 사실상 안 나가던 문제.
--
-- 받는 사람이 '@멘션 + 그 일정의 인도자' 뿐이었다. 두 가지가 문제였다.
--   ① **신청자가 빠져 있었다.** 내가 신청한 일정에 댓글이 달려도 나는 몰랐다.
--   ② 인도자를 `where name = leader_name` 으로 찾는데, leader_name 은
--      "가, 나" 처럼 쉼표로 이어붙인 목록이다. 인도자가 둘 이상이면
--      아무하고도 안 맞아 **받는 사람이 0명 = 알림이 통째로 안 나갔다.**
--      일정 대부분이 인도자 둘 이상이라, 사실상 댓글 알림이 죽어 있었다.
--
-- 받는 사람을 이렇게 고친다: 신청자 전원 + 인도자 전원 + @멘션 − 글쓴이.
-- 그리고 **멘션된 사람과 나머지를 갈라서 보낸다.** 예전에는 누구 하나만
-- 멘션돼도 전원이 '댓글에서 언급됨' 을 받았다 (받는 사람이 하나뿐이라 안 보였을 뿐이다).

-- 쉼표 목록에 든 이름들의 사용자 id 를 돌려준다.
create or replace function public.user_ids_in_name_list(p_list text)
returns integer[]
language sql
stable
as $$
  select coalesce(array_agg(distinct u.id), '{}'::integer[])
  from unnest(string_to_array(coalesce(p_list, ''), ',')) as t(v)
  join public.app_users u on u.name = btrim(t.v)
  where btrim(t.v) <> ''
$$;

create or replace function public.notify_on_comment()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_all       integer[];
  v_mentioned integer[];
  v_others    integer[];
  v_leaders   integer[] := '{}'::integer[];
  v_event_id  integer;
  v_link      text;
  v_body      text;
begin
  if new.target_type = 'calendar_event' then
    v_event_id := new.target_id;
    select public.user_ids_in_name_list(leader_name) into v_leaders
    from public.calendar_events where id = v_event_id;
  end if;

  select array_agg(distinct recipient_id)
  into v_all
  from (
    select unnest(coalesce(new.mention_ids, '{}'::integer[])) as recipient_id
    union all
    -- 공지 글쓴이 (일정 인도자는 아래에서 제대로 다시 넣는다)
    select public.get_comment_target_author_id(new.target_type, new.target_id)
    union all
    -- 일정 인도자 전원 — 쉼표 목록을 쪼갠 것. 예전엔 통짜로 비교해 아무도 못 찾았다
    select unnest(v_leaders)
    union all
    -- 그 일정에 신청한 사람 전원 ← 이게 통째로 빠져 있었다
    select u.id
    from public.event_participants ep
    join public.app_users u on u.name = ep.user_name
    where v_event_id is not null and ep.event_id = v_event_id
  ) recipients
  where recipient_id is not null
    and recipient_id is distinct from new.author_id;

  if v_all is null or cardinality(v_all) = 0 then
    return new;
  end if;

  select coalesce(array_agg(x), '{}'::integer[]) into v_mentioned
  from unnest(v_all) x where x = any(coalesce(new.mention_ids, '{}'::integer[]));
  select coalesce(array_agg(x), '{}'::integer[]) into v_others
  from unnest(v_all) x where not (x = any(coalesce(new.mention_ids, '{}'::integer[])));

  v_link := case new.target_type
    when 'notice' then '/notices?noticeId=' || new.target_id
    when 'calendar_event' then '/calendar?openEvent=' || new.target_id
    else null
  end;
  v_body := new.author_name || ': ' || left(new.content, 50);

  if cardinality(v_mentioned) > 0 then
    perform public.insert_notifications(v_mentioned, 'mention', '댓글에서 언급됨', v_body, v_link, new.id::integer);
    perform public.dispatch_push_notification(v_mentioned, 'mention', '댓글에서 언급됨', v_body, v_link, new.id::integer);
  end if;

  if cardinality(v_others) > 0 then
    perform public.insert_notifications(v_others, 'comment', '새 댓글', v_body, v_link, new.id::integer);
    perform public.dispatch_push_notification(v_others, 'comment', '새 댓글', v_body, v_link, new.id::integer);
  end if;

  return new;
end;
$function$;

grant execute on function public.user_ids_in_name_list(text) to anon, authenticated;
