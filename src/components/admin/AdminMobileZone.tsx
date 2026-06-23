// 관리자 모바일 구역 — design_handoff 04 화면 (구역 시·구 단위)
// + 20 / 21 / 22 drill-down 일부
//
// 구조:
//   - InlineTabs: 구역 카드 / 비공식 / 식당 (under-line active)
//   - 담당/전체 segmented + 목록/지도 toggle
//   - Stats inline: 전체 N · 배정 M · 미배정 K(danger)
//   - 검색 input
//   - 카드 리스트 (시·구 단위, drill-down 시 동/카드 단위)
//
// 비공식 / 식당 탭은 기존 InformalCardsTab / RestaurantsTab 재사용.

import { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import type { Building, InformalAsset, InformalGroup, Role, TerritoryCard } from '../../types'
import { compareTerritoryCardsByOperationalPriority, getTerritoryCardOperationalState } from '../../utils/cardSearch'
import { InformalCardsTab } from '../InformalCardsTab'
import { RestaurantsTab } from '../RestaurantsTab'
import { Card } from '../ui'

type ZoneKind = 'territory' | 'informal' | 'restaurant'
type Scope = 'mine' | 'all'
type ViewMode = 'list' | 'map'
type Level = 'regions' | 'dongs' | 'cards'

const REGION_ORDER = ['처인구', '기흥구', '수지구', '영통구', '화성시']

function extractDong(name: string, region: string): string {
  // "처인구 김량장동 001" → "김량장동"
  const withoutRegion = name.replace(region, '').trim()
  const m = withoutRegion.match(/^(\S+동|\S+읍|\S+면|\S+리)/)
  return m ? m[1] : '기타'
}

type Props = {
  cards: TerritoryCard[]
  buildings: Building[]
  currentVisitor: string
  role: Role
  informalAssets?: InformalAsset[]
  informalGroups?: InformalGroup[]
  onOpenMap: (cardId: number) => void
  onOpenAssignedMap: (cardIds: number[], context?: { region?: string; dong?: string; scope?: Scope }) => void
  onShowMapView: () => void
  onUploadInformalAsset?: (input: { file: File; name: string; uploadedBy: string; groupId?: number | null }) => Promise<{ ok: boolean; assetId?: number; error?: string }>
  onDeleteInformalAsset?: (assetId: number) => Promise<void>
  onCreateInformalGroup?: (input: { name: string; createdBy: string }) => Promise<number | null>
  onRenameInformalGroup?: (groupId: number, name: string) => Promise<void>
  onDeleteInformalGroup?: (groupId: number) => Promise<void>
  onMoveAssetToGroup?: (assetId: number, groupId: number | null) => Promise<void>
  onToggleBuildingRestaurant?: (buildingId: number, isRestaurant: boolean) => Promise<void>
  restaurantRequests?: import('../../types').RestaurantRequest[]
  onApproveRestaurantRequest?: (id: number, opts: { name: string; address: string; reviewer: string; existingBuildingId?: number | null; lat?: number; lng?: number }) => Promise<void>
  onRejectRestaurantRequest?: (id: number, reviewer: string) => Promise<void>
}

// ── 아이콘 ─────────────────────────────
function ChevR({ size = 14, color = 'var(--muted-2)' }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <polyline points="9 6 15 12 9 18" />
    </svg>
  )
}
function ChevL({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <polyline points="15 6 9 12 15 18" />
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
function ListIcon({ size = 15 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round">
      <line x1="8" y1="6" x2="21" y2="6" />
      <line x1="8" y1="12" x2="21" y2="12" />
      <line x1="8" y1="18" x2="21" y2="18" />
      <line x1="3" y1="6" x2="3.01" y2="6" />
      <line x1="3" y1="12" x2="3.01" y2="12" />
      <line x1="3" y1="18" x2="3.01" y2="18" />
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

export function AdminMobileZone({
  cards,
  buildings,
  currentVisitor,
  role,
  informalAssets = [],
  informalGroups = [],
  restaurantRequests = [],
  onOpenMap,
  onOpenAssignedMap,
  onShowMapView,
  onUploadInformalAsset,
  onDeleteInformalAsset,
  onCreateInformalGroup,
  onRenameInformalGroup,
  onDeleteInformalGroup,
  onMoveAssetToGroup,
  onToggleBuildingRestaurant,
  onApproveRestaurantRequest,
  onRejectRestaurantRequest,
}: Props) {
  // URL 쿼리로 드릴 상태 보존 — 지도 진입 후 뒤로 오면 같은 위치로 복귀
  const [searchParams, setSearchParams] = useSearchParams()
  const urlLevel = (searchParams.get('level') as Level | null) ?? 'regions'
  const urlRegion = searchParams.get('region') ?? ''
  const urlDong = searchParams.get('dong') ?? ''
  const defaultScope: Scope = role === 'admin' ? 'all' : 'mine'
  const urlScope: Scope = (searchParams.get('scope') === 'all' || searchParams.get('scope') === 'mine')
    ? (searchParams.get('scope') as Scope)
    : defaultScope

  const [zoneKind, setZoneKind] = useState<ZoneKind>('territory')
  const [scope, setScope] = useState<Scope>(urlScope)
  const [view, setView] = useState<ViewMode>('list')
  const [level, setLevel] = useState<Level>(urlLevel)
  const [selectedRegion, setSelectedRegion] = useState(urlRegion)
  const [selectedDong, setSelectedDong] = useState(urlDong)
  const [query, setQuery] = useState('')
  const [showDoneExcludedCards, setShowDoneExcludedCards] = useState(false)
  // 동/카드 목록 타입 필터 (지도뷰처럼 전체/주택/상가) — 0개면 목록에서 숨김
  const [typeFilter, setTypeFilter] = useState<'전체' | '주택' | '상가'>('전체')

  // 드릴 상태 + scope URL 동기화 (replace — 히스토리 오염 방지)
  useEffect(() => {
    const next = new URLSearchParams(searchParams)
    if (level === 'regions') next.delete('level'); else next.set('level', level)
    if (selectedRegion) next.set('region', selectedRegion); else next.delete('region')
    if (selectedDong) next.set('dong', selectedDong); else next.delete('dong')
    // scope 는 default 와 같으면 키 제거
    if (scope === defaultScope) next.delete('scope'); else next.set('scope', scope)
    if (next.toString() !== searchParams.toString()) {
      setSearchParams(next, { replace: true })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [level, selectedRegion, selectedDong, scope])

  // 외부에서 URL 이 바뀐 경우 (브라우저 뒤로가기 등) 상태도 따라감
  useEffect(() => {
    if (urlLevel !== level) setLevel(urlLevel)
    if (urlRegion !== selectedRegion) setSelectedRegion(urlRegion)
    if (urlDong !== selectedDong) setSelectedDong(urlDong)
    if (urlScope !== scope) setScope(urlScope)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [urlLevel, urlRegion, urlDong, urlScope])

  const informalCount = informalAssets.length
  const restaurantCount = buildings.reduce((acc, b) => {
    if (b.type !== '상가' || !b.isRestaurant) return acc
    const chineseUnits = b.units.filter(u => u.isChinese).length
    return acc + (chineseUnits === 0 ? 1 : chineseUnits)
  }, 0)

  // ── 카드 필터: 담당/전체 ─────────────────────
  const baseCards = useMemo(() => {
    if (scope === 'all') return cards
    return cards.filter((c) => {
      const leaders = c.assignedLeaders?.length ? c.assignedLeaders : c.assignedLeader ? [c.assignedLeader] : []
      return leaders.includes(currentVisitor) || c.assignedUsers.includes(currentVisitor)
    })
  }, [cards, scope, currentVisitor])

  // ── 건물 카운트 매핑 ─────────────────────────
  const cardBuildingCounts = useMemo(() => {
    const map = new Map<number, { house: number; shop: number }>()
    for (const b of buildings) {
      const prev = map.get(b.cardId) ?? { house: 0, shop: 0 }
      if (b.type === '주택') prev.house += 1
      else if (b.type === '상가') prev.shop += 1
      map.set(b.cardId, prev)
    }
    return map
  }, [buildings])

  // ── 상위 stats (전체/배정/미배정) ─────────────
  const topStats = useMemo(() => {
    const total = baseCards.length
    const assigned = baseCards.filter((c) => c.status !== '미배정').length
    const unassigned = baseCards.filter((c) => c.status === '미배정').length
    return { total, assigned, unassigned }
  }, [baseCards])

  // ── drill-down stats (현재 level 기준: 전체 카드 · 주택 · 상가) ───
  const drillStats = useMemo(() => {
    const cardsInScope = baseCards.filter((c) => {
      const region = REGION_ORDER.includes(c.region as string) ? (c.region as string) : '기타'
      if (level === 'regions') return true
      if (level === 'dongs') return region === selectedRegion
      // cards
      return region === selectedRegion && extractDong(c.name, selectedRegion) === selectedDong
    })
    let house = 0
    let shop = 0
    for (const c of cardsInScope) {
      const bc = cardBuildingCounts.get(c.id) ?? { house: 0, shop: 0 }
      house += bc.house
      shop += bc.shop
    }
    return { total: cardsInScope.length, house, shop }
  }, [baseCards, cardBuildingCounts, level, selectedRegion, selectedDong])

  // ── 담당 view 의 state totals (미사용 / 사용중 / 완료·제외) ─────
  // 본인 담당 카드를 status 별 집계 — 어휘 매핑:
  //   미배정/진행 X → 미사용 (danger)
  //   진행중       → 사용중 (info)
  //   완료/대상없음 → 완료·제외 (ok)
  const mineStateTotals = useMemo(() => {
    let unused = 0
    let inUse = 0
    let done = 0
    for (const c of baseCards) {
      const operationalState = getTerritoryCardOperationalState(c)
      if (operationalState === '완료' || operationalState === '대상없음') done += 1
      else if (operationalState === '진행중') inUse += 1
      else unused += 1
    }
    return { unused, inUse, done }
  }, [baseCards])

  // ── 시·구 list ────────────────────────────────
  const regionList = useMemo(() => {
    const map = new Map<string, TerritoryCard[]>()
    for (const card of baseCards) {
      const key = REGION_ORDER.includes(card.region as string) ? (card.region as string) : '기타'
      const list = map.get(key) ?? []
      list.push(card)
      map.set(key, list)
    }
    const out: Array<{ name: string; cards: TerritoryCard[]; house: number; shop: number; total: number; done: number }> = []
    const buildEntry = (name: string, cs: TerritoryCard[]) => {
      let house = 0, shop = 0, done = 0
      for (const c of cs) {
        const bc = cardBuildingCounts.get(c.id) ?? { house: 0, shop: 0 }
        house += bc.house
        shop += bc.shop
        const operationalState = getTerritoryCardOperationalState(c)
        if (operationalState === '완료' || operationalState === '대상없음') done += 1
      }
      return { name, cards: cs, house, shop, total: cs.length, done }
    }
    for (const r of REGION_ORDER) {
      if (map.has(r)) out.push(buildEntry(r, map.get(r)!))
    }
    if (map.has('기타')) out.push(buildEntry('기타', map.get('기타')!))
    return out.filter((e) => !query || e.name.includes(query))
  }, [baseCards, cardBuildingCounts, query])

  // ── 동 list ─────────────────────────────────
  const dongList = useMemo(() => {
    const regionCards = baseCards.filter((c) => {
      const key = REGION_ORDER.includes(c.region as string) ? (c.region as string) : '기타'
      return key === selectedRegion
    })
    const map = new Map<string, TerritoryCard[]>()
    for (const card of regionCards) {
      const dong = extractDong(card.name, selectedRegion)
      const list = map.get(dong) ?? []
      list.push(card)
      map.set(dong, list)
    }
    const out: Array<{ name: string; cards: TerritoryCard[]; house: number; shop: number; total: number; done: number }> = []
    for (const [dong, cs] of map.entries()) {
      let house = 0, shop = 0, done = 0
      for (const c of cs) {
        const bc = cardBuildingCounts.get(c.id) ?? { house: 0, shop: 0 }
        house += bc.house
        shop += bc.shop
        const operationalState = getTerritoryCardOperationalState(c)
        if (operationalState === '완료' || operationalState === '대상없음') done += 1
      }
      out.push({ name: dong, cards: cs, house, shop, total: cs.length, done })
    }
    return out
      .filter((e) => !query || e.name.includes(query))
      .sort((a, b) => {
        if (a.name === '기타') return 1
        if (b.name === '기타') return -1
        return a.name.localeCompare(b.name, 'ko')
      })
  }, [baseCards, cardBuildingCounts, selectedRegion, query])

  // ── 카드 list ───────────────────────────────
  const cardList = useMemo(() => {
    return baseCards
      .filter((c) => {
        const key = REGION_ORDER.includes(c.region as string) ? (c.region as string) : '기타'
        return key === selectedRegion && extractDong(c.name, selectedRegion) === selectedDong
      })
      .filter((c) => !query || c.name.includes(query))
      .sort(compareTerritoryCardsByOperationalPriority)
  }, [baseCards, selectedRegion, selectedDong, query])

  const isDoneExcludedCard = (card: TerritoryCard) => {
    const state = getTerritoryCardOperationalState(card)
    return state === '완료' || state === '대상없음'
  }
  const doneExcludedCards = cardList.filter(isDoneExcludedCard)
  const renderedCardList = showDoneExcludedCards
    ? cardList
    : cardList.filter((card) => !isDoneExcludedCard(card))

  // ── 네비게이션 ────────────────────────────
  const goToRegion = (region: string) => {
    setSelectedRegion(region)
    setSelectedDong('')
    setLevel('dongs')
    setQuery('')
  }
  const goToDong = (dong: string) => {
    setSelectedDong(dong)
    setLevel('cards')
    setQuery('')
  }
  const goBack = () => {
    if (level === 'cards') {
      setLevel('dongs')
      setSelectedDong('')  // 동 선택 해제해야 breadcrumb + 지도 범위가 처인구로 복귀
      setQuery('')
    } else if (level === 'dongs') {
      setLevel('regions')
      setSelectedRegion('')
      setSelectedDong('')
      setQuery('')
    }
  }

  // ── 비공식/식당 탭이면 위임 ─────────────────
  if (zoneKind === 'informal') {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16, padding: '16px 16px 24px' }}>
        <TerritoryInlineTabs active="informal" onChange={setZoneKind} cardCount={cards.length} informalCount={informalCount} restaurantCount={restaurantCount} />
        <InformalCardsTab
          role={role}
          currentVisitor={currentVisitor}
          informalAssets={informalAssets}
          informalGroups={informalGroups}
          onUpload={onUploadInformalAsset || (() => Promise.resolve({ ok: false }))}
          onDelete={onDeleteInformalAsset || (() => Promise.resolve())}
          onCreateGroup={onCreateInformalGroup || (() => Promise.resolve(null))}
          onRenameGroup={onRenameInformalGroup || (() => Promise.resolve())}
          onDeleteGroup={onDeleteInformalGroup || (() => Promise.resolve())}
          onMoveAsset={onMoveAssetToGroup || (() => Promise.resolve())}
        />
      </div>
    )
  }

  if (zoneKind === 'restaurant') {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16, padding: '16px 16px 24px' }}>
        <TerritoryInlineTabs active="restaurant" onChange={setZoneKind} cardCount={cards.length} informalCount={informalCount} restaurantCount={restaurantCount} />
        <RestaurantsTab
          role={role}
          buildings={buildings}
          cards={cards}
          currentVisitor={currentVisitor}
          restaurantRequests={restaurantRequests}
          onToggleRestaurantFlag={onToggleBuildingRestaurant}
          onApproveRestaurantRequest={onApproveRestaurantRequest}
          onRejectRestaurantRequest={onRejectRestaurantRequest}
          onOpenMap={(cardId) => onOpenMap(cardId)}
        />
      </div>
    )
  }

  // ── 구역 카드 탭 (메인) ────────────────────
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16, padding: '16px 16px 24px' }}>
      <TerritoryInlineTabs active="territory" onChange={setZoneKind} cardCount={cards.length} informalCount={informalCount} restaurantCount={restaurantCount} />

      {/* Top toolbar — level 에 따라 다른 구성 (디자인 04 vs 20/21)
          - regions: [담당/전체 segmented] [ViewToggle]
          - dongs/cards: [← back] [전체 구역 › 처인구 (› 고림동)] [spacer] [ViewToggle] */}
      {level === 'regions' ? (
        <div style={{ display: 'flex', gap: 8, alignItems: 'stretch' }}>
          {/* user 는 본인 담당만 고정 — segmented 숨김 */}
          {role !== 'user' && <SegmentedScope value={scope} onChange={setScope} />}
          <ViewToggle value={view} onChange={(next) => {
            setView(next)
            if (next === 'map') {
              if (scope === 'mine') {
                onOpenAssignedMap(baseCards.map((c) => c.id), { scope })
              } else {
                onShowMapView()
              }
            }
          }} />
        </div>
      ) : (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '0 4px' }}>
          <button
            type="button"
            onClick={goBack}
            style={{
              width: 30, height: 30, minHeight: 30,
              display: 'grid', placeItems: 'center',
              background: 'transparent', border: 'none', color: 'var(--text)',
              cursor: 'pointer', borderRadius: 8, marginLeft: -8,
              flexShrink: 0,
            }}
            aria-label="뒤로"
          >
            <ChevL size={16} />
          </button>
          <nav style={{
            display: 'flex', alignItems: 'center', gap: 4,
            fontSize: 12.5, color: 'var(--muted)',
            flexWrap: 'wrap', lineHeight: 1.4, flex: 1, minWidth: 0,
          }}>
            <span style={{ color: level === 'dongs' && !selectedDong ? 'var(--muted)' : 'var(--muted)' }}>전체 구역</span>
            {selectedRegion && (
              <>
                <span style={{ color: 'var(--muted-3)' }}>›</span>
                <span style={{ color: level === 'dongs' ? 'var(--ink)' : 'var(--muted)', fontWeight: level === 'dongs' ? 600 : 500 }}>
                  {selectedRegion}
                </span>
              </>
            )}
            {selectedDong && (
              <>
                <span style={{ color: 'var(--muted-3)' }}>›</span>
                <span style={{ color: 'var(--ink)', fontWeight: 600 }}>{selectedDong}</span>
              </>
            )}
          </nav>
          <ViewToggle value={view} onChange={(next) => {
            setView(next)
            if (next === 'map') {
              // 현재 드릴 컨텍스트의 카드만 지도에 노출
              // - region 만 선택: 그 구 전체 카드
              // - region + dong 선택: 그 동의 카드
              const ctxCardIds = baseCards
                .filter((c) => !selectedRegion || c.region === selectedRegion)
                .filter((c) => !selectedDong || c.area === selectedDong)
                .map((c) => c.id)
              onOpenAssignedMap(ctxCardIds, { region: selectedRegion || undefined, dong: selectedDong || undefined, scope })
            }
          }} />
        </div>
      )}

      {/* Stats inline
          - 전체 view: 전체 / 배정 / 미배정 (디자인 04 의 기본 카운터)
          - 담당 view + drill-down: 디자인 20/21 의 압축 stats (전체 · 주택 · 상가)
            대신 디자인 22 의 미사용/사용중/완료·제외 totals 행은 별도 카드로 아래 */}
      {scope === 'all' && level === 'regions' ? (
        <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0 4px', fontSize: 13, color: 'var(--muted)' }}>
          <span><span style={{ color: 'var(--muted)' }}>전체</span> <b style={{ color: 'var(--ink)', fontWeight: 600, marginLeft: 4, fontVariantNumeric: 'tabular-nums' }}>{topStats.total}</b></span>
          <span><span style={{ color: 'var(--muted)' }}>배정</span> <b style={{ color: 'var(--ink)', fontWeight: 600, marginLeft: 4, fontVariantNumeric: 'tabular-nums' }}>{topStats.assigned}</b></span>
          <span><span style={{ color: 'var(--muted)' }}>미배정</span> <b style={{ color: 'var(--status-danger)', fontWeight: 600, marginLeft: 4, fontVariantNumeric: 'tabular-nums' }}>{topStats.unassigned}</b></span>
        </div>
      ) : level !== 'regions' ? (
        <div style={{ display: 'flex', flexWrap: 'wrap', padding: '0 2px', gap: 6 }}>
          {([
            { key: '전체' as const, label: '전체', count: drillStats.total },
            { key: '주택' as const, label: '주택', count: drillStats.house },
            { key: '상가' as const, label: '상가', count: drillStats.shop },
          ]).map((f) => {
            const active = typeFilter === f.key
            return (
              <button
                key={f.key}
                type="button"
                onClick={() => setTypeFilter(f.key)}
                style={{
                  display: 'inline-flex', alignItems: 'baseline', gap: 3,
                  padding: '3px 9px', borderRadius: 7, cursor: 'pointer',
                  fontSize: 12, fontWeight: active ? 700 : 500, lineHeight: 1.5,
                  border: active ? '1px solid var(--ink)' : '1px solid var(--line)',
                  background: active ? 'var(--ink)' : 'var(--surface)',
                  color: active ? '#fff' : 'var(--muted)',
                }}
              >
                {f.label}
                <b style={{ fontWeight: 700, fontVariantNumeric: 'tabular-nums', color: active ? '#fff' : 'var(--ink)' }}>{f.count}</b>
              </button>
            )
          })}
        </div>
      ) : (
        /* scope === 'mine' && level === 'regions' → 담당 state totals 행 (디자인 22) */
        <div style={{
          display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 14,
          padding: '8px 12px',
          background: 'var(--surface)', border: '1px solid var(--line)',
          borderRadius: 8,
        }}>
          {[
            { label: '미사용', count: mineStateTotals.unused, color: 'var(--status-danger)' },
            { label: '사용중', count: mineStateTotals.inUse, color: 'var(--status-info)' },
            { label: '완료·제외', count: mineStateTotals.done, color: 'var(--status-ok)' },
          ].map((s) => (
            <span key={s.label} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 13 }}>
              <span style={{ width: 7, height: 7, borderRadius: 99, background: s.color, flexShrink: 0 }} />
              <b style={{ color: 'var(--ink)', fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>{s.count}</b>
              <span style={{ color: 'var(--muted)', fontSize: 12 }}>{s.label}</span>
            </span>
          ))}
        </div>
      )}

      {/* 검색 — 카드 레벨은 디자인 21 에서 검색 안 보임 */}
      {level !== 'cards' && (
        <label style={{
          background: 'var(--surface)',
          border: '1px solid var(--line)',
          borderRadius: 10,
          padding: '11px 14px',
          fontSize: 14,
          color: 'var(--text)',
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          cursor: 'text',
        }}>
          <SearchIcon />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={level === 'regions' ? '시·구 검색' : '동 이름 검색'}
            style={{
              flex: 1, minWidth: 0, border: 'none', outline: 'none',
              background: 'transparent', font: 'inherit', color: 'inherit', padding: 0,
            }}
          />
        </label>
      )}

      {/* 리스트 (level 별) */}
      {level === 'regions' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {regionList.length === 0 ? (
            <Card padding={18} style={{ textAlign: 'center', color: 'var(--muted)', fontSize: 13 }}>
              {scope === 'mine' ? '담당 구역이 없습니다' : '카드가 없습니다'}
            </Card>
          ) : (
            regionList.map((r) => (
              <GroupRow key={r.name} name={r.name} house={r.house} shop={r.shop} done={r.done} total={r.total} onClick={() => goToRegion(r.name)} />
            ))
          )}
        </div>
      )}

      {level === 'dongs' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {dongList.length === 0 ? (
            <Card padding={18} style={{ textAlign: 'center', color: 'var(--muted)', fontSize: 13 }}>
              동이 없습니다
            </Card>
          ) : (
            dongList
              .filter((d) => typeFilter === '전체' || (typeFilter === '주택' ? d.house > 0 : d.shop > 0))
              .map((d) => (
                <GroupRow key={d.name} name={d.name} house={d.house} shop={d.shop} done={d.done} total={d.total} typeFilter={typeFilter} onClick={() => goToDong(d.name)} />
              ))
          )}
        </div>
      )}

      {level === 'cards' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {cardList.length === 0 ? (
            <Card padding={18} style={{ textAlign: 'center', color: 'var(--muted)', fontSize: 13 }}>
              카드가 없습니다
            </Card>
          ) : (
            <>
              {renderedCardList
                .filter((c) => {
                  if (typeFilter === '전체') return true
                  const bc = cardBuildingCounts.get(c.id) ?? { house: 0, shop: 0 }
                  return typeFilter === '주택' ? bc.house > 0 : bc.shop > 0
                })
                .map((c) => (
                  <CardRow key={c.id} card={c} buildingCount={cardBuildingCounts.get(c.id) ?? { house: 0, shop: 0 }} typeFilter={typeFilter} onClick={() => onOpenMap(c.id)} />
                ))}
              {doneExcludedCards.length > 0 && (
                <button
                  type="button"
                  onClick={() => setShowDoneExcludedCards((open) => !open)}
                  style={{
                    width: '100%',
                    minHeight: 42,
                    border: '1px dashed var(--line-2)',
                    borderRadius: 14,
                    background: 'var(--surface)',
                    color: 'var(--muted)',
                    fontSize: 13,
                    fontWeight: 700,
                    cursor: 'pointer',
                  }}
                >
                  완료·제외 {doneExcludedCards.length}개 {showDoneExcludedCards ? '접기' : '펼치기'}
                </button>
              )}
            </>
          )}
        </div>
      )}
    </div>
  )
}

