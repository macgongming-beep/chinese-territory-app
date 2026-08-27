-- 알림 수신자 필터. **다른 것보다 먼저 있어야 한다** —
-- 그래서 파일 이름을 20260826_2350 으로 둔다 (2400 트리거보다 앞서 돌게).
-- 처음엔 20260827_0900 로 뒀는데, 이름 순서로 재생하면 트리거가 먼저 돌아
-- 새 회중 설치가 깨진다. 운영 묶음만 손으로 정렬해선 안 된다.
-- 일정 트리거와 공지 트리거, 두 RPC 가 이걸 부른다.

-- 알림을 실제로 받을 사람만 남긴다.
--
-- ⚠ 지금까지 insert_notifications 만 걸렀고 dispatch_push_notification 은
--   **거르지 않은 목록**을 그대로 받았다. 그래서 '이 알림 끄기' 를 해도
--   휴대폰 푸시는 갔고, 비활성·미승인 사용자의 옛 구독에도 갔다.
--   앱 전체에 있던 문제다 (댓글·채팅·배정도 같다). 여기서 공용 함수를 만들고
--   새 RPC 부터 쓴다. 나머지 트리거는 뒤이어 옮긴다.
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
      else true
    end
$$;

-- 내부 전용이다. anon 에 열어두면 임의의 사용자 id 목록과 알림 종류를 넣어
-- 누가 어떤 알림을 켜뒀는지 캐낼 수 있다.
revoke all on function public.filter_notification_recipients(integer[], text) from public, anon, authenticated;
