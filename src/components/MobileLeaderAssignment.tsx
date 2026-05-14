import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { showToast } from '../lib/toast'
import type { CalendarEvent, Role, TerritoryCard } from '../types'

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

export function MobileLeaderAssignment({
  cards,
  calendarEvents,
  currentVisitor,
  role,
  onAssignCardsToEventParticipantsBulk,
}: {
  cards: TerritoryCard[]
  calendarEvents: CalendarEvent[]
  currentVisitor: string
  role: Role
  onAssignCardsToEventParticipantsBulk: (
    eventId: number,
    assignments: Array<{ userName: string; cardId?: number | null; cardIds?: number[] | null }>,
    options?: { silentSuccess?: boolean },
  ) => Promise<void> | void
}) {
  const navigate = useNavigate()
  const today = getTodayString()
  const leaderMode = role === 'leader' || role === 'admin'

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
    const ownToday = allToday.filter((event) => event.leader === currentVisitor)
    return ownToday.length > 0 ? ownToday : allToday
  }, [calendarEvents, currentVisitor, today])

  const [selectedEventId, setSelectedEventId] = useState<number>(todayEvents[0]?.id ?? 0)
  const [draft, setDraft] = useState<AssignmentDraft | null>(null)
  const [selectedTeamId, setSelectedTeamId] = useState<string | null>(null)
  const [cardQuery, setCardQuery] = useState('')
  const [regionFilter, setRegionFilter] = useState<'전체' | string>('전체')
  const [areaFilter, setAreaFilter] = useState<'전체' | string>('전체')
  const [onlyUnusedCards, setOnlyUnusedCards] = useState(true)
  const [cardActionTarget, setCardActionTarget] = useState<{ teamId: string; mode: 'append' | 'replace' } | null>(null)
  const [pendingAction, setPendingAction] = useState<PendingAction>(null)
  const [currentStep, setCurrentStep] = useState<1 | 2 | 3>(1)
  const [addMemberTeamId, setAddMemberTeamId] = useState<string | null>(null)
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

  const areaOptions = useMemo(
    () => Array.from(new Set(accessibleCards.map((card) => card.area))).sort((a, b) => a.localeCompare(b, 'ko')),
    [accessibleCards],
  )

  const filteredCards = useMemo(() => {
    const loweredQuery = cardQuery.trim().toLowerCase()
    return accessibleCards.filter((card) => {
      if (regionFilter !== '전체' && card.region !== regionFilter) return false
      if (areaFilter !== '전체' && card.area !== areaFilter) return false
      if (onlyUnusedCards && usedCardIds.includes(card.id)) return false
      if (!loweredQuery) return true
      return `${card.name} ${card.region} ${card.area}`.toLowerCase().includes(loweredQuery)
    })
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
    if (!draft) return
    persistDraft({
      ...draft,
      teams: draft.teams.map((team) => (team.id === teamId ? updater(team) : team)),
    })
  }

  const deleteTeam = (teamId: string) => {
    if (!draft) return
    const nextDraft = { ...draft, teams: draft.teams.filter((team) => team.id !== teamId) }
    persistDraft(nextDraft)
    if (selectedTeamId === teamId) setSelectedTeamId(nextDraft.teams[0]?.id ?? null)
  }


  const persistSharedAssignments = async (nextDraft: AssignmentDraft) => {
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
    await Promise.resolve(onAssignCardsToEventParticipantsBulk(selectedEvent.id, assignments, { silentSuccess: true }))
  }

  const saveAssignmentState = async (nextStatus: AssignmentStatus) => {
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
      await persistSharedAssignments(nextDraft)
      showToast('배정이 확정되었습니다')
      return
    }
    if (nextStatus === 'shared') {
      await persistSharedAssignments(nextDraft)
      showToast('배정이 공유되었습니다')
      return
    }
  }

  const continuePendingAction = async () => {
    if (!pendingAction || !draft) return
    const action = pendingAction
    setPendingAction(null)
    const nextDraft = persistDraft(draft, action)
    if (!nextDraft) return
    if (action === 'shared') {
      await persistSharedAssignments(nextDraft)
      showToast('미배정 인원이 있는 상태로 배정을 공유했습니다')
      return
    }
    showToast('미배정 인원이 있는 상태로 배정을 확정했습니다')
  }

  const removeMemberFromTeam = (teamId: string, participantName: string) => {
    updateTeam(teamId, (team) => ({ ...team, members: team.members.filter((member) => member !== participantName) }))
  }

  const addMemberToTeam = (teamId: string, participantName: string) => {
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
      <div className="mobile-assignment-header">
        <button className="mobile-assignment-back" onClick={goBack} type="button">‹</button>
        <div>
          <h1>인도자 배정</h1>
          <p>팀 구성 & 카드 배정</p>
        </div>
        <span aria-hidden="true" />
      </div>

      {!assignmentStarted ? (
        <div className="ma-content">
          <article className="ma-today-board">
            <div className="ma-today-board-head">
              <h2>오늘 봉사</h2>
              <span>{todayEvents.length}개 모임</span>
            </div>
            {todayEvents.length === 0 ? (
              <p className="ma-today-empty">오늘 봉사 일정이 없습니다.</p>
            ) : (
              <div className="ma-today-event-list">
                {todayEvents.map((event) => {
                  const summary = getEventSummary(event)
                  return (
                    <section className="ma-today-event-card" key={event.id}>
                      <div className="ma-today-event-main">
                        <div>
                          <strong>{formatKoreanDate(event.date)} {event.title}</strong>
                          <span>{event.time}</span>
                        </div>
                        <button onClick={() => openAssignmentForEvent(event.id)} type="button">팀 구성</button>
                      </div>
                      <p>
                        참가자 {summary.participants}명 · 팀 {summary.teams}개 · 배정 카드 {summary.cards}개 · 미배정 {summary.unassigned}명
                      </p>
                    </section>
                  )
                })}
              </div>
            )}
          </article>
        </div>
      ) : !selectedEvent ? (
        <div className="ma-content">
          <article className="mobile-empty-card">오늘 봉사 일정이 없습니다.</article>
        </div>
      ) : (
        <>
          <nav className="ma-step-tabs" aria-label="배정 단계">
            {stepLabels.map((label, index) => {
              const step = (index + 1) as 1 | 2 | 3
              return (
                <button className={currentStep === step ? 'active' : ''} key={label} onClick={() => setCurrentStep(step)} type="button">
                  <span>{label}</span>
                </button>
              )
            })}
          </nav>

          <div className="ma-content">

            {/* ━━━ STEP 1: 카드 선택 ━━━ */}
            {currentStep === 1 && (
              <>
                <article className="leader-column leader-cards-column ma-pc-step-panel">
                  <div className="leader-column-head">
                    <h2>1. 사용할 카드 선택</h2>
                  </div>

                  {/* 검색 + 필터 */}
                  <input className="leader-search-input" placeholder="카드명 검색" value={cardQuery} onChange={(e) => setCardQuery(e.target.value)} />
                  <div className="leader-card-filters">
                    <select value={regionFilter} onChange={(e) => setRegionFilter(e.target.value)}>
                      <option value="전체">지역 전체</option>
                      {Array.from(new Set(accessibleCards.map((c) => c.region))).map((r) => <option key={r} value={r}>{r}</option>)}
                    </select>
                    <select value={areaFilter} onChange={(e) => setAreaFilter(e.target.value)}>
                      <option value="전체">동 전체</option>
                      {areaOptions.map((a) => <option key={a} value={a}>{a}</option>)}
                    </select>
                    <label className="leader-inline-check">
                      <input checked={onlyUnusedCards} onChange={(e) => setOnlyUnusedCards(e.target.checked)} type="checkbox" />
                      미배정 카드만 보기
                    </label>
                  </div>

                  {/* 카드 리스트 */}
                  <div className="leader-card-list ma-mobile-leader-card-list">
                    {filteredCards.map((card) => {
                      const selected = usedCardIds.includes(card.id)
                      return (
                        <button className={`leader-assign-card${selected ? ' used' : ''}`} key={card.id} onClick={() => applyCardToTeam(card.id)} type="button">
                          <div>
                            <strong>{card.name}</strong>
                            <span>세대 {card.units} · 진행률 {card.progress}%</span>
                          </div>
                          <b>{selected ? '사용중' : cardActionTarget ? '추가' : '선택'}</b>
                        </button>
                      )
                    })}
                    {filteredCards.length === 0 && <p className="leader-muted-message">조건에 맞는 카드가 없습니다.</p>}
                  </div>
                  <button className="leader-add-card-direct" onClick={createEmptyTeam} type="button">+ 카드 직접 추가</button>
                </article>
              </>
            )}

            {/* ━━━ STEP 2: 팀 구성 ━━━ */}
            {currentStep === 2 && (
              <article className="ma-step-panel ma-team-panel">
                <div className="ma-section-title">
                  <div>
                    <h2>2. 팀 구성</h2>
                    <span>선택 카드 {usedCardIds.length}개 · 팀 {draft?.teams.length ?? 0}개</span>
                  </div>
                  <button className="ma-mini-primary" onClick={createEmptyTeam} type="button">+ 팀 추가</button>
                </div>
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
                              <button className="ma-icon-btn" onClick={() => { const n = prompt('팀 이름 변경', team.name); if (n?.trim()) updateTeam(team.id, (t) => ({ ...t, name: n.trim() })) }} title="팀 이름 변경" type="button">
                                <svg viewBox="0 0 24 24" width="14" height="14"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" fill="none" stroke="currentColor" strokeWidth="2"/><path d="M18.5 2.5a2.12 2.12 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" fill="none" stroke="currentColor" strokeWidth="2"/></svg>
                              </button>
                            </div>
                          </div>
                          <div className="ma-team-head-actions">
                            <button className="ma-outline-btn" onClick={() => { setCardActionTarget({ teamId: team.id, mode: 'replace' }); setCurrentStep(1) }} type="button">카드 변경</button>
                            <button className="ma-outline-btn danger" onClick={() => deleteTeam(team.id)} type="button">팀 삭제</button>
                          </div>
                        </div>

                        {/* 카드 목록 */}
                        <p className="ma-team-sub">카드</p>
                        <div className="ma-team-cards-grid">
                          {teamCards.map((card) => (
                            <div className="ma-team-card-item" key={card.id}>
                              <svg viewBox="0 0 24 24" width="14" height="14" aria-hidden="true"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" fill="none" stroke="currentColor" strokeWidth="2"/><circle cx="12" cy="10" r="3" fill="none" stroke="currentColor" strokeWidth="2"/></svg>
                              <div>
                                <strong>{card.name}</strong>
                                <span>{`세대 ${card.units} · 진행률 ${card.progress}%`}</span>
                              </div>
                            </div>
                          ))}
                          <button className="ma-team-add-card" onClick={() => { setCardActionTarget({ teamId: team.id, mode: 'append' }); setCurrentStep(1) }} type="button">+ 카드 추가</button>
                        </div>

                        <p className="ma-team-sub">팀원</p>
                        <div className="ma-team-members">
                          {team.members.map((member) => (
                            <button className="ma-team-member-chip" key={member} onClick={() => removeMemberFromTeam(team.id, member)} type="button">
                              <strong>{member}</strong>
                              <span aria-hidden="true">×</span>
                            </button>
                          ))}
                          <button
                            className={`ma-team-add-member${addMemberTeamId === team.id ? ' active' : ''}`}
                            onClick={() => setAddMemberTeamId((current) => current === team.id ? null : team.id)}
                            type="button"
                          >
                            {addMemberTeamId === team.id ? '선택 닫기' : '+ 팀원 추가'}
                          </button>
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
                      </article>
                    )
                  })}
                </div>

                <button className="ma-add-team-btn" onClick={createEmptyTeam} type="button">+ 팀 추가</button>
              </article>
            )}

            {/* ━━━ STEP 3: 참가자 배정 ━━━ */}
            {currentStep === 3 && (
              <article className="ma-step-panel ma-participant-panel">
                <div className="ma-section-title">
                  <h2>3. 참가자</h2>
                </div>
                {/* 미배정 경고 */}
                {unassignedParticipants.length > 0 && (
                  <div className="ma-unassigned-warning">
                    <span className="ma-warn-icon" aria-hidden="true">
                      <svg viewBox="0 0 24 24" width="18" height="18"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" fill="#fef3c7" stroke="#d97706" strokeWidth="1.5"/><line x1="12" y1="9" x2="12" y2="13" stroke="#d97706" strokeWidth="2" strokeLinecap="round"/><line x1="12" y1="17" x2="12.01" y2="17" stroke="#d97706" strokeWidth="2" strokeLinecap="round"/></svg>
                    </span>
                    <div className="ma-warn-text">
                      <strong>미배정 인원이 있습니다.</strong>
                      <span>미배정 {unassignedParticipants.length}명: {unassignedParticipants.map((p) => p.name).join(', ')}</span>
                    </div>
                  </div>
                )}

                <p className="ma-participant-note">배정 공유 전까지는 참가자에게 보이지 않습니다.</p>

                <div className="ma-participant-list">
                  {participants.map((participant) => {
                    const assignedTeam = draft?.teams.find((team) => team.members.includes(participant.name))
                    return (
                      <button
                        className={assignedTeam ? 'assigned' : ''}
                        key={`${participant.tag}-${participant.name}`}
                        onClick={() => {
                          if (assignedTeam) {
                            setSelectedTeamId(assignedTeam.id)
                            setCurrentStep(2)
                            return
                          }
                          if (selectedTeamId) addMemberToTeam(selectedTeamId, participant.name)
                        }}
                        type="button"
                      >
                        <strong>{participant.name}</strong>
                        <span className={participant.tag === '게스트' ? 'guest' : ''}>{assignedTeam ? assignedTeam.name : participant.tag}</span>
                      </button>
                    )
                  })}
                </div>
              </article>
            )}

          </div>

          {/* ━━━ 하단 바 ━━━ */}
          <div className="ma-bottom-bar">
            {currentStep === 1 && (
              <>
                <span className="ma-bottom-info">선택된 카드 {usedCardIds.length}개</span>
                <button className="ma-next-btn" onClick={goNext} type="button">다음</button>
              </>
            )}
            {currentStep === 2 && (
              <>
                <span className="ma-bottom-info">팀 {draft?.teams.length ?? 0}개 · 카드 {usedCardIds.length}개</span>
                <button className="ma-next-btn" onClick={goNext} type="button">다음</button>
              </>
            )}
            {currentStep === 3 && (
              <>
                <button className="ma-prev-btn" onClick={goBack} type="button">이전</button>
                <button className="ma-save-btn" onClick={() => void saveAssignmentState('draft')} type="button">임시 저장</button>
                <button className="ma-next-btn" onClick={() => void saveAssignmentState('shared')} type="button">
                  {draft?.status === 'shared' ? '배정 재공유' : '배정 공유'}
                </button>
              </>
            )}
          </div>

          {/* ── 미배정 확인 모달 ── */}
          {pendingAction && (
            <div className="cal-modal-backdrop" onClick={() => setPendingAction(null)}>
              <div className="cal-modal" style={{ maxWidth: '400px' }} onClick={(e) => e.stopPropagation()}>
                <div className="cal-modal-head">
                  <div className="cal-modal-title"><h2>{pendingAction === 'shared' ? '배정 공유 확인' : '배정 확정 확인'}</h2></div>
                  <button className="cal-modal-close" onClick={() => setPendingAction(null)} type="button">✕</button>
                </div>
                <div className="cal-modal-body">
                  <div className="leader-confirm-copy">
                    <strong>미배정 인원이 남아 있습니다.</strong>
                    <p>{unassignedParticipants.map((p) => p.name).join(', ')}</p>
                    <span>{pendingAction === 'shared' ? '공유하면 배정된 참가자 카드만 공개됩니다.' : '확정 상태로만 저장되며, 참가자 앱에는 아직 공개되지 않습니다.'}</span>
                  </div>
                </div>
                <div className="cal-modal-foot">
                  <button className="cal-cancel-btn" onClick={() => setPendingAction(null)} type="button">돌아가기</button>
                  <button className="cal-save-btn" onClick={() => void continuePendingAction()} type="button">
                    {pendingAction === 'shared' ? '그래도 공유' : '그래도 확정'}
                  </button>
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </section>
  )
}
