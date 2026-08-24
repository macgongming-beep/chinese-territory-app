select count(*) as 통과한_줄수 from (
select 9, t.tgname::text, pg_get_triggerdef(t.oid) || ';'
  from pg_trigger t
  join pg_class c on c.oid = t.tgrelid
  join pg_namespace n on n.oid = c.relnamespace and n.nspname = 'public'
  where not t.tgisinternal
  union all
select 10, c.relname::text,
         format('alter table public.%I enable row level security;', c.relname)
  from pg_class c
  join pg_namespace n on n.oid = c.relnamespace and n.nspname = 'public'
  where c.relkind = 'r' and c.relrowsecurity
  union all
select 11, pol.tablename || '.' || pol.policyname,
         format('create policy %I on public.%I as %s for %s to %s%s%s;',
                pol.policyname, pol.tablename, pol.permissive, pol.cmd,
                array_to_string(pol.roles, ', '),
                coalesce(' using (' || pol.qual || ')', ''),
                coalesce(' with check (' || pol.with_check || ')', ''))
  from pg_policies pol where pol.schemaname = 'public'
  union all
select 12, g.table_name || '.' || g.grantee || '.' || g.privilege_type,
         format('grant %s on public.%I to %I;', g.privilege_type, g.table_name, g.grantee)
  from information_schema.role_table_grants g
  where g.table_schema = 'public'
    and g.grantee in ('anon','authenticated','service_role')
  union all
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
  union all
select 14, pt.pubname || '.' || pt.tablename,
         format('alter publication %I add table public.%I;', pt.pubname, pt.tablename)
  from pg_publication_tables pt where pt.schemaname = 'public'
  union all
select 15, c.relname::text,
         format('alter table public.%I replica identity full;', c.relname)
  from pg_class c
  join pg_namespace n on n.oid = c.relnamespace and n.nspname = 'public'
  where c.relkind = 'r' and c.relreplident = 'f'
) t;