// ── 인라인 탭 (구역 카드 / 비공식 / 식당) ─────────
function TerritoryInlineTabs({
  active,
  onChange,
  cardCount,
  informalCount,
  restaurantCount,
}: {
  active: ZoneKind
  onChange: (kind: ZoneKind) => void
  cardCount: number
  informalCount: number
  restaurantCount: number
}) {
  const tabs: { id: ZoneKind; label: string; count: number }[] = [
    { id: 'territory', label: '구역 카드', count: cardCount },
    { id: 'informal', label: '비공식', count: informalCount },
    { id: 'restaurant', label: '식당', count: restaurantCount },
  ]
  return (
    <div
      role="tablist"
      style={{
        display: 'flex',
        gap: 4,
        borderBottom: '1px solid var(--line)',
        padding: '0 4px',
        margin: '0 -16px',
        paddingLeft: 20,
        paddingRight: 20,
      }}
    >
      {tabs.map((t) => {
        const isActive = active === t.id
        return (
          <button
            key={t.id}
            type="button"
            role="tab"
            aria-selected={isActive}
            onClick={() => onChange(t.id)}
            style={{
              padding: '10px 4px 12px',
              marginRight: 18,
              border: 'none',
              background: 'transparent',
              font: 'inherit',
              fontSize: 14,
              fontWeight: isActive ? 600 : 500,
              color: isActive ? 'var(--ink)' : 'var(--muted)',
              position: 'relative',
              display: 'inline-flex',
              alignItems: 'baseline',
              gap: 5,
              cursor: 'pointer',
              minHeight: 0,
            }}
          >
            {t.label}
            <span style={{
              fontSize: 12,
              color: isActive ? 'var(--ink)' : 'var(--muted-2)',
              fontWeight: 500,
              fontVariantNumeric: 'tabular-nums',
            }}>
              {t.count}
            </span>
            {isActive && (
              <span
                aria-hidden
                style={{
                  position: 'absolute',
                  left: 0,
                  right: 18,
                  bottom: -1,
                  height: 2,
                  background: 'var(--ink)',
                  borderRadius: 2,
                }}
              />
            )}
          </button>
        )
      })}
    </div>
  )
}

