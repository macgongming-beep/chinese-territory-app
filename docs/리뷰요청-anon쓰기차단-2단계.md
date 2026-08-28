# anon 쓰기 차단 — 리뷰 요청 (테스트 DB 적용 후)

## 새로 확정된 사실 (테스트 DB 실측)

**1. RLS 정책은 요청 역할 권한으로 함수를 부른다.** probe 3단계 전부 통과:
   - revoke 상태 → 거부됨
   - `grant execute` 뒤 → 됨. **schema USAGE 없이도 된다**
   - anon 이 helper 를 직접 부르는 것 → 여전히 막힘
   → 전환 SQL 의 `grant execute` 두 줄이 맞았다. 1단계 주석("grant 불필요")은 틀렸었다.

**2. ⚠ Supabase SQL Editor 는 `begin; … commit;` 을 한 트랜잭션으로 지키지 않는다.**
   전환 SQL 을 넣었더니 **마지막 검증 블록만 실패했는데 앞의 정책 112개는 남았다.**
   (FOR_ALL 28→1, 세션관문 86, SELECT재현 26, 트리거 1, helper grant 2)
   즉 **"한 트랜잭션이라 나뉘지 않는다" 는 전제가 성립하지 않는다.**

   검증이 실패한 이유도 같다 — `create temp table _before_grants ... on commit drop`
   이 다음 문장에서 안 보였다.

## 그래서 바꾼 것

원자성을 흉내내는 길(전체를 DO 블록 하나로 감싸기)은 **버렸다** —
소스 변환 생성기가 미묘해서 검증이 더 어려워졌다. 대신:

- **① 순서를 안전장치로.** `app_users` · `app_settings` · `notices` 를 **맨 앞으로**.
  뒤에 두면 중간에 멈춘 사이 로그인한 사람이 자기 role 을 admin 으로 올린다.
- **② 몇 번을 다시 돌려도 되게.** 모든 `drop` 을 `if exists`, 모든 `create policy`
  앞에 `drop policy if exists` (146개). 중간에 멈추면 고치고 처음부터 다시.
- **③ 검증은 따로.** `_VERIFY_전환결과.sql` 로 분리.
- **④ 임시표 제거.** 바꾸기 전 (표×명령×역할) **141개**를 baseline.sql 에서 뽑아
  검증 안에 VALUES 로 박아 넣었다. 문장 사이 상태가 0이 됐다.

## 현재 파일 상태

- create policy 112 (SELECT 재현 26 + 세션관문 86) · 중복 0
- 기존 열린 정책 제거 34 (baseline 과 이름 대조 완료, 테스트 DB 에서도 34/34 일치)
- SELECT 재현이 없는 세션관문 표: 없음
- `app_users`: INSERT 관리자만 · UPDATE 본인 또는 관리자 · 트리거로 role 칸 2중 차단
- 트리거는 `security definer` 아님 (invoker). 무세션 우회 없음.
  ⚠ 한계: `current_user='postgres'` 는 postgres 소유 definer 함수 안에서도 참.
    지금 그런 함수는 없다고 감사했고 CLAUDE.md 에 규칙으로 남겼다.

## 묻고 싶은 것

1. **①②③④ 로 원자성 부재를 충분히 덮었나?** 아니면 그래도 `psql` 같은
   진짜 단일 트랜잭션 경로를 만들어야 하나 (psql 미설치, CLI 링크는 운영이라 위험)?
2. **다시 돌릴 수 있게 만든 것의 부작용은?** `drop policy if exists` 를 앞에 붙였으니
   두 번째 실행 때 아주 짧은 순간 정책이 없는 구간이 생긴다. 그 사이 요청이 오면
   RLS 기본값(정책 없음 = 거부)이라 **읽기가 잠깐 실패**할 수 있다. 문제인가?
3. **순서를 앞으로 옮긴 게 다른 것을 깨뜨리나?** (`app_settings` 쓰기를 관리자만으로
   바꾸는 것이 뒤의 표들보다 먼저 일어난다)
4. 테스트 DB 는 **이미 적용된 상태**다. 같은 파일을 다시 돌려 ②를 증명하려 하는데,
   그것으로 재실행 안전성 증명이 충분한가?

## 다음 단계 (예정)

`_VERIFY_전환결과.sql` → 파일 재실행(②증명) → `npm run smoke:lockdown` → 운영.
