import { useEffect, useMemo, useState } from 'react'
import { Routes, Route, Navigate, useNavigate, useLocation, useSearchParams } from 'react-router-dom'
// MobileCalendar 는 디자인 v2 적용 후 미사용 (AdminMobileCalendar 가 모든 역할 처리)
// import { MobileCalendar } from './MobileCalendar'
import { MobileAdminAssignment } from './MobileAdminAssignment'
import { MobileLeaderAssignment } from './MobileLeaderAssignment'
import { MobileMap } from './MobileMap'
import { MobileNotices } from './MobileNotices'
import { MobileTerritory } from './MobileTerritory'
import { MobileRegularVisitDetail } from './MobileRegularVisitDetail'
import { AdminMobileHome } from './admin/AdminMobileHome'
import { AdminMobileCalendar } from './admin/AdminMobileCalendar'
import { AdminMobileZone } from './admin/AdminMobileZone'
import { MobileUsers } from './MobileUsers'
import { MobileSignupRequests } from './MobileSignupRequests'
import { MobileProfileSettings } from './MobileProfileSettings'
import type { Building, CalendarEvent, CardBoundary, EventInformalAssignment, EventRestaurantAssignment, InformalAsset, InformalGroup, Notice, ReturnVisit, ReturnVisitLog, Role, ServiceSession, SpecialPeriod, TerritoryCard, TimeSlot, Unit, UnitStatus, VisitHistory } from '../types'
import { InformalCardsTab } from './InformalCardsTab'
import { RestaurantsTab } from './RestaurantsTab'
import type { AuthUser } from '../hooks/useAuth'
import type { AppLanguage } from '../i18n'
import { languageLabels, t } from '../i18n'
import { SpecialPeriodBanner } from './SpecialPeriodBanner'
import { SpecialPeriodSettings } from './SpecialPeriodSettings'
import { PwaInstallSection } from './PwaInstall'
import { NotificationSettings } from './NotificationSettings'
import { AppUpdateCard } from './AppUpdateCard'
import { AppHeader } from './AppHeader'
import { formatRelativeVisitDate, getLatestReturnVisitDate, getUserReturnVisits } from '../utils/returnVisits'

type MobileTab = '홈' | '캘린더' | '활동' | '구역' | '지도' | '배정' | '설정'

const tabToPath: Record<MobileTab, string> = {
  '홈': '/',
  '캘린더': '/calendar',
  '활동': '/territory',
  '구역': '/zone',
  '지도': '/map',
  '배정': '/assignment',
  '설정': '/settings',
}

const pathToTab: Record<string, MobileTab> = {
  '/': '홈',
  '/notices': '설정',
  '/profile': '설정',
  '/special-periods': '설정',
  '/signup-requests': '설정',
  '/calendar': '캘린더',
  '/territory': '활동',
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
  '활동': 'territory',
  '구역': 'territory',
  '지도': 'map',
  '배정': 'assignment',
  '설정': 'settings',
}

const homeWeekdayLabels: Record<AppLanguage, string[]> = {
  ko: ['일요일', '월요일', '화요일', '수요일', '목요일', '금요일', '토요일'],
  zh: ['周日', '周一', '周二', '周三', '周四', '周五', '周六'],
  en: ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'],
}