// ── 담당/전체 segmented ────────────────────────
function SegmentedScope({ value, onChange }: { value: Scope; onChange: (v: Scope) => void }) {
  const options: { value: Scope; label: string }[] = [
    { value: 'mine', label: '담당 구역' },
    { value: 'all', label: '전체 구역' },
  ]
  return (
    <div style={{
      background: 'var(--tint)',
      borderRadius: 10,
      padding: 3,
      display: 'grid',
      gridTemplateColumns: '1fr 1fr',
      gap: 0,
      flex: 1,
    }}>
      {options.map((opt) => {
        const active = opt.value === value
        return (
          <button
            key={opt.value}
            type="button"
            onClick={() => onChange(opt.value)}
            style={{
              border: 'none',
              font: 'inherit',
              fontSize: 13,
              fontWeight: active ? 600 : 500,
              color: active ? 'var(--ink)' : 'var(--muted)',
              padding: '9px 8px',
              borderRadius: 7,
              textAlign: 'center',
              background: active ? 'var(--surface)' : 'transparent',
              boxShadow: active ? '0 1px 2px rgba(0,0,0,0.04)' : 'none',
              cursor: 'pointer',
              minHeight: 0,
            }}
          >
            {opt.label}
          </button>
        )
      })}
    </div>
  )
}

