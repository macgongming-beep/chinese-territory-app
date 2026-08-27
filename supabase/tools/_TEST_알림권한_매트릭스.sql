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
--
-- ⚠ 이 스크립트는 열 칸이 **한 트랜잭션**에서 돈다. 운영은 호출마다 트랜잭션이 다르다.
--   그 차이 때문에 억제 표식이 앞 칸에서 뒤 칸으로 새는 일이 있었다.
--   그래서 칸마다 표식을 초기화한다. **RPC 가 표식을 지우게 만들면 안 된다** —
--   그건 시험 사정 때문에 운영 코드를 굽히는 것이다.
--   API 를 실제로 거치는 검증은 `npm run smoke:notify` 가 따로 한다.
--
-- ⚠ 알림 건수는 **id 물길**로 센다. 시각으로 세면 안 된다 —
--   notifications.created_at 의 기본값은 now() 이고, now() 는 **트랜잭션 시작 시각**이라
--   블록 안에서 clock_timestamp() 로 찍은 기준보다 항상 이르다.
--   처음에 그렇게 짰다가 알림이 전부 0건으로 나와 코드가 잘못된 줄 알았다.

do $$
declare
  v_env text;
begin
  select value into v_env from public.app_private_settings where key = 'environment';
  if coalesce(v_env, '') <> 'test' then
    raise exception '이 DB 에는 테스트 표식이 없습니다 — 중단합니다. (app_private_settings 의 environment=test)';
  end if;
end $$;

-- 앞선 시도가 중간에 멈췄을 수 있으니 먼저 치운다
delete from public.auth_sessions where user_id in (select id from public.app_users where login_id like 'mtx-%');
delete from public.event_participants where user_name like '매트릭스%';
delete from public.notifications where related_id in (select id from public.calendar_events where title = '매트릭스봉사');
delete from public.calendar_events where title = '매트릭스봉사';
delete from public.notices where title like '매트릭스공지%';
delete from public.notification_preferences where user_id in (select id from public.app_users where login_id like 'mtx-%');
delete from public.app_users where login_id like 'mtx-%';

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
  v_mark bigint;   -- 알림 세는 물길. 시각으로 세면 안 된다(아래 설명)

