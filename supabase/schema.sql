-- ============================================================
-- 중국어 구역 운영 앱 스키마
-- Supabase SQL Editor에서 이 파일 전체를 실행하세요
-- ============================================================

-- cards (구역 카드)
create table public.cards (
  id          serial primary key,
  name        text not null,
  area        text not null,
  region      text not null,
  type        text not null default '전체' check (type in ('전체')),
  status      text not null default '미배정' check (status in ('미배정', '진행중', '완료', '보류')),
  leader_name text,
  created_at  timestamptz default now()
);

-- card_assignments (인도자 → 일반 사용자 재배정)
create table public.card_assignments (
  id         serial primary key,
  card_id    integer references public.cards(id) on delete cascade not null,
  user_name  text not null,
  created_at timestamptz default now(),
  unique(card_id, user_name)
);

-- card_leader_assignments (카드 다수 인도자 배정)
create table public.card_leader_assignments (
  id         serial primary key,
  card_id    integer references public.cards(id) on delete cascade not null,
  user_name  text not null,
  created_at timestamptz default now(),
  unique(card_id, user_name)
);

-- buildings (건물)
create table public.buildings (
  id         serial primary key,
  card_id    integer references public.cards(id) on delete cascade not null,
  name       text not null,
  address    text not null,
  type       text not null check (type in ('주택', '상가')),
  lat        float8 not null,
  lng        float8 not null,
  warning    boolean default false,
  memo       text,
  created_at timestamptz default now()
);

-- units (호수)
create table public.units (
  id          serial primary key,
  building_id integer references public.buildings(id) on delete cascade not null,
  number      text not null,
  status      text not null default '미방문' check (status in ('미방문', '만남', '부재', '한국인', '거절', '확인필요')),
  is_chinese  boolean not null default false,
  memo        text,
  created_at  timestamptz default now()
);

-- regular_visits (정기방문)
create table public.regular_visits (
  id            serial primary key,
  unit_id       integer references public.units(id) on delete cascade not null unique,
  visitor_name  text not null,
  registered_at timestamptz default now()
);

-- visit_histories (방문 이력)
create table public.visit_histories (
  id           serial primary key,
  unit_id      integer references public.units(id) on delete cascade not null,
  visitor_name text not null,
  result       text not null check (result in ('만남', '부재', '한국인', '거절', '확인필요')),
  time_slot    text not null default '저녁' check (time_slot in ('오전', '오후', '저녁')),
  memo         text,
  visited_at   date not null default current_date,
  created_at   timestamptz default now()
);

-- calendar_events (봉사 일정)
create table public.calendar_events (
  id           serial primary key,
  event_date   date not null,
  time         text not null,
  title        text not null,
  type         text not null default '비공식' check (type in ('비공식', '상가', '주택', '정기방문', '혼합')),
  place        text not null default '',
  leader_name  text not null default '',
  card_name    text not null default '',
  has_meeting  boolean not null default false,
  allow_applications boolean not null default true,
  memo         text not null default '',
  created_at   timestamptz default now()
);

-- event_participants (일정 신청/입명)
create table public.event_participants (
  id         serial primary key,
  event_id   integer references public.calendar_events(id) on delete cascade not null,
  user_name  text not null,
  role       text not null default '신청' check (role in ('신청', '입명')),
  created_at timestamptz default now(),
  unique(event_id, user_name)
);

-- card_boundaries (카드별 구역 경계선)
create table public.card_boundaries (
  card_id    integer primary key references public.cards(id) on delete cascade,
  points     jsonb not null,
  updated_at timestamptz default now()
);

-- service_sessions (봉사 시작 세션)
create table public.service_sessions (
  id              serial primary key,
  user_name       text not null,
  role            text not null default 'user' check (role in ('user', 'leader', 'admin')),
  calendar_event_id integer references public.calendar_events(id) on delete set null,
  started_at      timestamptz not null default now(),
  ended_at        timestamptz,
  service_date    date not null default current_date,
  time_slot       text not null check (time_slot in ('오전', '오후', '저녁')),
  status          text not null default 'active' check (status in ('active', 'ended', 'expired')),
  primary_card_id integer references public.cards(id) on delete set null,
  assigned_card_id integer references public.cards(id) on delete set null,
  assignment_id   integer,
  source          text not null default 'manual' check (source in ('assigned', 'manual', 'manual_override')),
  memo            text not null default '',
  created_at      timestamptz default now(),
  unique(user_name, service_date, time_slot, primary_card_id)
);

alter table public.visit_histories
  add column service_session_id integer references public.service_sessions(id) on delete set null;

