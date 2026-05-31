// 화면2 — 구역 배분 (sticky 팀바 + 목록/지도 토글)
// 설계: docs/leader-assignment-redesign.md v3 §3.3
//
// Phase 2: 목록 뷰 구현. 지도 뷰는 Phase 3 (stub).
// 활성팀에 카드 배정/해제. 다른 팀 카드 탭 = 활성팀으로 이동 + undo.
// 모든 상태는 draft 단일 reducer에서 파생.

import { useMemo, useState } from 'react'
import type { Dispatch } from 'react'
import type { Building, TerritoryCard } from '../../types'
import type { DraftAction, DraftTeam } from '../../hooks/assignmentDraft'
import { teamHex } from './teamColors'

type Props = {
  teams: DraftTeam[]
  activeTeamId: string | null
  cards: TerritoryCard[]           // 인도자 담당 카드 (배정 대상)
  buildings: Building[]
  canEdit: boolean
  canUndo: boolean
  dispatch: Dispatch<DraftAction>
  onBack: () => void
}

type ViewMode = 'list' | 'map'

export function ZoneAssignScreen({ teams, activeTeamId, cards, buildings, canEdit, canUndo, dispatch, onBack }: Props) {
  const [view, setView] = useState<ViewMode>('list')
  const [query, setQuery] = useState('')
  const [unassignedOnly, setUnassignedOnly] = useState(false)

  // cardId → teamId 역인덱스 (어느 카드가 어느 팀인지)
  const cardTeam = useMemo(() => {
    const m = new Map<number, DraftTeam>()
    teams.forEach((t) => t.cardIds.forEach((id) => m.set(id, t)))
    return m
  }, [teams])

  // 카드별 주택/상가 세대 수
  const unitStats = useMemo(() => {
    const m = new Map<number, { house: number; shop: number }>()
    buildings.forEach((b) => {
      const prev = m.get(b.cardId) ?? { house: 0, shop: 0 }
      const u = b.units?.length ?? 0
      if (b.type === '주택') prev.house += u
      else if (b.type === '상가') prev.shop += u
      m.set(b.cardId, prev)
    })
    return m
  }, [buildings])

  const activeTeam = teams.find((t) => t.id === activeTeamId) ?? null

  // 동(area)별 그룹
  const grouped = useMemo(() => {
    const q = query.trim().toLowerCase()
    const filtered = cards.filter((c) => {
      if (q && !c.name.toLowerCase().includes(q)) return false
      if (unassignedOnly && cardTeam.has(c.id)) return false
      return true
    })
    const groups = new Map<string, TerritoryCard[]>()
    filtered.forEach((c) => {
      const key = `${c.region} · ${c.area}`
      const arr = groups.get(key) ?? []
      arr.push(c)
      groups.set(key, arr)
    })
    return Array.from(groups.entries()).sort((a, b) => a[0].localeCompare(b[0], 'ko'))
  }, [cards, query, unassignedOnly, cardTeam])

  const toggleCard = (cardId: number) => {
    if (!canEdit || !activeTeam) return
    const owner = cardTeam.get(cardId)
    if (owner?.id === activeTeam.id) {
      dispatch({ type: 'UNASSIGN_CARD', teamId: activeTeam.id, cardId })
    } else if (owner) {
      dispatch({ type: 'MOVE_CARD', cardId, toTeamId: activeTeam.id }) // 다른 팀 → 활성팀 이동
    } else {
      dispatch({ type: 'ASSIGN_CARD', teamId: activeTeam.id, cardId })
    }
  }

  return (
    <div className="asg-zone">
      {/* sticky 헤더 */}
      <div className="asg-zone-sticky">
        <div className="asg-zone-topbar">
          <button className="asg-zone-back" onClick={onBack} type="button" aria-label="뒤로">‹</button>
          <strong>구역 배분</strong>
          {canUndo && (
            <button className="asg-zone-undo" onClick={() => dispatch({ type: 'UNDO' })} type="button">실행취소</button>
          )}
        </div>
        {/* 팀바 가로 스크롤 */}
        <div className="asg-teambar">
          {teams.map((team) => {
            const isActive = team.id === activeTeamId
            return (
              <button
                key={team.id}
                type="button"
                className={`asg-teambar-card${isActive ? ' is-active' : ''}`}
                style={{ borderColor: isActive ? teamHex(team.color) : undefined }}
                onClick={() => dispatch({ type: 'SET_ACTIVE_TEAM', teamId: team.id })}
              >
                <span className="asg-teambar-name">
                  <span className="asg-team-dot" style={{ background: teamHex(team.color) }} />
                  {team.name}
                </span>
                <span className="asg-teambar-mem">{team.members.join('·') || '구성원 없음'}</span>
                <span className="asg-teambar-zones">
                  {team.cardIds.length > 0 ? `🗂 ${team.cardIds.length}` : '⚠ 구역없음'}
                </span>
              </button>
            )
          })}
        </div>
        {/* 뷰 토글 */}
        <div className="asg-zone-toggle">
          <button className={view === 'list' ? 'is-on' : ''} onClick={() => setView('list')} type="button">☰ 목록</button>
          <button className={view === 'map' ? 'is-on' : ''} onClick={() => setView('map')} type="button">🗺️ 지도</button>
        </div>
      </div>

      {/* 본문 */}
      {view === 'map' ? (
        <div className="asg-zone-map-stub">
          🗺️ 지도 배분은 Phase 3에서 추가됩니다. 지금은 목록으로 배정해 주세요.
        </div>
      ) : (
        <div className="asg-zone-list">
          <div className="asg-zone-filter">
            <input
              className="asg-zone-search"
              placeholder="카드 이름 검색"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
            <label className="asg-zone-unassigned-toggle">
              <input type="checkbox" checked={unassignedOnly} onChange={(e) => setUnassignedOnly(e.target.checked)} />
              미배정만
            </label>
          </div>

          {!activeTeam && <div className="asg-empty">먼저 위에서 팀을 선택하세요.</div>}

          {grouped.map(([groupName, groupCards]) => (
            <div className="asg-zone-group" key={groupName}>
              <p className="asg-zone-group-head">{groupName}</p>
              {groupCards.map((card) => {
                const owner = cardTeam.get(card.id)
                const isActiveTeamCard = owner?.id === activeTeamId
                const stats = unitStats.get(card.id) ?? { house: 0, shop: 0 }
                return (
                  <button
                    key={card.id}
                    type="button"
                    className={`asg-zone-card${isActiveTeamCard ? ' is-mine' : ''}`}
                    onClick={() => toggleCard(card.id)}
                    disabled={!canEdit || !activeTeam}
                  >
                    <span className={`asg-zone-check${isActiveTeamCard ? ' is-on' : ''}`}>
                      {isActiveTeamCard && '✓'}
                    </span>
                    <span className="asg-zone-card-main">
                      <strong>{card.name}</strong>
                      <small>
                        {stats.house > 0 && `주택 ${stats.house}`}
                        {stats.house > 0 && stats.shop > 0 && ' · '}
                        {stats.shop > 0 && `상가 ${stats.shop}`}
                        {` · ${card.progress}%`}
                      </small>
                    </span>
                    {owner && !isActiveTeamCard && (
                      <span className="asg-zone-owner-pill" style={{ background: `${teamHex(owner.color)}22`, color: teamHex(owner.color) }}>
                        {owner.name}
                      </span>
                    )}
                  </button>
                )
              })}
            </div>
          ))}

          {grouped.length === 0 && <div className="asg-empty">조건에 맞는 카드가 없습니다.</div>}
        </div>
      )}
    </div>
  )
}
