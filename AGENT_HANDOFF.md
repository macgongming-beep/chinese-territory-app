# Agent Handoff

For a more detailed transfer note, read the latest handoff:

```text
HANDOFF_DETAILED_2026-04-20.md
```

Previous session notes:

```text
HANDOFF_DETAILED_2026-04-18.md
```

## Current Goal

Build a working MVP for a Chinese-language territory operation web app.

Current priority is implementation first. Security hardening, large refactors, and production-grade permission policies are secondary until the main workflows are usable.

## Project

Path:

```text
/Users/gm/Documents/New project/chinese-territory-app
```

Run:

```bash
npm run dev
```

Local URL:

```text
http://127.0.0.1:5173/
```

Build check:

```bash
npm run build
```

Latest verified build:

```text
npm run build passes after Toast and map boundary updates.
```

## Current Architecture

Stack:

- React
- Vite
- TypeScript
- Supabase client has been introduced

Important files:

```text
src/App.tsx
src/types.ts
src/hooks/useStore.ts
src/lib/supabase.ts
src/lib/toast.ts
src/data/sampleData.ts
src/data/territoryBoundary.ts
src/components/DesktopApp.tsx
src/components/DesktopCalendar.tsx
src/components/DesktopTerritory.tsx
src/components/DesktopMap.tsx
src/components/DesktopLeaderAssignment.tsx
src/components/Toast.tsx
src/components/MobileHome.tsx
src/components/MobileMap.tsx
src/components/MapCanvas.tsx
src/utils/mapUtils.ts
supabase/schema.sql
```

`App.tsx` is now mostly a wiring component. Most state and persistence logic lives in `src/hooks/useStore.ts`.

## Collaboration Note

Codex and Claude Code are not live-synced. They can still collaborate through the shared project files.

When handing work between agents:

1. Read this file first.
2. Run `git status --short`.
3. Inspect the relevant files before editing.
4. Do not overwrite changes from the other agent.
5. Update this handoff when changing major direction, data shape, or completed workflows.

## Domain Concepts

### Roles

There are three roles:

```text
관리자 -> 인도자 -> 일반 사용자
```

관리자:

- Creates and manages cards.
- Assigns cards to leaders.
- Manages users and approvals.
- Mostly PC-oriented.

인도자:

- Receives cards from admin.
- Reassigns those cards to regular users.
- Manages schedule participation and assignments.
- PC and mobile.

일반 사용자:

- Applies for schedules.
- Sees where to go today.
- Sees assigned cards.
- Records visits on mobile.

### Card Naming

Cards should follow names like:

```text
처인구 고림동 1
처인구 고림동 2
처인구 고림동 3
기흥구 신갈동 1
화성시 병점동 1
```

Rules:

- Card hierarchy is `대권역 -> 동 -> 번호`.
- Current 대권역 options are `처인구`, `기흥구`, `수지구`, `영통구`, `화성시`.
- `처인구 고림동 1`: one spatial card boundary in 고림동.
- `처인구 고림동 2`: another spatial card boundary in 고림동.
- `상가`, `주택`, `전체` are not card-boundary types. They are visit target filters inside a spatial card.
- Card rows still store `type='전체'` only for backward compatibility with the current schema.
- Do not use `정기방문` as a card type. Regular visits are point/unit-level ownership.
- Existing Supabase projects should run `supabase/migrate_card_structure.sql` once to rename old typed cards into spatial cards and replace old card type checks with `전체` only.

Card size:

- The card should be small enough for one service session.
- Separate commercial and residential where possible.
- Mixed cards are allowed when operationally useful.

### Regular Visits

Important terminology:

```text
정기방문 != 추가 시도 필요
```

정기방문:

- A regular user meets a favorable Chinese person and registers that point as their own regular visit.
- The goal is to show who is responsible for that point so others do not duplicate the visit.
- Example: `102동 1006호 · 노유나 정기방문`.

추가 시도 필요:

- A point that should be tried again because of absence, time-slot strategy, or a memo/check issue.

Do not mix these concepts in labels or data names.

## Implemented Workflows

### PC Layout

