-- 운영 스키마 추출 (읽기 전용 — 아무것도 바꾸지 않는다)
--
-- 왜: applied/ 의 마이그레이션 70개는 알파벳순이고 번호가 없어 순서대로 다시
--     돌릴 수 없다. schema.sql 은 12/39 테이블만 담아 낡았다. 그래서 빈 DB 에
--     이 앱을 다시 세울 방법이 지금은 없다 (테스트 DB 도, 새 회중도).
--
-- 쓰는 법:
--   1. Supabase Dashboard → SQL Editor 에 이 파일을 통째로 붙여넣고 실행
--   2. 결과가 한 칸으로 나온다 → 오른쪽 위 Download CSV
--   3. 받은 파일 위치를 알려주면 supabase/baseline.sql 로 만든다
with objs as (

  -- 확장
  select 1 as ord, e.extname::text as obj,
         format('create' || ' extension if not exists %I with schema %I;', e.extname, n.nspname) as ddl
  from pg_extension e
  join pg_namespace n on n.oid = e.extnamespace
  where e.extname <> 'plpgsql'

  union all  -- 시퀀스 (테이블 기본값이 참조하므로 먼저)
  select 2, s.sequencename::text,
         format('create' || ' sequence if not exists public.%I;', s.sequencename)
  from pg_sequences s where s.schemaname = 'public'

  union all  -- 테이블
  select 3, c.relname::text,
         format('create' || E' table if not exists public.%I (\n  %s\n);', c.relname, cols.def)
  from pg_class c
  join pg_namespace n on n.oid = c.relnamespace and n.nspname = 'public'
  cross join lateral (
    select string_agg(
             format('%I %s%s%s',
               a.attname,
               format_type(a.atttypid, a.atttypmod),
               case when ad.adbin is not null
                    then ' default ' || pg_get_expr(ad.adbin, ad.adrelid) else '' end,
               case when a.attnotnull then ' not null' else '' end),
             E',\n  ' order by a.attnum) as def
    from pg_attribute a
    left join pg_attrdef ad on ad.adrelid = a.attrelid and ad.adnum = a.attnum
    where a.attrelid = c.oid and a.attnum > 0 and not a.attisdropped
  ) cols
  where c.relkind = 'r'

  union all  -- 제약: PK/UNIQUE/CHECK 먼저, FK 는 뒤 (참조 대상이 있어야 한다)
  select case when con.contype = 'f' then 5 else 4 end,
         c.relname || '.' || con.conname,
         format('alter' || ' table public.%I add constraint %I %s;',
                c.relname, con.conname, pg_get_constraintdef(con.oid))
  from pg_constraint con
  join pg_class c on c.oid = con.conrelid
  join pg_namespace n on n.oid = c.relnamespace and n.nspname = 'public'
  where con.contype in ('p','u','c','f')

  union all  -- 인덱스 (제약이 만든 것은 뺀다)
  select 6, i.indexname::text, i.indexdef || ';'
  from pg_indexes i
  where i.schemaname = 'public'
    and not exists (
      select 1 from pg_constraint con
      join pg_class ic on ic.oid = con.conindid
      where ic.relname = i.indexname)

  union all  -- 뷰
  select 7, v.viewname::text,
         format('create' || E' or replace view public.%I as\n%s', v.viewname, v.definition)
  from pg_views v where v.schemaname = 'public'

  union all  -- 함수 / 프로시저 (auth_login, verify_session 등)
  select 8, p.proname::text, pg_get_functiondef(p.oid) || ';'
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace and n.nspname = 'public'
  where p.prokind in ('f','p')

  union all  -- 트리거
  select 9, t.tgname::text, pg_get_triggerdef(t.oid) || ';'
  from pg_trigger t
  join pg_class c on c.oid = t.tgrelid
  join pg_namespace n on n.oid = c.relnamespace and n.nspname = 'public'
  where not t.tgisinternal

  union all  -- RLS 켜기
  select 10, c.relname::text,
         format('alter' || ' table public.%I enable row level security;', c.relname)
  from pg_class c
  join pg_namespace n on n.oid = c.relnamespace and n.nspname = 'public'
  where c.relkind = 'r' and c.relrowsecurity

  union all  -- 정책
  select 11, pol.tablename || '.' || pol.policyname,
         format('create' || ' policy %I on public.%I as %s for %s to %s%s%s;',
                pol.policyname, pol.tablename, pol.permissive, pol.cmd,
                array_to_string(pol.roles, ', '),
                coalesce(' using (' || pol.qual || ')', ''),
                coalesce(' with check (' || pol.with_check || ')', ''))
  from pg_policies pol where pol.schemaname = 'public'

  union all  -- 테이블 권한
  select 12, g.table_name || '.' || g.grantee || '.' || g.privilege_type,
         format('grant' || ' %s on public.%I to %I;', g.privilege_type, g.table_name, g.grantee)
  from information_schema.role_table_grants g
  where g.table_schema = 'public'
    and g.grantee in ('anon','authenticated','service_role')

  union all  -- 컬럼 권한만 따로 준 것 (app_users.pin 차단이 이 방식이다)
  select 13, cp.table_name || '.' || cp.column_name || '.' || cp.grantee,
         format('grant' || ' %s (%I) on public.%I to %I;',
                cp.privilege_type, cp.column_name, cp.table_name, cp.grantee)
  from information_schema.column_privileges cp
  where cp.table_schema = 'public'
    and cp.grantee in ('anon','authenticated','service_role')
    and not exists (
      select 1 from information_schema.role_table_grants g
      where g.table_schema = 'public' and g.table_name = cp.table_name
        and g.grantee = cp.grantee and g.privilege_type = cp.privilege_type)

  union all  -- realtime publication (채팅·일정 즉시 반영이 여기 달려 있다)
  select 14, pt.pubname || '.' || pt.tablename,
         format('alter' || ' publication %I add table public.%I;', pt.pubname, pt.tablename)
  from pg_publication_tables pt where pt.schemaname = 'public'

  union all  -- replica identity full (postgres_changes 필터링에 필요)
  select 15, c.relname::text,
         format('alter' || ' table public.%I replica identity full;', c.relname)
  from pg_class c
  join pg_namespace n on n.oid = c.relnamespace and n.nspname = 'public'
  where c.relkind = 'r' and c.relreplident = 'f'
)
-- query_version 은 '이 결과가 어느 파일에서 나왔는지' 를 알려 준다.
-- 지난번 실패가 옛 탭 실행 때문인지 구분하려고 넣었다.
select 'v3-2026-08-24' as query_version,
       string_agg(ddl, E'\n\n' order by ord, obj) as ddl
from objs;
