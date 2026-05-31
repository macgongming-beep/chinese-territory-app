// 인도자 배정 에디터 (호스트) — 화면1(팀짓기) ↔ 화면2(구역배분) + 배정 공유
// 설계: docs/leader-assignment-redesign.md v3
//
// 진입: 일정상세에서 풀스크린. draft 단일 reducer 사용.
// 공유: 일정상세로 돌아가기 전 [배정 공유] 한 번 → 서버 bulk 저장.

import { useEffect, useMemo, useState } from 'react'
import type { Building, CalendarEvent, TerritoryCard } from '../../types'
import type { AssignmentDraft } from '../../hooks/assignmentDraft'
import {
  useAssignmentDraft,
  resolveDraftEntry,
  draftToAssignments,
  clearLocalDraft,
} from '../../hooks/assignmentDraft'
import { TeamBuildScreen } from './TeamBuildScreen'
import { ZoneAssignScreen } from './ZoneAssignScreen'

type Props = {
  event: CalendarEvent
  cards: TerritoryCard[]          // 인도자 담당 카드
  buildings: Building[]
  currentVisitor: string
  canEdit: boolean
  onClose: () => void
  onShare: (
    eventId: number,
    assignments: Array<{ userName: string; cardIds: number[] }>,
  ) => Promise<void> | void
}

export function AssignmentEditor({ event, cards, buildings, currentVisitor, canEdit, onClose, onShare }: Props) {
  // 진입 시 draft 결정 (lazy 1회). 충돌이면 server로 시작하고 모달 띄움.
  const [{ initial, conflictPair }] = useState(() => {
    const entry = resolveDraftEntry(event, currentVisitor)
    if (entry.kind === 'conflict') {
      return { initial: entry.server, conflictPair: { local: entry.local, server: entry.server } }
    }
    return { initial: entry.draft, conflictPair: null as null | { local: AssignmentDraft; server: AssignmentDraft } }
  })
  const [conflict, setConflict] = useState(conflictPair)

  const { draft, teams, activeTeamId, activeTeam, canUndo, dispatch, reload } = useAssignmentDraft(
    event.id,
    currentVisitor,
    initial,
  )

  const participants = useMemo(
    () => Array.from(new Set([...event.applicants, ...event.assigned])),
    [event.applicants, event.assigned],
  )

  // 진입 시 참가자 sanitize (취소·거절자 제거) — 1회
  useEffect(() => {
    dispatch({ type: 'SANITIZE', participants })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const [screen, setScreen] = useState<'teams' | 'zones'>('teams')
  const [sharing, setSharing] = useState(false)

  const openTeamZones = (teamId: string) => {
    dispatch({ type: 'SET_ACTIVE_TEAM', teamId })
    setScreen('zones')
  }

  const handleShare = async () => {
    if (sharing) return
    setSharing(true)
    try {
      await onShare(event.id, draftToAssignments(draft))
      clearLocalDraft(event.id, currentVisitor) // 성공 후에만 정리
      onClose()
    } finally {
      setSharing(false)
    }
  }

  // 충돌 선택 모달
  if (conflict) {
    return (
      <div className="asg-conflict-backdrop">
        <div className="asg-conflict">
          <h2>임시 저장본과 공유본이 다릅니다</h2>
          <p>다른 곳에서 배정이 공유되었어요. 무엇을 사용할까요?</p>
          <button onClick={() => { reload(conflict.server); setConflict(null) }} type="button">공유본 사용</button>
          <button onClick={() => { reload(conflict.local); setConflict(null) }} type="button">내 임시 저장 이어서</button>
          <button className="danger" onClick={() => { clearLocalDraft(event.id, currentVisitor); reload(conflict.server); setConflict(null) }} type="button">임시 저장 삭제</button>
        </div>
      </div>
    )
  }

  if (screen === 'zones') {
    return (
      <div className="asg-editor">
        <ZoneAssignScreen
          teams={teams}
          activeTeamId={activeTeamId}
          cards={cards}
          buildings={buildings}
          canEdit={canEdit}
          canUndo={canUndo}
          dispatch={dispatch}
          onBack={() => setScreen('teams')}
        />
      </div>
    )
  }

  return (
    <div className="asg-editor">
      <header className="asg-editor-head">
        <button className="asg-zone-back" onClick={onClose} type="button" aria-label="닫기">‹</button>
        <div>
          <strong>{event.title || '봉사'} 배정</strong>
          <span>{event.time}{activeTeam ? ` · ${activeTeam.name}` : ''}</span>
        </div>
      </header>

      <TeamBuildScreen
        participants={participants}
        teams={teams}
        cards={cards}
        canEdit={canEdit}
        dispatch={dispatch}
        onOpenTeamZones={openTeamZones}
      />

      {canEdit && (
        <div className="asg-editor-footer">
          <button className="asg-share-btn" onClick={handleShare} disabled={sharing || teams.length === 0} type="button">
            {sharing ? '공유 중...' : '배정 공유'}
          </button>
        </div>
      )}
    </div>
  )
}
