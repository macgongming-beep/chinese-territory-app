import { useEffect, useMemo, useState } from 'react'
import { Routes, Route, Navigate, useNavigate, useLocation, useSearchParams } from 'react-router-dom'
import { MobileCalendar } from './MobileCalendar'
import { MobileAdminAssignment } from './MobileAdminAssignment'
import { MobileLeaderAssignment } from './MobileLeaderAssignment'
import { MobileMap } from './MobileMap'
import { MobileNotices } from './MobileNotices'
import { MobileTerritory } from './MobileTerritory'
import { MobileUsers } from './MobileUsers'
import { MobileSignupRequests } from './MobileSignupRequests'
import { MobileProfileSettings } from './MobileProfileSettings'
import type { Building, CalendarEvent, CardBoundary, EventInformalAssignment, EventRestaurantAssignment, EventTeam, InformalAsset, InformalGroup, Notice, ReturnVisit, ReturnVisitLog, Role, ServiceSession, SpecialPeriod, TerritoryCard, TimeSlot, Unit, UnitStatus, VisitHistory } from '../types'
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
  '/profile': '설정',
  '/special-periods': '설정',
  '/signup-requests': '설정',
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
                  {regionList.map(([region, count]) => (
                    <button key={region} className="mz-nav-row" onClick={() => goToRegion(region)} type="button">
                      <span className="mz-nav-name">{region}</span>
                      <span className="mz-nav-count">{count}{t(language, 'calendar.countSuffix')}</span>
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
                {dongList.map(([dong, count]) => (
                  <button key={dong} className="mz-nav-row" onClick={() => goToDong(dong)} type="button">
                    <span className="mz-nav-name">{dong}</span>
                    <span className="mz-nav-count">{count}{t(language, 'calendar.countSuffix')}</span>
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
                  return (
                    <div key={card.id} className="mz-card-item">
                      <div className="mz-card-top">
                        <div className="mz-card-info">
                          <span className="mz-card-name">{displayName}</span>
                          <span className={`mz-card-leader${leader === t(language, 'zone.unassigned') ? ' unassigned' : ''}`}>{t(language, 'zone.leader')}: {leader}</span>
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
  onAddParticipantToEvent,
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
  onToggleInvitationLeft,
  onLogout,
  visitHistories,
  specialPeriods,
  onCreateSpecialPeriod,
  onDeleteSpecialPeriod,
  // v2 신 배정 모델
  eventTeams = [],
  informalAssets = [],
  eventInformalAssignments = [],
  eventRestaurantAssignments = [],
  informalGroups = [],
  onCreateEventTeam,
  onUpdateEventTeam,
  onDeleteEventTeam,
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
  onCreateCalendarEvent: (input: { date: string; time: string; title: string; place: string; mapLink?: string; leader: string; memo: string; hasMeeting: boolean; allowApplications: boolean }) => void
  onDeleteCalendarEvent: (id: number) => void
  onUpdateCalendarEvent: (id: number, input: { time: string; title: string; place: string; mapLink?: string; leader: string; memo: string; hasMeeting: boolean; allowApplications: boolean }) => void
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
  eventTeams?: EventTeam[]
  informalAssets?: InformalAsset[]
  eventInformalAssignments?: EventInformalAssignment[]
  eventRestaurantAssignments?: EventRestaurantAssignment[]
  informalGroups?: InformalGroup[]
  onCreateEventTeam?: (input: { eventId: number; name?: string; color?: string; position?: number }) => Promise<number | null>
  onUpdateEventTeam?: (teamId: number, input: { name?: string; color?: string; position?: number }) => Promise<void>
  onDeleteEventTeam?: (teamId: number) => Promise<void>
  onUploadInformalAsset?: (input: { file: File; name: string; uploadedBy: string; groupId?: number | null }) => Promise<{ ok: boolean; assetId?: number; error?: string }>
  onDeleteInformalAsset?: (assetId: number) => Promise<void>
  onCreateInformalGroup?: (input: { name: string; createdBy: string }) => Promise<number | null>
  onRenameInformalGroup?: (groupId: number, name: string) => Promise<void>
  onDeleteInformalGroup?: (groupId: number) => Promise<void>
  onMoveAssetToGroup?: (assetId: number, groupId: number | null) => Promise<void>
  onAssignInformalToUser?: (input: { eventId: number; teamId: number | null; userName: string; assetId: number; assignedBy: string }) => Promise<boolean>
  onRemoveInformalAssignment?: (assignmentId: number) => Promise<void>
  onAssignRestaurantToUser?: (input: { eventId: number; teamId: number | null; userName: string; buildingId: number; assignedBy: string }) => Promise<boolean>
  onRemoveRestaurantAssignment?: (assignmentId: number) => Promise<void>
  onToggleBuildingRestaurant?: (buildingId: number, isRestaurant: boolean) => Promise<void>
}) {
  const navigate = useNavigate()
  const location = useLocation()
  const [searchParams] = useSearchParams()
  const role = actualRole === 'admin' ? viewMode : actualRole

  // 미사용 (향후 phase) — 의도적 unused
  void eventTeams
  void onCreateEventTeam
  void onUpdateEventTeam
  void onDeleteEventTeam
  const headerChatUsers = useMemo(
    () => allUsers.map((user) => ({ id: user.id, name: user.name, role: user.role as Role })),
    [allUsers],
  )
  const [todayCardsCollapsed, setTodayCardsCollapsed] = useState(() =>
    window.localStorage.getItem('mobileTodaySessionsCollapsed') === 'true'
  )

  const rawActiveTab = pathToTab[location.pathname] || '홈'
  // 인도자는 '지도' 탭이 없으므로 /map 접근 시 '구역' 탭 활성화
  const activeTab: MobileTab =
    rawActiveTab === '지도' && role === 'leader' ? '구역' : rawActiveTab

  const today = useMemo(() => new Date().toISOString().slice(0, 10), [])
  const todayLabel = useMemo(() => formatHomeDate(new Date(), language), [language])
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
  const focusedMapCardIds = useMemo(() => {
    const raw = searchParams.get('cardIds')
    if (!raw) return []
    return raw
      .split(',')
      .map((value) => Number(value))
      .filter((value) => Number.isFinite(value))
  }, [searchParams])
  const focusedMapScopeLabel = searchParams.get('scope') === 'mine' ? t(language, 'zone.myTerritories') : undefined
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
    if (tab === '나의봉사') return t(language, 'nav.myService')
    if (tab === '구역') return t(language, 'nav.zone')
    if (tab === '지도') return t(language, 'nav.map')
    if (tab === '배정') return t(language, 'nav.assignment')
    return t(language, 'nav.settings')
  }

  const toggleTodayCardsCollapsed = () => {
    const next = !todayCardsCollapsed
    setTodayCardsCollapsed(next)
    window.localStorage.setItem('mobileTodaySessionsCollapsed', String(next))
  }

  const visibleTabs: MobileTab[] = role === 'user'
    ? ['홈', '캘린더', '나의봉사', '설정']
    : role === 'leader'
      ? ['홈', '캘린더', '나의봉사', '배정', '구역', '설정']
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
            onBack={() => navigate(role === 'user' ? '/territory' : '/zone')}
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
                  subtitle={todayLabel}
                  userId={currentUser.id}
                  userName={currentVisitor}
                  role={role}
                  chatUsers={headerChatUsers}
                  onOpenMenu={() => navigate('/settings')}
                />

                {specialPeriods && (
                  <div style={{ padding: '0 16px', marginBottom: '12px' }}>
                    <SpecialPeriodBanner specialPeriods={specialPeriods} variant="compact" onClick={() => navigate('/settings')} />
                  </div>
                )}

                <section className="mobile-home-section">
                  <div className="mobile-section-title" style={{ marginBottom: '8px' }}>
                    <h2><span aria-hidden="true"><NavIcon name="notice" /></span> {t(language, 'home.notice')}</h2>
                    <button onClick={() => navigate('/notices')} type="button">{t(language, 'home.viewAll')}</button>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    {latestNotices.length === 0 ? (
                      <p style={{ fontSize: '13px', color: 'var(--ink-500)', margin: 0, padding: '12px', background: '#f9fafb', borderRadius: '8px', textAlign: 'center' }}>{t(language, 'home.noNotices')}</p>
                    ) : latestNotices.map((notice) => (
                      <button key={notice.id} onClick={() => navigate('/notices')} style={{
                        display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 12px',
                        background: '#f9fafb', borderRadius: '8px', border: 'none', textAlign: 'left', width: '100%'
                      }}>
                        <span style={{ fontSize: '11px', fontWeight: 600, color: 'var(--primary-600)', background: 'var(--primary-50)', padding: '2px 6px', borderRadius: '4px', flexShrink: 0 }}>{t(language, 'home.notice')}</span>
                        <span style={{ flex: 1, fontSize: '13px', color: 'var(--ink-900)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{notice.title}</span>
                        <span style={{ fontSize: '11px', color: 'var(--ink-400)', flexShrink: 0 }}>{notice.createdAt.slice(5, 10).replace('-', '/')}</span>
                      </button>
                    ))}
                  </div>
                </section>

                <section className="mobile-home-section">
                  <div className="mobile-section-title">
                    <h2><span aria-hidden="true"><NavIcon name="calendar" /></span> {t(language, 'home.todayService')}</h2>
                    <button onClick={() => navigate('/calendar')} type="button">{t(language, 'home.viewAll')}</button>
                  </div>
                  {todayEvents.length === 0 ? (
                    <article className="mobile-empty-card mobile-service-empty">
                      <span aria-hidden="true">□</span>
                      <p>{t(language, 'home.noTodayService')}</p>
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

                {role !== 'admin' && (
                  <section className="mobile-home-section">
                    <div className="mobile-section-title">
                      <h2><span aria-hidden="true"><NavIcon name="territory" /></span> {t(language, 'home.myServiceStatus')}</h2>
                      <button onClick={() => navigate('/territory')} type="button">{t(language, 'home.viewAll')}</button>
                    </div>
                    <div className="mobile-service-summary-grid">
                      <button onClick={() => navigate('/territory')} type="button">
                        <strong>{myVisibleCards.length}</strong>
                        <span>{t(language, 'home.myCards')}</span>
                      </button>
                      <button onClick={() => navigate('/territory?section=regular')} type="button">
                        <strong>{myRegularVisits.length}</strong>
                        <span>{t(language, 'home.myRegularVisits')}</span>
                      </button>
                    </div>
                  </section>
                )}

                {role !== 'admin' && myTodaySessions.length > 0 && (
                  <section className="mobile-home-section">
                    <div className="mobile-section-title">
                      <h2><span aria-hidden="true"><NavIcon name="map" /></span> {t(language, 'home.todayServedCards')}</h2>
                      <button onClick={toggleTodayCardsCollapsed} type="button">
                        {todayCardsCollapsed ? t(language, 'home.expand') : t(language, 'home.collapse')}
                      </button>
                    </div>
                    {todayCardsCollapsed ? (
                      <button className="mobile-collapsed-summary" onClick={toggleTodayCardsCollapsed} type="button">
                        {t(language, 'home.collapsedTodayCards')} {myTodaySessions.length}{t(language, 'calendar.countSuffix')} {t(language, 'home.collapsed')}
                        <span>{t(language, 'territory.open')}</span>
                      </button>
                    ) : (
                      <div className="mobile-home-list">
                        {myTodaySessions.map((session) => {
                          const card = cards.find((item) => item.id === session.primaryCardId)
                          return (
                            <button className="mobile-my-card" key={session.id} onClick={() => navigate(`/map?cardId=${session.primaryCardId ?? ''}`)} type="button">
                              <div>
                                <strong>{card?.name ?? t(language, 'territory.noCard')}</strong>
                                <small>{session.timeSlot} · {session.status === 'active' && !session.endedAt ? t(language, 'home.inProgress') : t(language, 'home.ended')}</small>
                              </div>
                              <span>{t(language, 'territory.open')}</span>
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
                      <h2><span aria-hidden="true"><NavIcon name="territory" /></span> {t(language, 'home.operationStatus')}</h2>
                      <button onClick={() => navigate('/zone')} type="button">{t(language, 'home.viewAll')}</button>
                    </div>
                    <div className="mobile-home-stats">
                      <div><strong>{cards.length}</strong><span>{t(language, 'home.totalCards')}</span></div>
                      <div><strong>{inProgressCards.length}</strong><span>{t(language, 'zone.summaryProgress')}</span></div>
                      <div><strong>{completedCards.length}</strong><span>{t(language, 'home.completedCards')}</span></div>
                      <div><strong>{completedUnits}/{totalUnits}</strong><span>{t(language, 'home.completedUnits')}</span></div>
                    </div>
                  </section>
                )}

                {role === 'leader' && (
                  <section className="mobile-home-section">
                    <div className="mobile-section-title">
                      <h2><span aria-hidden="true"><NavIcon name="territory" /></span> {t(language, 'home.assignedCards')}</h2>
                      <button onClick={() => navigate('/zone?reset=true')} type="button">{t(language, 'home.viewAll')}</button>
                    </div>
                    {leaderCards.length === 0 ? (
                      <article className="mobile-empty-card">{t(language, 'zone.noAssignedCards')}</article>
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
                              {region} {area} {count}{t(language, 'calendar.countSuffix')}
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
              <>
                <AppHeader
                  pageTitle={t(language, 'settings.notice')}
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
                  userId={currentUser.id}
                  userName={currentVisitor}
                  role={role}
                  chatUsers={headerChatUsers}
                  onOpenMenu={() => navigate('/settings')}
                />
                <MobileCalendar
                  language={language}
                  currentVisitor={currentVisitor}
                  currentUserId={currentUser.id}
                  leaderNames={leaderNames}
                  leaderPhones={Object.fromEntries(allUsers.filter((u) => u.phone).map((u) => [u.name, u.phone]))}
                  events={calendarEvents}
                  role={role}
                  allUserNames={allUsers.map((u) => u.name)}
                  mentionUsers={allUsers.map((user) => ({ id: user.id, name: user.name, role: user.role }))}
                  onApplyToEvent={onApplyToEvent}
                  onAddParticipant={onAddParticipantToEvent}
                  onCreateEvent={onCreateCalendarEvent}
                  onDeleteEvent={onDeleteCalendarEvent}
                  onUpdateEvent={onUpdateCalendarEvent}
                />
              </>
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
                  onStartServiceSession={onStartServiceSession}
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
                userId={currentUser.id}
                userName={currentVisitor}
                role={role}
                chatUsers={headerChatUsers}
                onOpenMenu={() => navigate('/settings')}
              />
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
              </>
            } />

            {/* 배정 */}
            <Route path="/assignment" element={
              <>
              <AppHeader
                pageTitle={t(language, 'nav.assignment')}
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
                  onSetCardLeaders={onSetCardLeaders}
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
                  <span className="mobile-settings-help">{t(language, 'settings.languageHelp')}</span>
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
