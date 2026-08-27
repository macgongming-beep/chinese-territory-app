-- 알림·권한 매트릭스 검증. **테스트 DB 에서만** 돌린다.
--
-- 확인하는 것 (칸마다):
--   · 바뀐 일정 행 수
--   · notifications 생성 건수 / 대상 사람 수
--   · 작성자 본인이 포함됐는지
--   · notify=false 일 때 0건인지
--   · 권한 실패 뒤 DB 가 **전혀** 안 바뀌었는지
--
-- 끝나면 만든 자료를 지우고 결과표만 남긴다.

do $$
declare
  v_env text;
begin
  select value into v_env from public.app_private_settings where key = 'environment';
  if coalesce(v_env, '') <> 'test' then
    raise exception '이 DB 에는 테스트 표식이 없습니다 — 중단합니다. (app_private_settings 의 environment=test)';
  end if;
end $$;

drop table if exists public._notify_matrix_result;
create table public._notify_matrix_result (
  seq          serial primary key,
  칸           text,
  결과         text,
  바뀐일정     integer,
  알림건수     integer,
  받은사람     integer,
  본인포함     boolean,
  판정         text
);

do $$
declare
  v_series   uuid := gen_random_uuid();
  v_admin    integer; v_admin_tok  uuid := gen_random_uuid();
  v_lead_all integer; v_lead_all_tok uuid := gen_random_uuid();
  v_lead_one integer; v_lead_one_tok uuid := gen_random_uuid();
  v_plain    integer; v_plain_tok  uuid := gen_random_uuid();
  v_e1 integer; v_e2 integer; v_e3 integer;
  v_before_e bigint;
  v_upd integer; v_cnt integer; v_ppl integer; v_self boolean;
  v_res jsonb;
  v_t0 timestamptz;