Implemented PC navigation:

```text
홈 / 공지 / 캘린더 / 구역 / 지도 / 배정 / 사용자 / 설정
```

Implemented screens:

- 캘린더
- 구역
- 지도
- 배정

Other menu items may still be placeholders.

### Toast/Feedback

Implemented:

- `src/lib/toast.ts` module-level toast event bus:
  - `registerToastListener`
  - `showToast`
- `src/components/Toast.tsx` bottom-right toast renderer.
- `App.tsx` renders `<Toast />`.
- `useStore.ts` uses `showToast` for most success/error/info feedback instead of `window.alert`.
- Regular visit register/unregister still uses `window.confirm` for confirmation, then toast on success.
- Loading screen uses `.app-loading` and `.app-loading-spinner`.

### Calendar

Implemented:

- Monthly calendar view.
- Date selection.
- Right-side detail panel.
- Event detail display:
  - title
  - type
  - time
  - place
  - leader
  - connected card
  - applicants
  - assigned participants
  - memo

- create event
- repeat event
- apply
- assign
- remove participant
- edit/delete event
- Visible UI label now uses `배정` instead of `입명`.
- Calendar edit save validates blank titles.

Schema note:

- `supabase/schema.sql` includes `calendar_events` and `event_participants`.
- Fresh Supabase setup should support the calendar screen after running the schema.
- UI actions still need browser-level verification with the connected project.

### Territory/Card Management

Implemented:

- Card table.
- Card detail panel.
- Card filters now work by:
  - 대권역
  - 동
  - 미배정
- Territory card filters are shown as a clear `대권역 -> 동` hierarchy.
- Dong filters are chip buttons with card counts instead of a dropdown.
- Card creation follows the selected region/dong when possible.
- Card creation now auto-suggests the next card number for the selected region/dong.
- `createCard` returns the new card id.
- Territory card creation uses one `생성` action, then shows an inline follow-up panel:
  - `나중에`
  - `구역선 그리기`, which opens the map boundary editor for the new card
- Duplicate card names are blocked in the UI and again in `useStore.createCard`.
- Territory card list UI has been compacted so map actions sit at the end of each row.
- Each card row has map actions:
  - `지도 보기`: opens the map filtered to that card.
  - `구역선 수정`: opens the map, selects that card, and starts boundary drawing/edit mode.
- Admin can assign a leader to a card.
- Card status changes from `미배정` to `진행중` when assigned.
- Card creation form:
  - region
  - area
  - type
  - index
  - pin count
- Card naming preview according to current naming rules.

Need to verify:

- New card persists to Supabase.
- New card appears correctly after refresh.
- Pin count is only metadata unless buildings are created separately.

### Leader Reassignment

Implemented:

- Leader selection.
- Shows cards assigned to the selected leader.
- Leader can assign/unassign regular users to/from a card.
- This models:

```text
관리자 -> 인도자 assignedLeader
인도자 -> 일반 사용자 assignedUsers
```

Need to verify:

- Card assignment toggles persist through Supabase.
- UI updates after refetch.

### Map

Implemented:

- Building-level markers.
- No unit-level markers.
- Marker click opens building detail.
- Filters:
  - territory region
  - area/dong
  - card
  - visit target (`상가`, `주택`, `상가+주택`)
  - status
- Map filters are displayed as a compact control panel, and status counts are shown as small legend chips.
- `cardFilter` applies to the building list/filtering path.
- Desktop map now follows an OTS-like split:
  - left card list and card line controls
  - center map canvas
  - right building/unit work panel
- The right building/unit detail panel can be collapsed from the map topbar.
- The right panel has been changed from a single selected-building detail view into an OTS-inspired building list:
  - current filtered/card building count
  - unit completion summary
  - selected building expands inline
  - unit status buttons, regular visit registration, unit add, recent visit history
- Selecting a card no longer hides other visible pins; the selected card remains emphasized while other pins are dimmed.
- Selecting a card from the map card list focuses the first building in that card.
- The `전체 보기` toggle can switch between all boundaries selected/green and the current card view.
- Card boundary visibility is separate from the card/building filter:
  - clicking the currently visible card again turns off its green emphasis
  - the card can remain selected/filtered while its boundary stays as a muted dashed line
  - clicking it again restores the green emphasized boundary
