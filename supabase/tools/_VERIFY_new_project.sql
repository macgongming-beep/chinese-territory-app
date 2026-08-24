-- 새로 세운 프로젝트에 **필요한 종류와 수가 있는지** 센다 (읽기 전용).
--
-- ⚠ 이건 '구조가 같다' 를 증명하지 않는다. 개수만 본다.
--    컬럼 타입·기본값·제약 정의·함수 본문·정책 조건·권한(REVOKE 포함)은 안 본다.
--    실제로 개수가 맞는 채로 두 가지가 틀려 있었다 —
--    새 프로젝트가 RLS 를 더 켜 뒀고, app_users 테이블 권한이 더 열려 있었다.
-- 운영 기준값은 supabase/baseline.sql 을 만든 2026-08-24 시점이다.
select '테이블'    as 항목, count(*)::text as 이곳, '40' as 운영 from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relkind='r'
union all select '뷰',      count(*)::text, '1'  from pg_views where schemaname='public'
union all select '시퀀스',  count(*)::text, '33' from pg_sequences where schemaname='public'
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
