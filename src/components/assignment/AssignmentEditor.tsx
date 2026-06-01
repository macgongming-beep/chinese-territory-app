// 인도자 배정 에디터 (호스트) — 화면1(팀짓기) ↔ 화면2(구역배분) + 배정 공유
// 설계: docs/leader-assignment-redesign.md v3
//
// 진입: 일정상세에서 풀스크린. draft 단일 reducer 사용.
// 공유: 일정상세로 돌아가기 전 [배정 공유] 한 번 → 서버 bulk 저장.

import { useEffect, useMemo, useState } from 'react'
import type { Building, CalendarEvent, CardBoundary, TerritoryCard } from '../../types'
import type { AssignmentDraft } from '../../hooks/assignmentDraft'
import {
  useAssignmentDraft,
  resolveDraftEntry,
  draftToAssignments,
  clearLocalDraft,
} from '../../hooks/assignmentDraft'
import { TeamBuildScreen } from './TeamBuildScreen'
import { ZoneAssignScreen } from './ZoneAssignScreen'

// "5/29 (금) 10:00 · 봉사 모임" 형식
function formatEventDateTime(event: CalendarEvent): string {
  const wd = ['일', '월', '화', '수', '목', '금', '토']
  const d = new Date(event.date + 'T00:00:00')
  const datePart = Number.isNaN(d.getTime())
    ? event.date
    : `${d.getMonth() + 1}/${d.getDate()} (${wd[d.getDay()]})`
  const parts = [datePart, event.time].filter(Boolean)
  if (event.title) parts.push(event.title)
  return parts.join(' · ')
}

type Props = {
  event: CalendarEvent
  cards: TerritoryCard[]          // 인도자 담당 카드
  buildings: Building[]
  cardBoundaries: CardBoundary[]
  currentVisitor: string
  canEdit: boolean
  onClose: () => void
  onShare: (
    eventId: number,
    assignments: Array<{ userName: string; cardIds: number[] }>,
  ) => Promise<void> | void
}

export function AssignmentEditor({ event, cards, buildings, cardBoundaries, currentVisitor, canEdit, onClose, onShare }: Props) {
  // 진입 시 draft 결정 (lazy 1회). 충돌이면 server로 시작하고 모달 띄움.
  const [{ initial, conflictPair }] = useState(() => {
    const entry = resolveDraftEntry(event, currentVisitor)
    if (entry.kind === 'conflict') {
      return { initial: entry.server, conflictPair: { local: entry.local, server: entry.server } }
    }
    return { initial: entry.draft, conflictPair: null as null | { local: AssignmentDraft; server: AssignmentDraft } }
  })
  const [conflict, setConflict] = useState(conflictPair)

  const { draft, teams, activeTeamId, dispatch, reload } = useAssignmentDraft(
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
  const [confirmShare, setConfirmShare] = useState(false)

  const openTeamZones = (teamId: string) => {
    dispatch({ type: 'SET_ACTIVE_TEAM', teamId })
    setScreen('zones')
  }

  // 구역 없는 팀 (멤버는 있는데 카드 0)
  const emptyTeams = useMemo(
    () => teams.filter((t) => t.members.length > 0 && t.cardIds.length === 0),
    [teams],
  )

  const doShare = async () => {
    if (sharing) return
    setConfirmShare(false)
    setSharing(true)
    try {
      await onShare(event.id, draftToAssignments(draft))
      clearLocalDraft(event.id, currentVisitor) // 성공 후에만 정리
      onClose()
    } finally {
      setSharing(false)
    }
  }

  const handleShare = () => {
    if (sharing) return
    // 구역 미배정 팀이 있으면 경고 (그 팀은 공유 시 보존 안 됨)
    if (emptyTeams.length > 0) {
      setConfirmShare(true)
      return
    }
    void doShare()
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
          cardBoundaries={cardBoundaries}
          canEdit={canEdit}
          dispatch={dispatch}
          onBack={() => setScreen('teams')}
        />
      </div>
    )
  }

  return (
    <div className="asg-editor">
      <header className="asg-editor-head">
        <div className="asg-editor-head-left">
          <button className="asg-editor-back" onClick={onClose} type="button" aria-label="뒤로">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
          </button>
          <div className="asg-editor-titles">
            <strong>봉사 배정</strong>
            <span>{formatEventDateTime(event)}</span>
          </div>
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

      {/* 구역 미배정 팀 경고 */}
      {confirmShare && (
        <div className="asg-confirm-backdrop" onClick={() => setConfirmShare(false)}>
          <div className="asg-confirm" onClick={(e) => e.stopPropagation()}>
            <h2>구역이 없는 팀이 있어요</h2>
            <p>
              {emptyTeams.map((t) => t.name).join(', ')}에 배정된 구역이 없습니다.
              지금 공유하면 이 팀은 저장되지 않아요.
            </p>
            <button className="asg-confirm-primary" onClick={() => setConfirmShare(false)} type="button">돌아가서 구역 배정</button>
            <button className="asg-confirm-ghost" onClick={() => void doShare()} type="button">그대로 공유</button>
          </div>
        </div>
      )}
    </div>
  )
}