function formatHomeDate(date: Date, language: AppLanguage) {
  if (language === 'en') {
    return new Intl.DateTimeFormat('en', { year: 'numeric', month: 'long', day: 'numeric', weekday: 'long' }).format(date)
  }
  if (language === 'zh') {
    return `${date.getFullYear()}年 ${date.getMonth() + 1}月 ${date.getDate()}日 ${homeWeekdayLabels.zh[date.getDay()]}`
  }
  return `${date.getFullYear()}년 ${date.getMonth() + 1}월 ${date.getDate()}일 ${homeWeekdayLabels.ko[date.getDay()]}`
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

function SettingsIcon({ name }: { name: 'notice' | 'users' | 'signup' | 'season' | 'notification' | 'logout' }) {
  if (name === 'users') {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8Z" />
        <path d="M3 21v-1a6 6 0 0 1 12 0v1" />
        <path d="M17 10a3 3 0 1 0 0-6" />
        <path d="M17 14a5 5 0 0 1 4 5v1" />
      </svg>
    )
  }
  if (name === 'season') {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="m12 3 2.7 5.5 6.1.9-4.4 4.3 1 6.1L12 16.9l-5.4 2.9 1-6.1-4.4-4.3 6.1-.9Z" />
      </svg>
    )
  }
  if (name === 'signup') {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8Z" />
        <path d="M3 21v-1a6 6 0 0 1 12 0v1" />
        <path d="m17 9 2 2 4-4" />
        <path d="M18 15v5" />
      </svg>
    )
  }
  if (name === 'logout') {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M10 6H6v12h4" />
        <path d="M13 8l4 4-4 4" />
        <path d="M17 12H9" />
      </svg>
    )
  }
  if (name === 'notification') {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M18 9a6 6 0 1 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9" />
        <path d="M10 21a2 2 0 0 0 4 0" />
      </svg>
    )
  }
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M5 10v4" />
      <path d="M9 8v8" />
      <path d="M13 6v12" />
      <path d="M17 9v6" />
      <path d="M20 6v12" />
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
  language,
  cards,
  buildings = [],
  currentVisitor,
  role,
  onOpenMap,
  onOpenAssignedMap,
  onShowMapView,
  // 비공식 카드 탭 props
  informalAssets = [],
  informalGroups = [],
  onUploadInformalAsset,
  onDeleteInformalAsset,
  onCreateInformalGroup,
  onRenameInformalGroup,
  onDeleteInformalGroup,
  onMoveAssetToGroup,
  // 식당 탭 props
  onToggleBuildingRestaurant,
}: {
  language: AppLanguage
  cards: TerritoryCard[]
  buildings?: Building[]
  currentVisitor: string
  role: Role
  onOpenMap: (cardId: number) => void
  onOpenAssignedMap: (cardIds: number[]) => void
  onShowMapView: () => void
  informalAssets?: InformalAsset[]
  informalGroups?: InformalGroup[]
  onUploadInformalAsset?: (input: { file: File; name: string; uploadedBy: string; groupId?: number | null }) => Promise<{ ok: boolean; assetId?: number; error?: string }>
  onDeleteInformalAsset?: (assetId: number) => Promise<void>
  onCreateInformalGroup?: (input: { name: string; createdBy: string }) => Promise<number | null>
  onRenameInformalGroup?: (groupId: number, name: string) => Promise<void>
  onDeleteInformalGroup?: (groupId: number) => Promise<void>
  onMoveAssetToGroup?: (assetId: number, groupId: number | null) => Promise<void>
  onToggleBuildingRestaurant?: (buildingId: number, isRestaurant: boolean) => Promise<void>
}) {
  // 종류 sub-tab
  type ZoneKind = 'territory' | 'informal' | 'restaurant'
  const [zoneKind, setZoneKind] = useState<ZoneKind>('territory')
  const informalCount = informalAssets.length
  const restaurantCount = buildings.filter((b) => b.type === '상가' && b.isRestaurant).length
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

  const cardBuildingTypeCounts = useMemo(() => {
    const map = new Map<number, { total: number; house: number; shop: number }>()
    cards.forEach((card) => map.set(card.id, { total: 0, house: 0, shop: 0 }))
    buildings.forEach((building) => {
      const current = map.get(building.cardId) ?? { total: 0, house: 0, shop: 0 }
      current.total += 1
      if (building.type === '주택') current.house += 1
      if (building.type === '상가') current.shop += 1
      map.set(building.cardId, current)
    })
    return map
  }, [buildings, cards])

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

  // 카드별 주택/상가 카운트 (한 번 계산 후 재사용)
  const cardBuildingCounts = useMemo(() => {
    const map = new Map<number, { house: number; shop: number }>()
    for (const card of cards) map.set(card.id, { house: 0, shop: 0 })
    for (const b of buildings) {
      const entry = map.get(b.cardId)
      if (!entry) continue
      if (b.type === '주택') entry.house += 1
      else if (b.type === '상가') entry.shop += 1
    }
    return map
  }, [cards, buildings])

  // 카드 그룹 집계 헬퍼 (지역/동 row 에 표시할 종합 정보)
  type GroupAgg = {
    count: number
    house: number
    shop: number
    progress: number // 평균
  }
  const aggregateCards = (cardSubset: TerritoryCard[]): GroupAgg => {
    let house = 0
    let shop = 0
    let totalProgress = 0
    for (const c of cardSubset) {
      const bc = cardBuildingCounts.get(c.id) ?? { house: 0, shop: 0 }
      house += bc.house
      shop += bc.shop
      totalProgress += c.progress
    }
    return {
      count: cardSubset.length,
      house,
      shop,
      progress: cardSubset.length > 0 ? Math.round(totalProgress / cardSubset.length) : 0,
    }
  }

  const regionList = useMemo(() => {
    const map = new Map<string, TerritoryCard[]>()
    for (const card of cards) {
      const key = REGION_ORDER.includes(card.region as string) ? (card.region as string) : '기타'
      const list = map.get(key) ?? []
      list.push(card)
      map.set(key, list)
    }
    const result: Array<[string, GroupAgg]> = []
    for (const r of REGION_ORDER) { if (map.has(r)) result.push([r, aggregateCards(map.get(r)!)]) }
    if (map.has('기타')) result.push(['기타', aggregateCards(map.get('기타')!)])
    return result
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cards, cardBuildingCounts])

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
    const map = new Map<string, TerritoryCard[]>()
    for (const card of regionCards) {
      const dong = extractDong(card.name, selectedRegion)
      const list = map.get(dong) ?? []
      list.push(card)
      map.set(dong, list)
    }
    const q = query.trim()
    return [...map.entries()]
      .filter(([d]) => !q || d.includes(q))
      .map(([dong, list]): [string, GroupAgg] => [dong, aggregateCards(list)])
      .sort((a, b) => {
        if (a[0] === '기타') return 1
        if (b[0] === '기타') return -1
        return a[0].localeCompare(b[0], 'ko')
      })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cards, selectedRegion, query, cardBuildingCounts])

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
      {/* ── 종류 sub-tab ── */}
      <div className="mobile-zone-kind-tabs" role="tablist" aria-label="구역 종류">
        <button
          role="tab"
          aria-selected={zoneKind === 'territory'}
          className={zoneKind === 'territory' ? 'active' : ''}
          onClick={() => setZoneKind('territory')}
          type="button"
        >
          <span>구역 카드</span>
          <em>{cards.length}</em>
        </button>
        <button
          role="tab"
          aria-selected={zoneKind === 'informal'}
          className={zoneKind === 'informal' ? 'active' : ''}
          onClick={() => setZoneKind('informal')}
          type="button"
        >
          <span>비공식 카드</span>
          <em>{informalCount}</em>
        </button>
        <button
          role="tab"
          aria-selected={zoneKind === 'restaurant'}
          className={zoneKind === 'restaurant' ? 'active' : ''}
          onClick={() => setZoneKind('restaurant')}
          type="button"
        >
          <span>식당</span>
          <em>{restaurantCount}</em>
        </button>
      </div>

      {/* 비공식 카드 탭 */}
      {zoneKind === 'informal' && (
        <div style={{ padding: '12px 0' }}>
          {onUploadInformalAsset && onDeleteInformalAsset && onCreateInformalGroup && onRenameInformalGroup && onDeleteInformalGroup && onMoveAssetToGroup ? (
            <InformalCardsTab
              role={role}
              currentVisitor={currentVisitor}
              informalAssets={informalAssets}
              informalGroups={informalGroups}
              onUpload={onUploadInformalAsset}
              onDelete={onDeleteInformalAsset}
              onCreateGroup={onCreateInformalGroup}
              onRenameGroup={onRenameInformalGroup}
              onDeleteGroup={onDeleteInformalGroup}
              onMoveAsset={onMoveAssetToGroup}
            />
          ) : (
            <p style={{ padding: 24, textAlign: 'center', color: '#94a3b8' }}>
              비공식 카드 기능을 사용할 수 없습니다.
            </p>
          )}
        </div>
      )}

      {/* 식당 탭 */}
      {zoneKind === 'restaurant' && (
        <div style={{ padding: '12px 0' }}>
          <RestaurantsTab
            role={role}
            buildings={buildings}
            cards={cards}
            onToggleRestaurantFlag={onToggleBuildingRestaurant}
            onOpenMap={onOpenMap}
          />
        </div>
      )}

      {/* 구역 카드 탭 (기존 컨텐츠) */}
      {zoneKind === 'territory' && <>

      {/* ── 서브 헤더 (지도 토글 + drill 백) ── */}
      <div className="mobile-zone-head">
        {scope === 'all' && level !== 'regions' && (
          <button className="mz-back-btn" onClick={goBack} type="button" aria-label="뒤로">
            <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2.2">
              <path d="M13 4 7 10l6 6" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </button>
        )}
        {scope === 'all' && level !== 'regions' && <h3 className="mobile-zone-drill-title">{drillTitle}</h3>}
        <div className="mobile-zone-view-toggle" aria-label="보기 전환">
          <span>{t(language, 'zone.list')}</span>
          <button onClick={onShowMapView} type="button">{t(language, 'zone.map')}</button>
        </div>
      </div>

      {/* ── 스코프 토글 (항상 표시) ── */}
      {(scope === 'mine' || level === 'regions') && (
        <div className="mobile-zone-scope-toggle" aria-label="구역 범위">
          <button className={scope === 'mine' ? 'active' : ''} onClick={() => switchScope('mine')} type="button">{t(language, 'zone.myTerritories')}</button>
          <button className={scope === 'all' ? 'active' : ''} onClick={() => switchScope('all')} type="button">{t(language, 'zone.allTerritories')}</button>
        </div>
      )}

      {/* ════════════════════════════════════════════════════
          담당 구역 뷰 (원래 상태별 그룹 아코디언)
          ════════════════════════════════════════════════════ */}
      {scope === 'mine' && (
        <>
          <div className="mz-kpi-bar" aria-label="구역 요약">
            <div className="mz-kpi-text">
              <span className="mz-kpi-need"><strong>{mineNeedCount}</strong>{t(language, 'calendar.countSuffix')} {t(language, 'zone.summaryNeed')}</span>
              <span className="mz-kpi-sep">·</span>
              <span className="mz-kpi-progress"><strong>{mineInProgressCount}</strong>{t(language, 'calendar.countSuffix')} {t(language, 'zone.summaryProgress')}</span>
              <span className="mz-kpi-sep">·</span>
              <span className="mz-kpi-done"><strong>{mineDoneCount}</strong>{t(language, 'calendar.countSuffix')} {t(language, 'zone.summaryDone')}</span>
            </div>
            {mineCards.length > 0 && (
              <button className="mz-assigned-map-btn" onClick={() => onOpenAssignedMap(mineCards.map((card) => card.id))} type="button">
                담당 지도
              </button>
            )}
          </div>

          {mineCards.length === 0 ? (
            <div className="mobile-zone-empty">{t(language, 'zone.noAssignedCards')}</div>
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
                      <span className="mobile-zone-region-count">{regionCards.length}{t(language, 'calendar.countSuffix')}</span>
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
                                <span className="mobile-zone-status-count">{list.length}{t(language, 'calendar.countSuffix')}</span>
                                {isComplete && <span className="mobile-zone-status-chevron">{isExpanded ? '∧' : '∨'}</span>}
                              </button>
                              {isExpanded && list.map((card) => {
                                const displayName = stripRegionFromName(card.name, region)
                                const counts = cardBuildingTypeCounts.get(card.id) ?? { total: card.buildings, house: 0, shop: 0 }
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
                                        {t(language, 'zone.map')}
                                      </span>
                                    </div>
                                    <div className="mobile-zone-card-line2">
                                      <span className="mobile-zone-card-meta">전체 {counts.total} · 주택 {counts.house} · 상가 {counts.shop}</span>
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
              <button type="button" onClick={() => { setLevel('regions'); setQuery('') }}>{t(language, 'zone.allTerritories')}</button>
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
                <span>{t(language, 'map.all')} <strong>{kpi.total}</strong>{t(language, 'calendar.countSuffix')}</span>
                <span className="mz-kpi-sep">·</span>
                <span>{t(language, 'zone.assigned')} <strong>{kpi.assigned}</strong>{t(language, 'calendar.countSuffix')}</span>
                <span className="mz-kpi-sep">·</span>
                <span className="mz-kpi-unassigned-text">{t(language, 'zone.unassigned')} <strong>{kpi.unassigned}</strong>{t(language, 'calendar.countSuffix')}</span>
              </div>
              <input
                className="mobile-zone-search"
                placeholder={t(language, 'zone.dongSearch')}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
              {/* 검색어 없으면 구 목록, 있으면 동 검색 결과 */}
              {query.trim() === '' ? (
                <div className="mz-list">
                  {regionList.map(([region, agg]) => (
                    <button key={region} className="mz-nav-row mz-nav-row--rich" onClick={() => goToRegion(region)} type="button">
                      <div className="mz-nav-row-body">
                        <div className="mz-nav-row-line1">
                          <strong className="mz-nav-name">{region}</strong>
                          <span className="mz-nav-count">{agg.count}{t(language, 'calendar.countSuffix')}</span>
                        </div>
                        <div className="mz-nav-row-sub">
                          주택 {agg.house} · 상가 {agg.shop}
                        </div>
                        <div className="mz-nav-row-bar">
                          <div className="mz-nav-row-bar-fill" style={{ width: `${agg.progress}%` }} />
                          <span>{agg.progress}%</span>
                        </div>
                      </div>
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
                      <span className="mz-nav-count">{count}{t(language, 'calendar.countSuffix')}</span>
                      <svg className="mz-nav-chevron" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M7 4l6 6-6 6" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                    </button>
                  ))}
                  {dongSearchResults.length === 0 && <div className="mobile-zone-empty">{t(language, 'zone.noDong')}</div>}
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
                <span>{t(language, 'map.all')} <strong>{levelCount}</strong>{t(language, 'calendar.countSuffix')}</span>
                <span className="mz-kpi-sep">·</span>
                <span>{t(language, 'zone.assigned')} <strong>{assignedInRegion}</strong>{t(language, 'calendar.countSuffix')}</span>
                <span className="mz-kpi-sep">·</span>
                <span className="mz-kpi-unassigned-text">{t(language, 'zone.unassigned')} <strong>{levelCount - assignedInRegion}</strong>{t(language, 'calendar.countSuffix')}</span>
              </div>
              <input
                className="mobile-zone-search"
                placeholder={t(language, 'zone.dongSearch')}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
              <div className="mz-list">
                {dongList.map(([dong, agg]) => (
                  <button key={dong} className="mz-nav-row mz-nav-row--rich" onClick={() => goToDong(dong)} type="button">
                    <div className="mz-nav-row-body">
                      <div className="mz-nav-row-line1">
                        <strong className="mz-nav-name">{dong}</strong>
                        <span className="mz-nav-count">{agg.count}{t(language, 'calendar.countSuffix')}</span>
                      </div>
                      <div className="mz-nav-row-sub">
                        주택 {agg.house} · 상가 {agg.shop}
                      </div>
                      <div className="mz-nav-row-bar">
                        <div className="mz-nav-row-bar-fill" style={{ width: `${agg.progress}%` }} />
                        <span>{agg.progress}%</span>
                      </div>
                    </div>
                    <svg className="mz-nav-chevron" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M7 4l6 6-6 6" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  </button>
                ))}
                {dongList.length === 0 && <div className="mobile-zone-empty">{t(language, 'zone.noDong')}</div>}
              </div>
            </>
            )
          })()}

          {/* 3단계: 카드 목록 */}
          {level === 'cards' && (
            <>
              <div className="mz-level-count">{t(language, 'zone.allCards')} <strong>{levelCount}{t(language, 'calendar.countSuffix')}</strong></div>
              <div className="mz-list">
                {cardList.map((card) => {
                  const displayName = stripRegionFromName(card.name, selectedRegion)
                  const leader =
                    (card.assignedLeaders?.length ? card.assignedLeaders[0] : null) ??
                    card.assignedLeader ?? t(language, 'zone.unassigned')
                  const bc = cardBuildingCounts.get(card.id) ?? { house: 0, shop: 0 }
                  return (
                    <div key={card.id} className="mz-card-item">
                      <div className="mz-card-top">
                        <div className="mz-card-info">
                          <span className="mz-card-name">{displayName}</span>
                          <span className={`mz-card-leader${leader === t(language, 'zone.unassigned') ? ' unassigned' : ''}`}>
                            {t(language, 'zone.leader')}: {leader} · 주택 {bc.house} · 상가 {bc.shop}
                          </span>
                        </div>
                        <button className="mz-card-map-btn" onClick={() => onOpenMap(card.id)} type="button">
                          <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.7">
                            <path d="m4 6 4-1.5 4 1.5 4-1.5v10l-4 1.5-4-1.5-4 1.5Z"/>
                            <path d="M8 4.5v10M12 6v10"/>
                          </svg>
                                        {t(language, 'zone.map')}
                        </button>
                      </div>
                      <div className="mz-card-progress">
                        <div className="mz-card-bar"><b style={{ width: `${card.progress}%` }} /></div>
                        <span className="mz-card-pct">{card.progress}%</span>
                      </div>
                    </div>
                  )
                })}
                {cardList.length === 0 && <div className="mobile-zone-empty">{t(language, 'zone.noCards')}</div>}
              </div>
            </>
          )}
        </>
      )}

      </>}
    </div>
  )
}

// 시즌 inline chip — 헤더 subtitle 인라인용 (디자인 v2 screens-g.jsx SeasonInlineChip)
function SeasonInlineChip({
  specialPeriods,
  onClick,
}: {
  specialPeriods: SpecialPeriod[]
  onClick?: () => void
}) {
  const todayStr = new Date().toISOString().slice(0, 10)
  const active = specialPeriods.find((p) => todayStr >= p.startDate && todayStr <= p.endDate)
  if (!active) return null
  const end = new Date(active.endDate)
  const today = new Date(todayStr)
  const diff = Math.ceil((end.getTime() - today.getTime()) / 86_400_000)
  const dLabel = diff > 0 ? `D-${diff}` : diff === 0 ? 'D-day' : `D+${Math.abs(diff)}`
  return (
    <span
      onClick={onClick}
      className="season-inline-chip"
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 5,
        background: 'var(--status-warn-bg)',
        color: 'var(--status-warn)',
        fontSize: 11,
        fontWeight: 700,
        padding: '2px 8px',
        borderRadius: 99,
        marginLeft: 6,
        verticalAlign: 'middle',
        position: 'relative',
        top: -1,
        cursor: onClick ? 'pointer' : 'default',
      }}
    >
      <span style={{ width: 5, height: 5, borderRadius: 99, background: 'var(--status-warn)' }} />
      {active.label} <span style={{ fontVariantNumeric: 'tabular-nums' }}>{dLabel}</span>
    </span>
  )
}

