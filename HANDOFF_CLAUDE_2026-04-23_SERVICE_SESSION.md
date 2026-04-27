# Claude Handoff - 2026-04-23

## Project

- Path: `/Users/gm/Documents/New project/chinese-territory-app`
- Stack: React 19, TypeScript, Vite, Supabase, Naver Maps API
- Local URL usually: `http://localhost:5173/`
- Current focus: role-based home screens, service start sessions, calendar participant card assignment, map visit recording permissions.

## Current Product Direction

The app is no longer only "card assignment first". The intended workflow is:

1. User applies to a calendar event.
2. Leader may optionally assign a card to each participant from the calendar detail.
3. User/leader starts a service session from Home.
4. The session stores actual time slot and actual card.
5. Visit records made during the session attach to that service session.
6. Statistics should eventually be based mainly on visit records and service sessions, not only calendar schedule text.

Important policy decisions:

- Calendar events do not need fixed territory cards.
- Leaders may assign cards to participants, but field users can still manually search/select a card if plans changed.
- General users should record visits only while an active service session exists.
- Leaders/admins can record without a session.
- Existing visit history edit/delete should remain admin-oriented.

## Database / SQL Status

Relevant SQL file:

- `/Users/gm/Documents/New project/chinese-territory-app/supabase/add_service_sessions.sql`

It creates or updates:

- `service_sessions`
- `event_card_assignments`
- `visit_histories.service_session_id`
- `service_sessions.calendar_event_id`
- `service_sessions.assigned_card_id`
- `service_sessions.assignment_id`
- `service_sessions.source`

The user previously executed SQL successfully, but if Claude sees missing table/column warnings in console, rerun the latest version of `supabase/add_service_sessions.sql` in Supabase SQL Editor.

## Recently Implemented

### Role-Based Home

- Desktop header has an admin-only view mode toggle: 관리자 / 인도자 / 봉사자.
- Actual role is currently hardcoded admin until auth is implemented.
- Admin can preview leader/user home UI.
- Mobile has a matching role preview switch for admin.

Key files:

- `src/App.tsx`
- `src/components/DesktopApp.tsx`
- `src/components/DesktopHome.tsx`
- `src/components/MobileHome.tsx`

### Service Session

Added service session model and store actions:

- `startServiceSession`
- `endServiceSession`
- `assignCardToEventParticipant`

Visit inserts attach `service_session_id` when the current visitor has an active session for today.

General user recording is locked on map unless active session exists. Leaders/admin bypass this lock.

Key files:

- `src/types.ts`
- `src/hooks/useStore.ts`
- `src/components/DesktopMap.tsx`
- `src/components/MobileMap.tsx`

### Home "봉사 시작"

Desktop and mobile home now include service start UI.

Behavior:

- Shows today's relevant events where current user is applicant, assigned participant, or leader.
- Selecting event sets time slot from event time.
- If event has card assignment for the user, it auto-selects that card.
- If no assignment, user searches cards manually.
- Starting session navigates to `/map?cardId=<cardId>`.

Source saved on session:

- `assigned`: used assigned card
- `manual`: no assignment, manually selected
- `manual_override`: assignment existed, but user chose a different card

### Calendar Participant Card Assignment

The old 600-card dropdown was replaced with searchable card assignment input.

Behavior:

- In calendar event detail, each applicant has a mini card search.
- Search supports inputs like `고림`, `고림1`, `고림동 1`.
- Press Enter to choose the first result.
- Assigned card name remains in the input.
- `해제` removes the assignment.

Key file:

- `src/components/DesktopCalendar.tsx`

### Card Search Sorting

Added shared card search/sort utility:

- `src/utils/cardSearch.ts`

Exports:

- `normalizeCardSearch`
- `compareTerritoryCards`
- `sortTerritoryCards`

Sorting uses Korean locale natural numeric sort via `Intl.Collator('ko-KR', { numeric: true })`.

Applied to:

- Desktop home service start search
- Mobile home service start search
- Desktop calendar participant assignment search

Search result limit was removed. If `김량장동` has 27 cards, all 27 now appear in sorted order with scroll and a result count.

## Important UX Notes

- The user noticed that limiting search results to 8 hid many `김량장동` cards. This was fixed.
- Search results now show `검색 결과 n개`.
- Lists are scrollable instead of truncated.
- Next useful refinement: highlight matched text or group results by area if card count grows beyond 1000.

## Build Verification

Last command:

```bash
npm run build
```

Result:

- Build succeeded.
- Only Vite chunk-size warning remains.
- No TypeScript errors.

## Current Files Touched In Latest Mini-Pass

- `src/utils/cardSearch.ts` added
- `src/components/DesktopHome.tsx`
- `src/components/MobileHome.tsx`
- `src/components/DesktopCalendar.tsx`
- `HANDOFF_CLAUDE_2026-04-23_SERVICE_SESSION.md` added

## Suggested Next Work

1. Open browser and verify:
   - Home -> 봉사 시작 -> search `김량장동`
   - Confirm all 27 cards appear and are naturally sorted.
   - Press Enter and confirm first sorted result is selected.

2. Verify calendar assignment:
   - Calendar -> event detail -> applicant card search
   - Search `김량장동`
   - Assign one card, then clear with `해제`.

3. Decide next implementation step:
   - Admin service session dashboard
   - Service statistics by time slot/card/user
   - Auth and real role switching
   - Better mobile service start UX

## Caution

- Worktree is dirty with many user/Claude/Codex changes. Do not reset or revert unrelated files.
- If Supabase warnings appear for missing service session tables, run the SQL file above.
- The current role is still mocked/hardcoded until login/auth lands.
