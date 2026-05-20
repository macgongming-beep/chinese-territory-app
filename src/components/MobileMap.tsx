import { useState, useMemo, useRef, useEffect } from 'react'
import { useSearchParams } from 'react-router-dom'
import { MapCanvas } from './MapCanvas'
import type { MapAggregateMarker } from './MapCanvas'
import type { Building, BuildingStatus, CardBoundary, Role, ServiceSession, SpecialPeriod, TerritoryCard, TimeSlot, Unit, UnitStatus, VisitHistory } from '../types'
import type { AppLanguage } from '../i18n'
import { t } from '../i18n'
import { getBuildingStatus, findCardForCoordinates } from '../utils/mapUtils'
import { normalizeCardSearch, sortTerritoryCards } from '../utils/cardSearch'
import { showToast } from '../lib/toast'
import { UnitSlotGrid } from './UnitSlotGrid'
import { AppHeaderActionButtons } from './AppHeader'

type NavLevel = 'area' | 'region' | 'card' | 'map'
type StrategyFilter = '전체' | '중국인' | '부재' | '만남'
type BuildingTypeFilter = '전체' | Building['type']

function getLocalDateString() {
  const date = new Date()
  const month = `${date.getMonth() + 1}`.padStart(2, '0')
  const day = `${date.getDate()}`.padStart(2, '0')
  return `${date.getFullYear()}-${month}-${day}`
}

