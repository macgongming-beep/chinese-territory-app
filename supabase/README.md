# supabase/

DB 변경은 전부 SQL 파일로 남긴다. 사용자가 Supabase SQL Editor 에서 직접 실행한다
(앱이 자동으로 돌리지 않는다).

```
schema.sql      초기 스키마 — 처음부터 다시 세울 때의 출발점
*.sql           아직 적용하지 않았거나, 방금 적용한 것 ← 여기만 보면 된다
applied/        적용이 끝난 마이그레이션 (기록용, 다시 돌리지 않는다)
tools/          읽기 전용 점검·진단 — 언제든 다시 돌려도 안전하다
functions/      Edge Functions (푸시 발송 등)
```

## 새 SQL 을 만들 때

1. `supabase/` 바로 아래에 만든다. 파일 이름에 무엇을 하는지 적는다
   (`v3_phone_survey_restaurant.sql` 처럼).
2. 맨 위에 **왜 필요한지** 주석으로 남긴다. 몇 달 뒤에 읽을 사람을 위한 것이다.
3. 맨 아래에 결과를 눈으로 확인할 `select` 를 붙인다.
4. 사용자에게 실행을 부탁한다. 실행이 끝나면 `applied/` 로 옮긴다.

`applied/` 로 옮기는 걸 미루면 루트가 다시 60개가 된다. 실행 확인을 받은
그 자리에서 옮기는 게 좋다.

## 규칙

- **이미 적용된 파일을 고치지 말 것.** 남은 건 기록이다. 바꿔야 하면 새 파일을 만든다.
- 여러 번 돌려도 안전하게 쓴다 — `if not exists`, `create or replace`,
  `drop policy if exists` 다음에 `create policy`.
- 데이터를 지우거나 옮기는 SQL 은 실행 전에 백업을 안내한다 (`npm run backup`).

## 지금 적용됐는지 확인하려면

```
tools/_VERIFY_production.sql
```

Supabase SQL Editor 에 통째로 붙여 넣으면 항목별로 `OK` / `❌ MISSING` 이 나온다.