- Saved card boundary lines can be deleted from the left card list or the map line toolbar. During edit mode, the saved line for the selected card is hidden and the draft line is shown instead.
- Boundary save supports async completion and `savingBoundary` loading state.
- Boundary edit mode supports point-level editing:
  - Naver map: drag draft vertex markers to move points, right-click a vertex to delete it, click midpoint markers to insert a point.
  - Mock map: click draft vertices to delete and click midpoint markers to insert.
- Boundary UI term is `구역선`, not `라인`.
- `MapCanvas` uses `selectedCardIdRef` to avoid stale selected-card closure bugs.
- When selected card is `전체`, all card boundaries render as selected/green.
- Latest map UI cleanup:
  - Boundary edit handles are intentionally small so they do not cover pins while redrawing territory lines.
  - Latest handle sizes: Naver vertex 7px, midpoint 5px.
  - Building pins are compact status-colored circles and show only the unit count on the map.
  - Building name, card name, and other details should be read from the right detail panel after selecting a pin.
- Building status colors:
  - 미방문
  - 일부방문
  - 완료
  - 확인필요
  - 주의
- Building detail panel:
  - name
  - card
  - status
  - type
  - address
  - coordinates
  - route link
  - memo
  - unit list
- Unit visit result buttons:
  - 만남
  - 부재
  - 한국인
  - 확인필요
- Visit history time slot is saved automatically from the current device time when a result button is pressed:
  - before 12:00 -> 오전
  - 12:00-16:59 -> 오후
  - 17:00 and later -> 저녁
- Visit history display.
- Visit result behavior:
  - Unit representative status is overwritten by the latest button press.
  - Visit history is cumulative by actual visit attempt.
  - Visit attempt key is `unit + visitor + local date + time slot`.
  - Repeated same-attempt button presses update the existing history row instead of inserting duplicates.
  - Unit order is sorted by unit number to prevent rows jumping after status updates.
  - `최근 입력 취소` deletes the latest history row and restores the unit to the previous result, or `미방문` if there is no previous history.
  - `최근 입력 취소` is limited to 10 minutes after input.
- Derived strategy chips:
  - latest `부재` -> `재시도 필요`
  - `오후` absence 2+ times and no evening absence yet -> `저녁 재시도`
  - `저녁` absence 2+ times and no weekend absence yet -> `주말 재시도`
  - latest `확인필요` -> `재확인 필요`
  - regular visit ownership -> `정기방문`
  - strategy counts dedupe accidental duplicate histories by `visitedAt + timeSlot`
- Desktop map has an `운영` filter for the derived strategy chips. It filters buildings by whether any unit matches, and filters visible rows inside the expanded building.
- Desktop map visit histories have inline edit controls for 인도자/관리자 correction of old records. Editing the latest history also updates the unit representative status.
- Visit memo input.
- Regular visit register/unregister from unit.
- Regular visit UI:
  - registration is available once a unit status is `만남`
  - registration and unregister both show a confirmation dialog
  - registered units are emphasized with a green row treatment
  - registered buildings show a `정기 N` badge in the right panel
  - map pins with any regular unit show a green `정` badge
- Building create form.
- Unit add/delete.

Map behavior:

- Uses MockMap if Naver key is absent.
- Attempts Naver map if `VITE_NAVER_MAP_CLIENT_ID` exists.
- The full 경기용인중국어 KML boundary is stored in `src/data/territoryBoundary.ts`.
- Naver map draws that boundary as a blue dashed polygon and fits the initial map view to the whole territory.
- MockMap also renders a simplified SVG silhouette from the same KML coordinates so the boundary is visible without a Naver key.
- Card-level boundaries are supported through `card_boundaries`:
  - `supabase/schema.sql` creates `card_boundaries(card_id, points, updated_at)`.
  - `src/hooks/useStore.ts` loads/saves/deletes card boundaries.
  - `DesktopMap` has a card boundary editor: choose card, draw points on map, undo/reset/save/delete.
  - Boundary editor shows the selected card as `대권역 / 동 / 공간 카드`.
  - When drawing, an in-screen guide explains the current controls.
  - `MapCanvas` renders saved card boundaries and the active draft boundary.