// ── 목록/지도 toggle ────────────────────────────
function ViewToggle({ value, onChange }: { value: ViewMode; onChange: (v: ViewMode) => void }) {
  return (
    <div style={{
      background: 'var(--tint)',
      borderRadius: 10,
      padding: 3,
      display: 'flex',
      gap: 0,
    }}>
      <button
        type="button"
        onClick={() => onChange('list')}
        title="목록"
        aria-label="목록"
        style={{
          width: 36, height: 30, minHeight: 30,
          display: 'grid', placeItems: 'center',
          border: 'none', borderRadius: 7,
          background: value === 'list' ? 'var(--surface)' : 'transparent',
          color: value === 'list' ? 'var(--ink)' : 'var(--muted)',
          boxShadow: value === 'list' ? '0 1px 2px rgba(0,0,0,0.04)' : 'none',
          cursor: 'pointer',
        }}
      >
        <ListIcon />
      </button>
      <button
        type="button"
        onClick={() => onChange('map')}
        title="지도"
        aria-label="지도"
        style={{
          width: 36, height: 30, minHeight: 30,
          display: 'grid', placeItems: 'center',
          border: 'none', borderRadius: 7,
          background: value === 'map' ? 'var(--surface)' : 'transparent',
          color: value === 'map' ? 'var(--ink)' : 'var(--muted)',
          boxShadow: value === 'map' ? '0 1px 2px rgba(0,0,0,0.04)' : 'none',
          cursor: 'pointer',
        }}
      >
        <MapIcon />
      </button>
    </div>
  )
}

