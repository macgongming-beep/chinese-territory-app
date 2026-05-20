// 관리자 모바일 배정 — design_handoff 07 / 08 화면
//
// Step 1 (인도자 선택):
//   - Stepper [1 인도자 선택] → [2 구역 배정]
//   - 필터 pills: 전체 / 활성 / 신규
//   - 검색
//   - 인도자 카드 리스트 (avatar + 이름 + 담당 N개)
//   - 신규 인도자 섹션 (담당 없음)
//   - sticky 하단: "○○ 담당 구역 배정하기 →" 솔리드 lg
//
// Step 2 (구역 배정):
//   - 헤더: 누구에게 배정 + 미배정 N
//   - Stepper [1] → [2 active]
//   - 검색
//   - 그룹 카드 (지역 · 동 / 전체 N · 미배정 M) + 펼쳐서 카드들
//   - 각 카드: 배정 (free, ink solid) 또는 배정됨 (pill, 누구에게)
//   - sticky 하단: 이번 세션 N개 배정 + "완료"

import { useMemo, useState } from 'react'
import { showToast } from '../lib/toast'
import type { TerritoryCard } from '../types'

function getCardLeaders(card: TerritoryCard) {
  return card.assignedLeaders && card.assignedLeaders.length > 0
    ? card.assignedLeaders
    : card.assignedLeader
      ? [card.assignedLeader]
      : []
}

// ── 아이콘 ─────────────────────────────
function ChevR({ size = 14, color = 'var(--muted-2)' }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <polyline points="9 6 15 12 9 18" />
    </svg>
  )
}
function ChevD({ size = 14 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <polyline points="6 9 12 15 18 9" />
    </svg>
  )
}
function MapIcon({ size = 15 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round">
      <polygon points="3 6 9 3 15 6 21 3 21 21 15 18 9 21 3 18 3 6" />
      <line x1="9" y1="3" x2="9" y2="21" />
      <line x1="15" y1="6" x2="15" y2="18" />
    </svg>
  )
}
function SearchIcon({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round">
      <circle cx="11" cy="11" r="7" />
      <line x1="21" y1="21" x2="16.65" y2="16.65" />
    </svg>
  )
}

function Avatar({ name, muted, size = 36 }: { name: string; muted?: boolean; size?: number }) {
  return (
    <span
      style={{
        width: size, height: size, borderRadius: '50%',
        background: muted ? 'var(--tint)' : 'var(--ink)',
        color: muted ? 'var(--muted)' : '#fff',
        display: 'grid', placeItems: 'center',
        fontSize: Math.round(size * 0.4), fontWeight: 700, flexShrink: 0,
      }}
    >
      {name.slice(0, 1)}
    </span>
  )
}

