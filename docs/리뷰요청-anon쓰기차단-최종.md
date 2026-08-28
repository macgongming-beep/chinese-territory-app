# anon 쓰기 차단 — 최종 리뷰 요청 (테스트 DB 전부 통과)

앞선 판정에서 남은 관문 넷을 전부 통과했다. 운영 GO 판단을 부탁한다.

## 관문별 결과

### 1. helper 실패·성공 양쪽 probe ✅
한 DO 블록 안에서 세 가지를 보고, 예상 밖이면 **예외를 던진다** (NOTICE 만 찍으면
사람이 안 읽고 넘어간다). 전부 통과:
- revoke 상태 → 거부됨
- `grant execute` 뒤 → 됨. **schema USAGE 는 회수한 채로**
- anon 이 helper 를 직접 부르는 것 → 여전히 막힘

→ **정책 식은 요청 역할 권한으로 함수를 부른다**가 확정. grant 두 줄이 맞았다.

### 2. app_users 트리거의 무세션 우회 제거 ✅
조건을 뒤집었다: `v_actor is null → 통과` 대신 **권한 칸이 안 바뀌었으면 통과**.
`auth_login` 의 `last_login_at` 갱신 같은 것은 그냥 지나간다.
순서도 고쳤다 — **보호 트리거 → 정책 → open_access 제거**
(지적대로 트리거가 나중이면 그 사이가 권한 상승 창구였다).

⚠ **적용 중에 발견한 것**: 트리거는 invoker(anon)로 도는데 plpgsql 본문에서
`private.*` 를 부르려면 **스키마 USAGE 가 필요**하다 — RLS 정책 식과 다른 경로다
(`permission denied for schema private`). `grant usage on schema private to anon` 은
**fail-open** 이라(새 private 함수가 PUBLIC EXECUTE 를 갖고 태어난다) 하지 않고,
`public.session_is_admin()` definer 창구 하나만 냈다 (revoke 후 anon 에만 grant).

### 3. 표×명령×역할 anti-join ✅
개수를 세지 않는다. 바꾸기 전 **141개 조합**을 baseline.sql 에서 뽑아 SQL 안에
VALUES 로 박아 넣고(임시표는 SQL Editor 에서 문장 사이에 안 남는다), 사라진 조합을
이름으로 뱉는다. **SELECT 정책의 qual 에 `request_session` 이 있으면 던지는 검사**도
넣었다 — Realtime 이 거기서 조용히 끊긴다.

### 4. 테스트 DB 무헤더·가짜토큰·정상·Realtime smoke ✅ 22/22

핵심만:
- 헤더 없이 INSERT/UPDATE/DELETE 막힘 — **관리자 눈으로 다시 읽어** 안 바뀐 것 확인
  (RLS 는 조용히 0행을 주므로 HTTP 코드만 보면 안 된다)
- 일반 사용자가 role·approval_status·is_active 를 **못 바꾸고**(HTTP 400 = 트리거
  예외), 다시 읽어도 그대로. **자기를 admin 으로 한 줄 더 못 만든다**
- 그래도 자기 전화번호는 고칠 수 있다 (과잉 차단 아님)
- 관리자는 role 을 바꿀 수 있다
- 헤더 없이도 **읽기는 살아 있고**, Realtime INSERT 이벤트가 도착한다

## 단일 트랜잭션 경로 확보 ✅

`begin/commit` 을 파일에서 **뺐다** (`--single-transaction` 과 같이 있으면 파일의
commit 이 중간에 커밋해 원자성이 오히려 깨진다). `npm run apply:lockdown` 이
대상 ref 를 보여주고 `--confirm <ref>` 를 요구한다. 운영 ref 면 백업·새앱배포·smoke 를
먼저 묻는다. supabase CLI 의 `--linked` 는 **운영에 링크돼 있어** 쓰지 않는다.

- 1차 적용: 성공. 검증 블록까지 같은 트랜잭션 안에서 통과
- 2차 적용(같은 파일 재실행): 오류 0 → **재실행 안전성 증명**
  (지적대로 이것만으로는 최종 상태 수렴만 증명하므로, 되돌리기 SQL 로
   **처음 상태에서 다시** 단일 트랜잭션으로 적용해 증명했다)

## 변형 시험 (시험이 물기는 하나) ✅

`create policy _mutation_hole on public.cards for all to anon using(true)` 로
구멍을 뚫자 **①의 여섯 검사가 정확히 실패**했다 (INSERT 201, 행이 실제로 지워짐).
메우니 다시 22/22.

## 적용 중에 잡힌, 정책과 무관하게 거짓 통과하던 것 셋

1. `cards` fixture 무효 — name·area·region·type 이 전부 NOT NULL 이고 type 은
   '전체' 만 허용. 빠뜨리면 400 이 나고 "막혔다" 로 통과한다
2. `app_users` 는 **칸 단위 권한**(pin SELECT 금지)이라 전역
   `Prefer: return=representation` 이 42501 을 만든다 → `select=id` 로 좁혔다
3. Realtime 을 `cards` 로 시험 — **앱은 cards 를 구독하지 않는다**(publication 에 없다).
   `calendar_events` 로 바꾸고, 구독 상태와 INSERT 결과를 **따로 보고**하게 했다

## 남은 것 / 묻고 싶은 것

1. 운영 적용 전 조건을 이렇게 보는데 맞나:
   `npm run backup` → 사람들이 새 앱(헤더 보내는 버전)을 받았는지 확인 →
   운영에서 `_PREFLIGHT_전환SQL_정책이름_대조.sql` 0행 확인 → apply → `_VERIFY`
2. **옛 PWA 를 아직 쓰는 사람은 쓰기가 전부 실패한다.** 읽기는 된다.
   지금 앱은 실패를 토스트로 보여주는데, "앱을 껐다 켜세요" 같은 안내가 더 필요한가?
3. `TEMP_session_gate_*` 는 '로그인했나' 만 보는 거친 관문이다.
   역할별 권한으로 좁히는 것은 별도 작업으로 미뤄도 되나?
   (다른 회중 배포 조건 = TEMP 정책 0개 로 문서에 남겨 뒀다)
