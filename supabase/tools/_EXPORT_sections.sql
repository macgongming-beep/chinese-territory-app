-- 구간별 점검 (읽기 전용 — 아무것도 바꾸지 않는다)
--
-- _EXPORT_schema.sql 이 통째로 실패했을 때, 어느 구간이 범인인지 찾는 용도다.
--
-- 쓰는 법
--   1. 아래 구간 하나를 **마우스로 드래그해서 선택**한다
--      (Supabase SQL Editor 는 선택한 부분만 실행한다)
--   2. 실행 → 에러가 나면 그 구간이 범인이다. 번호를 알려줄 것
--
-- 각 구간은 5줄만 뽑아 본다. 결과 내용은 안 봐도 되고, 에러 여부만 보면 된다.


-- ══ 1. 확장 ──────────────────────────────────────────────
-- 확장
  select 1 as ord, e.extname::text as obj,
         format('create extension if not exists %I with schema %I;', e.extname, n.nspname) as ddl
  from pg_extension e
  join pg_namespace n on n.oid = e.extnamespace
  where e.extname <> 'plpgsql'
limit 5;


-- ══ 2. 시퀀스 ────────────────────────────────────────────
-- 시퀀스 (테이블 기본값이 참조하므로 먼저)
  select 2, s.sequencename::text,
         format('create sequence if not exists public.%I;', s.sequencename)
  from pg_sequences s where s.schemaname = 'public'
limit 5;


-- ══ 3. 테이블 ────────────────────────────────────────────
-- 테이블
  select 3, c.relname::text,
         format(E'create table if not exists public.%I (\n  %s\n);', c.relname, cols.def)
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
limit 5;


-- ══ 4. 제약 (PK·UNIQUE·CHECK·FK) ────
-- 제약: PK/UNIQUE/CHECK 먼저, FK 는 뒤 (참조 대상이 있어야 한다)
  select case when con.contype = 'f' then 5 else 4 end,
         c.relname || '.' || con.conname,
         format('alter table public.%I add constraint %I %s;',
                c.relname, con.conname, pg_get_constraintdef(con.oid))
  from pg_constraint con
  join pg_class c on c.oid = con.conrelid
  join pg_namespace n on n.oid = c.relnamespace and n.nspname = 'public'
  where con.contype in ('p','u','c','f')
limit 5;


-- ══ 5. 인덱스 ────────────────────────────────────────────
-- 인덱스 (제약이 만든 것은 뺀다)
  select 6, i.indexname::text, i.indexdef || ';'
  from pg_indexes i
  where i.schemaname = 'public'
    and not exists (
      select 1 from pg_constraint con
      join pg_class ic on ic.oid = con.conindid
      where ic.relname = i.indexname)
limit 5;


-- ══ 6. 뷰 ────────────────────────────────────────────────
-- 뷰
  select 7, v.viewname::text,
         format(E'create or replace view public.%I as\n%s', v.viewname, v.definition)
  from pg_views v where v.schemaname = 'public'
limit 5;


-- ══ 7. 함수 ──────────────────────────────────────────────
-- 함수 / 프로시저 (auth_login, verify_session 등)
  select 8, p.proname::text, pg_get_functiondef(p.oid) || ';'
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace and n.nspname = 'public'
  where p.prokind in ('f','p')
limit 5;


-- ══ 8. 트리거 ────────────────────────────────────────────
-- 트리거
  select 9, t.tgname::text, pg_get_triggerdef(t.oid) || ';'
  from pg_trigger t
  join pg_class c on c.oid = t.tgrelid
  join pg_namespace n on n.oid = c.relnamespace and n.nspname = 'public'
  where not t.tgisinternal
limit 5;


-- ══ 9. RLS 켜기 ──────────────────────────────────────
-- RLS 켜기
  select 10, c.relname::text,
         format('alter table public.%I enable row level security;', c.relname)
  from pg_class c
  join pg_namespace n on n.oid = c.relnamespace and n.nspname = 'public'
  where c.relkind = 'r' and c.relrowsecurity
limit 5;


-- ══ 10. 정책 ──────────────────────────────────────────────
-- 정책
  select 11, pol.tablename || '.' || pol.policyname,
         format('create policy %I on public.%I as %s for %s to %s%s%s;',
                pol.policyname, pol.tablename, pol.permissive, pol.cmd,
                array_to_string(pol.roles, ', '),
                coalesce(' using (' || pol.qual || ')', ''),
                coalesce(' with check (' || pol.with_check || ')', ''))
  from pg_policies pol where pol.schemaname = 'public'
limit 5;


-- ══ 11. 테이블 권한 ──────────────────────────────────────
-- 테이블 권한
  select 12, g.table_name || '.' || g.grantee || '.' || g.privilege_type,
         format('grant %s on public.%I to %I;', g.privilege_type, g.table_name, g.grantee)
  from information_schema.role_table_grants g
  where g.table_schema = 'public'
    and g.grantee in ('anon','authenticated','service_role')
limit 5;


-- ══ 12. 컬럼 권한 ────────────────────────────────────────
-- 컬럼 권한만 따로 준 것 (app_users.pin 차단이 이 방식이다)
  select 13, cp.table_name || '.' || cp.column_name || '.' || cp.grantee,
         format('grant %s (%I) on public.%I to %I;',
                cp.privilege_type, cp.column_name, cp.table_name, cp.grantee)
  from information_schema.column_privileges cp
  where cp.table_schema = 'public'
    and cp.grantee in ('anon','authenticated','service_role')
    and not exists (
      select 1 from information_schema.role_table_grants g
      where g.table_schema = 'public' and g.table_name = cp.table_name
        and g.grantee = cp.grantee and g.privilege_type = cp.privilege_type)
limit 5;


-- ══ 13. realtime publication ──────────
-- realtime publication (채팅·일정 즉시 반영이 여기 달려 있다)
  select 14, pt.pubname || '.' || pt.tablename,
         format('alter publication %I add table public.%I;', pt.pubname, pt.tablename)
  from pg_publication_tables pt where pt.schemaname = 'public'
limit 5;


-- ══ 14. replica identity ──────────────────
-- replica identity full (postgres_changes 필터링에 필요)
  select 15, c.relname::text,
         format('alter table public.%I replica identity full;', c.relname)
  from pg_class c
  join pg_namespace n on n.oid = c.relnamespace and n.nspname = 'public'
  where c.relkind = 'r' and c.relreplident = 'f'
limit 5;