export function MobileAdminAssignment({
  cards,
  leaderNames = [],
  currentVisitor = '',
  onSetCardLeaders,
}: {
  cards: TerritoryCard[]
  leaderNames?: string[]
  currentVisitor?: string
  onSetCardLeaders: (cardId: number, leaders: string[], options?: { silentSuccess?: boolean }) => Promise<void> | void
}) {
  const [step, setStep] = useState<1 | 2>(1)
  const [selectedLeaders, setSelectedLeaders] = useState<Set<string>>(new Set())
  // 단일 선택 호환용 — Set 의 첫 원소 또는 null
  const selectedLeader = selectedLeaders.size > 0 ? [...selectedLeaders][0] : null
  const toggleLeaderSelection = (name: string) => {
    setSelectedLeaders((prev) => {
      const next = new Set(prev)
      if (next.has(name)) next.delete(name); else next.add(name)
      return next
    })
  }
  const [leaderFilter, setLeaderFilter] = useState<'all' | 'active' | 'new'>('all')
  const [leaderSearch, setLeaderSearch] = useState('')
  const [cardQuery, setCardQuery] = useState('')
  const [regionPill, setRegionPill] = useState<string>('전체')
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set())
  const [sessionAssigned, setSessionAssigned] = useState<Set<number>>(new Set())
  const [unassignedOnly, setUnassignedOnly] = useState(true)
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set())
  const [actionTarget, setActionTarget] = useState<TerritoryCard | null>(null)

  const leaders = useMemo(() => {
    const names = leaderNames.length > 0
      ? leaderNames
      : Array.from(new Set(cards.flatMap((card) => getCardLeaders(card))))
    return names.sort((a, b) => a.localeCompare(b, 'ko'))
  }, [cards, leaderNames])

  // 인도자별 카드 통계: { assigned, inProgress, done }
  const leaderStats = useMemo(() => {
    const m = new Map<string, { assigned: number; inProgress: number; done: number }>()
    cards.forEach((card) => {
      getCardLeaders(card).forEach((leader) => {
        const prev = m.get(leader) ?? { assigned: 0, inProgress: 0, done: 0 }
        prev.assigned += 1
        if (card.status === '진행중') prev.inProgress += 1
        if (card.status === '완료') prev.done += 1
        m.set(leader, prev)
      })
    })
    return m
  }, [cards])

  const activeLeaders = leaders.filter((l) => l !== currentVisitor && (leaderStats.get(l)?.assigned ?? 0) > 0)
  const newLeaders = leaders.filter((l) => l !== currentVisitor && (leaderStats.get(l)?.assigned ?? 0) === 0)
  const meLeader = leaders.includes(currentVisitor) ? currentVisitor : null

  // 검색 필터 적용
  const filterByQuery = (list: string[]) => {
    const q = leaderSearch.trim()
    return q ? list.filter((l) => l.includes(q)) : list
  }
  const filteredActive = filterByQuery(activeLeaders)
  const filteredNew = filterByQuery(newLeaders)
  const filteredMe = meLeader && (!leaderSearch.trim() || meLeader.includes(leaderSearch.trim())) ? meLeader : null

  // 카드 풀: 미배정만 토글 따라 다름
  const cardPool = useMemo(() => {
    return unassignedOnly ? cards.filter((c) => getCardLeaders(c).length === 0) : cards
  }, [cards, unassignedOnly])

  const regions = useMemo(() => {
    return Array.from(new Set(cardPool.map((c) => c.region))).sort((a, b) => a.localeCompare(b, 'ko'))
  }, [cardPool])

  // 지역별 카운트 (pills 표시용)
  const regionCounts = useMemo(() => {
    const m = new Map<string, number>()
    cardPool.forEach((c) => m.set(c.region, (m.get(c.region) ?? 0) + 1))
    return m
  }, [cardPool])

  // ── Step 2: 검색 + 지역 pill 필터 ────────
  const filteredCards = useMemo(() => {
    const q = cardQuery.trim()
    return cardPool
      .filter((c) => regionPill === '전체' || c.region === regionPill)
      .filter((c) => !q || `${c.name} ${c.region} ${c.area}`.includes(q))
  }, [cardPool, cardQuery, regionPill])

  // ── Step 2: 그룹화 (region · area) ─────────────────
  const grouped = useMemo(() => {
    const m = new Map<string, TerritoryCard[]>()
    filteredCards.forEach((c) => {
      const key = `${c.region} · ${c.area}`
      const list = m.get(key) ?? []
      list.push(c)
      m.set(key, list)
    })
    return Array.from(m.entries())
      .map(([key, cs]) => ({
        key,
        cards: cs,
        totalInArea: cards.filter((cc) => `${cc.region} · ${cc.area}` === key).length,
        unassignedInArea: cards.filter((cc) => `${cc.region} · ${cc.area}` === key && getCardLeaders(cc).length === 0).length,
      }))
      .sort((a, b) => a.key.localeCompare(b.key, 'ko'))
  }, [filteredCards, cards])

  // 선택된 인도자 목록(배열). assign 함수들은 모두 이 배열을 union 으로 합침.
  const selectedLeadersArr = useMemo(() => [...selectedLeaders], [selectedLeaders])

  const ensureSelected = (): boolean => {
    if (selectedLeadersArr.length === 0) {
      showToast('인도자를 먼저 선택하세요.', 'info')
      return false
    }
    return true
  }

  // 1개 카드에 선택된 인도자들 모두 추가 (이미 있는 인도자는 유지)
  const assignCard = async (card: TerritoryCard) => {
    if (!ensureSelected()) return
    const cardLeaders = getCardLeaders(card)
    const next = Array.from(new Set([...cardLeaders, ...selectedLeadersArr]))
    if (next.length === cardLeaders.length) return // 변경 없음
    await Promise.resolve(onSetCardLeaders(card.id, next, { silentSuccess: true }))
    setSessionAssigned((prev) => new Set([...prev, card.id]))
    showToast(`${card.name} 배정 완료`)
  }

  // 이미 다른 사람한테 배정된 카드: 추가 / 변경 / 해제
  const handleAddToAssignment = async (card: TerritoryCard) => {
    if (!ensureSelected()) return
    const cardLeaders = getCardLeaders(card)
    const next = Array.from(new Set([...cardLeaders, ...selectedLeadersArr]))
    await Promise.resolve(onSetCardLeaders(card.id, next, { silentSuccess: true }))
    setSessionAssigned((prev) => new Set([...prev, card.id]))
    setActionTarget(null)
    showToast(`${card.name} 에 ${selectedLeadersArr.join(', ')} 추가 배정`)
  }
  const handleReplaceAssignment = async (card: TerritoryCard) => {
    if (!ensureSelected()) return
    await Promise.resolve(onSetCardLeaders(card.id, selectedLeadersArr, { silentSuccess: true }))
    setSessionAssigned((prev) => new Set([...prev, card.id]))
    setActionTarget(null)
    showToast(`${card.name} 인도자를 ${selectedLeadersArr.join(', ')} 로 변경`)
  }

  const assignWholeGroup = async (group: { key: string; cards: TerritoryCard[] }) => {
    if (!ensureSelected()) return
    const toAssign = group.cards.filter((card) => {
      const cl = getCardLeaders(card)
      return selectedLeadersArr.some((name) => !cl.includes(name))
    })
    if (toAssign.length === 0) {
      showToast('새로 배정할 카드가 없습니다', 'info')
      return
    }
    await Promise.all(
      toAssign.map((card) => {
        const next = Array.from(new Set([...getCardLeaders(card), ...selectedLeadersArr]))
        return Promise.resolve(onSetCardLeaders(card.id, next, { silentSuccess: true }))
      })
    )
    setSessionAssigned((prev) => {
      const next = new Set(prev)
      toAssign.forEach((c) => next.add(c.id))
      return next
    })
    showToast(`${group.key} ${toAssign.length}개 배정 완료`, 'success')
  }

  // 배정 해제 (선택된 인도자들 모두를 카드에서 빼기)
  const handleUnassign = async (card: TerritoryCard) => {
    if (!ensureSelected()) return
    const cardLeaders = getCardLeaders(card)
    const next = cardLeaders.filter((l) => !selectedLeaders.has(l))
    if (next.length === cardLeaders.length) return
    await Promise.resolve(onSetCardLeaders(card.id, next, { silentSuccess: true }))
    setSessionAssigned((prev) => {
      const n = new Set(prev)
      n.delete(card.id)
      return n
    })
    showToast(`${card.name} 배정 해제`, 'info')
  }

  // 그룹 전체 해제 (선택된 인도자가 담당하는 카드들만)
  const unassignWholeGroup = async (group: { key: string; cards: TerritoryCard[] }) => {
    if (!ensureSelected()) return
    const mine = group.cards.filter((card) =>
      getCardLeaders(card).some((l) => selectedLeaders.has(l)),
    )
    if (mine.length === 0) return
    await Promise.all(
      mine.map((card) => {
        const next = getCardLeaders(card).filter((l) => !selectedLeaders.has(l))
        return Promise.resolve(onSetCardLeaders(card.id, next, { silentSuccess: true }))
      })
    )
    setSessionAssigned((prev) => {
      const n = new Set(prev)
      mine.forEach((c) => n.delete(c.id))
      return n
    })
    showToast(`${group.key} ${mine.length}개 해제`, 'info')
  }

  const toggleGroup = (key: string) => {
    setExpandedGroups((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', padding: '16px 16px 100px' }}>
      {/* ── Stepper ─────────────────── */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: '1fr auto 1fr',
        alignItems: 'center',
        gap: 8,
        marginBottom: 18,
      }}>
        <StepPill no={1} label="인도자 선택" active={step === 1} onClick={() => setStep(1)} />
        <ChevR size={14} color="var(--muted-2)" />
        <StepPill no={2} label="구역 배정" active={step === 2} onClick={() => setStep(2)} />
      </div>

      {/* ── Step 1: 인도자 선택 ───────────── */}
      {step === 1 && (
        <>
          {/* 필터 pills (전체/활성/신규) */}
          <div style={{ display: 'flex', gap: 6, marginBottom: 12, padding: '0 2px' }}>
            <FilterPill label={`전체 ${leaders.length}`} active={leaderFilter === 'all'} onClick={() => setLeaderFilter('all')} />
            <FilterPill label={`활성 ${activeLeaders.length}`} active={leaderFilter === 'active'} onClick={() => setLeaderFilter('active')} />
            <FilterPill label={`신규 ${newLeaders.length}`} active={leaderFilter === 'new'} onClick={() => setLeaderFilter('new')} />
          </div>

          {/* 검색 */}
          <SearchInput value={leaderSearch} onChange={setLeaderSearch} placeholder="인도자 검색" />

          {/* 활성 인도자 */}
          {(leaderFilter === 'all' || leaderFilter === 'active') && filteredActive.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 14 }}>
              {filteredActive.map((leader) => (
                <LeaderCard
                  key={leader}
                  name={leader}
                  stats={leaderStats.get(leader) ?? { assigned: 0, inProgress: 0, done: 0 }}
                  isSelected={selectedLeaders.has(leader)}
                  onClick={() => toggleLeaderSelection(leader)}
                />
              ))}
            </div>
          )}

          {/* 신규 인도자 섹션 divider */}
          {(leaderFilter === 'all' || leaderFilter === 'new') && filteredNew.length > 0 && (
            <>
              <SectionDivider label="신규 인도자 (담당 없음)" count={filteredNew.length} marginTop={leaderFilter === 'all' && filteredActive.length > 0 ? 20 : 14} />
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 10 }}>
                {filteredNew.map((leader) => (
                  <LeaderCard
                    key={leader}
                    name={leader}
                    stats={leaderStats.get(leader) ?? { assigned: 0, inProgress: 0, done: 0 }}
                    isSelected={selectedLeaders.has(leader)}
                    onClick={() => toggleLeaderSelection(leader)}
                    muted
                  />
                ))}
              </div>
            </>
          )}

          {/* 나 섹션 (전체일 때만 노출) */}
          {leaderFilter === 'all' && filteredMe && (
            <>
              <SectionDivider label="나" marginTop={filteredActive.length > 0 || filteredNew.length > 0 ? 20 : 14} />
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 10 }}>
                <LeaderCard
                  key={filteredMe}
                  name={filteredMe}
                  stats={leaderStats.get(filteredMe) ?? { assigned: 0, inProgress: 0, done: 0 }}
                  isSelected={selectedLeaders.has(filteredMe)}
                  onClick={() => toggleLeaderSelection(filteredMe)}
                  isMe
                />
              </div>
            </>
          )}

          {/* 빈 상태 */}
          {(() => {
            const showActive = (leaderFilter === 'all' || leaderFilter === 'active') && filteredActive.length > 0
            const showNew = (leaderFilter === 'all' || leaderFilter === 'new') && filteredNew.length > 0
            const showMe = leaderFilter === 'all' && filteredMe
            if (showActive || showNew || showMe) return null
            return (
              <div style={{
                padding: '32px 16px', textAlign: 'center', fontSize: 13,
                color: 'var(--muted)',
                background: 'var(--surface)', border: '1px solid var(--line)',
                borderRadius: 12, marginTop: 14,
              }}>
                {leaderSearch ? '검색 결과가 없습니다' : leaderFilter === 'active' ? '활성 인도자가 없습니다' : leaderFilter === 'new' ? '신규 인도자가 없습니다' : '인도자가 없습니다'}
              </div>
            )
          })()}

          {/* sticky 하단: 다음 단계 */}
          {selectedLeaders.size > 0 && (
            <StickyBottom>
              <button
                type="button"
                onClick={() => { setStep(2); setSessionAssigned(new Set()) }}
                style={{
                  width: '100%', height: 48, minHeight: 48,
                  background: 'var(--ink)', color: '#fff',
                  border: 'none', borderRadius: 8,
                  fontSize: 15, fontWeight: 600, cursor: 'pointer',
                  letterSpacing: '-0.005em',
                  display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                }}
              >
                {selectedLeaders.size === 1
                  ? `${[...selectedLeaders][0]} 담당 구역 배정하기`
                  : `${selectedLeaders.size}명 담당 구역 배정하기`}
                <ChevR color="#fff" />
              </button>
            </StickyBottom>
          )}
        </>
      )}

      {/* ── Step 2: 구역 배정 ───────────── */}
      {step === 2 && selectedLeaders.size === 0 && (
        <div style={{
          padding: 18,
          background: 'var(--surface)',
          border: '1px dashed var(--line-2)',
          borderRadius: 12,
          textAlign: 'center',
          color: 'var(--muted)',
          fontSize: 13,
        }}>
          <p style={{ margin: '0 0 12px' }}>먼저 인도자를 선택하세요.</p>
          <button
            type="button"
            onClick={() => setStep(1)}
            style={{
              height: 36, padding: '0 16px',
              background: 'var(--ink)', color: '#fff',
              border: 'none', borderRadius: 8,
              fontSize: 13, fontWeight: 600, cursor: 'pointer',
              letterSpacing: '-0.005em',
            }}
          >
            인도자 선택으로 가기
          </button>
        </div>
      )}
      {step === 2 && selectedLeaders.size > 0 && (
        <>
          {/* 선택된 인도자 chip 행 */}
          <div style={{
            display: 'flex', flexWrap: 'wrap', gap: 6,
            marginBottom: 12, padding: '0 2px', alignItems: 'center',
          }}>
            <span style={{ fontSize: 12, color: 'var(--muted)', fontWeight: 500, marginRight: 2 }}>
              선택된 인도자
            </span>
            {[...selectedLeaders].map((name) => (
              <span
                key={name}
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: 4,
                  height: 26, padding: '0 8px 0 8px',
                  background: 'var(--ink)', color: '#fff',
                  borderRadius: 99, fontSize: 12, fontWeight: 600,
                  letterSpacing: '-0.005em',
                }}
              >
                {name}
                <button
                  type="button"
                  onClick={() => toggleLeaderSelection(name)}
                  aria-label={`${name} 선택 해제`}
                  style={{
                    width: 16, height: 16, minHeight: 16,
                    display: 'grid', placeItems: 'center',
                    background: 'transparent', border: 'none',
                    color: 'rgba(255,255,255,0.7)', cursor: 'pointer',
                    fontSize: 13, lineHeight: 1, padding: 0, marginLeft: 2,
                  }}
                >×</button>
              </span>
            ))}
            <button
              type="button"
              onClick={() => setStep(1)}
              style={{
                height: 26, padding: '0 10px',
                background: 'transparent', border: '1px dashed var(--line-2)',
                color: 'var(--muted)', borderRadius: 99,
                fontSize: 12, fontWeight: 500, cursor: 'pointer',
              }}
            >+ 추가</button>
          </div>

          {/* 검색 + 지도 버튼 */}
          <div style={{ display: 'flex', gap: 8, alignItems: 'stretch' }}>
            <div style={{ flex: 1 }}>
              <SearchInput value={cardQuery} onChange={setCardQuery} placeholder="구·동 검색" />
            </div>
            <button
              type="button"
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 5,
                height: 42, minHeight: 42, padding: '0 12px',
                border: '1px solid var(--line-2)', background: 'var(--surface)',
                color: 'var(--text)', borderRadius: 10,
                fontSize: 13, fontWeight: 600, cursor: 'pointer',
              }}
              onClick={() => showToast('지도 보기는 다음 라운드', 'info')}
            >
              <MapIcon size={16} /> 지도
            </button>
          </div>

          {/* 지역 pills (compact) + 미배정만 토글 */}
          <div style={{
            display: 'flex', gap: 6, marginTop: 12, alignItems: 'center',
            padding: '0 2px', flexWrap: 'wrap',
          }}>
            <CompactPill label={`전체 ${cardPool.length}`} active={regionPill === '전체'} onClick={() => setRegionPill('전체')} />
            {(() => {
              const sorted = regions.slice().sort((a, b) => (regionCounts.get(b) ?? 0) - (regionCounts.get(a) ?? 0))
              const visible = sorted.slice(0, 3)
              const overflow = sorted.length - visible.length
              return (
                <>
                  {visible.map((r) => (
                    <CompactPill key={r} label={`${r} ${regionCounts.get(r) ?? 0}`} active={regionPill === r} onClick={() => setRegionPill(r)} />
                  ))}
                  {overflow > 0 && (
                    <CompactPill label={`+ ${overflow}`} active={false} onClick={() => {
                      // 다음 region 으로 cycle
                      const idx = sorted.indexOf(regionPill)
                      const nextIdx = idx === -1 || idx >= visible.length - 1 ? visible.length : idx + 1
                      setRegionPill(sorted[nextIdx] ?? '전체')
                    }} />
                  )}
                </>
              )
            })()}
            <span style={{ flex: 1 }} />
            <label style={{
              display: 'inline-flex', alignItems: 'center', gap: 6,
              fontSize: 12, color: 'var(--muted)', cursor: 'pointer',
              padding: '4px 2px',
            }}>
              <input
                type="checkbox"
                checked={unassignedOnly}
                onChange={(e) => setUnassignedOnly(e.target.checked)}
                style={{ width: 14, height: 14, accentColor: 'var(--ink)' }}
              />
              미배정만
            </label>
          </div>

          {/* 그룹 카드 리스트 */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 14 }}>
            {grouped.length === 0 ? (
              <div style={{
                padding: '40px 16px', textAlign: 'center', fontSize: 13,
                color: 'var(--muted)',
                background: 'var(--surface)', border: '1px solid var(--line)',
                borderRadius: 12,
              }}>
                {cardQuery ? '검색 결과가 없습니다' : unassignedOnly ? '미배정 구역이 없습니다' : '구역이 없습니다'}
              </div>
            ) : grouped.map((g) => {
              const isExpanded = expandedGroups.has(g.key)
              const isRowExpanded = expandedRows.has(g.key)
              const visibleCards = isRowExpanded ? g.cards : g.cards.slice(0, 5)
              const hiddenCount = g.cards.length - visibleCards.length
              // 선택된 인도자 중 하나라도 담당인 카드 수 (전체 배정/해제 토글용)
              const mineInGroup = g.cards.filter((c) => {
                const cl = getCardLeaders(c)
                return selectedLeadersArr.some((name) => cl.includes(name))
              }).length
              const allMine = mineInGroup === g.cards.length
              return (
                <div
                  key={g.key}
                  style={{
                    background: 'var(--surface)', border: '1px solid var(--line)',
                    borderRadius: 12, padding: '12px 14px',
                  }}
                >
                  {/* 그룹 헤더 */}
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                    <button
                      type="button"
                      onClick={() => toggleGroup(g.key)}
                      style={{
                        flex: 1, minHeight: 0, padding: 0,
                        display: 'flex', alignItems: 'center', gap: 8,
                        background: 'transparent', border: 'none', cursor: 'pointer',
                        textAlign: 'left',
                      }}
                    >
                      <span style={{
                        transform: isExpanded ? 'rotate(0deg)' : 'rotate(-90deg)',
                        transition: 'transform 0.15s', color: 'var(--text)',
                        display: 'inline-flex',
                      }}>
                        <ChevD />
                      </span>
                      <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>
                        <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--ink)' }}>
                          {g.key}
                        </span>
                        <span style={{ fontSize: 12, color: 'var(--muted)' }}>
                          전체 {g.totalInArea} · 미배정 {g.unassignedInArea}
                        </span>
                      </div>
                    </button>
                    <button
                      type="button"
                      onClick={() => void (allMine ? unassignWholeGroup(g) : assignWholeGroup(g))}
                      style={{
                        height: 28, minHeight: 28, padding: '0 10px',
                        border: 'none', borderRadius: 8,
                        background: allMine ? 'var(--status-danger-bg)' : 'var(--tint)',
                        color: allMine ? 'var(--status-danger)' : 'var(--text)',
                        fontSize: 12, fontWeight: 600, cursor: 'pointer',
                      }}
                    >
                      {allMine ? '전체 해제' : '전체 배정'}
                    </button>
                  </div>

                  {/* 그룹 내 카드들 */}
                  {isExpanded && (
                    <>
                      <div style={{ height: 1, background: 'var(--line)', margin: '10px -4px' }} />
                      <div>
                        {visibleCards.map((card) => {
                          const cardLeaders = getCardLeaders(card)
                          const isFree = cardLeaders.length === 0
                          const isMine = selectedLeadersArr.some((name) => cardLeaders.includes(name))
                          const justAssigned = sessionAssigned.has(card.id)
                          return (
                            <div
                              key={card.id}
                              style={{
                                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                                padding: '8px 4px', gap: 8,
                              }}
                            >
                              <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>
                                <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--ink)' }}>
                                  {card.name}
                                </span>
                                {!isFree && (
                                  <span style={{ fontSize: 12, color: 'var(--muted)' }}>
                                    {isMine ? '내가 담당' : `${cardLeaders.join(', ')}에게 배정됨`}
                                  </span>
                                )}
                              </div>
                              {isFree ? (
                                <button
                                  type="button"
                                  onClick={() => void assignCard(card)}
                                  style={{
                                    height: 30, minHeight: 30, padding: '0 12px',
                                    border: 'none', borderRadius: 8,
                                    background: 'var(--ink)', color: '#fff',
                                    fontSize: 12, fontWeight: 600, cursor: 'pointer',
                                  }}
                                >
                                  배정
                                </button>
                              ) : isMine ? (
                                <button
                                  type="button"
                                  onClick={() => void handleUnassign(card)}
                                  style={{
                                    height: 26, minHeight: 26,
                                    fontSize: 11.5, fontWeight: 600,
                                    padding: '3px 9px', borderRadius: 999,
                                    background: justAssigned ? 'var(--status-ok-bg)' : 'var(--tint)',
                                    color: justAssigned ? 'var(--status-ok)' : 'var(--muted)',
                                    border: 'none',
                                    cursor: 'pointer',
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: 4,
                                  }}
                                  title="탭해서 배정 해제"
                                >
                                  배정됨
                                  <svg width={10} height={10} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                                    <line x1="6" y1="6" x2="18" y2="18" />
                                    <line x1="18" y1="6" x2="6" y2="18" />
                                  </svg>
                                </button>
                              ) : (
                                <button
                                  type="button"
                                  onClick={() => setActionTarget(card)}
                                  style={{
                                    height: 30, minHeight: 30, padding: '0 12px',
                                    border: '1px solid var(--line-2)', borderRadius: 8,
                                    background: 'var(--surface)', color: 'var(--text)',
                                    fontSize: 12, fontWeight: 600, cursor: 'pointer',
                                  }}
                                >
                                  관리
                                </button>
                              )}
                            </div>
                          )
                        })}
                        {hiddenCount > 0 && (
                          <button
                            type="button"
                            onClick={() => setExpandedRows((prev) => new Set([...prev, g.key]))}
                            style={{
                              padding: '8px 0', minHeight: 0,
                              background: 'transparent', border: 'none',
                              fontSize: 12, fontWeight: 500, color: 'var(--muted)',
                              cursor: 'pointer', width: '100%', textAlign: 'left',
                            }}
                          >
                            {hiddenCount}개 더 보기
                          </button>
                        )}
                      </div>
                    </>
                  )}
                </div>
              )
            })}
          </div>

          {/* sticky 하단: 이번 세션 + 완료 */}
          <StickyBottom>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <span style={{ flex: 1, fontSize: 13, color: 'var(--ink)', fontWeight: 600 }}>
                이번 세션 {sessionAssigned.size}개 배정
              </span>
              <button
                type="button"
                onClick={() => {
                  setStep(1)
                  setSelectedLeaders(new Set())
                  setSessionAssigned(new Set())
                  showToast(sessionAssigned.size > 0 ? `${sessionAssigned.size}개 배정 완료` : '완료', sessionAssigned.size > 0 ? 'success' : 'info')
                }}
                style={{
                  height: 44, minHeight: 44, padding: '0 18px',
                  border: 'none', borderRadius: 8,
                  background: 'var(--ink)', color: '#fff',
                  fontSize: 14, fontWeight: 600, cursor: 'pointer',
                }}
              >
                완료
              </button>
            </div>
          </StickyBottom>
        </>
      )}

      {/* ── 추가 / 변경 / 해제 액션 시트 (이미 배정된 카드) ────── */}
      {actionTarget && (
        <div
          onClick={() => setActionTarget(null)}
          style={{
            position: 'fixed', inset: 0, zIndex: 200,
            background: 'rgba(26,26,24,0.34)',
            display: 'flex', flexDirection: 'column', justifyContent: 'flex-end',
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              background: 'var(--bg)',
              borderTopLeftRadius: 18, borderTopRightRadius: 18,
              padding: '8px 16px max(18px, env(safe-area-inset-bottom))',
              display: 'flex', flexDirection: 'column',
            }}
          >
            <div style={{ width: 32, height: 4, borderRadius: 99, background: 'var(--line-2)', margin: '4px auto 14px' }} />
            <div style={{ marginBottom: 12 }}>
              <span style={{ fontSize: 18, fontWeight: 700, color: 'var(--ink)' }}>{actionTarget.name}</span>
              <p style={{ margin: '4px 0 0', fontSize: 13, color: 'var(--muted)' }}>
                현재 담당: <span style={{ color: 'var(--ink)', fontWeight: 600 }}>{getCardLeaders(actionTarget).join(', ')}</span>
              </p>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <SheetButton
                label={`${selectedLeader} 추가 배정`}
                sub="기존 인도자 유지, 같이 담당"
                onClick={() => void handleAddToAssignment(actionTarget)}
              />
              <SheetButton
                label={`${selectedLeader} 로 변경`}
                sub="기존 인도자 해제하고 이 인도자만"
                onClick={() => {
                  if (confirm(`기존 인도자(${getCardLeaders(actionTarget).join(', ')})를 해제하고 ${selectedLeader} 로 변경할까요?`)) {
                    void handleReplaceAssignment(actionTarget)
                  }
                }}
              />
              <SheetButton
                label="배정 모두 해제"
                sub="이 카드를 미배정 상태로"
                danger
                onClick={() => {
                  if (confirm(`"${actionTarget.name}" 의 모든 인도자 배정을 해제할까요?`)) {
                    void Promise.resolve(onSetCardLeaders(actionTarget.id, [], { silentSuccess: true })).then(() => {
                      setSessionAssigned((prev) => {
                        const next = new Set(prev)
                        next.delete(actionTarget.id)
                        return next
                      })
                      setActionTarget(null)
                      showToast(`${actionTarget.name} 배정 해제`, 'info')
                    })
                  }
                }}
              />
              <button
                type="button"
                onClick={() => setActionTarget(null)}
                style={{
                  width: '100%', height: 44, minHeight: 44, marginTop: 6,
                  background: 'transparent', border: 'none',
                  fontSize: 14, fontWeight: 600, color: 'var(--muted)',
                  cursor: 'pointer',
                }}
              >
                취소
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function SheetButton({ label, sub, onClick, danger }: { label: string; sub?: string; onClick: () => void; danger?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        width: '100%', textAlign: 'left', minHeight: 0,
        padding: '14px 16px',
        background: 'var(--surface)', border: '1px solid var(--line)',
        borderRadius: 10, cursor: 'pointer',
        display: 'flex', flexDirection: 'column', gap: 2,
      }}
    >
      <span style={{ fontSize: 14, fontWeight: 600, color: danger ? 'var(--status-danger)' : 'var(--ink)' }}>{label}</span>
      {sub && <span style={{ fontSize: 12, color: 'var(--muted)' }}>{sub}</span>}
    </button>
  )
}

