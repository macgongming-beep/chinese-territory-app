import { useEffect, useMemo, useState } from 'react'
import { Routes, Route, useNavigate, useLocation, useSearchParams } from 'react-router-dom'
import { MobileCalendar } from './MobileCalendar'
import { MobileLeaderAssignment } from './MobileLeaderAssignment'
import { MobileMap } from './MobileMap'
import { MobileNotices } from './MobileNotices'
import { MobileTerritory } from './MobileTerritory'
import { DesktopUsers } from './DesktopUsers'
import type { Building, CalendarEvent, CardBoundary, Notice, ReturnVisit, ReturnVisitLog, Role, ServiceSession, TerritoryCard, TimeSlot, Unit, UnitStatus, VisitHistory } from '../types'
import { roleLabels } from '../types'

type MobileTab = '홈' | '캘린더' | '나의봉사' | '구역' | '지도' | '배정' | '설정'

const tabToPath: Record<MobileTab, string> = {
  '홈': '/',
  '캘린더': '/calendar',
  '나의봉사': '/territory',
  '구역': '/zone',
  '지도': '/map',
  '배정': '/assignment',
  '설정': '/settings',
}

const pathToTab: Record<string, MobileTab> = {
  '/': '홈',
  '/notices': '설정',
  '/calendar': '캘린더',
  '/territory': '나의봉사',
  '/zone': '구역',
  '/map': '지도',
  '/assignment': '배정',
  '/users': '설정',
  '/settings': '설정',
}

type IconName = 'home' | 'calendar' | 'territory' | 'map' | 'assignment' | 'settings' | 'notice'

const navIcons: Record<MobileTab, IconName> = {
  '홈': 'home',
  '캘린더': 'calendar',
  '나의봉사': 'territory',
  '구역': 'territory',
  '지도': 'map',
  '배정': 'assignment',
  '설정': 'settings',
}

const weekdayLabels = ['일요일', '월요일', '화요일', '수요일', '목요일', '금요일', '토요일']

function formatKoreanDate(date: Date) {
  return `${date.getFullYear()}년 ${date.getMonth() + 1}월 ${date.getDate()}일 ${weekdayLabels[date.getDay()]}`
}


function NavIcon({ name }: { name: IconName }) {
  if (name === 'home') {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M4 11.5 12 5l8 6.5" />
        <path d="M6.5 10.5V20h11V10.5" />
        <path d="M10 20v-5h4v5" />
      </svg>
    )
  }
  if (name === 'calendar') {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M7 4v3M17 4v3M5 9h14" />
        <rect x="5" y="6" width="14" height="14" rx="2" />
      </svg>
    )
  }
  if (name === 'territory') {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="m4 7 5-2 6 2 5-2v12l-5 2-6-2-5 2Z" />
        <path d="M9 5v12M15 7v12" />
      </svg>
    )
  }
  if (name === 'map') {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M12 21s6-5.4 6-11a6 6 0 0 0-12 0c0 5.6 6 11 6 11Z" />
        <circle cx="12" cy="10" r="2.2" />
      </svg>
    )
  }
  if (name === 'settings') {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <circle cx="12" cy="12" r="3" />
        <path d="M19 12a7.5 7.5 0 0 0-.1-1.2l2-1.5-2-3.4-2.4 1a7.4 7.4 0 0 0-2.1-1.2L14 3h-4l-.4 2.7a7.4 7.4 0 0 0-2.1 1.2l-2.4-1-2 3.4 2 1.5A7.5 7.5 0 0 0 5 12c0 .4 0 .8.1 1.2l-2 1.5 2 3.4 2.4-1a7.4 7.4 0 0 0 2.1 1.2L10 21h4l.4-2.7a7.4 7.4 0 0 0 2.1-1.2l2.4 1 2-3.4-2-1.5c.1-.4.1-.8.1-1.2Z" />
      </svg>
    )
  }
  if (name === 'assignment') {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M4 7h16M4 12h10M4 17h7" />
        <path d="m17 11 3 3-3 3" />
      </svg>
    )
  }
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M12 4v10" />
      <path d="M12 18h.01" />
    </svg>
  )
}


// 구 표시 순서
const REGION_ORDER = ['처인구', '기흥구', '수지구', '영통구', '화성시']

// 상태 → 정렬 순서 (담당 구역 뷰에서 사용)
const STATUS_ORDER: Record<string, number> = { '방문필요': 0, '진행중': 1, '완료': 2 }

function getCardStatus(card: TerritoryCard): '방문필요' | '진행중' | '완료' {
  if (card.progress >= 100) return '완료'
  if (card.progress > 0) return '진행중'
  return '방문필요'
}

/** 방문일 → 간략 표시: 오늘/어제/N일 전/M/D */
function formatLastVisit(dateStr: string | undefined): string {
  if (!dateStr) return '-'
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const d = new Date(dateStr.slice(0, 10))
  d.setHours(0, 0, 0, 0)
  const diffDays = Math.round((today.getTime() - d.getTime()) / 86400000)
  if (diffDays === 0) return '오늘'
  if (diffDays === 1) return '어제'
  if (diffDays < 30) return `${diffDays}일 전`
  return `${d.getMonth() + 1}/${d.getDate()}`
}

/** 카드명에서 구(region) 접두사 제거: "처인구 고림동 1" → "고림동 1" */
function stripRegionFromName(name: string, region: string): string {
  if (region && name.startsWith(region)) return name.slice(region.length).trimStart()
  // 표준 구 이름도 시도
  for (const r of REGION_ORDER) {
    if (name.startsWith(r + ' ')) return name.slice(r.length + 1)
    if (name.startsWith(r)) return name.slice(r.length).trimStart()
  }
  return name
}

/** 카드명에서 동 이름 추출: "고림동 1" → "고림동" */
function extractDong(cardName: string, region: string): string {
  const withoutRegion = stripRegionFromName(cardName, region)
  const parts = withoutRegion.trim().split(/\s+/)
  return parts.length >= 2 ? parts[0] : '기타'
}

type ZoneLevel = 'regions' | 'dongs' | 'cards'

