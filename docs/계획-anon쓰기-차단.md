# anon 쓰기 차단 — 방법 두 가지 중 고르기

2026-08-27 밤. 실행 전에 방향을 검토받으려고 쓴다.

## 실측한 현재 상태 (운영, 읽기 전용으로 확인)

anon 키로 실제로 찔러 봤다 (조건이 아무것도 안 맞게 해서 실제 변경은 0건):

```
cards · buildings · units · visit_histories · app_users ·
calendar_events · notices · regular_visits · event_participants · card_boundaries
  → INSERT / UPDATE / DELETE 전부 열림
    (POST 400 = 값이 모자란 것뿐, 401/403 아님. DELETE·PATCH 는 204)
```

**앱 번들에 든 anon 키만 있으면 회중 데이터를 통째로 지울 수 있다.**
`app_users` 도 열려 있어 계정을 만들고 권한을 바꾸고 지울 수 있다.

앱 코드의 쓰기 호출: **표 30개 · 287곳.**

## 방법 A — 쓰기를 RPC 로만 (처음 계획)

표마다 grant 를 회수하고, 287곳을 `security definer` RPC 로 옮긴다.

- 얻는 것: **누가 무엇을 할 수 있는지**까지 정한다 (역할별 권한)
- 드는 것: 일주일쯤. 표 하나씩 옮기고 배포하고 확인
- 나누는 이유: 한꺼번에 막으면 287곳 중 어디가 깨졌는지 모른다.
  게다가 이 앱의 쓰기 실패는 조용한 경로가 많다(`console.warn` 만) —
  며칠 뒤에야 안 되는 걸 알게 된다

## 방법 B — RLS 가 세션 토큰을 검사 (지금 제안)

grant 는 두고, 표마다 정책을 건다:

```sql
create policy write_needs_session on public.units
for all to anon
using  (public.verify_session(nullif(current_setting('request.headers', true)::json->>'x-session-token','')::uuid) is not null)
with check (같은 조건);
```

클라이언트는 **한 곳만** 고친다 — `lib/supabase.ts` 의 `createClient` 에
custom fetch 를 물려 매 요청에 현재 세션 토큰을 헤더로 붙인다.
(토큰은 로그인할 때마다 바뀌므로 고정 헤더가 아니라 fetch 안에서 읽어야 한다)

- 얻는 것: **로그인한 사람만 쓴다.** 하루면 된다
- 못 얻는 것: 역할별 권한. 로그인한 일반 사용자가 `app_users` 를
  직접 고치는 건 여전히 가능하다
- 걸리는 것 하나: **로그인 전에 쓰는 경로가 있다.**
  `signup` 이 `app_users` 에 직접 insert 한다 (`useAuth.ts` 338줄).
  → 이건 RPC 로 옮겨야 한다. **287곳이 아니라 1곳이다.**

## 왜 B 를 먼저 하고 싶은가

지금 위협은 "**아는 사람 62명 중 누가 권한 밖의 일을 한다**" 가 아니라
"**아무나 데이터를 지운다**" 다. B 는 그 문을 하루에 닫는다.
A 는 더 낫지만 일주일 동안 문이 열려 있다.

B 를 하고 나서 A 를 **위험한 표부터** 천천히 해도 된다
(`app_users` 12곳, `card_boundaries` 16곳).

## 확인해야 할 것 (시작 전에)

1. **PostgREST 가 정책에서 요청 헤더를 읽게 해 주나?**
   `current_setting('request.headers', true)` 가 이 Supabase 버전에서 실제로 오는가.
   문서상 된다고 알고 있으나 **테스트 DB 에서 확인하고 시작**해야 한다.
   안 되면 B 는 성립하지 않는다.
2. Realtime 구독이 이 정책에 걸리나 (Realtime 은 RLS 를 본다).
   지금 영구 채널 셋이 돌고 있다.
3. `verify_session` 을 정책에서 부르면 **쓰기마다 한 번씩 조회**한다. 비용이 괜찮은가.
4. 로그인 전에 쓰는 경로가 `signup` 말고 또 있나. (grep 으로는 못 찾았다)
5. Edge Function(push) 과 pg_cron 은 service_role 이라 영향 없다고 보는데 맞나.

## 검토 결과 (2026-08-27, 코덱스 2회)

**위의 B 를 그대로 하면 아무것도 안 막힌다.** 세 가지가 틀렸다.