// ── 인도자 카드 ───────────────────────────
function LeaderCard({
  name, stats, isSelected, onClick, muted, isMe,
}: {
  name: string
  stats: { assigned: number; inProgress: number; done: number }
  isSelected: boolean
  onClick: () => void
  muted?: boolean
  isMe?: boolean
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        display: 'flex', alignItems: 'center', gap: 12,
        padding: 14, width: '100%', minHeight: 0,
        background: 'var(--surface)',
        border: isSelected
          ? '1.5px solid var(--ink)'
          : isMe
            ? '1.5px solid var(--ink)'
            : '1px solid var(--line)',
        borderRadius: 12,
        cursor: 'pointer', textAlign: 'left',
        transition: 'border-color 0.15s',
      }}
    >
      <Avatar name={name} muted={muted} />
      <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 4 }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
          <span style={{ fontSize: 15, fontWeight: 600, color: 'var(--ink)' }}>{name}</span>
          {isMe && (
            <span style={{ fontSize: 12, color: 'var(--muted)', fontWeight: 500 }}>(나)</span>
          )}
        </div>
        {!muted && (
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, fontSize: 12.5, color: 'var(--muted)' }}>
            <span><span style={{ color: 'var(--muted)' }}>담당</span> <b style={{ color: 'var(--ink)', fontWeight: 600, fontVariantNumeric: 'tabular-nums', marginLeft: 3 }}>{stats.assigned}</b></span>
            <span style={{ color: 'var(--muted-3)' }}>·</span>
            <span><span style={{ color: 'var(--muted)' }}>진행</span> <b style={{ color: 'var(--ink)', fontWeight: 600, fontVariantNumeric: 'tabular-nums', marginLeft: 3 }}>{stats.inProgress}</b></span>
            <span style={{ color: 'var(--muted-3)' }}>·</span>
            <span><span style={{ color: 'var(--muted)' }}>완료</span> <b style={{ color: 'var(--ink)', fontWeight: 600, fontVariantNumeric: 'tabular-nums', marginLeft: 3 }}>{stats.done}</b></span>
          </div>
        )}
        {muted && (
          <span style={{ fontSize: 12.5, color: 'var(--muted)' }}>담당 없음</span>
        )}
      </div>
      {isSelected && (
        <span style={{
          width: 22, height: 22, borderRadius: '50%',
          background: 'var(--ink)', display: 'grid', placeItems: 'center',
          color: '#fff', flexShrink: 0,
        }}>
          <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round">
            <polyline points="5 13 10 18 19 8" />
          </svg>
        </span>
      )}
    </button>
  )
}

