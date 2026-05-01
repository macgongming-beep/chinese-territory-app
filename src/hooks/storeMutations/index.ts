/**
 * storeMutations — 도메인별 mutation factory 모음
 *
 * 각 도메인 파일에서 factory 함수를 re-export 합니다.
 * useStore.ts 는 이 index 파일만 import 하면 됩니다.
 *
 *   import { makeNoticeMutations, makeCalendarMutations, ... } from './storeMutations'
 */

export { makeNoticeMutations } from './notices'
export { makeSpecialPeriodMutations } from './specialPeriods'
export { makeCardBoundaryMutations } from './cardBoundaries'
export { makeReviewTaskMutations } from './reviewTasks'
export { makeCalendarMutations } from './calendar'
export type { CalendarEventInput } from './calendar'
export { makeCardMutations } from './cards'
export { makeBuildingMutations } from './buildings'
export { makeVisitMutations } from './visits'
export { makeRegularVisitMutations } from './regularVisits'
export { makeServiceSessionMutations } from './serviceSessions'
export { makeEventAssignmentMutations } from './eventAssignments'
