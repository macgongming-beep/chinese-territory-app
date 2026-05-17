import { useEffect, useMemo, useState } from 'react'
import type { Building, CalendarEvent, EventInformalAssignment, EventRestaurantAssignment, InformalAsset, Role, TerritoryCard } from '../types'
import { showToast } from '../lib/toast'
import { InformalPickerModal } from './InformalPickerModal'
import { RestaurantPickerModal } from './RestaurantPickerModal'

// ── 공유 타입 ──────────────────────────────────────────────────────
type AssignmentStatus = 'draft' | 'confirmed' | 'shared'
type DraftTeam = { id: string; name: string; color: string; cardIds: number[]; members: string[] }
type AssignmentDraft = { status: AssignmentStatus; updatedAt: string | null; teams: DraftTeam[]; guests: string[] }
type ParticipantItem = { name: string; tag: '신청자' | '게스트' }
const TEAM_COLORS = ['blue', 'green', 'orange', 'purple', 'slate'] as const

function draftKey(eventId: number, visitor: string) {
  return `mobileLeaderAssignmentDraft:${eventId}:${visitor}`
}
function buildInitialDraft(event: CalendarEvent): AssignmentDraft {
  const grouped = new Map<string, { cardIds: number[]; members: string[] }>()
  event.cardAssignments.forEach((a) => {
    const cardIds = a.assignedCardIds && a.assignedCardIds.length > 0 ? a.assignedCardIds : [a.assignedCardId]
    const key = cardIds.slice().sort((x, y) => x - y).join(',')
    const cur = grouped.get(key) ?? { cardIds, members: [] }
    cur.members.push(a.userName)
    grouped.set(key, cur)
  })
  const teams = Array.from(grouped.values()).map((g, i) => ({
    id: `seed-${g.cardIds.join('-')}-${i}`, name: `팀 ${i + 1}`,
    color: TEAM_COLORS[i % TEAM_COLORS.length], cardIds: g.cardIds, members: g.members,
  }))
  return { status: 'draft', updatedAt: null, teams, guests: [] }
}

