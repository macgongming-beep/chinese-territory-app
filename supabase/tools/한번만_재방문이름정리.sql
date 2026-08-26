-- 재방문(return_visits) 담당자·등록자 이름 표기 정리. 한 번만 실행한다.
-- 여긴 사람들이 손으로 타이핑해 '최유진 / 최유진자매 / 崔愉真' 처럼 갈라져 있었다.
--
-- 짝 고른 기준: 한글끼리(자매/형제 떼고) 또는 한자끼리 정확히 같고, 후보가 하나뿐인 것.
-- 손으로 정한 것 셋 — 金秀妍A·김수연A 는 'A' 가 붙어 있어 B 가 아니고,
--                    崔芝园 의 园 은 園 의 간체자다.
-- 손대지 않은 것: 김무혁, 김지혜 — 나간 사람이고 '누가 등록했다' 는 지난 기록이다.
--
-- ⚠ 20260826_2400 (알림 억제) 이 먼저 올라가 있어야 한다.

do $$
declare v_token uuid; v_r jsonb;
begin
  select s.token into v_token from public.auth_sessions s
    join public.app_users u on u.id = s.user_id
   where u.role in ('admin','developer')
     and (s.expires_at is null or s.expires_at > now())
   order by s.last_used_at desc nulls last limit 1;
  if v_token is null then raise exception '관리자 세션이 없습니다 — 앱에서 관리자로 다시 로그인하세요'; end if;

  v_r := public.rename_user_name_references(v_token, '金秀妍A', '金秀妍A김수연A');
  raise notice '%', v_r;
  v_r := public.rename_user_name_references(v_token, '崔愉真', '崔愉真최유진');
  raise notice '%', v_r;
  v_r := public.rename_user_name_references(v_token, '崔芝园', '崔芝園최지원');
  raise notice '%', v_r;
  v_r := public.rename_user_name_references(v_token, '최유진', '崔愉真최유진');
  raise notice '%', v_r;
  v_r := public.rename_user_name_references(v_token, '강영은', '姜英银강영은');
  raise notice '%', v_r;
  v_r := public.rename_user_name_references(v_token, '김수연A', '金秀妍A김수연A');
  raise notice '%', v_r;
  v_r := public.rename_user_name_references(v_token, '양소은杨笑恩', '杨笑恩양소은');
  raise notice '%', v_r;
  v_r := public.rename_user_name_references(v_token, '양소은', '杨笑恩양소은');
  raise notice '%', v_r;
  v_r := public.rename_user_name_references(v_token, '최지원', '崔芝園최지원');
  raise notice '%', v_r;
  v_r := public.rename_user_name_references(v_token, '도완오都玩奡', '都玩奡도완오');
  raise notice '%', v_r;
  v_r := public.rename_user_name_references(v_token, '강주성', '姜柱成강주성');
  raise notice '%', v_r;
  v_r := public.rename_user_name_references(v_token, '김정인', '金正引김정인');
  raise notice '%', v_r;
  v_r := public.rename_user_name_references(v_token, '최미란', '崔美兰최미란');
  raise notice '%', v_r;
  v_r := public.rename_user_name_references(v_token, '서은미', '徐银美서은미');
  raise notice '%', v_r;
  v_r := public.rename_user_name_references(v_token, '최유진자매', '崔愉真최유진');
  raise notice '%', v_r;
  v_r := public.rename_user_name_references(v_token, '표다혜', '表多惠표다혜');
  raise notice '%', v_r;
  v_r := public.rename_user_name_references(v_token, '申喜淑', '申喜淑신희숙');
  raise notice '%', v_r;
  v_r := public.rename_user_name_references(v_token, '全智延', '全智延전지연');
  raise notice '%', v_r;
  v_r := public.rename_user_name_references(v_token, '전지연', '全智延전지연');
  raise notice '%', v_r;
  v_r := public.rename_user_name_references(v_token, '전효원', '全孝元전효원');
  raise notice '%', v_r;
  v_r := public.rename_user_name_references(v_token, '전효원자매', '全孝元전효원');
  raise notice '%', v_r;
  v_r := public.rename_user_name_references(v_token, '최지원자매', '崔芝園최지원');
  raise notice '%', v_r;
  v_r := public.rename_user_name_references(v_token, '최윤민형제', '崔润珉최윤민');
  raise notice '%', v_r;
  v_r := public.rename_user_name_references(v_token, '심창현형제', '沈昌炫심창현');
  raise notice '%', v_r;
  v_r := public.rename_user_name_references(v_token, '赵敬爱', '赵敬爱조경애');
  raise notice '%', v_r;
  v_r := public.rename_user_name_references(v_token, '李珠娟', '李珠娟이주연');
  raise notice '%', v_r;
end $$;