export function MobileMap({
  language,
  buildings,
  cardBoundaries,
  cards,
  currentVisitor,
  currentUserId,
  actualRole,
  serviceSessions,
  focusedCardId,
  focusedCardIds = [],
  onBack,
  onAddUnit,
  onCreateBuilding,
  onDeleteBuilding,
  onUpdateBuilding,
  onDeleteUnit,
  onToggleRegularVisit,
  onToggleChinese,
  onUndoLatestVisit,
  onUpdateVisitHistory,
  onDeleteVisitHistory,
  onQuickLogVisit,
  onUpdateUnitFlags,
  onToggleInvitationLeft,
  visitHistories,
  specialPeriods,
}: {
  language: AppLanguage
  buildings: Building[]
  cardBoundaries: CardBoundary[]
  cards: TerritoryCard[]
  currentVisitor: string
  currentUserId?: number | null
  actualRole: Role
  serviceSessions: ServiceSession[]
  focusedCardId?: number | null
  focusedCardIds?: number[]
  focusedScopeLabel?: string
  onBack: () => void
  onAddUnit: (buildingId: number, unitNumber: string) => void
  onCreateBuilding: (input: { cardId: number; name: string; address: string; type: Building['type']; lat: number; lng: number }) => void
  onDeleteBuilding: (buildingId: number) => void
  onUpdateBuilding: (buildingId: number, name: string, address: string, lat?: number, lng?: number) => void
  onDeleteUnit: (buildingId: number, unitId: number) => void
  onToggleRegularVisit: (buildingId: number, unitId: number, visitorName?: string) => void
  onToggleChinese: (buildingId: number, unitId: number) => void
  onUndoLatestVisit: (buildingId: number, unitId: number) => void
  onUpdateVisitHistory: (historyId: number, unitId: number, input: { result: UnitStatus; timeSlot: TimeSlot; memo: string; visitedAt: string; invitationLeft?: boolean }) => void
  onDeleteVisitHistory: (historyId: number, unitId: number) => void
  onQuickLogVisit: (buildingId: number, unitId: number, result: UnitStatus) => void
  onUpdateUnitFlags: (unitId: number, flags: Partial<Unit>) => void
  onToggleInvitationLeft?: (buildingId: number, unitId: number) => void
  visitHistories: VisitHistory[]
  specialPeriods?: SpecialPeriod[]
}) {
  // URL 파라미터 (가상 핀용)
  const [searchParams] = useSearchParams()
  const addrParam = searchParams.get('addr')
  const pinLabelParam = searchParams.get('pinLabel') ?? addrParam ?? ''
  const [virtualPinLat, setVirtualPinLat] = useState<number | null>(null)
  const [virtualPinLng, setVirtualPinLng] = useState<number | null>(null)
  const [virtualGeocoding, setVirtualGeocoding] = useState(false)

  // addr 파라미터 있으면 geocoding
  useEffect(() => {
    if (!addrParam) return
    const tryGeocode = () => {
      const naver = (window as any).naver
      if (!naver?.maps?.Service) { setTimeout(tryGeocode, 500); return }
      setVirtualGeocoding(true)
      naver.maps.Service.geocode({ query: addrParam }, (status: any, response: any) => {
        setVirtualGeocoding(false)
        if (status === naver.maps.Service.Status.ERROR) { showToast(t(language, 'map.addressNotFound')); return }
        const result = response?.v2?.addresses?.[0]
        if (result) {
          setVirtualPinLat(parseFloat(result.y))
          setVirtualPinLng(parseFloat(result.x))
        } else {
          showToast(t(language, 'map.addressNotFound'))
        }
      })
    }
    tryGeocode()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [addrParam, language])

  // 내비게이션 상태 머신
  // (구) area → region → card → map 4단계 drill
  // (신) 항상 'map' 으로 시작 + 지역 칩 필터 (drill 폐기)
  //      과거 drill 함수들은 코드 호환 위해 남겨둠 (도달 안 됨)
  const [navLevel, setNavLevel] = useState<NavLevel>('map')
  const initialMapRegion = searchParams.get('region')
  const initialMapDong = searchParams.get('dong')
  const [selectedArea, setSelectedArea] = useState<string | null>(initialMapRegion || null)
  const [selectedRegion, setSelectedRegion] = useState<string | null>(initialMapDong || null)
  const [selectedCardId, setSelectedCardId] = useState<number | null>(
    focusedCardId ?? null
  )
  const [showCardFinder, setShowCardFinder] = useState(false)
  const [cardSearch, setCardSearch] = useState('')

  // 필터
  const [strategyFilter] = useState<StrategyFilter>('전체')
  const [statusFilter] = useState<BuildingStatus | '전체'>('전체')
  const [buildingTypeFilter, setBuildingTypeFilter] = useState<BuildingTypeFilter>('전체')

  // 지도/패널 상태
  const [selectedBuildingId, setSelectedBuildingId] = useState<number | null>(null)
  const [expandedBuildingIds, setExpandedBuildingIds] = useState<Set<number>>(new Set())
  const [collapsedStatusGroups, setCollapsedStatusGroups] = useState<Set<BuildingStatus>>(new Set(['방문완료']))
  const [hiddenMapStatuses, setHiddenMapStatuses] = useState<Set<BuildingStatus>>(new Set())
  const [expandedUnitId, setExpandedUnitId] = useState<number | null>(null)
  const [editingHistoryId, setEditingHistoryId] = useState<number | null>(null)
  const [historyToEdit, setHistoryToEdit] = useState<VisitHistory | null>(null)

  // 특정 날짜에 활성화된 특별봉사 시즌 (없으면 null)
  const getActivePeriodForDate = (dateStr: string): SpecialPeriod | null => {
    if (!specialPeriods) return null
    return specialPeriods.find((p) => dateStr >= p.startDate && dateStr <= p.endDate) ?? null
  }
  const [unitMemos, setUnitMemos] = useState<Record<number, string>>({})
  const [_absentTimestamps, _setAbsentTimestamps] = useState<Record<number, number>>({})
  const [newUnitNumber, setNewUnitNumber] = useState('101호')
  const [addingUnitToBuildingId, setAddingUnitToBuildingId] = useState<number | null>(null)

  // 건물 수정
  const [editingBuildingId, setEditingBuildingId] = useState<number | null>(null)
  const [buildingMenuId, setBuildingMenuId] = useState<number | null>(null)
  const [editName, setEditName] = useState('')
  const [editAddress, setEditAddress] = useState('')
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)

  // 건물 추가 모달
  const backdropTouched = useRef(false)
  const addingGuard = useRef(false)
  const [showAddModal, setShowAddModal] = useState(false)
  const [addLat, setAddLat] = useState<number | null>(null)
  const [addLng, setAddLng] = useState<number | null>(null)
  const [addName, setAddName] = useState('')
  const [addAddress, setAddAddress] = useState('')
  const [addType, setAddType] = useState<Building['type']>('주택')
  const [addCardId, setAddCardId] = useState(cards[0]?.id ?? 1)
  const [geocoding, setGeocoding] = useState(false)
  const [addingBuildingMode, setAddingBuildingMode] = useState(false)
  const [showMapActionMenu, setShowMapActionMenu] = useState(false)
  const [editingPinMode, setEditingPinMode] = useState(false)
  const [drawingBoundaryMode, setDrawingBoundaryMode] = useState(false)
  const today = getLocalDateString()
  const activePeriod = getActivePeriodForDate(today)
  const activeServiceSession = serviceSessions.find((session) =>
    session.userName === currentVisitor &&
    session.serviceDate === today &&
    session.status === 'active' &&
    !session.endedAt
  )
  const todayRecordableSession = serviceSessions.find((session) =>
    session.userName === currentVisitor &&
    session.serviceDate === today &&
    (session.status === 'active' || session.status === 'ended')
  )
  const activeSessionCard = activeServiceSession?.primaryCardId
    ? cards.find((card) => card.id === activeServiceSession.primaryCardId)
    : undefined
  const isUserMap = actualRole === 'user'
  // territory 화면의 [지도] 버튼으로 진입 → focusedCardId 가 있음
  // 이 카드는 이미 userVisibleMapCardIds 로 본인 배정 카드만 통과했으므로
  // 봉사 시작 없이도 즉시 기록 가능
  const isUserDirectAssignment = isUserMap && (focusedCardId != null || focusedCardIds.length > 0)
  const canRecordVisits =
    actualRole !== 'user' || !!todayRecordableSession || isUserDirectAssignment
  const isViewingActiveCard = !!activeSessionCard && selectedCardId === activeSessionCard.id
  const filteredCardOptions = useMemo(() => {
    const query = normalizeCardSearch(cardSearch)
    if (!query) return []
    return sortTerritoryCards(cards.filter((card) =>
      normalizeCardSearch(`${card.name}${card.region}${card.area}`).includes(query)
    ))
  }, [cardSearch, cards])

  const requireRecordAccess = () => {
    if (canRecordVisits) return true
    showToast(t(language, 'map.viewOnlyDesc'), 'info')
    return false
  }
 
  // 바텀 시트 드래그 및 토글 상태
  const MIN_HEIGHT = 65
  const HALF_HEIGHT = window.innerHeight * 0.46
  const FULL_HEIGHT = window.innerHeight * 0.92
 
  // cardIds 로 진입한 경우(드릴 컨텍스트 지도) 는 바텀 시트 최소화로 시작 — 경계선 전체 보기
  const enteredWithFocusedCardIds = focusedCardIds.length > 0
  const [sheetHeight, setSheetHeight] = useState(enteredWithFocusedCardIds ? MIN_HEIGHT : HALF_HEIGHT)
  const [isDragging, setIsDragging] = useState(false)
  const dragStartY = useRef<number>(0)
  const dragStartHeight = useRef<number>(0)
  const dragMoved = useRef(false)
  const lastSheetTapAt = useRef(0)

  useEffect(() => {
    document.body.classList.add('mobile-map-scroll-lock')
    return () => {
      document.body.classList.remove('mobile-map-scroll-lock')
    }
  }, [])
 
  const startSheetDrag = (clientY: number) => {
    setIsDragging(true)
    dragMoved.current = false
    dragStartY.current = clientY
    dragStartHeight.current = sheetHeight
  }

  const moveSheetDrag = (clientY: number) => {
    if (!isDragging) return
    const deltaY = dragStartY.current - clientY
    if (Math.abs(deltaY) > 6) dragMoved.current = true
    const newHeight = Math.max(MIN_HEIGHT, Math.min(FULL_HEIGHT, dragStartHeight.current + deltaY))
    setSheetHeight(newHeight)
  }

  const handlePointerStart = (e: React.PointerEvent<HTMLDivElement>) => {
    e.preventDefault()
    e.currentTarget.setPointerCapture(e.pointerId)
    startSheetDrag(e.clientY)
  }

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isDragging) return
    e.preventDefault()
    moveSheetDrag(e.clientY)
  }

  const handlePointerEnd = (e: React.PointerEvent<HTMLDivElement>) => {
    e.preventDefault()
    if (e.currentTarget.hasPointerCapture(e.pointerId)) {
      e.currentTarget.releasePointerCapture(e.pointerId)
    }
    setIsDragging(false)
  }

  const toggleSheetSnap = () => {
    setSheetHeight((height) => (height > MIN_HEIGHT + 30 ? MIN_HEIGHT : HALF_HEIGHT))
  }

  const handleSheetHandleClick = () => {
    if (dragMoved.current) return
    const now = Date.now()
    if (now - lastSheetTapAt.current < 320) {
      toggleSheetSnap()
      lastSheetTapAt.current = 0
      return
    }
    lastSheetTapAt.current = now
  }

  // 카드(구역) 선택 변경 시 바텀 시트 자동 최소화
  useEffect(() => {
    setSheetHeight(MIN_HEIGHT)
  }, [selectedCardId])

  useEffect(() => {
    if (!isUserMap || focusedCardId != null || !activeServiceSession?.primaryCardId) return
    setNavLevel('map')
    setSelectedCardId(activeServiceSession.primaryCardId)
  }, [activeServiceSession?.primaryCardId, focusedCardId, isUserMap])

  // focusedCardId/배정 화면에서 직접 진입했는지 여부 (뒤로가기 시 외부 네비게이션으로 돌아가기 위함)
  const enteredFromAssignment = searchParams.get('return') === 'assignment'
  const enteredDirectly = focusedCardId != null || focusedCardIds.length > 0 || enteredFromAssignment

  // 뒤로가기 로직
  function handleBack() {
    // area/region/card 드릴 단계는 디자인 v2 이후 /zone 으로 통합돼 사용 안 함.
    // 안전을 위해 단계별 복귀 로직은 유지하되 최상위에서는 이전 페이지로.
    if (navLevel === 'area') { onBack(); return }
    if (navLevel === 'region') { setNavLevel('area'); setSelectedArea(null); return }
    if (navLevel === 'card') { setNavLevel('region'); setSelectedRegion(null); return }
    // 지도 레벨: 항상 이전 페이지로 (지역 선택 페이지로 떨어지지 않도록)
    if (navLevel === 'map') { onBack(); return }
    if (navLevel === 'map' && enteredDirectly) { onBack(); return }
    if (navLevel === 'map' && isUserMap) { onBack(); return }
    if (navLevel === 'map') {
      setSelectedCardId(null)
      if (selectedRegion) { setNavLevel('card'); return }
      if (selectedArea) { setNavLevel('region'); return }
      setNavLevel('area')
      return
    }
  }

  // B안: 데이터에서 region=대권역(구), area=동
  // Level 1: 대권역 선택 (region 필드 사용)
  const areas = useMemo(() =>
    [...new Set(cards.map(c => c.region))].sort(),
    [cards]
  )
  const areaCardCount = (region: string) => cards.filter(c => c.region === region).length

  // Level 2: 동 선택 (area 필드 사용)
  const regions = useMemo(() =>
    [...new Set(cards.filter(c => c.region === selectedArea).map(c => c.area))].sort(),
    [cards, selectedArea]
  )
  const regionCardCount = (area: string) =>
    cards.filter(c => c.region === selectedArea && c.area === area).length

  // Level 3: 카드 선택
  const regionCards = useMemo(() =>
    cards.filter(c => c.region === selectedArea && c.area === selectedRegion),
    [cards, selectedArea, selectedRegion]
  )

  const focusedCardIdSet = useMemo(
    () => new Set(focusedCardIds.filter((id) => Number.isFinite(id))),
    [focusedCardIds],
  )

  const scopedCards = useMemo(() =>
    cards.filter((card) => {
      if (focusedCardIdSet.size > 0 && selectedCardId == null && !focusedCardIdSet.has(card.id)) return false
      if (selectedArea && card.region !== selectedArea) return false
      if (selectedRegion && card.area !== selectedRegion) return false
      return true
    }),
    [cards, focusedCardIdSet, selectedArea, selectedCardId, selectedRegion]
  )

  const scopedCardIds = useMemo(
    () => new Set(scopedCards.map((card) => card.id)),
    [scopedCards]
  )
  const emptyHighlightedCardIds = useMemo(() => new Set<number>(), [])

  const cardMap = useMemo(() => new Map(cards.map(c => [c.id, c])), [cards])
  const visitHistoriesByUnitId = useMemo(() => {
    const map = new Map<number, VisitHistory[]>()
    visitHistories.forEach((history) => {
      const list = map.get(history.unitId)
      if (list) list.push(history)
      else map.set(history.unitId, [history])
    })
    return map
  }, [visitHistories])
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

  const unitMatchesStrategyFilter = (unit: Building['units'][number]) => {
    if (strategyFilter === '전체') return true
    if (strategyFilter === '중국인') return unit.isChinese
    if (strategyFilter === '부재') return unit.status === '부재'
    if (strategyFilter === '만남') return unit.status === '만남'
    return true
  }

  const baseFilteredBuildings = useMemo(() =>
    buildings.filter((b) => {
      if (selectedCardId != null && b.cardId !== selectedCardId) return false
      if (selectedCardId == null && focusedCardIdSet.size > 0 && !focusedCardIdSet.has(b.cardId)) return false
      if (selectedCardId == null && (selectedArea || selectedRegion) && !scopedCardIds.has(b.cardId)) return false
      if (statusFilter !== '전체' && getBuildingStatus(b) !== statusFilter) return false
      if (b.units.length > 0 && !b.units.some(unitMatchesStrategyFilter)) return false
      return true
    }),
    [buildings, selectedCardId, focusedCardIdSet, selectedArea, selectedRegion, scopedCardIds, statusFilter, strategyFilter]
  )

  const typeCounts = useMemo(() => ({
    전체: baseFilteredBuildings.length,
    주택: baseFilteredBuildings.filter((building) => building.type === '주택').length,
    상가: baseFilteredBuildings.filter((building) => building.type === '상가').length,
  }), [baseFilteredBuildings])

  const filteredBuildings = useMemo(() =>
    buildingTypeFilter === '전체'
      ? baseFilteredBuildings
      : baseFilteredBuildings.filter((building) => building.type === buildingTypeFilter),
    [baseFilteredBuildings, buildingTypeFilter]
  )

  const statusCounts = useMemo(() =>
    filteredBuildings.reduce<Record<BuildingStatus, number>>(
      (acc, b) => { const s = getBuildingStatus(b); acc[s] += 1; return acc },
      { 방문필요: 0, 방문완료: 0, 방문금지: 0, 정기방문: 0 }
    ), [filteredBuildings])

  const mapBuildings = useMemo(
    () => filteredBuildings.filter((building) => !hiddenMapStatuses.has(getBuildingStatus(building))),
    [filteredBuildings, hiddenMapStatuses],
  )

  const shouldUseAggregateMap =
    !isUserMap &&
    navLevel === 'map' &&
    selectedCardId == null &&
    !selectedRegion &&
    (focusedCardIdSet.size === 0 || !!selectedArea) &&
    !addingBuildingMode &&
    !editingPinMode &&
    !drawingBoundaryMode

  const mapAggregateMarkers = useMemo<MapAggregateMarker[]>(() => {
    if (!shouldUseAggregateMap) return []
    const groups = new Map<string, MapAggregateMarker & { latSum: number; lngSum: number; pointCount: number }>()
    mapBuildings.forEach((building) => {
      const card = cardMap.get(building.cardId)
      if (!card) return
      const label = selectedArea ? card.area : String(card.region)
      if (!label) return
      const id = `${selectedArea ? 'area' : 'region'}:${label}`
      const current = groups.get(id) ?? {
        id,
        label,
        count: 0,
        unitCount: 0,
        houseCount: 0,
        shopCount: 0,
        lat: 0,
        lng: 0,
        latSum: 0,
        lngSum: 0,
        pointCount: 0,
      }
      current.count += 1
      current.unitCount += building.units.length
      if (building.type === '주택') current.houseCount += 1
      if (building.type === '상가') current.shopCount += 1
      if (Number.isFinite(building.lat) && Number.isFinite(building.lng)) {
        current.latSum += building.lat
        current.lngSum += building.lng
        current.pointCount += 1
      }
      groups.set(id, current)
    })
    return Array.from(groups.values())
      .filter((group) => group.pointCount > 0)
      .map((group) => ({
        id: group.id,
        label: group.label,
        count: group.count,
        unitCount: group.unitCount,
        houseCount: group.houseCount,
        shopCount: group.shopCount,
        lat: group.latSum / group.pointCount,
        lng: group.lngSum / group.pointCount,
      }))
      .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label, 'ko'))
  }, [cardMap, mapBuildings, selectedArea, shouldUseAggregateMap])

  const aggregateScopeLabel = selectedArea ? '동' : '구'

  const handleSelectAggregateMarker = (id: string) => {
    const [kind, label] = id.split(':')
    setSelectedBuildingId(null)
    setExpandedBuildingIds(new Set())
    setExpandedUnitId(null)
    setSheetHeight(HALF_HEIGHT)
    if (kind === 'region') {
      setSelectedArea(label)
      setSelectedRegion(null)
      setSelectedCardId(null)
      setNavLevel('map')
      return
    }
    if (kind === 'area') {
      setSelectedRegion(label)
      setSelectedCardId(null)
      setNavLevel('map')
    }
  }

  const buildingGroups = useMemo(() => {
    if (shouldUseAggregateMap) return []
    const order: BuildingStatus[] = ['방문금지', '방문필요', '정기방문', '방문완료']
    const grouped = new Map<BuildingStatus, Building[]>()
    order.forEach((status) => grouped.set(status, []))
    filteredBuildings.forEach((building) => {
      grouped.get(getBuildingStatus(building))?.push(building)
    })
    return order.map((status) => ({
      status,
      buildings: grouped.get(status) ?? [],
    }))
  }, [filteredBuildings, shouldUseAggregateMap])

  const unitTotal = useMemo(() => filteredBuildings.reduce((t, b) => t + b.units.length, 0), [filteredBuildings])
  const visitedTotal = useMemo(() => filteredBuildings.reduce((t, b) => t + b.units.filter(u => u.status !== '미방문').length, 0), [filteredBuildings])
  const completionRate = unitTotal === 0 ? 0 : Math.round((visitedTotal / unitTotal) * 100)

  useEffect(() => {
    if (selectedBuildingId == null) return
    if (filteredBuildings.some((building) => building.id === selectedBuildingId)) return
    setSelectedBuildingId(null)
    setExpandedBuildingIds(new Set())
    setExpandedUnitId(null)
  }, [filteredBuildings, selectedBuildingId])

  const toggleStatusGroup = (status: BuildingStatus) => {
    setCollapsedStatusGroups((prev) => {
      const next = new Set(prev)
      if (next.has(status)) next.delete(status)
      else next.add(status)
      return next
    })
  }

  const toggleStatusFromMap = (status: BuildingStatus) => {
    const nextHidden = !hiddenMapStatuses.has(status)
    setHiddenMapStatuses((prev) => {
      const next = new Set(prev)
      if (nextHidden) next.add(status)
      else next.delete(status)
      return next
    })
    setCollapsedStatusGroups((prev) => {
      const next = new Set(prev)
      if (nextHidden) next.add(status)
      else next.delete(status)
      return next
    })
  }

  const mapBoundaries = useMemo(() =>
    selectedCardId != null
      ? cardBoundaries.filter(cb => cb.cardId === selectedCardId)
      : focusedCardIdSet.size > 0 && !selectedArea && !selectedRegion
        ? cardBoundaries.filter(cb => focusedCardIdSet.has(cb.cardId))
      : (selectedArea || selectedRegion)
        ? cardBoundaries.filter(cb => scopedCardIds.has(cb.cardId))
        : cardBoundaries,
    [selectedCardId, focusedCardIdSet, selectedArea, selectedRegion, cardBoundaries, scopedCardIds])

  const drillBreadcrumb = navLevel === 'region'
    ? selectedArea
    : navLevel === 'card'
      ? [selectedArea, selectedRegion].filter(Boolean).join(' › ')
      : ''
  const drillTitle =
    navLevel === 'area' ? t(language, 'map.areaSelect')
      : navLevel === 'region' ? t(language, 'map.dongSelect')
        : navLevel === 'card' ? t(language, 'map.cardSelect')
          : ''
  const showScopeAllButton = !isUserMap && (navLevel === 'area' || navLevel === 'region' || navLevel === 'card')
  const mapSelectedCardId = selectedCardId ?? '전체'

  function openCurrentScopeMap() {
    if (navLevel === 'area') {
      setSelectedArea(null)
      setSelectedRegion(null)
    }
    setSelectedCardId(null)
    setNavLevel('map')
  }

  const closeAddModal = () => {
    setShowAddModal(false)
    setAddLat(null)
    setAddLng(null)
    backdropTouched.current = false
    addingGuard.current = false
  }

  // 건물 추가 로직 (아이콘 모드 또는 꾹 누르기 통합)
  const handleAddBuildingAt = (lat: number, lng: number) => {
    if (addingGuard.current) return
    addingGuard.current = true

    setExpandedBuildingIds(new Set())
    setAddLat(lat); setAddLng(lng); setAddName(t(language, 'map.addBuilding')); setAddAddress(''); setAddType('주택')
    const matched = findCardForCoordinates(lat, lng, cardBoundaries)
    setAddCardId(matched ?? selectedCardId ?? cards[0]?.id ?? 1)

    // 역지오코딩으로 주소/건물명만 자동 입력 (좌표는 탭 위치 그대로 유지)
    const naver = (window as any).naver
    if (naver?.maps?.Service) {
      setGeocoding(true)
      naver.maps.Service.reverseGeocode(
        { coords: new naver.maps.LatLng(lat, lng), orders: [naver.maps.Service.OrderType.ADDR, naver.maps.Service.OrderType.ROAD_ADDR].join(',') },
        (status: any, response: any) => {
          setGeocoding(false)
          if (status === naver.maps.Service.Status.OK) {
            const r = response.v2?.results?.find((x: any) => x.name === 'roadaddr') ?? response.v2?.results?.[0]
            if (r?.region) {
              const parts = [
                r.region.area1?.name, r.region.area2?.name, r.region.area3?.name,
                r.land?.name ?? null,
                r.land?.number1 ? r.land.number1 + (r.land?.number2 ? `-${r.land.number2}` : '') : null,
              ].filter(Boolean)
              if (parts.length) setAddAddress(parts.join(' '))

              const rawName = r.land?.addition0?.value || r.land?.addition1?.value
              const buildingName = rawName && !/^\d+$/.test(rawName) ? rawName : null
              if (buildingName) {
                setAddName(buildingName)
              } else {
                const landParts = [r.land?.name, r.land?.number1 ? r.land.number1 + (r.land?.number2 ? `-${r.land.number2}` : '') : null].filter(Boolean)
                if (landParts.length) setAddName(landParts.join(' '))
              }
            }
          }
        },
      )
    }

    backdropTouched.current = false
    setShowAddModal(true)
    setAddingBuildingMode(false)
  }

  const handleConfirmAdd = () => {
    if (!addName.trim() || addLat == null || addLng == null) return
    onCreateBuilding({ cardId: addCardId, name: addName.trim(), address: addAddress.trim(), type: addType, lat: addLat, lng: addLng })
    closeAddModal()
    showToast(t(language, 'map.buildingAdded'), 'success')
  }

  const openAddBuildingMode = () => {
    setShowMapActionMenu(false)
    setEditingPinMode(false)
    setAddingBuildingMode(true)
    setSheetHeight(MIN_HEIGHT)
    showToast(t(language, 'map.tapToAddBuilding'), 'info')
  }

  const toggleEditPinMode = () => {
    const next = !editingPinMode
    setShowMapActionMenu(false)
    setAddingBuildingMode(false)
    setEditingPinMode(next)
    setSheetHeight(MIN_HEIGHT)
    showToast(next ? t(language, 'map.pinEditStart') : t(language, 'map.pinEditEnd'), 'info')
  }

  const editingBuilding = editingBuildingId != null ? buildings.find(b => b.id === editingBuildingId) ?? null : null
  const visitResultLabel = (result: UnitStatus) => {
    if (result === '만남') return t(language, 'map.met')
    if (result === '부재') return t(language, 'map.absent')
    if (result === '한국인') return t(language, 'map.korean')
    if (result === '거절') return t(language, 'map.refused')
    return result
  }
  const timeSlotLabel = (slot: TimeSlot | string) => {
    if (slot === '오전') return t(language, 'map.morning')
    if (slot === '오후') return t(language, 'map.afternoon')
    if (slot === '저녁') return t(language, 'map.evening')
    return slot
  }
  const buildingTypeLabel = (type: Building['type']) => type === '상가' ? t(language, 'map.shop') : t(language, 'map.house')
  const hasAreaChips = !isUserMap && !enteredDirectly && areas.length > 1
  return (
    <main
      className={`mobile-map-shell${navLevel === 'map' ? ' mobile-map-shell--map' : ''}`}
      style={hasAreaChips && navLevel === 'map' ? { '--map-chips-push': '53px' } as React.CSSProperties : undefined}
    >
      {/* 통합 헤더 — map 레벨에서는 floating + blur (디자인 23) */}
      <header className={`mobile-map-header${navLevel === 'map' ? ' mobile-map-header--floating' : ''}`}>
        <button onClick={handleBack} type="button" className="mm-back-btn" aria-label="Back">‹</button>
        <div className="mobile-map-header-content">
          <div className="mobile-map-title-row">
            <div className="mobile-map-title-copy">
              {navLevel === 'map' ? (
                <>
                  <h1>구역 · 지도</h1>
                  <span className="mm-stats-sub" role="tablist">
                    <button
                      type="button"
                      role="tab"
                      aria-selected={buildingTypeFilter === '전체'}
                      className={`mm-stat-chip${buildingTypeFilter === '전체' ? ' is-active' : ''}`}
                      onClick={() => setBuildingTypeFilter('전체')}
                    >
                      <span>전체</span><b className="tnum">{typeCounts.전체}</b>
                    </button>
                    <button
                      type="button"
                      role="tab"
                      aria-selected={buildingTypeFilter === '주택'}
                      className={`mm-stat-chip${buildingTypeFilter === '주택' ? ' is-active' : ''}`}
                      onClick={() => setBuildingTypeFilter('주택')}
                    >
                      <span>주택</span><b className="tnum">{typeCounts.주택}</b>
                    </button>
                    <button
                      type="button"
                      role="tab"
                      aria-selected={buildingTypeFilter === '상가'}
                      className={`mm-stat-chip${buildingTypeFilter === '상가' ? ' is-active' : ''}`}
                      onClick={() => setBuildingTypeFilter('상가')}
                    >
                      <span>상가</span><b className="tnum">{typeCounts.상가}</b>
                    </button>
                  </span>
                </>
              ) : (
                <>
                  {drillBreadcrumb && <p>{drillBreadcrumb}</p>}
                  <h1>{drillTitle}</h1>
                </>
              )}
            </div>
            {navLevel === 'map' ? (
              <div className="mobile-map-header-actions">
                <button
                  type="button"
                  className="mobile-map-header-action"
                  onClick={() => setShowCardFinder((open) => !open)}
                  aria-label="카드 / 주소 검색"
                >
                  <svg viewBox="0 0 24 24" aria-hidden>
                    <circle cx="11" cy="11" r="7" />
                    <line x1="21" y1="21" x2="16.65" y2="16.65" />
                  </svg>
                </button>
                <button
                  type="button"
                  className="mobile-map-header-action"
                  onClick={() => setShowMapActionMenu((prev) => !prev)}
                  aria-label="더보기"
                >
                  <svg viewBox="0 0 24 24" fill="currentColor" stroke="none" aria-hidden>
                    <circle cx="12" cy="5" r="1.5" />
                    <circle cx="12" cy="12" r="1.5" />
                    <circle cx="12" cy="19" r="1.5" />
                  </svg>
                </button>
              </div>
            ) : (
              <>
                {showScopeAllButton && (
                  <button
                    className="mm-scope-all-btn"
                    onClick={openCurrentScopeMap}
                    type="button"
                  >
                    {t(language, 'map.allView')}
                  </button>
                )}
                <AppHeaderActionButtons
                  userId={currentUserId}
                  userName={currentVisitor}
                  role={actualRole}
                  className="mobile-map-header-actions"
                  buttonClassName="mobile-map-header-action"
                  showMenu={false}
                />
              </>
            )}
          </div>
          {navLevel === 'map' && isUserMap && !isUserDirectAssignment && (
            <div className="mobile-map-field-actions">
              {activeSessionCard && (
                <button
                  className={isViewingActiveCard ? 'active' : ''}
                  onClick={() => {
                    setSelectedCardId(activeSessionCard.id)
                    setShowCardFinder(false)
                    setCardSearch('')
                  }}
                  type="button"
                >
                  {t(language, 'map.myServiceCard')}
                </button>
              )}
              <button
                className={showCardFinder ? 'active' : ''}
                onClick={() => setShowCardFinder((open) => !open)}
                type="button"
              >
                {t(language, 'map.otherCard')}
              </button>
              <button
                className={!selectedCardId ? 'active' : ''}
                onClick={() => {
                  setSelectedCardId(null)
                  setShowCardFinder(false)
                  setCardSearch('')
                }}
                type="button"
              >
                {t(language, 'map.all')}
              </button>
            </div>
          )}
        </div>
      </header>

      {/* Level 1: 대권역 선택 */}
      {navLevel === 'area' && (
        <div className="mm-drill-list">
          {areas.map(area => (
            <button
              key={area}
              className="mm-drill-item"
              onClick={() => { setSelectedArea(area); setNavLevel('region') }}
              type="button"
            >
              <div className="mm-drill-item-body">
                <div className="mm-drill-item-title">{area}</div>
                <div className="mm-drill-item-sub">{t(language, 'zone.cardCount')} {areaCardCount(area)}{t(language, 'calendar.countSuffix')}</div>
              </div>
              <span className="mm-drill-chevron">›</span>
            </button>
          ))}
        </div>
      )}

      {/* Level 2: 동 선택 */}
      {navLevel === 'region' && (
        <div className="mm-drill-list">
          {regions.map(region => (
            <button
              key={region}
              className="mm-drill-item"
              onClick={() => { setSelectedRegion(region); setNavLevel('card') }}
              type="button"
            >
              <div className="mm-drill-item-body">
                <div className="mm-drill-item-title">{region}</div>
                <div className="mm-drill-item-sub">{t(language, 'zone.cardCount')} {regionCardCount(region)}{t(language, 'calendar.countSuffix')}</div>
              </div>
              <span className="mm-drill-chevron">›</span>
            </button>
          ))}
        </div>
      )}

      {/* Level 3: 카드 선택 */}
      {navLevel === 'card' && (
        <div className="mm-drill-list">
          {regionCards.map(card => {
            const counts = cardBuildingTypeCounts.get(card.id) ?? { total: card.buildings, house: 0, shop: 0 }
            return (
              <button
                key={card.id}
                className="mm-drill-item"
                onClick={() => { setSelectedCardId(card.id); setNavLevel('map') }}
                type="button"
              >
                <div className="mm-drill-item-body">
                  <div className="mm-drill-item-title">{card.name}</div>
                  <div className="mm-drill-item-sub">
                    전체 {counts.total} · 주택 {counts.house} · 상가 {counts.shop}
                  </div>
                </div>
                <span className="mm-drill-chevron">›</span>
              </button>
            )
          })}
        </div>
      )}

      {/* Level 4: 지도 화면 */}
      {navLevel === 'map' && (
        <>
          {/* 지역 칩 필터 (drill 폐기 후 신규) — admin/leader 만 */}
          {!isUserMap && !enteredDirectly && areas.length > 1 && (
            <div className="mobile-map-area-chips" role="tablist" aria-label="지역 필터">
              <button
                role="tab"
                aria-selected={selectedArea === null}
                className={selectedArea === null ? 'active' : ''}
                onClick={() => { setSelectedArea(null); setSelectedRegion(null); setSelectedCardId(null) }}
                type="button"
              >전체</button>
              {areas.map((area) => (
                <button
                  key={area}
                  role="tab"
                  aria-selected={selectedArea === area}
                  className={selectedArea === area ? 'active' : ''}
                  onClick={() => { setSelectedArea(area); setSelectedRegion(null); setSelectedCardId(null) }}
                  type="button"
                >{area} <em>{areaCardCount(area)}</em></button>
              ))}
            </div>
          )}

          {isUserMap && showCardFinder && (
            <div className="mobile-map-card-finder">
              <input
                autoFocus
                placeholder={t(language, 'map.searchPlaceholder')}
                value={cardSearch}
                onChange={(event) => setCardSearch(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' && filteredCardOptions[0]) {
                    event.preventDefault()
                    setSelectedCardId(filteredCardOptions[0].id)
                    setCardSearch(filteredCardOptions[0].name)
                    setShowCardFinder(false)
                  }
                }}
              />
              {cardSearch && (
                <div className="mobile-map-card-results">
                  {filteredCardOptions.length === 0 && <span>{t(language, 'map.noSearchResults')}</span>}
                  {filteredCardOptions.length > 0 && <span>{t(language, 'map.searchResults')} {filteredCardOptions.length}{t(language, 'calendar.countSuffix')}</span>}
                  {filteredCardOptions.map((card) => (
                    <button
                      key={card.id}
                      onClick={() => {
                        setSelectedCardId(card.id)
                        setCardSearch(card.name)
                        setShowCardFinder(false)
                      }}
                      type="button"
                    >
                      <strong>{card.name}</strong>
                      <small>{card.region} · {card.area}</small>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* 지도 */}
          <div className="mobile-map-container" style={{ position: 'relative' }}>
            {virtualGeocoding && (
              <div style={{ position: 'absolute', top: 12, left: '50%', transform: 'translateX(-50%)', zIndex: 50, background: 'rgba(0,0,0,0.65)', color: '#fff', fontSize: 12, fontWeight: 600, padding: '6px 14px', borderRadius: 20, pointerEvents: 'none' }}>
                {t(language, 'map.searchingAddress')}
              </div>
            )}
            <MapCanvas
              buildings={mapAggregateMarkers.length > 0 ? [] : mapBuildings}
              aggregateMarkers={mapAggregateMarkers}
              cardBoundaries={mapAggregateMarkers.length > 0 ? [] : mapBoundaries}
              cards={cards}
              selectedCardId={mapSelectedCardId}
              highlightedCardIds={mapAggregateMarkers.length > 0 ? emptyHighlightedCardIds : scopedCardIds}
              onSelectAggregate={handleSelectAggregateMarker}
              onSelectBuilding={(id) => {
                if (editingPinMode) return
                if (selectedBuildingId === id) {
                  // 이미 선택된 포인트를 다시 클릭하면 해제 및 시트 내리기
                  setSelectedBuildingId(null)
                  setExpandedBuildingIds(new Set())
                  setExpandedUnitId(null)
                  setSheetHeight(MIN_HEIGHT)
                } else {
                  // 새로운 포인트 클릭 시 선택 및 상세내역 펴기
                  setSelectedBuildingId(id)
                  setExpandedBuildingIds(new Set([id]))
                  setExpandedUnitId(null) // 다른 건물로 넘어갈 때도 호수 상세 내역 초기화
                  
                  // 포인트 클릭 시 바텀 시트 자동 대응 (최소 HALF 이상)
                  if (sheetHeight < HALF_HEIGHT) {
                    setSheetHeight(HALF_HEIGHT)
                  }
                  
                  // 해당 카드로 스크롤 (렌더링 후 실행을 위해 딜레이)
                  setTimeout(() => {
                    const el = document.getElementById(`building-card-${id}`)
                    if (el) {
                      el.scrollIntoView({ behavior: 'smooth', block: 'center' })
                    }
                  }, 150)
                }
              }}
              onSelectCardBoundary={(cardId) => setSelectedCardId(cardId)}
              selectedBuildingId={selectedBuildingId ?? 0}
              onMapClick={(lat, lng) => {
                if (addingBuildingMode) {
                  handleAddBuildingAt(lat, lng)
                } else if (editingPinMode) {
                  return
                } else {
                  // 배경 클릭 시 상세내역 닫기 및 시트 내리기
                  setSelectedBuildingId(null)
                  setExpandedBuildingIds(new Set())
                  setExpandedUnitId(null)
                  setSheetHeight(MIN_HEIGHT)
                }
              }}
              previewPinLat={addLat}
              previewPinLng={addLng}
              virtualPinLat={virtualPinLat}
              virtualPinLng={virtualPinLng}
              virtualPinLabel={pinLabelParam}
              onMovePreviewPin={(lat, lng) => {
                setAddLat(lat)
                setAddLng(lng)
              }}
              onMoveBuilding={(id, lat, lng) => {
                const b = buildings.find(item => item.id === id)
                if (b) {
                  onUpdateBuilding(id, b.name, b.address, lat, lng)
                  showToast(`${b.name || b.address} ${t(language, 'map.pinSaved')}`, 'success')
                }
              }}
              isMobile={true}
              bottomPadding={sheetHeight + 20}
              addingBuilding={addingBuildingMode}
              editingBuildingLocation={editingPinMode}
              onOpenActionMenu={() => setShowMapActionMenu(prev => !prev)}
              onToggleAddingBuilding={setAddingBuildingMode}
              drawingBoundary={drawingBoundaryMode}
              onToggleDrawingBoundary={setDrawingBoundaryMode}
            />
            <div className="mobile-map-legend-card" aria-label={t(language, 'map.status')}>
              {([
                { status: '방문필요', label: t(language, 'zone.summaryNeed') },
                { status: '방문완료', label: t(language, 'zone.summaryDone') },
                { status: '방문금지', label: t(language, 'map.forbidden') },
                { status: '정기방문', label: t(language, 'map.regularVisit') },
              ] as Array<{ status: BuildingStatus; label: string }>).map(({ status, label }) => {
                const collapsed = collapsedStatusGroups.has(status)
                const hidden = hiddenMapStatuses.has(status)
                return (
                  <button
                    className={`mobile-map-legend-toggle${collapsed ? ' collapsed' : ''}${hidden ? ' map-hidden' : ''}`}
                    key={status}
                    onClick={() => toggleStatusFromMap(status)}
                    type="button"
                  >
                    <i className={`map-dot status-${status}`} />
                    <span>{label}</span>
                    <strong className="tnum">{statusCounts[status]}</strong>
                  </button>
                )
              })}
            </div>
            {showMapActionMenu && (
              <div className="mobile-map-action-popover">
                <button onClick={openAddBuildingMode} type="button">{t(language, 'map.addBuilding')}</button>
                <button onClick={toggleEditPinMode} type="button">
                  {editingPinMode ? t(language, 'map.finishEditPin') : t(language, 'map.editPin')}
                </button>
              </div>
            )}
          </div>

          {(addingBuildingMode || editingPinMode) && (
            <div className={`mobile-map-mode-banner${editingPinMode ? ' edit-pin' : ''}`}>
              <strong>{editingPinMode ? t(language, 'map.editPin') : t(language, 'map.addBuilding')}</strong>
              <button
                onClick={() => {
                  setAddingBuildingMode(false)
                  setEditingPinMode(false)
                }}
                type="button"
              >
                {t(language, 'map.finish')}
              </button>
            </div>
          )}

          {/* 건물 아코디언 (바텀시트) */}
          <section
            className={`mobile-bottom-sheet${isDragging ? ' dragging' : ''}`}
            style={{
              height: `${sheetHeight}px`,
              transition: isDragging ? 'none' : 'height 0.3s cubic-bezier(0.2, 0.8, 0.2, 1)'
            }}
          >
            <div
              className="sheet-handle"
              onPointerDown={handlePointerStart}
              onPointerMove={handlePointerMove}
              onPointerUp={handlePointerEnd}
              onPointerCancel={handlePointerEnd}
              onClick={handleSheetHandleClick}
              style={{ cursor: 'grab' }}
            />
            <div
              className="mobile-sheet-summary"
              onPointerDown={handlePointerStart}
              onPointerMove={handlePointerMove}
              onPointerUp={handlePointerEnd}
              onPointerCancel={handlePointerEnd}
              onClick={handleSheetHandleClick}
            >
              <span>
                {mapAggregateMarkers.length > 0
                  ? `${aggregateScopeLabel} ${mapAggregateMarkers.length}${t(language, 'calendar.countSuffix')}`
                  : `${t(language, 'map.building')} ${filteredBuildings.length}${t(language, 'calendar.countSuffix')}`}
              </span>
              <em>{completionRate}% · {visitedTotal}/{unitTotal} {t(language, 'map.unit')}</em>
            </div>

            {!canRecordVisits && (
              <div className="record-lock-banner mobile">
                <strong>{t(language, 'map.viewOnly')}</strong>
                <span>{t(language, 'map.viewOnlyDesc')}</span>
              </div>
            )}

            <div className="mobile-sheet-scroll">
              {mapAggregateMarkers.length > 0 && (
                <div className="mobile-map-aggregate-list">
                  {mapAggregateMarkers.map((marker) => (
                    <button
                      className="mobile-map-aggregate-row"
                      key={marker.id}
                      onClick={() => handleSelectAggregateMarker(marker.id)}
                      type="button"
                    >
                      <div>
                        <strong>{marker.label}</strong>
                        <span>건물 {marker.count} · 주택 {marker.houseCount} · 상가 {marker.shopCount}</span>
                      </div>
                      <em>세대 {marker.unitCount}</em>
                    </button>
                  ))}
                </div>
              )}

              {mapAggregateMarkers.length === 0 && filteredBuildings.length === 0 && (
                <div style={{ padding: '24px', textAlign: 'center', color: '#94a3b8', fontSize: '14px' }}>
                  <p>{t(language, 'map.noBuildings')}</p>
                </div>
              )}

              {mapAggregateMarkers.length === 0 && buildingGroups.map(({ status, buildings: groupedBuildings }) => {
                if (groupedBuildings.length === 0) return null
                const isGroupCollapsed = collapsedStatusGroups.has(status)
                return (
                  <section className={`mobile-building-status-group mobile-status-${status}${isGroupCollapsed ? ' collapsed' : ''}`} key={status}>
                    <button
                      aria-label={`${status} ${isGroupCollapsed ? 'open' : 'close'}`}
                      className="mobile-building-status-head"
                      onClick={() => toggleStatusGroup(status)}
                      type="button"
                    />
                    {!isGroupCollapsed && groupedBuildings.map((building) => {
                const isExpanded = expandedBuildingIds.has(building.id)
                const handledUnits = building.units.filter(u => u.status !== '미방문').length
                const regularUnitCount = building.units.filter(u => u.isRegularVisit).length
                const completion = building.units.length === 0 ? 0 : Math.round((handledUnits / building.units.length) * 100)
                const isEditing = building.id === editingBuildingId
                const card = cardMap.get(building.cardId)

                return (
                  <article
                    className={`bld-row${isExpanded ? ' bld-expanded' : ''}`}
                    key={building.id}
                    id={`building-card-${building.id}`}
                    style={{ scrollMargin: '120px' }}
                  >
                    {!isEditing ? (
                      <div className="bld-row-head">
                        <button
                          className="bld-row-head-btn"
                          onClick={() => {
                            setSelectedBuildingId(building.id)
                            setExpandedBuildingIds(prev => {
                              const n = new Set(prev)
                              if (n.has(building.id)) n.delete(building.id)
                              else n.add(building.id)
                              return n
                            })
                          }}
                          type="button"
                        >
                          <span className="bld-chevron">{isExpanded ? '▾' : '▸'}</span>
                          <div className="bld-head-text">
                            <strong>{building.address}</strong>
                            {building.name && <span className="bld-sub-name">{building.name}</span>}
                            {card && selectedCardId === null && <span className="bld-sub-name" style={{ color: '#94a3b8' }}>{card.name}</span>}
                          </div>
                          <div className="bld-head-right">
                            <small>{handledUnits}/{building.units.length} · {completion}%</small>
                            {regularUnitCount > 0 && <b className="bld-regular-badge">정{regularUnitCount}</b>}
                          </div>
                        </button>
                        <div className="bld-menu-wrap">
                          <button
                            className="bld-edit-btn"
                            onClick={() => setBuildingMenuId((prev) => prev === building.id ? null : building.id)}
                            type="button"
                            aria-label="더보기"
                          >⋯</button>
                          {buildingMenuId === building.id && (
                            <>
                              <div
                                className="bld-menu-backdrop"
                                onClick={() => setBuildingMenuId(null)}
                              />
                              <div className="bld-menu-popover" role="menu">
                                <button
                                  type="button"
                                  onClick={() => {
                                    setBuildingMenuId(null)
                                    setEditingBuildingId(building.id)
                                    setEditName(building.name || '')
                                    setEditAddress(building.address)
                                    setShowDeleteConfirm(false)
                                  }}
                                >설정</button>
                                <button
                                  type="button"
                                  onClick={() => {
                                    setBuildingMenuId(null)
                                    const dname = encodeURIComponent(building.name || building.address)
                                    const sname = encodeURIComponent('내 위치')
                                    const openUrl = (url: string) => window.open(url, '_blank', 'noopener,noreferrer')
                                    const fallback = () => {
                                      const url = building.lat && building.lng
                                        ? `https://map.naver.com/p/directions/-/${building.lng},${building.lat},${dname},,PLACE_POI/-/walk`
                                        : `https://map.naver.com/p/search/${dname}`
                                      openUrl(url)
                                    }
                                    if (!navigator.geolocation || !building.lat || !building.lng) {
                                      fallback()
                                      return
                                    }
                                    navigator.geolocation.getCurrentPosition(
                                      (pos) => {
                                        const slat = pos.coords.latitude
                                        const slng = pos.coords.longitude
                                        openUrl(`https://map.naver.com/p/directions/${slng},${slat},${sname},,ADDRESS_POI/${building.lng},${building.lat},${dname},,PLACE_POI/-/walk`)
                                      },
                                      () => fallback(),
                                      { enableHighAccuracy: true, timeout: 8000, maximumAge: 30000 },
                                    )
                                  }}
                                >길찾기</button>
                              </div>
                            </>
                          )}
                        </div>
                      </div>
                    ) : (
                      <div className="building-edit-mode">
                        <div className="edit-input-group">
                          <input className="modern-edit-address" onChange={e => setEditAddress(e.target.value)} placeholder={t(language, 'map.address')} value={editAddress} />
                          <input className="modern-edit-name" onChange={e => setEditName(e.target.value)} placeholder={t(language, 'map.buildingNameOptional')} value={editName} />
                        </div>
                        <div className="edit-action-group">
                          <button className="edit-save-btn" onClick={() => { onUpdateBuilding(building.id, editName.trim(), editAddress.trim()); setEditingBuildingId(null) }}>{t(language, 'common.save')}</button>
                          <button className="edit-cancel-btn" onClick={() => setEditingBuildingId(null)}>{t(language, 'common.cancel')}</button>
                          <button className="edit-delete-btn" onClick={() => setShowDeleteConfirm(true)}>{t(language, 'common.delete')}</button>
                        </div>
                      </div>
                    )}

                    {isExpanded && !isEditing && (
                      <div className="bld-body">
                        <div className={`unit-col-header${activePeriod ? ' with-invitation' : ''}`}>
                          <span>{t(language, 'map.unitInfo')}</span>
                          {activePeriod && <span>{t(language, 'map.invitation')}</span>}
                          <span>{t(language, 'map.met')}</span>
                          <span>{t(language, 'map.absent')}</span>
                          <span>{t(language, 'map.korean')}</span>
                        </div>

                        {(strategyFilter === '전체'
                          ? building.units
                          : building.units.filter(unitMatchesStrategyFilter)
                        ).map((unit) => {
                          const unitHistories = visitHistoriesByUnitId.get(unit.id) ?? []
                          const latestHistory = unitHistories[0]
                          const isUnitExpanded = expandedUnitId === unit.id

                          return (
                            <div className={`unit-grid-row${isUnitExpanded ? ' ugr-expanded' : ''}${unit.isRegularVisit ? ' ugr-regular' : ''}`} key={unit.id}>
                              <div className={`unit-grid-main${activePeriod ? ' with-invitation' : ''}`}>
                                <button className="unit-name-btn" onClick={() => setExpandedUnitId(isUnitExpanded ? null : unit.id)} type="button">
                                  <span className="unit-chevron">{isUnitExpanded ? '▾' : '▸'}</span>
                                  <span className="unit-number-text">{unit.number}</span>
                                  {unit.isChinese && <span className="unit-chinese-badge">中</span>}
                                  {unit.isForbidden && <span className="unit-forbidden-badge">방문금지</span>}
                                  {unit.isRegularVisit && <span className="unit-regular-badge">{t(language, 'map.regularShort')}</span>}
                                  {latestHistory && (
                                    <span className="unit-recent-visit">
                                      [{latestHistory.visitedAt.slice(5).replace('-', '/')} {latestHistory.timeSlot}]
                                    </span>
                                  )}
                                </button>
                                {activePeriod && (
                                  <button
                                    className={`unit-check-btn unit-check-btn-invitation${latestHistory?.invitationLeft ? ' ucb-invitation' : ''}${!canRecordVisits ? ' locked' : ''}`}
                                    onClick={() => {
                                      if (!requireRecordAccess()) return
                                      onToggleInvitationLeft?.(building.id, unit.id)
                                    }}
                                    title={t(language, 'map.invitationLeft')}
                                    type="button"
                                  >{latestHistory?.invitationLeft ? '✓' : ''}</button>
                                )}
                                <button className={`unit-check-btn${unit.status === '만남' ? ' ucb-meet' : ''}${!canRecordVisits ? ' locked' : ''}`}
                                  onClick={() => {
                                    if (!requireRecordAccess()) return
                                    unit.status === '만남' ? onUndoLatestVisit(building.id, unit.id) : onQuickLogVisit(building.id, unit.id, '만남')
                                  }}
                                  type="button">{unit.status === '만남' ? '✓' : ''}</button>
                                <button
                                  className={`unit-check-btn${(unit.status === '부재' && latestHistory?.visitedAt === getLocalDateString()) ? ' ucb-absent' : ''}${!canRecordVisits ? ' locked' : ''}`}
                                  onClick={() => {
                                    if (!requireRecordAccess()) return
                                    ;(unit.status === '부재' && latestHistory?.visitedAt === getLocalDateString()) ? onUndoLatestVisit(building.id, unit.id) : onQuickLogVisit(building.id, unit.id, '부재')
                                  }}
                                  type="button">{(unit.status === '부재' && latestHistory?.visitedAt === getLocalDateString()) ? '✓' : ''}</button>
                                <button className={`unit-check-btn${unit.status === '한국인' ? ' ucb-korean' : ''}${!canRecordVisits ? ' locked' : ''}`}
                                  onClick={() => {
                                    if (!requireRecordAccess()) return
                                    unit.status === '한국인' ? onUndoLatestVisit(building.id, unit.id) : onQuickLogVisit(building.id, unit.id, '한국인')
                                  }}
                                  type="button">{unit.status === '한국인' ? '✓' : ''}</button>
                              </div>

                              {isUnitExpanded && (
                                <UnitDetail
                                  unit={unit}
                                  unitHistories={unitHistories}
                                  buildingId={building.id}
                                  canRecordVisits={canRecordVisits}
                                  language={language}
                                  editingHistoryId={editingHistoryId}
                                  setEditingHistoryId={setEditingHistoryId}
                                  setHistoryToEdit={setHistoryToEdit}
                                  unitMemos={unitMemos}
                                  setUnitMemos={setUnitMemos}
                                  requireRecordAccess={requireRecordAccess}
                                  onUpdateUnitFlags={onUpdateUnitFlags}
                                  onToggleRegularVisit={onToggleRegularVisit}
                                  onToggleChinese={onToggleChinese}
                                  onDeleteUnit={onDeleteUnit}
                                  onDeleteVisitHistory={onDeleteVisitHistory}
                                  onQuickLogVisit={onQuickLogVisit}
                                  onSetExpandedUnitId={(id) => setExpandedUnitId(id)}
                                />
                              )}
                            </div>
                          )
                        })}

                        {addingUnitToBuildingId === building.id ? (
                          <div style={{ padding: '8px 10px', borderTop: '1px dashed #cbd5e1', display: 'flex', gap: '6px' }}>
                            <input autoFocus placeholder={t(language, 'map.unitNumberPlaceholder')} value={newUnitNumber} onChange={e => setNewUnitNumber(e.target.value)}
                              onKeyDown={e => { if (e.key === 'Enter' && newUnitNumber.trim()) { onAddUnit(building.id, newUnitNumber.trim()); setNewUnitNumber('') } }}
                              style={{ flex: 1, padding: '6px 8px', border: '1px solid #e2e8f0', borderRadius: 'var(--r-sm)', fontSize: '13px' }} />
                            <button disabled={!newUnitNumber.trim()} onClick={() => { onAddUnit(building.id, newUnitNumber.trim()); setNewUnitNumber('') }}
                              style={{ padding: '6px 12px', background: 'var(--accent-700)', color: '#fff', border: 'none', borderRadius: 'var(--r-sm)', fontWeight: 700, cursor: 'pointer', fontSize: '13px' }}>{t(language, 'common.add')}</button>
                            <button onClick={() => setAddingUnitToBuildingId(null)} style={{ padding: '6px 8px', background: '#f1f5f9', border: 'none', borderRadius: 'var(--r-sm)', cursor: 'pointer', color: 'var(--ink-500)', fontSize: '13px' }}>✕</button>
                          </div>
                        ) : (
                          <button className="bld-add-unit-btn" onClick={() => setAddingUnitToBuildingId(building.id)} type="button">{t(language, 'map.addUnit')}</button>
                        )}
                      </div>
                    )}
                  </article>
                )
              })}
                  </section>
                )
              })}
            </div>
          </section>

          {/* 건물 추가 모달 */}
          {showAddModal && (
            <div 
              style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'grid', placeItems: 'end center', zIndex: 3000 }}
              onTouchStart={(e) => { if (e.target === e.currentTarget) backdropTouched.current = true }}
              onClick={(e) => {
                if (e.target === e.currentTarget && backdropTouched.current) {
                  closeAddModal()
                }
              }}
            >
              <div style={{ background: '#fff', borderRadius: '20px 20px 0 0', width: '100%', maxWidth: '480px', padding: '24px 20px 36px' }} onClick={e => e.stopPropagation()}>
                <h3 style={{ margin: '0 0 16px', fontSize: '18px', fontWeight: 700 }}>{t(language, 'map.addBuilding')}</h3>
                {addLat && <p style={{ margin: '0 0 8px', fontSize: '12px', color: '#94a3b8' }}>{addLat.toFixed(5)}, {addLng?.toFixed(5)} {geocoding ? `· ${t(language, 'map.searchingAddress')}` : ''}</p>}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  <div>
                    <label style={{ fontSize: '12px', fontWeight: 700, color: 'var(--ink-500)', display: 'block', marginBottom: '4px' }}>{t(language, 'zone.cardCount')}</label>
                    <select value={addCardId} onChange={e => setAddCardId(Number(e.target.value))} style={{ width: '100%', padding: '10px', border: '1px solid #e2e8f0', borderRadius: 'var(--r-md)', fontSize: '14px' }}>
                      {cards.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </select>
                  </div>
                  <div>
                    <label style={{ fontSize: '12px', fontWeight: 700, color: 'var(--ink-500)', display: 'block', marginBottom: '4px' }}>{t(language, 'map.buildingNameRequired')}</label>
                    <input value={addName} onChange={e => setAddName(e.target.value)} placeholder={t(language, 'map.buildingNamePlaceholder')}
                      style={{ width: '100%', padding: '10px', border: '1px solid #e2e8f0', borderRadius: 'var(--r-md)', fontSize: '14px', boxSizing: 'border-box' }} />
                  </div>
                  <div>
                    <label style={{ fontSize: '12px', fontWeight: 700, color: 'var(--ink-500)', display: 'block', marginBottom: '4px' }}>{t(language, 'map.address')}</label>
                    <input value={addAddress} onChange={e => setAddAddress(e.target.value)} placeholder={t(language, 'map.addressPlaceholder')}
                      style={{ width: '100%', padding: '10px', border: '1px solid #e2e8f0', borderRadius: 'var(--r-md)', fontSize: '14px', boxSizing: 'border-box' }} />
                  </div>
                  <div>
                    <label style={{ fontSize: '12px', fontWeight: 700, color: 'var(--ink-500)', display: 'block', marginBottom: '4px' }}>{t(language, 'map.type')}</label>
                    <select value={addType} onChange={e => setAddType(e.target.value as Building['type'])} style={{ width: '100%', padding: '10px', border: '1px solid #e2e8f0', borderRadius: 'var(--r-md)', fontSize: '14px' }}>
                      <option value="주택">{buildingTypeLabel('주택')}</option>
                      <option value="상가">{buildingTypeLabel('상가')}</option>
                    </select>
                  </div>
                </div>
                <div style={{ display: 'flex', gap: '8px', marginTop: '20px' }}>
                  <button onClick={closeAddModal} style={{ flex: 1, padding: '12px', borderRadius: 'var(--r-md)', border: '1px solid #e2e8f0', background: '#f8fafc', fontWeight: 700, cursor: 'pointer', fontSize: '15px' }}>{t(language, 'common.cancel')}</button>
                  <button onClick={handleConfirmAdd} disabled={!addName.trim()} style={{ flex: 2, padding: '12px', borderRadius: 'var(--r-md)', border: 'none', background: addName.trim() ? 'var(--accent-700)' : '#e2e8f0', color: addName.trim() ? '#fff' : '#94a3b8', fontWeight: 700, cursor: addName.trim() ? 'pointer' : 'not-allowed', fontSize: '15px' }}>{t(language, 'common.add')}</button>
                </div>
              </div>
            </div>
          )}

          {/* 건물 수정/삭제 모달 */}
          {editingBuilding && (
            <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'grid', placeItems: 'end center', zIndex: 3000 }} onClick={() => { setEditingBuildingId(null); setShowDeleteConfirm(false) }}>
              <div style={{ background: '#fff', borderRadius: '20px 20px 0 0', width: '100%', maxWidth: '480px', padding: '24px 20px 36px' }} onClick={e => e.stopPropagation()}>
                {!showDeleteConfirm ? (
                  <>
                    <h3 style={{ margin: '0 0 16px', fontSize: '18px', fontWeight: 700 }}>{t(language, 'map.editBuilding')}</h3>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                      <div>
                        <label style={{ fontSize: '12px', fontWeight: 700, color: 'var(--ink-500)', display: 'block', marginBottom: '4px' }}>{t(language, 'map.buildingName')}</label>
                        <input value={editName} onChange={e => setEditName(e.target.value)} style={{ width: '100%', padding: '10px', border: '1px solid #e2e8f0', borderRadius: 'var(--r-md)', fontSize: '14px', boxSizing: 'border-box' }} />
                      </div>
                      <div>
                        <label style={{ fontSize: '12px', fontWeight: 700, color: 'var(--ink-500)', display: 'block', marginBottom: '4px' }}>{t(language, 'map.address')}</label>
                        <input value={editAddress} onChange={e => setEditAddress(e.target.value)} style={{ width: '100%', padding: '10px', border: '1px solid #e2e8f0', borderRadius: 'var(--r-md)', fontSize: '14px', boxSizing: 'border-box' }} />
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: '8px', marginTop: '20px' }}>
                      <button onClick={() => setShowDeleteConfirm(true)} style={{ padding: '12px 16px', borderRadius: 'var(--r-md)', border: 'none', background: 'var(--danger-100)', color: 'var(--danger-600)', fontWeight: 700, cursor: 'pointer', fontSize: '14px' }}>{t(language, 'common.delete')}</button>
                      <button onClick={() => { setEditingBuildingId(null); setShowDeleteConfirm(false) }} style={{ flex: 1, padding: '12px', borderRadius: 'var(--r-md)', border: '1px solid #e2e8f0', background: '#f8fafc', fontWeight: 700, cursor: 'pointer', fontSize: '15px' }}>{t(language, 'common.cancel')}</button>
                      <button onClick={() => { onUpdateBuilding(editingBuilding.id, editName.trim(), editAddress.trim()); setEditingBuildingId(null) }} style={{ flex: 2, padding: '12px', borderRadius: 'var(--r-md)', border: 'none', background: 'var(--accent-700)', color: '#fff', fontWeight: 700, cursor: 'pointer', fontSize: '15px' }}>{t(language, 'common.save')}</button>
                    </div>
                  </>
                ) : (
                  <>
                    <h3 style={{ margin: '0 0 12px', fontSize: '18px', fontWeight: 700, color: 'var(--danger-600)' }}>{t(language, 'map.deleteBuilding')}</h3>
                    <p style={{ margin: '0 0 20px', fontSize: '15px', color: '#4b5563', lineHeight: 1.5 }}>{t(language, 'map.deleteBuildingDesc')}</p>
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <button onClick={() => setShowDeleteConfirm(false)} style={{ flex: 1, padding: '12px', borderRadius: 'var(--r-md)', border: '1px solid #e2e8f0', background: '#f8fafc', fontWeight: 700, cursor: 'pointer', fontSize: '15px' }}>{t(language, 'common.cancel')}</button>
                      <button onClick={() => { onDeleteBuilding(editingBuilding.id); setEditingBuildingId(null); setShowDeleteConfirm(false) }} style={{ flex: 2, padding: '12px', borderRadius: 'var(--r-md)', border: 'none', background: 'var(--danger-600)', color: '#fff', fontWeight: 700, cursor: 'pointer', fontSize: '15px' }}>{t(language, 'map.deleteNow')}</button>
                    </div>
                  </>
                )}
              </div>
            </div>
          )}
        </>
      )}
      {historyToEdit && (
        <div className="admin-modal-overlay">
          <div className="admin-modal-body" style={{ width: '90%', maxWidth: '340px' }}>
            <h3>{t(language, 'map.editHistory')}</h3>
            <div className="admin-modal-form">
              <label>{t(language, 'map.status')}</label>
              <select 
                value={historyToEdit.result} 
                onChange={e => setHistoryToEdit({ ...historyToEdit, result: e.target.value as any })}
                style={{ width: '100%', padding: '10px', marginBottom: '16px', borderRadius: 'var(--r-md)', border: '1px solid #ddd' }}
              >
                <option value="만남">{visitResultLabel('만남')}</option>
                <option value="부재">{visitResultLabel('부재')}</option>
                <option value="한국인">{visitResultLabel('한국인')}</option>
                <option value="거절">{visitResultLabel('거절')}</option>
              </select>
              
              <label>{t(language, 'map.timeSlot')}</label>
              <select 
                value={historyToEdit.timeSlot} 
                onChange={e => setHistoryToEdit({ ...historyToEdit, timeSlot: e.target.value as any })}
                style={{ width: '100%', padding: '10px', marginBottom: '16px', borderRadius: 'var(--r-md)', border: '1px solid #ddd' }}
              >
                <option value="오전">{timeSlotLabel('오전')}</option>
                <option value="오후">{timeSlotLabel('오후')}</option>
                <option value="저녁">{timeSlotLabel('저녁')}</option>
              </select>

              <label>{t(language, 'map.dateIso')}</label>
              <input 
                type="text"
                value={historyToEdit.visitedAt}
                onChange={e => setHistoryToEdit({ ...historyToEdit, visitedAt: e.target.value })}
                style={{ width: '100%', padding: '10px', marginBottom: '16px', borderRadius: 'var(--r-md)', border: '1px solid #ddd' }}
              />

              <label>{t(language, 'map.memo')}</label>
              <textarea
                value={historyToEdit.memo || ''}
                onChange={e => setHistoryToEdit({ ...historyToEdit, memo: e.target.value })}
                style={{ width: '100%', padding: '10px', height: '80px', marginBottom: '16px', borderRadius: 'var(--r-md)', border: '1px solid #ddd' }}
              />

              {/* 특별봉사 활성 시즌일 때만 표시 */}
              {getActivePeriodForDate(historyToEdit.visitedAt) && (
                <div style={{
                  marginBottom: '12px',
                  padding: '10px 12px',
                  background: '#fffbeb',
                  border: '1px solid #fde68a',
                  borderRadius: '8px',
                }}>
                  <div style={{ fontSize: '11px', fontWeight: 700, color: '#92400e', marginBottom: '6px' }}>
                    🟠 {getActivePeriodForDate(historyToEdit.visitedAt)?.label}
                  </div>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '14px', fontWeight: 600, color: '#1e293b' }}>
                    <input
                      type="checkbox"
                      checked={historyToEdit.invitationLeft ?? false}
                      onChange={(e) => setHistoryToEdit({ ...historyToEdit, invitationLeft: e.target.checked })}
                      style={{ width: '17px', height: '17px', accentColor: '#f59e0b', cursor: 'pointer' }}
                    />
                    {t(language, 'map.invitationLeft')}
                  </label>
                </div>
              )}
            </div>
            <div className="admin-modal-footer">
              <button
                onClick={() => setHistoryToEdit(null)}
                style={{ background: '#f1f5f9', color: 'var(--ink-500)', padding: '10px 16px', borderRadius: 'var(--r-md)', border: 'none', cursor: 'pointer' }}
              >{t(language, 'common.cancel')}</button>
              <button onClick={() => {
                onUpdateVisitHistory(historyToEdit.id, historyToEdit.unitId, {
                  result: historyToEdit.result,
                  timeSlot: historyToEdit.timeSlot,
                  memo: historyToEdit.memo || '',
                  visitedAt: historyToEdit.visitedAt,
                  invitationLeft: historyToEdit.invitationLeft ?? false,
                })
                setHistoryToEdit(null)
              }} style={{ background: 'var(--accent-700)', color: '#fff', padding: '10px 16px', borderRadius: 'var(--r-md)', border: 'none', cursor: 'pointer', fontWeight: 700 }}>{t(language, 'common.save')}</button>
            </div>
          </div>
        </div>
      )}
    </main>
  )
}

