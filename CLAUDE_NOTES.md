# Claude Notes

For the most complete current handoff, read:

```text
HANDOFF_DETAILED_2026-04-18.md
```

## Project

Path:

```text
/Users/gm/Documents/New project/chinese-territory-app
```

Run:

```bash
npm run dev
```

Build:

```bash
npm run build
```

Current local browser URL has often been:

```text
http://localhost:5174/
```

Vite may use another port if 5174 is busy.

## Current User Priority

The user wants implementation first. Avoid deep refactors unless they unblock the usable MVP.

Current focus:

- Territory map
- Card boundary drawing/editing
- Cleaner map UI
- PC-first territory management with later mobile optimization

## Latest Claude/Codex Sync

Build status:

```text
npm run build passes
```

Latest verified build was run after the Toast and map boundary updates.

Toast system:

- `src/lib/toast.ts` provides `registerToastListener` and `showToast`.
- `src/components/Toast.tsx` renders bottom-right slide-in toasts.
- `src/App.tsx` renders `<Toast />`.
- `src/hooks/useStore.ts` now uses `showToast` for user-facing success/error/info messages instead of most `window.alert` calls.
- Current regular-visit register/unregister still uses `window.confirm` for confirmation, then shows toast on success.

Recent UI/terminology updates:

- Calendar labels use `배정` instead of `입명` in visible UI.
- Calendar edit save validates blank titles.
- Mobile home header shows role badges.
- Loading state uses `.app-loading` and `.app-loading-spinner`.
- Empty states were added for map/card/building lists.
- Territory/card management filters now use a clearer `대권역 -> 동` hierarchy:
  - region is selected with buttons
  - dong/area is also selected with chips, not a dropdown
  - dong chips show card counts
  - card creation follows the selected region/dong when possible
- Territory card creation is now connected to map work:
  - card number auto-suggests the next index for the selected region/dong
  - `createCard` returns the inserted card id
  - `생성` creates the card and selects it
  - after creation, an inline follow-up panel asks whether to draw the boundary now
  - `나중에` keeps the user on territory management
  - `구역선 그리기` opens the map boundary editor for the new card
  - duplicate card names are blocked in the UI and again in `useStore.createCard`

## Core Domain Rule

Cards are spatial areas:

```text
처인구 고림동 1
처인구 고림동 2
기흥구 신갈동 1
```

Do not make separate card boundaries for `상가`, `주택`, or `전체`.

Instead:

- `대권역`: 처인구, 기흥구, 수지구, 영통구, 화성시
- `동`: 고림동, 신갈동, etc.
- `카드`: 고림동 1, 고림동 2, etc.
- `상가/주택/전체`: visit target filter inside the selected spatial card

Card size target:

- About 4-5 building pins per card.
- Small enough for one service session.

## Regular Visit Terminology

`정기방문` means a regular user has registered a favorable person/unit as their own regular visit.

It should be visible at the point/unit level so others do not duplicate the visit.

Do not treat `정기방문` as a card type.

## Recently Completed Map Changes

Map screen now uses an OTS-like structure:

- Top compact filters
- Left card list and card line controls
- Center map canvas
- Right building/unit detail panel

Right panel can be collapsed.

Selecting a card no longer hides all other pins. Selected-card pins remain emphasized and other pins dim.

Card boundary editing:

- Saved line for selected card is hidden while editing.
- Existing line is loaded as a draft when editing.
- Save upserts to `card_boundaries`.
- Save supports async completion and `savingBoundary` loading state in `DesktopMap`.
- Delete works from the left card row and the map toolbar.
- Naver map: drag vertex to move, right-click vertex to delete, click midpoint to insert.
- Mock map: click vertex to delete, click midpoint to insert.
- The UI term is now `구역선`, not `라인`.
- `selectedCardIdRef` in `MapCanvas` avoids stale selected-card closures.
- When selected card is `전체`, all card boundaries render as selected/green.
- Vertex handles were reduced again for readability:
  - Naver vertex handle: 7px
  - Naver midpoint handle: 5px

Latest UI cleanup:

- Boundary edit handles were reduced in size.
- Building pins were simplified to compact status-colored circles with only the unit count shown.
- Building name, status, and card name are still available by clicking a pin and reading the right detail panel.
- Naver marker hover title still includes building name, status, and card name.

OTS-inspired panel update:

- The right map panel is now a building work list, not a single static detail card.
- It shows the current filtered/card building count and unit completion summary.
- Selecting a building expands it into a workbench with:
  - building metadata
  - route button
  - unit add
  - unit status buttons
  - regular visit registration
  - recent visit history
- Map pins stay simple; operational detail lives in the right panel.
- This is intended for 관리자/인도자 PC use. Mobile 일반 사용자 should remain simpler.

Visit recording decision:

- A unit has one representative/latest status.
- A visit attempt is keyed by `unit + visitor + local date + time slot`.
- Repeated button presses for the same attempt update the existing `visit_histories` row instead of inserting duplicates.
- A new `visit_histories` row is created only when date/time slot/visitor/unit changes.
- The latest status is shown on the unit, but history is cumulative.
- Unit order is sorted by unit number with a Korean numeric collator so clicking a result should not move `101호` to the bottom.
- Wrong tap/click handling:
  - Use `최근 입력 취소`.
  - It deletes the latest visit history for that unit.
  - The unit status is restored to the previous history result, or `미방문` when no previous history exists.
- `최근 입력 취소` is limited to 10 minutes after input. Older edits should eventually go through an 인도자/관리자 correction flow.
- `부재` remains a real attempt history. It does not mean the point is finished.
- Derived strategy chips now exist:
  - latest status `부재` -> `재시도 필요`
  - `오후` absence 2+ times and no evening absence yet -> `저녁 재시도`
  - `저녁` absence 2+ times and no weekend absence yet -> `주말 재시도`
  - latest status `확인필요` -> `재확인 필요`
  - regular visit ownership -> `정기방문`
These chips are derived from `visit_histories` and unit state, not stored as separate card types.
- Strategy counts dedupe accidental duplicate histories by `visitedAt + timeSlot`, so repeated same-slot clicks do not create fake `부재 2회` recommendations.

Latest implementation:

- Desktop map now has an `운영` filter:
  - 전체
  - 재시도
  - 저녁
  - 주말
  - 재확인
  - 정기
- The filter works at building level: a building appears when at least one unit inside matches the selected strategy.
- Inside an expanded building, rows are also narrowed to matching units when a strategy filter is active.
- Desktop visit histories now have an 인도자/관리자 style inline `수정` form for:
  - visited date
  - time slot
  - result
  - memo
- If the edited history is the latest history for that unit, the representative unit status is updated to match it.
- `cardFilter` now applies to the building list/filtering path too.
- Selecting a card from the map card list focuses the first building in that card.
- The "전체 보기" toggle can switch between all boundaries selected/green and the current card view.
- Card boundary visibility is now separate from the card/building filter:
  - selecting a card still filters/focuses that card
  - clicking the already visible card again turns off the green emphasis
  - the boundary remains visible as a muted dashed line instead of disappearing completely
  - clicking again restores green emphasis
  - `전체 보기` shows all boundaries green

Regular visit visibility:

- Regular visit registration remains available after a unit is marked `만남`.
- Clicking `등록` asks for confirmation before inserting `regular_visits`.
- Clicking active `정기방문` asks for confirmation before deleting `regular_visits`.
- Registered units now stand out visually:
  - desktop unit row has a green left rail and soft green background
  - mobile unit row has the same green treatment
  - regular button becomes solid green and reads `정기방문`
  - building accordion shows `정기 N`
  - map pins with any regular unit get a green `정` badge

Map building creation cleanup:

- Naver Reverse Geocoding is expected to be enabled in the Naver Cloud app.
- The old bottom/right-pane inline `건물 추가` form was removed from `DesktopMap.tsx`.
- Building creation now uses the map click/right-click floating `building-add-panel` flow only.
- The right-side building accordion list remains; the removed block was the duplicate bottom creation/list area that covered the map.

## Handoff Status

This file and `AGENT_HANDOFF.md` are the current cross-agent logs. They summarize the important product decisions and implementation state, but they are not a complete chronological transcript of the Codex conversation. Claude should read both files and then inspect the current code before editing.

## Important Files

```text
src/components/DesktopMap.tsx
src/components/MapCanvas.tsx
src/components/DesktopTerritory.tsx
src/components/DesktopApp.tsx
src/hooks/useStore.ts
src/types.ts
src/App.css
src/data/territoryStructure.ts
src/data/territoryBoundary.ts
supabase/schema.sql
supabase/migrate_card_structure.sql
AGENT_HANDOFF.md
CLAUDE_NOTES.md
```

## Supabase Notes

The user already ran:

```sql
ALTER TABLE calendar_events ADD COLUMN has_meeting BOOLEAN NOT NULL DEFAULT FALSE;
```

The user also said they ran the card structure migration.

Check current schema before assuming production parity:

```text
supabase/schema.sql
supabase/migrate_card_structure.sql
```

Current RLS is development-open for MVP testing. Do not treat it as production security.

## Next Good Tasks

1. Verify boundary editing on the real Naver map after the smaller handles change.
2. Improve map pin density further if many buildings overlap at close zoom.
3. Add or verify an easy way to create buildings/units in the selected card.
4. Verify visit result buttons persist to Supabase.
5. Keep `AGENT_HANDOFF.md` and this file updated when changing data shape or workflow.
