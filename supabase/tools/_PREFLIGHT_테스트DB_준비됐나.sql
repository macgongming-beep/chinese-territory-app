-- 읽기만. 테스트 DB 가 전환 SQL 을 받을 준비가 됐나.
select
  (select count(*) from app_users)                                          as 사용자수_테스트면_한자리,
  (select count(*) from pg_proc p join pg_namespace n on n.oid=p.pronamespace
    where n.nspname='private'
      and p.proname in ('request_session_user_id','request_is_admin'))      as helper_2개여야,
  (select count(*) from pg_proc where proname='signup_tx')                  as signup_tx_1개여야,
  (select count(*) from app_users where login_id='test-admin')              as test_admin_1개여야,
  (select count(*) from pg_policies where schemaname='public' and cmd='ALL'
     and tablename not like '\_probe%')                                     as FOR_ALL_28개여야,
  (select count(*) from pg_policies where schemaname='public' and cmd='SELECT'
     and tablename not like '\_probe%')                                     as FOR_SELECT_7개여야;