// ── 그룹 (시/구 OR 동) 행 ──────────────────────
function GroupRow({
  name, house, shop, done, total, onClick, typeFilter = '전체',
}: {
  name: string
  house: number
  shop: number
  done: number
  total: number
  onClick: () => void
  typeFilter?: '전체' | '주택' | '상가'
}) {
  const countText = typeFilter === '주택' ? `주택 ${house}`
    : typeFilter === '상가' ? `상가 ${shop}`
    : `주택 ${house} · 상가 ${shop}`
  const pct = total > 0 ? Math.round((done / total) * 100) : 0
  const isUnassigned = total === 0
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        display: 'block', width: '100%', padding: 0,
        border: 'none', background: 'transparent',
        cursor: 'pointer', textAlign: 'left', minHeight: 0,
      }}
    >
      <Card padding="14px 16px">
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 2 }}>
            <span style={{
              fontSize: 15, fontWeight: 600,
              color: isUnassigned ? 'var(--muted)' : 'var(--ink)',
            }}>
              {name}
            </span>
            <span style={{ fontSize: 12.5, color: 'var(--muted)' }}>
              {countText}
            </span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 3 }}>
            <span style={{ fontSize: 13, color: 'var(--ink)', fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>
              {pct}%
            </span>
            <span style={{ fontSize: 12, color: 'var(--muted)', fontVariantNumeric: 'tabular-nums' }}>
              {done} / {total}
            </span>
          </div>
          <ChevR size={16} />
        </div>
      </Card>
    </button>
  )
}

