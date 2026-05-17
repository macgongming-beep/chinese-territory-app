import { useEffect, useRef, useState, useMemo } from 'react'
import { MapCanvas } from './MapCanvas'
import type { MapAggregateMarker } from './MapCanvas'
import { SpecialPeriodBanner } from './SpecialPeriodBanner'
import { UnitSlotGrid } from './UnitSlotGrid'
import { territoryRegions } from '../data/territoryStructure'
import type {
  Building,
  BuildingStatus,
  CardBoundary,
  GeoPoint,
  Role,
  ServiceSession,
  TerritoryCard,
  TerritoryRegion,
  TimeSlot,
  Unit,
  UnitStatus,
  VisitTargetType,
  VisitHistory,
  SpecialPeriod,
} from '../types'
import { formatDisplayAddress, getBuildingStatus, getCardName, findCardForCoordinates, isValidMapCoordinate, normalizeMapCoordinates } from '../utils/mapUtils'
import { showToast } from '../lib/toast'
import { getCurrentTimeSlot } from '../utils/timeUtils'

type VisitResultFilter = '전체' | '부재' | '만남'
type HistoryEditor = {
  mode: 'add' | 'edit'
  buildingId: number
  unitId: number
  historyId?: number
  result: UnitStatus
  timeSlot: TimeSlot
  memo: string
  visitedAt: string
  invitationLeft?: boolean
}

function getLocalDateString() {
  const date = new Date()
  const month = `${date.getMonth() + 1}`.padStart(2, '0')
  const day = `${date.getDate()}`.padStart(2, '0')
  return `${date.getFullYear()}-${month}-${day}`
}

