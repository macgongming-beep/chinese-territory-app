-- 운영 DB 의 anon 쓰기 권한 실측. **읽기만 한다.** 아무것도 바꾸지 않는다.

-- ① anon 이 쓸 수 있는 표
select table_name as 표,
       string_agg(privilege_type, ', ' order by privilege_type) as 권한
from information_schema.role_table_grants
where grantee = 'anon'
  and table_schema = 'public'
  and privilege_type in ('INSERT', 'UPDATE', 'DELETE')
group by table_name
order by table_name;