// ── PC 전용 인도자 배정 뷰 ─────────────────────────────────────────
function DesktopLeaderAssignmentView({
  cards,
  calendarEvents,
  currentVisitor,
  role,
  onAssignCardsToEventParticipantsBulk,
  buildings = [],
  informalAssets = [],
  eventInformalAssignments = [],
  eventRestaurantAssignments = [],
  onAssignInformalToUser,
  onRemoveInformalAssignment,
  onAssignRestaurantToUser,
  onRemoveRestaurantAssignment,
  onToggleBuildingRestaurant,
}: {
  buildings?: Building[]
  cards: TerritoryCard[]
  calendarEvents: CalendarEvent[]
  currentVisitor: string
  role: Role
  onAssignCardsToEventParticipantsBulk: (eventId: number, assignments: Array<{ userName: string; cardId?: number | null; cardIds?: number[] | null }>, options?: { silentSuccess?: boolean }) => Promise<void> | void
  informalAssets?: InformalAsset[]
  eventInformalAssignments?: EventInformalAssignment[]
  eventRestaurantAssignments?: EventRestaurantAssignment[]
  onAssignInformalToUser?: (input: { eventId: number; userName: string; assetId: number; assignedBy: string }) => Promise<boolean>
  onRemoveInformalAssignment?: (assignmentId: number) => Promise<void>
  onAssignRestaurantToUser?: (input: { eventId: number; userName: string; buildingId: number; assignedBy: string }) => Promise<boolean>
  onRemoveRestaurantAssignment?: (assignmentId: number) => Promise<void>
  onToggleBuildingRestaurant?: (buildingId: number, isRestaurant: boolean) => Promise<void>
}) {
  const today = new Date().toISOString().slice(0, 10)

  // 접근 가능한 카드
  const accessibleCards = useMemo(() =>
    role === 'admin' ? cards : cards.filter((c) => {
      const ls = c.assignedLeaders && c.assignedLeaders.length > 0 ? c.assignedLeaders : c.assignedLeader ? [c.assignedLeader] : []
      return ls.includes(currentVisitor)
    }), [cards, currentVisitor, role])

  // 오늘 일정
  const todayEvents = useMemo(() => {
    const all = calendarEvents.filter((e) => e.date === today)
    const own = all.filter((e) => e.leader === currentVisitor)
    return own.length > 0 ? own : all
  }, [calendarEvents, currentVisitor, today])

  const [selectedEventId, setSelectedEventId] = useState<number>(todayEvents[0]?.id ?? 0)
  const [draft, setDraft] = useState<AssignmentDraft | null>(null)
  const [pendingAction, setPendingAction] = useState<'confirmed' | 'shared' | null>(null)
  const [saving, setSaving] = useState(false)
  const [addGuestInput, setAddGuestInput] = useState('')
  const [selectedParticipants, setSelectedParticipants] = useState<Set<string>>(new Set())
  // 카드 추가 모드: 어느 팀에 추가할지 (null이면 새 팀 생성 모드)
  const [addCardToTeamId, setAddCardToTeamId] = useState<string | null>(null)
  const [addMemberTeamId, setAddMemberTeamId] = useState<string | null>(null)
  const [informalPickerTeamId, setInformalPickerTeamId] = useState<string | null>(null)
  const [restaurantPickerTeamId, setRestaurantPickerTeamId] = useState<string | null>(null)

  // 카드 필터
  const [cardQuery, setCardQuery] = useState('')
  const [regionFilter, setRegionFilter] = useState('전체')
  const [areaFilter, setAreaFilter] = useState('전체')
  const [onlyUnused, setOnlyUnused] = useState(true)

  useEffect(() => {
    if (!todayEvents.length) { setSelectedEventId(0); return }
    if (!todayEvents.some((e) => e.id === selectedEventId)) setSelectedEventId(todayEvents[0].id)
  }, [selectedEventId, todayEvents])

  const selectedEvent = todayEvents.find((e) => e.id === selectedEventId) ?? null

  useEffect(() => {
    if (!selectedEvent) { setDraft(null); return }
    const stored = window.localStorage.getItem(draftKey(selectedEvent.id, currentVisitor))
    if (stored) { try { setDraft(JSON.parse(stored) as AssignmentDraft); return } catch { window.localStorage.removeItem(draftKey(selectedEvent.id, currentVisitor)) } }
    setDraft(buildInitialDraft(selectedEvent))
  }, [currentVisitor, selectedEvent])

  const participants = useMemo<ParticipantItem[]>(() => {
    if (!selectedEvent || !draft) return []
    const base = Array.from(new Set([...selectedEvent.applicants, ...selectedEvent.assigned])).map((name) => ({ name, tag: '신청자' as const }))
    return [...base, ...draft.guests.map((name) => ({ name, tag: '게스트' as const }))]
  }, [draft, selectedEvent])

  const usedCardIds = useMemo(() => Array.from(new Set((draft?.teams ?? []).flatMap((t) => t.cardIds))), [draft?.teams])

  const areaOptions = useMemo(() => Array.from(new Set(accessibleCards.map((c) => c.area))).sort((a, b) => a.localeCompare(b, 'ko')), [accessibleCards])

  const filteredCards = useMemo(() => {
    const q = cardQuery.trim().toLowerCase()
    return accessibleCards.filter((c) => {
      if (regionFilter !== '전체' && c.region !== regionFilter) return false
      if (areaFilter !== '전체' && c.area !== areaFilter) return false
      if (onlyUnused && usedCardIds.includes(c.id)) return false
      if (!q) return true
      return `${c.name} ${c.region} ${c.area}`.toLowerCase().includes(q)
    })
  }, [accessibleCards, areaFilter, cardQuery, onlyUnused, regionFilter, usedCardIds])

  const unassigned = useMemo(() => participants.filter((p) => !(draft?.teams ?? []).some((t) => t.members.includes(p.name))), [draft?.teams, participants])

  // ── 헬퍼 ──
  const persistDraft = (next: AssignmentDraft, nextStatus?: AssignmentStatus) => {
    if (!selectedEvent) return null
    const payload = { ...next, status: nextStatus ?? next.status, updatedAt: new Date().toISOString() }
    setDraft(payload)
    window.localStorage.setItem(draftKey(selectedEvent.id, currentVisitor), JSON.stringify(payload))
    return payload
  }

  const addCardToTeam = (cardId: number) => {
    if (!draft) return
    if (draft.teams.some((t) => t.cardIds.includes(cardId))) return

    if (addCardToTeamId) {
      // "+ 카드 추가" 버튼으로 지정된 팀에 추가
      const nextTeams = draft.teams.map((t) =>
        t.id === addCardToTeamId ? { ...t, cardIds: [...t.cardIds, cardId] } : t
      )
      persistDraft({ ...draft, teams: nextTeams })
      setAddCardToTeamId(null)  // 모드 해제
    } else {
      // 카드 클릭 → 새 팀 생성
      const newTeam: DraftTeam = {
        id: `team-${Date.now()}-${cardId}`,
        name: `팀 ${draft.teams.length + 1}`,
        color: TEAM_COLORS[draft.teams.length % TEAM_COLORS.length],
        cardIds: [cardId], members: [],
      }
      persistDraft({ ...draft, teams: [...draft.teams, newTeam] })
    }
  }

  const removeCardFromTeam = (teamId: string, cardId: number) => {
    if (!draft) return
    const nextTeams = draft.teams.map((t) => t.id !== teamId ? t : { ...t, cardIds: t.cardIds.filter((id) => id !== cardId) })
    persistDraft({ ...draft, teams: nextTeams })
  }

  const createEmptyTeam = () => {
    if (!draft) return
    const newTeam: DraftTeam = {
      id: `team-${Date.now()}`,
      name: `팀 ${draft.teams.length + 1}`,
      color: TEAM_COLORS[draft.teams.length % TEAM_COLORS.length],
      cardIds: [], members: [],
    }
    persistDraft({ ...draft, teams: [...draft.teams, newTeam] })
  }

  const deleteTeam = (teamId: string) => {
    if (!draft) return
    persistDraft({ ...draft, teams: draft.teams.filter((t) => t.id !== teamId) })
  }

  const toggleMember = (teamId: string, name: string) => {
    if (!draft) return
    const alreadyIn = draft.teams.find((t) => t.id === teamId)?.members.includes(name)
    const nextTeams = draft.teams.map((t) => {
      const filtered = t.members.filter((m) => m !== name)
      if (t.id !== teamId) return { ...t, members: filtered }
      return { ...t, members: alreadyIn ? filtered : [...filtered, name] }
    })
    persistDraft({ ...draft, teams: nextTeams })
  }

  const addGuest = () => {
    const name = addGuestInput.trim()
    if (!name || !draft) return
    if (participants.some((p) => p.name === name)) { showToast('이미 있는 이름입니다.', 'info'); return }
    persistDraft({ ...draft, guests: [...draft.guests, name] })
    setAddGuestInput('')
  }

  const toggleParticipantSelect = (name: string) => {
    setSelectedParticipants((prev) => {
      const next = new Set(prev)
      next.has(name) ? next.delete(name) : next.add(name)
      return next
    })
  }

  const assignSelectedToTeam = (teamId: string) => {
    if (!draft || selectedParticipants.size === 0) return
    const names = Array.from(selectedParticipants)
    const nextTeams = draft.teams.map((t) => {
      // Remove from all other teams first
      const filtered = t.members.filter((m) => !names.includes(m))
      if (t.id !== teamId) return { ...t, members: filtered }
      // Add to target team (deduplicate)
      const combined = Array.from(new Set([...filtered, ...names]))
      return { ...t, members: combined }
    })
    persistDraft({ ...draft, teams: nextTeams })
    setSelectedParticipants(new Set())
  }

  const persistShared = async (d: AssignmentDraft) => {
    if (!selectedEvent) return
    const realParticipants = participants.filter((p) => p.tag !== '게스트')
    const assignments = realParticipants.map((p) => {
      const team = d.teams.find((t) => t.members.includes(p.name))
      return { userName: p.name, cardId: team?.cardIds[0] ?? null, cardIds: team?.cardIds ?? [] }
    })
    await Promise.resolve(onAssignCardsToEventParticipantsBulk(selectedEvent.id, assignments, { silentSuccess: true }))
  }

  const saveStatus = async (status: AssignmentStatus) => {
    if (!draft || !selectedEvent) return
    if ((status === 'confirmed' || status === 'shared') && unassigned.length > 0) { setPendingAction(status); return }
    setSaving(true)
    const next = persistDraft(draft, status)
    if (!next) { setSaving(false); return }
    if (status === 'shared') { await persistShared(next); showToast('배정이 공유되었습니다.', 'success') }
    else if (status === 'confirmed') { await persistShared(next); showToast('배정이 확정되었습니다.', 'success') }
    else showToast('임시 저장되었습니다.')
    setSaving(false)
  }

  const continuePending = async () => {
    if (!pendingAction || !draft) return
    const action = pendingAction; setPendingAction(null); setSaving(true)
    const next = persistDraft(draft, action)
    if (!next) { setSaving(false); return }
    if (action === 'shared') { await persistShared(next); showToast('배정이 공유되었습니다.', 'success') }
    else { await persistShared(next); showToast('배정이 확정되었습니다.', 'success') }
    setSaving(false)
  }

  const draftStatus = draft?.status ?? 'draft'
  const statusLabel = draftStatus === 'shared' ? '공유됨' : draftStatus === 'confirmed' ? '확정됨' : '임시 저장'
  const shareButtonLabel = draftStatus === 'shared' ? '배정 재공유' : '배정 공유'
  const getEventSummary = (event: CalendarEvent) => {
    let eventDraft = event.id === selectedEvent?.id && draft ? draft : buildInitialDraft(event)
    if (event.id !== selectedEvent?.id) {
      const stored = window.localStorage.getItem(draftKey(event.id, currentVisitor))
      if (stored) {
        try {
          eventDraft = JSON.parse(stored) as AssignmentDraft
        } catch {
          eventDraft = buildInitialDraft(event)
        }
      }
    }
    const eventParticipants = [
      ...Array.from(new Set([...event.applicants, ...event.assigned])),
      ...eventDraft.guests,
    ]
    const assignedNames = new Set(eventDraft.teams.flatMap((team) => team.members))
    return {
      participants: eventParticipants.length,
      teams: eventDraft.teams.length,
      cards: Array.from(new Set(eventDraft.teams.flatMap((team) => team.cardIds))).length,
      unassigned: eventParticipants.filter((name) => !assignedNames.has(name)).length,
    }
  }

  return (
    <section className="dla-page">
      {/* ── 헤더 ── */}
      <div className="dla-header">
        <div className="dla-header-left">
          <div>
            <h1>인도자 배정</h1>
            <p>팀 구성 & 카드 배정</p>
          </div>
          <div className="dla-event-select-wrap">
            <div className="dla-event-picker">
              <label className="dla-event-label">오늘 봉사</label>
              {todayEvents.length === 0 ? (
                <span className="dla-no-event">오늘 일정 없음</span>
              ) : (
                <select
                  className="dla-event-select"
                  value={selectedEventId}
                  onChange={(e) => setSelectedEventId(Number(e.target.value))}
                >
                  {todayEvents.map((event) => (
                    <option key={event.id} value={event.id}>{event.time} {event.title} ({event.place})</option>
                  ))}
                </select>
              )}
            </div>
            {selectedEvent && (
              <div className="dla-selected-event-card">
                <div>
                  <strong>{today} {selectedEvent.title}</strong>
                  <span>{selectedEvent.time}</span>
                </div>
                <small>
                  {(() => {
                    const summary = getEventSummary(selectedEvent)
                    return `참가자 ${summary.participants}명 · 팀 ${summary.teams}개 · 배정 카드 ${summary.cards}개 · 미배정 ${summary.unassigned}명`
                  })()}
                </small>
              </div>
            )}
          </div>
        </div>
        <div className="dla-header-right">
          {draft && <span className={`dla-status-badge ${draftStatus}`}>{statusLabel}</span>}
          {unassigned.length > 0 && <span className="dla-badge-red">미배정 {unassigned.length}명</span>}
          <button className="dla-btn-ghost" disabled={saving || !selectedEvent} onClick={() => void saveStatus('draft')} type="button">임시 저장</button>
          <button className="dla-btn-primary" disabled={saving || !selectedEvent} onClick={() => void saveStatus('shared')} type="button">{shareButtonLabel}</button>
        </div>
      </div>

      {/* ── 3컬럼 본문 ── */}
      {!selectedEvent ? (
        <div className="dla-empty-state"><p>오늘 봉사 일정이 없습니다.<br />캘린더에서 일정을 추가하세요.</p></div>
      ) : (
        <div className="dla-grid">

          {/* ── 컬럼 1: 카드 선택 ── */}
          <div className="dla-col dla-col-cards">
            <div className="dla-col-head">
              <h2>카드 선택</h2>
              <span className="dla-col-sub">클릭하면 새 팀으로 추가</span>
            </div>
            <div className="dla-card-filters">
              <input className="dla-search" placeholder="카드 검색" value={cardQuery} onChange={(e) => setCardQuery(e.target.value)} />
              <select className="dla-filter-sel" value={regionFilter} onChange={(e) => setRegionFilter(e.target.value)}>
                <option value="전체">지역 전체</option>
                {Array.from(new Set(accessibleCards.map((c) => c.region))).map((r) => <option key={r} value={r}>{r}</option>)}
              </select>
              <select className="dla-filter-sel" value={areaFilter} onChange={(e) => setAreaFilter(e.target.value)}>
                <option value="전체">동 전체</option>
                {areaOptions.map((a) => <option key={a} value={a}>{a}</option>)}
              </select>
              <label className="dla-check-label">
                <input type="checkbox" checked={onlyUnused} onChange={(e) => setOnlyUnused(e.target.checked)} />
                미사용만
              </label>
            </div>
            {/* 카드 추가 모드일 때 col1 헤더 안내 */}
            {addCardToTeamId && (
              <div className="dla-col1-pick-mode">
                카드를 클릭해서 팀에 추가하세요
              </div>
            )}
            <div className="dla-card-list">
              {filteredCards.map((card) => {
                const used = usedCardIds.includes(card.id)
                const team = draft?.teams.find((t) => t.cardIds.includes(card.id))
                const pickMode = !!addCardToTeamId
                return (
                  <button
                    key={card.id}
                    className={`dla-card-item ${used && !pickMode ? 'used' : ''} ${pickMode && !used ? 'pick-mode' : ''}`}
                    onClick={() => addCardToTeam(card.id)}
                    type="button"
                    disabled={used && !pickMode}
                  >
                    <div className="dla-card-item-info">
                      <strong>{card.name}</strong>
                      <span>{card.region} · {card.area} · 세대 {card.units}</span>
                    </div>
                    {used && !pickMode ? (
                      <span className={`dla-card-badge used-team tone-${team?.color ?? 'slate'}`}>
                        <span className={`dla-team-dot tone-${team?.color ?? 'slate'}`} />
                        {team?.name ?? '사용중'}
                      </span>
                    ) : (
                      <span className={`dla-card-badge ${pickMode ? 'pick' : ''}`}>
                        {pickMode ? '선택' : '추가'}
                      </span>
                    )}
                  </button>
                )
              })}
              {filteredCards.length === 0 && <p className="dla-empty-msg">조건에 맞는 카드가 없습니다</p>}
            </div>
          </div>

          {/* ── 컬럼 2: 팀 구성 ── */}
          <div className="dla-col dla-col-teams">
            <div className="dla-col-head dla-col-head-team">
              <div>
                <h2>팀 구성</h2>
                <p className="dla-col-subtitle">선택 카드 {usedCardIds.length}개 · 팀 {draft?.teams.length ?? 0}개</p>
              </div>
              <button className="dla-add-team-inline-btn" onClick={createEmptyTeam} type="button">+ 팀 추가</button>
            </div>

            {/* 참가자 선택 힌트 바 */}
            {/* 카드 추가 모드 안내 — "+ 카드 추가" 클릭 시에만 표시 */}
            {addCardToTeamId && (
              <div className="dla-card-pick-hint">
                왼쪽 카드 목록에서 카드를 선택하면 이 팀에 카드가 추가됩니다.
                <button
                  className="dla-card-pick-cancel"
                  onClick={() => setAddCardToTeamId(null)}
                  type="button"
                >
                  취소
                </button>
              </div>
            )}

            {/* 참가자 선택 힌트 바 */}
            {selectedParticipants.size > 0 && (
              <div className="dla-hint-bar">
                <div className="dla-hint-top">
                  <span className="dla-hint-names">
                    <strong>{selectedParticipants.size}명 선택:</strong> {Array.from(selectedParticipants).join(', ')}
                  </span>
                  <button className="dla-hint-clear" onClick={() => setSelectedParticipants(new Set())} type="button">
                    선택 해제
                  </button>
                </div>
                <span className="dla-hint-tip">아래 팀 카드의 배정 버튼을 눌러 배정하세요</span>
              </div>
            )}

            <div className="dla-team-list">
              {(draft?.teams ?? []).length === 0 && (
                <div className="dla-empty-panel"><p>왼쪽에서 카드를 클릭하면<br />팀이 자동으로 생성됩니다</p></div>
              )}
              {(draft?.teams ?? []).map((team) => {
                const teamCards = team.cardIds.map((id) => cards.find((c) => c.id === id)).filter(Boolean) as TerritoryCard[]
                const canAssign = selectedParticipants.size > 0
                return (
                  <div key={team.id} className={`dla-team-card tone-${team.color} ${canAssign ? 'assignable' : ''}`}>

                    {/* ── 팀 헤더 ── */}
                    <div className="dla-team-head">
                      <div className="dla-team-head-left">
                        <strong
                          className="dla-team-name"
                          contentEditable
                          suppressContentEditableWarning
                          onBlur={(e) => {
                            const n = e.currentTarget.textContent?.trim()
                            if (n && n !== team.name && draft) persistDraft({ ...draft, teams: draft.teams.map((t) => t.id === team.id ? { ...t, name: n } : t) })
                          }}
                        >
                          {team.name}
                        </strong>
                        <span className="dla-team-subtitle">팀원 {team.members.length}명</span>
                      </div>
                      <div className="dla-team-actions">
                        <button
                          className={`dla-team-action-btn ${addCardToTeamId === team.id ? 'active' : ''}`}
                          type="button"
                          onClick={() => setAddCardToTeamId(addCardToTeamId === team.id ? null : team.id)}
                        >
                          {addCardToTeamId === team.id ? '취소' : '카드 변경'}
                        </button>
                        <button className="dla-team-action-btn danger" onClick={() => deleteTeam(team.id)} type="button">
                          팀 삭제
                        </button>
                      </div>
                    </div>

                    {/* ── 카드 섹션 ── */}
                    <div className="dla-team-section">
                      <span className="dla-team-section-label">카드</span>
                      <div className="dla-team-card-tiles">
                        {teamCards.map((c) => (
                          <div key={c.id} className="dla-team-card-tile">
                            <div className="dla-team-card-tile-info">
                              <strong>{c.name}</strong>
                              <span>세대 {c.units} · 진행률 {c.progress}%</span>
                            </div>
                            <button className="dla-tile-remove" onClick={() => removeCardFromTeam(team.id, c.id)} type="button">×</button>
                          </div>
                        ))}
                        <button
                          className={`dla-add-card-tile ${addCardToTeamId === team.id ? 'active' : ''}`}
                          type="button"
                          onClick={() => setAddCardToTeamId(addCardToTeamId === team.id ? null : team.id)}
                        >
                          {addCardToTeamId === team.id ? '← 카드 선택 중...' : '+ 카드 추가'}
                        </button>
                      </div>
                    </div>

                    {/* ── 팀원 섹션 ── */}
                    <div className="dla-team-section">
                      <span className="dla-team-section-label">팀원</span>
                      <div className="dla-team-members">
                        {team.members.map((m) => (
                          <button key={m} className="dla-member-chip" onClick={() => toggleMember(team.id, m)} type="button">
                            {m} <span>×</span>
                          </button>
                        ))}
                        <button
                          className={`dla-add-member-btn ${addMemberTeamId === team.id ? 'active' : ''}`}
                          type="button"
                          onClick={() => {
                            if (unassigned.length === 0 && addMemberTeamId !== team.id) {
                              showToast('미배정 참가자가 없습니다.', 'info')
                              return
                            }
                            setAddMemberTeamId((current) => current === team.id ? null : team.id)
                          }}
                        >
                          {addMemberTeamId === team.id ? '선택 닫기' : '+ 팀원 추가'}
                        </button>
                      </div>
                      {addMemberTeamId === team.id && (
                        <div className="dla-inline-member-picker">
                          <div className="dla-inline-member-head">
                            <strong>참여자 선택</strong>
                          </div>
                          {unassigned.length === 0 ? (
                            <p>추가할 미배정 참여자가 없습니다.</p>
                          ) : (
                            <div className="dla-inline-member-list">
                              {unassigned.map((participant) => (
                                <button
                                  key={participant.name}
                                  onClick={() => toggleMember(team.id, participant.name)}
                                  type="button"
                                >
                                  <span className="dla-inline-avatar" aria-hidden="true">{participant.name.slice(0, 1)}</span>
                                  <strong>{participant.name}</strong>
                                  <em>{participant.tag}</em>
                                </button>
                              ))}
                            </div>
                          )}
                        </div>
                      )}
                    </div>

                    {/* ── v2: 비공식 증거 카드 ── */}
                    {selectedEvent && onAssignInformalToUser && (
                      <div className="dla-team-section">
                        <span className="dla-team-section-label">비공식 증거 카드</span>
                        <div className="dla-team-card-tiles">
                          {(() => {
                            const teamMemberSet = new Set(team.members)
                            const items = eventInformalAssignments.filter(
                              (assignment) => assignment.eventId === selectedEvent.id && teamMemberSet.has(assignment.userName),
                            )
                            const uniqueAssetIds = Array.from(new Set(items.map((item) => item.assetId)))
                            return uniqueAssetIds.map((assetId) => {
                              const asset = informalAssets.find((entry) => entry.id === assetId)
                              if (!asset) return null
                              const ids = items.filter((item) => item.assetId === assetId).map((item) => item.id)
                              return (
                                <div key={`informal-${assetId}`} className="dla-team-card-tile">
                                  <div className="dla-team-card-tile-info">
                                    <strong>{asset.name}</strong>
                                    <span>비공식 · {ids.length}명</span>
                                  </div>
                                  <button
                                    className="dla-tile-remove"
                                    onClick={async () => {
                                      if (!onRemoveInformalAssignment) return
                                      for (const id of ids) await onRemoveInformalAssignment(id)
                                    }}
                                    type="button"
                                  >
                                    ×
                                  </button>
                                </div>
                              )
                            })
                          })()}
                          <button
                            className="dla-add-card-tile"
                            onClick={() => {
                              if (team.members.length === 0) {
                                showToast('먼저 팀원을 추가해 주세요.', 'info')
                                return
                              }
                              setInformalPickerTeamId(team.id)
                            }}
                            type="button"
                          >
                            + 비공식 추가
                          </button>
                        </div>
                      </div>
                    )}

                    {/* ── v2: 식당 봉사 ── */}
                    {selectedEvent && onAssignRestaurantToUser && (
                      <div className="dla-team-section">
                        <span className="dla-team-section-label">식당 봉사</span>
                        <div className="dla-team-card-tiles">
                          {(() => {
                            const teamMemberSet = new Set(team.members)
                            const items = eventRestaurantAssignments.filter(
                              (assignment) => assignment.eventId === selectedEvent.id && teamMemberSet.has(assignment.userName),
                            )
                            const uniqueBuildingIds = Array.from(new Set(items.map((item) => item.buildingId)))
                            return uniqueBuildingIds.map((buildingId) => {
                              const building = buildings.find((entry) => entry.id === buildingId)
                              if (!building) return null
                              const ids = items.filter((item) => item.buildingId === buildingId).map((item) => item.id)
                              return (
                                <div key={`restaurant-${buildingId}`} className="dla-team-card-tile">
                                  <div className="dla-team-card-tile-info">
                                    <strong>{building.name || building.address}</strong>
                                    <span>식당 · {ids.length}명</span>
                                  </div>
                                  <button
                                    className="dla-tile-remove"
                                    onClick={async () => {
                                      if (!onRemoveRestaurantAssignment) return
                                      for (const id of ids) await onRemoveRestaurantAssignment(id)
                                    }}
                                    type="button"
                                  >
                                    ×
                                  </button>
                                </div>
                              )
                            })
                          })()}
                          <button
                            className="dla-add-card-tile"
                            onClick={() => {
                              if (team.members.length === 0) {
                                showToast('먼저 팀원을 추가해 주세요.', 'info')
                                return
                              }
                              setRestaurantPickerTeamId(team.id)
                            }}
                            type="button"
                          >
                            + 식당 추가
                          </button>
                        </div>
                      </div>
                    )}

                    {/* ── 선택 참가자 배정 버튼 ── */}
                    {canAssign && (
                      <button className="dla-assign-zone" onClick={() => assignSelectedToTeam(team.id)} type="button">
                        이 팀에 {selectedParticipants.size}명 배정하기
                      </button>
                    )}
                  </div>
                )
              })}
            </div>
          </div>

          {/* ── 컬럼 3: 참가자 ── */}
          <div className="dla-col dla-col-participants">
            <div className="dla-col-head dla-col-head-participant">
              <h2>참가자</h2>
              <button className="dla-col-more-btn" type="button" title="더보기">···</button>
            </div>

            {/* 미배정 / 완료 상태 바 */}
            {unassigned.length > 0 ? (
              <div className="dla-unassigned-bar">
                <strong>미배정 인원이 있습니다.</strong>
                <span>미배정 {unassigned.length}명: {unassigned.map((p) => p.name).join(', ')}</span>
              </div>
            ) : participants.length > 0 ? (
              <div className="dla-all-assigned-bar">✓ 전원 배정 완료</div>
            ) : null}

            {/* 안내 텍스트 */}
            <p className="dla-participant-info">배정 공유 전까지는 참가자에게 보이지 않습니다.</p>

            {/* 참가자 목록 */}
            <div className="dla-participant-list">
              {participants.length === 0 && (
                <div className="dla-empty-panel"><p>신청자가 없습니다</p></div>
              )}
              {participants.map((p) => {
                const team = (draft?.teams ?? []).find((t) => t.members.includes(p.name))
                const isSelected = selectedParticipants.has(p.name)
                return (
                  <div
                    key={`${p.tag}-${p.name}`}
                    className={`dla-participant-row ${team ? 'assigned' : ''} ${isSelected ? 'selected' : ''}`}
                    onClick={() => toggleParticipantSelect(p.name)}
                  >
                    <span className="dla-p-name">{p.name}</span>
                    {isSelected ? (
                      <span className="dla-p-check">✓</span>
                    ) : team ? (
                      <span className={`dla-p-team-badge tone-${team.color}`}>{team.name}</span>
                    ) : (
                      <span className="dla-p-tag">{p.tag}</span>
                    )}
                  </div>
                )
              })}
            </div>

            {/* 게스트 추가 */}
            <div className="dla-guest-add">
              <input
                className="dla-guest-input"
                placeholder="게스트 이름 추가"
                value={addGuestInput}
                onChange={(e) => setAddGuestInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && addGuest()}
              />
              <button className="dla-guest-btn" onClick={addGuest} type="button">추가</button>
            </div>
          </div>

        </div>
      )}

      {/* ── 미배정 확인 모달 ── */}
      {pendingAction && (
        <div className="cal-modal-backdrop" onClick={() => setPendingAction(null)}>
          <div className="cal-modal" style={{ maxWidth: 400 }} onClick={(e) => e.stopPropagation()}>
            <div className="cal-modal-head">
              <div className="cal-modal-title"><h2>배정 공유 확인</h2></div>
              <button className="cal-modal-close" onClick={() => setPendingAction(null)} type="button">✕</button>
            </div>
            <div className="cal-modal-body" style={{ padding: '20px 24px' }}>
              <p style={{ margin: 0, fontSize: 14 }}><strong>미배정 인원이 남아 있습니다.</strong></p>
              <p style={{ margin: '8px 0 0', fontSize: 13, color: 'var(--ink-500)' }}>{unassigned.map((p) => p.name).join(', ')}</p>
            </div>
            <div className="cal-modal-foot">
              <button className="cal-cancel-btn" onClick={() => setPendingAction(null)} type="button">돌아가기</button>
              <button className="cal-save-btn" onClick={() => void continuePending()} type="button">
                그래도 공유
              </button>
            </div>
          </div>
        </div>
      )}

      <InformalPickerModal
        open={informalPickerTeamId !== null}
        assets={informalAssets}
        alreadyAssignedIds={(() => {
          if (!informalPickerTeamId || !selectedEvent) return new Set<number>()
          const team = draft?.teams.find((entry) => entry.id === informalPickerTeamId)
          if (!team) return new Set<number>()
          const memberSet = new Set(team.members)
          return new Set(eventInformalAssignments
            .filter((assignment) => assignment.eventId === selectedEvent.id && memberSet.has(assignment.userName))
            .map((assignment) => assignment.assetId))
        })()}
        onSelect={async (assetId) => {
          if (!informalPickerTeamId || !selectedEvent || !onAssignInformalToUser) return
          const team = draft?.teams.find((entry) => entry.id === informalPickerTeamId)
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
          if (okCount > 0) showToast(`${okCount}명에게 비공식 자료를 배정했습니다.`, 'success')
          setInformalPickerTeamId(null)
        }}
        onClose={() => setInformalPickerTeamId(null)}
      />

      <RestaurantPickerModal
        open={restaurantPickerTeamId !== null}
        role={role}
        buildings={buildings}
        alreadyAssignedIds={(() => {
          if (!restaurantPickerTeamId || !selectedEvent) return new Set<number>()
          const team = draft?.teams.find((entry) => entry.id === restaurantPickerTeamId)
          if (!team) return new Set<number>()
          const memberSet = new Set(team.members)
          return new Set(eventRestaurantAssignments
            .filter((assignment) => assignment.eventId === selectedEvent.id && memberSet.has(assignment.userName))
            .map((assignment) => assignment.buildingId))
        })()}
        onSelect={async (buildingId) => {
          if (!restaurantPickerTeamId || !selectedEvent || !onAssignRestaurantToUser) return
          const team = draft?.teams.find((entry) => entry.id === restaurantPickerTeamId)
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
          if (okCount > 0) showToast(`${okCount}명에게 식당을 배정했습니다.`, 'success')
          setRestaurantPickerTeamId(null)
        }}
        onToggleRestaurantFlag={onToggleBuildingRestaurant}
        onClose={() => setRestaurantPickerTeamId(null)}
      />
    </section>
  )
}

