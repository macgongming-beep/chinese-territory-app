# Detailed Handoff - Chinese Territory App

Last updated: 2026-04-18

Project path:

```text
/Users/gm/Documents/New project/chinese-territory-app
```

Local dev:

```bash
npm run dev
```

Common local URLs:

```text
http://127.0.0.1:5173/
http://localhost:5174/
```

Vite may choose another port if one is busy.

Build verification:

```bash
npm run build
```

Latest status:

```text
npm run build passes.
```

## One-Line Project Goal

Build a mobile-first, PC-admin-capable Chinese-language territory operation web app for managing territory cards, buildings, units, visit history, schedules, assignments, regular visits, and progress statistics.

The user wants implementation first. Avoid large refactors unless they directly unblock the MVP.

## Current Stack

- React 19
- TypeScript
- Vite
- Supabase
- Naver Maps API
- CSS in `src/App.css`
- Main state/persistence layer in `src/hooks/useStore.ts`

Important files:

```text
src/App.tsx
src/App.css
src/types.ts
src/hooks/useStore.ts
src/lib/supabase.ts
src/lib/toast.ts
src/components/DesktopApp.tsx
src/components/DesktopMap.tsx
src/components/DesktopTerritory.tsx
src/components/DesktopCalendar.tsx
src/components/DesktopLeaderAssignment.tsx
src/components/DesktopHome.tsx
src/components/DesktopNotices.tsx
src/components/DesktopUsers.tsx
src/components/DesktopSettings.tsx
src/components/MobileHome.tsx
src/components/MobileMap.tsx
src/components/MobileCalendar.tsx
src/components/MobileTerritory.tsx
src/components/MobileNotices.tsx
src/components/MapCanvas.tsx
src/components/Toast.tsx
src/data/territoryStructure.ts
src/data/territoryBoundary.ts
src/utils/mapUtils.ts
src/utils/visitStrategy.ts
supabase/schema.sql
supabase/migrate_card_structure.sql
AGENT_HANDOFF.md
CLAUDE_NOTES.md
```

## Collaboration Rules

Codex and Claude are not live-synced. They share the same project files only.

Before editing:

1. Run `git status --short`.
2. Inspect relevant files.
3. Do not overwrite changes from another agent.
4. Keep implementation moving.
5. Update a handoff note after major workflow/data-shape changes.

The worktree is dirty and contains many Claude/Codex changes. Do not use destructive commands or reset files.

## Product Domain

### Roles

There are three user roles:

```text
관리자 -> 인도자 -> 일반 사용자
```

관리자:

- Creates/manages territory cards.
- Assigns cards to leaders.
- Manages users and approvals.
- Mostly PC-oriented.

인도자:

- Receives cards from admin.
- Reassigns some of those cards to regular users.
- Handles schedule participation and assignment.
- Uses PC and mobile.

일반 사용자:

- Applies for schedules.
- Checks where to go today.
- Visits assigned cards.
- Records visit results on mobile.

Auth and backend role enforcement are not production-ready yet.

### Territory Card Model

Cards are spatial units, not visit-type units.

Correct card naming:

```text
처인구 고림동 1
처인구 고림동 2
기흥구 신갈동 1
수지구 고기동 1
화성시 병점동 1
```

Hierarchy:

```text
대권역 -> 동 -> 카드 번호
```

Current 대권역:

```text
처인구
기흥구
수지구
영통구
화성시
```

Important rule:

- `상가`, `주택`, `전체` are not separate card boundary types.
- A card boundary is `고림동 1`, `고림동 2`, etc.
- `상가/주택/전체` are visit target filters inside a spatial card.
- Card rows may still store `type='전체'` for backward compatibility.

Card size:

- Target around 4-5 building pins per card.
- Should be small enough for one service session.
- Commercial/residential can be filtered separately, but the boundary remains spatial.

### Regular Visit Meaning

`정기방문` means a user met a favorable Chinese person/unit and registered that point as their own regular visit.

It is point/unit-level ownership so other users do not duplicate visits.

Do not confuse:

```text
정기방문 != 재시도 필요
정기방문 != 카드 유형
```