export function DesktopMap({
  buildings,
  boundaryEditRequest,
  cardBoundaries,
  cards,
  currentVisitor,
  actualRole,
  serviceSessions,
  focusedCardId,
  focusedBuildingId,
  onAddUnit,
  onCreateBuilding,
  onDeleteBuilding,
  onDeleteCardBoundary,
  onDeleteUnit,
  onSaveCardBoundary,
  onToggleRegularVisit,
  onToggleChinese,
  onUndoLatestVisit,
  onAddVisitHistory,
  onUpdateVisitHistory,
  onDeleteVisitHistory,
  onUpdateBuilding,
  onQuickLogVisit,
  onToggleInvitationLeft,
  onUpdateUnitFlags,
  visitHistories,
  specialPeriods,
  onSwitchToList,
}: {
  buildings: Building[]
  boundaryEditRequest?: number
  cardBoundaries: CardBoundary[]
  cards: TerritoryCard[]
  currentVisitor: string
  actualRole: Role
  serviceSessions: ServiceSession[]
  focusedCardId?: number | null
  focusedBuildingId?: number | null
  onAddUnit: (buildingId: number, unitNumber: string) => void
  onCreateBuilding: (input: {
    cardId: number
    name: string
    address: string
    type: Building['type']
    lat: number
    lng: number
  }) => void
  onDeleteBuilding: (buildingId: number) => void
  onUpdateBuilding: (buildingId: number, name: string, address: string, lat?: number, lng?: number, type?: Building['type'], memo?: string, isChineseHeavy?: boolean) => void
  onDeleteCardBoundary: (cardId: number) => void
  onDeleteUnit: (buildingId: number, unitId: number) => void
  onSaveCardBoundary: (cardId: number, points: GeoPoint[]) => Promise<void> | void
  onToggleRegularVisit: (buildingId: number, unitId: number, visitorName?: string) => void
  onToggleChinese: (buildingId: number, unitId: number) => void
  onUndoLatestVisit: (buildingId: number, unitId: number) => void
  onUpdateVisitHistory: (
    historyId: number,
    unitId: number,
    input: { result: UnitStatus; timeSlot: TimeSlot; memo: string; visitedAt: string; invitationLeft?: boolean },
  ) => void
  onAddVisitHistory: (
    buildingId: number,
    unitId: number,
    input: { result: UnitStatus; timeSlot: TimeSlot; memo: string; visitedAt: string; invitationLeft?: boolean },
  ) => void
  onDeleteVisitHistory: (historyId: number, unitId: number) => void
  onUpdateUnitStatus: (
    buildingId: number,
    unitId: number,
    status: UnitStatus,
    memo?: string,
    timeSlot?: TimeSlot,
  ) => void
  onQuickLogVisit: (buildingId: number, unitId: number, result: UnitStatus, invitationLeft?: boolean) => void
  onToggleInvitationLeft?: (buildingId: number, unitId: number) => void
  onUpdateUnitFlags: (unitId: number, flags: Partial<Unit>) => void
  visitHistories: VisitHistory[]
  specialPeriods?: SpecialPeriod[]
  onSwitchToList?: () => void
}) {
  const [cardFilter, setCardFilter] = useState<number | '전체'>('전체')
  const [regionFilter, setRegionFilter] = useState<TerritoryRegion | '전체'>('전체')
  const [areaFilter, setAreaFilter] = useState('전체')
  const [targetTypeFilter, setTargetTypeFilter] = useState<VisitTargetType>('전체')
  const [editingHistoryId, setEditingHistoryId] = useState<number | null>(null)
  const [historyEditor, setHistoryEditor] = useState<HistoryEditor | null>(null)
  const [statusFilter, setStatusFilter] = useState<BuildingStatus | '전체'>('전체')
  const [chineseOnlyFilter, setChineseOnlyFilter] = useState(false)
  const [visitResultFilter, setVisitResultFilter] = useState<VisitResultFilter>('전체')
  const [selectedBuildingId, setSelectedBuildingId] = useState<number | null>(buildings[1]?.id ?? buildings[0]?.id ?? null)
  const [newBuildingCardId, setNewBuildingCardId] = useState(cards[0]?.id ?? 1)
  const [newBuildingName, setNewBuildingName] = useState('새 건물')
  const [newBuildingAddress, setNewBuildingAddress] = useState('경기 용인시 처인구 고림동')
  const [newBuildingType, setNewBuildingType] = useState<Building['type']>('주택')
  const [newBuildingLat, setNewBuildingLat] = useState<number | null>(null)
  const [newBuildingLng, setNewBuildingLng] = useState<number | null>(null)
  const [geocoding, setGeocoding] = useState(false)
  const [geocodeStatus, setGeocodeStatus] = useState<'idle' | 'ok' | 'fail'>('idle')
  const [addingBuilding, setAddingBuilding] = useState(false)
  const [showMapActionMenu, setShowMapActionMenu] = useState(false)
  const [editingPinMode, setEditingPinMode] = useState(false)
  const [showAddBuildingModal, setShowAddBuildingModal] = useState(false)
  const [newUnitNumber, setNewUnitNumber] = useState('101호')
  const [boundaryCardId, setBoundaryCardId] = useState<number>(cards[0]?.id ?? 1)
  const [visibleBoundarySelection, setVisibleBoundarySelection] = useState<number | '전체' | null>('전체')
  const [drawingBoundary, setDrawingBoundary] = useState(false)
  const [savingBoundary, setSavingBoundary] = useState(false)
  const [draftBoundaryPoints, setDraftBoundaryPoints] = useState<GeoPoint[]>([])
  const [detailOpen, setDetailOpen] = useState(true)
  const [undoStack, setUndoStack] = useState<GeoPoint[][]>([])
  const [expandedUnitId, setExpandedUnitId] = useState<number | null>(null)
  const [unitDeleteMenuId, setUnitDeleteMenuId] = useState<number | null>(null)
  const [expandedBuildingIds, setExpandedBuildingIds] = useState<Set<number>>(new Set())
  const [collapsedStatusGroups, setCollapsedStatusGroups] = useState<Set<BuildingStatus>>(new Set(['방문완료']))
  const [hiddenMapStatuses, setHiddenMapStatuses] = useState<Set<BuildingStatus>>(new Set())
  const [unitMemos, setUnitMemos] = useState<Record<number, string>>({})
  const [unitMemoEdits, setUnitMemoEdits] = useState<Record<number, string | undefined>>({})
  const [_absentTimestamps, _setAbsentTimestamps] = useState<Record<number, number>>({})
  const [coordinateRepairTick, setCoordinateRepairTick] = useState(0)
  const coordinateRepairingIdsRef = useRef<Set<number>>(new Set())
  const today = getLocalDateString()
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
  const canRecordVisits = actualRole !== 'user' || !!todayRecordableSession
  const isAdmin = actualRole === 'admin'

  const requireRecordAccess = () => {
    if (canRecordVisits) return true
    showToast('봉사 시작 후 방문 기록을 입력할 수 있습니다.', 'info')
    return false
  }

  // 정기방문 모달 상태
  const [showRegularVisitModal, setShowRegularVisitModal] = useState(false)
  const [showUnregisterConfirmModal, setShowUnregisterConfirmModal] = useState(false)
  const [showDeleteBuildingConfirmModal, setShowDeleteBuildingConfirmModal] = useState(false)
  const [editingBuildingId, setEditingBuildingId] = useState<number | null>(null)
  const [editName, setEditName] = useState('')
  const [editAddress, setEditAddress] = useState('')
  const [editType, setEditType] = useState<Building['type']>('주택')
  const [pendingRegularVisitUnitId, _setPendingRegularVisitUnitId] = useState<number | null>(null)
  const [pendingRegularVisitBuildingId, _setPendingRegularVisitBuildingId] = useState<number | null>(null)
  const [pendingDeleteBuildingId, setPendingDeleteBuildingId] = useState<number | null>(null)
  const [addingUnitToBuildingId, setAddingUnitToBuildingId] = useState<number | null>(null)
  const [regularVisitorInput, setRegularVisitorInput] = useState('')

  // 미배정 건물 카드 찾기 (없으면 null)
  const unassignedCard = useMemo(() => cards.find(c => c.name === '미배정 건물'), [cards])

  const closeAddBuildingModal = () => {
    setShowAddBuildingModal(false)
    setAddingBuilding(false)
    setNewBuildingLat(null)
    setNewBuildingLng(null)
    setGeocodeStatus('idle')
  }

  const openAddBuildingAt = (lat: number, lng: number) => {
    setNewBuildingLat(lat)
    setNewBuildingLng(lng)
    setNewBuildingName('새 건물')
    setNewBuildingAddress('')
    setGeocodeStatus('idle')
    setShowAddBuildingModal(true)
    setExpandedBuildingIds(new Set())

    // 좌표 기반으로 카드 자동 매칭
    const matchedCardId = findCardForCoordinates(lat, lng, cardBoundaries)
    if (matchedCardId) {
      setNewBuildingCardId(matchedCardId)
      const matchedCard = cards.find(c => c.id === matchedCardId)
      showToast(`구역 "${matchedCard?.name ?? matchedCardId}" 자동 선택됨`, 'success')
    } else {
      if (unassignedCard) {
        setNewBuildingCardId(unassignedCard.id)
        showToast('구역선 밖입니다. "미배정 건물" 카드로 설정됩니다.', 'info')
      } else {
        showToast('구역선 밖입니다. 카드를 수동으로 선택해 주세요.', 'info')
      }
    }

    // 역지오코딩: 주소/건물명만 자동 입력 (좌표는 클릭 위치 그대로 유지)
    const naver = (window as any).naver
    if (naver?.maps?.Service) {
      setGeocoding(true)
      naver.maps.Service.reverseGeocode(
        {
          coords: new naver.maps.LatLng(lat, lng),
          orders: [naver.maps.Service.OrderType.ADDR, naver.maps.Service.OrderType.ROAD_ADDR].join(','),
        },
        (status: any, response: any) => {
          setGeocoding(false)
          if (status === naver.maps.Service.Status.OK) {
            const results = response.v2?.results ?? []
            const r = results.find((x: any) => x.name === 'roadaddr') ?? results[0]
            if (r?.region) {
              const parts = [
                r.region.area1?.name,
                r.region.area2?.name,
                r.region.area3?.name,
                r.land?.name ? r.land.name : null,
                r.land?.number1 ? r.land.number1 + (r.land?.number2 ? `-${r.land.number2}` : '') : null,
              ].filter(Boolean)
              if (parts.length > 0) setNewBuildingAddress(parts.join(' '))

              const rawName = r.land?.addition0?.value || r.land?.addition1?.value
              const buildingName = rawName && !/^\d+$/.test(rawName) ? rawName : null
              if (buildingName) {
                setNewBuildingName(buildingName)
              } else {
                const landParts = [
                  r.land?.name,
                  r.land?.number1 ? r.land.number1 + (r.land?.number2 ? `-${r.land.number2}` : '') : null,
                ].filter(Boolean)
                if (landParts.length > 0) setNewBuildingName(landParts.join(' '))
              }
              setGeocodeStatus('ok')
              return
            }
          }
          setGeocodeStatus('fail')
        },
      )
    }
  }

  const handleMapRightClick = (lat: number, lng: number) => {
    if (drawingBoundary) return
    openAddBuildingAt(lat, lng)
  }

  const handleMapClick = (lat: number, lng: number) => {
    openAddBuildingAt(lat, lng)
  }

  const openAddBuildingMode = () => {
    setShowMapActionMenu(false)
    setEditingPinMode(false)
    setAddingBuilding(true)
    showToast('지도에서 건물을 추가할 위치를 눌러주세요', 'info')
  }

  const toggleEditPinMode = () => {
    const next = !editingPinMode
    setShowMapActionMenu(false)
    setAddingBuilding(false)
    setEditingPinMode(next)
    showToast(next ? '핀 위치 수정 모드입니다. 옮길 핀을 드래그하세요' : '핀 위치 수정 모드를 종료했습니다', 'info')
  }


  const createBuildingAt = (lat: number, lng: number) => {
    onCreateBuilding({
      cardId: newBuildingCardId,
      name: newBuildingName.trim(),
      address: newBuildingAddress.trim(),
      type: newBuildingType,
      lat,
      lng,
    })
    setCardFilter(newBuildingCardId)
    closeAddBuildingModal()
  }

  const geocodeBuildingAddress = (address: string) =>
    new Promise<GeoPoint | null>((resolve) => {
      const naver = (window as any).naver
      if (!address.trim() || !naver?.maps?.Service) {
        resolve(null)
        return
      }
      naver.maps.Service.geocode({ query: address.trim() }, (status: any, response: any) => {
        if (status === naver.maps.Service.Status.OK && response.v2?.addresses?.length > 0) {
          const result = response.v2.addresses[0]
          resolve(normalizeMapCoordinates(Number(result.y), Number(result.x)))
          return
        }
        resolve(null)
      })
    })

  useEffect(() => {
    const naver = (window as any).naver
    if (!naver?.maps?.Service) {
      const timer = window.setTimeout(() => setCoordinateRepairTick((tick) => tick + 1), 800)
      return () => window.clearTimeout(timer)
    }

    const targets = buildings
      .filter((building) => {
        if (isValidMapCoordinate(Number(building.lat), Number(building.lng))) return false
        if (!building.address.trim()) return false
        return !coordinateRepairingIdsRef.current.has(building.id)
      })
      .slice(0, 8)

    if (targets.length === 0) return

    targets.forEach((building) => {
      coordinateRepairingIdsRef.current.add(building.id)
      geocodeBuildingAddress(building.address).then((coordinates) => {
        if (!coordinates) return
        onUpdateBuilding(building.id, building.name, building.address, coordinates.lat, coordinates.lng, building.type)
        showToast(`"${building.name || building.address}" 좌표를 주소로 보정했습니다`, 'success')
      })
    })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [buildings, coordinateRepairTick])

  const handleConfirmAddBuilding = () => {
    if (!newBuildingName.trim()) return

    // 좌표 있음 → 바로 건물 생성
    if (newBuildingLat != null && newBuildingLng != null) {
      const matchedCardId = findCardForCoordinates(newBuildingLat, newBuildingLng, cardBoundaries)
      if (matchedCardId) {
        setNewBuildingCardId(matchedCardId)
        onCreateBuilding({ cardId: matchedCardId, name: newBuildingName.trim(), address: newBuildingAddress.trim(), type: newBuildingType, lat: newBuildingLat, lng: newBuildingLng })
        setCardFilter(matchedCardId)
        const matchedCard = cards.find(c => c.id === matchedCardId)
        showToast(`구역 "${matchedCard?.name}" 카드에 자동 배정됐습니다`, 'success')
      } else if (unassignedCard) {
        onCreateBuilding({ cardId: unassignedCard.id, name: newBuildingName.trim(), address: newBuildingAddress.trim(), type: newBuildingType, lat: newBuildingLat, lng: newBuildingLng })
        setCardFilter(unassignedCard.id)
        showToast('구역선 밖 — "미배정 건물" 카드에 배정됐습니다', 'info')
      } else {
        createBuildingAt(newBuildingLat, newBuildingLng)
      }
      closeAddBuildingModal()
      return
    }

    // 좌표 없음 → 주소로 geocode 후 핀만 표시 (건물 생성 안 함)
    const naver = (window as any).naver
    const address = newBuildingAddress.trim()
    if (!address || !naver?.maps?.Service) {
      setGeocodeStatus('fail')
      return
    }

    setGeocoding(true)
    setGeocodeStatus('idle')

    const tryGeocode = (query: string) => {
      naver.maps.Service.geocode({ query }, (status: any, response: any) => {
        if (status === naver.maps.Service.Status.OK && response.v2?.addresses?.length > 0) {
          const result = response.v2.addresses[0]
          const coordinates = normalizeMapCoordinates(Number(result.y), Number(result.x))
          if (coordinates) {
            const { lat, lng } = coordinates
            setGeocoding(false)
            setNewBuildingLat(lat)
            setNewBuildingLng(lng)
            setGeocodeStatus('ok')
            const map = (window as any).__desktopMapInstance
            map?.panTo(new naver.maps.LatLng(lat, lng))
            const matchedCardId = findCardForCoordinates(lat, lng, cardBoundaries)
            if (matchedCardId) {
              setNewBuildingCardId(matchedCardId)
              const matchedCard = cards.find(c => c.id === matchedCardId)
              showToast(`지도에서 위치를 확인 후 추가하세요 (구역: "${matchedCard?.name}")`, 'info')
            } else {
              showToast('지도에서 위치를 확인 후 추가를 누르세요', 'info')
            }
            return
          }
        }
        // 앞 토큰 제거 후 재시도 (행정구역명 포함 시 실패하는 경우 대응)
        const tokens = query.split(' ')
        if (tokens.length > 2) {
          tryGeocode(tokens.slice(1).join(' '))
        } else {
          setGeocoding(false)
          setGeocodeStatus('fail')
        }
      })
    }
    tryGeocode(address)
  }

  const cardMap = useMemo(() => new Map(cards.map(c => [c.id, c])), [cards])
  const buildingsByCardId = useMemo(() => {
    const map = new Map<number, Building[]>()
    buildings.forEach((building) => {
      const list = map.get(building.cardId)
      if (list) list.push(building)
      else map.set(building.cardId, [building])
    })
    return map
  }, [buildings])
  const boundariesByCardId = useMemo(() => {
    const map = new Map<number, CardBoundary>()
    cardBoundaries.forEach(b => map.set(b.cardId, b))
    return map
  }, [cardBoundaries])
  const visitHistoriesByUnitId = useMemo(() => {
    const map = new Map<number, VisitHistory[]>()
    visitHistories.forEach((history) => {
      const list = map.get(history.unitId)
      if (list) list.push(history)
      else map.set(history.unitId, [history])
    })
    return map
  }, [visitHistories])

  const cardMatchesStructureFilters = (card: TerritoryCard) => {
    if (regionFilter !== '전체' && card.region !== regionFilter) return false
    if (areaFilter !== '전체' && card.area !== areaFilter) return false
    return true
  }

  // 구조 필터링된 카드 리스트
  const structureFilteredCards = useMemo(() => 
    cards.filter(cardMatchesStructureFilters), 
    [cards, regionFilter, areaFilter]
  );
  // 카드 정렬: 대권역 순서 + 미배정 마지막
  const orderedCards = useMemo(() => {
    const regionOrder = new Map<TerritoryRegion, number>();
    territoryRegions.forEach((r, i) => regionOrder.set(r, i));
    const sorted = [...structureFilteredCards].sort((a, b) => {
      // 미배정 카드 최하단
      if (a.status === '미배정' && b.status !== '미배정') return 1;
      if (b.status === '미배정' && a.status !== '미배정') return -1;
      // 대권역 순서
      const ra = regionOrder.get(a.region as TerritoryRegion) ?? 999;
      const rb = regionOrder.get(b.region as TerritoryRegion) ?? 999;
      if (ra !== rb) return ra - rb;
      // 같은 대권역이면 동(지역) 알파벳 순
      return a.area.localeCompare(b.area, 'ko');
    });
    return sorted;
  }, [structureFilteredCards]);

  // 필터링된 카드 ID 세트 (하이라이트용)
  const highlightedCardIds = useMemo(() => new Set(orderedCards.map((c) => c.id)), [orderedCards])



  // areaFilterOptions 는 동 dropdown 제거 후 미사용 — 추후 필요 시 부활

  const unitMatchesOperatingFilter = (unit: Building['units'][number]) => {
    if (chineseOnlyFilter && !unit.isChinese) return false
    if (visitResultFilter !== '전체' && unit.status !== visitResultFilter) return false
    return true
  }

  const filteredBuildings = useMemo(() => 
    buildings.filter((building) => {
      const card = cardMap.get(building.cardId)
      if (!card || !cardMatchesStructureFilters(card)) return false
      if (cardFilter !== '전체' && building.cardId !== cardFilter) return false
      if (targetTypeFilter !== '전체' && building.type !== targetTypeFilter) return false
      if (statusFilter !== '전체' && getBuildingStatus(building) !== statusFilter) return false
      if ((chineseOnlyFilter || visitResultFilter !== '전체') && !building.units.some(unitMatchesOperatingFilter)) return false
      return true
    }),
    [buildings, cardMap, regionFilter, areaFilter, cardFilter, targetTypeFilter, statusFilter, chineseOnlyFilter, visitResultFilter]
  )

  const contextBuildings = useMemo(() =>
    buildings.filter((building) => {
      const card = cardMap.get(building.cardId)
      if (!card || !cardMatchesStructureFilters(card)) return false
      if (targetTypeFilter !== '전체' && building.type !== targetTypeFilter) return false
      if (statusFilter !== '전체' && getBuildingStatus(building) !== statusFilter) return false
      if ((chineseOnlyFilter || visitResultFilter !== '전체') && !building.units.some(unitMatchesOperatingFilter)) return false
      return true
    }),
    [buildings, cardMap, regionFilter, areaFilter, targetTypeFilter, statusFilter, chineseOnlyFilter, visitResultFilter]
  )

  const statusCounts = useMemo(() => 
    filteredBuildings.reduce<Record<BuildingStatus, number>>(
      (counts, building) => {
        const status = getBuildingStatus(building)
        counts[status] += 1
        return counts
      },
      { 방문필요: 0, 방문완료: 0, 방문금지: 0, 정기방문: 0 },
    ),
    [filteredBuildings]
  )

  const panelBuildings = filteredBuildings
  const mapBuildings = useMemo(
    () => contextBuildings.filter((building) => !hiddenMapStatuses.has(getBuildingStatus(building))),
    [contextBuildings, hiddenMapStatuses],
  )

  // 집계 마커 (모바일과 동일 패턴) — 카드/동 미선택 + 그리기 모드 X 일 때 구/동 단위로 묶기
  const shouldUseAggregateMap =
    cardFilter === '전체' &&
    !focusedBuildingId &&
    !drawingBoundary &&
    !addingBuilding &&
    !editingPinMode

  const mapAggregateMarkers = useMemo<MapAggregateMarker[]>(() => {
    if (!shouldUseAggregateMap) return []
    type Acc = MapAggregateMarker & { latSum: number; lngSum: number; pointCount: number }
    const groups = new Map<string, Acc>()
    const groupByArea = regionFilter !== '전체'
    mapBuildings.forEach((building) => {
      const card = cardMap.get(building.cardId)
      if (!card) return
      const label = groupByArea ? card.area : String(card.region)
      if (!label) return
      const id = `${groupByArea ? 'area' : 'region'}:${label}`
      const current = groups.get(id) ?? {
        id, label,
        count: 0, unitCount: 0, houseCount: 0, shopCount: 0,
        lat: 0, lng: 0, latSum: 0, lngSum: 0, pointCount: 0,
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
      .filter((g) => g.pointCount > 0)
      .map((g) => ({
        id: g.id, label: g.label,
        count: g.count, unitCount: g.unitCount,
        houseCount: g.houseCount, shopCount: g.shopCount,
        lat: g.latSum / g.pointCount, lng: g.lngSum / g.pointCount,
      }))
      .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label, 'ko'))
  }, [mapBuildings, cardMap, regionFilter, shouldUseAggregateMap])

  const aggregateMapBuildings = shouldUseAggregateMap ? [] : mapBuildings

  const handleSelectAggregateMarker = (id: string) => {
    const [kind, label] = id.split(':')
    if (kind === 'region') {
      setRegionFilter(label as TerritoryRegion | '전체')
      setAreaFilter('전체')
    } else if (kind === 'area') {
      setAreaFilter(label)
    }
  }
  const panelBuildingGroups = useMemo(() => {
    const order: BuildingStatus[] = ['방문금지', '방문필요', '정기방문', '방문완료']
    const labels: Record<BuildingStatus, string> = {
      방문금지: '방문금지',
      방문필요: '방문필요',
      정기방문: '정기방문',
      방문완료: '방문완료',
    }
    const grouped = new Map<BuildingStatus, Building[]>()
    order.forEach((status) => grouped.set(status, []))
    panelBuildings.forEach((building) => {
      grouped.get(getBuildingStatus(building))?.push(building)
    })
    return order.map((status) => ({
      status,
      label: labels[status],
      buildings: grouped.get(status) ?? [],
    }))
  }, [panelBuildings])
  const panelUnitTotal = useMemo(() => panelBuildings.reduce((total, building) => total + building.units.length, 0), [panelBuildings])
  const panelVisitedTotal = useMemo(() => panelBuildings.reduce(
    (total, building) => total + building.units.filter((unit) => unit.status !== '미방문').length,
    0,
  ), [panelBuildings])
  const panelCompletionRate = useMemo(() => panelUnitTotal === 0 ? 0 : Math.round((panelVisitedTotal / panelUnitTotal) * 100), [panelUnitTotal, panelVisitedTotal])

  useEffect(() => {
    if (cardFilter !== '전체' && !orderedCards.some((card) => card.id === cardFilter)) {
      setCardFilter('전체')
    }
  }, [cardFilter, orderedCards])

  useEffect(() => {
    if (!focusedCardId || !cards.some((card) => card.id === focusedCardId)) return
    const focusedCard = cards.find((card) => card.id === focusedCardId)
    if (!focusedCard) return

    setRegionFilter(
      territoryRegions.includes(focusedCard.region as TerritoryRegion)
        ? (focusedCard.region as TerritoryRegion)
        : '전체',
    )
    setAreaFilter(focusedCard.area)
    setTargetTypeFilter('전체')
    setCardFilter(focusedCardId)
    setBoundaryCardId(focusedCardId)
    setVisibleBoundarySelection(focusedCardId)
  }, [cards, focusedCardId])

  useEffect(() => {
    if (!focusedBuildingId) return
    const focusedBuilding = buildings.find((building) => building.id === focusedBuildingId)
    if (!focusedBuilding) return
    const focusedCard = cards.find((card) => card.id === focusedBuilding.cardId)

    if (focusedCard) {
      setRegionFilter(
        territoryRegions.includes(focusedCard.region as TerritoryRegion)
          ? (focusedCard.region as TerritoryRegion)
          : '전체',
      )
      setAreaFilter(focusedCard.area)
    }
    setTargetTypeFilter('전체')
    setStatusFilter('전체')
    setChineseOnlyFilter(false)
    setVisitResultFilter('전체')
    setCardFilter(focusedBuilding.cardId)
    setBoundaryCardId(focusedBuilding.cardId)
    setVisibleBoundarySelection(focusedBuilding.cardId)
    setSelectedBuildingId(focusedBuilding.id)
    setExpandedBuildingIds(new Set([focusedBuilding.id]))
    setExpandedUnitId(null)

    window.setTimeout(() => {
      document.getElementById(`bld-row-${focusedBuilding.id}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' })
    }, 120)
  }, [buildings, cards, focusedBuildingId])

  useEffect(() => {
    if (cards.length > 0 && !cards.some((card) => card.id === boundaryCardId)) {
      setBoundaryCardId(cards[0].id)
    }
  }, [boundaryCardId, cards])

  useEffect(() => {
    if (typeof visibleBoundarySelection === 'number' && !cards.some((card) => card.id === visibleBoundarySelection)) {
      setVisibleBoundarySelection(null)
    }
  }, [cards, visibleBoundarySelection])

  const selectedBoundaryCard = useMemo(() => cardMap.get(boundaryCardId), [cardMap, boundaryCardId])
  const savedBoundary = useMemo(() => boundariesByCardId.get(boundaryCardId), [boundariesByCardId, boundaryCardId])

  const handleStartBoundaryDrawing = () => {
    const points = savedBoundary?.points ?? []
    setDraftBoundaryPoints(points)
    setUndoStack([]) // history 초기화
    setDrawingBoundary(true)
  }

  useEffect(() => {
    if (!boundaryEditRequest || !focusedCardId || !cards.some((card) => card.id === focusedCardId)) return
    const boundary = cardBoundaries.find((item) => item.cardId === focusedCardId)
    setBoundaryCardId(focusedCardId)
    const points = boundary?.points ?? []
    setDraftBoundaryPoints(points)
    setUndoStack([]) // history 초기화
    setDrawingBoundary(true)
  }, [boundaryEditRequest, cardBoundaries, cards, focusedCardId])

  const handleSaveBoundary = async () => {
    setSavingBoundary(true)
    await onSaveCardBoundary(boundaryCardId, draftBoundaryPoints)
    setSavingBoundary(false)
    setDrawingBoundary(false)
    setDraftBoundaryPoints([])
    setUndoStack([])
  }

  const handleSelectCardForMap = (cardId: number) => {
    setBoundaryCardId(cardId)
    const isSameVisibleCard = visibleBoundarySelection === cardId
    setCardFilter(isSameVisibleCard ? '전체' : cardId)
    setVisibleBoundarySelection(isSameVisibleCard ? null : cardId)
    setDrawingBoundary(false)
    setDraftBoundaryPoints([])
    setUndoStack([])
    if (isSameVisibleCard) {
      setSelectedBuildingId(null)
      setExpandedBuildingIds(new Set())
      setExpandedUnitId(null)
      return
    }
    const firstBuilding = buildings.find((b) => b.cardId === cardId)
    if (firstBuilding) {
      setSelectedBuildingId(firstBuilding.id)
      setExpandedBuildingIds((prev) => { const n = new Set(prev); n.add(firstBuilding.id); return n })
    }
  }

  const moveMapToBuilding = (building: Building) => {
    const naver = (window as any).naver
    const map = (window as any).__desktopMapInstance
    const lat = Number(building.lat)
    const lng = Number(building.lng)
    if (!naver?.maps || !map || !Number.isFinite(lat) || !Number.isFinite(lng)) return
    map.morph(new naver.maps.LatLng(lat, lng), 17)
  }

  const focusBuildingFromPanel = (building: Building) => {
    setSelectedBuildingId(building.id)
    setExpandedBuildingIds((prev) => {
      const next = new Set(prev)
      if (next.has(building.id)) next.delete(building.id)
      else next.add(building.id)
      return next
    })
    setExpandedUnitId(null)
    moveMapToBuilding(building)
  }

  const toggleStatusGroup = (status: BuildingStatus) => {
    setCollapsedStatusGroups((prev) => {
      const next = new Set(prev)
      if (next.has(status)) next.delete(status)
      else next.add(status)
      return next
    })
  }

  const toggleStatusFromLegend = (status: BuildingStatus) => {
    if (status !== '방문완료' && status !== '정기방문') {
      toggleStatusGroup(status)
      return
    }

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

  const openHistoryEditorForAdd = (buildingId: number, unitId: number) => {
    if (!requireRecordAccess()) return
    setEditingHistoryId(null)
    setHistoryEditor({
      mode: 'add',
      buildingId,
      unitId,
      result: '부재',
      timeSlot: getCurrentTimeSlot(),
      memo: '',
      visitedAt: getLocalDateString(),
      invitationLeft: false,
    })
  }

  const openHistoryEditorForEdit = (buildingId: number, history: VisitHistory) => {
    if (!requireRecordAccess()) return
    setEditingHistoryId(null)
    setHistoryEditor({
      mode: 'edit',
      buildingId,
      unitId: history.unitId,
      historyId: history.id,
      result: history.result,
      timeSlot: history.timeSlot,
      memo: history.memo ?? '',
      visitedAt: history.visitedAt,
      invitationLeft: history.invitationLeft ?? false,
    })
  }

  // 특정 날짜에 활성화된 특별봉사 시즌 (없으면 null)
  const getActivePeriodForDate = (dateStr: string): SpecialPeriod | null => {
    if (!specialPeriods) return null
    return specialPeriods.find((p) => dateStr >= p.startDate && dateStr <= p.endDate) ?? null
  }

  const saveHistoryEditor = () => {
    if (!historyEditor) return
    const payload = {
      result: historyEditor.result,
      timeSlot: historyEditor.timeSlot,
      memo: historyEditor.memo,
      visitedAt: historyEditor.visitedAt,
      invitationLeft: historyEditor.invitationLeft,
    }

    if (historyEditor.mode === 'edit' && historyEditor.historyId) {
      onUpdateVisitHistory(historyEditor.historyId, historyEditor.unitId, payload)
    } else {
      onAddVisitHistory(historyEditor.buildingId, historyEditor.unitId, payload)
    }
    setHistoryEditor(null)
  }

  const toggleAllBoundaries = () => {
    if (visibleBoundarySelection === '전체') {
      setVisibleBoundarySelection(null)
      return
    }
    setVisibleBoundarySelection('전체')
    setCardFilter('전체')
  }

  const handleDeleteBoundary = (cardId: number) => {
    onDeleteCardBoundary(cardId)
    if (cardId === boundaryCardId) {
      setDrawingBoundary(false)
      setDraftBoundaryPoints([])
      setUndoStack([])
    }
  }

  const updateDraftBoundaryPoint = (index: number, point: GeoPoint) => {
    setUndoStack((prev) => [...prev, draftBoundaryPoints])
    setDraftBoundaryPoints((points) =>
      points.map((currentPoint, pointIndex) => (pointIndex === index ? point : currentPoint)),
    )
  }

  const insertDraftBoundaryPoint = (index: number, point: GeoPoint) => {
    setUndoStack((prev) => [...prev, draftBoundaryPoints])
    setDraftBoundaryPoints((points) => [
      ...points.slice(0, index),
      point,
      ...points.slice(index),
    ])
  }

  const removeDraftBoundaryPoint = (index: number) => {
    setUndoStack((prev) => [...prev, draftBoundaryPoints])
    setDraftBoundaryPoints((points) => points.filter((_, pointIndex) => pointIndex !== index))
  }

  return (
    <section className={detailOpen ? 'map-layout ots-theme' : 'map-layout detail-collapsed ots-theme'}>
      <div className="map-main">
        {specialPeriods && (
          <div style={{ padding: '8px 16px 0' }}>
            <SpecialPeriodBanner specialPeriods={specialPeriods} variant="compact" />
          </div>
        )}
        {activeServiceSession && (
          <div className="current-session-banner">
            <div>
              <strong>현재 세션</strong>
              <span>
                {activeSessionCard?.name ?? '카드 미지정'} · {activeServiceSession.timeSlot} · {activeServiceSession.userName}
              </span>
            </div>
            <em>
              {activeServiceSession.source === 'assigned' ? '배정 시작' : activeServiceSession.source === 'manual_override' ? '배정 변경' : '직접 시작'}
            </em>
          </div>
        )}
        {/* 지역 칩 (모바일과 패러티) */}
        <div className="desk-map-area-chips" role="tablist" aria-label="지역 필터">
          {(() => {
            const regionCounts = new Map<string, number>()
            for (const c of cards) {
              const k = c.region as string
              regionCounts.set(k, (regionCounts.get(k) ?? 0) + 1)
            }
            const renderChip = (region: TerritoryRegion | '전체', label: string, count: number) => {
              const active = regionFilter === region
              return (
                <button
                  key={String(region)}
                  role="tab"
                  aria-selected={active}
                  className={active ? 'active' : ''}
                  onClick={() => { setRegionFilter(region); setAreaFilter('전체') }}
                  type="button"
                >
                  {label}
                  {region !== '전체' && <em>{count}</em>}
                </button>
              )
            }
            return (
              <>
                {renderChip('전체', '전체', cards.length)}
                {territoryRegions.map((r) => renderChip(r, r, regionCounts.get(r) ?? 0))}
              </>
            )
          })()}
        </div>
        <div className="map-toolbar" aria-label="지도 필터">
          {/* 건물 유형 segment */}
          <div className="map-toolbar-item">
            <span className="map-toolbar-label">건물</span>
            <div className="map-toolbar-seg">
              {(['전체', '상가', '주택'] as Array<Building['type'] | '전체'>).map((t) => (
                <button
                  key={t}
                  className={targetTypeFilter === t ? 'active' : ''}
                  onClick={() => setTargetTypeFilter(t)}
                  type="button"
                >
                  {t}
                </button>
              ))}
            </div>
          </div>
          {/* 상태 segment */}
          <div className="map-toolbar-item">
            <span className="map-toolbar-label">상태</span>
            <div className="map-toolbar-seg">
              {([
                { key: '전체', label: '전체' },
                { key: '중국인', label: '중국인' },
                { key: '부재', label: '부재' },
                { key: '만남', label: '만남' },
              ] as const).map(({ key, label }) => (
                <button
                  key={key}
                  className={
                    key === '전체' ? (!chineseOnlyFilter && visitResultFilter === '전체' ? 'active' : '') :
                    key === '중국인' ? (chineseOnlyFilter ? 'active' : '') :
                    key === '부재' ? (visitResultFilter === '부재' ? 'active' : '') :
                    (visitResultFilter === '만남' ? 'active' : '')
                  }
                  onClick={() => {
                    if (key === '전체') { setChineseOnlyFilter(false); setVisitResultFilter('전체') }
                    else if (key === '중국인') setChineseOnlyFilter((c) => !c)
                    else if (key === '부재') setVisitResultFilter((c) => c === '부재' ? '전체' : '부재')
                    else setVisitResultFilter((c) => c === '만남' ? '전체' : '만남')
                  }}
                  type="button"
                >{label}</button>
              ))}
            </div>
          </div>
          {/* spacer */}
          <div style={{ flex: 1 }} />
          {/* 목록으로 전환 */}
          {onSwitchToList && (
            <button
              onClick={onSwitchToList}
              type="button"
              style={{
                display: 'flex', alignItems: 'center', gap: 5,
                padding: '5px 12px', borderRadius: 8,
                border: '1px solid #e2e8f0', background: '#f8fafc',
                fontSize: 12, fontWeight: 600, color: '#475569',
                cursor: 'pointer', transition: 'all .15s',
              }}
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/></svg>
              목록
            </button>
          )}
          {/* 구역선 버튼 */}
          {isAdmin && (
            <div style={{ display: 'flex', gap: 8 }}>
              <button className="tbl-ghost-btn" onClick={handleStartBoundaryDrawing} disabled={drawingBoundary} type="button">
                {savedBoundary ? '구역선 변경' : '구역선 그리기'}
              </button>
              {savedBoundary && (
                <button className="tbl-ghost-btn" style={{ color: 'var(--danger-600)', borderColor: 'var(--danger-200)' }} onClick={() => { if (confirm(`${selectedBoundaryCard?.name ?? '선택 카드'} 구역선을 삭제할까요?`)) { handleDeleteBoundary(boundaryCardId) } }} disabled={drawingBoundary} type="button">
                  삭제
                </button>
              )}
            </div>
          )}
        </div>

        <div className="map-workspace">
          <aside className="map-card-panel" aria-label="지도 카드 목록">
            <div className="map-panel-head">
              <div>
                <p style={{ margin: 0, fontSize: 11, fontWeight: 600, color: 'var(--gray-500)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>구역 카드</p>
                <strong style={{ fontSize: 18, fontWeight: 700, color: 'var(--gray-900)', lineHeight: 1.2 }}>{orderedCards.length}개</strong>
              </div>
              <button
                className="tbl-soft-btn sm"
                style={{ flexShrink: 0 }}
                onClick={toggleAllBoundaries}
                type="button"
              >
                전체 보기
              </button>
            </div>
            <div className="map-card-list">
              {orderedCards.length === 0 && (
                <div className="map-empty-state">
                  <p>조건에 맞는 카드가 없습니다</p>
                </div>
              )}
              {orderedCards.map((card) => {
                const cardBuildings = buildingsByCardId.get(card.id) ?? []
                const hasBoundary = boundariesByCardId.has(card.id)
                const boundaryVisible = visibleBoundarySelection === card.id || visibleBoundarySelection === '전체'
                return (
                  <article
                    className={cardFilter === card.id ? 'map-card-item selected' : 'map-card-item'}
                    key={card.id}
                  >
                    <button className="map-card-item__content" onClick={() => handleSelectCardForMap(card.id)} type="button">
                      <strong>{card.name}</strong>
                      <span>
                        건물 <b className="tnum">{cardBuildings.length}</b> · 세대 <b className="tnum">{card.units}</b> · <b className="tnum">{card.progress}%</b>
                      </span>
                    </button>
                    <button
                      className={`map-card-boundary-btn${boundaryVisible ? ' active' : ''}`}
                      disabled={!hasBoundary}
                      onClick={(e) => { e.stopPropagation(); setVisibleBoundarySelection((prev) => prev === card.id ? null : card.id) }}
                      type="button"
                    >
                      구역선
                    </button>
                  </article>
                )
              })}
            </div>
          </aside>

          <div className="map-canvas-panel">
              <div className="map-legend-card">
                {[
                  { status: '방문필요', color: 'var(--info-700, #3b82f6)', label: '방문필요' },
                  { status: '방문완료', color: '#10B981', label: '방문완료' },
                  { status: '방문금지', color: '#EF4444', label: '방문금지' },
                  { status: '정기방문', color: '#F59E0B', label: '정기방문' },
                ].map(({ status, color, label }) => {
                  const typedStatus = status as BuildingStatus
                  const isCollapsed = collapsedStatusGroups.has(typedStatus)
                  const isHiddenOnMap = hiddenMapStatuses.has(typedStatus)
                  return (
                  <button
                    className={`map-legend-toggle${isCollapsed ? ' collapsed' : ''}${isHiddenOnMap ? ' map-hidden' : ''}`}
                    key={status}
                    onClick={() => toggleStatusFromLegend(typedStatus)}
                    title={`${label} 목록 ${isCollapsed ? '펼치기' : '접기'}${typedStatus === '방문완료' || typedStatus === '정기방문' ? ' · 지도 핀 토글' : ''}`}
                    type="button"
                  >
                    <span style={{ width: 10, height: 10, borderRadius: '50%', background: color, border: '2px solid white', boxShadow: '0 1px 3px rgba(0,0,0,0.2)', flexShrink: 0 }} />
                    <span style={{ fontSize: 12, color: 'var(--gray-600)' }}>{label}</span>
                    <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--gray-900)', marginLeft: 'auto' }}>{(statusCounts as Record<string, number>)[status] ?? 0}</span>
                  </button>
                  )
                })}
              </div>

            {drawingBoundary && (
              <div className="boundary-toolbar editing" aria-label="카드 구역선 편집">
                <div>
                  <span>점 {draftBoundaryPoints.length}개</span>
                  <em>점 드래그 이동 · 우클릭 삭제 · 중간점 클릭 추가</em>
                </div>
                <div className="boundary-actions">
                    <button
                      onClick={() => {
                        const prev = undoStack[undoStack.length - 1]
                        if (prev) {
                          setDraftBoundaryPoints(prev)
                          setUndoStack((stack) => stack.slice(0, -1))
                        }
                      }}
                      disabled={undoStack.length === 0}
                      type="button"
                    >
                      되돌리기
                    </button>
                    <button
                      onClick={() => setDraftBoundaryPoints([])}
                      disabled={draftBoundaryPoints.length === 0}
                      type="button"
                    >
                      다시 그리기
                    </button>
                    <button
                      className="primary-boundary-action"
                      disabled={draftBoundaryPoints.length < 3 || savingBoundary}
                      onClick={handleSaveBoundary}
                      type="button"
                    >
                      {savingBoundary ? '저장 중...' : '저장'}
                    </button>
                    <button
                      onClick={() => {
                        setDrawingBoundary(false)
                        setDraftBoundaryPoints([])
                        setUndoStack([])
                      }}
                      type="button"
                    >
                      취소
                    </button>
                </div>
              </div>
            )}

            {(addingBuilding || editingPinMode) && (
              <div className={`desktop-map-mode-banner${editingPinMode ? ' edit-pin' : ''}`}>
                <strong>{editingPinMode ? '핀 위치 수정' : '건물 추가'}</strong>
                <button
                  onClick={() => {
                    setAddingBuilding(false)
                    setEditingPinMode(false)
                  }}
                  type="button"
                >
                  종료
                </button>
              </div>
            )}

            <MapCanvas
              buildings={aggregateMapBuildings}
              aggregateMarkers={mapAggregateMarkers}
              onSelectAggregate={handleSelectAggregateMarker}
              cardBoundaries={cardBoundaries}
              highlightedCardIds={highlightedCardIds}
              cards={cards}
              drawingBoundary={drawingBoundary}
              addingBuilding={addingBuilding}
              editingBuildingLocation={editingPinMode}
              previewPinLat={newBuildingLat}
              previewPinLng={newBuildingLng}
              draftBoundaryPoints={draftBoundaryPoints}
              selectedBuildingId={selectedBuildingId ?? 0}
              focusBuildingId={focusedBuildingId}
              selectedCardId={drawingBoundary ? boundaryCardId : visibleBoundarySelection}
              onAddBoundaryPoint={(point) => {
                setUndoStack((prev) => [...prev, draftBoundaryPoints])
                setDraftBoundaryPoints((points) => [...points, point])
              }}
              onInsertBoundaryPoint={insertDraftBoundaryPoint}
              onRemoveBoundaryPoint={removeDraftBoundaryPoint}
              onSelectBuilding={(id) => {
                if (addingBuilding || editingPinMode) return
                if (selectedBuildingId === id) {
                  if (!detailOpen) {
                    setDetailOpen(true)
                    setExpandedBuildingIds(new Set([id]))
                    setExpandedUnitId(null)
                    setTimeout(() => {
                      document.getElementById(`bld-row-${id}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' })
                    }, 80)
                    return
                  }
                  // 이미 선택된 포인트를 다시 클릭하면 해제 및 상세 접기
                  setSelectedBuildingId(null)
                  setExpandedBuildingIds(new Set())
                  setExpandedUnitId(null)
                } else {
                  // 새로운 포인트 클릭 시 선택 및 해당 건물만 펴기
                  setDetailOpen(true)
                  setSelectedBuildingId(id)
                  setExpandedBuildingIds(new Set([id]))
                  setExpandedUnitId(null) // 다른 건물로 넘어갈 때도 호수 상세 내역 초기화
                  
                  const b = buildings.find(item => item.id === id)
                  if (b && cardFilter !== '전체' && b.cardId !== cardFilter) {
                    setCardFilter(b.cardId)
                  }
                  
                  setTimeout(() => {
                    document.getElementById(`bld-row-${id}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' })
                  }, 80)
                }
              }}
              onSelectCardBoundary={handleSelectCardForMap}
              onUpdateBoundaryPoint={updateDraftBoundaryPoint}
              onMapRightClick={handleMapRightClick}
              onMapClick={addingBuilding ? handleMapClick : undefined}
              onMovePreviewPin={(lat, lng) => {
                setNewBuildingLat(lat)
                setNewBuildingLng(lng)
              }}
              onMoveBuilding={(id, lat, lng) => {
                const b = buildings.find(item => item.id === id)
                if (b) {
                  onUpdateBuilding(id, b.name, b.address, lat, lng)
                  showToast(`${b.name || b.address} 핀 위치가 저장됐습니다`, 'success')
                }
              }}
              isMobile={false}
              onOpenActionMenu={() => setShowMapActionMenu((open) => !open)}
              onToggleAddingBuilding={(val) => {
                if (!val) {
                  closeAddBuildingModal()
                } else {
                  setAddingBuilding(true)
                }
              }}
              onToggleDrawingBoundary={(val) => {
                if (val) {
                  setDrawingBoundary(true)
                  setDraftBoundaryPoints([])
                  setUndoStack([])
                } else {
                  setDrawingBoundary(false)
                }
              }}
            />
            {showMapActionMenu && (
              <div className="desktop-map-action-popover">
                <button onClick={openAddBuildingMode} type="button">건물 추가</button>
                <button onClick={toggleEditPinMode} type="button">
                  {editingPinMode ? '핀 수정 종료' : '핀 위치 수정'}
                </button>
              </div>
            )}
          </div>{/* /map-canvas-panel */}

      {detailOpen && (
      <aside className="map-detail-pane" style={{ position: 'relative' }}>
        <div className="map-detail-head">
          <div style={{ flex: 1 }}>
            <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 8 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--gray-900)' }}>
                  건물 목록 <span style={{ fontVariantNumeric: 'tabular-nums' }}>{panelBuildings.length}</span>
                </span>
              </div>
              <span style={{ fontSize: 18, fontWeight: 700, color: 'var(--success-600)', fontVariantNumeric: 'tabular-nums' }}>{panelCompletionRate}%</span>
            </div>
            <div style={{ height: 4, background: 'var(--gray-100)', borderRadius: 'var(--radius-full)', overflow: 'hidden', margin: '6px 0' }}>
              <div style={{ height: '100%', width: `${panelCompletionRate}%`, background: 'var(--success-500)', borderRadius: 'var(--radius-full)', transition: 'width 0.3s' }} />
            </div>
            <div style={{ fontSize: 11, color: 'var(--gray-500)' }}>
              {panelVisitedTotal}/{panelUnitTotal} 세대 · {cardFilter !== '전체' ? getCardName(cards, cardFilter) : '전체 필터'}
            </div>
          </div>
        </div>

        {!canRecordVisits && (
          <div className="record-lock-banner">
            <strong>보기 전용 상태</strong>
            <span>봉사 시작 후 방문 기록을 입력할 수 있습니다.</span>
          </div>
        )}

        <div className="building-accordion-list">
          {panelBuildings.length === 0 && (
            <div className="map-empty-state panel-empty">
              <p>표시할 건물이 없습니다</p>
              <small>필터를 변경하거나 건물을 추가해 주세요</small>
            </div>
          )}
          {panelBuildingGroups.map(({ status, label, buildings: groupedBuildings }) => {
            if (groupedBuildings.length === 0) return null
            const isGroupCollapsed = collapsedStatusGroups.has(status)
            const isHiddenOnMap = hiddenMapStatuses.has(status)
            return (
              <section className={`building-status-group status-${status}${isGroupCollapsed ? ' collapsed' : ''}`} key={status}>
                <button
                  className="building-status-group-head"
                  onClick={() => toggleStatusGroup(status)}
                  type="button"
                >
                  <span className="building-status-title">
                    <i className={`map-dot status-${status}`} />
                    {label}
                  </span>
                  <span className="building-status-meta">
                    {isHiddenOnMap && <em>지도 숨김</em>}
                    <b className="tnum">{groupedBuildings.length}</b>
                    <span>{isGroupCollapsed ? '펼치기' : '접기'}</span>
                  </span>
                </button>
                {!isGroupCollapsed && groupedBuildings.map((building) => {
            const isExpanded = expandedBuildingIds.has(building.id)
            const buildingStatus = getBuildingStatus(building)
            const handledUnits = building.units.filter((unit) => unit.status !== '미방문').length
            const regularUnitCount = building.units.filter((unit) => unit.isRegularVisit).length
            const completion = building.units.length === 0
              ? 0
              : Math.round((handledUnits / building.units.length) * 100)
            const isEditing = building.id === editingBuildingId

            return (
              <article className={`bld-row${isExpanded ? ' bld-expanded' : ''}`} key={building.id} id={`bld-row-${building.id}`}>
                {!isEditing ? (
                  <div className="bld-row-head">
                    <button
                      className="bld-row-head-btn"
                      onClick={() => focusBuildingFromPanel(building)}
                      type="button"
                    >
                      <span className="bld-chevron">{isExpanded ? '▾' : '▸'}</span>
                      <div className="bld-head-text">
                        <strong>{formatDisplayAddress(building.address)}</strong>
                        {building.name && <span className="bld-sub-name">{building.name}</span>}
                      </div>
                      <div className="bld-head-right">
                        <i className={`map-dot status-${buildingStatus}`} />
                        <small>{handledUnits}/{building.units.length} · {completion}%</small>
                        {regularUnitCount > 0 && <b className="bld-regular-badge">정{regularUnitCount}</b>}
                      </div>
                    </button>
                    <button
                      className="bld-edit-btn"
                      onClick={(e) => {
                        e.stopPropagation()
                        setEditingBuildingId(building.id)
                        setEditName(building.name || '')
                        setEditAddress(building.address)
                        setEditType(building.type)
                      }}
                      title="건물 정보 수정"
                      type="button"
                    >⋮</button>
                  </div>
                ) : (
                  <div className="building-edit-mode">
                    <div className="edit-input-group">
                      <input className="modern-edit-address" onChange={(e) => setEditAddress(e.target.value)} placeholder="건물 주소" value={editAddress} />
                      <input className="modern-edit-name" onChange={(e) => setEditName(e.target.value)} placeholder="건물명 (선택)" value={editName} />
                      <select value={editType} onChange={e => setEditType(e.target.value as Building['type'])} style={{ padding: '4px 8px', borderRadius: 'var(--r-sm)', border: '1px solid #e2e8f0', fontSize: '12px', background: '#f8fafc' }}>
                        <option value="주택">주택</option>
                        <option value="상가">상가</option>
                      </select>
                    </div>
                    <div className="edit-action-group">
                      <button className="edit-save-btn" onClick={() => { onUpdateBuilding(building.id, editName.trim(), editAddress.trim(), undefined, undefined, editType); setEditingBuildingId(null) }}>저장</button>
                      <button className="edit-cancel-btn" onClick={() => setEditingBuildingId(null)}>취소</button>
                      <button className="edit-delete-btn" onClick={() => { setPendingDeleteBuildingId(building.id); setShowDeleteBuildingConfirmModal(true) }}>삭제</button>
                    </div>
                  </div>
                )}

                {isExpanded && !isEditing && (
                  <div className="bld-body">
                    <div className="bld-meta">
                      <span>{building.type}</span>
                      <span className="bld-meta-sep">·</span>
                      <span>{getCardName(cards, building.cardId)}</span>
                    </div>

                    <div className={`unit-col-header${getActivePeriodForDate(getLocalDateString()) ? ' with-invitation' : ''}`}>
                      <span>세대 정보</span>
                      {getActivePeriodForDate(getLocalDateString()) && <span style={{ color: '#f59e0b' }}>초대장</span>}
                      <span>만남</span>
                      <span>부재</span>
                      <span>한국</span>
                    </div>

                    {(chineseOnlyFilter || visitResultFilter !== '전체'
                      ? building.units.filter(unitMatchesOperatingFilter)
                      : building.units
                    ).map((unit) => {
                      const unitHistories = visitHistoriesByUnitId.get(unit.id) ?? []
                      const latestHistory = unitHistories[0]
                      const isUnitExpanded = expandedUnitId === unit.id

                      return (
                        <div className={`unit-grid-row${isUnitExpanded ? ' ugr-expanded' : ''}${unit.isRegularVisit ? ' ugr-regular' : ''}`} key={unit.id}>
                          <div className={`unit-grid-main${getActivePeriodForDate(getLocalDateString()) ? ' with-invitation' : ''}`}>
                            <button className="unit-name-btn" onClick={() => setExpandedUnitId(isUnitExpanded ? null : unit.id)} type="button">
                              <span className="unit-chevron">{isUnitExpanded ? '▾' : '▸'}</span>
                              <span className="unit-number-text">{unit.number}</span>
                              {unit.isChinese && <span className="unit-chinese-badge">中</span>}
                              {unit.isForbidden && <span className="unit-forbidden-badge">방문금지</span>}
                              {unit.isRegularVisit && <span className="unit-regular-badge">재방</span>}
                              {latestHistory && (
                                <span className="unit-recent-visit">
                                  [{latestHistory.visitedAt.slice(5).replace('-', '/')} {latestHistory.timeSlot}]
                                </span>
                              )}
                            </button>
                            {getActivePeriodForDate(getLocalDateString()) && (() => {
                              const todayInvitation = unitHistories.find(
                                (h) => h.visitedAt === getLocalDateString() && h.invitationLeft,
                              )
                              return (
                                <button
                                  className={`unit-check-btn unit-check-btn-invitation${todayInvitation ? ' ucb-invitation' : ''}${!canRecordVisits ? ' locked' : ''}`}
                                  onClick={() => {
                                    if (!requireRecordAccess()) return
                                    onToggleInvitationLeft?.(building.id, unit.id)
                                  }}
                                  type="button"
                                  title="초대장 남김 (단독 토글)"
                                >{todayInvitation ? '✓' : ''}</button>
                              )
                            })()}
                            <button
                              className={`unit-check-btn${unit.status === '만남' ? ' ucb-meet' : ''}${!canRecordVisits ? ' locked' : ''}`}
                              onClick={() => {
                                if (!requireRecordAccess()) return
                                unit.status === '만남' ? onUndoLatestVisit(building.id, unit.id) : onQuickLogVisit(building.id, unit.id, '만남')
                              }}
                              type="button"
                            >{unit.status === '만남' ? '✓' : ''}</button>
                            <button
                              className={`unit-check-btn${(unit.status === '부재' && latestHistory?.visitedAt === getLocalDateString()) ? ' ucb-absent' : ''}${!canRecordVisits ? ' locked' : ''}`}
                              onClick={() => {
                                if (!requireRecordAccess()) return
                                ;(unit.status === '부재' && latestHistory?.visitedAt === getLocalDateString()) ? onUndoLatestVisit(building.id, unit.id) : onQuickLogVisit(building.id, unit.id, '부재')
                              }}
                              type="button"
                            >{(unit.status === '부재' && latestHistory?.visitedAt === getLocalDateString()) ? '✓' : ''}</button>
                            <button
                              className={`unit-check-btn${unit.status === '한국인' ? ' ucb-korean' : ''}${!canRecordVisits ? ' locked' : ''}`}
                              onClick={() => {
                                if (!requireRecordAccess()) return
                                unit.status === '한국인' ? onUndoLatestVisit(building.id, unit.id) : onQuickLogVisit(building.id, unit.id, '한국인')
                              }}
                              type="button"
                            >{unit.status === '한국인' ? '✓' : ''}</button>
                          </div>

                          {isUnitExpanded && (
                            <div className="unit-grid-detail">

                              {/* ── 6칸 슬롯 그리드 (중국인 세대만) ── */}
                              {unit.isChinese && (
                                <div style={{ padding: '10px 12px 0' }}>
                                  <UnitSlotGrid
                                    histories={unitHistories}
                                    canRecord={canRecordVisits}
                                    onRecordVisit={async (result) => {
                                      if (!requireRecordAccess()) return
                                      onQuickLogVisit(building.id, unit.id, result)
                                    }}
                                  />
                                </div>
                              )}

                              {/* ── 방문 기록 ── */}
                              <div style={{ padding: '8px 12px', borderBottom: '1px solid #f1f5f9' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: unitHistories.length > 0 ? 6 : 0 }}>
                                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                                  <span style={{ fontSize: 12, color: '#64748b', fontWeight: 600 }}>방문 기록</span>
                                  <button
                                    className="history-add-btn"
                                    onClick={() => openHistoryEditorForAdd(building.id, unit.id)}
                                    style={{ marginLeft: 'auto' }}
                                    type="button"
                                  >+ 기록</button>
                                </div>
                                <div className="ugd-history-stack">
                                  {unitHistories.slice(0, 5).map((history) => {
                                    const isMenuOpen = editingHistoryId === history.id
                                    return (
                                      <div className="history-item-container" key={history.id}>
                                        <button
                                          className={`history-pill result-${history.result}`}
                                          onClick={() => setEditingHistoryId(isMenuOpen ? null : history.id)}
                                          type="button"
                                        >
                                          {history.visitedAt.slice(5).replace('-', '/')} {history.timeSlot}({history.result})
                                        </button>
                                        {isMenuOpen && (
                                          <div className="history-admin-menu">
                                            <button onClick={() => openHistoryEditorForEdit(building.id, history)} type="button">✎ 수정</button>
                                            <button onClick={() => {
                                              if (!requireRecordAccess()) return
                                              if (confirm('이 방문 기록을 삭제할까요?')) {
                                                onDeleteVisitHistory(history.id, unit.id)
                                              }
                                              setEditingHistoryId(null)
                                            }} className="delete" type="button">✕ 삭제</button>
                                          </div>
                                        )}
                                      </div>
                                    )
                                  })}
                                  {unitHistories.length === 0 && <span className="ugd-value" style={{ fontSize: 12, color: '#cbd5e1' }}>기록 없음</span>}
                                </div>
                              </div>

                              {/* ── 토글 + ⋮ 메뉴 ── */}
                              <div style={{ padding: '8px 12px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid #f1f5f9' }}>
                                <div className="ugd-memo-checks">
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
                                      onClick={() => { if (!requireRecordAccess()) return; onToggleRegularVisit(building.id, unit.id) }}
                                      type="button"
                                    >{unit.isRegularVisit ? '✓' : ''}</button>
                                    정기방문
                                  </label>
                                  <label className="ugd-chinese-label">
                                    <button
                                      className={`unit-check-btn ugd-check${unit.isChinese ? ' ucb-chinese' : ''}${!canRecordVisits ? ' locked' : ''}`}
                                      onClick={() => { if (!requireRecordAccess()) return; onToggleChinese(building.id, unit.id) }}
                                      type="button"
                                    >{unit.isChinese ? '✓' : ''}</button>
                                    중국인
                                  </label>
                                </div>
                                <div style={{ position: 'relative' }}>
                                  <button
                                    onClick={() => setUnitDeleteMenuId(unitDeleteMenuId === unit.id ? null : unit.id)}
                                    style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8', padding: '4px 6px', fontSize: 18, lineHeight: 1 }}
                                    type="button"
                                  >⋮</button>
                                  {unitDeleteMenuId === unit.id && (
                                    <div style={{
                                      position: 'absolute', right: 0, top: '100%', zIndex: 100,
                                      background: '#fff', borderRadius: 10, boxShadow: '0 4px 16px rgba(0,0,0,0.12)',
                                      border: '1px solid #f1f5f9', overflow: 'hidden', minWidth: 120,
                                    }}>
                                      <button
                                        onClick={() => {
                                          setUnitDeleteMenuId(null)
                                          if (confirm(`"${unit.number}" 세대 정보를 삭제할까요?`)) {
                                            onDeleteUnit(building.id, unit.id)
                                            setExpandedUnitId(null)
                                          }
                                        }}
                                        style={{ display: 'block', width: '100%', padding: '12px 16px', background: 'none', border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 700, color: 'var(--danger-600)', textAlign: 'left' }}
                                        type="button"
                                      >세대 삭제</button>
                                    </div>
                                  )}
                                </div>
                              </div>

                              {/* ── 메모 (클릭 편집 → 저장/취소) ── */}
                              <div style={{ padding: '8px 12px' }}>
                                {unitMemoEdits[unit.id] !== undefined ? (
                                  <>
                                    <textarea
                                      className="ugd-memo-textarea"
                                      placeholder="메모를 입력하세요..."
                                      rows={3}
                                      autoFocus
                                      value={unitMemoEdits[unit.id] ?? ''}
                                      onChange={(e) => setUnitMemoEdits((prev) => ({ ...prev, [unit.id]: e.target.value }))}
                                      style={{ resize: 'none' }}
                                    />
                                    <div style={{ display: 'flex', gap: 6, marginTop: 6 }}>
                                      <button
                                        onClick={() => {
                                          const val = unitMemoEdits[unit.id] ?? ''
                                          onUpdateUnitFlags(unit.id, { memo: val })
                                          setUnitMemos((prev) => ({ ...prev, [unit.id]: val }))
                                          setUnitMemoEdits((prev) => { const next = { ...prev }; delete next[unit.id]; return next })
                                        }}
                                        style={{ flex: 1, padding: '6px 0', borderRadius: 8, border: 'none', background: '#1e293b', color: '#fff', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}
                                        type="button"
                                      >저장</button>
                                      <button
                                        onClick={() => setUnitMemoEdits((prev) => { const next = { ...prev }; delete next[unit.id]; return next })}
                                        style={{ flex: 1, padding: '6px 0', borderRadius: 8, border: '1px solid #e2e8f0', background: '#fff', color: '#64748b', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}
                                        type="button"
                                      >취소</button>
                                    </div>
                                  </>
                                ) : (
                                  <button
                                    onClick={() => {
                                      if (!canRecordVisits) return
                                      setUnitMemoEdits((prev) => ({ ...prev, [unit.id]: unitMemos[unit.id] ?? (unit.memo || '') }))
                                    }}
                                    style={{
                                      width: '100%', textAlign: 'left', background: '#f8fafc',
                                      border: '1px solid #e2e8f0', borderRadius: 8,
                                      padding: '6px 10px', fontSize: 12, color: (unitMemos[unit.id] ?? unit.memo) ? '#334155' : '#cbd5e1',
                                      cursor: canRecordVisits ? 'pointer' : 'default', whiteSpace: 'pre-wrap', lineHeight: 1.5,
                                    }}
                                    type="button"
                                  >{(unitMemos[unit.id] ?? unit.memo) || '메모를 입력하세요...'}</button>
                                )}
                              </div>
                            </div>
                          )}
                        </div>
                      )
                    })}

                    {addingUnitToBuildingId === building.id ? (
                      <div className="inline-add-unit-form bld-add-unit-form">
                        <input autoFocus placeholder="추가할 호수 (예: 101호)" value={newUnitNumber} onChange={(e) => setNewUnitNumber(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter' && newUnitNumber.trim()) { onAddUnit(building.id, newUnitNumber.trim()); setNewUnitNumber('') } }} />
                        <button disabled={!newUnitNumber.trim()} onClick={() => { onAddUnit(building.id, newUnitNumber.trim()); setNewUnitNumber('') }}>추가</button>
                        <button onClick={() => setAddingUnitToBuildingId(null)} style={{ background: '#f1f5f9', color: 'var(--ink-500)' }}>✕</button>
                      </div>
                    ) : (
                      <button className="bld-add-unit-btn" onClick={() => setAddingUnitToBuildingId(building.id)} type="button">+ 세대 추가</button>
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

        {showAddBuildingModal && (
          <div className="building-add-overlay">
            <div className="building-add-panel">
              <div className="building-add-panel-head">
                <span>건물 추가</span>
                <button
                  type="button"
                  onClick={closeAddBuildingModal}
                  aria-label="닫기"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                    <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                  </svg>
                </button>
              </div>
              <div className="building-add-panel-body">
                {newBuildingLat && (
                  <p className="building-add-coords">
                    {newBuildingLat.toFixed(5)}, {newBuildingLng?.toFixed(5)}
                    {geocodeStatus === 'ok' && <span className="building-add-geocode-ok">주소 자동 입력</span>}
                    {geocoding && <span> 주소 조회 중...</span>}
                  </p>
                )}
                {!newBuildingLat && (
                  <p className="building-add-coords">
                    주소로 추가하거나 지도에서 위치를 클릭할 수 있습니다
                  </p>
                )}
                {geocodeStatus === 'fail' && (
                  <p className="building-add-coords building-add-geocode-fail">
                    주소 좌표를 찾지 못했습니다. 주소를 더 자세히 입력하거나 지도에서 위치를 클릭해 주세요
                  </p>
                )}
                <div className="cal-field">
                  <label>카드</label>
                  <select
                    className="cal-input"
                    value={newBuildingCardId}
                    onChange={(e) => setNewBuildingCardId(Number(e.target.value))}
                  >
                    {cards.map((card) => (
                      <option key={card.id} value={card.id}>{card.name}</option>
                    ))}
                  </select>
                </div>
                <div className="cal-field">
                  <label>건물명 *</label>
                  <input
                    className="cal-input"
                    placeholder="예: 고림 우성빌라 A동"
                    value={newBuildingName}
                    onChange={(e) => setNewBuildingName(e.target.value)}
                    autoFocus
                  />
                </div>
                <div className="cal-field" style={{
                  maxHeight: '160px',
                  display: 'flex',
                  flexDirection: 'column'
                }}>
                  <label>주소</label>
                  <textarea
                    className="cal-input"
                    placeholder="경기 용인시 처인구 고림동"
                    value={newBuildingAddress}
                    rows={2}
                    style={{
                      resize: 'none',
                      fontFamily: 'inherit',
                      fontSize: '13px',
                      padding: '10px 12px'
                    }}
                    onChange={(e) => {
                      setNewBuildingAddress(e.target.value)
                      setNewBuildingLat(null)
                      setNewBuildingLng(null)
                      setGeocodeStatus('idle')
                    }}
                  />
                </div>
                <div className="cal-field">
                  <label>유형</label>
                  <select
                    className="cal-input"
                    value={newBuildingType}
                    onChange={(e) => setNewBuildingType(e.target.value as Building['type'])}
                  >
                    <option value="주택">주택</option>
                    <option value="상가">상가</option>
                  </select>
                </div>
              </div>
              <div className="building-add-panel-foot">
                <button
                  className="cal-cancel-btn"
                  type="button"
                  onClick={closeAddBuildingModal}
                >
                  취소
                </button>
                <button
                  className="cal-save-btn"
                  type="button"
                  disabled={!newBuildingName.trim() || geocoding || (newBuildingLat == null && !newBuildingAddress.trim())}
                  onClick={handleConfirmAddBuilding}
                >
                  {geocoding ? '주소 확인 중...' : newBuildingLat == null ? '위치 확인' : '추가'}
                </button>
              </div>
            </div>
          </div>
        )}

      </aside>
      )}
      {showRegularVisitModal && (
        <div className="modal-overlay" style={{
          position: 'fixed',
          top: 0,
          left: 0,
          width: '100%',
          height: '100%',
          background: 'rgba(0,0,0,0.5)',
          display: 'grid',
          placeItems: 'center',
          zIndex: 2005,
          backdropFilter: 'blur(4px)'
        }}>
          <div className="modal-content" style={{
            background: 'white',
            padding: '24px',
            borderRadius: 'var(--r-lg)',
            width: '320px',
            boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1)'
          }}>
            <h3 style={{ margin: '0 0 16px', fontSize: '18px', fontWeight: 700 }}>정기방문 등록</h3>
            <p style={{ margin: '0 0 12px', fontSize: '14px', color: '#666' }}>정기 방문자의 이름을 입력해 주세요.</p>
            <input
              autoFocus
              className="modal-input"
              onChange={(e) => setRegularVisitorInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && regularVisitorInput.trim()) {
                  onToggleRegularVisit(pendingRegularVisitBuildingId!, pendingRegularVisitUnitId!, regularVisitorInput.trim())
                  setShowRegularVisitModal(false)
                }
              }}
              placeholder="방문자 이름"
              style={{
                width: '100%',
                padding: '12px',
                borderRadius: 'var(--r-md)',
                border: '1px solid #ddd',
                marginBottom: '20px',
                fontSize: '16px'
              }}
              type="text"
              value={regularVisitorInput}
            />
            <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
              <button
                type="button"
                onClick={() => setShowRegularVisitModal(false)}
                style={{ padding: '8px 16px', borderRadius: 'var(--r-md)', border: '1px solid #ddd', background: 'none', cursor: 'pointer' }}
              >
                취소
              </button>
              <button
                type="button"
                disabled={!regularVisitorInput.trim()}
                onClick={() => {
                  if (regularVisitorInput.trim()) {
                    onToggleRegularVisit(pendingRegularVisitBuildingId!, pendingRegularVisitUnitId!, regularVisitorInput.trim())
                    setShowRegularVisitModal(false)
                  }
                }}
                style={{
                  padding: '8px 16px',
                  borderRadius: 'var(--r-md)',
                  background: 'var(--accent-700)',
                  color: 'white',
                  border: 'none',
                  opacity: regularVisitorInput.trim() ? 1 : 0.5,
                  cursor: regularVisitorInput.trim() ? 'pointer' : 'not-allowed'
                }}
              >
                등록
              </button>
            </div>
          </div>
        </div>
      )}
      {/* 정기방문 해제 확인 모달 */}
      {showUnregisterConfirmModal && (
        <div className="modal-overlay" style={{
          position: 'fixed',
          top: 0,
          left: 0,
          width: '100%',
          height: '100%',
          background: 'rgba(0,0,0,0.5)',
          display: 'grid',
          placeItems: 'center',
          zIndex: 2005,
          backdropFilter: 'blur(4px)'
        }}>
          <div className="modal-content" style={{
            background: 'white',
            padding: '24px',
            borderRadius: 'var(--r-lg)',
            width: '320px',
            boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1)'
          }}>
            <h3 style={{ margin: '0 0 16px', fontSize: '18px', fontWeight: 700 }}>정기방문 해제</h3>
            <p style={{ margin: '0 0 20px', fontSize: '15px', color: '#4b5563', lineHeight: '1.5' }}>
              정기방문을 해제하시겠습니까?
            </p>
            <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
              <button
                type="button"
                onClick={() => setShowUnregisterConfirmModal(false)}
                style={{ padding: '8px 16px', borderRadius: 'var(--r-md)', border: '1px solid #ddd', background: 'none', cursor: 'pointer' }}
              >
                취소
              </button>
              <button
                type="button"
                onClick={() => {
                  onToggleRegularVisit(pendingRegularVisitBuildingId!, pendingRegularVisitUnitId!)
                  setShowUnregisterConfirmModal(false)
                }}
                style={{
                  padding: '8px 16px',
                  borderRadius: 'var(--r-md)',
                  background: 'var(--danger-600)',
                  color: 'white',
                  border: 'none',
                  cursor: 'pointer'
                }}
              >
                해제하기
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 건물 삭제 확인 모달 */}
      {showDeleteBuildingConfirmModal && (
        <div className="modal-overlay" style={{
          position: 'fixed',
          top: 0,
          left: 0,
          width: '100%',
          height: '100%',
          background: 'rgba(0,0,0,0.5)',
          display: 'grid',
          placeItems: 'center',
          zIndex: 2010,
          backdropFilter: 'blur(4px)'
        }}>
          <div className="modal-content" style={{
            background: 'white',
            padding: '24px',
            borderRadius: 'var(--r-lg)',
            width: '320px',
            boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1)'
          }}>
            <h3 style={{ margin: '0 0 16px', fontSize: '18px', fontWeight: 700, color: 'var(--danger-600)' }}>건물 삭제</h3>
            <p style={{ margin: '0 0 20px', fontSize: '15px', color: '#4b5563', lineHeight: '1.5' }}>
              정말 이 건물을 삭제하시겠습니까? 모든 호수와 방문 이력이 영구적으로 삭제됩니다.
            </p>
            <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
              <button
                type="button"
                onClick={() => setShowDeleteBuildingConfirmModal(false)}
                style={{ padding: '8px 16px', borderRadius: 'var(--r-md)', border: '1px solid #ddd', background: 'none', cursor: 'pointer' }}
              >
                취소
              </button>
              <button
                type="button"
                onClick={() => {
                  onDeleteBuilding(pendingDeleteBuildingId!)
                  setShowDeleteBuildingConfirmModal(false)
                }}
                style={{
                  padding: '8px 16px',
                  borderRadius: 'var(--r-md)',
                  background: 'var(--danger-600)',
                  color: 'white',
                  border: 'none',
                  cursor: 'pointer'
                }}
              >
                건물 삭제
              </button>
            </div>
          </div>
        </div>
      )}
        </div>
      </div>
      {historyEditor && (
        <div className="admin-modal-overlay">
          <div className="admin-modal-body" style={{ width: '320px' }}>
            <h3>{historyEditor.mode === 'add' ? '방문 기록 추가' : '방문 기록 수정'}</h3>
            <div className="admin-modal-form">
              <label>상태</label>
              <select 
                value={historyEditor.result}
                onChange={e => setHistoryEditor({ ...historyEditor, result: e.target.value as UnitStatus })}
                style={{ width: '100%', padding: '8px', marginBottom: '12px' }}
              >
                <option value="만남">만남</option>
                <option value="부재">부재</option>
                <option value="한국인">한국인</option>
                <option value="거절">거절</option>
                <option value="확인필요">확인 필요</option>
              </select>
              
              <label>시간대</label>
              <select 
                value={historyEditor.timeSlot}
                onChange={e => setHistoryEditor({ ...historyEditor, timeSlot: e.target.value as TimeSlot })}
                style={{ width: '100%', padding: '8px', marginBottom: '12px' }}
              >
                <option value="오전">오전</option>
                <option value="오후">오후</option>
                <option value="저녁">저녁</option>
              </select>

              <label>날짜 (YYYY-MM-DD)</label>
              <input 
                type="date"
                value={historyEditor.visitedAt}
                onChange={e => setHistoryEditor({ ...historyEditor, visitedAt: e.target.value })}
                style={{ width: '100%', padding: '8px', marginBottom: '12px' }}
              />

              <label>메모</label>
              <textarea
                value={historyEditor.memo}
                onChange={e => setHistoryEditor({ ...historyEditor, memo: e.target.value })}
                style={{ width: '100%', padding: '8px', height: '60px', marginBottom: '12px' }}
              />

              {/* 특별봉사 활성 시즌일 때만 표시 */}
              {getActivePeriodForDate(historyEditor.visitedAt) && (
                <div style={{
                  marginTop: '4px',
                  marginBottom: '8px',
                  padding: '10px 12px',
                  background: '#fffbeb',
                  border: '1px solid #fde68a',
                  borderRadius: '8px',
                }}>
                  <div style={{ fontSize: '11px', fontWeight: 700, color: '#92400e', marginBottom: '6px' }}>
                    🟠 {getActivePeriodForDate(historyEditor.visitedAt)?.label}
                  </div>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '13px', fontWeight: 600, color: '#1e293b' }}>
                    <input
                      type="checkbox"
                      checked={historyEditor.invitationLeft ?? false}
                      onChange={(e) => setHistoryEditor({ ...historyEditor, invitationLeft: e.target.checked })}
                      style={{ width: '15px', height: '15px', accentColor: '#f59e0b', cursor: 'pointer' }}
                    />
                    초대장 남김
                  </label>
                </div>
              )}
            </div>
            <div className="admin-modal-footer">
              <button
                onClick={() => setHistoryEditor(null)}
                style={{ background: '#f1f5f9', color: 'var(--ink-500)' }}
              >취소</button>
              <button onClick={saveHistoryEditor}>저장</button>
            </div>
          </div>
        </div>
      )}
    </section>
  )
}