-- event_card_assignments (일정 신청자별 선택 카드 배정)
create table public.event_card_assignments (
  id               serial primary key,
  event_id         integer references public.calendar_events(id) on delete cascade not null,
  user_name        text not null,
  assigned_card_id integer references public.cards(id) on delete cascade not null,
  assigned_by      text not null default '',
  assigned_at      timestamptz default now(),
  memo             text not null default '',
  unique(event_id, user_name)
);

-- ============================================================
-- RLS (Row Level Security) - 현재는 전체 허용, 인증 추가 후 수정
-- ============================================================
alter table public.cards enable row level security;
alter table public.card_assignments enable row level security;
alter table public.card_leader_assignments enable row level security;
alter table public.buildings enable row level security;
alter table public.units enable row level security;
alter table public.regular_visits enable row level security;
alter table public.visit_histories enable row level security;
alter table public.calendar_events enable row level security;
alter table public.event_participants enable row level security;
alter table public.card_boundaries enable row level security;
alter table public.service_sessions enable row level security;
alter table public.event_card_assignments enable row level security;

create policy "open_access" on public.cards for all to anon using (true) with check (true);
create policy "open_access" on public.card_assignments for all to anon using (true) with check (true);
create policy "open_access" on public.card_leader_assignments for all to anon using (true) with check (true);
create policy "open_access" on public.buildings for all to anon using (true) with check (true);
create policy "open_access" on public.units for all to anon using (true) with check (true);
create policy "open_access" on public.regular_visits for all to anon using (true) with check (true);
create policy "open_access" on public.visit_histories for all to anon using (true) with check (true);
create policy "open_access" on public.calendar_events for all to anon using (true) with check (true);
create policy "open_access" on public.event_participants for all to anon using (true) with check (true);
create policy "open_access" on public.card_boundaries for all to anon using (true) with check (true);
create policy "open_access" on public.service_sessions for all to anon using (true) with check (true);
create policy "open_access" on public.event_card_assignments for all to anon using (true) with check (true);

-- ============================================================
-- 샘플 데이터
-- ============================================================

insert into public.cards (id, name, area, region, type, status, leader_name) values
(1, '처인구 고림동 1', '고림동', '처인구', '전체', '진행중', '이준호'),
(2, '처인구 고림동 2', '고림동', '처인구', '전체', '진행중', '이준호'),
(3, '처인구 역북동 1', '역북동', '처인구', '전체', '진행중', '박하은'),
(4, '영통구 매탄동 1', '매탄동', '영통구', '전체', '진행중', '박하은'),
(5, '화성시 병점동 1', '병점동', '화성시', '전체', '미배정', null),
(6, '처인구 고림동 3', '고림동', '처인구', '전체', '진행중', '강민재');
select setval('public.cards_id_seq', (select max(id) from public.cards));

insert into public.card_assignments (card_id, user_name) values
(1, '김민준'), (1, '박서연'), (1, '한지우'),
(2, '노유나'), (2, '문하린'),
(4, '최유진'),
(6, '백도윤');

insert into public.buildings (id, card_id, name, address, type, lat, lng, warning, memo) values
(101, 1, '고림 우성빌라 A동', '경기 용인시 처인구 고림동 102-8',  '주택', 37.2384, 127.2142, false, '저녁 시간대 반응 좋음'),
(102, 2, '고림 우성빌라 B동', '경기 용인시 처인구 고림동 102-10', '주택', 37.2390, 127.2160, false, '102동 1006호 정기방문 중'),
(103, 2, '고림 리치빌',       '경기 용인시 처인구 고림동 88-4',   '주택', 37.2369, 127.2184, false, null),
(104, 3, '역북 중심상가',     '경기 용인시 처인구 역북동 754',    '상가', 37.2338, 127.1888, false, '3-5시 상가 방문 추천'),
(105, 5, '병점 상가 1동',     '경기 화성시 병점동 844',           '상가', 37.2072, 127.0347, true,  '간판명 변경 가능성 있음'),
(106, 6, '고림로 상가주택',   '경기 용인시 처인구 고림동 91-2',   '상가', 37.2378, 127.2119, false, '상가와 주택이 섞인 혼합 카드 포인트');
select setval('public.buildings_id_seq', (select max(id) from public.buildings));

