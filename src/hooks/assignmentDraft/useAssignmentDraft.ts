// 인도자 배정 draft hook — reducer + localStorage 자동저장 묶음
// 설계: docs/leader-assignment-redesign.md v3
//
// 화면1(팀 짓기) / 화면2(구역 배분, 지도·목록) 모두 이 hook 하나를 공유.
// draft 변경 시 localStorage 자동저장. activeTeamId 등 휘발 상태는 저장 안 함.

import { useCallback, useEffect, useReducer, useRef } from 'react'
import type { AssignmentDraft, DraftAction, DraftState } from './types'
import { draftReducer } from './reducer'
import { saveLocalDraft } from './persistence'

export function useAssignmentDraft(
  eventId: number,
  userName: string,
  initialDraft: AssignmentDraft,
) {
  const init = (draft: AssignmentDraft): DraftState => ({
    draft,
    activeTeamId: draft.teams[0]?.id ?? null,
    undo: null,
  })

  const [state, dispatch] = useReducer(draftReducer, initialDraft, init)

  // 최초 마운트 시 자동저장 스킵 (로드된 그대로는 다시 쓸 필요 없음)
  const firstRef = useRef(true)
  useEffect(() => {
    if (firstRef.current) {
      firstRef.current = false
      return
    }
    saveLocalDraft(eventId, userName, state.draft)
  }, [eventId, userName, state.draft])

  // 외부에서 새 이벤트로 교체 시 reducer 재초기화
  const reload = useCallback((draft: AssignmentDraft, activeTeamId?: string | null) => {
    dispatch({ type: 'LOAD', draft, activeTeamId })
  }, [])

  return {
    draft: state.draft,
    teams: state.draft.teams,
    activeTeamId: state.activeTeamId,
    activeTeam: state.draft.teams.find((t) => t.id === state.activeTeamId) ?? null,
    canUndo: state.undo !== null,
    dispatch,
    reload,
  }
}

export type UseAssignmentDraft = ReturnType<typeof useAssignmentDraft>
export type { DraftAction }
