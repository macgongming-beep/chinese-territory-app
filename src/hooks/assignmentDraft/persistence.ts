// 인도자 배정 draft — 서버 복원 + localStorage 영속 + 충돌 감지
// 설계: docs/leader-assignment-redesign.md v3
//
// 핵심:
//  - 서버 shared 배정에서 draft 재구성 (DB는 cardIds만 → 팀 이름/색/순서는 재생성, 보존 안 됨)
//  - 진입 시 localStorage draft vs 서버 비교 → 충돌이면 호출부가 사용자에게 선택지 제시
//  - 공유 성공 후에만 localStorage 정리 (제미나이: 실패 보호)

import type { AssignmentDraft, DraftTeam } from './types'
import { TEAM_COLORS } from './types'
import type { CalendarEvent } from '../../types'

function storageKey(eventId: number, userName: string): string {
  return `mobileLeaderAssignmentDraft:${eventId}:${userName}`
}

// ── 서버(이벤트 cardAssignments)에서 draft 재구성 ──────────────
// ⚠ DB는 사용자별 cardIds만 저장. 팀의 이름/색/순서는 보존되지 않으므로
//   "같은 cardIds 가진 사람끼리 묶기"로 팀을 재생성하고 메타는 새로 부여한다.
export function buildDraftFromServer(event: CalendarEvent): AssignmentDraft {
  const grouped = new Map<string, { cardIds: number[]; members: string[] }>()
  event.cardAssignments.forEach((assignment) => {
    const cardIds = assignment.assignedCardIds && assignment.assignedCardIds.length > 0
      ? assignment.assignedCardIds
      : assignment.assignedCardId != null
        ? [assignment.assignedCardId]
        : []
    const key = cardIds.slice().sort((a, b) => a - b).join(',') || `member:${assignment.userName}`
    const current = grouped.get(key) ?? { cardIds, members: [] }
    current.members.push(assignment.userName)
    grouped.set(key, current)
  })

  const teams: DraftTeam[] = Array.from(grouped.values()).map((group, index) => ({
    id: `team-server-${index}-${group.cardIds.join('-')}`,
    name: `팀 ${index + 1}`,
    color: TEAM_COLORS[index % TEAM_COLORS.length],
    order: index,
    cardIds: group.cardIds,
    members: group.members,
  }))

  return {
    mode: 'card',
    status: event.assignmentStatus === 'shared' ? 'shared' : 'draft',
    updatedAt: event.assignmentSharedAt ?? null,
    teams,
  }
}

// 빈 draft (신규 배정)
export function buildEmptyDraft(): AssignmentDraft {
  return { mode: 'card', status: 'draft', updatedAt: null, teams: [] }
}

// ── localStorage ──────────────────────────────────────────────
export function loadLocalDraft(eventId: number, userName: string): AssignmentDraft | null {
  try {
    const raw = localStorage.getItem(storageKey(eventId, userName))
    if (!raw) return null
    return JSON.parse(raw) as AssignmentDraft
  } catch {
    return null
  }
}

export function saveLocalDraft(eventId: number, userName: string, draft: AssignmentDraft): void {
  try {
    localStorage.setItem(storageKey(eventId, userName), JSON.stringify(draft))
  } catch {
    /* 용량 초과 등 무시 */
  }
}

// 공유 성공 후에만 호출 (제미나이: API resolve 직후 정리)
export function clearLocalDraft(eventId: number, userName: string): void {
  try {
    localStorage.removeItem(storageKey(eventId, userName))
  } catch {
    /* ignore */
  }
}

// ── 진입 시 draft 결정 + 충돌 감지 ────────────────────────────
export type DraftEntryResult =
  | { kind: 'fresh'; draft: AssignmentDraft }            // 로컬 없음 → 서버/빈 draft
  | { kind: 'local'; draft: AssignmentDraft }            // 로컬만 있음 → 그대로
  | { kind: 'conflict'; local: AssignmentDraft; server: AssignmentDraft } // 둘 다 → 사용자 선택

// 충돌 판단: 로컬 draft가 있고, 서버가 그 이후 공유되었으면(서버가 더 최신) 선택 필요
export function resolveDraftEntry(event: CalendarEvent, userName: string): DraftEntryResult {
  const local = loadLocalDraft(event.id, userName)
  const serverShared = event.assignmentStatus === 'shared'

  if (!local) {
    // 로컬 없음 → 서버 공유본 있으면 그걸로, 아니면 빈 draft
    return { kind: 'fresh', draft: serverShared ? buildDraftFromServer(event) : buildEmptyDraft() }
  }

  if (!serverShared) {
    // 서버 공유본 없음 → 로컬 이어서
    return { kind: 'local', draft: local }
  }

  // 둘 다 존재 → 시각 비교
  const localTime = local.updatedAt ? new Date(local.updatedAt).getTime() : 0
  const serverTime = event.assignmentSharedAt ? new Date(event.assignmentSharedAt).getTime() : 0

  if (serverTime > localTime) {
    // 서버가 더 최신 → 충돌, 사용자 선택 (서버 사용 / 로컬 이어서 / 로컬 삭제)
    return { kind: 'conflict', local, server: buildDraftFromServer(event) }
  }
  // 로컬이 더 최신 → 로컬 이어서
  return { kind: 'local', draft: local }
}
