# 인수인계 노트 — 2026-04-20

이전 세션(2026-04-18) 이후 변경 사항 정리.

---

## 이번 세션에서 완료된 작업

### 1. 핀 소실 버그 수정 (모바일 + PC 공통)

**증상**: 건물 추가 시 미리보기 핀이 사라짐.

**원인**: `previewPinLat`이 모달 상태(`showAddModal`)에 연동되어 있었음. 모달 닫히면 핀도 사라졌음.

**수정**:
- `previewPinLat={addLat}` — 모달 상태와 분리, lat 상태 직접 연결
- `closeAddModal()` 헬퍼 함수: 모달 + lat/lng 동시 초기화
- `addingGuard = useRef(false)`: 더블 파이어 방지
- MobileMap: `autoFocus` 제거 (iOS 키보드 뜨면서 viewport resize → zoom_changed → marker rebuild 시 null ref 유발)

---

### 2. Snap 기능 완전 제거

스냅(현재 위치 geocode)이 엉뚱한 좌표나 NaN을 반환하는 문제 있어서 제거.

---

### 3. 주소 입력 시 핀 자동 설정 (PC)

**흐름**:
1. 건물 추가 폼에서 주소 입력
2. `위치 확인` 버튼 → geocode → 핀 자동 설정 + 지도 panTo
3. 핀이 설정된 후 버튼이 `추가`로 변경
4. `추가` 클릭 → 건물 생성

**관련 코드**: `DesktopMap.tsx` — `handleConfirmAddBuilding`, `tryGeocode`

---

### 4. 긴 주소 Geocode 점진적 폴백

**증상**: "경기도 용인시 기흥구 구갈동 갈곡로8번길 8-1" — 네이버 geocode 실패.

**원인**: 행정 접두사 포함 전체 주소는 네이버 geocode에서 종종 실패.

**수정**: `tryGeocode` 재귀 함수 — 앞 토큰 하나씩 제거하며 재시도:
```tsx
const tryGeocode = (query: string) => {
  naver.maps.Service.geocode({ query }, (status, response) => {
    if (status === OK && response.v2?.addresses?.length > 0) {
      // 성공: 핀 설정
      return
    }
    const tokens = query.split(' ')
    if (tokens.length > 2) tryGeocode(tokens.slice(1).join(' '))
    else { setGeocoding(false); setGeocodeStatus('fail') }
  })
}
```

---

### 5. 핀 클릭 → 건물 목록 자동 스크롤 + 토글 (PC)

- 핀 클릭 → 건물 목록에서 해당 건물 행으로 자동 스크롤 (`bld-row-${id}`)
- 이미 선택된 핀 다시 클릭 → 접기 (토글)
- `onSelectBuilding` 콜백에서 처리

---

### 6. 건물 편집 시 유형(상가/주택) 변경 가능

- `editType` 상태 추가
- 편집 모드에서 select box로 변경 가능
- `onUpdateBuilding` prop에 `type?: Building['type']` 추가
- `useStore.updateBuilding`에서 `type` 파라미터 추가 처리

---

### 7. 대상 필터 (전체/상가/주택) 지도 마커 반영

**증상**: 필터 버튼 클릭해도 지도 마커가 변하지 않음.

**원인**: `contextBuildings` (지도에 전달되는 건물 목록)가 `targetTypeFilter`를 포함하지 않았음.

**수정**:
```tsx
const contextBuildings = useMemo(() =>
  buildings.filter((building) => {
    const card = cardMap.get(building.cardId)
    if (!card || !cardMatchesStructureFilters(card)) return false
    if (targetTypeFilter !== '전체' && building.type !== targetTypeFilter) return false
    return true
  }),
  [buildings, cardMap, regionFilter, areaFilter, targetTypeFilter]
)
```

---

### 8. 모바일 핀 클릭 무반응 수정

**원인**: `draggable: true` 마커는 모바일에서 tap → drag로 처리되어 click 이벤트 미발생.

**수정** (`MapCanvas.tsx`):
```tsx
const isMobileRef = useRef(isMobile)
isMobileRef.current = isMobile
// 마커 생성 시:
draggable: !isMobileRef.current
// dragend 리스너도 모바일 제외
if (!isMobileRef.current) {
  naver.maps.Event.addListener(marker, 'dragend', ...)
}
```

