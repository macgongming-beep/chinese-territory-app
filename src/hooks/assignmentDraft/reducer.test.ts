import { describe, it, expect } from 'vitest'
import { draftReducer } from './reducer'
import type { AssignmentDraft, DraftState, DraftTeam } from './types'

function team(over: Partial<DraftTeam> = {}): DraftTeam {
  return { id: 't1', name: '팀 1', color: 'blue', order: 0, cardIds: [], members: [], ...over }
}

function makeState(teams: DraftTeam[], activeTeamId: string | null = teams[0]?.id ?? null): DraftState {
  const draft: AssignmentDraft = { mode: 'card', status: 'draft', updatedAt: null, teams }
  return { draft, activeTeamId, undo: null }
}

describe('draftReducer — 팀', () => {
  it('CREATE_TEAM: 선택 멤버로 새 팀 생성 + 활성화', () => {
    const s = makeState([])
    const next = draftReducer(s, { type: 'CREATE_TEAM', members: ['김민준', '이영희'] })
    expect(next.draft.teams).toHaveLength(1)
    expect(next.draft.teams[0].members).toEqual(['김민준', '이영희'])
    expect(next.activeTeamId).toBe(next.draft.teams[0].id)
  })

  it('CREATE_TEAM: 새 팀 멤버는 기존 팀에서 빠진다 (한 사람 한 팀)', () => {
    const s = makeState([team({ id: 'a', members: ['김민준', '박상철'] })])
    const next = draftReducer(s, { type: 'CREATE_TEAM', members: ['김민준'] })
    const teamA = next.draft.teams.find((t) => t.id === 'a')!
    expect(teamA.members).toEqual(['박상철'])
    expect(next.draft.teams).toHaveLength(2)
  })

  it('CREATE_TEAM: 이름은 "팀 N" 다음 번호로', () => {
    const s = makeState([team({ id: 'a', name: '팀 1' }), team({ id: 'b', name: '팀 3' })])
    const next = draftReducer(s, { type: 'CREATE_TEAM', members: [] })
    expect(next.draft.teams.at(-1)!.name).toBe('팀 4')
  })

  it('DELETE_TEAM: 활성팀 삭제 시 첫 팀으로 활성 이동', () => {
    const s = makeState([team({ id: 'a' }), team({ id: 'b' })], 'a')
    const next = draftReducer(s, { type: 'DELETE_TEAM', teamId: 'a' })
    expect(next.draft.teams.map((t) => t.id)).toEqual(['b'])
    expect(next.activeTeamId).toBe('b')
  })

  it('RENAME_TEAM: 공백 이름은 무시', () => {
    const s = makeState([team({ id: 'a', name: '팀 1' })])
    expect(draftReducer(s, { type: 'RENAME_TEAM', teamId: 'a', name: '   ' })).toBe(s)
    const ok = draftReducer(s, { type: 'RENAME_TEAM', teamId: 'a', name: '  A조 ' })
    expect(ok.draft.teams[0].name).toBe('A조')
  })
})

describe('draftReducer — 멤버', () => {
  it('MOVE_MEMBER: 다른 팀으로 이동(원팀에서 제거)', () => {
    const s = makeState([
      team({ id: 'a', members: ['김민준'] }),
      team({ id: 'b', members: [] }),
    ])
    const next = draftReducer(s, { type: 'MOVE_MEMBER', name: '김민준', toTeamId: 'b' })
    expect(next.draft.teams.find((t) => t.id === 'a')!.members).toEqual([])
    expect(next.draft.teams.find((t) => t.id === 'b')!.members).toEqual(['김민준'])
  })

  it('REMOVE_MEMBER: 해당 팀에서만 제거', () => {
    const s = makeState([team({ id: 'a', members: ['김민준', '이영희'] })])
    const next = draftReducer(s, { type: 'REMOVE_MEMBER', teamId: 'a', name: '김민준' })
    expect(next.draft.teams[0].members).toEqual(['이영희'])
  })
})

describe('draftReducer — 구역 카드 (한 카드 한 팀)', () => {
  it('ASSIGN_CARD: 활성팀에 추가 + undo 스냅샷', () => {
    const s = makeState([team({ id: 'a' })])
    const next = draftReducer(s, { type: 'ASSIGN_CARD', teamId: 'a', cardId: 10 })
    expect(next.draft.teams[0].cardIds).toEqual([10])
    expect(next.undo).toBe(s.draft) // 직전 스냅샷
  })

  it('MOVE_CARD: 카드가 다른 팀에 있으면 그 팀에서 빠지고 대상 팀으로', () => {
    const s = makeState([
      team({ id: 'a', cardIds: [10] }),
      team({ id: 'b', cardIds: [] }),
    ])
    const next = draftReducer(s, { type: 'MOVE_CARD', cardId: 10, toTeamId: 'b' })
    expect(next.draft.teams.find((t) => t.id === 'a')!.cardIds).toEqual([])
    expect(next.draft.teams.find((t) => t.id === 'b')!.cardIds).toEqual([10])
  })

  it('UNASSIGN_CARD: 카드 제거', () => {
    const s = makeState([team({ id: 'a', cardIds: [10, 20] })])
    const next = draftReducer(s, { type: 'UNASSIGN_CARD', teamId: 'a', cardId: 10 })
    expect(next.draft.teams[0].cardIds).toEqual([20])
  })

  it('UNDO: 직전 카드 변경을 되돌림', () => {
    const s = makeState([team({ id: 'a', cardIds: [] })])
    const assigned = draftReducer(s, { type: 'ASSIGN_CARD', teamId: 'a', cardId: 10 })
    const undone = draftReducer(assigned, { type: 'UNDO' })
    expect(undone.draft.teams[0].cardIds).toEqual([])
    expect(undone.undo).toBeNull()
  })
})

describe('draftReducer — SANITIZE', () => {
  it('현재 참가자에 없는 멤버 제거', () => {
    const s = makeState([team({ id: 'a', members: ['김민준', '탈퇴자'] })])
    const next = draftReducer(s, { type: 'SANITIZE', participants: ['김민준'] })
    expect(next.draft.teams[0].members).toEqual(['김민준'])
  })

  it('변경 없으면 동일 state 반환 (불필요한 렌더 방지)', () => {
    const s = makeState([team({ id: 'a', members: ['김민준'] })])
    const next = draftReducer(s, { type: 'SANITIZE', participants: ['김민준', '이영희'] })
    expect(next).toBe(s)
  })
})