// ── 섹션 divider ──────────────────────────
function SectionDivider({ label, count, marginTop = 14 }: { label: string; count?: number; marginTop?: number }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 10,
      marginTop, padding: '0 4px',
    }}>
      <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--muted)' }}>
        {label}
        {count !== undefined && (
          <span style={{ marginLeft: 6, color: 'var(--muted-2)', fontWeight: 500, fontVariantNumeric: 'tabular-nums' }}>{count}</span>
        )}
      </span>
      <span style={{ flex: 1, height: 1, background: 'var(--line)' }} />
    </div>
  )
}

// ── 헬퍼 컴포넌트 ───────────────────────────
function StepPill({
  no, label, active, disabled, onClick,
}: {
  no: number
  label: string
  active: boolean
  disabled?: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      style={{
        display: 'flex', alignItems: 'center', gap: 8,
        padding: '9px 14px', minHeight: 0,
        borderRadius: 10, border: 'none',
        background: active ? 'var(--ink)' : 'var(--tint)',
        color: active ? '#fff' : 'var(--muted)',
        fontSize: 13, fontWeight: active ? 600 : 500,
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.5 : 1,
        letterSpacing: '-0.005em',
      }}
    >
      <span style={{
        width: 18, height: 18, borderRadius: '50%',
        display: 'grid', placeItems: 'center',
        background: active ? '#fff' : 'var(--muted-2)',
        color: active ? 'var(--ink)' : '#fff',
        fontSize: 10.5, fontWeight: 700,
        fontVariantNumeric: 'tabular-nums',
      }}>
        {no}
      </span>
      {label}
    </button>
  )
}

