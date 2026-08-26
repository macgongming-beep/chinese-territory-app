-- 옛 이름 일괄 정리. 이름을 바꾸기 전에 남은 기록을 현재 이름으로 옮긴다.
-- 짝은 한글끼리 / 한자끼리 정확히 같은 것만 골랐다 (하나로 안 정해지면 뺐다).
-- 이미 지운 사람(김무혁·김지혜)과 안 쓰는 이름(인도자·사용자1)은 잔재를 뗀다.
-- 위팅은 짝을 못 정해 손대지 않았다.
do $$
declare v_token uuid; v_r jsonb;
begin
  select s.token into v_token from public.auth_sessions s
    join public.app_users u on u.id = s.user_id
   where u.role in ('admin','developer')
     and (s.expires_at is null or s.expires_at > now())
   order by s.last_used_at desc nulls last limit 1;
  if v_token is null then raise exception '관리자 세션이 없습니다 — 앱에서 관리자로 다시 로그인하세요'; end if;
  v_r := public.rename_user_name_references(v_token, '장웅', '张雄장웅');
  raise notice '%', v_r;
  v_r := public.rename_user_name_references(v_token, '엄민석', '严珉硕엄민석');
  raise notice '%', v_r;
  v_r := public.rename_user_name_references(v_token, '홍동욱', '洪东旭홍동욱');
  raise notice '%', v_r;
  v_r := public.rename_user_name_references(v_token, '임성준任成俊', '任成俊임성준');
  raise notice '%', v_r;
  v_r := public.rename_user_name_references(v_token, '박지훈', '朴智训박지훈');
  raise notice '%', v_r;
  v_r := public.rename_user_name_references(v_token, '최윤민', '崔润珉최윤민');
  raise notice '%', v_r;
  v_r := public.rename_user_name_references(v_token, '정찬양', '郑赞扬정찬양');
  raise notice '%', v_r;
  v_r := public.rename_user_name_references(v_token, '박진호', '朴振镐박진호');
  raise notice '%', v_r;
  v_r := public.rename_user_name_references(v_token, '김시영', '金是英김시영');
  raise notice '%', v_r;
  v_r := public.rename_user_name_references(v_token, '이현우 (李諼友）', '李諼友이현우');
  raise notice '%', v_r;
  v_r := public.rename_user_name_references(v_token, '심창현沈昌炫', '沈昌炫심창현');
  raise notice '%', v_r;
  v_r := public.rename_user_name_references(v_token, '석대성', '昔大盛석대성');
  raise notice '%', v_r;
  v_r := public.rename_user_name_references(v_token, '罗义成', '罗义成나의성');
  raise notice '%', v_r;
  v_r := public.rename_user_name_references(v_token, '오세창', '吳世昶오세창');
  raise notice '%', v_r;
  v_r := public.rename_user_name_references(v_token, '김종년', '金宗年김종년');
  raise notice '%', v_r;
  v_r := public.rename_user_name_references(v_token, '朴智训', '朴智训박지훈');
  raise notice '%', v_r;
  v_r := public.rename_user_name_references(v_token, '신희숙', '申喜淑신희숙');
  raise notice '%', v_r;
  v_r := public.rename_user_name_references(v_token, '나의성', '罗义成나의성');
  raise notice '%', v_r;
  v_r := public.rename_user_name_references(v_token, '민경체', '闵庚谛민경체');
  raise notice '%', v_r;
  v_r := public.rename_user_name_references(v_token, '심창현', '沈昌炫심창현');
  raise notice '%', v_r;
  v_r := public.rename_user_name_references(v_token, '임성준', '任成俊임성준');
  raise notice '%', v_r;
  v_r := public.rename_user_name_references(v_token, '이현우', '李諼友이현우');
  raise notice '%', v_r;
  v_r := public.rename_user_name_references(v_token, '도완오', '都玩奡도완오');
  raise notice '%', v_r;
  v_r := public.rename_user_name_references(v_token, '吳世昶', '吳世昶오세창');
  raise notice '%', v_r;
  v_r := public.rename_user_name_references(v_token, '안윤미', '安伦美안윤미');
  raise notice '%', v_r;
  v_r := public.rename_user_name_references(v_token, '元珠熙', '元珠熙원주희');
  raise notice '%', v_r;
  v_r := public.rename_user_name_references(v_token, '조경애', '赵敬爱조경애');
  raise notice '%', v_r;
  v_r := public.rename_user_name_references(v_token, '이주연', '李珠娟이주연');
  raise notice '%', v_r;

  -- 이미 지운 사람 / 안 쓰는 이름 — 지난 기록은 남기고 앞으로의 것만 뗀다
  v_r := public.purge_user_name_references(v_token, '김무혁');   raise notice '%', v_r;
  v_r := public.purge_user_name_references(v_token, '김지혜');   raise notice '%', v_r;
  v_r := public.purge_user_name_references(v_token, '인도자');   raise notice '%', v_r;
  v_r := public.purge_user_name_references(v_token, '사용자1');  raise notice '%', v_r;
end $$;