// ── 배정 현황 모달 ────────────────────────────────────────────────
function AssignmentStatusModal({
  leaders,
  cards,
  getCardLeader,
  onClose,
}: {
  leaders: string[]
  cards: TerritoryCard[]
  getCardLeader: (card: TerritoryCard) => string[]
  onClose: () => void
}) {
  const [search, setSearch] = useState('')
  const [sort, setSort] = useState<'name' | 'count'>('name')
  const [expandedLeader, setExpandedLeader] = useState<string | null>(null)

  const leaderStats = useMemo(() => {
    return leaders.map((leader) => {
      const leaderCards = cards.filter((c) => getCardLeader(c).includes(leader))
      return { leader, cards: leaderCards }
    })
  }, [leaders, cards, getCardLeader])

  const filtered = useMemo(() => {
    const q = search.trim()
    const list = q ? leaderStats.filter((s) => s.leader.includes(q)) : leaderStats
    return [...list].sort((a, b) =>
      sort === 'name'
        ? a.leader.localeCompare(b.leader, 'ko')
        : b.cards.length - a.cards.length
    )
  }, [leaderStats, search, sort])

  const totalLeaders = leaders.length
  const withCards = leaderStats.filter((s) => s.cards.length > 0).length
  const totalCards = leaderStats.reduce((sum, s) => sum + s.cards.length, 0)

  const today = new Date().toLocaleDateString('ko-KR', { year: 'numeric', month: '2-digit', day: '2-digit' }).replace(/\. /g, '.').replace(/\.$/, '')

  return (
    <div className="cal-modal-backdrop" onClick={onClose}>
      <div className="cal-modal lam-status-modal" onClick={(e) => e.stopPropagation()}>
        {/* 헤더 */}
        <div className="cal-modal-head">
          <div className="cal-modal-title">
            <h2>배정 현황 보기</h2>
          </div>
          <button className="cal-modal-close" onClick={onClose} type="button">✕</button>
        </div>

        <div className="cal-modal-body lam-status-body">
          <p className="lam-status-sub">인도자별 담당 구역 현황을 확인할 수 있습니다.</p>

          {/* 요약 카드 3개 */}
          <div className="lam-stat-row">
            <div className="lam-stat-card">
              <strong>{totalLeaders}명</strong>
              <span>전체 인도자</span>
            </div>
            <div className="lam-stat-card">
              <strong>{withCards}명</strong>
              <span>담당 구역 보유 인도자</span>
            </div>
            <div className="lam-stat-card">
              <strong>{totalCards}개</strong>
              <span>전체 담당 구역</span>
            </div>
          </div>

          {/* 검색 + 정렬 */}
          <div className="lam-status-toolbar">
            <div className="la-search-wrap" style={{ padding: 0, flex: 1 }}>
              <input className="la-search" placeholder="인도자 검색" value={search} onChange={(e) => setSearch(e.target.value)} />
              <span className="la-search-icon">🔍</span>
            </div>
            <select className="la-filter-select" value={sort} onChange={(e) => setSort(e.target.value as 'name' | 'count')}>
              <option value="name">정렬: 인도자 이름순</option>
              <option value="count">정렬: 담당 구역 많은순</option>
            </select>
          </div>

          {/* 테이블 */}
          <div className="lam-status-table">
            <div className="lam-table-head">
              <span>인도자</span>
              <span>담당 구역 수</span>
              <span>담당 구역 목록</span>
              <span>최근 변경일</span>
            </div>
            <div className="lam-table-body">
            {filtered.map(({ leader, cards: lCards }) => {
              const isExpanded = expandedLeader === leader
              const shown = isExpanded ? lCards : lCards.slice(0, 3)
              const extra = lCards.length - 3
              return (
                <div className="lam-table-row" key={leader}>
                  <div className="lam-leader-cell">
                    <span className="la-leader-avatar">{leader.slice(0, 1)}</span>
                    <span>{leader}</span>
                  </div>
                  <span className={`lam-count ${lCards.length === 0 ? 'zero' : ''}`}>
                    {lCards.length}개
                  </span>
                  <div className="lam-cards-cell">
                    {lCards.length === 0 ? (
                      <span className="lam-no-card">담당 구역 없음</span>
                    ) : (
                      <>
                        {shown.map((c) => (
                          <span className="lam-card-tag" key={c.id}>{c.name}</span>
                        ))}
                        {!isExpanded && extra > 0 && (
                          <button className="lam-more-btn" onClick={() => setExpandedLeader(leader)} type="button">+{extra}</button>
                        )}
                        {isExpanded && (
                          <button className="lam-more-btn" onClick={() => setExpandedLeader(null)} type="button">접기</button>
                        )}
                      </>
                    )}
                  </div>
                  <span className="lam-date">{lCards.length > 0 ? today : '-'}</span>
                </div>
              )
            })}
            </div>
          </div>

          {/* 안내 */}
          <div className="lam-info-box">
            <span>💡 안내</span>
            <ul>
              <li>담당 구역 목록은 최대 3개까지 표시되며, +숫자를 클릭하면 전체 목록을 확인할 수 있습니다.</li>
              <li>최근 변경일은 오늘 날짜 기준으로 표시됩니다.</li>
            </ul>
          </div>
        </div>

        <div className="cal-modal-foot" style={{ justifyContent: 'flex-end' }}>
          <button className="cal-cancel-btn" onClick={onClose} type="button">닫기</button>
        </div>
      </div>
    </div>
  )
}