Environment example:

```text
.env.example
```

Naver key variable:

```text
VITE_NAVER_MAP_CLIENT_ID=...
```

Need to verify:

- Naver map script parameter is correct for the actual Naver Cloud product.
- Building coordinates are entered directly by the user on the map.

### Mobile

Implemented:

- Role preview home.
- General user home.
- Mobile map entry from `지도 열기` or `방문 시작`.
- Mobile map with bottom sheet.
- Unit-level quick visit input.
- Regular visit register/unregister.
- Memo input.
- Recent visit history summary.

Need to verify:

- Mobile map is filtered to current user assigned cards.
- Bottom sheet ergonomics on small screens.
- Visit result buttons are large enough for field use.

## Supabase

Supabase integration has been introduced.

Important files:

```text
src/lib/supabase.ts
src/hooks/useStore.ts
supabase/schema.sql
```

The schema includes:

- cards
- card_assignments
- card_boundaries
- buildings
- units
- regular_visits
- visit_histories
- calendar_events
- event_participants

Last schema alignment:

- `calendar_events` and `event_participants` were added to `supabase/schema.sql` because `src/hooks/useStore.ts` already depends on them.
- Sample calendar events and participants are seeded in the schema.

Current RLS note:

- `supabase/schema.sql` currently uses broad `anon` open-access policies for development.
- This is acceptable only for MVP testing.
- Before production, RLS must be replaced with real auth/role policies.

Potentially sensitive file:

```text
.env.local
```

Do not paste or expose this file contents unless the user explicitly asks and understands the risk.

## Current Known Limitations

- Auth is not implemented.
- User approval flow is not implemented.
- Roles are not enforced by backend policies.
- RLS is development-only and open.
- Naver Map production integration needs verification with real credentials.
- CSV upload is not implemented.
- Some calendar actions may be implemented in the store but need end-to-end UI verification.
- Current visitor is hardcoded as `김민준`.
- The code is moving from local sample state to Supabase-backed state, so agents should verify current component behavior before assuming.

## Current Implementation Priority

User has said implementation is the urgent priority.

Do this now:

1. Keep building usable workflows.
2. Fix broken UI/action paths immediately.
3. Prefer end-to-end MVP behavior over refactoring.
4. Only do security/review work when it blocks implementation or would cause data loss.

Do later:

1. Production RLS.
2. Full auth.
3. Deep refactor.
4. Advanced analytics.
5. Deployment hardening.

## Suggested Next Tasks

Highest priority:

1. Verify map actions against Supabase:
   - create building
   - add unit
   - delete unit
   - update visit result
   - create visit history with memo
   - register/unregister regular visit

2. Verify calendar actions:
   - create event
   - create repeating events
   - apply to event
   - assign participant
   - remove participant
   - edit/delete event

3. Implement CSV upload:
   - import cards/buildings/units from Google Sheets export
   - validate required columns
   - show import preview before commit

4. Implement user/admin flow:
   - pending users
   - approved users
   - blocked users
   - role assignment

5. Improve map operations:
   - custom Naver markers
   - regular visit badge on markers

Recent map cleanup:

- The duplicate inline `건물 추가` form at the bottom of the map detail pane was removed.
- Map-based building creation should continue through the floating panel opened by map click/right-click.
- Do not reintroduce the old bottom creation/list panel unless the UX is intentionally redesigned.

## Notes For Future Agents

- Read `src/hooks/useStore.ts` before changing app behavior.
- Check whether a UI action already has a Supabase mutation before adding local-only state.
- Keep `정기방문` and `추가 시도 필요` separate.
- Keep cards to a size manageable in one service session.
- Do not change `.env.local` casually.
- Do not replace the current componentized structure with a single large `App.tsx`.
- Build after meaningful changes:

```bash
npm run build
```