function FilterPill({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        height: 32, minHeight: 32, padding: '0 12px',
        border: '1px solid',
        borderColor: active ? 'var(--ink)' : 'var(--line)',
        background: active ? 'var(--ink)' : 'var(--surface)',
        color: active ? '#fff' : 'var(--text)',
        borderRadius: 999,
        fontSize: 13, fontWeight: active ? 600 : 500,
        cursor: 'pointer', flexShrink: 0,
        fontVariantNumeric: 'tabular-nums',
      }}
    >
      {label}
    </button>
  )
}

// 디자인 08 의 .pill 매칭 (11.5/500, 3-9 padding, 999 radius)
function CompactPill({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        height: 24, minHeight: 24, padding: '3px 9px',
        border: 'none',
        background: active ? 'var(--ink)' : 'var(--tint)',
        color: active ? '#fff' : 'var(--text)',
        borderRadius: 999,
        fontSize: 11.5, fontWeight: active ? 600 : 500,
        cursor: 'pointer', flexShrink: 0,
        fontVariantNumeric: 'tabular-nums',
        letterSpacing: 0,
      }}
    >
      {label}
    </button>
  )
}

function SearchInput({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder: string }) {
  return (
    <label style={{
      background: 'var(--surface)', border: '1px solid var(--line)',
      borderRadius: 10, padding: '11px 14px',
      fontSize: 14, color: 'var(--text)',
      display: 'flex', alignItems: 'center', gap: 8, cursor: 'text',
    }}>
      <span style={{ color: 'var(--muted-2)', display: 'inline-flex' }}><SearchIcon /></span>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        style={{
          flex: 1, minWidth: 0, border: 'none', outline: 'none',
          background: 'transparent', font: 'inherit', color: 'inherit', padding: 0,
        }}
      />
    </label>
  )
}

function StickyBottom({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      position: 'fixed', left: 0, right: 0, bottom: 0, zIndex: 150,
      padding: '12px 16px max(14px, env(safe-area-inset-bottom))',
      background: 'var(--bg)',
      borderTop: '1px solid var(--line)',
      boxShadow: '0 -8px 24px rgba(0,0,0,0.06)',
    }}>
      {children}
    </div>
  )
}
