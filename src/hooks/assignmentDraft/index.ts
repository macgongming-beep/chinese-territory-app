// 인도자 배정 draft 모듈 — 공개 API
// 설계: docs/leader-assignment-redesign.md v3
export * from './types'
export { draftReducer } from './reducer'
export {
  buildDraftFromServer,
  buildEmptyDraft,
  loadLocalDraft,
  saveLocalDraft,
  clearLocalDraft,
  resolveDraftEntry,
} from './persistence'
export type { DraftEntryResult } from './persistence'
export { useAssignmentDraft } from './useAssignmentDraft'
export type { UseAssignmentDraft } from './useAssignmentDraft'