// 인도자·관리자용 구역 탭
// scope='mine' → 담당 구역 (원래 상태별 그룹 뷰)
// scope='all'  → 전체 구역 (구→동→카드 드릴다운)
function MobileZoneView({
  cards,
  buildings = [],
  visitHistories = [],
  currentVisitor,
  onOpenMap,
  onShowMapView,
}: {
  cards: TerritoryCard[]
  buildings?: Building[]
  visitHistories?: VisitHistory[]
  currentVisitor: string
  onOpenMap: (cardId: number) => void
  onShowMapView: () => void
}) {
  const [searchParams, setSearchParams] = useSearchParams()
  const initRegion = searchParams.get('region') ?? ''
  const initDong = searchParams.get('dong') ?? ''
  const isReset = searchParams.get('reset') === 'true'

  const [scope, setScope] = useState<'mine' | 'all'>('mine')
  // 전체 구역 drill-down 상태
  const [level, setLevel] = useState<ZoneLevel>('regions')
  const [selectedRegion, setSelectedRegion] = useState('')
  const [selectedDong, setSelectedDong] = useState('')
  const [query, setQuery] = useState('')

  // URL 파라미터 사용 후 즉시 제거 (뒤로가기 시 재진입 방지)
  useEffect(() => {
    if (initRegion || initDong || isReset) setSearchParams({}, { replace: true })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  // 담당 구역 아코디언 상태
  const [collapsedRegions, setCollapsedRegions] = useState<Set<string>>(() => {
    const allRegions = new Set(cards.map(c => (c.region as string) || '기타'))
    if (initRegion) {
      // 태그 클릭: 해당 구만 열고 나머지 접기
      allRegions.delete(initRegion)
      return allRegions
    }
    if (isReset) {
      // 전체보기 클릭: 전체 접힘
      return allRegions
    }
    // 탭 전환 복귀: localStorage에서 복원
    try {
      const saved = localStorage.getItem('mobileZoneCollapsed')
      if (saved) return new Set(JSON.parse(saved) as string[])
    } catch { /* ignore */ }
    // 최초 방문: 전체 접힘
    return allRegions
  })

  // 아코디언 상태 변경 시 localStorage에 저장
  useEffect(() => {
    localStorage.setItem('mobileZoneCollapsed', JSON.stringify([...collapsedRegions]))
  }, [collapsedRegions])
  const [expandedCompleteKeys, setExpandedCompleteKeys] = useState<Set<string>>(new Set())

  // ── 담당 구역용 ──────────────────────────────────────────
  const mineCards = useMemo(() =>
    cards.filter((c) => {
      const leaders = c.assignedLeaders?.length ? c.assignedLeaders
        : c.assignedLeader ? [c.assignedLeader] : []
      return leaders.includes(currentVisitor) || c.assignedUsers.includes(currentVisitor)
    }),
    [cards, currentVisitor]
  )

  const lastVisitByCardId = useMemo(() => {
    const unitCardMap = new Map<number, number>()
    for (const b of buildings) {
      for (const u of b.units) unitCardMap.set(u.id, b.cardId)
    }
    const result = new Map<number, string>()
    for (const h of visitHistories) {
      const cardId = unitCardMap.get(h.unitId)
      if (cardId == null) continue
      const cur = result.get(cardId)
      if (!cur || h.visitedAt > cur) result.set(cardId, h.visitedAt)
    }
    return result
  }, [buildings, visitHistories])

  const mineRegionGroups = useMemo(() => {
    const map = new Map<string, TerritoryCard[]>()
    for (const card of mineCards) {
      const region = (card.region as string) || '기타'
      if (!map.has(region)) map.set(region, [])
      map.get(region)!.push(card)
    }
    for (const list of map.values()) {
      list.sort((a, b) => STATUS_ORDER[getCardStatus(a)] - STATUS_ORDER[getCardStatus(b)])
    }
    const result: [string, TerritoryCard[]][] = []
    for (const r of REGION_ORDER) {
      if (map.has(r)) result.push([r, map.get(r)!])
    }
    for (const [r, list] of map) {
      if (!REGION_ORDER.includes(r)) result.push([r, list])
    }
    return result
  }, [mineCards])

  const mineNeedCount = mineCards.filter((c) => getCardStatus(c) === '방문필요').length
  const mineInProgressCount = mineCards.filter((c) => getCardStatus(c) === '진행중').length
  const mineDoneCount = mineCards.filter((c) => getCardStatus(c) === '완료').length

  const toggleRegion = (region: string) =>
    setCollapsedRegions((prev) => {
      const next = new Set(prev); next.has(region) ? next.delete(region) : next.add(region); return next
    })
  const toggleComplete = (key: string) =>
    setExpandedCompleteKeys((prev) => {
      const next = new Set(prev); next.has(key) ? next.delete(key) : next.add(key); return next
    })

  // ── 전체 구역용 ──────────────────────────────────────────
  const kpi = useMemo(() => {
    const total = cards.length
    const assigned = cards.filter(
      (c) => c.assignedLeader != null || (c.assignedLeaders?.length ?? 0) > 0
    ).length
    return { total, assigned, unassigned: total - assigned }
  }, [cards])

  const regionList = useMemo(() => {
    const map = new Map<string, number>()
    for (const card of cards) {
      const key = REGION_ORDER.includes(card.region as string) ? (card.region as string) : '기타'
      map.set(key, (map.get(key) ?? 0) + 1)
    }
    const result: [string, number][] = []
    for (const r of REGION_ORDER) { if (map.has(r)) result.push([r, map.get(r)!]) }
    if (map.has('기타')) result.push(['기타', map.get('기타')!])
    return result
  }, [cards])

  // 동 이름 검색 결과 (전체 구 横断)
  const dongSearchResults = useMemo(() => {
    const q = query.trim()
    if (!q) return []
    const map = new Map<string, { region: string; dong: string; count: number }>()
    for (const card of cards) {
      const region = REGION_ORDER.includes(card.region as string) ? (card.region as string) : '기타'
      const dong = extractDong(card.name, region)
      if (!dong.includes(q)) continue
      const key = `${region}::${dong}`
      const prev = map.get(key)
      map.set(key, prev ? { ...prev, count: prev.count + 1 } : { region, dong, count: 1 })
    }
    return [...map.values()].sort((a, b) => a.dong.localeCompare(b.dong, 'ko'))
  }, [cards, query])

  const dongList = useMemo(() => {
    const regionCards = cards.filter((c) => {
      const key = REGION_ORDER.includes(c.region as string) ? (c.region as string) : '기타'
      return key === selectedRegion
    })
    const map = new Map<string, number>()
    for (const card of regionCards) {
      const dong = extractDong(card.name, selectedRegion)
      map.set(dong, (map.get(dong) ?? 0) + 1)
    }
    const q = query.trim()
    return [...map.entries()]
      .filter(([d]) => !q || d.includes(q))
      .sort((a, b) => {
        if (a[0] === '기타') return 1
        if (b[0] === '기타') return -1
        return a[0].localeCompare(b[0], 'ko')
      })
  }, [cards, selectedRegion, query])

  const cardList = useMemo(() => {
    return cards
      .filter((c) => {
        const key = REGION_ORDER.includes(c.region as string) ? (c.region as string) : '기타'
        return key === selectedRegion && extractDong(c.name, selectedRegion) === selectedDong
      })
      .sort((a, b) => a.name.localeCompare(b.name, 'ko'))
  }, [cards, selectedRegion, selectedDong])

  function goToRegion(region: string) { setSelectedRegion(region); setSelectedDong(''); setLevel('dongs'); setQuery('') }
  function goToDong(dong: string) { setSelectedDong(dong); setLevel('cards'); setQuery('') }
  function goBack() {
    if (level === 'cards') { setLevel('dongs'); setQuery('') }
    else if (level === 'dongs') { setLevel('regions'); setQuery('') }
  }

  const drillTitle = level === 'dongs' ? selectedRegion : selectedDong
  const levelCount = level === 'dongs'
    ? cards.filter((c) => {
        const key = REGION_ORDER.includes(c.region as string) ? (c.region as string) : '기타'
        return key === selectedRegion
      }).length
    : cardList.length

  // 스코프 전환 시 drill-down 초기화
  function switchScope(s: 'mine' | 'all') {
    setScope(s); setLevel('regions'); setQuery(''); setSelectedRegion(''); setSelectedDong('')
  }

  return (
    <div className="mobile-zone-page">
      {/* ── 헤더 ── */}
      <div className="mobile-zone-head">
        {scope === 'all' && level !== 'regions' && (
          <button className="mz-back-btn" onClick={goBack} type="button" aria-label="뒤로">
            <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2.2">
              <path d="M13 4 7 10l6 6" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </button>
        )}
        <h2>{scope === 'mine' || level === 'regions' ? '구역' : drillTitle}</h2>
        <div className="mobile-zone-view-toggle" aria-label="보기 전환">
          <span>목록</span>
          <button onClick={onShowMapView} type="button">지도</button>
        </div>
      </div>

      {/* ── 스코프 토글 (항상 표시) ── */}
      {(scope === 'mine' || level === 'regions') && (
        <div className="mobile-zone-scope-toggle" aria-label="구역 범위">
          <button className={scope === 'mine' ? 'active' : ''} onClick={() => switchScope('mine')} type="button">담당 구역</button>
          <button className={scope === 'all' ? 'active' : ''} onClick={() => switchScope('all')} type="button">전체 구역</button>
        </div>
      )}

      {/* ════════════════════════════════════════════════════
          담당 구역 뷰 (원래 상태별 그룹 아코디언)
          ════════════════════════════════════════════════════ */}
      {scope === 'mine' && (
        <>
          <div className="mz-kpi-bar" aria-label="구역 요약">
            <span className="mz-kpi-need"><strong>{mineNeedCount}</strong>개 방문필요</span>
            <span className="mz-kpi-sep">·</span>
            <span className="mz-kpi-progress"><strong>{mineInProgressCount}</strong>개 진행중</span>
            <span className="mz-kpi-sep">·</span>
            <span className="mz-kpi-done"><strong>{mineDoneCount}</strong>개 완료</span>
          </div>

          {mineCards.length === 0 ? (
            <div className="mobile-zone-empty">담당 카드가 없습니다.</div>
          ) : (
            <div className="mobile-zone-list">
              {mineRegionGroups.map(([region, regionCards]) => {
                const isCollapsed = collapsedRegions.has(region)
                const byStatus = {
                  '방문필요': regionCards.filter((c) => getCardStatus(c) === '방문필요'),
                  '진행중':   regionCards.filter((c) => getCardStatus(c) === '진행중'),
                  '완료':     regionCards.filter((c) => getCardStatus(c) === '완료'),
                }
                return (
                  <section key={region} className="mobile-zone-region">
                    <button className="mobile-zone-region-header" onClick={() => toggleRegion(region)} type="button">
                      <span className="mobile-zone-region-name">{region}</span>
                      <span className="mobile-zone-region-count">{regionCards.length}개</span>
                      <span className="mobile-zone-region-chevron">{isCollapsed ? '∨' : '∧'}</span>
                    </button>
                    {!isCollapsed && (
                      <div className="mobile-zone-region-body">
                        {(['방문필요', '진행중', '완료'] as const).map((status) => {
                          const list = byStatus[status]
                          if (list.length === 0) return null
                          const key = `${region}:${status}`
                          const isComplete = status === '완료'
                          const isExpanded = isComplete ? expandedCompleteKeys.has(key) : true
                          return (
                            <div key={status} className="mobile-zone-status-group">
                              <button
                                className="mobile-zone-status-header"
                                onClick={isComplete ? () => toggleComplete(key) : undefined}
                                type="button"
                                style={isComplete ? undefined : { cursor: 'default', pointerEvents: 'none' }}
                              >
                                <span className={`mobile-zone-status-badge status-${status}`}>{status}</span>
                                <span className="mobile-zone-status-count">{list.length}개</span>
                                {isComplete && <span className="mobile-zone-status-chevron">{isExpanded ? '∧' : '∨'}</span>}
                              </button>
                              {isExpanded && list.map((card) => {
                                const displayName = stripRegionFromName(card.name, region)
                                const lastVisit = formatLastVisit(lastVisitByCardId.get(card.id))
                                return (
                                  <button
                                    key={card.id}
                                    className="mobile-zone-card-row"
                                    onClick={() => onOpenMap(card.id)}
                                    type="button"
                                  >
                                    <div className="mobile-zone-card-line1">
                                      <span className="mobile-zone-card-name">{displayName}</span>
                                      <span className="mobile-zone-card-map" aria-label="지도">
                                        <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.7">
                                          <path d="m4 6 4-1.5 4 1.5 4-1.5v10l-4 1.5-4-1.5-4 1.5Z"/>
                                          <path d="M8 4.5v10M12 6v10"/>
                                        </svg>
                                        지도
                                      </span>
                                    </div>
                                    <div className="mobile-zone-card-line2">
                                      <span className="mobile-zone-card-meta">세대 {card.units} · {lastVisit}</span>
                                      <div className="mobile-zone-card-progress">
                                        <div className="mobile-zone-card-bar">
                                          <b style={{ width: `${card.progress}%` }} />
                                        </div>
                                        <span className="mobile-zone-card-pct">{card.progress}%</span>
                                      </div>
                                    </div>
                                  </button>
                                )
                              })}
                            </div>
                          )
                        })}
                      </div>
                    )}
                  </section>
                )
              })}
            </div>
          )}
        </>
      )}

      {/* ════════════════════════════════════════════════════
          전체 구역 뷰 (구 → 동 → 카드 drill-down)
          ════════════════════════════════════════════════════ */}
      {scope === 'all' && (
        <>
          {/* 브레드크럼 */}
          {level !== 'regions' && (
            <div className="mz-breadcrumb">
              <button type="button" onClick={() => { setLevel('regions'); setQuery('') }}>전체 구역</button>
              <span>›</span>
              {level === 'dongs' && <span>{selectedRegion}</span>}
              {level === 'cards' && (
                <>
                  <button type="button" onClick={() => { setLevel('dongs'); setQuery('') }}>{selectedRegion}</button>
                  <span>›</span>
                  <span>{selectedDong}</span>
                </>
              )}
            </div>
          )}

          {/* 1단계: 구 목록 */}
          {level === 'regions' && (
            <>
              <div className="mz-kpi-bar">
                <span>전체 <strong>{kpi.total}</strong>개</span>
                <span className="mz-kpi-sep">·</span>
                <span>배정완료 <strong>{kpi.assigned}</strong>개</span>
                <span className="mz-kpi-sep">·</span>
                <span className="mz-kpi-unassigned-text">미배정 <strong>{kpi.unassigned}</strong>개</span>
              </div>
              <input
                className="mobile-zone-search"
                placeholder="동 이름 검색"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
              {/* 검색어 없으면 구 목록, 있으면 동 검색 결과 */}
              {query.trim() === '' ? (
                <div className="mz-list">
                  {regionList.map(([region, count]) => (
                    <button key={region} className="mz-nav-row" onClick={() => goToRegion(region)} type="button">
                      <span className="mz-nav-name">{region}</span>
                      <span className="mz-nav-count">{count}개</span>
                      <svg className="mz-nav-chevron" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M7 4l6 6-6 6" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                    </button>
                  ))}
                </div>
              ) : (
                <div className="mz-list">
                  {dongSearchResults.map(({ region, dong, count }) => (
                    <button
                      key={`${region}::${dong}`}
                      className="mz-nav-row"
                      onClick={() => { setSelectedRegion(region); setSelectedDong(dong); setLevel('cards'); setQuery('') }}
                      type="button"
                    >
                      <div className="mz-nav-dong-info">
                        <span className="mz-nav-name">{dong}</span>
                        <span className="mz-nav-region-tag">{region}</span>
                      </div>
                      <span className="mz-nav-count">{count}개</span>
                      <svg className="mz-nav-chevron" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M7 4l6 6-6 6" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                    </button>
                  ))}
                  {dongSearchResults.length === 0 && <div className="mobile-zone-empty">조건에 맞는 동이 없습니다.</div>}
                </div>
              )}
            </>
          )}

          {/* 2단계: 동 목록 */}
          {level === 'dongs' && (() => {
            const regionCards = cards.filter((c) => {
              const key = REGION_ORDER.includes(c.region as string) ? (c.region as string) : '기타'
              return key === selectedRegion
            })
            const assignedInRegion = regionCards.filter(
              (c) => c.assignedLeader != null || (c.assignedLeaders?.length ?? 0) > 0
            ).length
            return (
            <>
              <div className="mz-kpi-bar">
                <span>전체 <strong>{levelCount}</strong>개</span>
                <span className="mz-kpi-sep">·</span>
                <span>배정완료 <strong>{assignedInRegion}</strong>개</span>
                <span className="mz-kpi-sep">·</span>
                <span className="mz-kpi-unassigned-text">미배정 <strong>{levelCount - assignedInRegion}</strong>개</span>
              </div>
              <input
                className="mobile-zone-search"
                placeholder="동 이름 검색"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
              <div className="mz-list">
                {dongList.map(([dong, count]) => (
                  <button key={dong} className="mz-nav-row" onClick={() => goToDong(dong)} type="button">
                    <span className="mz-nav-name">{dong}</span>
                    <span className="mz-nav-count">{count}개</span>
                    <svg className="mz-nav-chevron" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M7 4l6 6-6 6" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  </button>
                ))}
                {dongList.length === 0 && <div className="mobile-zone-empty">조건에 맞는 동이 없습니다.</div>}
              </div>
            </>
            )
          })()}

          {/* 3단계: 카드 목록 */}
          {level === 'cards' && (
            <>
              <div className="mz-level-count">전체 카드 <strong>{levelCount}개</strong></div>
              <div className="mz-list">
                {cardList.map((card) => {
                  const displayName = stripRegionFromName(card.name, selectedRegion)
                  const leader =
                    (card.assignedLeaders?.length ? card.assignedLeaders[0] : null) ??
                    card.assignedLeader ?? '미배정'
                  return (
                    <div key={card.id} className="mz-card-item">
                      <div className="mz-card-top">
                        <div className="mz-card-info">
                          <span className="mz-card-name">{displayName}</span>
                          <span className={`mz-card-leader${leader === '미배정' ? ' unassigned' : ''}`}>담당: {leader}</span>
                        </div>
                        <button className="mz-card-map-btn" onClick={() => onOpenMap(card.id)} type="button">
                          <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.7">
                            <path d="m4 6 4-1.5 4 1.5 4-1.5v10l-4 1.5-4-1.5-4 1.5Z"/>
                            <path d="M8 4.5v10M12 6v10"/>
                          </svg>
                          지도
                        </button>
                      </div>
                      <div className="mz-card-progress">
                        <div className="mz-card-bar"><b style={{ width: `${card.progress}%` }} /></div>
                        <span className="mz-card-pct">{card.progress}%</span>
                      </div>
                    </div>
                  )
                })}
                {cardList.length === 0 && <div className="mobile-zone-empty">카드가 없습니다.</div>}
              </div>
            </>
          )}
        </>
      )}
    </div>
  )
}

export function MobileHome({
  leaderNames = [],
  buildings,
  calendarEvents,
  cardBoundaries,
  cards,
  currentVisitor,
  actualRole,
  viewMode,
  notices,
  serviceSessions,
  onChangeViewMode,
  onAddUnit,
  onApplyToEvent,
  onToggleUser: _onToggleUser,
  onStartServiceSession,
  onEndServiceSession,
  onAssignCardToEventParticipant: _onAssignCardToEventParticipant,
  onAssignCardsToEventParticipantsBulk,
  onCreateBuilding,
  onDeleteBuilding,
  onUpdateBuilding,
  onDeleteUnit,
  onCreateCalendarEvent,
  onDeleteCalendarEvent,
  onUpdateCalendarEvent,
  onCreateNotice,
  onDeleteNotice,
  returnVisits = [],
  returnVisitLogs = [],
  onToggleRegularVisit,
  onCreateManualReturnVisit,
  onAddReturnVisitLog,
  onUpdateReturnVisitLog,
  onDeleteReturnVisitLog,
  onDeleteReturnVisit,
  onUpdateReturnVisitNickname,
  onUpdateReturnVisitAddress,
  onToggleChinese,
  onUndoLatestVisit,
  onUpdateVisitHistory,
  onDeleteVisitHistory,
  onUpdateUnitStatus: _onUpdateUnitStatus,
  onQuickLogVisit,
  onUpdateUnitFlags,
  onLogout,
  visitHistories,
  forceMobileView,
  onSetForceMobileView,
}: {
  leaderNames?: string[]
  buildings: Building[]
  calendarEvents: CalendarEvent[]
  cardBoundaries: CardBoundary[]
  cards: TerritoryCard[]
  currentVisitor: string
  actualRole: Role
  viewMode: Role
  notices: Notice[]
  serviceSessions: ServiceSession[]
  onChangeViewMode: (role: Role) => void
  onAddUnit: (buildingId: number, unitNumber: string) => void
  onApplyToEvent: (eventId: number) => void
  onToggleUser: (cardId: number, userName: string) => void
  onStartServiceSession: (input: {
    role: Role
    timeSlot: TimeSlot
    primaryCardId?: number | null
    calendarEventId?: number | null
    assignedCardId?: number | null
    assignmentId?: number | null
    source?: ServiceSession['source']
    memo?: string
  }) => Promise<number | null>
  onEndServiceSession: (sessionId: number) => void
  onAssignCardToEventParticipant: (eventId: number, userName: string, cardId: number | null) => void
  onAssignCardsToEventParticipantsBulk: (
    eventId: number,
    assignments: Array<{ userName: string; cardId?: number | null; cardIds?: number[] | null }>,
    options?: { silentSuccess?: boolean },
  ) => Promise<void> | void
  onCreateBuilding: (input: { cardId: number; name: string; address: string; type: Building['type']; lat: number; lng: number }) => void
  onDeleteBuilding: (buildingId: number) => void
  onUpdateBuilding: (buildingId: number, name: string, address: string, lat?: number, lng?: number) => void
  onDeleteUnit: (buildingId: number, unitId: number) => void
  onCreateCalendarEvent: (input: { date: string; time: string; title: string; place: string; leader: string; memo: string; hasMeeting: boolean; allowApplications: boolean }) => void
  onDeleteCalendarEvent: (id: number) => void
  onUpdateCalendarEvent: (id: number, input: { time: string; title: string; place: string; leader: string; memo: string; hasMeeting: boolean; allowApplications: boolean }) => void
  onCreateNotice: (input: { title: string; content: string; priority: Notice['priority']; author: string }) => void
  onDeleteNotice: (id: number) => void
  returnVisits?: ReturnVisit[]
  returnVisitLogs?: ReturnVisitLog[]
  onToggleRegularVisit: (buildingId: number, unitId: number, visitorName?: string) => void
  onCreateManualReturnVisit?: (input: { displayName: string; address: string; memo: string; unitId?: number | null; buildingId?: number | null }) => Promise<void>
  onAddReturnVisitLog?: (returnVisitId: number, result: '만남' | '부재' | null, memo: string) => Promise<void>
  onUpdateReturnVisitLog?: (id: number, result: '만남' | '부재' | null, memo: string) => Promise<void>
  onDeleteReturnVisitLog?: (id: number) => Promise<void>
  onDeleteReturnVisit?: (id: number) => Promise<void>
  onUpdateReturnVisitNickname?: (id: number, nickname: string) => Promise<void>
  onUpdateReturnVisitAddress?: (id: number, address: string) => Promise<void>
  onToggleChinese: (buildingId: number, unitId: number) => void
  onUndoLatestVisit: (buildingId: number, unitId: number) => void
  onUpdateVisitHistory: (historyId: number, unitId: number, input: { result: UnitStatus; timeSlot: TimeSlot; memo: string; visitedAt: string }) => void
  onDeleteVisitHistory: (historyId: number, unitId: number) => void
  onUpdateUnitStatus: (buildingId: number, unitId: number, status: UnitStatus, memo?: string) => void
  onQuickLogVisit: (buildingId: number, unitId: number, result: UnitStatus) => void
  onUpdateUnitFlags: (unitId: number, flags: Partial<Unit>) => void
  onLogout: () => void
  visitHistories: VisitHistory[]
  forceMobileView: boolean
  onSetForceMobileView: (value: boolean) => void
}) {
  const navigate = useNavigate()
  const location = useLocation()
  const [searchParams] = useSearchParams()
  const role = actualRole === 'admin' ? viewMode : actualRole
  const [todayCardsCollapsed, setTodayCardsCollapsed] = useState(() =>
    window.localStorage.getItem('mobileTodaySessionsCollapsed') === 'true'
  )

  const rawActiveTab = pathToTab[location.pathname] || '홈'
  // 인도자는 '지도' 탭이 없으므로 /map 접근 시 '구역' 탭 활성화
  const activeTab: MobileTab =
    rawActiveTab === '지도' && role === 'leader' ? '구역' : rawActiveTab

  const today = useMemo(() => new Date().toISOString().slice(0, 10), [])
  const todayLabel = useMemo(() => formatKoreanDate(new Date()), [])
  const myCards = useMemo(() => cards.filter((c) => c.assignedUsers.includes(currentVisitor)), [cards, currentVisitor])
  const leaderCards = useMemo(() => cards.filter((c) => c.assignedLeader === currentVisitor), [cards, currentVisitor])
  const inProgressCards = useMemo(() => cards.filter((c) => c.status === '진행중'), [cards])
  const completedCards = useMemo(() => cards.filter((c) => c.progress >= 100), [cards])
  const totalUnits = useMemo(() => cards.reduce((sum, card) => sum + card.units, 0), [cards])
  const completedUnits = useMemo(() => cards.reduce((sum, card) => sum + card.completed, 0), [cards])
  const latestNotices = useMemo(() =>
    notices.slice().sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, 2),
    [notices])
  const todayEvents = useMemo(() =>
    calendarEvents.filter((e) => e.date === today).sort((a, b) => a.time.localeCompare(b.time)),
    [calendarEvents, today])
  const myTodaySessions = useMemo(() =>
    serviceSessions.filter((session) => session.serviceDate === today && session.userName === currentVisitor),
    [currentVisitor, serviceSessions, today])
  const myRegularVisits = useMemo(() =>
    buildings.flatMap((building) => {
      const card = cards.find((item) => item.id === building.cardId)
      return building.units
        .filter((unit) => unit.isRegularVisit && unit.regularVisitor === currentVisitor)
        .map((unit) => ({
          building,
          card,
          unit,
        }))
    }),
    [buildings, cards, currentVisitor])
  const myVisibleCards = role === 'leader' ? leaderCards : myCards

  const focusedMapCardId = searchParams.get('cardId') ? Number(searchParams.get('cardId')) : null
  const modeTitle = role === 'admin' ? '관리자 홈' : role === 'leader' ? '인도자 홈' : '봉사자 홈'

  const toggleTodayCardsCollapsed = () => {
    const next = !todayCardsCollapsed
    setTodayCardsCollapsed(next)
    window.localStorage.setItem('mobileTodaySessionsCollapsed', String(next))
  }

  const visibleTabs: MobileTab[] = role === 'user'
    ? ['홈', '캘린더', '나의봉사', '지도', '설정']
    : role === 'leader'
      ? ['홈', '캘린더', '나의봉사', '배정', '구역', '설정']
      : ['홈', '캘린더', '나의봉사', '구역', '배정', '설정']  // admin

  const BottomNav = (
    <nav className="bottom-nav" aria-label="주요 메뉴">
      {visibleTabs.map((item) => (
        <button
          className={item === activeTab ? 'active' : ''}
          key={item}
          onClick={() => navigate(tabToPath[item])}
          type="button"
        >
          <NavIcon name={navIcons[item]} />
          {item === '나의봉사' ? '나의봉사' : item}
        </button>
      ))}
    </nav>
  )


  return (
    <Routes>
      <Route path="/map" element={
        <>
          <MobileMap
            buildings={buildings}
            cardBoundaries={cardBoundaries}
            cards={cards}
            currentVisitor={currentVisitor}
            actualRole={role}
            serviceSessions={serviceSessions}
            focusedCardId={focusedMapCardId}
            onBack={() => navigate(role === 'leader' ? '/zone' : '/territory')}
            onAddUnit={onAddUnit}
            onCreateBuilding={onCreateBuilding}
            onDeleteBuilding={onDeleteBuilding}
            onUpdateBuilding={onUpdateBuilding}
            onDeleteUnit={onDeleteUnit}
            onToggleRegularVisit={onToggleRegularVisit}
            onToggleChinese={onToggleChinese}
            onUndoLatestVisit={onUndoLatestVisit}
            onUpdateVisitHistory={onUpdateVisitHistory}
            onDeleteVisitHistory={onDeleteVisitHistory}
            onQuickLogVisit={onQuickLogVisit}
            onUpdateUnitFlags={onUpdateUnitFlags}
            visitHistories={visitHistories}
          />
          {BottomNav}
        </>
      } />
      <Route path="/*" element={
        <main className="app-shell" style={{ paddingBottom: 72 }}>
          <Routes>
            {/* 홈 */}
            <Route path="/" element={
              <>
                <header className="mobile-home-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div className="mobile-page-title">
                    <span aria-hidden="true"><NavIcon name="home" /></span>
                    <h1>홈</h1>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <div style={{ textAlign: 'right' }}>
                      <p style={{ fontSize: '11px', color: 'var(--ink-500)', margin: 0 }}>{modeTitle}</p>
                      <strong style={{ fontSize: '14px', color: 'var(--ink-900)' }}>{currentVisitor}</strong>
                    </div>
                    <div style={{
                      width: '32px', height: '32px', borderRadius: '50%',
                      background: role === 'admin' ? 'var(--danger-100)' : role === 'leader' ? 'var(--accent-100)' : 'var(--brand-100)',
                      color: role === 'admin' ? 'var(--danger-700)' : role === 'leader' ? 'var(--accent-700)' : 'var(--brand-700)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontWeight: 700, fontSize: '14px'
                    }}>
                      {currentVisitor[0]}
                    </div>
                  </div>
                </header>

                <div className="mobile-date-pill">{todayLabel}</div>

                <section className="mobile-home-section">
                  <div className="mobile-section-title" style={{ marginBottom: '8px' }}>
                    <h2><span aria-hidden="true"><NavIcon name="notice" /></span> 공지</h2>
                    <button onClick={() => navigate('/notices')} type="button">전체보기 ›</button>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    {latestNotices.length === 0 ? (
                      <p style={{ fontSize: '13px', color: 'var(--ink-500)', margin: 0, padding: '12px', background: '#f9fafb', borderRadius: '8px', textAlign: 'center' }}>등록된 공지가 없습니다.</p>
                    ) : latestNotices.map((notice) => (
                      <button key={notice.id} onClick={() => navigate('/notices')} style={{
                        display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 12px',
                        background: '#f9fafb', borderRadius: '8px', border: 'none', textAlign: 'left', width: '100%'
                      }}>
                        <span style={{ fontSize: '11px', fontWeight: 600, color: 'var(--primary-600)', background: 'var(--primary-50)', padding: '2px 6px', borderRadius: '4px', flexShrink: 0 }}>공지</span>
                        <span style={{ flex: 1, fontSize: '13px', color: 'var(--ink-900)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{notice.title}</span>
                        <span style={{ fontSize: '11px', color: 'var(--ink-400)', flexShrink: 0 }}>{notice.createdAt.slice(5, 10).replace('-', '/')}</span>
                      </button>
                    ))}
                  </div>
                </section>

                <section className="mobile-home-section">
                  <div className="mobile-section-title">
                    <h2><span aria-hidden="true"><NavIcon name="calendar" /></span> 오늘의 봉사</h2>
                    <button onClick={() => navigate('/calendar')} type="button">전체보기 ›</button>
                  </div>
                  {todayEvents.length === 0 ? (
                    <article className="mobile-empty-card mobile-service-empty">
                      <span aria-hidden="true">□</span>
                      <p>오늘 예정된 봉사가 없습니다.</p>
                    </article>
                  ) : (
                    <div className="mobile-home-list">
                      {todayEvents.slice(0, 3).map((event) => (
                        <button className="mobile-event-row" key={event.id} onClick={() => navigate('/calendar')} type="button">
                          <strong>{event.time}</strong>
                          <span>{event.title}</span>
                          <small>{event.place || event.leader}</small>
                        </button>
                      ))}
                    </div>
                  )}
                </section>

                <section className="mobile-home-section">
                  <div className="mobile-section-title">
                    <h2><span aria-hidden="true"><NavIcon name="territory" /></span> 나의 봉사 현황</h2>
                    <button onClick={() => navigate('/territory')} type="button">전체보기 ›</button>
                  </div>
                  <div className="mobile-service-summary-grid">
                    <button onClick={() => navigate('/territory')} type="button">
                      <strong>{myVisibleCards.length}</strong>
                      <span>내 카드</span>
                    </button>
                    <button onClick={() => navigate('/territory?section=regular')} type="button">
                      <strong>{myRegularVisits.length}</strong>
                      <span>내 정기방문</span>
                    </button>
                  </div>
                </section>

                {role !== 'admin' && myTodaySessions.length > 0 && (
                  <section className="mobile-home-section">
                    <div className="mobile-section-title">
                      <h2><span aria-hidden="true"><NavIcon name="map" /></span> 오늘 내가 봉사한 카드</h2>
                      <button onClick={toggleTodayCardsCollapsed} type="button">
                        {todayCardsCollapsed ? '펼치기 ›' : '접기'}
                      </button>
                    </div>
                    {todayCardsCollapsed ? (
                      <button className="mobile-collapsed-summary" onClick={toggleTodayCardsCollapsed} type="button">
                        오늘 봉사한 카드 {myTodaySessions.length}개 접힘
                        <span>열기</span>
                      </button>
                    ) : (
                      <div className="mobile-home-list">
                        {myTodaySessions.map((session) => {
                          const card = cards.find((item) => item.id === session.primaryCardId)
                          return (
                            <button className="mobile-my-card" key={session.id} onClick={() => navigate(`/map?cardId=${session.primaryCardId ?? ''}`)} type="button">
                              <div>
                                <strong>{card?.name ?? '카드 미지정'}</strong>
                                <small>{session.timeSlot} · {session.status === 'active' && !session.endedAt ? '진행 중' : '종료됨'}</small>
                              </div>
                              <span>열기</span>
                            </button>
                          )
                        })}
                      </div>
                    )}
                  </section>
                )}

                {role === 'admin' && (
                  <section className="mobile-home-section">
                    <div className="mobile-section-title">
                      <h2><span aria-hidden="true"><NavIcon name="territory" /></span> 운영 현황</h2>
                      <button onClick={() => navigate('/territory')} type="button">전체보기 ›</button>
                    </div>
                    <div className="mobile-home-stats">
                      <div><strong>{cards.length}</strong><span>전체 카드</span></div>
                      <div><strong>{inProgressCards.length}</strong><span>진행중</span></div>
                      <div><strong>{completedCards.length}</strong><span>완료 카드</span></div>
                      <div><strong>{completedUnits}/{totalUnits}</strong><span>완료 세대</span></div>
                    </div>
                  </section>
                )}

                {role === 'leader' && (
                  <section className="mobile-home-section">
                    <div className="mobile-section-title">
                      <h2><span aria-hidden="true"><NavIcon name="territory" /></span> 담당 카드</h2>
                      <button onClick={() => navigate('/zone?reset=true')} type="button">전체보기 ›</button>
                    </div>
                    {leaderCards.length === 0 ? (
                      <article className="mobile-empty-card">담당 카드가 없습니다.</article>
                    ) : (
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', padding: '4px 0' }}>
                        {(() => {
                          // 구 → 동 별로 그룹핑: "처인구 고림동 2개" 형태
                          const groupMap = new Map<string, { region: string; area: string; count: number }>()
                          for (const card of leaderCards) {
                            const region = (card.region as string) || '기타'
                            const area = (card.area as string) || '기타'
                            const key = `${region}::${area}`
                            const prev = groupMap.get(key)
                            groupMap.set(key, prev ? { ...prev, count: prev.count + 1 } : { region, area, count: 1 })
                          }
                          return [...groupMap.values()].map(({ region, area, count }) => (
                            <button
                              key={`${region}::${area}`}
                              onClick={() => navigate(`/zone?region=${encodeURIComponent(region)}&dong=${encodeURIComponent(area)}`)}
                              type="button"
                              style={{
                                padding: '6px 12px', borderRadius: 20,
                                background: 'var(--brand-50)', color: 'var(--brand-700)',
                                border: '1px solid var(--brand-200)',
                                fontSize: 13, fontWeight: 600, cursor: 'pointer',
                              }}
                            >
                              {region} {area} {count}개
                            </button>
                          ))
                        })()}
                      </div>
                    )}
                  </section>
                )}
              </>
            } />

            {/* 공지 */}
            <Route path="/notices" element={
              <MobileNotices
                currentVisitor={currentVisitor}
                notices={notices}
                role={role}
                onCreateNotice={onCreateNotice}
                onDeleteNotice={onDeleteNotice}
              />
            } />

            {/* 캘린더 */}
            <Route path="/calendar" element={
              <MobileCalendar
                currentVisitor={currentVisitor}
                leaderNames={leaderNames}
                events={calendarEvents}
                role={role}
                onApplyToEvent={onApplyToEvent}
                onCreateEvent={onCreateCalendarEvent}
                onDeleteEvent={onDeleteCalendarEvent}
                onUpdateEvent={onUpdateCalendarEvent}
              />
            } />

            {/* 나의봉사 (개인 봉사 현황) */}
            <Route path="/territory" element={
              <MobileTerritory
                buildings={buildings}
                cards={cards}
                calendarEvents={calendarEvents}
                currentVisitor={currentVisitor}
                role={role}
                serviceSessions={serviceSessions}
                returnVisits={returnVisits}
                returnVisitLogs={returnVisitLogs}
                onOpenMap={(cardId) => navigate(`/map?cardId=${cardId}`)}
                onStartServiceSession={onStartServiceSession}
                onEndServiceSession={onEndServiceSession}
                onCreateManualReturnVisit={onCreateManualReturnVisit}
                onAddReturnVisitLog={onAddReturnVisitLog}
                onUpdateReturnVisitLog={onUpdateReturnVisitLog}
                onDeleteReturnVisitLog={onDeleteReturnVisitLog}
                onDeleteReturnVisit={onDeleteReturnVisit}
                onUpdateReturnVisitNickname={onUpdateReturnVisitNickname}
                onUpdateReturnVisitAddress={onUpdateReturnVisitAddress}
              />
            } />

            {/* 구역 (인도자·관리자용 — 목록↔지도 토글) */}
            <Route path="/zone" element={
              <MobileZoneView
                cards={cards}
                buildings={buildings}
                visitHistories={visitHistories}
                currentVisitor={currentVisitor}
                onOpenMap={(cardId) => navigate(`/map?cardId=${cardId}`)}
                onShowMapView={() => navigate('/map')}
              />
            } />

            {/* 배정 */}
            <Route path="/assignment" element={
              <MobileLeaderAssignment
                cards={cards}
                calendarEvents={calendarEvents}
                currentVisitor={currentVisitor}
                role={role}
                onAssignCardsToEventParticipantsBulk={onAssignCardsToEventParticipantsBulk}
              />
            } />

            {/* 사용자 */}
            <Route path="/users" element={
              <div style={{ padding: '0 0 80px' }}>
                <DesktopUsers
                  visitHistories={visitHistories}
                />
              </div>
            } />

            {/* 설정 */}
            <Route path="/settings" element={
              <div className="mobile-settings-page">
                <div className="mobile-page-title">
                  <span aria-hidden="true"><NavIcon name="settings" /></span>
                  <h1>설정</h1>
                </div>

                <section className="mobile-settings-menu" aria-label="관리 메뉴">
                  <button onClick={() => navigate('/notices')} type="button">
                    <strong>공지</strong>
                    <span>공지 작성과 확인</span>
                  </button>
                  <button onClick={() => navigate('/assignment')} type="button">
                    <strong>배정</strong>
                    <span>인도자와 사용자 카드 배정</span>
                  </button>
                  <button onClick={() => navigate('/users')} type="button">
                    <strong>사용자</strong>
                    <span>사용자 현황과 권한 관리</span>
                  </button>
                </section>

                <section className="mobile-settings-card">
                  <p>현재 사용자</p>
                  <strong>{currentVisitor} ({roleLabels[actualRole]})</strong>
                  <button
                    onClick={onLogout}
                    style={{ marginTop: '12px', width: '100%', padding: '12px', background: 'var(--danger-50)', color: 'var(--danger-600)', borderRadius: '8px', border: 'none', fontWeight: 600, fontSize: '14px' }}
                    type="button"
                  >
                    로그아웃
                  </button>
                </section>

                {actualRole === 'admin' && (
                  <>
                    <section className="mobile-settings-card">
                      <p>화면 보기 전환</p>
                      <div className="mobile-role-grid">
                        {(['admin', 'leader', 'user'] as Role[]).map((r) => (
                          <button
                            key={r}
                            onClick={() => onChangeViewMode(r)}
                            className={role === r ? 'active' : ''}
                            type="button"
                          >
                            {r === 'user' ? '봉사자' : roleLabels[r]}
                          </button>
                        ))}
                      </div>
                    </section>

                    <section className="mobile-settings-card">
                      <p>모바일 미리보기</p>
                      <button
                        onClick={() => onSetForceMobileView(!forceMobileView)}
                        style={{
                          width: '100%',
                          padding: '12px',
                          background: forceMobileView ? 'var(--primary-100)' : 'var(--ink-50)',
                          color: forceMobileView ? 'var(--primary-600)' : 'var(--ink-600)',
                          borderRadius: '8px',
                          border: forceMobileView ? '1px solid var(--primary-300)' : '1px solid var(--ink-200)',
                          fontWeight: 600,
                          fontSize: '14px',
                          cursor: 'pointer',
                          transition: 'all 0.2s ease',
                        }}
                        type="button"
                      >
                        {forceMobileView ? '모바일 보기 (활성)' : '모바일 보기'}
                      </button>
                      <p style={{ fontSize: '12px', color: 'var(--ink-400)', margin: '8px 0 0', textAlign: 'center' }}>
                        데스크톱 폭에서 모바일 화면을 확인할 수 있습니다.
                      </p>
                    </section>
                  </>
                )}
              </div>
            } />
          </Routes>

          {BottomNav}
        </main>
      } />
    </Routes>
  )
}