Regular visit visibility:

- Unit row/card should stand out.
- Building accordion can show `정기 N`.
- Map marker may show `정` badge when any unit in that building is regular.

## Current App Structure

### Routing Issue Fixed

Previously `/map` rendered both PC `DesktopMap` and mobile `MobileMap`, which caused a mobile bottom sheet to appear on PC:

```text
새 건물 세대 / 건물 목록(1)
```

Fix:

- `App.tsx` now wraps `MobileHome` in `.mobile-shell-host`.
- `App.css` hides `.mobile-shell-host` at PC width (`min-width: 980px`).

Do not remove this wrapper unless the routing architecture changes.

### Desktop Navigation

Desktop menu:

```text
홈 / 공지 / 캘린더 / 구역 / 지도 / 배정 / 사용자 / 설정
```

Active desktop map is in:

```text
src/components/DesktopMap.tsx
```

Mobile map is separate:

```text
src/components/MobileMap.tsx
```

## Toast System

Implemented:

- `src/lib/toast.ts`
- `src/components/Toast.tsx`
- `App.tsx` renders `<Toast />`
- `useStore.ts` calls `showToast()` for many feedback events.

Reason:

- `useStore` is outside React context.
- Module-level event bus was simpler than context.

Toast types:

- success
- error
- info

Most `window.alert` calls were replaced. Some `window.confirm` calls still remain where confirmation is intentional, especially regular visit register/unregister and destructive actions.

## Supabase Notes

Known SQL already run by user:

```sql
ALTER TABLE calendar_events ADD COLUMN has_meeting BOOLEAN NOT NULL DEFAULT FALSE;
```

User also said the card-structure migration was run.

Relevant files:

```text
supabase/schema.sql
supabase/migrate_card_structure.sql
```

Current RLS is development-open. Do not treat this as production security.

## Naver Maps / Geocoding

Naver Cloud application must enable:

```text
Dynamic Map
Geocoding
Reverse Geocoding
```

The user initially had only `Geocoding` enabled. Reverse Geocoding was later enabled and started working.

Important distinction:

- `Geocoding`: address -> coordinates.
- `Reverse Geocoding`: coordinates -> address.

Both are now used in map building creation.

## Desktop Map Current UX

### Layout

`DesktopMap.tsx` is now an OTS-inspired operational map:

- Top filters
- Left card list and card boundary controls
- Center map
- Right building list / unit workbench

Right detail panel can be collapsed with `상세 접기/상세 열기`.

### Filters

Top filters include:

- 대권역
- 동
- 카드
- 대상: 전체 / 상가 / 주택
- 상태
- 운영:
  - 전체
  - 재시도
  - 저녁
  - 주말
  - 재확인
  - 정기
  - 중국인

Card filter now affects both map and building list.

### Marker Design

Pins were simplified:

- Small status-colored circles.
- Unit count only.
- Detailed text is not placed on the marker to reduce clutter.
- Building details are shown in the right panel.

Known future improvement:

- If many pins overlap, add clustering or density handling.

## Building Creation UX

This area changed several times. Current intended behavior:

### Entry Points

There is one prominent red `건물 추가` button in the desktop map toolbar.

Behavior:

1. Click red `건물 추가`.
2. Right panel opens a `건물 추가` form.
3. Click the same red button again to close the form.
4. User can either:
   - type an address and click `추가`
   - click a position on the map
   - right-click a position on the map

### Address-Based Creation

Important recent fix:

When a user opens the form from the red `건물 추가` button and enters an address, there may be no map coordinate yet.

`handleConfirmAddBuilding` now handles that:

- If `newBuildingLat/newBuildingLng` exist, create directly.
- If no coordinates exist but address exists, run Naver `Service.geocode`.
- On geocode success:
  - set `newBuildingLat`
  - set `newBuildingLng`
  - create building at those coordinates
  - pin should appear on the map
- On geocode failure:
  - set `geocodeStatus='fail'`
  - show a warning message asking for a more detailed address or map click.

This fix is in:

```text
src/components/DesktopMap.tsx
```