---

### 9. 모바일 핀 클릭 → 하단시트 + 상세 펼치기/접기

`MobileMap.tsx` — `onSelectBuilding` 콜백:
```tsx
onSelectBuilding={(id) => {
  if (selectedBuildingId === id) {
    setSelectedBuildingId(null)
    setExpandedBuildingIds(new Set())
    setSheetHeight(MIN_HEIGHT)
  } else {
    setSelectedBuildingId(id)
    setExpandedBuildingIds(new Set([id]))
    if (sheetHeight < HALF_HEIGHT) setSheetHeight(HALF_HEIGHT)
    setTimeout(() => {
      document.getElementById(`building-card-${id}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' })
    }, 150)
  }
}}
```

---

### 10. Vercel 배포

**배포 URL**: https://chinese-territory-app.vercel.app

**2026-04-20 23:43 KST 현재 상태**:
- `npm run build` 성공
- `vercel pull --yes --environment=production` 성공
- `vercel build --prod` 성공
- `vercel deploy --prebuilt --prod` 성공
- Production alias `https://chinese-territory-app.vercel.app` 상태: `Ready`
- 최신 배포 ID: `dpl_4iMrtYeD4WoRJspMu5qHYG4ob5LW`

**환경변수** (Vercel 대시보드 → Settings → Environment Variables):
```
VITE_SUPABASE_URL       = https://qdxemvdorasoryfysuoq.supabase.co
VITE_SUPABASE_ANON_KEY  = (로컬 .env.local 참고)
VITE_NAVER_MAP_CLIENT_ID = gbigtl5bfj
```

**자동 배포 주의점**:
- Git 루트는 `/Users/gm/Documents/New project`이고 앱 폴더는 `chinese-territory-app`이다.
- Vercel 프로젝트 설정의 Root Directory가 현재 `.`로 확인됐다.
- CLI로 앱 폴더에서 직접 배포하면 성공하지만, GitHub 자동 배포가 상위 Git 루트를 기준으로 실행되면 `package.json`을 못 찾아 실패할 수 있다.
- Vercel Dashboard → Project Settings → General → Root Directory를 `chinese-territory-app`으로 지정하는 것을 권장한다.

**네이버 지도 API 서비스 URL 등록** (네이버 클라우드 콘솔):
- `https://chinese-territory-app.vercel.app` (경로 없이 도메인만)

**SPA 라우팅 404 수정**: `vercel.json` 추가:
```json
{
  "rewrites": [{ "source": "/(.*)", "destination": "/index.html" }]
}
```

---

### 11. CSV 건물 업로드

구역 화면의 `CSV 업로드` 버튼을 실제 동작하도록 연결했다.

**변경 파일**
- `src/components/DesktopTerritory.tsx`
- `src/components/DesktopApp.tsx`
- `src/App.tsx`
- `src/hooks/useStore.ts`
- `src/App.css`

**동작**
- `구역 > CSV 업로드` 클릭 시 업로드 모달 표시
- CSV 파일 선택 후 즉시 파싱/검증
- 업로드 전 미리보기 표시
- 카드 매칭 실패, 주소 없음, 좌표 조회 실패 행은 제외 카운트로 표시
- 업로드 버튼을 누르면 Supabase `buildings`, `units`에 삽입
- 기존 건물 중 `cardId + address + name`이 같은 건물은 중복으로 보고 제외

**지원 헤더**

권장:
```csv
카드명,주소,건물명,유형,호수,위도,경도
처인구 고림동 1,경기 용인시 처인구 고림동 123,새 건물,주택,101호|102호,37.123,127.123
```

영문/혼합도 일부 지원:
- `cardId`, `card_id`, `카드ID`
- `card`, `cardName`, `카드`, `카드명`, `구역카드`
- `address`, `주소`
- `name`, `buildingName`, `건물명`, `건물`
- `type`, `유형`, `건물유형`
- `unit`, `units`, `호수`, `세대`, `호수목록`
- `lat`, `latitude`, `위도`
- `lng`, `lon`, `longitude`, `경도`

**좌표 처리**
- 위도/경도가 있으면 그 좌표를 그대로 사용
- 위도/경도가 없으면 브라우저의 Naver Maps `Service.geocode`로 주소를 좌표 변환
- 따라서 프로덕션/로컬 모두 Naver Maps Geocoding 권한이 켜져 있어야 주소만 있는 CSV가 정상 처리됨

