-- 새로 세운 프로젝트가 운영과 같은지 센다 (읽기 전용).
-- 운영 기준값은 supabase/baseline.sql 을 만든 2026-08-24 시점이다.
select '테이블'    as 항목, count(*)::text as 이곳, '40' as 운영 from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relkind='r'
union all select '뷰',      count(*)::text, '1'  from pg_views where schemaname='public'
union all select '시퀀스',  count(*)::text, '29' from pg_sequences where schemaname='public'
union all select '함수',    count(*)::text, '59' from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.prokind in ('f','p')
union all select '트리거',  count(*)::text, '12' from pg_trigger t join pg_class c on c.oid=t.tgrelid join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and not t.tgisinternal
union all select '인덱스',  count(*)::text, '28' from pg_indexes i where i.schemaname='public' and not exists (select 1 from pg_constraint con join pg_class ic on ic.oid=con.conindid where ic.relname=i.indexname)
union all select '정책',    count(*)::text, '42' from pg_policies where schemaname='public'
union all select 'RLS 켠 테이블', count(*)::text, '38' from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relkind='r' and c.relrowsecurity
union all select 'realtime', count(*)::text, '12' from pg_publication_tables where schemaname='public'
union all select '예약작업', count(*)::text, '3'  from cron.job
union all select '스토리지 정책', count(*)::text, '5' from pg_policies where schemaname='storage'
union all select 'IDENTITY 컬럼', count(*)::text, '4' from pg_attribute where attidentity <> '' and attrelid in (select c.oid from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public')
order by 1;
