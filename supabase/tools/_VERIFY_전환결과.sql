-- 전환 SQL 이 적용된 **뒤에** 결과가 맞는지 본다. 읽기만 한다.
-- (전환 SQL 안의 검증 블록과 같은 내용 — SQL Editor 가 트랜잭션을 안 지켜서
--  그 블록만 실패했기 때문에 따로 돌린다)

-- ═══ 이미 적용된 결과를 검증한다 (읽기만) ═══
-- ⚠ 개수를 세지 않는다. **빠진 것을 이름으로 뱉게** 한다.
--   "28개 맞네" 는 엉뚱한 28개여도 통과한다 (오늘 시험에서 여러 번 데었다).
do $$
declare
  v_lost   text;
  v_open   text;
  v_gated  text;
  v_rls_off text;
begin
  -- (1) **표 × 명령 × 역할** anti-join.
  --     바꾸기 전에 되던 조합이 사라졌으면 그 화면이 조용히 죽는다.
  --     ⚠ 목록을 임시표에 찍어 두지 않는다. SQL Editor 가 문장 사이에
  --       임시표를 지키지 않는다 (여기서 데었다). baseline.sql 에서 뽑아 **박아 넣었다**
  --       — 141개 조합. baseline 이 바뀌면 이 목록도 다시 뽑아야 한다.
  --     `public` 은 anon·authenticated 를 포함하므로 덮는 것으로 친다.
  --     ⚠ 이건 '있나' 만 본다. 일부러 좁힌 것(app_users INSERT 를 관리자만 등)은
  --       정책이 남아 있으므로 통과한다 — 잡으려는 것은 **통째로 빠뜨린 것**이다.
  select string_agg(format('%s.%s(%s)', b.tablename, b.cmd, b.role), ', '
                    order by b.tablename, b.cmd, b.role)
    into v_lost
  from (values
    ('app_settings','DELETE','public'),
    ('app_settings','INSERT','public'),
    ('app_settings','SELECT','public'),
    ('app_settings','UPDATE','public'),
    ('app_users','DELETE','anon'),
    ('app_users','INSERT','anon'),
    ('app_users','SELECT','anon'),
    ('app_users','UPDATE','anon'),
    ('buildings','DELETE','anon'),
    ('buildings','INSERT','anon'),
    ('buildings','SELECT','anon'),
    ('buildings','UPDATE','anon'),
    ('calendar_events','DELETE','public'),
    ('calendar_events','INSERT','public'),
    ('calendar_events','SELECT','public'),
    ('calendar_events','UPDATE','public'),
    ('card_assignments','DELETE','anon'),
    ('card_assignments','INSERT','anon'),
    ('card_assignments','SELECT','anon'),
    ('card_assignments','UPDATE','anon'),
    ('card_boundaries','DELETE','anon'),
    ('card_boundaries','INSERT','anon'),
    ('card_boundaries','SELECT','anon'),
    ('card_boundaries','UPDATE','anon'),
    ('card_leader_assignments','DELETE','anon'),
    ('card_leader_assignments','INSERT','anon'),
    ('card_leader_assignments','SELECT','anon'),
    ('card_leader_assignments','UPDATE','anon'),
    ('cards','DELETE','anon'),
    ('cards','INSERT','anon'),
    ('cards','SELECT','anon'),
    ('cards','UPDATE','anon'),
    ('chat_message_signals','SELECT','anon'),
    ('chat_message_signals','SELECT','authenticated'),
    ('chat_read_status','SELECT','anon'),
    ('chat_read_status','SELECT','authenticated'),
    ('chat_room_mutes','DELETE','anon'),
    ('chat_room_mutes','DELETE','authenticated'),
    ('chat_room_mutes','INSERT','anon'),
    ('chat_room_mutes','INSERT','authenticated'),
    ('chat_room_mutes','SELECT','anon'),
    ('chat_room_mutes','SELECT','authenticated'),
    ('chat_room_mutes','UPDATE','anon'),
    ('chat_room_mutes','UPDATE','authenticated'),
    ('comments','DELETE','anon'),
    ('comments','DELETE','authenticated'),
    ('comments','INSERT','anon'),
    ('comments','INSERT','authenticated'),
    ('comments','SELECT','anon'),
    ('comments','SELECT','authenticated'),
    ('comments','UPDATE','anon'),
    ('comments','UPDATE','authenticated'),
    ('event_card_assignment_cards','DELETE','anon'),
    ('event_card_assignment_cards','INSERT','anon'),
    ('event_card_assignment_cards','SELECT','anon'),
    ('event_card_assignment_cards','UPDATE','anon'),
    ('event_card_assignments','DELETE','anon'),
    ('event_card_assignments','INSERT','anon'),
    ('event_card_assignments','SELECT','anon'),
    ('event_card_assignments','UPDATE','anon'),
    ('event_informal_assignments','DELETE','anon'),
    ('event_informal_assignments','INSERT','anon'),
    ('event_informal_assignments','SELECT','anon'),
    ('event_informal_assignments','UPDATE','anon'),
    ('event_participants','DELETE','public'),
    ('event_participants','INSERT','public'),
    ('event_participants','SELECT','public'),
    ('event_participants','UPDATE','public'),
    ('event_restaurant_assignments','DELETE','anon'),
    ('event_restaurant_assignments','INSERT','anon'),
    ('event_restaurant_assignments','SELECT','anon'),
    ('event_restaurant_assignments','UPDATE','anon'),
    ('informal_assets','DELETE','anon'),
    ('informal_assets','INSERT','anon'),
    ('informal_assets','SELECT','anon'),
    ('informal_assets','UPDATE','anon'),
    ('informal_groups','DELETE','anon'),
    ('informal_groups','DELETE','authenticated'),
    ('informal_groups','INSERT','anon'),
    ('informal_groups','INSERT','authenticated'),
    ('informal_groups','SELECT','anon'),
    ('informal_groups','SELECT','authenticated'),
    ('informal_groups','UPDATE','anon'),
    ('informal_groups','UPDATE','authenticated'),
    ('notices','DELETE','public'),
    ('notices','INSERT','public'),
    ('notices','SELECT','public'),
    ('notifications','SELECT','anon'),
    ('notifications','SELECT','authenticated'),
    ('phone_surveys','DELETE','anon'),
    ('phone_surveys','DELETE','authenticated'),
    ('phone_surveys','INSERT','anon'),
    ('phone_surveys','INSERT','authenticated'),
    ('phone_surveys','SELECT','anon'),
    ('phone_surveys','SELECT','authenticated'),
    ('phone_surveys','UPDATE','anon'),
    ('phone_surveys','UPDATE','authenticated'),
    ('regular_visits','DELETE','anon'),
    ('regular_visits','INSERT','anon'),
    ('regular_visits','SELECT','anon'),
    ('regular_visits','UPDATE','anon'),
    ('restaurant_requests','DELETE','public'),
    ('restaurant_requests','INSERT','public'),
    ('restaurant_requests','SELECT','public'),
    ('restaurant_requests','UPDATE','public'),
    ('return_visit_logs','DELETE','public'),
    ('return_visit_logs','INSERT','public'),
    ('return_visit_logs','SELECT','public'),
    ('return_visit_logs','UPDATE','public'),
    ('return_visits','DELETE','public'),
    ('return_visits','INSERT','public'),
    ('return_visits','SELECT','public'),
    ('return_visits','UPDATE','public'),
    ('review_tasks','DELETE','public'),
    ('review_tasks','INSERT','public'),
    ('review_tasks','SELECT','public'),
    ('review_tasks','UPDATE','public'),
    ('service_sessions','DELETE','anon'),
    ('service_sessions','INSERT','anon'),
    ('service_sessions','SELECT','anon'),
    ('service_sessions','UPDATE','anon'),
    ('service_suggestions','DELETE','public'),
    ('service_suggestions','INSERT','public'),
    ('service_suggestions','SELECT','public'),
    ('service_suggestions','UPDATE','public'),
    ('territory_regions','DELETE','anon'),
    ('territory_regions','DELETE','authenticated'),
    ('territory_regions','INSERT','anon'),
    ('territory_regions','INSERT','authenticated'),
    ('territory_regions','SELECT','anon'),
    ('territory_regions','SELECT','authenticated'),
    ('territory_regions','UPDATE','anon'),
    ('territory_regions','UPDATE','authenticated'),
    ('units','DELETE','anon'),
    ('units','INSERT','anon'),
    ('units','SELECT','anon'),
    ('units','UPDATE','anon'),
    ('visit_histories','DELETE','anon'),
    ('visit_histories','INSERT','anon'),
    ('visit_histories','SELECT','anon'),
    ('visit_histories','UPDATE','anon')
  ) as b(tablename, cmd, role)
  where not exists (
    select 1
    from pg_policies p
    cross join lateral unnest(
      case when p.cmd = 'ALL' then array['SELECT','INSERT','UPDATE','DELETE'] else array[p.cmd] end
    ) as c(cmd)
    cross join lateral unnest(p.roles) as r(role)
    where p.schemaname = 'public'
      and p.tablename = b.tablename
      and c.cmd = b.cmd
      and (r.role::text = b.role or r.role::text = 'public')
  );
  if v_lost is not null then
    raise exception E'전에 되던 것이 사라졌다 (표.명령(역할)): %\n  → 이 화면들이 조용히 죽는다', v_lost;
  end if;

  -- (2) TEMP가 아닌 쓰기 정책도 실제 서버 관문이 있어야 한다.
  --     정책 이름만 role_* 로 붙인 using(true)는 열린 정책과 같으므로 허용하지 않는다.
  select string_agg(format('%s.%s(%s)', tablename, policyname, cmd), ', ' order by tablename)
    into v_open
  from pg_policies
  where schemaname = 'public'
    and cmd in ('ALL', 'INSERT', 'UPDATE', 'DELETE')
    and policyname not like 'TEMP\_session\_gate\_%'
    and policyname <> 'app_private_settings_deny_all'
    -- 테스트 DB 에만 있는 실험용 표 (`npm run smoke:headers` 가 쓴다). 운영엔 없다.
    and tablename not like '\_probe%'
    and (coalesce(qual, '') || ' ' || coalesce(with_check, ''))
      !~ 'request_(session_user_id|is_admin)';
  if v_open is not null then
    raise exception '서버 권한 조건이 없는 비-TEMP 쓰기 정책: %', v_open;
  end if;

  -- (2-1) 정책이 하나도 없어도 RLS 자체가 꺼져 있고 grant가 있으면 완전히 열린다.
  --       special_periods와 login_logs를 이 검사 부재 때문에 놓쳤다.
  select string_agg(c.relname, ', ' order by c.relname)
    into v_rls_off
  from pg_class c
  join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public'
    and c.relkind = 'r'
    and not c.relrowsecurity
    and (
      has_table_privilege('anon', c.oid, 'insert')
      or has_table_privilege('anon', c.oid, 'update')
      or has_table_privilege('anon', c.oid, 'delete')
    );
  if v_rls_off is not null then
    raise exception 'RLS가 꺼진 채 anon 쓰기 grant가 있는 표: %', v_rls_off;
  end if;

  -- (3) ⚠ **SELECT 정책이 세션을 요구하면 Realtime 이 끊긴다.**
  --     WebSocket 에는 x-session-token 이 안 붙는다. 실수로 걸면 여기서 잡는다.
  select string_agg(format('%s.%s', tablename, policyname), ', ' order by tablename)
    into v_gated
  from pg_policies
  where schemaname = 'public'
    and cmd in ('SELECT', 'ALL')
    and coalesce(qual, '') like '%request_session%';
  if v_gated is not null then
    raise exception E'SELECT 정책이 세션을 요구한다: %\n  → WebSocket 은 헤더를 안 보내므로 Realtime 구독이 끊긴다', v_gated;
  end if;

  -- (4) 역할 상승 차단 트리거가 실제로 붙었나
  if not exists (select 1 from pg_trigger
                 where tgname = 'app_users_guard_privilege' and not tgisinternal) then
    raise exception 'app_users 역할 상승 차단 트리거가 없다';
  end if;

  raise notice '✅ 검증 통과 — 잃은 조합 0 · 열린 쓰기 0 · RLS-off 쓰기 0 · SELECT 에 세션관문 0 · 트리거 있음';
end $$;


notify pgrst, 'reload schema';