**주의**
- 현재는 건물 단위 import이며, 카드 자체를 CSV로 자동 생성하지는 않는다.
- CSV에 적힌 카드명은 기존 카드명과 정확히 일치해야 한다.
- 대량 업로드 시 행마다 순차 geocode를 수행하므로 수백/수천 행은 시간이 걸릴 수 있다.

---

## 현재 알려진 이슈

- 2026-04-21 추가 메모: 사용자가 원래 의도한 것은 `지도 탭 오른쪽 건물 목록` 클릭 시 지도 중심을 해당 핀으로 이동하는 기능이었다. 그 전에 Codex가 `구역 > 건물 관리` 목록에서 건물명/지도 버튼을 누르면 `/map?cardId=...&buildingId=...`로 이동하는 기능을 먼저 구현했다. 이 기능은 유지해도 무방하지만, 사용자가 나중에 삭제할 가능성이 있다고 언급했다. 되돌릴 경우 확인할 파일은 `src/components/DesktopTerritory.tsx`, `src/components/DesktopApp.tsx`, `src/components/DesktopMap.tsx`, `src/components/MapCanvas.tsx`, `src/App.css`이며, 핵심 키워드는 `onOpenBuildingMap`, `focusedBuildingId`, `focusBuildingId`, `building-name-link`이다.
- 2026-04-21 추가 구현: `지도 탭 오른쪽 건물 목록`의 건물 행을 클릭하면 기존처럼 펼치기/접기를 하면서 동시에 해당 건물 좌표로 Naver 지도를 `morph(..., 17)` 이동하도록 `src/components/DesktopMap.tsx`에 `moveMapToBuilding`, `focusBuildingFromPanel`을 추가했다. 핀 클릭 시 자동 이동은 여전히 막아두고, 오른쪽 목록 클릭에서만 지도 중심 이동이 일어난다.
- GitHub 자동 배포 실패 가능성 — Vercel Root Directory가 `chinese-territory-app`으로 설정되어 있는지 확인 필요
- 인증 미구현 — 역할은 UI에서 수동 전환
- CSV 업로드는 현재 순차 처리라 대용량 파일에서는 느릴 수 있음

---

## 수정된 파일 목록

```
src/components/MobileMap.tsx      - 핀 소실 수정, 모바일 tap 수정, 하단시트 토글, 운영 필터 정리
src/components/DesktopMap.tsx     - 핀 소실 수정, 주소 geocode 2단계, 대상 필터 수정, 빌딩 유형 편집, 자동스크롤, 구역선 UI 정리
src/components/MapCanvas.tsx      - draggable 모드 분리, 지도 색상 토큰 연결
src/components/MobileTerritory.tsx - 모바일 구역 화면 카드/통계 UI 정리
src/components/MobileCalendar.tsx - 모바일 캘린더 UI 정리
src/App.css                       - 디자인 토큰 적용, spacing/radius/shadow 정리, 모바일/PC 지도·캘린더 스타일 정리
src/index.css                     - Pretendard/font/design token 추가
index.html                        - lang/title/font preload 정리
src/hooks/useStore.ts             - updateBuilding type 파라미터 추가, CSV 건물/세대 import 추가
src/components/DesktopTerritory.tsx - 구역 카드 생성/필터, CSV 업로드 모달 및 미리보기
src/components/DesktopApp.tsx     - CSV import prop 전달
src/App.tsx                       - CSV import store action 연결
vercel.json                       - SPA 라우팅 rewrite 규칙 (신규)
```

---

## 다음 작업 제안

1. **Vercel Root Directory 확인** — GitHub 자동 배포용으로 `chinese-territory-app` 지정
2. **모바일 지도 기능 검증** — 실제 디바이스에서 핀 클릭, 방문 기록, 정기방문 등록
3. **CSV import 실데이터 테스트** — 실제 구글시트 CSV로 카드명/주소/호수 매핑 확인
4. **사용자 인증 구현** — 현재 이름 직접 입력 방식 → 실제 로그인
5. **프로덕션 RLS** — 현재 dev용 전체 허용 정책 변경 필요