export function MobileHome({
  leaderNames = [],
  buildings,
  calendarEvents,
  cardBoundaries,
  cards,
  currentVisitor,
  currentUser,
  language,
  actualRole,
  viewMode,
  notices,
  serviceSessions,
  onChangeViewMode,
  onChangeLanguage,
  onSetCardLeaders,
  onAddUnit,
  allUsers = [],
  onChangePin,
  onUpdateMyProfile,
  onApplyToEvent,
  onAddParticipantToEvent: _onAddParticipantToEvent,
  onToggleUser: _onToggleUser,
  onEndServiceSession,
  onAssignCardToEventParticipant: _onAssignCardToEventParticipant,
  onAssignCardsToEventParticipantsBulk,
  onCreateBuilding,
  onDeleteBuilding,
  onUpdateBuilding,
  onDeleteUnit,
  onCreateCalendarEvent,
  onCreateRepeatCalendarEvents,
  onDeleteCalendarEvent,
  onDeleteCalendarEventSeries,
  onUpdateCalendarEvent,
  onUpdateCalendarEventSeries,
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
  onToggleInvitationLeft,
  onLogout,
  visitHistories,
  specialPeriods,
  onCreateSpecialPeriod,
  onDeleteSpecialPeriod,
  // v2 신 배정 모델
  informalAssets = [],
  eventInformalAssignments = [],
  eventRestaurantAssignments = [],
  informalGroups = [],
  onUploadInformalAsset,
  onDeleteInformalAsset,
  onCreateInformalGroup,
  onRenameInformalGroup,
  onDeleteInformalGroup,
  onMoveAssetToGroup,
  onAssignInformalToUser,
  onRemoveInformalAssignment,
  onAssignRestaurantToUser,
  onRemoveRestaurantAssignment,
  onToggleBuildingRestaurant,
}: {
  leaderNames?: string[]
  buildings: Building[]
  calendarEvents: CalendarEvent[]
  cardBoundaries: CardBoundary[]
  cards: TerritoryCard[]
  currentVisitor: string
  currentUser: AuthUser
  language: AppLanguage
  actualRole: Role
  viewMode: Role
  notices: Notice[]
  serviceSessions: ServiceSession[]
  onChangeViewMode: (role: Role) => void
  onChangeLanguage: (language: AppLanguage) => void
  onSetCardLeaders: (cardId: number, leaderNames: string[], options?: { silentSuccess?: boolean }) => Promise<void> | void
  onAddUnit: (buildingId: number, unitNumber: string) => void
  allUsers?: Array<{ id: number; name: string; phone?: string | null; role: string; approvalStatus?: 'pending' | 'approved' | 'blocked' }>
  onChangePin: (newPin: string) => Promise<boolean>
  onUpdateMyProfile: (input: { name: string; phone?: string | null }) => Promise<boolean>
  onApplyToEvent: (eventId: number) => void
  onAddParticipantToEvent?: (eventId: number, userName: string) => void
  onToggleUser: (cardId: number, userName: string) => void
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
  onCreateCalendarEvent: (input: { date: string; time: string; title: string; place: string; mapLink?: string; leader: string; memo: string; hasMeeting: boolean; allowApplications: boolean }) => void
  onCreateRepeatCalendarEvents?: (dates: string[], input: { time: string; endTime?: string; title: string; place: string; mapLink?: string; leader: string; memo: string; hasMeeting: boolean; allowApplications: boolean }) => void
  onDeleteCalendarEvent: (id: number) => void
  onDeleteCalendarEventSeries?: (seriesId: string, fromDate: string) => void
  onUpdateCalendarEvent: (id: number, input: { time: string; title: string; place: string; mapLink?: string; leader: string; memo: string; hasMeeting: boolean; allowApplications: boolean }) => void
  onUpdateCalendarEventSeries?: (seriesId: string, fromDate: string, input: { time: string; endTime?: string; title: string; place: string; mapLink?: string; leader: string; memo: string; hasMeeting: boolean; allowApplications: boolean }) => void
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
  onToggleInvitationLeft?: (buildingId: number, unitId: number) => void
  onLogout: () => void
  visitHistories: VisitHistory[]
  specialPeriods?: SpecialPeriod[]
  onCreateSpecialPeriod?: (input: { label: string; startDate: string; endDate: string; color: string }) => Promise<void> | void
  onDeleteSpecialPeriod?: (id: number) => Promise<void> | void
  // v2 신 배정 모델
  informalAssets?: InformalAsset[]
  eventInformalAssignments?: EventInformalAssignment[]
  eventRestaurantAssignments?: EventRestaurantAssignment[]
  informalGroups?: InformalGroup[]
  onUploadInformalAsset?: (input: { file: File; name: string; uploadedBy: string; groupId?: number | null }) => Promise<{ ok: boolean; assetId?: number; error?: string }>
  onDeleteInformalAsset?: (assetId: number) => Promise<void>
  onCreateInformalGroup?: (input: { name: string; createdBy: string }) => Promise<number | null>
  onRenameInformalGroup?: (groupId: number, name: string) => Promise<void>
  onDeleteInformalGroup?: (groupId: number) => Promise<void>
  onMoveAssetToGroup?: (assetId: number, groupId: number | null) => Promise<void>
  onAssignInformalToUser?: (input: { eventId: number; userName: string; assetId: number; assignedBy: string }) => Promise<boolean>
  onRemoveInformalAssignment?: (assignmentId: number) => Promise<void>
  onAssignRestaurantToUser?: (input: { eventId: number; userName: string; buildingId: number; assignedBy: string }) => Promise<boolean>
  onRemoveRestaurantAssignment?: (assignmentId: number) => Promise<void>
  onToggleBuildingRestaurant?: (buildingId: number, isRestaurant: boolean) => Promise<void>
}) {
  const navigate = useNavigate()
  const location = useLocation()
  const [searchParams] = useSearchParams()
  const role = actualRole === 'admin' ? viewMode : actualRole

  const headerChatUsers = useMemo(
    () => allUsers.map((user) => ({ id: user.id, name: user.name, role: user.role as Role })),
    [allUsers],
  )
  // 디자인 v2: 홈에서 "오늘 봉사한 카드" 섹션 제거됨 (활동 탭으로 이동)
  // 토글 상태는 디버그/스위치용으로 보존 — 활동 탭에서 재사용 가능
  const [todayCardsCollapsed, setTodayCardsCollapsed] = useState(() =>
    window.localStorage.getItem('mobileTodaySessionsCollapsed') === 'true'
  )
  void todayCardsCollapsed; void setTodayCardsCollapsed

  const rawActiveTab = pathToTab[location.pathname] || '홈'
  // 인도자는 '지도' 탭이 없으므로 /map 접근 시 '구역' 탭 활성화
  const activeTab: MobileTab =
    rawActiveTab === '지도' && role === 'leader' ? '구역' : rawActiveTab

  // KST(로컬) 기준 오늘. toISOString 은 UTC 라 새벽 시간대에 하루 어긋남 → local 날짜 사용
  const today = useMemo(() => {
    const d = new Date()
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
  }, [])
  const todayLabel = useMemo(() => formatHomeDate(new Date(), language), [language])
  const leaderCards = useMemo(() => cards.filter((c) => c.assignedLeader === currentVisitor), [cards, currentVisitor])
  const inProgressCards = useMemo(() => cards.filter((c) => c.status === '진행중'), [cards])
  const totalUnits = useMemo(() => cards.reduce((sum, card) => sum + card.units, 0), [cards])
  const completedUnits = useMemo(() => cards.reduce((sum, card) => sum + card.completed, 0), [cards])
  const latestNotices = useMemo(() =>
    notices.slice().sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, 2),
    [notices])
  const todayEvents = useMemo(() =>
    calendarEvents.filter((e) => e.date === today).sort((a, b) => a.time.localeCompare(b.time)),
    [calendarEvents, today])
  // 디자인 v2: 활동 탭으로 이동. 홈에서는 사용 안 함.
  const myTodaySessions = useMemo(() =>
    serviceSessions.filter((session) => session.serviceDate === today && session.userName === currentVisitor),
    [currentVisitor, serviceSessions, today])
  void myTodaySessions

  // 오늘 봉사 — 모든 오늘 일정 표시.
  // 본인이 인도자면 kind='lead' (ink border + "인도" pill),
  // 신청/배정자면 kind='join', 아무 관여 없으면 kind='avail' (신청 가능).
  const myTodayEvents = useMemo(() => {
    return todayEvents.map((event) => {
      const isLeader = event.leader === currentVisitor
      const isApplicant = event.applicants.includes(currentVisitor)
      const isAssigned = event.cardAssignments.some((a) => a.userName === currentVisitor)
        || (event.assigned ?? []).includes(currentVisitor)
      const kind: 'lead' | 'join' | 'avail' = isLeader
        ? 'lead'
        : (isApplicant || isAssigned) ? 'join' : 'avail'
      return { event, kind }
    })
  }, [todayEvents, currentVisitor])

  const myRegularVisits = useMemo(
    () => getUserReturnVisits(returnVisits, currentVisitor),
    [currentVisitor, returnVisits],
  )
  const latestReturnVisitDate = useMemo(
    () => getLatestReturnVisitDate(myRegularVisits, returnVisitLogs),
    [myRegularVisits, returnVisitLogs],
  )
  // 디자인 v2: 홈 정기방문 섹션에서 latestReturnVisitLabel 직접 노출 안 함 (카드 내부 last 로 흡수)
  const latestReturnVisitLabel = formatRelativeVisitDate(latestReturnVisitDate, language)
  void latestReturnVisitLabel

  // 정기방문 미리보기 — 마지막 방문이 가장 오래된 순으로 정렬 (다가옴)
  // 한 번도 안 간 항목 우선, 그다음 오래된 순.
  const regularVisitPreviews = useMemo(() => {
    const list = myRegularVisits
      .map((rv) => {
        // rv.lastVisitedAt + 해당 rv 의 가장 최근 log.visitedAt 중 더 최신
        const logsForRv = returnVisitLogs
          .filter((log) => log.returnVisitId === rv.id)
          .map((log) => log.visitedAt)
          .filter((value): value is string => !!value)
        const candidates = [rv.lastVisitedAt, ...logsForRv].filter((value): value is string => !!value)
        candidates.sort((a, b) => new Date(b).getTime() - new Date(a).getTime())
        return { rv, lastVisit: candidates[0] ?? null }
      })
      .sort((a, b) => {
        // 한 번도 안 간 항목 (lastVisit null) 을 가장 앞으로
        if (!a.lastVisit && b.lastVisit) return -1
        if (a.lastVisit && !b.lastVisit) return 1
        if (!a.lastVisit && !b.lastVisit) return 0
        return new Date(a.lastVisit!).getTime() - new Date(b.lastVisit!).getTime()
      })
    return list.slice(0, 3)
  }, [myRegularVisits, returnVisitLogs])
  const focusedMapCardId = searchParams.get('cardId') ? Number(searchParams.get('cardId')) : null
  const focusedMapCardIds = useMemo(() => {
    const raw = searchParams.get('cardIds')
    if (!raw) return []
    return raw
      .split(',')
      .map((value) => Number(value))
      .filter((value) => Number.isFinite(value))
  }, [searchParams])
  const focusedMapScopeLabel = searchParams.get('scope') === 'mine' ? t(language, 'zone.myTerritories') : undefined
  const mapBackTarget = searchParams.get('return') === 'assignment'
    ? '/assignment'
    : role === 'user'
      ? '/territory'
      : '/zone'
  const userVisibleMapCardIds = useMemo(() => {
    const ids = new Set<number>()
    cards.forEach((card) => {
      if (card.assignedUsers.includes(currentVisitor)) ids.add(card.id)
    })
    const cutoff = Date.now() - 7 * 24 * 60 * 60 * 1000
    serviceSessions.forEach((session) => {
      if (session.userName !== currentVisitor) return
      const sessionTime = new Date(session.serviceDate || session.startedAt).getTime()
      if (Number.isFinite(sessionTime) && sessionTime < cutoff) return
      if (session.primaryCardId) ids.add(session.primaryCardId)
      if (session.assignedCardId) ids.add(session.assignedCardId)
    })
    // 일정별 카드 배정 (event_card_assignments) — 최근 14일 + 미래
    const eventCutoff = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000)
      .toISOString().slice(0, 10)
    calendarEvents.forEach((event) => {
      if (event.date < eventCutoff) return
      event.cardAssignments.forEach((assignment) => {
        if (assignment.userName !== currentVisitor) return
        const list = assignment.assignedCardIds && assignment.assignedCardIds.length > 0
          ? assignment.assignedCardIds
          : [assignment.assignedCardId]
        list.forEach((cardId) => {
          if (cardId) ids.add(cardId)
        })
      })
    })
    return ids
  }, [cards, currentVisitor, serviceSessions, calendarEvents])
  const isUserMapScope = role === 'user'
  const mapCards = useMemo(
    () => isUserMapScope ? cards.filter((card) => userVisibleMapCardIds.has(card.id)) : cards,
    [cards, isUserMapScope, userVisibleMapCardIds],
  )
  const mapBuildings = useMemo(
    () => isUserMapScope ? buildings.filter((building) => userVisibleMapCardIds.has(building.cardId)) : buildings,
    [buildings, isUserMapScope, userVisibleMapCardIds],
  )
  const mapCardBoundaries = useMemo(
    () => isUserMapScope ? cardBoundaries.filter((boundary) => userVisibleMapCardIds.has(boundary.cardId)) : cardBoundaries,
    [cardBoundaries, isUserMapScope, userVisibleMapCardIds],
  )
  const safeFocusedMapCardId =
    isUserMapScope && focusedMapCardId && !userVisibleMapCardIds.has(focusedMapCardId)
      ? null
      : focusedMapCardId
  const safeFocusedMapCardIds = isUserMapScope
    ? focusedMapCardIds.filter((cardId) => userVisibleMapCardIds.has(cardId))
    : focusedMapCardIds
  const roleLabel = role === 'admin' ? t(language, 'role.admin') : role === 'leader' ? t(language, 'role.leader') : t(language, 'role.user')
  const pendingSignupCount = useMemo(
    () => allUsers.filter((item) => item.approvalStatus === 'pending').length,
    [allUsers],
  )
  const tabLabel = (tab: MobileTab) => {
    if (tab === '홈') return t(language, 'nav.home')
    if (tab === '캘린더') return t(language, 'nav.calendar')
    if (tab === '활동') return t(language, 'nav.myService')
    if (tab === '구역') return t(language, 'nav.zone')
    if (tab === '지도') return t(language, 'nav.map')
    if (tab === '배정') return t(language, 'nav.assignment')
    return t(language, 'nav.settings')
  }

  const _toggleTodayCardsCollapsed = () => {
    const next = !todayCardsCollapsed
    setTodayCardsCollapsed(next)
    window.localStorage.setItem('mobileTodaySessionsCollapsed', String(next))
  }
  void _toggleTodayCardsCollapsed

  const visibleTabs: MobileTab[] = role === 'user'
    ? ['홈', '캘린더', '활동', '설정']
    : role === 'leader'
      ? ['홈', '캘린더', '활동', '배정', '구역', '설정']
      : ['홈', '캘린더', '구역', '배정', '설정']  // admin

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
          {tabLabel(item)}
        </button>
      ))}
    </nav>
  )


  return (
    <Routes>
      <Route path="/map" element={
        <>
          <MobileMap
            language={language}
            buildings={mapBuildings}
            cardBoundaries={mapCardBoundaries}
            cards={mapCards}
            currentVisitor={currentVisitor}
            currentUserId={currentUser.id}
            actualRole={role}
            serviceSessions={serviceSessions}
            focusedCardId={safeFocusedMapCardId}
            focusedCardIds={safeFocusedMapCardIds}
            focusedScopeLabel={focusedMapScopeLabel}
            onBack={() => navigate(mapBackTarget)}
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
            onToggleInvitationLeft={onToggleInvitationLeft}
            visitHistories={visitHistories}
            specialPeriods={specialPeriods}
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
                <AppHeader
                  pageTitle={t(language, 'nav.home')}
                  subtitle={
                    <>
                      {todayLabel}
                      {role !== 'admin' && <SeasonInlineChip specialPeriods={specialPeriods ?? []} onClick={() => navigate('/settings')} />}
                    </>
                  }
                  userId={currentUser.id}
                  userName={currentVisitor}
                  role={role}
                  chatUsers={headerChatUsers}
                  onOpenMenu={() => navigate('/settings')}
                />

                {role === 'admin' && specialPeriods && (
                  <div style={{ padding: '0 16px', marginBottom: '12px' }}>
                    <SpecialPeriodBanner specialPeriods={specialPeriods} variant="compact" onClick={() => navigate('/settings')} />
                  </div>
                )}

                {role === 'admin' ? (
                  <AdminMobileHome
                    notices={notices}
                    todayEvents={todayEvents}
                    cards={cards}
                    totalUnits={totalUnits}
                    completedUnits={completedUnits}
                    inProgressCount={inProgressCards.length}
                    unassignedCount={cards.filter((c) => c.status === '미배정').length}
                    onOpenNotices={() => navigate('/notices')}
                    onOpenCalendar={() => navigate('/calendar')}
                    onOpenZone={() => navigate('/zone')}
                  />
                ) : (<div className="mh-page">

                {/* ─── 공지 (최상단) ─── */}
                {latestNotices.length > 0 && (
                  <section className="mobile-home-section">
                    <div className="mh-sec-head">
                      <h2>
                        공지
                        <span className="mh-cnt">{notices.length}</span>
                      </h2>
                      <button className="mh-all" onClick={() => navigate('/notices')} type="button">
                        전체보기
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" aria-hidden><polyline points="9 6 15 12 9 18"/></svg>
                      </button>
                    </div>
                    <div className="mh-notice-list">
                      {latestNotices.map((notice) => (
                        <button
                          key={notice.id}
                          type="button"
                          className="mh-notice-row"
                          onClick={() => navigate('/notices')}
                        >
                          <span className="mh-notice-pill">공지</span>
                          <span className="mh-notice-title">{notice.title}</span>
                          <span className="mh-notice-date">{notice.createdAt.slice(5, 10).replace('-', '/')}</span>
                        </button>
                      ))}
                    </div>
                  </section>
                )}

                {/* ─── 오늘 봉사 — 디자인 24/25 ─── */}
                <section className="mobile-home-section">
                  <div className="mh-sec-head">
                    <h2>
                      오늘 봉사
                      {myTodayEvents.length > 0 && <span className="mh-cnt">{myTodayEvents.length}</span>}
                    </h2>
                    <button className="mh-all" onClick={() => navigate('/calendar')} type="button">
                      전체보기
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" aria-hidden><polyline points="9 6 15 12 9 18"/></svg>
                    </button>
                  </div>
                  {myTodayEvents.length === 0 ? (
                    <button
                      type="button"
                      className="mh-empty-line"
                      onClick={() => navigate('/calendar')}
                    >
                      <span>오늘 예정된 봉사가 없습니다.</span>
                      <span className="mh-empty-link">
                        가까운 일정 보기
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" aria-hidden><polyline points="9 6 15 12 9 18"/></svg>
                      </span>
                    </button>
                  ) : (
                    <div className="mh-today-list">
                      {myTodayEvents.map(({ event, kind }) => {
                        const hour = Number(event.time.split(':')[0] ?? 0)
                        const period = hour < 12 ? '오전' : hour < 17 ? '오후' : '저녁'
                        const sub = kind === 'lead'
                          ? `신청 ${event.applicants.length}명 · 카드 ${event.cardAssignments.length}개`
                          : kind === 'join'
                            ? (event.leader
                              ? `인도자 ${event.leader}${event.applicants.length > 0 ? ` · 신청 ${event.applicants.length}명` : ''}`
                              : '')
                            : (event.leader
                              ? `인도자 ${event.leader} · 신청 ${event.applicants.length}명${event.allowApplications ? ' · 신청 가능' : ''}`
                              : `신청 ${event.applicants.length}명${event.allowApplications ? ' · 신청 가능' : ''}`)
                        return (
                          <button
                            key={event.id}
                            type="button"
                            className={`mh-today-serving${kind === 'lead' ? ' is-lead' : ''}${kind === 'avail' ? ' is-avail' : ''}`}
                            onClick={() => navigate(`/calendar?openEvent=${event.id}`)}
                          >
                            <span className="mh-today-time">
                              <span className="mh-today-time-hour">{event.time.split(':')[0]}</span>
                              <span className="mh-today-time-period">{period}</span>
                            </span>
                            <span className="mh-today-body">
                              <span className="mh-today-title-row">
                                <span className="mh-today-title">{event.title}</span>
                                {kind === 'lead' && <span className="mh-today-pill-lead">인도</span>}
                              </span>
                              {event.place && (
                                <span className="mh-today-where">
                                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M12 21s6-5.2 6-11a6 6 0 0 0-12 0c0 5.8 6 11 6 11Z"/><circle cx="12" cy="10" r="2"/></svg>
                                  {event.place}
                                </span>
                              )}
                              {sub && <span className="mh-today-sub">{sub}</span>}
                            </span>
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden><polyline points="9 6 15 12 9 18"/></svg>
                          </button>
                        )
                      })}
                    </div>
                  )}
                </section>

                {/* ─── 정기 방문 — 메인 모듈 ─── */}
                <section className="mobile-home-section">
                  <div className="mh-sec-head">
                    <h2>
                      정기 방문
                      {myRegularVisits.length > 0 && <span className="mh-cnt">{myRegularVisits.length}</span>}
                    </h2>
                    <button className="mh-all" onClick={() => navigate('/territory?section=regular')} type="button">
                      전체보기
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" aria-hidden><polyline points="9 6 15 12 9 18"/></svg>
                    </button>
                  </div>
                  {myRegularVisits.length === 0 ? (
                    <button
                      type="button"
                      className="mh-empty-line"
                      onClick={() => navigate('/territory?section=regular')}
                    >
                      <span>아직 정기 방문이 없습니다.</span>
                      <span className="mh-empty-link">
                        시작하기
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" aria-hidden><polyline points="9 6 15 12 9 18"/></svg>
                      </span>
                    </button>
                  ) : (
                    <div className="mh-rv-list">
                      {regularVisitPreviews.map(({ rv, lastVisit }) => {
                        const label = rv.nickname || rv.displayName
                        const lastLabel = lastVisit ? formatRelativeVisitDate(lastVisit, language) : t(language, 'home.noVisitYet')
                        return (
                          <button
                            key={rv.id}
                            type="button"
                            className="mh-rv-card"
                            onClick={() => navigate(`/territory/regular/${rv.id}`)}
                          >
                            <span className="mh-rv-name">{label}</span>
                            <span className="mh-rv-addr">{rv.address || '주소 없음'}</span>
                            <span className="mh-rv-last">마지막 방문 · {lastLabel}</span>
                          </button>
                        )
                      })}
                    </div>
                  )}
                </section>

                {/* ─── 인도자 — 담당 카드 chip 행 ─── */}
                {role === 'leader' && leaderCards.length > 0 && (
                  <section className="mobile-home-section">
                    <div className="mh-sec-head">
                      <h2>
                        담당 카드
                        <span className="mh-cnt">{leaderCards.length}</span>
                      </h2>
                      <button className="mh-all" onClick={() => navigate('/zone?reset=true')} type="button">
                        전체보기
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" aria-hidden><polyline points="9 6 15 12 9 18"/></svg>
                      </button>
                    </div>
                    <div className="mh-leader-chips">
                      {(() => {
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
                            type="button"
                            className="mh-leader-chip"
                            onClick={() => navigate(`/zone?region=${encodeURIComponent(region)}&dong=${encodeURIComponent(area)}`)}
                          >
                            {region} {area} <span className="mh-leader-chip-cnt">{count}{t(language, 'calendar.countSuffix')}</span>
                          </button>
                        ))
                      })()}
                    </div>
                  </section>
                )}

                {/* 공지 섹션은 상단으로 이동됨 */}

                </div>)}
              </>
            } />

            {/* 공지 */}
            <Route path="/notices" element={
              <>
                <AppHeader
                  pageTitle={t(language, 'settings.notice')}
                  subtitle={`${notices.length}개 · 관리자 작성`}
                  showBack
                  onBack={() => navigate('/settings')}
                  userId={currentUser.id}
                  userName={currentVisitor}
                  role={role}
                  chatUsers={headerChatUsers}
                  onOpenMenu={() => navigate('/settings')}
                />
                <MobileNotices
                  currentVisitor={currentVisitor}
                  currentUserId={currentUser.id}
                  notices={notices}
                  role={role}
                  mentionUsers={allUsers.map((user) => ({ id: user.id, name: user.name, role: user.role }))}
                  onCreateNotice={onCreateNotice}
                  onDeleteNotice={onDeleteNotice}
                />
              </>
            } />

            {/* 내 정보 */}
            <Route path="/profile" element={
              <MobileProfileSettings
                user={currentUser}
                onChangePin={onChangePin}
                onUpdateProfile={onUpdateMyProfile}
              />
            } />

            {/* 캘린더 */}
            <Route path="/calendar" element={
              <>
                <AppHeader
                  pageTitle={t(language, 'nav.calendar')}
                  subtitle={(() => {
                    const now = new Date()
                    const ym = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
                    const count = calendarEvents.filter((e) => e.date.startsWith(ym)).length
                    return `${now.getFullYear()}년 ${now.getMonth() + 1}월 · 일정 ${count}개`
                  })()}
                  userId={currentUser.id}
                  userName={currentVisitor}
                  role={role}
                  chatUsers={headerChatUsers}
                  onOpenMenu={() => navigate('/settings')}
                />
                {/* 모든 역할이 AdminMobileCalendar 사용 — 권한별 콜백 가시성으로 차등 */}
                <AdminMobileCalendar
                  language={language}
                  currentVisitor={currentVisitor}
                  currentUserId={currentUser.id}
                  role={role}
                  events={calendarEvents}
                  leaderNames={leaderNames}
                  mentionUsers={allUsers.map((user) => ({ id: user.id, name: user.name, role: user.role }))}
                  /* 일정 생성/수정/삭제: admin + leader 만. user 는 신청만. */
                  onCreateEvent={role === 'user' ? undefined : onCreateCalendarEvent}
                  onCreateRepeatEvents={role === 'user' ? undefined : onCreateRepeatCalendarEvents}
                  onDeleteEvent={role === 'user' ? undefined : onDeleteCalendarEvent}
                  onDeleteEventSeries={role === 'user' ? undefined : onDeleteCalendarEventSeries}
                  onUpdateEvent={role === 'user' ? undefined : onUpdateCalendarEvent}
                  onUpdateEventSeries={role === 'user' ? undefined : onUpdateCalendarEventSeries}
                  onApplyToEvent={onApplyToEvent}
                />
                {/* (legacy MobileCalendar 유지 — 향후 제거 가능. 일정 상세 시트 시점별 액션은
                    AdminEventDetailSheet 가 role prop 받아 분기.) */}
              </>
            } />

            {/* 정기방문 상세 (풀스크린) — 디자인 핸드오프 대기 */}
            <Route path="/territory/regular/:id" element={
              role === 'admin' ? (
                <Navigate to="/zone" replace />
              ) : (
                <MobileRegularVisitDetail
                  language={language}
                  returnVisits={returnVisits}
                  returnVisitLogs={returnVisitLogs}
                  buildings={buildings}
                  currentVisitor={currentVisitor}
                  onAddReturnVisitLog={onAddReturnVisitLog}
                  onUpdateReturnVisitLog={onUpdateReturnVisitLog}
                  onDeleteReturnVisitLog={onDeleteReturnVisitLog}
                  onDeleteReturnVisit={onDeleteReturnVisit}
                  onUpdateReturnVisitNickname={onUpdateReturnVisitNickname}
                  onUpdateReturnVisitAddress={onUpdateReturnVisitAddress}
                />
              )
            } />

            {/* 나의봉사 (개인 봉사 현황) */}
            <Route path="/territory" element={
              role === 'admin' ? (
                <Navigate to="/zone" replace />
              ) : (
                <>
                <AppHeader
                  pageTitle={t(language, 'nav.myService')}
                  userId={currentUser.id}
                  userName={currentVisitor}
                  role={role}
                  chatUsers={headerChatUsers}
                  onOpenMenu={() => navigate('/settings')}
                />
                <MobileTerritory
                  language={language}
                  buildings={buildings}
                  cards={cards}
                  calendarEvents={calendarEvents}
                  currentVisitor={currentVisitor}
                  role={role}
                  serviceSessions={serviceSessions}
                  returnVisits={returnVisits}
                  returnVisitLogs={returnVisitLogs}
                  onOpenMap={(cardId) => navigate(`/map?cardId=${cardId}`)}
                  onEndServiceSession={onEndServiceSession}
                  onCreateManualReturnVisit={onCreateManualReturnVisit}
                  onAddReturnVisitLog={onAddReturnVisitLog}
                  onUpdateReturnVisitLog={onUpdateReturnVisitLog}
                  onDeleteReturnVisitLog={onDeleteReturnVisitLog}
                  onDeleteReturnVisit={onDeleteReturnVisit}
                  onUpdateReturnVisitNickname={onUpdateReturnVisitNickname}
                  onUpdateReturnVisitAddress={onUpdateReturnVisitAddress}
                  informalAssets={informalAssets}
                  eventInformalAssignments={eventInformalAssignments}
                  eventRestaurantAssignments={eventRestaurantAssignments}
                />
                </>
              )
            } />

            {/* 구역 (인도자·관리자용 — 목록↔지도 토글) */}
            <Route path="/zone" element={
              <>
              <AppHeader
                pageTitle={t(language, 'nav.zone')}
                subtitle={(() => {
                  const total = cards.length
                  const unassigned = cards.filter((c) => c.status === '미배정').length
                  return role === 'admin'
                    ? `구역 카드 ${total} · 미배정 ${unassigned}`
                    : undefined
                })()}
                userId={currentUser.id}
                userName={currentVisitor}
                role={role}
                chatUsers={headerChatUsers}
                onOpenMenu={() => navigate('/settings')}
              />
              {role === 'admin' ? (
                <AdminMobileZone
                  cards={cards}
                  buildings={buildings}
                  currentVisitor={currentVisitor}
                  role={role}
                  informalAssets={informalAssets}
                  informalGroups={informalGroups}
                  onOpenMap={(cardId) => navigate(`/map?cardId=${cardId}`)}
                  onOpenAssignedMap={(cardIds) => navigate(`/map?cardIds=${cardIds.join(',')}&scope=mine`)}
                  onShowMapView={() => navigate('/map')}
                  onUploadInformalAsset={onUploadInformalAsset}
                  onDeleteInformalAsset={onDeleteInformalAsset}
                  onCreateInformalGroup={onCreateInformalGroup}
                  onRenameInformalGroup={onRenameInformalGroup}
                  onDeleteInformalGroup={onDeleteInformalGroup}
                  onMoveAssetToGroup={onMoveAssetToGroup}
                  onToggleBuildingRestaurant={onToggleBuildingRestaurant}
                />
              ) : (
                <MobileZoneView
                  language={language}
                  cards={cards}
                  buildings={buildings}
                  currentVisitor={currentVisitor}
                  role={role}
                  onOpenMap={(cardId) => navigate(`/map?cardId=${cardId}`)}
                  onOpenAssignedMap={(cardIds) => navigate(`/map?cardIds=${cardIds.join(',')}&scope=mine`)}
                  onShowMapView={() => navigate('/map')}
                  informalAssets={informalAssets}
                  informalGroups={informalGroups}
                  onUploadInformalAsset={onUploadInformalAsset}
                  onDeleteInformalAsset={onDeleteInformalAsset}
                  onCreateInformalGroup={onCreateInformalGroup}
                  onRenameInformalGroup={onRenameInformalGroup}
                  onDeleteInformalGroup={onDeleteInformalGroup}
                  onMoveAssetToGroup={onMoveAssetToGroup}
                  onToggleBuildingRestaurant={onToggleBuildingRestaurant}
                />
              )}
              </>
            } />

            {/* 배정 */}
            <Route path="/assignment" element={
              <>
              <AppHeader
                pageTitle={t(language, 'nav.assignment')}
                subtitle={role === 'admin' ? (() => {
                  const leaderCount = leaderNames.length
                  const unassigned = cards.filter((c) => {
                    const ls = c.assignedLeaders?.length ? c.assignedLeaders : c.assignedLeader ? [c.assignedLeader] : []
                    return ls.length === 0
                  }).length
                  return `인도자 ${leaderCount}명 · 미배정 ${unassigned}개`
                })() : undefined}
                userId={currentUser.id}
                userName={currentVisitor}
                role={role}
                chatUsers={headerChatUsers}
                onOpenMenu={() => navigate('/settings')}
              />
              {role === 'admin' ? (
                <MobileAdminAssignment
                  cards={cards}
                  leaderNames={leaderNames}
                  currentVisitor={currentVisitor}
                  onSetCardLeaders={onSetCardLeaders}
                  onOpenMapView={(cardIds) => {
                    const query = cardIds && cardIds.length > 0
                      ? `?cardIds=${cardIds.join(',')}&return=assignment`
                      : '?return=assignment'
                    navigate(`/map${query}`)
                  }}
                />
              ) : (
                <MobileLeaderAssignment
                  cards={cards}
                  buildings={buildings}
                  calendarEvents={calendarEvents}
                  currentVisitor={currentVisitor}
                  role={role}
                  onAssignCardsToEventParticipantsBulk={onAssignCardsToEventParticipantsBulk}
                  informalAssets={informalAssets}
                  informalGroups={informalGroups}
                  eventInformalAssignments={eventInformalAssignments}
                  eventRestaurantAssignments={eventRestaurantAssignments}
                  onAssignInformalToUser={onAssignInformalToUser}
                  onRemoveInformalAssignment={onRemoveInformalAssignment}
                  onAssignRestaurantToUser={onAssignRestaurantToUser}
                  onRemoveRestaurantAssignment={onRemoveRestaurantAssignment}
                  onToggleBuildingRestaurant={onToggleBuildingRestaurant}
                />
              )}
              </>
            } />

            {/* 사용자 */}
            <Route path="/users" element={
              <>
              <AppHeader
                pageTitle="사용자"
                userId={currentUser.id}
                userName={currentVisitor}
                role={role}
                chatUsers={headerChatUsers}
                onOpenMenu={() => navigate('/settings')}
              />
              <MobileUsers />
              </>
            } />

            {/* 가입 신청 관리 */}
            <Route path="/signup-requests" element={
              role === 'admin' ? <MobileSignupRequests /> : <Navigate to="/settings" replace />
            } />

            {/* 특별 봉사 시즌 관리 */}
            <Route path="/special-periods" element={
              role === 'admin' ? (
                <div className="mobile-settings-page">
                  <AppHeader
                    pageTitle="특별 봉사 시즌 관리"
                    showBack
                    onBack={() => navigate('/settings')}
                    userId={currentUser.id}
                    userName={currentVisitor}
                    role={role}
                    chatUsers={headerChatUsers}
                    onOpenMenu={() => navigate('/settings')}
                  />
                  <SpecialPeriodSettings
                    isAdmin
                    specialPeriods={specialPeriods}
                    onCreateSpecialPeriod={onCreateSpecialPeriod}
                    onDeleteSpecialPeriod={onDeleteSpecialPeriod}
                  />
                </div>
              ) : (
                <Navigate to="/settings" replace />
              )
            } />

            {/* 알림 설정 */}
            <Route path="/notification-settings" element={
              <div className="mobile-settings-page">
                <AppHeader
                  pageTitle="알림 설정"
                  showBack
                  onBack={() => navigate('/settings')}
                  userId={currentUser.id}
                  userName={currentVisitor}
                  role={role}
                  chatUsers={headerChatUsers}
                  onOpenMenu={() => navigate('/settings')}
                />
                <div style={{ padding: '0 16px', marginBottom: 16 }}>
                  <NotificationSettings userId={currentUser.id} />
                </div>
              </div>
            } />

            {/* 설정 */}
            <Route path="/settings" element={
              <div className="mobile-settings-page">
                <AppHeader
                  pageTitle={t(language, 'settings.title')}
                  subtitle={`${currentVisitor} · ${roleLabel}`}
                  userId={currentUser.id}
                  userName={currentVisitor}
                  role={role}
                  chatUsers={headerChatUsers}
                  onOpenMenu={() => navigate('/settings')}
                />

                <button className="mobile-settings-profile" onClick={() => navigate('/profile')} type="button" aria-label="내 정보 관리">
                  <div className="mobile-settings-avatar" aria-hidden="true">
                    {currentVisitor.slice(0, 1)}
                  </div>
                  <div className="mobile-settings-profile-text">
                    <strong>{currentVisitor}</strong>
                    <span>{t(language, 'settings.currentRole')} · {roleLabel}</span>
                  </div>
                  <span className="mobile-settings-chevron" aria-hidden="true">›</span>
                </button>

                {actualRole === 'admin' && (
                  <section className="mobile-settings-switch" aria-label="화면 보기 전환">
                    <p>{t(language, 'settings.viewMode')}</p>
                    <div className="mobile-role-grid">
                      {(['admin', 'leader', 'user'] as Role[]).map((r) => (
                        <button
                          key={r}
                          onClick={() => onChangeViewMode(r)}
                          className={role === r ? 'active' : ''}
                          type="button"
                        >
                          {r === 'admin' ? t(language, 'role.admin') : r === 'leader' ? t(language, 'role.leader') : t(language, 'role.user')}
                        </button>
                      ))}
                    </div>
                  </section>
                )}

                <section className="mobile-settings-switch" aria-label="언어 설정">
                  <p>{t(language, 'settings.language')}</p>
                  <div className="mobile-language-grid">
                    {(['ko', 'zh', 'en'] as AppLanguage[]).map((item) => (
                      <button
                        key={item}
                        className={language === item ? 'active' : ''}
                        onClick={() => onChangeLanguage(item)}
                        type="button"
                      >
                        {languageLabels[item]}
                      </button>
                    ))}
                  </div>
                </section>

                <section className="mobile-settings-menu" aria-label="관리 메뉴">
                  <button onClick={() => navigate('/notices')} type="button">
                    <span className="mobile-settings-icon mobile-settings-icon-neutral" aria-hidden="true">
                      <SettingsIcon name="notice" />
                    </span>
                    <span className="mobile-settings-row-text">
                      <strong>{t(language, 'settings.notice')}</strong>
                      <small>{t(language, 'settings.noticeDesc')}</small>
                    </span>
                    <span className="mobile-settings-chevron" aria-hidden="true">›</span>
                  </button>
                  <button onClick={() => navigate('/notification-settings')} type="button">
                    <span className="mobile-settings-icon mobile-settings-icon-neutral" aria-hidden="true">
                      <SettingsIcon name="notification" />
                    </span>
                    <span className="mobile-settings-row-text">
                      <strong>알림 설정</strong>
                      <small>받을 알림과 방해금지 시간 관리</small>
                    </span>
                    <span className="mobile-settings-chevron" aria-hidden="true">›</span>
                  </button>
                  {role === 'admin' && (
                    <>
                      <button onClick={() => navigate('/users')} type="button">
                        <span className="mobile-settings-icon mobile-settings-icon-neutral" aria-hidden="true">
                          <SettingsIcon name="users" />
                        </span>
                        <span className="mobile-settings-row-text">
                          <strong>{t(language, 'settings.users')}</strong>
                          <small>{t(language, 'settings.usersDesc')}</small>
                        </span>
                        <span className="mobile-settings-chevron" aria-hidden="true">›</span>
                      </button>
                      <button onClick={() => navigate('/signup-requests')} type="button">
                        <span className="mobile-settings-icon mobile-settings-icon-neutral" aria-hidden="true">
                          <SettingsIcon name="signup" />
                        </span>
                        <span className="mobile-settings-row-text">
                          <strong>가입 신청</strong>
                          <small>승인 대기 중인 사용자 확인</small>
                        </span>
                        {pendingSignupCount > 0 && (
                          <span className="mobile-settings-badge" aria-label={`승인 대기 ${pendingSignupCount}명`}>
                            {pendingSignupCount}
                          </span>
                        )}
                        <span className="mobile-settings-chevron" aria-hidden="true">›</span>
                      </button>
                      <button onClick={() => navigate('/special-periods')} type="button">
                        <span className="mobile-settings-icon mobile-settings-icon-season" aria-hidden="true">
                          <SettingsIcon name="season" />
                        </span>
                        <span className="mobile-settings-row-text">
                          <strong>{t(language, 'settings.specialSeason')}</strong>
                          <small>{t(language, 'settings.specialSeasonDesc')}</small>
                        </span>
                        <span className="mobile-settings-chevron" aria-hidden="true">›</span>
                      </button>
                    </>
                  )}
                </section>

                <div style={{ padding: '0 16px', marginBottom: 16 }}>
                  <PwaInstallSection />
                </div>

                <div style={{ padding: '0 16px', marginBottom: 16 }}>
                  <AppUpdateCard variant="mobile" />
                </div>

                <button className="mobile-settings-logout" onClick={onLogout} type="button">
                  <span className="mobile-settings-icon mobile-settings-icon-danger" aria-hidden="true">
                    <SettingsIcon name="logout" />
                  </span>
                  <strong>{t(language, 'settings.logout')}</strong>
                </button>

                <p className="mobile-settings-version">{t(language, 'settings.version')}</p>
              </div>
            } />
          </Routes>

          {BottomNav}
        </main>
      } />
    </Routes>
  )
}