// ── 호수 상세 패널 ────────────────────────────────────────────
function UnitDetail({
  unit,
  unitHistories,
  buildingId,
  canRecordVisits,
  language,
  editingHistoryId,
  setEditingHistoryId,
  setHistoryToEdit,
  unitMemos,
  setUnitMemos,
  requireRecordAccess,
  onUpdateUnitFlags,
  onToggleRegularVisit,
  onToggleChinese,
  onDeleteUnit,
  onDeleteVisitHistory,
  onQuickLogVisit,
  onSetExpandedUnitId,
}: {
  unit: Unit
  unitHistories: VisitHistory[]
  buildingId: number
  canRecordVisits: boolean
  language: AppLanguage
  editingHistoryId: number | null
  setEditingHistoryId: (id: number | null) => void
  setHistoryToEdit: (h: VisitHistory) => void
  unitMemos: Record<number, string>
  setUnitMemos: React.Dispatch<React.SetStateAction<Record<number, string>>>
  requireRecordAccess: () => boolean
  onUpdateUnitFlags: (unitId: number, flags: Partial<Unit>) => void
  onToggleRegularVisit: (buildingId: number, unitId: number) => void
  onToggleChinese: (buildingId: number, unitId: number) => void
  onDeleteUnit: (buildingId: number, unitId: number) => void
  onDeleteVisitHistory: (historyId: number, unitId: number) => void
  onQuickLogVisit: (buildingId: number, unitId: number, result: UnitStatus) => void
  onSetExpandedUnitId: (id: number | null) => void
}) {
  const [historyExpanded, setHistoryExpanded] = useState(false)
  const [showDeleteMenu, setShowDeleteMenu] = useState(false)
  const [memoEditing, setMemoEditing] = useState(false)
  const [memoDraft, setMemoDraft] = useState<string | null>(null)

  const showGrid = unit.isChinese === true
  const latestHistory = unitHistories[0] ?? null

  return (
    <div className="unit-grid-detail">

      {/* ── 6칸 슬롯 그리드 (중국인 세대만) ── */}
      {showGrid && (
        <div style={{ padding: '10px 12px 0' }}>
          <UnitSlotGrid
            histories={unitHistories}
            canRecord={canRecordVisits}
            onRecordVisit={async (result, _timeSlot, _isWeekend) => {
              if (!requireRecordAccess()) return
              onQuickLogVisit(buildingId, unit.id, result)
            }}
          />
        </div>
      )}

      {/* ── 최근 방문 기록 ── */}
      <div style={{ padding: '8px 12px', borderBottom: '1px solid #f1f5f9' }}>
        {latestHistory ? (
          <>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12 }}>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                <span style={{ color: '#64748b' }}>
                  {latestHistory.visitedAt.slice(5).replace('-', '/')} {latestHistory.timeSlot}
                </span>
                <span style={{
                  fontWeight: 700,
                  color: latestHistory.result === '만남' ? '#16a34a' : latestHistory.result === '부재' ? '#dc2626' : '#6366f1',
                }}>{latestHistory.result}</span>
                {latestHistory.visitor && <span style={{ color: '#94a3b8' }}>· {latestHistory.visitor}</span>}
              </div>
              {unitHistories.length > 1 && (
                <button
                  onClick={() => setHistoryExpanded((v) => !v)}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 11, color: '#94a3b8', padding: '2px 4px' }}
                  type="button"
                >
                  {historyExpanded ? '닫기 ▴' : `+${unitHistories.length - 1}건 ▾`}
                </button>
              )}
            </div>

            {/* 펼친 이력 */}
            {historyExpanded && (
              <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 4 }}>
                {unitHistories.map((history) => {
                  const isMenuOpen = editingHistoryId === history.id
                  return (
                    <div key={history.id} className="history-item-container">
                      <button
                        className={`history-pill result-${history.result}`}
                        onClick={() => setEditingHistoryId(isMenuOpen ? null : history.id)}
                        type="button"
                      >
                        {history.visitedAt.slice(5).replace('-', '/')}({history.result[0]}) {history.timeSlot}
                      </button>
                      {isMenuOpen && (
                        <div className="history-admin-menu">
                          <button onClick={() => {
                            if (!requireRecordAccess()) return
                            setHistoryToEdit(history)
                            setEditingHistoryId(null)
                          }} type="button">✎ {t(language, 'map.edit')}</button>
                          <button onClick={() => {
                            if (!requireRecordAccess()) return
                            if (confirm(t(language, 'map.deleteHistoryConfirm'))) {
                              onDeleteVisitHistory(history.id, unit.id)
                            }
                            setEditingHistoryId(null)
                          }} className="delete" type="button">✕ {t(language, 'common.delete')}</button>
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </>
        ) : (
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: '#cbd5e1' }}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
            {t(language, 'map.noRecords')}
          </div>
        )}
      </div>

      {/* ── 토글 + ⋮ 메뉴 ── */}
      <div style={{ padding: '8px 12px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid #f1f5f9' }}>
        <div className="ugd-memo-checks" style={{ gap: 12 }}>
          <label className="ugd-chinese-label" style={{ color: unit.isForbidden ? 'var(--danger-600)' : 'inherit' }}>
            <button
              className={`unit-check-btn ugd-check${unit.isForbidden ? ' ucb-forbidden' : ''}${!canRecordVisits ? ' locked' : ''}`}
              onClick={() => { if (!requireRecordAccess()) return; onUpdateUnitFlags(unit.id, { isForbidden: !unit.isForbidden }) }}
              type="button"
            >{unit.isForbidden ? '✓' : ''}</button>
            방문금지
          </label>
          <label className="ugd-chinese-label">
            <button
              className={`unit-check-btn ugd-check${unit.isRegularVisit ? ' ucb-regular' : ''}${!canRecordVisits ? ' locked' : ''}`}
              onClick={() => { if (!requireRecordAccess()) return; onToggleRegularVisit(buildingId, unit.id) }}
              type="button"
            >{unit.isRegularVisit ? '✓' : ''}</button>
            정기방문
          </label>
          <label className="ugd-chinese-label">
            <button
              className={`unit-check-btn ugd-check${unit.isChinese ? ' ucb-chinese' : ''}${!canRecordVisits ? ' locked' : ''}`}
              onClick={() => { if (!requireRecordAccess()) return; onToggleChinese(buildingId, unit.id) }}
              type="button"
            >{unit.isChinese ? '✓' : ''}</button>
            중국인
          </label>
        </div>

        {/* ⋮ 더보기 (세대 삭제) */}
        <div style={{ position: 'relative' }}>
          <button
            onClick={() => setShowDeleteMenu((v) => !v)}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8', padding: '4px 6px', fontSize: 18, lineHeight: 1 }}
            type="button"
          >⋮</button>
          {showDeleteMenu && (
            <div style={{
              position: 'absolute', right: 0, top: '100%', zIndex: 100,
              background: '#fff', borderRadius: 10, boxShadow: '0 4px 16px rgba(0,0,0,0.12)',
              border: '1px solid #f1f5f9', overflow: 'hidden', minWidth: 120,
            }}>
              <button
                onClick={() => {
                  setShowDeleteMenu(false)
                  if (confirm(`"${unit.number}" ${t(language, 'map.deleteUnitConfirm')}`)) {
                    onDeleteUnit(buildingId, unit.id)
                    onSetExpandedUnitId(null)
                  }
                }}
                style={{ display: 'block', width: '100%', padding: '12px 16px', background: 'none', border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 700, color: 'var(--danger-600)', textAlign: 'left' }}
                type="button"
              >세대 삭제</button>
            </div>
          )}
        </div>
      </div>

      {/* ── 메모 (1줄 → 편집 시 저장/취소) ── */}
      <div style={{ padding: '8px 12px' }}>
        {memoEditing ? (
          <>
            <textarea
              className="ugd-memo-textarea"
              placeholder={t(language, 'map.memoPlaceholder')}
              rows={3}
              value={memoDraft ?? ''}
              onChange={(e) => setMemoDraft(e.target.value)}
              autoFocus
              style={{ resize: 'none' }}
            />
            <div style={{ display: 'flex', gap: 6, marginTop: 6 }}>
              <button
                onClick={() => {
                  onUpdateUnitFlags(unit.id, { memo: memoDraft ?? '' })
                  setUnitMemos((prev) => ({ ...prev, [unit.id]: memoDraft ?? '' }))
                  setMemoEditing(false)
                  setMemoDraft(null)
                }}
                style={{ flex: 1, padding: '7px 0', borderRadius: 8, border: 'none', background: '#1e293b', color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}
                type="button"
              >저장</button>
              <button
                onClick={() => { setMemoEditing(false); setMemoDraft(null) }}
                style={{ flex: 1, padding: '7px 0', borderRadius: 8, border: '1px solid #e2e8f0', background: '#fff', color: '#64748b', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}
                type="button"
              >취소</button>
            </div>
          </>
        ) : (
          <button
            onClick={() => {
              if (!canRecordVisits) return
              const current = unitMemos[unit.id] ?? (unit.memo || '')
              setMemoDraft(current)
              setMemoEditing(true)
            }}
            style={{
              width: '100%', textAlign: 'left', background: '#f8fafc',
              border: '1px solid #e2e8f0', borderRadius: 8,
              padding: '7px 10px', fontSize: 12, color: (unitMemos[unit.id] ?? unit.memo) ? '#334155' : '#cbd5e1',
              cursor: canRecordVisits ? 'pointer' : 'default', whiteSpace: 'pre-wrap', lineHeight: 1.5,
            }}
            type="button"
          >
            {(unitMemos[unit.id] ?? unit.memo) || t(language, 'map.memoPlaceholder')}
          </button>
        )}
      </div>
    </div>
  )
}
