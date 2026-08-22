-- 전화 조사(플레이스 대조) 기반
-- Supabase SQL Editor 에서 실행 (실행 전 백업 권장: npm run backup)
--
-- 흐름:
--   ① 수집기가 네이버에서 업소를 긁어 CSV 생성 (상호명·전화번호·주소·업종·업체ID)
--   ② 필드맵이 그 CSV 를 대조 → 이미 등록됨 / 이미 조사함 / 신규 로 나눔
--   ③ 신규만 뽑아 전화 조사 (중국어: 있음/없음/미확인)
--   ④ 결과를 다시 올리면
--        있음   → 건물·세대 생성 + 중국어 표시 + 조사 대장 기록
--        없음·미확인 → 조사 대장에만 기록 (지도·통계는 건드리지 않는다)
--   ⑤ 다음 달 다시 수집하면 조사한 곳은 ②에서 자동으로 빠진다
--
-- 왜 대장을 앱에 두나: 조사 이력이 수집기(외부 스크립트)에만 있으면
-- 그 코드를 고치다 날아갈 수 있고, 여러 사람이 조사하면 합치기도 어렵다.

-- ─── 1. 세대에 네이버 업체ID ────────────────────────────────
-- 이름·주소로 맞추면 시내에서 오탐이 난다 ('본가' 같은 흔한 상호).
-- 업체ID 는 네이버가 주는 고유값이라 한 번 연결하면 계속 정확하다.
alter table public.units
  add column if not exists naver_place_id text;

create index if not exists units_naver_place_id_idx
  on public.units (naver_place_id) where naver_place_id is not null;

-- ─── 2. 조사 대장 ───────────────────────────────────────────
create table if not exists public.phone_surveys (
  id           serial primary key,
  place_id     text not null unique,   -- 네이버 업체ID — 대조의 열쇠
  name         text not null,          -- 조사 시점 상호명
  address      text,
  category     text,                   -- 업종 (음식점·공장 등)
  phone        text,
  result       text not null check (result in ('있음', '없음', '미확인')),
  checked_at   date,
  -- ⚠ 계정과 대조하지 않고 적힌 그대로 보관한다.
  --   이름으로 계정을 맞추다 통계가 두 사람으로 갈라진 적이 있다.
  checked_by   text,
  memo         text,
  -- '있음' 이라 세대를 만든 경우 연결 (세대가 지워지면 null 로 남는다)
  unit_id      integer references public.units(id) on delete set null,
  -- 올린 사람은 로그인 계정에서 자동으로 — 이건 정확하다
  uploaded_by  text,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create index if not exists phone_surveys_result_idx on public.phone_surveys (result);
create index if not exists phone_surveys_checked_at_idx on public.phone_surveys (checked_at desc);

alter table public.phone_surveys enable row level security;
drop policy if exists open_access on public.phone_surveys;
create policy open_access on public.phone_surveys
for all to anon, authenticated
using (true)
with check (true);

-- 다시 조사한 경우(전엔 없음 → 이번엔 있음) 같은 업체ID 행을 갱신한다
create or replace function public.touch_phone_survey()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists phone_surveys_touch on public.phone_surveys;
create trigger phone_surveys_touch
before update on public.phone_surveys
for each row execute function public.touch_phone_survey();

-- ─── 3. 확인 ────────────────────────────────────────────────
select '조사 대장' as 구분, count(*) as 개수 from public.phone_surveys
union all
select '업체ID 연결된 세대', count(*) from public.units where naver_place_id is not null;
-- 처음 실행하면 둘 다 0 이 정상