insert into public.units (id, building_id, number, status) values
(1001, 101, '201호',   '만남'),
(1002, 101, '302호',   '부재'),
(1003, 101, '401호',   '미방문'),
(1004, 101, '502호',   '한국인'),
(1005, 102, '806호',   '만남'),
(1006, 102, '1006호',  '만남'),
(1007, 102, '1102호',  '부재'),
(1008, 102, '1201호',  '미방문'),
(1009, 103, '101호',   '미방문'),
(1010, 103, '202호',   '확인필요'),
(1011, 103, '303호',   '미방문'),
(1012, 104, '203호',   '만남'),
(1013, 104, '311호',   '부재'),
(1014, 104, '1층 식당','만남'),
(1015, 105, '101호',   '미방문'),
(1016, 105, '204호',   '미방문'),
(1017, 105, '305호',   '미방문'),
(1018, 106, '201호',   '만남'),
(1019, 106, '301호',   '부재'),
(1020, 106, '1층 상가','미방문');
select setval('public.units_id_seq', (select max(id) from public.units));

insert into public.regular_visits (unit_id, visitor_name) values
(1006, '노유나'),
(1012, '최유진'),
(1014, '오지훈'),
(1018, '김민준');

insert into public.visit_histories (unit_id, visitor_name, result, time_slot, memo, visited_at) values
(1001, '김민준', '만남', '저녁', '중국어 대화 가능. 다음 방문 때 자료 준비.', '2026-04-10'),
(1002, '박서연', '부재', '오후', '평일 오후 부재. 저녁 시도 필요.',            '2026-04-12'),
(1006, '노유나', '만남', '저녁', '정기방문 중복 방문 주의.',                   '2026-04-17');

insert into public.calendar_events (id, event_date, time, title, type, place, leader_name, card_name, has_meeting, allow_applications, memo) values
(1, '2026-04-02', '14:00', '상가 봉사',       '상가',     '역북동 중심상가',    '이준호', '처인구 역북동 1',       true,  true, '상가 위주. 이전 방문 메모 확인 필요.'),
(2, '2026-04-03', '10:00', '전도 전 모임',    '비공식',   '고림동 카페 앞',     '박하은', '처인구 고림동 1',       false, true, '오전에는 비공식 위주로 운영.'),
(3, '2026-04-04', '17:00', '주택 리스트 봉사','주택',     '고림동 우성빌라 앞', '이준호', '처인구 고림동 2',       true,  true, '5-7시 주택 집중. 평일 오후 부재 세대는 추가 시간대 시도.'),
(4, '2026-04-06', '14:00', '정기방문 봉사',   '정기방문', '수원 매탄동',        '박하은', '영통구 매탄동 1',       false, true, '정기방문자 동행 필요.'),
(5, '2026-04-10', '16:00', '상가 확인',       '상가',     '화성 병점 상가',     '강민재', '화성시 병점동 1',       false, true, '간판명 변경 가능성 확인.'),
(6, '2026-04-17', '17:00', '주택 리스트 봉사','주택',     '고림동 우성빌라 앞', '이준호', '처인구 고림동 2',       true,  true, '102-1006 세대는 방문 전 메모 확인.'),
(7, '2026-04-18', '15:00', '혼합 봉사',       '혼합',     '역북동, 고림동',     '박하은', '처인구 역북동 1 외 1개', false, true, '신청자 수에 따라 카드 분리.');
select setval('public.calendar_events_id_seq', (select max(id) from public.calendar_events));

insert into public.event_participants (event_id, user_name, role) values
(1, '김민준', '입명'), (1, '박서연', '입명'), (1, '최유진', '신청'), (1, '한지우', '신청'),
(2, '오지훈', '입명'), (2, '정다은', '신청'), (2, '윤서진', '신청'),
(3, '김민준', '입명'), (3, '한지우', '입명'), (3, '노유나', '입명'), (3, '백도윤', '신청'), (3, '문하린', '신청'),
(4, '최유진', '입명'), (4, '문하린', '신청'),
(5, '오지훈', '입명'), (5, '백도윤', '입명'), (5, '송예린', '신청'),
(6, '김민준', '입명'), (6, '박서연', '입명'), (6, '한지우', '입명'), (6, '노유나', '신청'), (6, '문하린', '신청'), (6, '백도윤', '신청'),
(7, '정다은', '입명'), (7, '윤서진', '신청'), (7, '송예린', '신청');

insert into public.card_boundaries (card_id, points) values
(1, '[{"lat":37.2358,"lng":127.2120},{"lat":37.2404,"lng":127.2120},{"lat":37.2404,"lng":127.2184},{"lat":37.2358,"lng":127.2184}]'::jsonb),
(2, '[{"lat":37.2360,"lng":127.2150},{"lat":37.2402,"lng":127.2150},{"lat":37.2402,"lng":127.2200},{"lat":37.2360,"lng":127.2200}]'::jsonb),
(3, '[{"lat":37.2320,"lng":127.1868},{"lat":37.2354,"lng":127.1868},{"lat":37.2354,"lng":127.1908},{"lat":37.2320,"lng":127.1908}]'::jsonb);
