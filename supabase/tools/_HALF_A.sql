select count(*) as 통과한_줄수 from (
select 1 as ord, e.extname::text as obj,
         format('create extension if not exists %I with schema %I;', e.extname, n.nspname) as ddl
  from pg_extension e
  join pg_namespace n on n.oid = e.extnamespace
  where e.extname <> 'plpgsql'
  union all
select 2, s.sequencename::text,
         format('create sequence if not exists public.%I;', s.sequencename)
  from pg_sequences s where s.schemaname = 'public'
  union all
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
  union all
select case when con.contype = 'f' then 5 else 4 end,
         c.relname || '.' || con.conname,
         format('alter table public.%I add constraint %I %s;',
                c.relname, con.conname, pg_get_constraintdef(con.oid))
  from pg_constraint con
  join pg_class c on c.oid = con.conrelid
  join pg_namespace n on n.oid = c.relnamespace and n.nspname = 'public'
  where con.contype in ('p','u','c','f')
  union all
select 6, i.indexname::text, i.indexdef || ';'
  from pg_indexes i
  where i.schemaname = 'public'
    and not exists (
      select 1 from pg_constraint con
      join pg_class ic on ic.oid = con.conindid
      where ic.relname = i.indexname)
  union all
select 7, v.viewname::text,
         format(E'create or replace view public.%I as\n%s', v.viewname, v.definition)
  from pg_views v where v.schemaname = 'public'
  union all
select 8, p.proname::text, pg_get_functiondef(p.oid) || ';'
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace and n.nspname = 'public'
  where p.prokind in ('f','p')
) t;