// ── 카드 행 (drill-down 마지막 레벨) ────────────
function CardRow({
  card, buildingCount, onClick, typeFilter = '전체',
}: {
  card: TerritoryCard
  buildingCount: { house: number; shop: number }
  onClick: () => void
  typeFilter?: '전체' | '주택' | '상가'
}) {
  const operationalState = getTerritoryCardOperationalState(card)
  const isEmptyTarget = operationalState === '대상없음'
  const countText = typeFilter === '주택' ? `주택 ${buildingCount.house}`
    : typeFilter === '상가' ? `상가 ${buildingCount.shop}`
    : `주택 ${buildingCount.house} · 상가 ${buildingCount.shop}`
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        display: 'block', width: '100%', padding: 0,
        border: 'none', background: 'transparent',
        cursor: 'pointer', textAlign: 'left', minHeight: 0,
      }}
    >
      <Card padding="12px 14px">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {/* 첫 줄: 이름 + StatePill + 지도 ghost (디자인 21) */}
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
            <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 2 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                <span style={{ fontSize: 15, fontWeight: 600, color: 'var(--ink)' }}>{card.name}</span>
              </div>
              <span style={{ fontSize: 12.5, color: 'var(--muted)' }}>
                {card.assignedLeader ? `담당 ${card.assignedLeader} · ` : ''}
                {isEmptyTarget ? '완료·제외' : countText}
              </span>
            </div>
            <span
              aria-hidden
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 5,
                height: 30, padding: '0 12px',
                border: '1px solid var(--line-2)', borderRadius: 8,
                background: 'var(--surface)', color: 'var(--text)',
                fontSize: 12, fontWeight: 600, flexShrink: 0,
              }}
            >
              <MapIcon size={13} /> 지도
            </span>
          </div>

          {/* 진행률 바 */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{ flex: 1, height: 4, background: 'var(--tint)', borderRadius: 99, overflow: 'hidden' }}>
              <div style={{ width: `${card.progress}%`, height: '100%', background: 'var(--ink)', borderRadius: 99 }} />
            </div>
            <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--ink)', minWidth: 32, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
              {card.progress}%
            </span>
          </div>
        </div>
      </Card>
    </button>
  )
}