begin
  -- ── 사람 넷 ────────────────────────────────────────────
  insert into public.app_users (login_id, name, pin, role)
  values ('mtx-admin', '매트릭스관리자', '1234', 'admin') returning id into v_admin;
  insert into public.app_users (login_id, name, pin, role)
  values ('mtx-lead-all', '매트릭스전담인도자', '1234', 'leader') returning id into v_lead_all;
  insert into public.app_users (login_id, name, pin, role)
  values ('mtx-lead-one', '매트릭스일부인도자', '1234', 'leader') returning id into v_lead_one;
  insert into public.app_users (login_id, name, pin, role)
  values ('mtx-plain', '매트릭스일반', '1234', 'user') returning id into v_plain;

  insert into public.auth_sessions (token, user_id, expires_at) values
    (v_admin_tok, v_admin, now() + interval '1 hour'),
    (v_lead_all_tok, v_lead_all, now() + interval '1 hour'),
    (v_lead_one_tok, v_lead_one, now() + interval '1 hour'),
    (v_plain_tok, v_plain, now() + interval '1 hour');

  -- ── 반복 일정 셋. 인도자는 전담인도자, 첫 회차에만 일부인도자도 넣는다 ──
  insert into public.calendar_events (event_date, time, title, type, place, leader_name, series_id)
  values (current_date + 7, '10:00', '매트릭스봉사', '봉사', '가', '매트릭스전담인도자, 매트릭스일부인도자', v_series)
  returning id into v_e1;
  insert into public.calendar_events (event_date, time, title, type, place, leader_name, series_id)
  values (current_date + 14, '10:00', '매트릭스봉사', '봉사', '가', '매트릭스전담인도자', v_series)
  returning id into v_e2;
  insert into public.calendar_events (event_date, time, title, type, place, leader_name, series_id)
  values (current_date + 21, '10:00', '매트릭스봉사', '봉사', '가', '매트릭스전담인도자', v_series)
  returning id into v_e3;

  -- 신청자는 **회차마다 다르게** (합집합 계산이 중요한 이유)
  insert into public.event_participants (event_id, user_name, role) values
    (v_e2, '매트릭스일반', '참여'),
    (v_e3, '매트릭스관리자', '참여');

  -- ═══ 칸 1: 관리자 · 반복 · notify=true ═══
  v_t0 := clock_timestamp();
  v_res := public.update_calendar_event_series_tx(
    v_admin_tok, v_series, current_date + 7,
    jsonb_build_object('place', '바뀐장소1'), true);
  select count(*), count(distinct user_id),
         bool_or(user_id = v_admin)
    into v_cnt, v_ppl, v_self
    from public.notifications where created_at >= v_t0 and type = 'event_change';
  insert into public._notify_matrix_result (칸, 결과, 바뀐일정, 알림건수, 받은사람, 본인포함, 판정)
  values ('1 관리자·반복·알림보냄', v_res::text, (v_res->>'updated')::int, v_cnt, v_ppl, v_self,
    case when (v_res->>'updated')::int = 3 and v_cnt = v_ppl and v_ppl >= 1 and not v_self
         then 'OK (일정3 · 사람당 1건 · 본인 제외)'
         else '⚠ 확인' end);

  -- ═══ 칸 2: 관리자 · 반복 · notify=false ═══
  v_t0 := clock_timestamp();
  v_res := public.update_calendar_event_series_tx(
    v_admin_tok, v_series, current_date + 7,
    jsonb_build_object('place', '바뀐장소2'), false);
  select count(*) into v_cnt from public.notifications where created_at >= v_t0;
  insert into public._notify_matrix_result (칸, 결과, 바뀐일정, 알림건수, 판정)
  values ('2 관리자·반복·알림안보냄', v_res::text, (v_res->>'updated')::int, v_cnt,
    case when v_cnt = 0 then 'OK (0건)' else '⚠ 알림이 나갔다' end);

  -- ═══ 칸 3: 전담 인도자 · 반복 · notify=true ═══
  v_t0 := clock_timestamp();
  v_res := public.update_calendar_event_series_tx(
    v_lead_all_tok, v_series, current_date + 7,
    jsonb_build_object('place', '바뀐장소3'), true);
  select count(*), count(distinct user_id), bool_or(user_id = v_lead_all)
    into v_cnt, v_ppl, v_self
    from public.notifications where created_at >= v_t0 and type = 'event_change';
  insert into public._notify_matrix_result (칸, 결과, 바뀐일정, 알림건수, 받은사람, 본인포함, 판정)
  values ('3 전담인도자·반복·알림보냄', v_res::text, (v_res->>'updated')::int, v_cnt, v_ppl, v_self,
    case when (v_res->>'updated')::int = 3 and not v_self then 'OK' else '⚠ 확인' end);

  -- ═══ 칸 4: 일부만 인도한 사람 · 반복 → 거부돼야 한다 ═══
  select count(*) into v_before_e from public.calendar_events where series_id = v_series and place = '바뀐장소4';
  begin
    v_res := public.update_calendar_event_series_tx(
      v_lead_one_tok, v_series, current_date + 7,
      jsonb_build_object('place', '바뀐장소4'), true);
    insert into public._notify_matrix_result (칸, 결과, 판정)
    values ('4 일부인도자·반복', v_res::text, '⚠ 막혔어야 하는데 통과했다');
  exception when others then
    select count(*) into v_cnt from public.calendar_events where series_id = v_series and place = '바뀐장소4';
    insert into public._notify_matrix_result (칸, 결과, 바뀐일정, 판정)
    values ('4 일부인도자·반복', sqlerrm, v_cnt,
      case when v_cnt = 0 then 'OK (거부 + DB 그대로)' else '⚠ 거부했는데 DB 가 바뀌었다' end);
  end;

  -- ═══ 칸 5: 일반 사용자 · 반복 → 거부 ═══
  begin
    v_res := public.update_calendar_event_series_tx(
      v_plain_tok, v_series, current_date + 7,
      jsonb_build_object('place', '바뀐장소5'), true);
    insert into public._notify_matrix_result (칸, 결과, 판정)
    values ('5 일반사용자·반복', v_res::text, '⚠ 막혔어야 하는데 통과했다');
  exception when others then
    select count(*) into v_cnt from public.calendar_events where series_id = v_series and place = '바뀐장소5';
    insert into public._notify_matrix_result (칸, 결과, 바뀐일정, 판정)
    values ('5 일반사용자·반복', sqlerrm, v_cnt,
      case when v_cnt = 0 then 'OK (거부 + DB 그대로)' else '⚠ DB 가 바뀌었다' end);
  end;

  -- ═══ 칸 6: 관리자 · 단일 · notify=false ═══
  v_t0 := clock_timestamp();
  v_res := public.update_calendar_event_tx(v_admin_tok, v_e1, jsonb_build_object('place', '단일변경'), false);
  select count(*) into v_cnt from public.notifications where created_at >= v_t0;
  insert into public._notify_matrix_result (칸, 결과, 바뀐일정, 알림건수, 판정)
  values ('6 관리자·단일·알림안보냄', v_res::text, (v_res->>'updated')::int, v_cnt,
    case when v_cnt = 0 and (v_res->>'updated')::int = 1 then 'OK' else '⚠ 확인' end);

  -- ═══ 칸 7: 알림 대상 아닌 칸(메모)만 바꾸면 notify=true 여도 안 나간다 ═══
  v_t0 := clock_timestamp();
  v_res := public.update_calendar_event_series_tx(
    v_admin_tok, v_series, current_date + 7,
    jsonb_build_object('memo', '메모만 바꿈'), true);
  select count(*) into v_cnt from public.notifications where created_at >= v_t0;
  insert into public._notify_matrix_result (칸, 결과, 바뀐일정, 알림건수, 판정)
  values ('7 메모만 바꿈·알림보냄', v_res::text, (v_res->>'updated')::int, v_cnt,
    case when v_cnt = 0 then 'OK (서버가 알림 대상 아님을 판단)' else '⚠ 메모만 바꿨는데 알림이 나갔다' end);

  -- ═══ 칸 8: 공지 — 일반 사용자는 거부 ═══
  begin
    v_res := public.create_notice_tx(v_plain_tok, '매트릭스공지', '내용', 'normal', true);
    insert into public._notify_matrix_result (칸, 결과, 판정)
    values ('8 일반사용자·공지', v_res::text, '⚠ 막혔어야 하는데 통과했다');
  exception when others then
    insert into public._notify_matrix_result (칸, 결과, 판정)
    values ('8 일반사용자·공지', sqlerrm, 'OK (거부)');
  end;

  -- ═══ 칸 9: 공지 — 관리자 · notify=false ═══
  v_t0 := clock_timestamp();
  v_res := public.create_notice_tx(v_admin_tok, '매트릭스공지-조용히', '내용', 'normal', false);
  select count(*) into v_cnt from public.notifications where created_at >= v_t0;
  insert into public._notify_matrix_result (칸, 결과, 알림건수, 판정)
  values ('9 관리자·공지·알림안보냄', v_res::text, v_cnt,
    case when v_cnt = 0 then 'OK (0건)' else '⚠ 알림이 나갔다' end);

  -- ═══ 칸 10: 공지 — 관리자 · notify=true (본인 제외 확인) ═══
  v_t0 := clock_timestamp();
  v_res := public.create_notice_tx(v_admin_tok, '매트릭스공지-알림', '내용', 'normal', true);
  select count(*), count(distinct user_id), bool_or(user_id = v_admin)
    into v_cnt, v_ppl, v_self
    from public.notifications where created_at >= v_t0 and type = 'notice';
  insert into public._notify_matrix_result (칸, 결과, 알림건수, 받은사람, 본인포함, 판정)
  values ('10 관리자·공지·알림보냄', v_res::text, v_cnt, v_ppl, v_self,
    case when v_cnt > 0 and not v_self then 'OK (본인 제외)' else '⚠ 확인' end);

  -- ── 뒷정리 ────────────────────────────────────────────
  delete from public.notifications
   where related_id in (select id from public.calendar_events where series_id = v_series)
      or related_id in (select id from public.notices where title like '매트릭스공지%');
  delete from public.notices where title like '매트릭스공지%';
  delete from public.event_participants where event_id in (v_e1, v_e2, v_e3);
  delete from public.calendar_events where series_id = v_series;
  delete from public.auth_sessions where user_id in (v_admin, v_lead_all, v_lead_one, v_plain);
  delete from public.app_users where id in (v_admin, v_lead_all, v_lead_one, v_plain);
end $$;

select 칸, 판정, 바뀐일정, 알림건수, 받은사람, 본인포함, left(결과, 70) as 응답
from public._notify_matrix_result order by seq;