Relevant functions:

```text
openAddBuildingAt
handleMapRightClick
handleMapClick
handleOpenAddBuildingPanel
createBuildingAt
handleConfirmAddBuilding
```

### Map Click Creation

When the building form is open and `addingBuilding` is true:

- Map click calls `handleMapClick`.
- Right-click calls `handleMapRightClick`.
- `openAddBuildingAt(lat,lng)` stores coordinates.
- It attempts Reverse Geocoding to fill address automatically.

### Current Button/Panel Details

Recent cleanup:

- Removed the redundant map-top button labeled `클릭하여 위치 선택`.
- Removed the small card-name text next to that old button.
- The red `건물 추가` button is the single main control.
- Button uses CSS class:

```text
danger-add-building-button
```

Active state:

```text
danger-add-building-button active
```

### Important Bug History

Bug:

- User opened form with red button, typed address, clicked add, and no pin appeared.

Cause:

- Earlier implementation disabled save or defaulted to fallback coordinates when no map click had happened.

Fix:

- Add Geocoding-on-submit path in `handleConfirmAddBuilding`.

Future test:

1. Open map.
2. Select any card.
3. Click red `건물 추가`.
4. Enter an address like `경기 용인시 처인구 고림동 ...`.
5. Click `추가`.
6. Verify building is added to Supabase/local store.
7. Verify marker appears on map.
8. Verify the building appears in the right building list.

## Card Boundary / 구역선

Terminology:

```text
구역선
```

Do not use `라인` in visible UI if possible.

Behavior:

- Card boundary is saved in `card_boundaries`.
- A saved boundary can be drawn/edited/deleted.
- Boundary selection and card filtering are now separate concepts.
- Clicking a card can show/hide green emphasis without deleting the muted boundary line.
- `전체 보기` can show all boundaries green.
- If selected-card green emphasis is toggled off, muted dashed boundaries remain visible.

MapCanvas implementation notes:

- `selectedCardIdRef` prevents stale selected-card closure bugs.
- Naver map:
  - drag vertex to move
  - right-click vertex to delete
  - click midpoint to insert
- Mock map:
  - click vertex to delete
  - click midpoint to insert

Handle sizes were reduced because the previous points were too large:

```text
Naver vertex handle: 7px
Naver midpoint handle: 5px
```

## Territory/Card Management

`DesktopTerritory.tsx` handles PC card management.

Implemented:

- 대권역 filter.
- 동 chips.
- Card table.
- Card detail panel.
- Card creation panel.
- Card number auto-suggest based on selected region/dong.
- Duplicate card name prevention:
  - UI level.
  - `useStore.createCard` level.
- After card creation, an inline follow-up asks:
  - `나중에`
  - `구역선 그리기`
- `구역선 그리기` opens map boundary editor for the newly created card.

Desired product model:

```text
대권역 -> 동 -> 카드 번호
```

Example:

```text
처인구 고림동 1
처인구 고림동 2
```

Do not create separate spatial cards for 상가/주택/전체.

## Visit Recording

Representative unit status stays simple:

```text
만남
부재
한국인
확인필요
미방문
```

History remains detailed:

- date
- visitor
- time slot
- result
- memo

Visit attempt key:

```text
unit + visitor + local date + time slot
```

Repeated clicks for the same attempt update the existing `visit_histories` row instead of inserting duplicates.

New history row is created only when unit/date/time slot/visitor changes.

Wrong input handling:

- `최근 입력 취소`
- Deletes/restores latest history for the unit.
- Limited to recent input window in current logic.

Unit order:

- Sorted by unit number with Korean numeric collator.
- This avoids `101호` jumping to the bottom after a status click.

## Visit Strategy Chips

Derived, not stored as card types.

Examples:

- latest status `부재` -> `재시도 필요`
- afternoon absence 2+ and no evening attempt -> `저녁 재시도`
- evening absence 2+ and no weekend attempt -> `주말 재시도`
- latest status `확인필요` -> `재확인 필요`
- regular visit ownership -> `정기방문`
- Chinese marker -> `중국인`

Relevant file:

```text
src/utils/visitStrategy.ts
```

Strategy counts dedupe accidental duplicate histories by:

```text
visitedAt + timeSlot
```

This prevents repeated same-slot clicks from creating fake `부재 2회` recommendations.

## Calendar

Implemented/changed:

- Monthly calendar.
- Create event.
- Edit event.
- Delete event.
- Repeating events.
- Apply/cancel application.
- Assign participants.
- Remove participants.
- Visible UI now uses `배정` instead of `입명`.
- Blank title validation added.
- `has_meeting` / `hasMeeting` added for “봉사 모임 있음/없음”.
- Calendar form removed type/card fields per latest Claude work.

Important file:

```text
src/components/DesktopCalendar.tsx
```

Schema:

```text
calendar_events.has_meeting
```

## Mobile

Mobile exists and should remain simpler than PC.

Key mobile files:

```text
src/components/MobileHome.tsx
src/components/MobileMap.tsx
src/components/MobileCalendar.tsx
src/components/MobileTerritory.tsx
src/components/MobileNotices.tsx
```

Mobile map still has a bottom sheet by design. It must be hidden on PC through `.mobile-shell-host`.

Role badges exist in mobile header.

Do not remove mobile components unless replacing with a proper responsive route strategy.

## Current Known Limitations

- Auth is not implemented.
- Backend role enforcement is not production ready.
- User approval flow is not complete.
- RLS is development-open.
- CSV upload is not implemented yet.
- Some UI paths need real browser/Supabase verification.
- Current visitor is still effectively a selectable/hardcoded app state, not real auth.
- Bundle size warning appears on build; not urgent.
- There are many uncommitted changes in the worktree.

## CSV Upload Future Direction

Not implemented yet.

Recommended approach:

1. Define expected CSV columns:
   - 대권역
   - 동
   - 카드번호 or 카드명
   - 건물명
   - 주소
   - 유형
   - 호수
   - 메모
   - 정기방문 여부/담당자 if importing existing state
2. Parse CSV client-side.
3. Show preview table.
4. Validate:
   - required address/building/card fields
   - duplicate building/address/unit
   - invalid card names
5. Allow user to map columns.
6. Commit in batch to Supabase.
7. Add toast summary:
   - created cards
   - created buildings
   - created units
   - skipped duplicates
   - failed rows

Potential useful files:

```text
src/hooks/useStore.ts
src/components/DesktopTerritory.tsx
src/components/DesktopMap.tsx
```

## Recommended Next Tasks

High priority:

1. Browser-test address-based building creation:
   - red `건물 추가`
   - type address
   - click `추가`
   - verify pin appears
   - verify right panel list updates
2. Browser-test map-click building creation:
   - red `건물 추가`
   - click map
   - Reverse Geocode fills address
   - click `추가`
   - verify pin/list
3. After building creation, auto-open the newly created building in the right panel if feasible.
4. Add CSV import preview.
5. Verify Supabase persistence for:
   - create building
   - add unit
   - update visit status
   - edit visit history
   - regular visit toggle
6. Consider marker clustering or simplified zoom behavior for dense areas.

Lower priority:

1. Production auth.
2. Role-based RLS.
3. Deployment hardening.
4. Code splitting for bundle warning.
5. Deep component refactor.

## Recent Files Changed In This Session

Most recent Codex changes touched:

```text
src/components/DesktopMap.tsx
src/App.css
src/App.tsx
CLAUDE_NOTES.md
AGENT_HANDOFF.md
HANDOFF_DETAILED_2026-04-18.md
```

But the worktree includes many changes from both Claude and Codex. Always inspect before editing.

## Quick Mental Model For Next Agent

The most important current screen is Desktop Map.

Think of it this way:

```text
Territory card = spatial work area
Building = map pin
Unit = household/shop room inside building
Visit history = detailed chronological attempt log
Unit status = latest/simple representative state
Regular visit = assigned ownership of a favorable contact
Strategy chip = derived recommendation, not a stored card type
```

Do not over-model the domain too early. The user is actively testing the workflow and wants the UI to become usable first.