begin
  -- ── 사람 넷 ────────────────────────────────────────────
  -- 승인·활성을 명시한다 (insert_notifications 가 미승인·비활성을 거른다).
  -- 기본값도 approved 지만 시험은 조건을 눈에 보이게 적는다.
  insert into public.app_users (login_id, name, pin, role, approval_status, is_active)
  values ('mtx-admin', '매트릭스관리자', '1234', 'admin', 'approved', true) returning id into v_admin;
  insert into public.app_users (login_id, name, pin, role, approval_status, is_active)
  values ('mtx-lead-all', '매트릭스전담인도자', '1234', 'leader', 'approved', true) returning id into v_lead_all;
  insert into public.app_users (login_id, name, pin, role, approval_status, is_active)
  values ('mtx-lead-one', '매트릭스일부인도자', '1234', 'leader', 'approved', true) returning id into v_lead_one;
  insert into public.app_users (login_id, name, pin, role, approval_status, is_active)
  values ('mtx-plain', '매트릭스일반', '1234', 'user', 'approved', true) returning id into v_plain;

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
    (v_e2, '매트릭스일반', '신청'),
    (v_e3, '매트릭스관리자', '신청');

  -- ═══ 칸 1: 관리자 · 반복 · notify=true ═══
  perform set_config('app.suppress_notifications', '', true);   -- 칸마다 표식 초기화
  perform set_config('app.actor_id', '', true);
  select coalesce(max(id), 0) into v_mark from public.notifications;
  v_res := public.update_calendar_event_series_tx(
    v_admin_tok, v_series, current_date + 7,
    jsonb_build_object('place', '바뀐장소1'), true);
  select count(*), count(distinct user_id),
         bool_or(user_id = v_admin)
    into v_cnt, v_ppl, v_self
    from public.notifications where id > v_mark and type = 'event_change';
  insert into public._notify_matrix_result (칸, 결과, 바뀐일정, 알림건수, 받은사람, 본인포함, 판정)
  values ('1 관리자·반복·알림보냄', v_res::text, (v_res->>'updated')::int, v_cnt, v_ppl, v_self,
    case when (v_res->>'updated')::int = 3 and v_cnt = v_ppl and v_ppl >= 1 and not v_self
         then 'OK (일정3 · 사람당 1건 · 본인 제외)'
         else '⚠ 확인' end);

  -- ═══ 칸 2: 관리자 · 반복 · notify=false ═══
  perform set_config('app.suppress_notifications', '', true);   -- 칸마다 표식 초기화
  perform set_config('app.actor_id', '', true);
  select coalesce(max(id), 0) into v_mark from public.notifications;
  v_res := public.update_calendar_event_series_tx(
    v_admin_tok, v_series, current_date + 7,
    jsonb_build_object('place', '바뀐장소2'), false);
  select count(*) into v_cnt from public.notifications where id > v_mark;
  insert into public._notify_matrix_result (칸, 결과, 바뀐일정, 알림건수, 판정)
  values ('2 관리자·반복·알림안보냄', v_res::text, (v_res->>'updated')::int, v_cnt,
    case when v_cnt = 0 then 'OK (0건)' else '⚠ 알림이 나갔다' end);

  -- ═══ 칸 3: 전담 인도자 · 반복 · notify=true ═══
  perform set_config('app.suppress_notifications', '', true);   -- 칸마다 표식 초기화
  perform set_config('app.actor_id', '', true);
  select coalesce(max(id), 0) into v_mark from public.notifications;
  v_res := public.update_calendar_event_series_tx(
    v_lead_all_tok, v_series, current_date + 7,
    jsonb_build_object('place', '바뀐장소3'), true);
  select count(*), count(distinct user_id), bool_or(user_id = v_lead_all)
    into v_cnt, v_ppl, v_self
    from public.notifications where id > v_mark and type = 'event_change';
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
  perform set_config('app.suppress_notifications', '', true);   -- 칸마다 표식 초기화
  perform set_config('app.actor_id', '', true);
  select coalesce(max(id), 0) into v_mark from public.notifications;
  v_res := public.update_calendar_event_tx(v_admin_tok, v_e1, jsonb_build_object('place', '단일변경'), false);
  select count(*) into v_cnt from public.notifications where id > v_mark;
  insert into public._notify_matrix_result (칸, 결과, 바뀐일정, 알림건수, 판정)
  values ('6 관리자·단일·알림안보냄', v_res::text, (v_res->>'updated')::int, v_cnt,
    case when v_cnt = 0 and (v_res->>'updated')::int = 1 then 'OK' else '⚠ 확인' end);

  -- ═══ 칸 7: 알림 대상 아닌 칸(메모)만 바꾸면 notify=true 여도 안 나간다 ═══
  perform set_config('app.suppress_notifications', '', true);   -- 칸마다 표식 초기화
  perform set_config('app.actor_id', '', true);
  select coalesce(max(id), 0) into v_mark from public.notifications;
  v_res := public.update_calendar_event_series_tx(
    v_admin_tok, v_series, current_date + 7,
    jsonb_build_object('memo', '메모만 바꿈'), true);
  select count(*) into v_cnt from public.notifications where id > v_mark;
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
  perform set_config('app.suppress_notifications', '', true);   -- 칸마다 표식 초기화
  perform set_config('app.actor_id', '', true);
  select coalesce(max(id), 0) into v_mark from public.notifications;
  v_res := public.create_notice_tx(v_admin_tok, '매트릭스공지-조용히', '내용', 'normal', false);
  select count(*) into v_cnt from public.notifications where id > v_mark;
  insert into public._notify_matrix_result (칸, 결과, 알림건수, 판정)
  values ('9 관리자·공지·알림안보냄', v_res::text, v_cnt,
    case when v_cnt = 0 then 'OK (0건)' else '⚠ 알림이 나갔다' end);

  -- ═══ 칸 10: 공지 — 관리자 · notify=true (본인 제외 확인) ═══
  perform set_config('app.suppress_notifications', '', true);   -- 칸마다 표식 초기화
  perform set_config('app.actor_id', '', true);
  select coalesce(max(id), 0) into v_mark from public.notifications;
  v_res := public.create_notice_tx(v_admin_tok, '매트릭스공지-알림', '내용', 'normal', true);
  select count(*), count(distinct user_id), bool_or(user_id = v_admin)
    into v_cnt, v_ppl, v_self
    from public.notifications where id > v_mark and type = 'notice';
  insert into public._notify_matrix_result (칸, 결과, 알림건수, 받은사람, 본인포함, 판정)
  values ('10 관리자·공지·알림보냄', v_res::text, v_cnt, v_ppl, v_self,
    case when v_cnt > 0 and not v_self then 'OK (본인 제외)' else '⚠ 확인' end);


  -- ═══ 칸 11: **인도자 본인**이 단일 수정 · notify=true ═══
  --     ⚠ 예전엔 관리자로 했는데, 관리자는 그 일정의 인도자도 신청자도 아니라
  --       '본인 제외' 가 저절로 참이었다. 통과할 수밖에 없는 시험이었다.
  --       고치는 사람이 **수신자 후보에 있어야** 제외가 실제로 도는지 보인다.
  perform set_config('app.suppress_notifications', '', true);
  perform set_config('app.actor_id', '', true);
  select coalesce(max(id), 0) into v_mark from public.notifications;
  v_res := public.update_calendar_event_tx(v_lead_all_tok, v_e1, jsonb_build_object('place', '단일알림'), true);
  select count(*), count(distinct user_id), bool_or(user_id = v_lead_all)
    into v_cnt, v_ppl, v_self
    from public.notifications where id > v_mark and type = 'event_change';
  insert into public._notify_matrix_result (칸, 결과, 바뀐일정, 알림건수, 받은사람, 본인포함, 판정)
  values ('11 인도자 본인이 단일 수정·알림보냄', v_res::text, (v_res->>'updated')::int, v_cnt, v_ppl, v_self,
    -- ⚠ 알림이 0건이면 v_self 가 null 이라 '본인 미포함' 이 저절로 참이 된다.
    --    건수와 사람 수를 함께 봐야 시험이 헐거워지지 않는다.
    case when (v_res->>'updated')::int = 1 and v_cnt = 1 and v_ppl = 1
              and not coalesce(v_self, true)
         then 'OK (한 명에게 갔고, 고친 본인은 안 받는다)'
         when v_cnt = 0 then '⚠ 아무한테도 안 갔다'
         else '⚠ 고친 본인이 받았거나 사람 수가 다르다' end);

  -- ═══ 칸 12: 알림 필터 정책 — 네 사람이 각각 어떻게 되나 ═══
  --     활성·승인·알림ON 만 받아야 한다. 나머지 셋은 인앱도 푸시도 안 가야 한다.
  declare
    v_on integer; v_off integer; v_inactive integer; v_pending integer;
    v_got integer[];
  begin
    insert into public.app_users (login_id, name, pin, role, approval_status, is_active)
    values ('mtx-f-on', '필터켬', '1234', 'user', 'approved', true) returning id into v_on;
    insert into public.app_users (login_id, name, pin, role, approval_status, is_active)
    values ('mtx-f-off', '필터끔', '1234', 'user', 'approved', true) returning id into v_off;
    insert into public.app_users (login_id, name, pin, role, approval_status, is_active)
    values ('mtx-f-inact', '비활성', '1234', 'user', 'approved', false) returning id into v_inactive;
    insert into public.app_users (login_id, name, pin, role, approval_status, is_active)
    values ('mtx-f-pend', '미승인', '1234', 'user', 'pending', true) returning id into v_pending;

    insert into public.notification_preferences (user_id, push_event_change)
    values (v_off, false)
    on conflict (user_id) do update set push_event_change = false;

    v_got := public.filter_notification_recipients(
      array[v_on, v_off, v_inactive, v_pending], 'event_change');

    insert into public._notify_matrix_result (칸, 결과, 받은사람, 판정)
    values ('12 알림 필터 정책 (켬/끔/비활성/미승인)',
      '남은 사람: ' || coalesce(array_to_string(v_got, ','), '(없음)'),
      coalesce(cardinality(v_got), 0),
      case when v_got = array[v_on] then 'OK (알림 켠 사람만 남는다)'
           else '⚠ 켠 사람 하나만 남아야 한다' end);

    -- ═══ 칸 13: 끝에서 끝까지 — 넷을 신청자로 붙이고 실제로 고쳐본다 ═══
    --     칸 12 는 필터 **함수**만 봤다. 실제 알림 줄이 한 명한테만 생기는지는
    --     이렇게 붙여봐야 안다 (푸시 대상도 같은 목록을 쓴다).
    insert into public.event_participants (event_id, user_name, role) values
      (v_e2, '필터켬', '신청'), (v_e2, '필터끔', '신청'),
      (v_e2, '비활성', '신청'), (v_e2, '미승인', '신청');

    perform set_config('app.suppress_notifications', '', true);
    perform set_config('app.actor_id', '', true);
    select coalesce(max(id), 0) into v_mark from public.notifications;
    v_res := public.update_calendar_event_tx(v_admin_tok, v_e2, jsonb_build_object('place', '끝에서끝'), true);
    -- ⚠ '한 명이 받았다' 만 보면 엉뚱한 한 명이어도 통과한다.
    --    **알림 켠 사람이 정확히 1건, 나머지 셋은 0건**을 따로 센다.
    select count(*) filter (where n.user_id = v_on),
           count(*) filter (where n.user_id in (v_off, v_inactive, v_pending))
      into v_cnt, v_ppl
      from public.notifications n
     where n.id > v_mark and n.type = 'event_change'
       and n.user_id in (v_on, v_off, v_inactive, v_pending);
    insert into public._notify_matrix_result (칸, 결과, 알림건수, 받은사람, 판정)
    values ('13 알림 켠 사람만 받는다 (인앱 기준)', v_res::text, v_cnt, v_ppl,
      -- 판정 문구를 좁혔다. 여기서 보는 건 notifications 뿐이고,
      -- 푸시가 같은 배열을 받는다는 건 코드로만 보장된다 (같은 v_recipient_ids).
      case when v_cnt = 1 and v_ppl = 0 then 'OK (켠 사람 1건 · 나머지 0건)'
           when v_cnt = 0 then '⚠ 켠 사람이 못 받았다'
           else '⚠ 꺼둔·비활성·미승인이 받았다' end);

    delete from public.event_participants where user_name in ('필터켬', '필터끔', '비활성', '미승인');
    delete from public.notification_preferences where user_id in (v_on, v_off, v_inactive, v_pending);
    delete from public.notifications where user_id in (v_on, v_off, v_inactive, v_pending);
    delete from public.app_users where id in (v_on, v_off, v_inactive, v_pending);
  end;


  -- ═══ 칸 14: 댓글·채팅·배정도 알림 끈 사람을 거르나 ═══
  --     ⚠ 지금까지 '일정·공지만' 고쳤다가 두 번 놓쳤다.
  --       insert_notifications 가 거르는지를 **경로마다** 본다.
  --       (푸시는 dispatch 안에서 같은 함수를 부르므로 같은 목록이 된다)
  declare
    v_pon integer; v_poff integer; v_left integer[];
  begin
    insert into public.app_users (login_id, name, pin, role, approval_status, is_active)
    values ('mtx-p-on', '푸시켬', '1234', 'user', 'approved', true) returning id into v_pon;
    insert into public.app_users (login_id, name, pin, role, approval_status, is_active)
    values ('mtx-p-off', '푸시끔', '1234', 'user', 'approved', true) returning id into v_poff;

    insert into public.notification_preferences
      (user_id, push_comment, push_chat, push_mention, push_new_notice, push_event_change, push_daily_service)
    values (v_poff, false, false, false, false, false, false)
    on conflict (user_id) do update set
      push_comment = false, push_chat = false, push_mention = false,
      push_new_notice = false, push_event_change = false, push_daily_service = false;

    -- 종류마다 '켠 사람만 남는가'
    for v_left in
      select public.filter_notification_recipients(array[v_pon, v_poff], t)
            -- notifications_type_check 가 허용하는 **열한 가지 전부**.
      -- 배정 셋은 끄는 설정이 없어 둘 다 남아야 하므로 아래에서 따로 본다.
      from unnest(array['comment', 'chat', 'mention', 'notice', 'event_change',
                        'daily_service', 'service_started', 'service_ended']) as t
    loop
      if v_left is distinct from array[v_pon] then
        insert into public._notify_matrix_result (칸, 결과, 판정)
        values ('14 종류별 필터', '남은 사람: ' || coalesce(array_to_string(v_left, ','), '(없음)'),
                '⚠ 켠 사람만 남아야 한다');
      end if;
    end loop;

    if not exists (select 1 from public._notify_matrix_result where 칸 like '14 %') then
      insert into public._notify_matrix_result (칸, 결과, 판정)
      values ('14 종류별 필터 (여덟 종류)',
              '여덟 종류 모두 켠 사람만 남았다', 'OK');

      -- 배정 셋은 끄는 설정이 없다 — 둘 다 남아야 한다
      for v_left in
        select public.filter_notification_recipients(array[v_pon, v_poff], t)
        from unnest(array['assignment', 'assignment_informal', 'assignment_restaurant']) as t
      loop
        if coalesce(cardinality(v_left), 0) <> 2 then
          insert into public._notify_matrix_result (칸, 결과, 판정)
          values ('16 배정 알림은 못 끈다', '남은 사람 수: ' || coalesce(cardinality(v_left), 0),
                  '⚠ 둘 다 남아야 한다');
        end if;
      end loop;

      -- 모르는 종류는 아무한테도 안 간다 (fail-closed)
      v_left := public.filter_notification_recipients(array[v_pon, v_poff], '없는종류');
      insert into public._notify_matrix_result (칸, 결과, 받은사람, 판정)
      values ('17 모르는 알림 종류는 아무한테도 안 간다',
              '남은 사람 수: ' || coalesce(cardinality(v_left), 0),
              coalesce(cardinality(v_left), 0),
              case when coalesce(cardinality(v_left), 0) = 0 then 'OK (fail-closed)'
                   else '⚠ 모르는 종류가 새 나간다' end);

      if not exists (select 1 from public._notify_matrix_result where 칸 like '16 %') then
        insert into public._notify_matrix_result (칸, 결과, 판정)
        values ('16 배정 알림은 못 끈다 (셋 다)', '셋 다 둘 모두 남았다', 'OK');
      end if;
    end if;

    -- 실제 댓글 한 건으로 끝에서 끝까지.
    -- ⚠ 둘을 **그 일정 신청자로 붙여야** 댓글 알림 대상이 된다.
    --    이걸 빠뜨려 '켠사람 0건 / 끈사람 0건' 이 나왔고, '끈 사람 0건' 만 보던
    --    판정이 그걸 OK 로 통과시켰다 — 아무것도 증명하지 못하는 시험이었다.
    insert into public.event_participants (event_id, user_name, role) values
      (v_e3, '푸시켬', '신청'), (v_e3, '푸시끔', '신청');

    perform set_config('app.suppress_notifications', '', true);
    select coalesce(max(id), 0) into v_mark from public.notifications;
    insert into public.comments (target_type, target_id, author_id, author_name, content)
    values ('calendar_event', v_e3, v_admin, '매트릭스관리자', '매트릭스 댓글');
    select count(*) filter (where user_id = v_pon),
           count(*) filter (where user_id = v_poff)
      into v_cnt, v_ppl
      from public.notifications where id > v_mark;
    insert into public._notify_matrix_result (칸, 결과, 알림건수, 받은사람, 판정)
    values ('15 실제 댓글 — 푸시 끈 사람은 안 받는다',
            '켠사람 ' || v_cnt || '건 / 끈사람 ' || v_ppl || '건', v_cnt, v_ppl,
      -- 켠 사람이 **받았고** 끈 사람이 **못 받았어야** 한다. 둘 다 봐야 뜻이 있다
      case when v_cnt = 1 and v_ppl = 0 then 'OK (켠 사람 1건 · 끈 사람 0건)'
           when v_cnt = 0 then '⚠ 켠 사람도 못 받았다 — 시험이 헛돌고 있다'
           else '⚠ 끈 사람이 받았다' end);

    delete from public.event_participants where user_name in ('푸시켬', '푸시끔');
    delete from public.comments where content = '매트릭스 댓글';
    delete from public.notifications where user_id in (v_pon, v_poff);
    delete from public.notification_preferences where user_id in (v_pon, v_poff);
    delete from public.app_users where id in (v_pon, v_poff);
  end;

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
