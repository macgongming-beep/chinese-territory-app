// 화면2 — 구역 배분 (sticky 팀바 + 목록/지도 토글)
// 설계: docs/leader-assignment-redesign.md v3 §3.3
//
// Phase 2: 목록 뷰 구현. 지도 뷰는 Phase 3 (stub).
// 활성팀에 카드 배정/해제. 다른 팀 카드 탭 = 활성팀으로 이동 + undo.
// 모든 상태는 draft 단일 reducer에서 파생.

import { useMemo, useState } from 'react'
import type { Dispatch } from 'react'
import type { Building, CardBoundary, TerritoryCard } from '../../types'
import type { DraftAction, DraftTeam } from '../../hooks/assignmentDraft'
import { teamHex } from './teamColors'
import { sortTerritoryCardsByOperationalPriority } from '../../utils/cardSearch'
import { MapCanvas } from '../MapCanvas'

type Props = {
  teams: DraftTeam[]
  activeTeamId: string | null
  cards: TerritoryCard[]           // 인도자 담당 카드 (배정 대상)
  buildings: Building[]
  cardBoundaries: CardBoundary[]
  canEdit: boolean
  dispatch: Dispatch<DraftAction>
  onBack: () => void
}

type ViewMode = 'list' | 'map'

export function ZoneAssignScreen({ teams, activeTeamId, cards, buildings, cardBoundaries, canEdit, dispatch, onBack }: Props) {
  const [view, setView] = useState<ViewMode>('list')
  const [query, setQuery] = useState('')
  const [unassignedOnly, setUnassignedOnly] = useState(false)
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set())

  // 구(區) 목록 — 담당 카드가 여러 구에 걸치면 지도가 너무 줌아웃됨 → 한 구만 보기
  const regions = useMemo(() => {
    const counts = new Map<string, number>()
    cards.forEach((c) => counts.set(c.region, (counts.get(c.region) ?? 0) + 1))
    return Array.from(counts.entries()).sort((a, b) => b[1] - a[1]).map(([r]) => r)
  }, [cards])
  // 기본: 카드가 가장 많은 구 (한 구만 보기). regions가 1개면 그것.
  const [selectedRegion, setSelectedRegion] = useState<string>(() => regions[0] ?? '전체')
  const regionCards = useMemo(
    () => (selectedRegion === '전체' ? cards : cards.filter((c) => c.region === selectedRegion)),
    [cards, selectedRegion],
  )

  // cardId → teamId 역인덱스 (어느 카드가 어느 팀인지)
  const cardTeam = useMemo(() => {
    const m = new Map<number, DraftTeam>()
    teams.forEach((t) => t.cardIds.forEach((id) => m.set(id, t)))
    return m
  }, [teams])

  // 지도 색칠용: cardId → 팀 색(hex)
  const cardColorMap = useMemo(() => {
    const m = new Map<number, string>()
    teams.forEach((t) => t.cardIds.forEach((id) => m.set(id, teamHex(t.color))))
    return m
  }, [teams])

  // 선택된 구의 담당 카드만 지도에 (경계선 있는 것) — 한 구로 좁혀 줌 적정화
  const myCardIds = useMemo(() => new Set(regionCards.map((c) => c.id)), [regionCards])
  const myBoundaries = useMemo(
    () => cardBoundaries.filter((b) => myCardIds.has(b.cardId)),
    [cardBoundaries, myCardIds],
  )

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

  // 구별 카드 수 (필터 pill 카운트)
  const regionCount = useMemo(() => {
    const m = new Map<string, number>()
    cards.forEach((c) => m.set(c.region, (m.get(c.region) ?? 0) + 1))
    return m
  }, [cards])

  // cardId → 짧은 카드명 (지역/구 접두 제거: "처인구 고림동 1" → "고림동 1")
  const shortName = (id: number) => {
    const c = cards.find((x) => x.id === id)
    if (!c) return `카드 ${id}`
    return c.name.replace(/^(처인구|기흥구|수지구|영통구|화성시)\s*/, '')
  }
  const teamAreaNames = (t: DraftTeam) =>
    t.cardIds.length ? t.cardIds.map(shortName).slice(0, 3).join(', ') + (t.cardIds.length > 3 ? ` 외 ${t.cardIds.length - 3}` : '') : null

  // 동(area)별 그룹 — 선택된 구 기준
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
    const result = Array.from(groups.entries()).sort((a, b) => a[0].localeCompare(b[0], 'ko'))
    return result.map(([groupName, groupCards]) => [groupName, sortTerritoryCardsByOperationalPriority(groupCards)] as [string, TerritoryCard[]])
  }, [regionCards, query, unassignedOnly, cardTeam])

  const toggleGroup = (groupName: string) => {
    setCollapsedGroups((prev) => {
      const next = new Set(prev)
      if (next.has(groupName)) next.delete(groupName)
      else next.add(groupName)
      return next
    })
  }

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
    <div className={`asg-zone${view === 'map' ? ' is-map-view' : ''}`}>
      {/* sticky 헤더 */}
      <div className="asg-zone-sticky">
        <header className="asg-editor-head">
          <div className="asg-editor-head-left">
            <button className="asg-editor-back" onClick={onBack} type="button" aria-label="뒤로">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
            </button>
            <div className="asg-editor-titles">
              <strong>구역 배분</strong>
              <span>{activeTeam ? `${activeTeam.name} · ${activeTeam.members.join(' · ')}` : ''}</span>
            </div>
          </div>
        </header>
        {/* 배분할 팀 — 가로 스크롤, 받은 구역명 표시 */}
        <span className="asg-teambar-label">배분할 팀</span>
        <div className="asg-teambar">
          {teams.map((team) => {
            const isActive = team.id === activeTeamId
            const areas = teamAreaNames(team)
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
                  <span className="asg-teambar-cnt">{team.members.length}</span>
                </span>
                <span className="asg-teambar-zones" style={areas ? undefined : { color: 'var(--warn, #b8862a)' }}>
                  {areas ?? '구역 미배정'}
                </span>
              </button>
            )
          })}
        </div>
        {/* 구 필터 (무채색 카운트 pill) + 뷰 토글 */}
        <div className="asg-zone-controls">

          <div className="asg-zone-toggle">
            <button className={view === 'list' ? 'is-on' : ''} onClick={() => setView('list')} type="button">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round"><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/></svg>
              목록
            </button>
            <button className={view === 'map' ? 'is-on' : ''} onClick={() => setView('map')} type="button">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"><polygon points="1 6 1 22 8 18 16 22 23 18 23 2 16 6 8 2 1 6"/><line x1="8" y1="2" x2="8" y2="18"/><line x1="16" y1="6" x2="16" y2="22"/></svg>
              지도
            </button>
          </div>
        </div>
      </div>

      {/* 본문 */}
      {view === 'map' ? (
        <div className="asg-zone-map">
          {regions.length > 1 && (
            <div className="asg-map-region-filter">
              {regions.map((r) => (
                <button
                  key={r}
                  type="button"
                  className={`asg-map-region-btn${selectedRegion === r ? ' is-on' : ''}`}
                  onClick={() => setSelectedRegion(r)}
                >
                  {r} <span>{regionCount.get(r) ?? 0}</span>
                </button>
              ))}
            </div>
          )}
          <MapCanvas
            buildings={buildings}
            cardBoundaries={myBoundaries}
            cards={regionCards}
            selectedBuildingId={0}
            selectedCardId="전체"
            highlightedCardIds={myCardIds}
            cardColorMap={cardColorMap}
            hideBuildingMarkers
            isMobile
            onSelectBuilding={() => undefined}
            onSelectCardBoundary={(cardId) => {
              if (!canEdit || !activeTeam) return
              const owner = cardTeam.get(cardId)
              if (owner?.id === activeTeam.id) dispatch({ type: 'UNASSIGN_CARD', teamId: activeTeam.id, cardId })
              else if (owner) dispatch({ type: 'MOVE_CARD', cardId, toTeamId: activeTeam.id })
              else dispatch({ type: 'ASSIGN_CARD', teamId: activeTeam.id, cardId })
            }}
          />
          <div className="asg-zone-map-hint">
            <div className="asg-zone-map-hint-row">
              <span className="asg-zone-map-hint-swatch" style={{ background: activeTeam ? `${teamHex(activeTeam.color)}22` : 'transparent', borderColor: activeTeam ? teamHex(activeTeam.color) : 'var(--line)' }} />
              <span>폴리곤을 탭하면 <b>{activeTeam?.name ?? '팀 선택'}</b> 색으로 칠해집니다.</span>
            </div>
            <div className="asg-zone-map-hint-meta">
              담당 카드 {regionCards.length} · 경계선 {myBoundaries.length}
              {activeTeam ? ` · ${activeTeam.name} 배분 ${activeTeam.cardIds.length}` : ''}
            </div>
          </div>
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

          {grouped.map(([groupName, groupCards]) => {
            const isCollapsed = collapsedGroups.has(groupName)
            return (
            <div className="asg-zone-group" key={groupName}>
              <button type="button" className="asg-zone-group-head is-btn" onClick={() => toggleGroup(groupName)}>
                <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ transform: isCollapsed ? 'rotate(-90deg)' : 'none', transition: 'transform 0.2s' }}><polyline points="6 9 12 15 18 9"/></svg>
                  {groupName}
                </span>
                <span style={{ fontSize: 13, color: 'var(--muted)', fontWeight: 400 }}>{groupCards.length}개</span>
              </button>
              {!isCollapsed && groupCards.map((card) => {
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
                      {isActiveTeamCard && (
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                      )}
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
                    {owner && !isActiveTeamCard ? (
                      <span className="asg-zone-owner-pill" style={{ background: `${teamHex(owner.color)}22`, color: teamHex(owner.color) }}>
                        {owner.name}
                      </span>
                    ) : (
                      <span className={`asg-state-pill ${card.progress > 0 ? 'used' : 'unused'}`}>
                        {card.progress > 0 ? '사용중' : '미사용'}
                      </span>
                    )}
                  </button>
                )
              })}
            </div>
          )})}

          {grouped.length === 0 && <div className="asg-empty">조건에 맞는 카드가 없습니다.</div>}
        </div>
      )}
    </div>
  )
}
