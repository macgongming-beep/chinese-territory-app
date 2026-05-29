import { useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { useNavigate } from 'react-router-dom'
import { showToast } from '../lib/toast'
import type { Building, CalendarEvent, CardBoundary, EventInformalAssignment, EventRestaurantAssignment, InformalAsset, InformalGroup, Role, TerritoryCard } from '../types'
import { isEmptyTerritoryCard, sortTerritoryCardsByOperationalPriority } from '../utils/cardSearch'
import { MapCanvas } from './MapCanvas'
import { RestaurantPickerModal } from './RestaurantPickerModal'
import { InformalPickerModal } from './InformalPickerModal'

type AssignmentMode = 'card' | 'people'
type AssignmentStatus = 'draft' | 'confirmed' | 'shared'
type ParticipantTag = '신청자' | '게스트'

type DraftTeam = {
  id: string
  name: string
  color: string
  cardIds: number[]
  members: string[]
}

type AssignmentDraft = {
  mode: AssignmentMode
  status: AssignmentStatus
  updatedAt: string | null
  teams: DraftTeam[]
  guests: string[]
}

type ParticipantItem = {
  name: string
  tag: ParticipantTag
}

type PendingAction = 'confirmed' | 'shared' | null

const TEAM_COLORS = ['blue', 'green', 'orange', 'purple', 'slate'] as const


function getTodayString() {
  const now = new Date()
  const year = now.getFullYear()
  const month = `${now.getMonth() + 1}`.padStart(2, '0')
  const day = `${now.getDate()}`.padStart(2, '0')
  return `${year}-${month}-${day}`
}

function formatKoreanDate(date: string) {
  const [year, month, day] = date.split('-').map(Number)
  const weekday = ['일', '월', '화', '수', '목', '금', '토'][new Date(year, month - 1, day).getDay()]
  return `${year}.${String(month).padStart(2, '0')}.${String(day).padStart(2, '0')} (${weekday})`
}

function draftStorageKey(eventId: number, currentVisitor: string) {
  return `mobileLeaderAssignmentDraft:${eventId}:${currentVisitor}`
}

function buildInitialDraft(event: CalendarEvent): AssignmentDraft {
  const grouped = new Map<string, { cardIds: number[]; members: string[] }>()
  event.cardAssignments.forEach((assignment) => {
    const cardIds = assignment.assignedCardIds && assignment.assignedCardIds.length > 0
      ? assignment.assignedCardIds
      : [assignment.assignedCardId]
    const key = cardIds.slice().sort((a, b) => a - b).join(',')
    const current = grouped.get(key) ?? { cardIds, members: [] }
    current.members.push(assignment.userName)
    grouped.set(key, current)
  })

  const teams = Array.from(grouped.values()).map((group, index) => ({
    id: `seed-${group.cardIds.join('-')}-${index}`,
    name: `팀 ${index + 1}`,
    color: TEAM_COLORS[index % TEAM_COLORS.length],
    cardIds: group.cardIds,
    members: group.members,
  }))

  return {
    mode: 'card',
    status: 'draft',
    updatedAt: null,
    teams,
    guests: [],
  }
}

function nextTeamName(teams: DraftTeam[]) {
  return `팀 ${teams.length + 1}`
}

function participantAssignedTeam(teams: DraftTeam[], participantName: string) {
  return teams.find((team) => team.members.includes(participantName))?.id ?? null
}

function canManageAssignment(event: CalendarEvent | null, currentVisitor: string, role: Role, actualRole?: Role) {
  if (!event) return false
  const effectiveRole = actualRole ?? role
  if (effectiveRole === 'admin' || effectiveRole === 'developer') return true
  return event.leader === currentVisitor
}

export function MobileLeaderAssignment({
  cards,
  buildings = [],
  cardBoundaries = [],
  calendarEvents,
  currentVisitor,
  role,
  actualRole,
  onAssignCardsToEventParticipantsBulk,
  // v2 신 배정
  informalAssets = [],
  informalGroups = [],
  eventInformalAssignments = [],
  eventRestaurantAssignments = [],
  onAssignInformalToUser,
  onRemoveInformalAssignment,
  onAssignRestaurantToUser,
  onRemoveRestaurantAssignment,
  onToggleBuildingRestaurant,
}: {
  cards: TerritoryCard[]
  buildings?: Building[]
  cardBoundaries?: CardBoundary[]
  calendarEvents: CalendarEvent[]
  currentVisitor: string
  role: Role
  actualRole?: Role
  onAssignCardsToEventParticipantsBulk: (
    eventId: number,
    assignments: Array<{ userName: string; cardId?: number | null; cardIds?: number[] | null }>,
    options?: { silentSuccess?: boolean; status?: 'confirmed' | 'shared' },
  ) => Promise<void> | void
  informalAssets?: InformalAsset[]
  informalGroups?: InformalGroup[]
  eventInformalAssignments?: EventInformalAssignment[]
  eventRestaurantAssignments?: EventRestaurantAssignment[]
  onAssignInformalToUser?: (input: { eventId: number; userName: string; assetId: number; assignedBy: string }) => Promise<boolean>
  onRemoveInformalAssignment?: (assignmentId: number) => Promise<void>
  onAssignRestaurantToUser?: (input: { eventId: number; userName: string; buildingId: number; assignedBy: string }) => Promise<boolean>
  onRemoveRestaurantAssignment?: (assignmentId: number) => Promise<void>
  onToggleBuildingRestaurant?: (buildingId: number, isRestaurant: boolean) => Promise<void>
}) {
  const navigate = useNavigate()
  const today = getTodayString()
  const leaderMode = role === 'leader' || role === 'admin' || role === 'developer'

  const accessibleCards = useMemo(
    () =>
      role === 'admin'
        ? cards
        : cards.filter((card) => {
            const leaders = card.assignedLeaders && card.assignedLeaders.length > 0
              ? card.assignedLeaders
              : card.assignedLeader
                ? [card.assignedLeader]
                : []
            return leaders.includes(currentVisitor)
          }),
    [cards, currentVisitor, role],
  )

  const todayEvents = useMemo(() => {
    const allToday = calendarEvents.filter((event) => event.date === today)
    return allToday.sort((a, b) => `${a.time} ${a.title}`.localeCompare(`${b.time} ${b.title}`, 'ko'))
  }, [calendarEvents, currentVisitor, today])

  // 디자인 v2 28 — 다가오는 봉사 (오늘+1 ~ 오늘+14, 본인이 인도자)
  const upcomingEvents = useMemo(() => {
    const cutoffDate = new Date(today)
    cutoffDate.setDate(cutoffDate.getDate() + 14)
    const cutoff = `${cutoffDate.getFullYear()}-${String(cutoffDate.getMonth() + 1).padStart(2, '0')}-${String(cutoffDate.getDate()).padStart(2, '0')}`
    return calendarEvents
      .filter((event) => event.date > today && event.date <= cutoff)
      .filter((event) => role === 'admin' || event.leader === currentVisitor)
      .sort((a, b) => `${a.date} ${a.time}`.localeCompare(`${b.date} ${b.time}`))
      .slice(0, 6)
  }, [calendarEvents, currentVisitor, role, today])

  const [selectedEventId, setSelectedEventId] = useState<number>(todayEvents[0]?.id ?? 0)
  const [draft, setDraft] = useState<AssignmentDraft | null>(null)
  const [selectedTeamId, setSelectedTeamId] = useState<string | null>(null)
  const [cardQuery, setCardQuery] = useState('')
  const [regionFilter, _setRegionFilter] = useState<'전체' | string>('전체')
  const [areaFilter, _setAreaFilter] = useState<'전체' | string>('전체')
  void _setRegionFilter; void _setAreaFilter
  const [onlyUnusedCards, setOnlyUnusedCards] = useState(true)
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set())
  const [cardActionTarget, setCardActionTarget] = useState<{ teamId: string; mode: 'append' | 'replace' } | null>(null)
  const [pendingAction, setPendingAction] = useState<PendingAction>(null)
  const [currentStep, setCurrentStep] = useState<1 | 2 | 3>(1)
  const [addMemberTeamId, setAddMemberTeamId] = useState<string | null>(null)
  const [previewCardId, setPreviewCardId] = useState<number | null>(null)
  // v2: picker 상태
  const [informalPickerTeamId, setInformalPickerTeamId] = useState<string | null>(null)
  const [restaurantPickerTeamId, setRestaurantPickerTeamId] = useState<string | null>(null)
  const [assignmentStarted, setAssignmentStarted] = useState(false)

  useEffect(() => {
    if (!todayEvents.length) {
      setSelectedEventId(0)
      return
    }
    if (!todayEvents.some((event) => event.id === selectedEventId)) {
      setSelectedEventId(todayEvents[0].id)
    }
  }, [selectedEventId, todayEvents])

  const selectedEvent = todayEvents.find((event) => event.id === selectedEventId) ?? null
  const canEditSelectedEvent = canManageAssignment(selectedEvent, currentVisitor, role, actualRole)

  useEffect(() => {
    if (!selectedEvent) {
      setDraft(null)
      return
    }
    const stored = window.localStorage.getItem(draftStorageKey(selectedEvent.id, currentVisitor))
    if (stored) {
      try {
        setDraft(JSON.parse(stored) as AssignmentDraft)
        return
      } catch {
        window.localStorage.removeItem(draftStorageKey(selectedEvent.id, currentVisitor))
      }
    }
    setDraft(buildInitialDraft(selectedEvent))
  }, [currentVisitor, selectedEvent])

  useEffect(() => {
    if (!draft?.teams.length) {
      setSelectedTeamId(null)
      return
    }
    if (!draft.teams.some((team) => team.id === selectedTeamId)) {
      setSelectedTeamId(draft.teams[0].id)
    }
  }, [draft?.teams, selectedTeamId])

  const participants = useMemo<ParticipantItem[]>(() => {
    if (!selectedEvent || !draft) return []
    const base = Array.from(new Set([...selectedEvent.applicants, ...selectedEvent.assigned])).map((name) => ({
      name,
      tag: '신청자' as ParticipantTag,
    }))
    const guestItems = draft.guests.map((name) => ({ name, tag: '게스트' as ParticipantTag }))
    return [...base, ...guestItems]
  }, [draft, selectedEvent])

  const unassignedParticipants = useMemo(
    () => participants.filter((participant) => !participantAssignedTeam(draft?.teams ?? [], participant.name)),
    [draft?.teams, participants],
  )

  const usedCardIds = useMemo(
    () => Array.from(new Set((draft?.teams ?? []).flatMap((team) => team.cardIds))),
    [draft?.teams],
  )

  const cardBuildingStats = useMemo(() => {
    const stats = new Map<number, { total: number; house: number; shop: number }>()
    // total은 card.buildings (이미 정확한 건물 수). house/shop은 buildings 배열에서 타입별 카운트.
    cards.forEach((card) => {
      stats.set(card.id, { total: card.buildings ?? 0, house: 0, shop: 0 })
    })
    buildings.forEach((building) => {
      const current = stats.get(building.cardId)
      if (!current) return  // 알 수 없는 카드의 건물은 스킵
      stats.set(building.cardId, {
        total: current.total,  // total은 초기값 유지 (card.buildings)
        house: current.house + (building.type === '주택' ? 1 : 0),
        shop: current.shop + (building.type === '상가' ? 1 : 0),
      })
    })
    return stats
  }, [buildings, cards])

  const getCardBuildingStats = (card: TerritoryCard) => {
    const s = cardBuildingStats.get(card.id)
    if (!s) return { total: card.buildings ?? 0, house: 0, shop: 0 }
    return {
      total: s.total,
      house: s.house,
      shop: s.shop,
    }
  }

  // 카드별 주택/상가 세대(units) 수 — card.houseUnits 필드가 없어서 직접 계산
  const cardUnitStats = useMemo(() => {
    const m = new Map<number, { house: number; shop: number }>()
    buildings.forEach((building) => {
      const prev = m.get(building.cardId) ?? { house: 0, shop: 0 }
      const unitCount = building.units?.length ?? 0
      if (building.type === '주택') prev.house += unitCount
      else if (building.type === '상가') prev.shop += unitCount
      m.set(building.cardId, prev)
    })
    return m
  }, [buildings])

  const areaOptions = useMemo(
    () => Array.from(new Set(accessibleCards.map((card) => card.area))).sort((a, b) => a.localeCompare(b, 'ko')),
    [accessibleCards],
  )
  void areaOptions

  const filteredCards = useMemo(() => {
    const loweredQuery = cardQuery.trim().toLowerCase()
    return sortTerritoryCardsByOperationalPriority(
      accessibleCards.filter((card) => {
        if (isEmptyTerritoryCard(card)) return false
        if (regionFilter !== '전체' && card.region !== regionFilter) return false
        if (areaFilter !== '전체' && card.area !== areaFilter) return false
        if (onlyUnusedCards && usedCardIds.includes(card.id)) return false
        if (!loweredQuery) return true
        return `${card.name} ${card.region} ${card.area}`.toLowerCase().includes(loweredQuery)
      }),
    )
  }, [accessibleCards, areaFilter, cardQuery, onlyUnusedCards, regionFilter, usedCardIds])

  const getEventDraft = (event: CalendarEvent) => {
    if (selectedEvent?.id === event.id && draft) return draft
    const stored = window.localStorage.getItem(draftStorageKey(event.id, currentVisitor))
    if (stored) {
      try {
        return JSON.parse(stored) as AssignmentDraft
      } catch {
        return buildInitialDraft(event)
      }
    }
    return buildInitialDraft(event)
  }

  const getEventSummary = (event: CalendarEvent) => {
    const eventDraft = getEventDraft(event)
    const eventParticipants = Array.from(new Set([...event.applicants, ...event.assigned, ...eventDraft.guests]))
    const eventCardIds = Array.from(new Set(eventDraft.teams.flatMap((team) => team.cardIds)))
    const assignedNames = new Set(eventDraft.teams.flatMap((team) => team.members))
    return {
      participants: eventParticipants.length,
      teams: eventDraft.teams.length,
      cards: eventCardIds.length,
      unassigned: eventParticipants.filter((name) => !assignedNames.has(name)).length,
    }
  }

  const openAssignmentForEvent = (eventId: number) => {
    setSelectedEventId(eventId)
    setCurrentStep(2)
    setCardActionTarget(null)
    setAddMemberTeamId(null)
    setAssignmentStarted(true)
  }

  const persistDraft = (nextDraft: AssignmentDraft, nextStatus?: AssignmentStatus) => {
    if (!selectedEvent) return
    const payload: AssignmentDraft = {
      ...nextDraft,
      status: nextStatus ?? nextDraft.status,
      updatedAt: new Date().toISOString(),
    }
    setDraft(payload)
    window.localStorage.setItem(draftStorageKey(selectedEvent.id, currentVisitor), JSON.stringify(payload))
    return payload
  }

  const applyCardToTeam = (cardId: number) => {
    if (!canEditSelectedEvent) return
    if (!draft) return
    const existingTeam = draft.teams.find((team) => team.cardIds.includes(cardId))
    if (existingTeam && !cardActionTarget) {
      setSelectedTeamId(existingTeam.id)
      return
    }

    if (cardActionTarget) {
      const targetTeamId = cardActionTarget.teamId
      const nextTeams = draft.teams.map((team) => {
        if (team.id !== targetTeamId) return team
        const cardIds = cardActionTarget.mode === 'replace'
          ? [cardId]
          : Array.from(new Set([...team.cardIds, cardId]))
        return { ...team, cardIds }
      })
      setCardActionTarget(null)
      setSelectedTeamId(targetTeamId)
      setCurrentStep(2)
      persistDraft({ ...draft, teams: nextTeams })
      return
    }

    const newTeam: DraftTeam = {
      id: `team-${Date.now()}-${cardId}`,
      name: nextTeamName(draft.teams),
      color: TEAM_COLORS[draft.teams.length % TEAM_COLORS.length],
      cardIds: [cardId],
      members: [],
    }
    const nextTeams = [...draft.teams, newTeam]
    setSelectedTeamId(newTeam.id)
    persistDraft({ ...draft, teams: nextTeams })
  }

  const createEmptyTeam = () => {
    if (!canEditSelectedEvent) return
    if (!draft) return
    const newTeam: DraftTeam = {
      id: `team-${Date.now()}`,
      name: nextTeamName(draft.teams),
      color: TEAM_COLORS[draft.teams.length % TEAM_COLORS.length],
      cardIds: [],
      members: [],
    }
    const nextDraft = { ...draft, teams: [...draft.teams, newTeam] }
    setSelectedTeamId(newTeam.id)
    setCardActionTarget({ teamId: newTeam.id, mode: 'append' })
    persistDraft(nextDraft)
  }

  const updateTeam = (teamId: string, updater: (team: DraftTeam) => DraftTeam) => {
    if (!canEditSelectedEvent) return
    if (!draft) return
    persistDraft({
      ...draft,
      teams: draft.teams.map((team) => (team.id === teamId ? updater(team) : team)),
    })
  }

  const deleteTeam = (teamId: string) => {
    if (!canEditSelectedEvent) return
    if (!draft) return
    const nextDraft = { ...draft, teams: draft.teams.filter((team) => team.id !== teamId) }
    persistDraft(nextDraft)
    if (selectedTeamId === teamId) setSelectedTeamId(nextDraft.teams[0]?.id ?? null)
  }


  const persistSharedAssignments = async (nextDraft: AssignmentDraft, status: 'confirmed' | 'shared') => {
    if (!canEditSelectedEvent) return
    if (!selectedEvent) return
    const persistedParticipants = participants.filter((participant) => participant.tag !== '게스트')
    const assignments = persistedParticipants.map((participant) => {
      const team = nextDraft.teams.find((item) => item.members.includes(participant.name))
      return {
        userName: participant.name,
        cardId: team?.cardIds[0] ?? null,
        cardIds: team?.cardIds ?? [],
      }
    })
    await Promise.resolve(onAssignCardsToEventParticipantsBulk(selectedEvent.id, assignments, { silentSuccess: true, status }))
  }

  const saveAssignmentState = async (nextStatus: AssignmentStatus) => {
    if (!canEditSelectedEvent) {
      showToast('이 봉사는 보기 전용입니다.', 'info')
      return
    }
    if (!draft || !selectedEvent) return
    if ((nextStatus === 'confirmed' || nextStatus === 'shared') && unassignedParticipants.length > 0) {
      setPendingAction(nextStatus)
      return
    }
    const nextDraft = persistDraft(draft, nextStatus)
    if (!nextDraft) return
    if (nextStatus === 'draft') {
      showToast('임시 저장되었습니다')
      return
    }
    if (nextStatus === 'confirmed') {
      await persistSharedAssignments(nextDraft, 'confirmed')
      showToast('배정이 확정되었습니다')
      return
    }
    if (nextStatus === 'shared') {
      await persistSharedAssignments(nextDraft, 'shared')
      showToast('배정이 공유되었습니다')
      return
    }
  }

  const continuePendingAction = async () => {
    if (!canEditSelectedEvent) return
    if (!pendingAction || !draft) return
    const action = pendingAction
    setPendingAction(null)
    const nextDraft = persistDraft(draft, action)
    if (!nextDraft) return
    if (action === 'shared') {
      await persistSharedAssignments(nextDraft, 'shared')
      showToast('미배정 인원이 있는 상태로 배정을 공유했습니다')
      return
    }
    await persistSharedAssignments(nextDraft, 'confirmed')
    showToast('미배정 인원이 있는 상태로 배정을 확정했습니다')
  }

  const removeCardFromTeam = (teamId: string, cardId: number) => {
    if (!canEditSelectedEvent) return
    updateTeam(teamId, (team) => ({ ...team, cardIds: team.cardIds.filter((id) => id !== cardId) }))
  }

  const removeMemberFromTeam = (teamId: string, participantName: string) => {
    if (!canEditSelectedEvent) return
    updateTeam(teamId, (team) => ({ ...team, members: team.members.filter((member) => member !== participantName) }))
  }

  const addMemberToTeam = (teamId: string, participantName: string) => {
    if (!canEditSelectedEvent) return
    if (!draft) return
    const nextTeams = draft.teams.map((team) => {
      // remove from all teams first
      const filteredMembers = team.members.filter((m) => m !== participantName)
      if (team.id !== teamId) return { ...team, members: filteredMembers }
      return { ...team, members: Array.from(new Set([...filteredMembers, participantName])) }
    })
    persistDraft({ ...draft, teams: nextTeams })
  }

  if (!leaderMode) {
    return (
      <section className="mobile-assignment-page">
        <div className="mobile-page-title">
          <span>배정</span>
          <h1>권한 없음</h1>
        </div>
        <article className="mobile-empty-card">일반 봉사자는 배정 탭을 사용할 수 없습니다.</article>
      </section>
    )
  }

  const stepLabels = ['카드 선택', '팀 구성', '참가자'] as const
  const goBack = () => {
    if (assignmentStarted && (currentStep === 1 || currentStep === 2)) {
      setAssignmentStarted(false)
      setCardActionTarget(null)
      setAddMemberTeamId(null)
      return
    }
    if (currentStep > 1) {
      setCurrentStep((s) => (s - 1) as 1 | 2 | 3)
      return
    }
    navigate(-1)
  }
  const goNext = () => {
    if (currentStep < 3) { setCurrentStep((s) => (s + 1) as 1 | 2 | 3); return }
    void saveAssignmentState('shared')
  }

  return (
    <section className="mobile-assignment-page">
      <div className="mobile-assignment-header mobile-assignment-header--subhead">
        <button className="mobile-assignment-back" onClick={goBack} type="button">‹</button>
        <p className="mobile-assignment-subhead-text">
          {assignmentStarted ? `${stepLabels[currentStep - 1]} (${currentStep}/3)` : '팀 구성 & 카드 배정'}
        </p>
      </div>

      {!assignmentStarted ? (
        <div className="ma-content ma-v2-main">
          {/* 오늘 봉사 — 디자인 v2 28 */}
          <section className="ma-v2-today-card">
            <div className="ma-v2-today-head">
              <h2>오늘 봉사</h2>
              <span className="ma-v2-today-cnt">{todayEvents.length}개 모임</span>
            </div>
            {todayEvents.length === 0 ? (
              <div className="ma-v2-today-empty">오늘 봉사 일정이 없습니다.</div>
            ) : (
              <div className="ma-v2-today-list">
                {todayEvents.map((event) => {
                  const summary = getEventSummary(event)
                  const canEditEvent = canManageAssignment(event, currentVisitor, role, actualRole)
                  return (
                    <article className="ma-v2-today-row" key={event.id}>
                      <div className="ma-v2-today-row-main">
                        <div className="ma-v2-today-row-titles">
                          <strong>{formatKoreanDate(event.date)} {event.title}</strong>
                          <span className="ma-v2-today-time">{event.time}</span>
                        </div>
                        <button
                          type="button"
                          className={`ma-v2-team-btn${canEditEvent ? '' : ' is-readonly'}`}
                          onClick={() => openAssignmentForEvent(event.id)}
                        >
                          {canEditEvent ? '팀 구성' : '구성 보기'}
                        </button>
                      </div>
                      <p className="ma-v2-today-meta">
                        인도자 {event.leader || '미정'} · 참가자 {summary.participants}명 · 팀 {summary.teams}개 · 배정 카드 {summary.cards}개 · 미배정 {summary.unassigned}명
                      </p>
                    </article>
                  )
                })}
              </div>
            )}
          </section>

          {/* 다가오는 봉사 — 디자인 v2 28 */}
          {upcomingEvents.length > 0 && (
            <section className="ma-v2-upcoming-section">
              <div className="mh-sec-head">
                <h2>
                  다가오는 봉사
                  <span className="mh-cnt">{upcomingEvents.length}</span>
                </h2>
              </div>
              <div className="ma-v2-upcoming-list">
                {upcomingEvents.map((event) => {
                  const summary = getEventSummary(event)
                  const d = new Date(event.date)
                  const dow = ['일', '월', '화', '수', '목', '금', '토'][d.getDay()]
                  const dShort = `${d.getMonth() + 1}/${d.getDate()}`
                  const hour = Number(event.time.split(':')[0] ?? 0)
                  const period = hour < 12 ? '오전' : hour < 17 ? '오후' : '저녁'
                  const status = summary.teams > 0 && summary.unassigned === 0
                    ? '구성 완료'
                    : summary.teams > 0
                      ? `구성 중 · 미배정 ${summary.unassigned}명`
                      : '미구성'
                  return (
                    <button
                      type="button"
                      className="ma-v2-upcoming-card"
                      key={event.id}
                      onClick={() => openAssignmentForEvent(event.id)}
                    >
                      <div className="ma-v2-upcoming-date">
                        <strong>{dShort}</strong>
                        <span>{dow}</span>
                      </div>
                      <div className="ma-v2-upcoming-body">
                        <span className="ma-v2-upcoming-time">{period} {event.time}</span>
                        <span className="ma-v2-upcoming-sub">신청 {summary.participants}명 · {status}</span>
                      </div>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden><polyline points="9 6 15 12 9 18"/></svg>
                    </button>
                  )
                })}
              </div>
            </section>
          )}
        </div>
      ) : !selectedEvent ? (
        <div className="ma-content">
          <article className="mobile-empty-card">오늘 봉사 일정이 없습니다.</article>
        </div>
      ) : (
        <>
          {/* WizardSteps pill — 디자인 v2 screens-h.jsx */}
          <nav className="ma-v2-wsteps" aria-label="배정 단계">
            {stepLabels.map((label, index) => {
              const step = (index + 1) as 1 | 2 | 3
              const cls = currentStep === step ? 'active' : currentStep > step ? 'done' : ''
              return (
                <button
                  type="button"
                  key={label}
                  className={`ma-v2-wpill ${cls}`}
                  onClick={() => setCurrentStep(step)}
                >
                  {label}
                </button>
              )
            })}
          </nav>

          <div className="ma-content">
            {!canEditSelectedEvent && (
              <div className="ma-view-only-notice">
                {selectedEvent.leader || '미정'} 인도 · 보기 전용
              </div>
            )}

            {/* ━━━ STEP 1: 카드 선택 — 디자인 v2 ━━━ */}
            {currentStep === 1 && (() => {
              // 지역 × 동 그룹핑
              const grouped = new Map<string, TerritoryCard[]>()
              for (const card of filteredCards) {
                const region = card.region || '기타'
                const area = card.area || '기타'
                const key = `${region}::${area}`
                const list = grouped.get(key) ?? []
                list.push(card)
                grouped.set(key, list)
              }
              const groups = [...grouped.entries()].map(([key, list]) => {
                const [region, area] = key.split('::')
                return { region, area, cards: list }
              }).sort((a, b) => `${a.region} ${a.area}`.localeCompare(`${b.region} ${b.area}`, 'ko'))

              const renderStatePill = (state: '미사용' | '사용중' | '사용완료') => (
                <span className={`ma-v2-state-pill ma-v2-state-${state === '미사용' ? 'unused' : state === '사용중' ? 'in-progress' : 'done'}`}>
                  {state}
                </span>
              )

              return (
                <article className="ma-v2-step1">
                  <div className="ma-v2-step-head">
                    <h2>1. 카드 선택</h2>
                    <span className="ma-v2-step-meta">선택 {usedCardIds.length}개 / 담당 {accessibleCards.length}개</span>
                  </div>
                  <p className="ma-v2-step-desc">이번 봉사에서 사용할 구역 카드를 골라주세요.</p>

                  {/* 검색 */}
                  <div className="ma-v2-search">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                      <circle cx="11" cy="11" r="7"/>
                      <line x1="21" y1="21" x2="16.65" y2="16.65"/>
                    </svg>
                    <input
                      placeholder="카드 이름 검색"
                      value={cardQuery}
                      onChange={(e) => setCardQuery(e.target.value)}
                    />
                  </div>

                  {/* 미배정만 보기 토글 */}
                  <label className="ma-v2-only-unused">
                      <input
                        type="checkbox"
                        checked={onlyUnusedCards}
                        onChange={(e) => setOnlyUnusedCards(e.target.checked)}
                        disabled={!canEditSelectedEvent}
                      />
                    미배정 카드만
                  </label>

                  {/* 그룹별 카드 */}
                  {groups.map((group) => {
                    const selectedInGroup = group.cards.filter((c) => usedCardIds.includes(c.id)).length
                    const totalInGroup = group.cards.length
                    const groupKey = `${group.region}::${group.area}`
                    const isCollapsed = collapsedGroups.has(groupKey)
                    return (
                      <section className="ma-v2-card-group" key={groupKey}>
                        <button
                          type="button"
                          className="ma-v2-card-group-head"
                          onClick={() => setCollapsedGroups((prev) => {
                            const next = new Set(prev)
                            if (next.has(groupKey)) next.delete(groupKey); else next.add(groupKey)
                            return next
                          })}
                          aria-expanded={!isCollapsed}
                        >
                          <svg
                            width="12" height="12" viewBox="0 0 24 24"
                            fill="none" stroke="currentColor" strokeWidth="2.2"
                            aria-hidden
                            style={{ transform: isCollapsed ? 'rotate(-90deg)' : 'none', transition: 'transform .15s' }}
                          ><polyline points="6 9 12 15 18 9"/></svg>
                          <span className="ma-v2-card-group-title">{group.region} · {group.area}</span>
                          <span className="ma-v2-card-group-cnt">선택 {selectedInGroup} / {totalInGroup}</span>
                        </button>
                        {!isCollapsed && (
                        <div className="ma-v2-card-list">
                          {group.cards.map((card) => {
                            const selected = usedCardIds.includes(card.id)
                            const totalUnits = card.units ?? 0
                            const unitStats = cardUnitStats.get(card.id) ?? { house: 0, shop: 0 }
                            const houseCount = unitStats.house
                            const shopCount = unitStats.shop
                            const state: '미사용' | '사용중' | '사용완료' =
                              card.progress >= 100 ? '사용완료' : card.progress > 0 ? '사용중' : '미사용'
                            return (
                              <button
                                type="button"
                                key={card.id}
                                className={`ma-v2-card-row${selected ? ' is-selected' : ''}`}
                                onClick={() => applyCardToTeam(card.id)}
                                disabled={!canEditSelectedEvent}
                              >
                                <span className={`ma-v2-card-check${selected ? ' is-on' : ''}`}>
                                  {selected && (
                                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden><polyline points="20 6 9 17 4 12"/></svg>
                                  )}
                                </span>
                                <div className="ma-v2-card-info">
                                  <strong>{card.name}</strong>
                                  <span>
                                    전체 {totalUnits}
                                    {houseCount > 0 && ` · 주택 ${houseCount}`}
                                    {shopCount > 0 && ` · 상가 ${shopCount}`}
                                    {card.progress > 0 && (
                                      <> · <em className="ma-v2-progress">{card.progress}%</em></>
                                    )}
                                  </span>
                                </div>
                                {renderStatePill(state)}
                              </button>
                            )
                          })}
                        </div>
                        )}
                      </section>
                    )
                  })}

                  {filteredCards.length === 0 && (
                    <p className="ma-v2-empty">조건에 맞는 카드가 없습니다.</p>
                  )}

                  {canEditSelectedEvent && (
                    <button className="ma-v2-add-card-direct" onClick={createEmptyTeam} type="button">
                      + 카드 직접 추가
                    </button>
                  )}
                </article>
              )
            })()}

            {/* ━━━ STEP 2: 팀 구성 — 디자인 v2 ━━━ */}
            {currentStep === 2 && (
              <article className="ma-v2-step2">
                <div className="ma-v2-step-head">
                  <h2>2. 팀 구성</h2>
                  {canEditSelectedEvent && (
                    <button className="ma-v2-add-team-btn" onClick={createEmptyTeam} type="button">
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" aria-hidden><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                      팀 추가
                    </button>
                  )}
                </div>
                <p className="ma-v2-step-desc">선택 카드 {usedCardIds.length}개 · 팀 {draft?.teams.length ?? 0}개</p>
                {/* 팀 카드 목록 */}
                <div className="mobile-assignment-team-list">
                  {(draft?.teams ?? []).map((team) => {
                    const teamCards = team.cardIds.map((id) => cards.find((c) => c.id === id)).filter(Boolean) as TerritoryCard[]
                    return (
                      <article className={`ma-team-card tone-${team.color}`} key={team.id}>
                        <div className="ma-team-head">
                          <div>
                            <div className="ma-team-name-row">
                              <strong>{team.name}</strong>
                              {canEditSelectedEvent && (
                                <button className="ma-icon-btn" onClick={() => { const n = prompt('팀 이름 변경', team.name); if (n?.trim()) updateTeam(team.id, (t) => ({ ...t, name: n.trim() })) }} title="팀 이름 변경" type="button">
                                  <svg viewBox="0 0 24 24" width="14" height="14"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" fill="none" stroke="currentColor" strokeWidth="2"/><path d="M18.5 2.5a2.12 2.12 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" fill="none" stroke="currentColor" strokeWidth="2"/></svg>
                                </button>
                              )}
                            </div>
                          </div>
                          {canEditSelectedEvent && (
                            <div className="ma-team-head-actions">
                              <button className="ma-outline-btn" onClick={() => { setCardActionTarget({ teamId: team.id, mode: 'replace' }); setCurrentStep(1) }} type="button">카드 변경</button>
                              <button className="ma-outline-btn danger" onClick={() => deleteTeam(team.id)} type="button">팀 삭제</button>
                            </div>
                          )}
                        </div>

                        {/* 카드 목록 */}
                        <p className="ma-team-sub">카드</p>
                        <div className="ma-team-cards-grid">
                          {teamCards.map((card) => {
                            const stats = getCardBuildingStats(card)
                            const isPreviewOpen = previewCardId === card.id
                            const previewBuildings = buildings.filter((building) => building.cardId === card.id)
                            const previewBoundaries = cardBoundaries.filter((boundary) => boundary.cardId === card.id)
                            return (
                              <div className="ma-team-card-stack" key={card.id} style={{ position: 'relative' }}>
                                {canEditSelectedEvent && (
                                  <div
                                    role="button"
                                    onClick={(e) => { e.stopPropagation(); removeCardFromTeam(team.id, card.id); }}
                                    style={{
                                      position: 'absolute',
                                      top: '50%',
                                      right: 10,
                                      transform: 'translateY(-50%)',
                                      width: 20,
                                      height: 20,
                                      minWidth: 20,
                                      minHeight: 20,
                                      padding: 0,
                                      borderRadius: '50%',
                                      background: 'var(--status-danger)',
                                      color: 'white',
                                      display: 'flex',
                                      alignItems: 'center',
                                      justifyContent: 'center',
                                      zIndex: 2,
                                      cursor: 'pointer',
                                    }}
                                  >
                                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
                                  </div>
                                )}
                                <button
                                  className={`ma-team-card-item${isPreviewOpen ? ' is-expanded' : ''}`}
                                  type="button"
                                  aria-expanded={isPreviewOpen}
                                  onClick={() => setPreviewCardId((current) => current === card.id ? null : card.id)}
                                  style={{ paddingRight: canEditSelectedEvent ? 38 : undefined }}
                                >
                                  <svg viewBox="0 0 24 24" width="14" height="14" aria-hidden="true"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" fill="none" stroke="currentColor" strokeWidth="2"/><circle cx="12" cy="10" r="3" fill="none" stroke="currentColor" strokeWidth="2"/></svg>
                                  <div>
                                    <strong>{card.name}</strong>
                                    <span>{`전체 ${stats.total} · 상가 ${stats.shop} · 주택 ${stats.house}`}</span>
                                  </div>
                                  <strong className="ma-team-card-progress">{card.progress}%</strong>
                                </button>
                                {isPreviewOpen && (
                                  <div className="ma-team-card-preview-map">
                                    <MapCanvas
                                      buildings={previewBuildings}
                                      cardBoundaries={previewBoundaries}
                                      cards={[card]}
                                      selectedBuildingId={0}
                                      selectedCardId={card.id}
                                      onSelectBuilding={() => undefined}
                                      highlightedCardIds={new Set([card.id])}
                                      isMobile
                                      compact
                                    />
                                  </div>
                                )}
                              </div>
                            )
                          })}
                          {canEditSelectedEvent && (
                            <button className="ma-team-add-card" onClick={() => { setCardActionTarget({ teamId: team.id, mode: 'append' }); setCurrentStep(1) }} type="button">+ 카드 추가</button>
                          )}
                        </div>

                        <p className="ma-team-sub">팀원</p>
                        <div className="ma-team-members">
                          {team.members.map((member) => (
                            <button className="ma-team-member-chip" key={member} onClick={() => removeMemberFromTeam(team.id, member)} type="button" disabled={!canEditSelectedEvent}>
                              <span className="ma-team-member-avatar" aria-hidden>{member.slice(0, 1)}</span>
                              <strong>{member}</strong>
                              {canEditSelectedEvent && <span className="ma-team-member-x" aria-hidden>×</span>}
                            </button>
                          ))}
                          {canEditSelectedEvent && (
                            <button
                              className={`ma-team-add-member${addMemberTeamId === team.id ? ' active' : ''}`}
                              onClick={() => setAddMemberTeamId((current) => current === team.id ? null : team.id)}
                              type="button"
                            >
                              {addMemberTeamId === team.id ? '선택 닫기' : '+ 팀원 추가'}
                            </button>
                          )}
                        </div>
                        {addMemberTeamId === team.id && (
                          <div className="ma-inline-member-picker">
                            <div className="ma-inline-member-head">
                              <strong>참여자 선택</strong>
                            </div>
                            {unassignedParticipants.length === 0 ? (
                              <p>추가할 미배정 참여자가 없습니다.</p>
                            ) : (
                              <div className="ma-inline-member-list">
                                {unassignedParticipants.map((participant) => (
                                  <button
                                    key={participant.name}
                                    onClick={() => {
                                      addMemberToTeam(team.id, participant.name)
                                    }}
                                    type="button"
                                  >
                                    <span className="ma-inline-avatar" aria-hidden="true">{participant.name.slice(0, 1)}</span>
                                    <strong>{participant.name}</strong>
                                    <em>{participant.tag}</em>
                                  </button>
                                ))}
                              </div>
                            )}
                          </div>
                        )}

                        {/* v2: 비공식 증거 카드 섹션 */}
                        {selectedEvent && onAssignInformalToUser && (
                          <>
                            <p className="ma-team-sub" style={{ marginTop: 12 }}>비공식 증거 카드</p>
                            <div className="ma-team-cards-grid">
                              {(() => {
                                const teamMemberSet = new Set(team.members)
                                const items = eventInformalAssignments.filter(
                                  (a) => a.eventId === selectedEvent.id && teamMemberSet.has(a.userName),
                                )
                                const uniqueAssetIds = Array.from(new Set(items.map((i) => i.assetId)))
                                return uniqueAssetIds.map((assetId) => {
                                  const asset = informalAssets.find((a) => a.id === assetId)
                                  if (!asset) return null
                                  const ids = items.filter((i) => i.assetId === assetId).map((i) => i.id)
                                  return (
                                    <div className="ma-team-card-item ma-team-spot" key={`inf-${assetId}`}>
                                      <span className="ma-team-spot-dot" style={{ background: '#8e6acb' }} />
                                      <div className="ma-team-spot-body">
                                        <strong>{asset.name}</strong>
                                        <span>비공식 · {items.filter((i) => i.assetId === assetId).length}명</span>
                                      </div>
                                      {canEditSelectedEvent && (
                                        <button
                                          type="button"
                                          className="ma-team-spot-remove"
                                          onClick={async () => {
                                            if (!onRemoveInformalAssignment) return
                                            for (const id of ids) await onRemoveInformalAssignment(id)
                                          }}
                                          aria-label="제거"
                                        >×</button>
                                      )}
                                    </div>
                                  )
                                })
                              })()}
                              {canEditSelectedEvent && (
                                <button
                                  className="ma-team-add-card ma-team-add-informal"
                                  onClick={() => {
                                    if (team.members.length === 0) {
                                      showToast('먼저 팀원을 추가해 주세요.', 'info')
                                      return
                                    }
                                    setInformalPickerTeamId(team.id)
                                  }}
                                  type="button"
                                >+ 비공식 추가</button>
                              )}
                            </div>
                          </>
                        )}

                        {/* v2: 식당 봉사 섹션 */}
                        {selectedEvent && onAssignRestaurantToUser && (
                          <>
                            <p className="ma-team-sub" style={{ marginTop: 12 }}>식당 봉사</p>
                            <div className="ma-team-cards-grid">
                              {(() => {
                                const teamMemberSet = new Set(team.members)
                                const items = eventRestaurantAssignments.filter(
                                  (a) => a.eventId === selectedEvent.id && teamMemberSet.has(a.userName),
                                )
                                const uniqueBuildingIds = Array.from(new Set(items.map((i) => i.buildingId)))
                                return uniqueBuildingIds.map((bId) => {
                                  const b = buildings.find((bb) => bb.id === bId)
                                  if (!b) return null
                                  const ids = items.filter((i) => i.buildingId === bId).map((i) => i.id)
                                  return (
                                    <div className="ma-team-card-item ma-team-spot" key={`rest-${bId}`}>
                                      <span className="ma-team-spot-dot" style={{ background: '#d88a3e' }} />
                                      <div className="ma-team-spot-body">
                                        <strong>{b.name || b.address}</strong>
                                        <span>식당 · {items.filter((i) => i.buildingId === bId).length}명</span>
                                      </div>
                                      {canEditSelectedEvent && (
                                        <button
                                          type="button"
                                          className="ma-team-spot-remove"
                                          onClick={async () => {
                                            if (!onRemoveRestaurantAssignment) return
                                            for (const id of ids) await onRemoveRestaurantAssignment(id)
                                          }}
                                          aria-label="제거"
                                        >×</button>
                                      )}
                                    </div>
                                  )
                                })
                              })()}
                              {canEditSelectedEvent && <button
                                className="ma-team-add-card ma-team-add-restaurant"
                                onClick={() => {
                                  if (team.members.length === 0) {
                                    showToast('먼저 팀원을 추가해 주세요.', 'info')
                                    return
                                  }
                                  setRestaurantPickerTeamId(team.id)
                                }}
                                type="button"
                              >+ 식당 추가</button>}
                            </div>
                          </>
                        )}
                      </article>
                    )
                  })}
                </div>

                {canEditSelectedEvent && <button className="ma-add-team-btn" onClick={createEmptyTeam} type="button">+ 팀 추가</button>}
              </article>
            )}

            {/* ━━━ STEP 3: 참가자 — 디자인 v2 ━━━ */}
            {currentStep === 3 && (
              <article className="ma-v2-step3">
                <div className="ma-v2-step-head">
                  <h2>3. 참가자</h2>
                </div>

                {unassignedParticipants.length > 0 && (
                  <div className="ma-v2-warn-callout">
                    <span className="ma-v2-warn-icon" aria-hidden>
                      <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
                        <line x1="12" y1="9" x2="12" y2="13"/>
                        <line x1="12" y1="17" x2="12.01" y2="17"/>
                      </svg>
                    </span>
                    <div className="ma-v2-warn-text">
                      <strong>미배정 인원이 있습니다.</strong>
                      <span>미배정 {unassignedParticipants.length}명: {unassignedParticipants.map((p) => p.name).join(', ')}</span>
                    </div>
                  </div>
                )}

                <p className="ma-v2-participant-note">배정 공유 전까지는 참가자에게 보이지 않습니다.</p>

                <div className="ma-v2-participant-list">
                  {participants.map((participant) => {
                    const assignedTeam = draft?.teams.find((team) => team.members.includes(participant.name))
                    const initial = participant.name.slice(0, 1)
                    return (
                      <button
                        type="button"
                        key={`${participant.tag}-${participant.name}`}
                        className={`ma-v2-participant-row${assignedTeam ? ' is-assigned' : ''}`}
                        onClick={() => {
                          if (assignedTeam) {
                            setSelectedTeamId(assignedTeam.id)
                            setCurrentStep(2)
                            return
                          }
                          if (canEditSelectedEvent && selectedTeamId) addMemberToTeam(selectedTeamId, participant.name)
                        }}
                      >
                        <span className={`ma-v2-participant-avatar${assignedTeam ? '' : ' muted'}`}>
                          {initial}
                        </span>
                        <span className="ma-v2-participant-name">{participant.name}</span>
                        {assignedTeam ? (
                          <span className="ma-v2-team-pill">{assignedTeam.name}</span>
                        ) : (
                          <span className="ma-v2-applicant-tag">{participant.tag}</span>
                        )}
                      </button>
                    )
                  })}
                  {participants.length === 0 && (
                    <p className="ma-v2-empty">아직 참가자가 없습니다.</p>
                  )}
                </div>
              </article>
            )}

          </div>

          {/* 하단 sticky — 디자인 v2 */}
          <div className="ma-v2-bottom-bar">
            {currentStep === 1 && (
              <>
                <span className="ma-v2-bottom-info">
                  <span className="muted">선택</span> <b>{usedCardIds.length}개</b>
                </span>
                <button className="ma-v2-next-btn" onClick={goNext} type="button">다음 →</button>
              </>
            )}
            {currentStep === 2 && (
              <>
                <span className="ma-v2-bottom-info">
                  <span className="muted">팀 {draft?.teams.length ?? 0}개 · 카드 {usedCardIds.length}개</span>
                </span>
                <button className="ma-v2-next-btn" onClick={goNext} type="button">다음 →</button>
              </>
            )}
            {currentStep === 3 && (
              <>
                <button className="ma-v2-ghost-btn" onClick={goBack} type="button">이전</button>
                {canEditSelectedEvent ? (
                  <>
                    <button className="ma-v2-ghost-btn" onClick={() => void saveAssignmentState('draft')} type="button">임시 저장</button>
                    <button className="ma-v2-next-btn" onClick={() => void saveAssignmentState('shared')} type="button">
                      {draft?.status === 'shared' ? '배정 재공유' : '배정 공유'}
                    </button>
                  </>
                ) : (
                  <button className="ma-v2-next-btn" onClick={goBack} type="button">목록으로</button>
                )}
              </>
            )}
          </div>

          {/* ── 미배정 확인 모달 ── */}
          {pendingAction && typeof document !== 'undefined' && createPortal(
            <div className="confirm-modal-backdrop" onClick={() => setPendingAction(null)}>
              <div className="cal-modal" style={{ maxWidth: '320px', borderRadius: '20px', padding: 0 }} onClick={(e) => e.stopPropagation()}>
                <div className="cal-modal-body" style={{ textAlign: 'center', padding: '32px 20px 24px' }}>
                  <div style={{ fontSize: '18px', fontWeight: 800, color: 'var(--ink-900)', marginBottom: '12px' }}>배정 공유 확인</div>
                  <div style={{ fontSize: '15px', color: 'var(--ink-600)', lineHeight: 1.5 }}>
                    <strong>미배정 인원이 남아 있습니다.</strong>
                    <p style={{ margin: '8px 0', fontSize: '14px', wordBreak: 'keep-all' }}>{unassignedParticipants.map((p) => p.name).join(', ')}</p>
                    <span style={{ fontSize: '13px', color: 'var(--ink-400)' }}>공유하면 배정된 참가자 카드만 공개됩니다.</span>
                  </div>
                </div>
                <div className="cal-modal-foot" style={{ display: 'flex', gap: '8px', padding: '16px', background: '#f8fafc', borderTop: '1px solid #e2e8f0', borderBottomLeftRadius: '20px', borderBottomRightRadius: '20px' }}>
                  <button className="cal-cancel-btn" style={{ flex: 1, minHeight: '48px', borderRadius: '14px', fontSize: '15px', fontWeight: 600, background: '#f1f5f9', color: '#334155', border: 'none' }} onClick={() => setPendingAction(null)} type="button">돌아가기</button>
                  <button className="cal-save-btn" style={{ flex: 1, minHeight: '48px', borderRadius: '14px', fontSize: '15px', fontWeight: 600, background: 'var(--ink, #1A1A18)', color: '#ffffff', border: 'none' }} onClick={() => void continuePendingAction()} type="button">
                    그래도 공유
                  </button>
                </div>
              </div>
            </div>,
            document.body
          )}
        </>
      )}

      {/* v2: 비공식 picker */}
      <InformalPickerModal
        open={informalPickerTeamId !== null}
        assets={informalAssets}
        groups={informalGroups}
        alreadyAssignedIds={(() => {
          if (!informalPickerTeamId || !selectedEvent) return new Set()
          const team = draft?.teams.find((t) => t.id === informalPickerTeamId)
          if (!team) return new Set()
          const memberSet = new Set(team.members)
          return new Set(eventInformalAssignments
            .filter((a) => a.eventId === selectedEvent.id && memberSet.has(a.userName))
            .map((a) => a.assetId))
        })()}
        onSelect={async (assetId) => {
          if (!canEditSelectedEvent) {
            setInformalPickerTeamId(null)
            return
          }
          if (!informalPickerTeamId || !selectedEvent || !onAssignInformalToUser) return
          const team = draft?.teams.find((t) => t.id === informalPickerTeamId)
          if (!team) return
          let okCount = 0
          for (const member of team.members) {
            const ok = await onAssignInformalToUser({
              eventId: selectedEvent.id,
              userName: member,
              assetId,
              assignedBy: currentVisitor,
            })
            if (ok) okCount += 1
          }
          if (okCount > 0) {
            showToast(`${okCount}명에게 비공식 자료를 배정했습니다.`, 'success')
          }
          setInformalPickerTeamId(null)
        }}
        onClose={() => setInformalPickerTeamId(null)}
      />

      {/* v2: 식당 picker */}
      <RestaurantPickerModal
        open={restaurantPickerTeamId !== null}
        role={role}
        buildings={buildings}
        alreadyAssignedIds={(() => {
          if (!restaurantPickerTeamId || !selectedEvent) return new Set()
          const team = draft?.teams.find((t) => t.id === restaurantPickerTeamId)
          if (!team) return new Set()
          const memberSet = new Set(team.members)
          return new Set(eventRestaurantAssignments
            .filter((a) => a.eventId === selectedEvent.id && memberSet.has(a.userName))
            .map((a) => a.buildingId))
        })()}
        onSelect={async (buildingId) => {
          if (!canEditSelectedEvent) {
            setRestaurantPickerTeamId(null)
            return
          }
          if (!restaurantPickerTeamId || !selectedEvent || !onAssignRestaurantToUser) return
          const team = draft?.teams.find((t) => t.id === restaurantPickerTeamId)
          if (!team) return
          let okCount = 0
          for (const member of team.members) {
            const ok = await onAssignRestaurantToUser({
              eventId: selectedEvent.id,
              userName: member,
              buildingId,
              assignedBy: currentVisitor,
            })
            if (ok) okCount += 1
          }
          if (okCount > 0) {
            showToast(`${okCount}명에게 식당을 배정했습니다.`, 'success')
          }
          setRestaurantPickerTeamId(null)
        }}
        onToggleRestaurantFlag={onToggleBuildingRestaurant}
        onClose={() => setRestaurantPickerTeamId(null)}
      />
    </section>
  )
}
