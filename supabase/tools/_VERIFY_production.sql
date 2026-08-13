-- =============================================================
-- 운영 적용 확인 진단 (읽기 전용, 데이터 변경 없음)
-- Supabase SQL Editor에서 통째로 실행 → 결과 표의 status 열 확인
--   OK = 적용됨 / ❌ MISSING = 해당 SQL 미적용
-- =============================================================

with checks as (

  -- ── 테이블 ──
  select '테이블: event_card_assignment_cards (다중 카드 배정)' as item,
    case when to_regclass('public.event_card_assignment_cards') is not null then 'OK' else '❌ MISSING → add_event_card_assignment_cards.sql' end as status
  union all
  select '테이블: card_leader_assignments (다수 인도자)',
    case when to_regclass('public.card_leader_assignments') is not null then 'OK' else '❌ MISSING → add_card_leader_assignments.sql' end
  union all
  select '테이블: return_visits (정기방문)',
    case when to_regclass('public.return_visits') is not null then 'OK' else '❌ MISSING → backfill_return_visits...sql' end
  union all
  select '테이블: service_logs (봉사 로그)',
    case when to_regclass('public.service_logs') is not null then 'OK' else '❌ MISSING' end
  union all
  select '테이블: chat_message_signals (채팅 실시간)',
    case when to_regclass('public.chat_message_signals') is not null then 'OK' else '❌ MISSING → v1plus_chat_signal_patch.sql' end
  union all
  select '테이블: restaurant_requests (식당봉사)',
    case when to_regclass('public.restaurant_requests') is not null then 'OK' else '❌ MISSING → v3_restaurant_service.sql' end
  union all
  select '테이블: informal_groups (비공식 그룹)',
    case when to_regclass('public.informal_groups') is not null then 'OK' else '❌ MISSING → v2_informal_groups.sql' end

  -- ── 컬럼 ──
  union all
  select '컬럼: calendar_events.assignment_status (배정 공유)',
    case when exists (select 1 from information_schema.columns where table_name='calendar_events' and column_name='assignment_status') then 'OK' else '❌ MISSING → event_assignment_status.sql' end
  union all
  select '컬럼: calendar_events.assignment_shared_at',
    case when exists (select 1 from information_schema.columns where table_name='calendar_events' and column_name='assignment_shared_at') then 'OK' else '❌ MISSING → event_assignment_status.sql' end
  union all
  select '컬럼: buildings.is_chinese_heavy (중국어 다수)',
    case when exists (select 1 from information_schema.columns where table_name='buildings' and column_name='is_chinese_heavy') then 'OK' else '❌ MISSING → add_is_chinese_heavy.sql' end
  union all
  select '컬럼: buildings.is_restaurant (식당 마킹)',
    case when exists (select 1 from information_schema.columns where table_name='buildings' and column_name='is_restaurant') then 'OK' else '❌ MISSING → v2_assignment_model.sql' end
  union all
  select '컬럼: app_users.approval_status (가입 승인)',
    case when exists (select 1 from information_schema.columns where table_name='app_users' and column_name='approval_status') then 'OK' else '❌ MISSING → add_app_user_approval_status.sql' end

  -- ── RPC 함수 ──
  union all
  select 'RPC: auth_login (로그인)',
    case when exists (select 1 from pg_proc where proname='auth_login') then 'OK' else '❌ MISSING → auth_hash_pins.sql' end
  union all
  select 'RPC: get_chat_messages (채팅)',
    case when exists (select 1 from pg_proc where proname='get_chat_messages') then 'OK' else '❌ MISSING → v1plus_chat_security_patch.sql' end
  union all
  select 'RPC: mark_all_chats_read (채팅 모두읽음)',
    case when exists (select 1 from pg_proc where proname='mark_all_chats_read') then 'OK' else '❌ MISSING → v1plus_mark_all_chats_read.sql' end
  union all
  select 'RPC: get_service_logs (봉사 로그)',
    case when exists (select 1 from pg_proc where proname='get_service_logs') then 'OK' else '❌ MISSING' end
  union all
  select 'RPC: auto_close_stale_sessions (봉사 자동종료)',
    case when exists (select 1 from pg_proc where proname='auto_close_stale_sessions') then 'OK' else '❌ MISSING → v1plus_auto_service_session_v2.sql' end

  -- ── 트리거 ──
  union all
  select '트리거: on_event_card_assignment_insert (배정 알림)',
    case when exists (select 1 from pg_trigger where tgname='on_event_card_assignment_insert') then 'OK' else '❌ MISSING → v1plus_realtime_assignment_patch.sql' end
  union all
  select '트리거: on_chat_message_insert (채팅 알림)',
    case when exists (select 1 from pg_trigger where tgname='on_chat_message_insert') then 'OK' else '❌ MISSING → v1plus_rpc.sql' end
  union all
  select '트리거: on_chat_message_signal (채팅 실시간 신호)',
    case when exists (select 1 from pg_trigger where tgname='on_chat_message_signal') then 'OK' else '❌ MISSING → v1plus_chat_signal_patch.sql' end

  -- ── 시스템 채팅 알림 스킵 (최근 패치) ──
  union all
  select '패치: 시스템 채팅 알림 스킵 (notify_on_chat_message)',
    case when exists (
      select 1 from pg_proc
      where proname='notify_on_chat_message'
        and pg_get_functiondef(oid) like '%message_type = ''system''%'
    ) then 'OK' else '❌ MISSING → v1plus_skip_system_chat_notifications.sql' end

  -- ── 한국인→대상외 상태 (units check constraint) ──
  union all
  select '데이터: units 상태에 ''대상외'' 허용',
    case when exists (
      select 1 from pg_constraint
      where conname like '%units_status%'
        and pg_get_constraintdef(oid) like '%대상외%'
    ) then 'OK' else '⚠ 확인필요 → rename_korean_status_to_excluded.sql' end
)
select item, status from checks order by
  case when status = 'OK' then 1 else 0 end,  -- 미적용을 위로
  item;