**① 기존 `open_access ... FOR ALL to anon using (true)` 가 살아 있다.**
RLS 정책은 permissive 끼리 **OR** 로 합쳐진다. 정책을 하나 더 얹으면
`true OR 세션검사` = 항상 참이다. **기존 FOR ALL 을 없애야** 한다.
(운영에 정책 42개. `open_access` 가 표마다 있다)

**② `FOR ALL` 을 쓰면 Realtime 이 깨진다.**
Postgres Changes 는 구독자의 **SELECT RLS** 를 본다. 그런데 custom fetch 헤더는
HTTP 요청에만 붙고 **WebSocket 은 x-session-token 을 안 보낸다.**
→ `FOR INSERT / UPDATE / DELETE` 로 나누고 **SELECT 정책은 건드리지 않는다.**
(지금 도는 영구 채널: useCalendarRealtime · useNotifications · useUserChats)

**③ `verify_session` 을 정책에서 부르면 안 된다.** 검사만 하는 함수가 아니다:
```
delete from auth_sessions …          비활성·미승인이면 세션을 지운다
update auth_sessions set last_used_at 성공할 때마다 쓴다
raise exception …                    실패하면 던진다
```
RLS 는 행마다 평가될 수 있어, 대량 UPDATE 에서 같은 세션 행을 반복 갱신하고
잠금 경합을 만든다. **부작용 없는 읽기 전용 helper 가 따로 필요하다.**
`private` 스키마 · SELECT 만 · 잘못된 UUID 는 예외 대신 NULL ·
`security definer` + 고정 search_path · 정책에서는 `(select …)` 로 감싸
statement 당 한 번만 평가되게 한다.

**A 도 과했다.** 287곳을 전부 RPC 로 옮길 필요는 없다.
요청자의 id·역할을 주는 helper 가 있으면 단순 CRUD 는 역할별 RLS 로 덮인다.
RPC 는 **여러 표를 한 트랜잭션으로 묶는 것**에만 쓴다.

## 순서 (expand / contract)

⚠ 한 번에 SQL 을 넣으면 **옛 PWA 를 쓰는 사람들 쓰기가 전부 실패한다.**
오늘 실제로 옛 클라이언트 때문에 다른 일정 배정이 보이는 일이 있었다.

```
1. 읽기 전용 helper + signup RPC 를 **추가만** 한다 (아직 아무것도 안 막는다)
2. 새 클라이언트 배포 — custom fetch 헤더 + signup RPC 사용
3. 검증: 실제 API·로그아웃·Realtime
4. 열린 FOR ALL 제거 + 쓰기 전용 정책으로 교체
5. app_users / app_settings 직접 쓰기 차단
```

4번을 앞당겨야 하면 옛 클라이언트의 쓰기가 fail-closed 되는 것을 감수하되,
**사용자에게 새로고침을 요청할 준비**를 하고 한다.

⚠ **헤더가 안 되면 '역할별 RLS 로 바로' 는 성립하지 않는다.**
역할별 RLS 도 요청자가 누구인지 알아야 한다. 헤더가 안 되면 선택지는
Supabase Auth/JWT 전환 · 민감 쓰기를 토큰 인자 RPC 로 · 다른 신뢰 컨텍스트뿐이다.

## 확인 목록

- 헤더 없음·변조·만료·비활성·미승인 **전부 거부**
- 로그아웃 직후 옛 토큰이 더는 전송되지 않음
- `open_access FOR ALL` 정책이 실제로 **0개**
- 일반 사용자가 `app_users.role` · `approval_status` 를 못 바꿈
- INSERT / UPDATE / DELETE **각각** 확인
- Realtime 이벤트가 계속 도착
- 대량 UPDATE 에서 helper 가 statement 당 **한 번만** 평가
- 옛 클라이언트가 실패할 때 **조용히 넘어가지 않고 오류를 보여줌**

시험은 두 층으로: `curl`/API smoke 로 `request.headers` 와 정책을 먼저 증명하고,
브라우저에서는 custom fetch · CORS · 로그아웃 · Realtime 만 본다.

## 임시를 영구로 만들지 않기

세션 관문 정책 이름을 `TEMP_session_gate_*` 로 통일한다.
**다른 회중 배포 조건 = "TEMP 정책 0개".** 검증 SQL 에서 개수를 실패 조건으로 둔다.

## 내일 첫 단계

**`request.headers` 가 실제로 오는지 증명하는 것 하나.**
그 전에는 운영 SQL 을 만들지 않는다.
