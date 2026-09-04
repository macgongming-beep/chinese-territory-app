-- 비공식 장소에 '종류' 를 준다.
--
-- 지금은 모든 비공식 장소가 같은 핀이라 "여기는 구역이고 저기는 대화하기 좋은
-- 자리" 를 구분할 수 없었다. 종류를 세 가지로 나눈다.
--
--   비공식구역   구역선(네모칸)·동선(중심거리)을 가진 자리        (지금까지의 기본값)
--   거점         모이는 곳 (역·백화점처럼 기준이 되는 지점)
--   대화장소     대화를 걸기 좋은 자리
--
-- ⚠ 값은 한국어로 둔다. 이 앱은 상태값을 한국어로 들고 있고(만남·거절·미방문),
--   화면 라벨과 값을 같은 말로 두면 번역할 때 헷갈리지 않는다
--   (라벨은 t()/msg() 로 번역하고 **판단은 이 값으로** 한다).
--
-- ⚠ 기본값을 '비공식구역' 으로 둔다. 지금 있는 자료 두 건은 실제로 구역이고,
--   기본값이 없으면 옛 앱이 kind 없이 INSERT 할 때 NOT NULL 로 막힌다.

alter table public.informal_assets
  add column if not exists kind text not null default '비공식구역';

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.informal_assets'::regclass
      and conname = 'informal_assets_kind_check'
  ) then
    alter table public.informal_assets
      add constraint informal_assets_kind_check
      check (kind in ('비공식구역', '거점', '대화장소'));
  end if;
end $$;

do $$
declare
  v_bad integer;
begin
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'informal_assets' and column_name = 'kind'
  ) then
    raise exception 'informal_assets.kind 가 없습니다';
  end if;

  select count(*) into v_bad
  from public.informal_assets
  where kind not in ('비공식구역', '거점', '대화장소');
  if v_bad > 0 then
    raise exception '허용되지 않는 kind 값이 %건 있습니다', v_bad;
  end if;

  -- 제약이 실제로 무는지 본다. 통과하면 CHECK 이 붙지 않은 것이다.
  -- ⚠ NOT NULL 인 칸을 전부 채워야 한다. 안 채우면 CHECK 이 아니라 NOT NULL 에
  --   먼저 걸려서, 이 시험이 무엇을 증명했는지 알 수 없게 된다 (실제로 겪었다).
  begin
    insert into public.informal_assets (name, image_url, image_path, uploaded_by, kind)
    values ('_제약시험', '', '_제약시험', '_제약시험', '_없는종류');
    raise exception 'kind CHECK 제약이 걸리지 않았습니다';
  exception
    when check_violation then
      null;  -- 기대한 동작
  end;
end $$;

notify pgrst, 'reload schema';
