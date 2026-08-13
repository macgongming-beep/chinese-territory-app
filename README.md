# 필드맵 (Field Map)

한 회중(약 80명)의 중국인 봉사 구역을 관리하는 웹 앱. PC 와 모바일에서 함께 쓴다.

- **배포**: https://chinese-territory-app.vercel.app/
  ⚠️ 주소를 바꾸면 홈화면에 설치된 PWA·로그인 세션·푸시 구독이 전부 무효가 된다.
  앱 이름(필드맵)은 PWA manifest 에만 있으면 되고, 주소는 그대로 둔다.
- **스택**: React 19 + TypeScript + Vite / Supabase / 네이버 지도 API / Vercel

## 하는 일

| | |
|---|---|
| 구역·카드 | 지역·동별 구역 카드, 인도자 배정, 구역선 그리기 |
| 지도 | 건물·세대 표시, 방문 기록, 정기방문, 식당 봉사 |
| 일정 | 봉사 일정, 참가 신청, 팀·구역 배정과 공유 |
| 전화 조사 | 플레이스 수집 목록을 대조해 통화 목록을 뽑고 결과를 대장에 기록 |
| 그 밖에 | 공지, 채팅, 알림(웹 푸시), 통계, 사용자 관리 |

한국어·중국어·영어를 지원한다 (모바일 화면 기준).

## 개발

```bash
npm install
npm run dev        # 개발 서버
npm run build      # 빌드 검증 (tsc -b && vite build)
npm run lint       # ESLint — 0 을 유지한다
npm test           # vitest (순수 로직 단위 테스트)
npm run backup     # Supabase 전체 백업 → backups/YYYY-MM-DD/
```

환경변수는 `.env.local` 에 둔다 (커밋 금지):

```
VITE_SUPABASE_URL=
VITE_SUPABASE_ANON_KEY=
VITE_NAVER_MAP_CLIENT_ID=
SUPABASE_SERVICE_ROLE_KEY=   # 백업 스크립트 전용
```

`main` 에 push 하면 Vercel 이 자동으로 배포한다.

## 폴더

```
src/           앱 소스 (components / hooks / utils / locales)
supabase/      SQL 마이그레이션 — Supabase SQL Editor 에서 실행한다
scripts/       백업 등 운영 스크립트
docs/          설계·사용법 문서
archive/       한 번 쓰고 끝난 작업 스크립트 (참고용)
```

## 먼저 읽을 것

작업을 시작하기 전에 [CLAUDE.md](CLAUDE.md) 를 읽는다. 구조, 규칙, 최근 변경,
건드리면 안 되는 것이 정리돼 있다.
