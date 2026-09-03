-- 댓글은 공개로 읽되, 쓰기는 작성자와 관리자에게만 허용한다.
--
-- 계약:
--   · INSERT: 세션 사용자 id와 현재 이름을 작성자로 써야 한다.
--   · UPDATE: 작성자는 내용을 고칠 수 있다. 관리자·개발자는 남의 댓글을
--             soft delete할 수 있지만 그 사람이 쓴 내용은 바꿀 수 없다.
--   · DELETE: 영구 삭제는 관리자·개발자만 가능하다. 작성자 삭제는 기존처럼
--             deleted_at을 바꾸는 soft delete다.
--   · target_type/target_id/author_id/author_name은 생성 뒤 누구도 바꾸지 못한다.
--             단, postgres 소유 definer로 도는 이름 변경 같은 서버 작업은 허용한다.
--   · 계정 삭제로 author_id가 null이 된 과거 댓글은 읽기는 유지하고 관리자만 고친다.

-- invoker trigger가 private 스키마를 직접 부를 수 없으므로, 요청자 자신의 id만
-- 돌려주는 좁은 창구를 둔다. 다른 사용자 정보는 노출하지 않는다.
create or replace function public.session_user_id()
returns integer
language sql
stable
security definer
set search_path = ''
as $$ select private.request_session_user_id() $$;
revoke all on function public.session_user_id() from public;
grant execute on function public.session_user_id() to anon, authenticated;

create or replace function public.guard_comment_identity_change()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  v_actor_id integer;
begin
  -- 이름 일괄 변경 등 postgres 소유 security definer 안에서 실행되는 서버 작업.
  if current_user in ('postgres', 'supabase_admin', 'service_role') then
    return new;
  end if;

  if new.target_type is distinct from old.target_type
     or new.target_id is distinct from old.target_id
     or new.author_id is distinct from old.author_id
     or new.author_name is distinct from old.author_name then
    raise exception '댓글의 대상과 작성자는 바꿀 수 없습니다';
  end if;

  v_actor_id := public.session_user_id();
  if v_actor_id is not null and old.author_id = v_actor_id then
    return new;
  end if;

  -- 관리자는 남의 말 자체를 고치지 않고 화면 계약대로 숨김/복원만 한다.
  if (select public.session_is_admin())
     and (to_jsonb(new) - 'deleted_at') is not distinct from
         (to_jsonb(old) - 'deleted_at') then
    return new;
  end if;

  raise exception '관리자는 다른 사람의 댓글 내용은 바꿀 수 없습니다';
end;
$$;

drop trigger if exists comments_guard_identity on public.comments;
create trigger comments_guard_identity
  before update on public.comments
  for each row execute function public.guard_comment_identity_change();

-- CommentSection은 처음부터 Realtime을 구독했지만 comments가 publication에 없어
-- 다른 사용자의 댓글 변경 이벤트를 받지 못했다. 정책 변경과 함께 실제 계약을 맞춘다.
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'comments'
  ) then
    alter publication supabase_realtime add table public.comments;
  end if;
end $$;

-- 공개 SELECT는 앱의 현재 읽기 범위와 헤더 없는 Realtime을 보존한다.
drop policy if exists comments_select_all on public.comments;
create policy comments_select_all on public.comments
  for select to anon, authenticated using (true);

drop policy if exists "TEMP_session_gate_comments_ins" on public.comments;
drop policy if exists role_owner_comments_insert on public.comments;
create policy role_owner_comments_insert on public.comments
  for insert to anon, authenticated
  with check (
    author_id = (select private.request_session_user_id())
    and author_name = (
      select u.name
      from public.app_users u
      where u.id = (select private.request_session_user_id())
    )
  );

drop policy if exists "TEMP_session_gate_comments_upd" on public.comments;
drop policy if exists role_owner_comments_update on public.comments;
create policy role_owner_comments_update on public.comments
  for update to anon, authenticated
  using (
    author_id = (select private.request_session_user_id())
    or (select private.request_is_admin())
  )
  with check (
    author_id = (select private.request_session_user_id())
    or (select private.request_is_admin())
  );

drop policy if exists "TEMP_session_gate_comments_del" on public.comments;
drop policy if exists role_admin_comments_delete on public.comments;
create policy role_admin_comments_delete on public.comments
  for delete to anon, authenticated
  using ((select private.request_is_admin()));

do $$
begin
  if (select count(*) from pg_policies
      where schemaname = 'public' and tablename = 'comments') <> 4 then
    raise exception 'comments 정책은 SELECT/INSERT/UPDATE/DELETE 네 개여야 합니다';
  end if;

  if exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'comments'
      and policyname like 'TEMP\_session\_gate\_%'
  ) then
    raise exception 'comments 임시 세션 정책이 남았습니다';
  end if;

  if not exists (
    select 1 from pg_trigger
    where tgrelid = 'public.comments'::regclass
      and tgname = 'comments_guard_identity'
      and not tgisinternal
  ) then
    raise exception 'comments 식별 칸 보호 트리거가 없습니다';
  end if;

  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'comments'
  ) then
    raise exception 'comments가 supabase_realtime publication에 없습니다';
  end if;
end $$;

notify pgrst, 'reload schema';
