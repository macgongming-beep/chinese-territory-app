// 인도자 배정 에디터 (호스트) — 화면1(팀짓기) ↔ 화면2(구역배분) + 배정 공유
// 설계: docs/leader-assignment-redesign.md v3
//
// 진입: 일정상세에서 풀스크린. draft 단일 reducer 사용.
// 공유: 일정상세로 돌아가기 전 [배정 공유] 한 번 → 서버 bulk 저장.

import { useEffect, useMemo, useState } from 'react'
import type { Building, CalendarEvent, CardBoundary, EventInformalAssignment, EventRestaurantAssignment, InformalAsset, InformalGroup, TerritoryCard, VisitHistory } from '../../types'
import type { AssignmentDraft } from '../../hooks/assignmentDraft'
import {
  useAssignmentDraft,
  resolveDraftEntry,
  draftToAssignments,
  clearLocalDraft,
} from '../../hooks/assignmentDraft'
import { TeamBuildScreen } from './TeamBuildScreen'
import { ZoneAssignScreen } from './ZoneAssignScreen'
import { showToast } from '../../lib/toast'
import { pushBackHandler } from '../../lib/backStack'
import { msg } from '../../lib/msg'

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
  allCards?: TerritoryCard[]       // 전체 카드 (식당 구 그룹용)
  buildings: Building[]
  visitHistories?: VisitHistory[]
  cardBoundaries: CardBoundary[]
  currentVisitor: string
  canEdit: boolean
  informalAssets?: InformalAsset[]
  informalGroups?: InformalGroup[]
  eventInformalAssignments?: EventInformalAssignment[]
  eventRestaurantAssignments?: EventRestaurantAssignment[]
  onAssignInformalToUser?: (input: { eventId: number; userName: string; assetId: number; assignedBy: string }) => Promise<boolean>
  onRemoveInformalAssignment?: (assignmentId: number) => Promise<void>
  onAssignRestaurantToUser?: (input: { eventId: number; userName: string; buildingId: number; unitId?: number | null; assignedBy: string }) => Promise<boolean>
  onRemoveRestaurantAssignment?: (assignmentId: number) => Promise<void>
  onClose: () => void
  onShare: (
    eventId: number,
    assignments: Array<{ userName: string; cardIds: number[]; teamKey?: string }>,
    options: { expectedSharedAt: string | null; onConflict: (serverSharedAt: string | null) => void },
  ) => Promise<void> | void
}

export function AssignmentEditor({ event, cards, allCards = [], buildings, visitHistories = [], cardBoundaries, currentVisitor, canEdit, informalAssets = [], informalGroups = [], eventInformalAssignments = [], eventRestaurantAssignments = [], onAssignInformalToUser, onRemoveInformalAssignment, onAssignRestaurantToUser, onRemoveRestaurantAssignment, onClose, onShare }: Props) {
  // 편집 시작 시점의 서버 공유시각 — 공유 때 충돌 감지에 사용 (P0-3)
  const [entrySharedAt] = useState<string | null>(event.assignmentSharedAt ?? null)
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
  // 제거되는 사람이 있으면 토스트로 알림 (조용히 빠지지 않게)
  useEffect(() => {
    const validSet = new Set(participants)
    const removed = Array.from(
      new Set(initial.teams.flatMap((t) => t.members).filter((m) => !validSet.has(m))),
    )
    dispatch({ type: 'SANITIZE', participants })
    if (removed.length > 0) {
      showToast(msg('{v1}님이 신청 취소되어 배정에서 제외됐어요', { v1: removed.join(', ') }), 'info')
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const [screen, setScreen] = useState<'teams' | 'zones'>('teams')
  const [sharing, setSharing] = useState(false)
  const [confirmShare, setConfirmShare] = useState(false)
  const [shareConflict, setShareConflict] = useState(false)

  const openTeamZones = (teamId: string) => {
    dispatch({ type: 'SET_ACTIVE_TEAM', teamId })
    setScreen('zones')
  }

  // 구역 배분 화면에서 OS·스와이프 뒤로가기를 가로채 팀짓기로 한 단계만 복귀.
  // (에디터 오버레이 위에 한 층 더 쌓임 — backStack 이 최상단 한 층만 닫아준다.
  //  팀짓기에서 다시 스와이프하면 에디터가 닫혀 캘린더로 나간다)
  useEffect(() => {
    if (screen !== 'zones') return
    return pushBackHandler(() => setScreen('teams'))
  }, [screen])

  // 구역 없는 팀 (멤버는 있는데 카드 0)
  const emptyTeams = useMemo(
    () => teams.filter((t) => t.members.length > 0 && t.cardIds.length === 0),
    [teams],
  )

  const doShare = async () => {
    if (sharing) return
    setConfirmShare(false)
    setSharing(true)
    let conflicted = false
    try {
      await onShare(event.id, draftToAssignments(draft), {
        expectedSharedAt: entrySharedAt,
        onConflict: () => { conflicted = true },
      })
      if (conflicted) {
        setShareConflict(true)  // 그 사이 남이 공유함 → 모달, draft는 유지
        return
      }
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
          visitHistories={visitHistories}
          cardBoundaries={cardBoundaries}
          canEdit={canEdit}
          dispatch={dispatch}
          eventId={event.id}
          currentVisitor={currentVisitor}
          allCards={allCards}
          informalAssets={informalAssets}
          informalGroups={informalGroups}
          eventInformalAssignments={eventInformalAssignments}
          eventRestaurantAssignments={eventRestaurantAssignments}
          onAssignInformalToUser={onAssignInformalToUser}
          onRemoveInformalAssignment={onRemoveInformalAssignment}
          onAssignRestaurantToUser={onAssignRestaurantToUser}
          onRemoveRestaurantAssignment={onRemoveRestaurantAssignment}
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

      {/* 공유 충돌 — 편집 중 남이 먼저 공유 */}
      {shareConflict && (
        <div className="asg-confirm-backdrop">
          <div className="asg-confirm" onClick={(e) => e.stopPropagation()}>
            <h2>다른 곳에서 먼저 공유됐어요</h2>
            <p>
              편집하는 사이 다른 사람이 이 일정의 배정을 공유했습니다.
              덮어쓰지 않았어요. 최신 내용을 보려면 새로고침하세요.
            </p>
            <button className="asg-confirm-primary" onClick={() => { setShareConflict(false); onClose() }} type="button">닫고 새로고침</button>
          </div>
        </div>
      )}
    </div>
  )
}
