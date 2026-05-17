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

type LeaderFilter = 'all' | 'active' | 'new'

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
  onSetCardLeaders,
}: {
  cards: TerritoryCard[]
  leaderNames?: string[]
  onSetCardLeaders: (cardId: number, leaders: string[], options?: { silentSuccess?: boolean }) => Promise<void> | void
}) {
  const [step, setStep] = useState<1 | 2>(1)
  const [selectedLeader, setSelectedLeader] = useState<string | null>(null)
  const [leaderFilter, setLeaderFilter] = useState<LeaderFilter>('all')
  const [leaderSearch, setLeaderSearch] = useState('')
  const [cardQuery, setCardQuery] = useState('')
  const [regionPill, setRegionPill] = useState<string>('전체')
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set())
  const [sessionAssigned, setSessionAssigned] = useState<Set<number>>(new Set())

  const leaders = useMemo(() => {
    const names = leaderNames.length > 0
      ? leaderNames
      : Array.from(new Set(cards.flatMap((card) => getCardLeaders(card))))
    return names.sort((a, b) => a.localeCompare(b, 'ko'))
  }, [cards, leaderNames])

  const leaderCardCount = useMemo(() => {
    const m = new Map<string, number>()
    cards.forEach((card) => {
      getCardLeaders(card).forEach((leader) => m.set(leader, (m.get(leader) ?? 0) + 1))
    })
    return m
  }, [cards])

  const activeLeaders = leaders.filter((l) => (leaderCardCount.get(l) ?? 0) > 0)
  const newLeaders = leaders.filter((l) => (leaderCardCount.get(l) ?? 0) === 0)

  const visibleLeaders = useMemo(() => {
    const base = leaderFilter === 'active' ? activeLeaders
      : leaderFilter === 'new' ? newLeaders
      : leaders
    const q = leaderSearch.trim()
    return q ? base.filter((l) => l.includes(q)) : base
  }, [leaderFilter, activeLeaders, newLeaders, leaders, leaderSearch])

  const unassignedCount = cards.filter((card) => getCardLeaders(card).length === 0).length
  const regions = useMemo(() => {
    return Array.from(new Set(cards.filter((c) => getCardLeaders(c).length === 0).map((c) => c.region))).sort((a, b) => a.localeCompare(b, 'ko'))
  }, [cards])

  // ── Step 2: 미배정 카드 + 검색 + 지역 pill 필터 ────────
  const unassignedFiltered = useMemo(() => {
    const q = cardQuery.trim()
    return cards
      .filter((c) => getCardLeaders(c).length === 0)
      .filter((c) => regionPill === '전체' || c.region === regionPill)
      .filter((c) => !q || `${c.name} ${c.region} ${c.area}`.includes(q))
  }, [cards, cardQuery, regionPill])

  // ── Step 2: 그룹화 (region · area) ─────────────────
  const grouped = useMemo(() => {
    const m = new Map<string, TerritoryCard[]>()
    unassignedFiltered.forEach((c) => {
      const key = `${c.region} · ${c.area}`
      const list = m.get(key) ?? []
      list.push(c)
      m.set(key, list)
    })
    return Array.from(m.entries())
      .map(([key, cs]) => ({ key, cards: cs }))
      .sort((a, b) => a.key.localeCompare(b.key, 'ko'))
  }, [unassignedFiltered])

  const assignCard = async (card: TerritoryCard) => {
    if (!selectedLeader) {
      showToast('인도자를 먼저 선택하세요.', 'info')
      return
    }
    const cardLeaders = getCardLeaders(card)
    if (cardLeaders.includes(selectedLeader)) return
    await Promise.resolve(onSetCardLeaders(card.id, [...cardLeaders, selectedLeader], { silentSuccess: true }))
    setSessionAssigned((prev) => new Set([...prev, card.id]))
    showToast(`${card.name} 배정 완료`)
  }

  const assignWholeGroup = async (group: { key: string; cards: TerritoryCard[] }) => {
    if (!selectedLeader) return
    let count = 0
    for (const card of group.cards) {
      const cardLeaders = getCardLeaders(card)
      if (cardLeaders.includes(selectedLeader)) continue
      await Promise.resolve(onSetCardLeaders(card.id, [...cardLeaders, selectedLeader], { silentSuccess: true }))
      count += 1
    }
    if (count > 0) {
      setSessionAssigned((prev) => {
        const next = new Set(prev)
        group.cards.forEach((c) => next.add(c.id))
        return next
      })
      showToast(`${group.key} 전체 ${count}개 배정 완료`, 'success')
    }
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
        <StepPill no={2} label="구역 배정" active={step === 2} disabled={!selectedLeader} onClick={() => selectedLeader && setStep(2)} />
      </div>

      {/* ── Step 1: 인도자 선택 ───────────── */}
      {step === 1 && (
        <>
          {/* 필터 pills */}
          <div style={{ display: 'flex', gap: 6, marginBottom: 12, padding: '0 2px' }}>
            <FilterPill label={`전체 ${leaders.length}`} active={leaderFilter === 'all'} onClick={() => setLeaderFilter('all')} />
            <FilterPill label={`활성 ${activeLeaders.length}`} active={leaderFilter === 'active'} onClick={() => setLeaderFilter('active')} />
            <FilterPill label={`신규 ${newLeaders.length}`} active={leaderFilter === 'new'} onClick={() => setLeaderFilter('new')} />
          </div>

          {/* 검색 */}
          <SearchInput value={leaderSearch} onChange={setLeaderSearch} placeholder="인도자 검색" />

          {/* 리스트 */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 14 }}>
            {visibleLeaders.length === 0 ? (
              <div style={{
                padding: '32px 16px', textAlign: 'center', fontSize: 13,
                color: 'var(--muted)',
                background: 'var(--surface)', border: '1px solid var(--line)',
                borderRadius: 12,
              }}>
                {leaderSearch ? '검색 결과가 없습니다' : '인도자가 없습니다'}
              </div>
            ) : (
              visibleLeaders.map((leader) => {
                const count = leaderCardCount.get(leader) ?? 0
                const isNew = count === 0
                const isSelected = selectedLeader === leader
                return (
                  <button
                    key={leader}
                    type="button"
                    onClick={() => setSelectedLeader(leader)}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 12,
                      padding: 14, width: '100%', minHeight: 0,
                      background: 'var(--surface)',
                      border: isSelected ? '1.5px solid var(--ink)' : '1px solid var(--line)',
                      borderRadius: 12,
                      cursor: 'pointer', textAlign: 'left',
                      transition: 'border-color 0.15s',
                    }}
                  >
                    <Avatar name={leader} muted={isNew} />
                    <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 2 }}>
                      <span style={{ fontSize: 15, fontWeight: 600, color: 'var(--ink)' }}>{leader}</span>
                      <span style={{ fontSize: 12, color: 'var(--muted)' }}>
                        {isNew ? '담당 없음' : `담당 ${count}개`}
                      </span>
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
              })
            )}
          </div>

          {/* sticky 하단: 다음 단계 */}
          {selectedLeader && (
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
                {selectedLeader} 담당 구역 배정하기
                <ChevR color="#fff" />
              </button>
            </StickyBottom>
          )}
        </>
      )}

      {/* ── Step 2: 구역 배정 ───────────── */}
      {step === 2 && selectedLeader && (
        <>
          {/* 헤더 텍스트 */}
          <div style={{ padding: '0 4px', marginBottom: 12 }}>
            <p style={{ margin: 0, fontSize: 13, color: 'var(--muted)' }}>
              <span style={{ fontWeight: 600, color: 'var(--ink)' }}>{selectedLeader}</span> 에게 배정 ·
              미배정 <span style={{ fontWeight: 600, color: 'var(--status-danger)' }}>{unassignedCount}</span>
            </p>
          </div>

          {/* 검색 */}
          <SearchInput value={cardQuery} onChange={setCardQuery} placeholder="구역명 또는 동 검색" />

          {/* 지역 pills */}
          <div style={{
            display: 'flex', gap: 6, marginTop: 12,
            overflowX: 'auto',
            paddingBottom: 4,
            marginLeft: -16, marginRight: -16,
            paddingLeft: 16, paddingRight: 16,
          }}>
            <FilterPill label={`전체 ${unassignedCount}`} active={regionPill === '전체'} onClick={() => setRegionPill('전체')} />
            {regions.map((r) => {
              const count = cards.filter((c) => c.region === r && getCardLeaders(c).length === 0).length
              return (
                <FilterPill key={r} label={`${r} ${count}`} active={regionPill === r} onClick={() => setRegionPill(r)} />
              )
            })}
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
                {cardQuery ? '검색 결과가 없습니다' : '미배정 구역이 없습니다'}
              </div>
            ) : grouped.map((g) => {
              const isExpanded = expandedGroups.has(g.key)
              return (
                <div
                  key={g.key}
                  style={{
                    background: 'var(--surface)', border: '1px solid var(--line)',
                    borderRadius: 12, overflow: 'hidden',
                  }}
                >
                  {/* 그룹 헤더 */}
                  <div style={{
                    display: 'flex', alignItems: 'center', gap: 12,
                    padding: 14,
                  }}>
                    <button
                      type="button"
                      onClick={() => toggleGroup(g.key)}
                      style={{
                        flex: 1, minHeight: 0, padding: 0,
                        display: 'flex', alignItems: 'center', gap: 10,
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
                      <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 2 }}>
                        <span style={{ fontSize: 15, fontWeight: 600, color: 'var(--ink)' }}>
                          {g.key}
                        </span>
                        <span style={{ fontSize: 12, color: 'var(--muted)' }}>
                          미배정 {g.cards.length}개
                        </span>
                      </div>
                    </button>
                    <button
                      type="button"
                      onClick={() => void assignWholeGroup(g)}
                      style={{
                        height: 32, minHeight: 32, padding: '0 12px',
                        border: 'none', borderRadius: 8,
                        background: 'var(--tint)', color: 'var(--text)',
                        fontSize: 12, fontWeight: 600, cursor: 'pointer',
                      }}
                    >
                      전체 배정
                    </button>
                  </div>

                  {/* 그룹 내 카드들 */}
                  {isExpanded && (
                    <div style={{ borderTop: '1px solid var(--line)' }}>
                      {g.cards.map((card, idx) => {
                        const justAssigned = sessionAssigned.has(card.id)
                        return (
                          <div
                            key={card.id}
                            style={{
                              display: 'flex', alignItems: 'center', gap: 12,
                              padding: '12px 14px',
                              borderTop: idx === 0 ? 'none' : '1px solid var(--line)',
                            }}
                          >
                            <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 2 }}>
                              <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--ink)' }}>
                                {card.name}
                              </span>
                              <span style={{ fontSize: 12, color: 'var(--muted)' }}>
                                세대 {card.units}
                              </span>
                            </div>
                            {justAssigned ? (
                              <span style={{
                                fontSize: 11.5, fontWeight: 600,
                                padding: '4px 10px', borderRadius: 999,
                                background: 'var(--status-ok-bg)', color: 'var(--status-ok)',
                              }}>
                                배정됨
                              </span>
                            ) : (
                              <button
                                type="button"
                                onClick={() => void assignCard(card)}
                                style={{
                                  height: 30, minHeight: 30, padding: '0 14px',
                                  border: 'none', borderRadius: 8,
                                  background: 'var(--ink)', color: '#fff',
                                  fontSize: 12, fontWeight: 600, cursor: 'pointer',
                                }}
                              >
                                배정
                              </button>
                            )}
                          </div>
                        )
                      })}
                    </div>
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
                  setSelectedLeader(null)
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