export function DesktopLeaderAssignment({
  cards,
  calendarEvents,
  currentVisitor,
  role,
  leaderNames = [],
  onSetCardLeaders,
  onSetMultipleCardLeaders: _onSetMultipleCardLeaders,
  onAssignCardsToEventParticipantsBulk,
  buildings = [],
  informalAssets = [],
  eventInformalAssignments = [],
  eventRestaurantAssignments = [],
  onAssignInformalToUser,
  onRemoveInformalAssignment,
  onAssignRestaurantToUser,
  onRemoveRestaurantAssignment,
  onToggleBuildingRestaurant,
}: {
  buildings?: Building[]
  cards: TerritoryCard[]
  calendarEvents: CalendarEvent[]
  currentVisitor: string
  role: Role
  leaderNames?: string[]
  onSetCardLeaders: (cardId: number, leaders: string[], options?: { silentSuccess?: boolean }) => Promise<void> | void
  onSetMultipleCardLeaders: (cardIds: number[], leaders: string[], options?: { silentSuccess?: boolean }) => Promise<void> | void
  onAssignCardsToEventParticipantsBulk: (
    eventId: number,
    assignments: Array<{ userName: string; cardId?: number | null; cardIds?: number[] | null }>,
    options?: { silentSuccess?: boolean },
  ) => Promise<void> | void
  informalAssets?: InformalAsset[]
  eventInformalAssignments?: EventInformalAssignment[]
  eventRestaurantAssignments?: EventRestaurantAssignment[]
  onAssignInformalToUser?: (input: { eventId: number; userName: string; assetId: number; assignedBy: string }) => Promise<boolean>
  onRemoveInformalAssignment?: (assignmentId: number) => Promise<void>
  onAssignRestaurantToUser?: (input: { eventId: number; userName: string; buildingId: number; assignedBy: string }) => Promise<boolean>
  onRemoveRestaurantAssignment?: (assignmentId: number) => Promise<void>
  onToggleBuildingRestaurant?: (buildingId: number, isRestaurant: boolean) => Promise<void>
}) {
  const isAdmin = role === 'admin'

  // ── 인도자 목록 ───────────────────────────────────────────────
  const [leaderSearch, setLeaderSearch] = useState('')
  const [selectedLeader, setSelectedLeader] = useState<string | null>(null)

  const leaders = useMemo(() => {
    const names = leaderNames.length > 0 ? leaderNames : Array.from(
      new Set(cards.flatMap((c) => {
        const ls = c.assignedLeaders && c.assignedLeaders.length > 0 ? c.assignedLeaders : c.assignedLeader ? [c.assignedLeader] : []
        return ls
      }))
    )
    return names.sort((a, b) => a.localeCompare(b, 'ko'))
  }, [leaderNames, cards])

  const filteredLeaders = useMemo(() =>
    leaders.filter((l) => l.includes(leaderSearch.trim())),
    [leaders, leaderSearch]
  )

  const getLeaderCardCount = (leader: string) =>
    cards.filter((c) => {
      const ls = c.assignedLeaders && c.assignedLeaders.length > 0 ? c.assignedLeaders : c.assignedLeader ? [c.assignedLeader] : []
      return ls.includes(leader)
    }).length

  const leaderCards = useMemo(() => {
    if (!selectedLeader) return []
    return cards.filter((c) => {
      const ls = c.assignedLeaders && c.assignedLeaders.length > 0 ? c.assignedLeaders : c.assignedLeader ? [c.assignedLeader] : []
      return ls.includes(selectedLeader)
    })
  }, [selectedLeader, cards])

  // ── 전체 구역 목록 ────────────────────────────────────────────
  const [cardQuery, setCardQuery] = useState('')
  const [regionFilter, setRegionFilter] = useState('전체')
  const [statusFilter, setStatusFilter] = useState('전체')
  const [selectMode, setSelectMode] = useState(false)
  const [selectedCardIds, setSelectedCardIds] = useState<Set<number>>(new Set())
  const [bulkAssigning, setBulkAssigning] = useState(false)
  const [releasing, setReleasing] = useState<number | null>(null)
  const [showStatusModal, setShowStatusModal] = useState(false)

  const regions = useMemo(() =>
    Array.from(new Set(cards.map((c) => c.region))).sort((a, b) => a.localeCompare(b, 'ko')),
    [cards]
  )

  const filteredCards = useMemo(() => {
    const q = cardQuery.trim().toLowerCase()
    return cards.filter((c) => {
      if (regionFilter !== '전체' && c.region !== regionFilter) return false
      if (statusFilter === '미배정') {
        const ls = c.assignedLeaders && c.assignedLeaders.length > 0 ? c.assignedLeaders : c.assignedLeader ? [c.assignedLeader] : []
        if (ls.length > 0) return false
      } else if (statusFilter === '배정됨') {
        const ls = c.assignedLeaders && c.assignedLeaders.length > 0 ? c.assignedLeaders : c.assignedLeader ? [c.assignedLeader] : []
        if (ls.length === 0) return false
      }
      if (!q) return true
      return `${c.name} ${c.region} ${c.area}`.toLowerCase().includes(q)
    })
  }, [cards, regionFilter, statusFilter, cardQuery])

  const unassignedCount = useMemo(() =>
    cards.filter((c) => {
      const ls = c.assignedLeaders && c.assignedLeaders.length > 0 ? c.assignedLeaders : c.assignedLeader ? [c.assignedLeader] : []
      return ls.length === 0
    }).length, [cards]
  )

  const getCardLeader = (card: TerritoryCard) => {
    const ls = card.assignedLeaders && card.assignedLeaders.length > 0 ? card.assignedLeaders : card.assignedLeader ? [card.assignedLeader] : []
    return ls
  }

  const toggleSelectCard = (id: number) => {
    setSelectedCardIds((prev) => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  const toggleSelectAll = () => {
    if (selectedCardIds.size === filteredCards.length) {
      setSelectedCardIds(new Set())
    } else {
      setSelectedCardIds(new Set(filteredCards.map((c) => c.id)))
    }
  }

  const handleRelease = async (card: TerritoryCard) => {
    if (!selectedLeader) return
    setReleasing(card.id)
    const currentLeaders = getCardLeader(card)
    const next = currentLeaders.filter((l) => l !== selectedLeader)
    await Promise.resolve(onSetCardLeaders(card.id, next, { silentSuccess: true }))
    showToast(`${card.name} 배정을 해제했습니다.`)
    setReleasing(null)
  }

  const handleBulkAssign = async () => {
    if (!selectedLeader || selectedCardIds.size === 0) return
    setBulkAssigning(true)
    const ids = Array.from(selectedCardIds)
    // 각 카드의 현재 인도자 목록에 selectedLeader 추가
    await Promise.all(ids.map((id) => {
      const card = cards.find((c) => c.id === id)
      if (!card) return Promise.resolve()
      const current = getCardLeader(card)
      if (current.includes(selectedLeader)) return Promise.resolve()
      return Promise.resolve(onSetCardLeaders(id, [...current, selectedLeader], { silentSuccess: true }))
    }))
    showToast(`${ids.length}개 카드를 ${selectedLeader}님께 배정했습니다.`)
    setSelectedCardIds(new Set())
    setSelectMode(false)
    setBulkAssigning(false)
  }

  // 인도자 role이면 팀 구성 & 카드 배정 화면을 렌더링
  if (role === 'leader') {
    return (
      <DesktopLeaderAssignmentView
        cards={cards}
        calendarEvents={calendarEvents}
        currentVisitor={currentVisitor}
        role={role}
        onAssignCardsToEventParticipantsBulk={onAssignCardsToEventParticipantsBulk}
        buildings={buildings}
        informalAssets={informalAssets}
        eventInformalAssignments={eventInformalAssignments}
        eventRestaurantAssignments={eventRestaurantAssignments}
        onAssignInformalToUser={onAssignInformalToUser}
        onRemoveInformalAssignment={onRemoveInformalAssignment}
        onAssignRestaurantToUser={onAssignRestaurantToUser}
        onRemoveRestaurantAssignment={onRemoveRestaurantAssignment}
        onToggleBuildingRestaurant={onToggleBuildingRestaurant}
      />
    )
  }

  if (!isAdmin) {
    return (
      <section className="la-page">
        <div className="la-empty"><h2>배정 권한 없음</h2><p>관리자만 사용할 수 있습니다.</p></div>
      </section>
    )
  }

  return (
    <section className="la-page">
      {/* 헤더 */}
      <div className="la-header">
        <div>
          <h1>관리자 배정</h1>
          <p>인도자에게 담당 구역을 지정합니다.</p>
        </div>
        <div className="la-header-right">
          <button className="la-header-btn" type="button" onClick={() => setShowStatusModal(true)}>
            👁 배정 현황 보기
          </button>
          <span className="la-badge-red">미배정 {unassignedCount}개</span>
          <button className="la-header-more" type="button">⋯</button>
        </div>
      </div>

      <div className="la-grid">
        {/* ── 1. 인도자 선택 ── */}
        <aside className="la-col la-col-leaders">
          <div className="la-col-head"><h2>1. 인도자 선택</h2></div>
          <div className="la-search-wrap">
            <input
              className="la-search"
              placeholder="인도자 검색"
              value={leaderSearch}
              onChange={(e) => setLeaderSearch(e.target.value)}
            />
            <span className="la-search-icon">🔍</span>
          </div>
          <div className="la-leader-list">
            {filteredLeaders.length === 0 && (
              <p className="la-empty-msg">인도자가 없습니다</p>
            )}
            {filteredLeaders.map((leader) => {
              const count = getLeaderCardCount(leader)
              return (
                <button
                  key={leader}
                  className={`la-leader-row ${selectedLeader === leader ? 'active' : ''}`}
                  onClick={() => setSelectedLeader(leader)}
                  type="button"
                >
                  <span className="la-leader-avatar">{leader.slice(0, 1)}</span>
                  <span className="la-leader-name">{leader}</span>
                  <span className={`la-leader-count ${count === 0 ? 'zero' : ''}`}>
                    담당 구역 {count}개
                  </span>
                </button>
              )
            })}
          </div>
          <button className="la-add-leader-btn" type="button" onClick={() => showToast('사용자 탭에서 인도자를 추가하세요.', 'info')}>
            + 인도자 추가
          </button>
        </aside>

        {/* ── 2. 선택 인도자의 담당 구역 ── */}
        <div className="la-col la-col-assigned">
          <div className="la-col-head">
            <h2>{selectedLeader ? `${selectedLeader} 님의 담당 구역` : '인도자를 선택하세요'}</h2>
            {selectedLeader && <span className="la-count-badge">총 {leaderCards.length}개</span>}
          </div>
          {!selectedLeader ? (
            <div className="la-empty-panel"><p>왼쪽에서 인도자를 선택하면<br />담당 구역 목록이 표시됩니다.</p></div>
          ) : leaderCards.length === 0 ? (
            <div className="la-empty-panel"><p>담당 구역이 없습니다.<br />오른쪽 목록에서 카드를 배정하세요.</p></div>
          ) : (
            <div className="la-assigned-list">
              {leaderCards.map((card) => (
                <div className="la-assigned-card" key={card.id}>
                  <div className="la-assigned-info">
                    <strong>{card.name}</strong>
                    <span>{card.region} → {card.area}</span>
                    <em>📅 배정일: {new Date().toLocaleDateString('ko-KR').replace(/\. /g, '.').replace('.', '')}</em>
                  </div>
                  <button
                    className="la-release-btn"
                    disabled={releasing === card.id}
                    onClick={() => handleRelease(card)}
                    type="button"
                  >
                    {releasing === card.id ? '...' : '해제'}
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* ── 3. 전체 구역 목록 ── */}
        <div className="la-col la-col-all">
          <div className="la-col-head la-col-head-right">
            <h2>3. 전체 구역 목록</h2>
            <div className="la-col-head-actions">
              <button
                className={`la-select-mode-btn ${selectMode ? 'active' : ''}`}
                onClick={() => { setSelectMode((v) => !v); setSelectedCardIds(new Set()) }}
                type="button"
              >
                {selectMode ? '✓ 선택 모드' : '선택 모드'}
              </button>
              {selectMode && (
                <button className="la-select-all-btn" onClick={toggleSelectAll} type="button">
                  전체 선택
                </button>
              )}
            </div>
          </div>

          {selectMode && selectedCardIds.size > 0 && (
            <div className="la-selection-bar">
              <span>{selectedCardIds.size}개 선택됨</span>
              <button onClick={() => setSelectedCardIds(new Set())} type="button">선택 해제</button>
              <button
                className="la-bulk-assign-btn"
                disabled={!selectedLeader || bulkAssigning}
                onClick={handleBulkAssign}
                type="button"
              >
                {bulkAssigning ? '배정 중...' : selectedLeader ? `${selectedLeader}에게 일괄 배정` : '인도자 먼저 선택'}
              </button>
            </div>
          )}

          <div className="la-filters">
            <div className="la-search-wrap">
              <input
                className="la-search"
                placeholder="구역명 검색"
                value={cardQuery}
                onChange={(e) => { setCardQuery(e.target.value) }}
              />
              <span className="la-search-icon">🔍</span>
            </div>
            <select className="la-filter-select" value={regionFilter} onChange={(e) => { setRegionFilter(e.target.value) }}>
              <option value="전체">전체 지역</option>
              {regions.map((r) => <option key={r} value={r}>{r}</option>)}
            </select>
            <select className="la-filter-select" value={statusFilter} onChange={(e) => { setStatusFilter(e.target.value) }}>
              <option value="전체">전체 상태</option>
              <option value="미배정">미배정</option>
              <option value="배정됨">배정됨</option>
            </select>
          </div>

          <p className="la-total-label">총 {filteredCards.length}개 구역</p>

          <div className="la-card-list">
            {filteredCards.map((card) => {
              const assignedLeaders = getCardLeader(card)
              const isSelected = selectedCardIds.has(card.id)
              return (
                <div
                  className={`la-card-row ${isSelected ? 'selected' : ''}`}
                  key={card.id}
                  onClick={() => selectMode && toggleSelectCard(card.id)}
                >
                  {selectMode && (
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => toggleSelectCard(card.id)}
                      onClick={(e) => e.stopPropagation()}
                      className="la-card-check"
                    />
                  )}
                  <div className="la-card-info">
                    <strong>{card.name}</strong>
                    <span>{card.region} → {card.area}</span>
                  </div>
                  <div className="la-card-meta">
                    {assignedLeaders.length > 0 ? (
                      assignedLeaders.map((l) => (
                        <span
                          key={l}
                          className={`la-assignee-badge ${l === currentVisitor ? 'mine' : ''}`}
                        >
                          {l} 담당
                        </span>
                      ))
                    ) : (
                      <span className="la-assignee-badge unassigned">미배정</span>
                    )}
                    <button
                      className="la-detail-btn"
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation()
                        if (!selectedLeader) { showToast('인도자를 먼저 선택하세요.', 'info'); return }
                        const current = getCardLeader(card)
                        if (current.includes(selectedLeader)) { showToast('이미 배정된 카드입니다.', 'info'); return }
                        void Promise.resolve(onSetCardLeaders(card.id, [...current, selectedLeader], { silentSuccess: true }))
                          .then(() => showToast(`${card.name} → ${selectedLeader} 배정 완료`))
                      }}
                    >
                      {getCardLeader(card).includes(selectedLeader ?? '') ? '배정됨' : '배정'}
                    </button>
                  </div>
                </div>
              )
            })}
            {filteredCards.length === 0 && (
              <div className="la-empty-panel"><p>조건에 맞는 카드가 없습니다</p></div>
            )}
          </div>
        </div>
      </div>

      {showStatusModal && (
        <AssignmentStatusModal
          leaders={leaders}
          cards={cards}
          getCardLeader={getCardLeader}
          onClose={() => setShowStatusModal(false)}
        />
      )}
    </section>
  )
}
