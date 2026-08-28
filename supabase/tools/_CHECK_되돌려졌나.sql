select
  (select count(*) from pg_policies where schemaname='public' and cmd='ALL'
     and tablename not like '\_probe%')                                as FOR_ALL_28이어야,
  (select count(*) from pg_policies where schemaname='public'
     and policyname like 'TEMP\_%')                                    as TEMP_0이어야,
  (select count(*) from pg_policies where schemaname='public'
     and policyname like '%\_select\_all')                             as SELECT재현_0이어야,
  (select count(*) from pg_trigger
     where tgname='app_users_guard_privilege' and not tgisinternal)    as 트리거_0이어야;
