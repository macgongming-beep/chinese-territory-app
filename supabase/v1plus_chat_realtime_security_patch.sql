-- =============================================================
-- v1+ Chat Realtime Security Patch
-- 작성일: 2026-05-14
--
-- v1plus_realtime_fixes.sql 에서 Realtime 구독 오류를 해결하려고
-- chat_messages SELECT 를 다시 열어둔 상태를 닫는다.
--
-- 결정:
-- - chat_messages 본문은 get_chat_messages / get_chat_message_meta /
--   get_chat_message_previews RPC 로만 읽는다.
-- - 클라이언트의 chat_messages postgres_changes 구독은 제거하고,
--   채팅방/헤더는 RPC 폴링으로 갱신한다.
-- =============================================================

revoke select on public.chat_messages from anon, authenticated;
drop policy if exists chat_messages_realtime_select on public.chat_messages;
drop policy if exists chat_messages_read on public.chat_messages;
drop policy if exists open_access on public.chat_messages;

-- 쓰기 역시 계속 RPC 전용으로 유지한다.
revoke insert, update, delete on public.chat_messages from anon, authenticated;
