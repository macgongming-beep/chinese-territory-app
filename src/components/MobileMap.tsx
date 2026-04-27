import { useState, useMemo, useRef, useEffect } from 'react'
import { useSearchParams } from 'react-router-dom'
import { MapCanvas } from './MapCanvas'
import type { Building, BuildingStatus, CardBoundary, Role, ServiceSession, TerritoryCard, TimeSlot, Unit, UnitStatus, VisitHistory } from '../types'
import { getBuildingStatus, findCardForCoordinates } from '../utils/mapUtils'
import { normalizeCardSearch, sortTerritoryCards } from '../utils/cardSearch'
import { showToast } from '../lib/toast'

type StrategyFilter = '전체' | '중국인' | '부재' | '만남'
type NavLevel = 'area' | 'region' | 'card' | 'map'

const strategyFilters: { value: StrategyFilter; label: string }[] = [
  { value: '전체', label: '전체' },
  { value: '중국인', label: '중국인' },
  { value: '부재', label: '부재' },
  { value: '만남', label: '만남' },
]

function getLocalDateString() {
  const date = new Date()
  const month = `${date.getMonth() + 1}`.padStart(2, '0')
  const day = `${date.getDate()}`.padStart(2, '0')
  return `${date.getFullYear()}-${month}-${day}`
}

export function MobileMap({
  buildings,
  cardBoundaries,
  cards,
  currentVisitor,
  actualRole,
  serviceSessions,
  focusedCardId,
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
  visitHistories,
}: {
  buildings: Building[]
  cardBoundaries: CardBoundary[]
  cards: TerritoryCard[]
  currentVisitor: string
  actualRole: Role
  serviceSessions: ServiceSession[]
  focusedCardId?: number | null
  onBack: () => void
  onAddUnit: (buildingId: number, unitNumber: string) => void
  onCreateBuilding: (input: { cardId: number; name: string; address: string; type: Building['type']; lat: number; lng: number }) => void
  onDeleteBuilding: (buildingId: number) => void
  onUpdateBuilding: (buildingId: number, name: string, address: string, lat?: number, lng?: number) => void
  onDeleteUnit: (buildingId: number, unitId: number) => void
  onToggleRegularVisit: (buildingId: number, unitId: number, visitorName?: string) => void
  onToggleChinese: (buildingId: number, unitId: number) => void
  onUndoLatestVisit: (buildingId: number, unitId: number) => void
  onUpdateVisitHistory: (historyId: number, unitId: number, input: { result: UnitStatus; timeSlot: TimeSlot; memo: string; visitedAt: string }) => void
  onDeleteVisitHistory: (historyId: number, unitId: number) => void
  onQuickLogVisit: (buildingId: number, unitId: number, result: UnitStatus) => void
  onUpdateUnitFlags: (unitId: number, flags: Partial<Unit>) => void
  visitHistories: VisitHistory[]
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
        if (status === naver.maps.Service.Status.ERROR) { showToast('주소를 찾을 수 없습니다'); return }
        const result = response?.v2?.addresses?.[0]
        if (result) {
          setVirtualPinLat(parseFloat(result.y))
          setVirtualPinLng(parseFloat(result.x))
        } else {
          showToast('주소를 찾을 수 없습니다')
        }
      })
    }
    tryGeocode()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [addrParam])

  // 내비게이션 상태 머신
  const [navLevel, setNavLevel] = useState<NavLevel>(
    addrParam != null || focusedCardId != null || actualRole === 'user' ? 'map' : 'area'
  )
  const [selectedArea, setSelectedArea] = useState<string | null>(null)
  const [selectedRegion, setSelectedRegion] = useState<string | null>(null)
  const [selectedCardId, setSelectedCardId] = useState<number | null>(
    focusedCardId ?? null
  )
  const [showCardFinder, setShowCardFinder] = useState(false)
  const [cardSearch, setCardSearch] = useState('')

  // 필터
  const [strategyFilter, setStrategyFilter] = useState<StrategyFilter>('전체')
  const [statusFilter, setStatusFilter] = useState<BuildingStatus | '전체'>('전체')

  // 지도/패널 상태
  const [selectedBuildingId, setSelectedBuildingId] = useState<number | null>(null)
  const [expandedBuildingIds, setExpandedBuildingIds] = useState<Set<number>>(new Set())
  const [expandedUnitId, setExpandedUnitId] = useState<number | null>(null)
  const [editingHistoryId, setEditingHistoryId] = useState<number | null>(null)
  const [historyToEdit, setHistoryToEdit] = useState<VisitHistory | null>(null)
  const [unitMemos, setUnitMemos] = useState<Record<number, string>>({})
  const [_absentTimestamps, _setAbsentTimestamps] = useState<Record<number, number>>({})
  const [newUnitNumber, setNewUnitNumber] = useState('101호')
  const [addingUnitToBuildingId, setAddingUnitToBuildingId] = useState<number | null>(null)

  // 건물 수정
  const [editingBuildingId, setEditingBuildingId] = useState<number | null>(null)
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
  const isUserMap = actualRole === 'user'
  const selectedCard = selectedCardId ? cards.find((card) => card.id === selectedCardId) : undefined
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
    showToast('봉사 시작 후 방문 기록을 입력할 수 있습니다.', 'info')
    return false
  }
 
  // 바텀 시트 드래그 및 토글 상태
  const MIN_HEIGHT = 65
  const HALF_HEIGHT = window.innerHeight * 0.46
  const FULL_HEIGHT = window.innerHeight * 0.92
 
  const [sheetHeight, setSheetHeight] = useState(HALF_HEIGHT)
  const [isDragging, setIsDragging] = useState(false)
  const dragStartY = useRef<number>(0)
  const dragStartHeight = useRef<number>(0)

  useEffect(() => {
    document.body.classList.add('mobile-map-scroll-lock')
    return () => {
      document.body.classList.remove('mobile-map-scroll-lock')
    }
  }, [])
 
  const handleTouchStart = (e: React.TouchEvent) => {
    e.preventDefault()
    setIsDragging(true)
    dragStartY.current = e.touches[0].clientY
    dragStartHeight.current = sheetHeight
  }
 
  const handleTouchMove = (e: React.TouchEvent) => {
    if (!isDragging) return
    e.preventDefault()
    const deltaY = dragStartY.current - e.touches[0].clientY
    const newHeight = Math.max(MIN_HEIGHT, Math.min(FULL_HEIGHT, dragStartHeight.current + deltaY))
    setSheetHeight(newHeight)
  }
 
  const handleTouchEnd = (e: React.TouchEvent) => {
    e.preventDefault()
    setIsDragging(false)
    // 전구간 자유 높이 지원 (단, 극단적인 위치만 최소/최대로 보정)
    if (sheetHeight < MIN_HEIGHT + 20) {
      setSheetHeight(MIN_HEIGHT)
    } else if (sheetHeight > FULL_HEIGHT - 20) {
      setSheetHeight(FULL_HEIGHT)
    }
  }
 
  const toggleSheet = () => {
    if (sheetHeight > MIN_HEIGHT + 10) {
      setSheetHeight(MIN_HEIGHT)
    } else {
      setSheetHeight(HALF_HEIGHT)
    }
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

  // focusedCardId로 직접 진입했는지 여부 (뒤로가기 시 외부 네비게이션으로 돌아가기 위함)
  const enteredDirectly = focusedCardId != null

  // 뒤로가기 로직
  function handleBack() {
    if (navLevel === 'area') { onBack(); return }
    if (navLevel === 'region') { setNavLevel('area'); setSelectedArea(null); return }
    if (navLevel === 'card') { setNavLevel('region'); setSelectedRegion(null); return }
    // 직접 진입(홈/구역탭에서 열기)한 경우 → 바로 onBack() 호출
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

  const scopedCards = useMemo(() =>
    cards.filter((card) => {
      if (selectedArea && card.region !== selectedArea) return false
      if (selectedRegion && card.area !== selectedRegion) return false
      return true
    }),
    [cards, selectedArea, selectedRegion]
  )

  const scopedCardIds = useMemo(
    () => new Set(scopedCards.map((card) => card.id)),
    [scopedCards]
  )

  const cardMap = useMemo(() => new Map(cards.map(c => [c.id, c])), [cards])

  const unitMatchesStrategyFilter = (unit: Building['units'][number]) => {
    if (strategyFilter === '전체') return true
    if (strategyFilter === '중국인') return unit.isChinese
    if (strategyFilter === '부재') return unit.status === '부재'
    if (strategyFilter === '만남') return unit.status === '만남'
    return true
  }

  const filteredBuildings = useMemo(() =>
    buildings.filter((b) => {
      if (selectedCardId != null && b.cardId !== selectedCardId) return false
      if (selectedCardId == null && (selectedArea || selectedRegion) && !scopedCardIds.has(b.cardId)) return false
      if (statusFilter !== '전체' && getBuildingStatus(b) !== statusFilter) return false
      if (b.units.length > 0 && !b.units.some(unitMatchesStrategyFilter)) return false
      return true
    }),
    [buildings, selectedCardId, selectedArea, selectedRegion, scopedCardIds, statusFilter, strategyFilter, visitHistories]
  )

  const statusCounts = useMemo(() =>
    filteredBuildings.reduce<Record<BuildingStatus, number>>(
      (acc, b) => { const s = getBuildingStatus(b); return { ...acc, [s]: acc[s] + 1 } },
      { 방문필요: 0, 방문완료: 0, 방문금지: 0, 정기방문: 0 }
    ), [filteredBuildings])

  const unitTotal = useMemo(() => filteredBuildings.reduce((t, b) => t + b.units.length, 0), [filteredBuildings])
  const visitedTotal = useMemo(() => filteredBuildings.reduce((t, b) => t + b.units.filter(u => u.status !== '미방문').length, 0), [filteredBuildings])
  const completionRate = unitTotal === 0 ? 0 : Math.round((visitedTotal / unitTotal) * 100)

  const mapBoundaries = useMemo(() =>
    selectedCardId != null
      ? cardBoundaries.filter(cb => cb.cardId === selectedCardId)
      : (selectedArea || selectedRegion)
        ? cardBoundaries.filter(cb => scopedCardIds.has(cb.cardId))
        : cardBoundaries,
    [selectedCardId, selectedArea, selectedRegion, cardBoundaries, scopedCardIds])

  const drillBreadcrumb = navLevel === 'region'
    ? selectedArea
    : navLevel === 'card'
      ? [selectedArea, selectedRegion].filter(Boolean).join(' › ')
      : ''
  const drillTitle =
    navLevel === 'area' ? '지역 선택'
      : navLevel === 'region' ? '동 선택'
        : navLevel === 'card' ? '카드 선택'
          : ''
  const mapScopeTitle = selectedCardId
    ? selectedCard?.name ?? '선택한 카드'
    : selectedRegion
      ? `${selectedRegion} 전체`
      : selectedArea
        ? `${selectedArea} 전체`
        : '전체 구역'
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
    setAddLat(lat); setAddLng(lng); setAddName('새 건물'); setAddAddress(''); setAddType('주택')
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
    showToast('건물이 추가됐습니다', 'success')
  }

  const openAddBuildingMode = () => {
    setShowMapActionMenu(false)
    setEditingPinMode(false)
    setAddingBuildingMode(true)
    setSheetHeight(MIN_HEIGHT)
    showToast('지도에서 건물을 추가할 위치를 눌러주세요', 'info')
  }

  const toggleEditPinMode = () => {
    const next = !editingPinMode
    setShowMapActionMenu(false)
    setAddingBuildingMode(false)
    setEditingPinMode(next)
    setSheetHeight(MIN_HEIGHT)
    showToast(next ? '핀 위치 수정 모드입니다. 옮길 핀을 드래그하세요' : '핀 위치 수정 모드를 종료했습니다', 'info')
  }

  const editingBuilding = editingBuildingId != null ? buildings.find(b => b.id === editingBuildingId) ?? null : null
  const mapHeaderTitle = activeServiceSession
    ? isViewingActiveCard
      ? `${activeSessionCard?.name ?? '카드 미지정'} 봉사 중`
      : selectedCard
        ? `${selectedCard.name} 탐색 중`
        : '전체 지도 탐색 중'
    : '봉사 중인 카드 없음'
  const mapHeaderSubtitle = activeServiceSession
    ? isViewingActiveCard
      ? `${activeServiceSession.timeSlot} · 이 카드에서 기록 가능`
      : '다른 카드를 보고 있습니다'
    : '봉사 시작 후 기록 가능'

  return (
    <main className="mobile-map-shell">
      {/* 통합 헤더 */}
      <header className="mobile-map-header">
        <button onClick={handleBack} type="button" className="mm-back-btn" aria-label="뒤로">‹</button>
        <div className="mobile-map-header-content">
          <div className="mobile-map-title-row">
            <div className="mobile-map-title-copy">
              {drillBreadcrumb && (
                <p>{drillBreadcrumb}</p>
              )}
              <h1>
                {navLevel !== 'map' && drillTitle}
                {navLevel === 'map' && (isUserMap ? mapHeaderTitle : mapScopeTitle)}
              </h1>
              {navLevel === 'map' && isUserMap && <span>{mapHeaderSubtitle}</span>}
            </div>
            {showScopeAllButton && (
              <button
                className="mm-scope-all-btn"
                onClick={openCurrentScopeMap}
                type="button"
              >
                전체보기
              </button>
            )}
            {navLevel === 'map' && (
              <div className="mobile-map-progress-mini">
                <strong>{completionRate}%</strong>
                <span>{visitedTotal}/{unitTotal}</span>
              </div>
            )}
          </div>
          {navLevel === 'map' && isUserMap && (
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
                  내 봉사 카드
                </button>
              )}
              <button
                className={showCardFinder ? 'active' : ''}
                onClick={() => setShowCardFinder((open) => !open)}
                type="button"
              >
                다른 카드 보기
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
                전체
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
                <div className="mm-drill-item-sub">카드 {areaCardCount(area)}개</div>
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
                <div className="mm-drill-item-sub">카드 {regionCardCount(region)}개</div>
              </div>
              <span className="mm-drill-chevron">›</span>
            </button>
          ))}
        </div>
      )}

      {/* Level 3: 카드 선택 */}
      {navLevel === 'card' && (
        <div className="mm-drill-list">
          {regionCards.map(card => (
            <button
              key={card.id}
              className="mm-drill-item"
              onClick={() => { setSelectedCardId(card.id); setNavLevel('map') }}
              type="button"
            >
              <div className="mm-drill-item-body">
                <div className="mm-drill-item-title">{card.name}</div>
                <div className="mm-drill-item-sub">
                  세대 {card.units}개 · 완료 {card.progress}% · {card.status}
                </div>
              </div>
              <span className="mm-drill-chevron">›</span>
            </button>
          ))}
        </div>
      )}

      {/* Level 4: 지도 화면 */}
      {navLevel === 'map' && (
        <>
          {isUserMap && showCardFinder && (
            <div className="mobile-map-card-finder">
              <input
                autoFocus
                placeholder="카드 검색: 김량장동 4"
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
                  {filteredCardOptions.length === 0 && <span>검색 결과 없음</span>}
                  {filteredCardOptions.length > 0 && <span>검색 결과 {filteredCardOptions.length}개</span>}
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

          <div className="mobile-map-filter-strip">
            {strategyFilters.map(f => (
              <button
                key={f.value}
                onClick={() => setStrategyFilter(f.value)}
                className={strategyFilter === f.value ? 'active' : ''}
                type="button"
              >{f.label}</button>
            ))}
            <select
              value={statusFilter}
              onChange={e => setStatusFilter(e.target.value as BuildingStatus | '전체')}
              className={statusFilter !== '전체' ? 'active' : ''}
            >
              <option value="전체">상태 전체</option>
              <option value="방문필요">방문필요</option>
              <option value="방문완료">방문완료</option>
              <option value="방문금지">방문금지</option>
              <option value="정기방문">정기방문</option>
            </select>
          </div>

          {/* 지도 */}
          <div className="mobile-map-container" style={{ position: 'relative' }}>
            {virtualGeocoding && (
              <div style={{ position: 'absolute', top: 12, left: '50%', transform: 'translateX(-50%)', zIndex: 50, background: 'rgba(0,0,0,0.65)', color: '#fff', fontSize: 12, fontWeight: 600, padding: '6px 14px', borderRadius: 20, pointerEvents: 'none' }}>
                주소 검색 중…
              </div>
            )}
            <MapCanvas
              buildings={filteredBuildings}
              cardBoundaries={mapBoundaries}
              cards={cards}
              selectedCardId={mapSelectedCardId}
              highlightedCardIds={scopedCardIds}
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
                  showToast(`${b.name || b.address} 핀 위치가 저장됐습니다`, 'success')
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
            {showMapActionMenu && (
              <div className="mobile-map-action-popover">
                <button onClick={openAddBuildingMode} type="button">건물 추가</button>
                <button onClick={toggleEditPinMode} type="button">
                  {editingPinMode ? '핀 수정 종료' : '핀 위치 수정'}
                </button>
              </div>
            )}
          </div>

          {(addingBuildingMode || editingPinMode) && (
            <div className={`mobile-map-mode-banner${editingPinMode ? ' edit-pin' : ''}`}>
              <strong>{editingPinMode ? '핀 위치 수정' : '건물 추가'}</strong>
              <button
                onClick={() => {
                  setAddingBuildingMode(false)
                  setEditingPinMode(false)
                }}
                type="button"
              >
                종료
              </button>
            </div>
          )}

          {/* 통계 */}
          <div className="mobile-map-status-strip">
            {Object.entries(statusCounts).map(([status, count]) => (
              <div key={status}>
                <i className={`map-dot status-${status}`} />
                <strong>{count}</strong>
                <span>{status}</span>
              </div>
            ))}
          </div>

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
              onTouchStart={handleTouchStart}
              onTouchMove={handleTouchMove}
              onTouchEnd={handleTouchEnd}
              onClick={toggleSheet}
              style={{ cursor: 'pointer', padding: '10px 0' }}
            />
            <div className="mobile-sheet-summary" onClick={toggleSheet}>
              <span>건물 {filteredBuildings.length}개</span>
              <em>{completionRate}% · {visitedTotal}/{unitTotal} 세대</em>
            </div>

            {!canRecordVisits && (
              <div className="record-lock-banner mobile">
                <strong>보기 전용 상태</strong>
                <span>봉사 시작 후 방문 기록을 입력할 수 있습니다.</span>
              </div>
            )}

            <div className="mobile-sheet-scroll">
              {filteredBuildings.length === 0 && (
                <div style={{ padding: '24px', textAlign: 'center', color: '#94a3b8', fontSize: '14px' }}>
                  <p>표시할 건물이 없습니다</p>
                </div>
              )}

              {filteredBuildings.map((building) => {
                const isExpanded = expandedBuildingIds.has(building.id)
                const buildingStatus = getBuildingStatus(building)
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
                            <i className={`map-dot status-${buildingStatus}`} />
                            <small>{handledUnits}/{building.units.length} · {completion}%</small>
                            {regularUnitCount > 0 && <b className="bld-regular-badge">정{regularUnitCount}</b>}
                          </div>
                        </button>
                        <button
                          className="bld-edit-btn"
                          onClick={() => { setEditingBuildingId(building.id); setEditName(building.name || ''); setEditAddress(building.address); setShowDeleteConfirm(false) }}
                          type="button"
                        >✏️</button>
                      </div>
                    ) : (
                      <div className="building-edit-mode">
                        <div className="edit-input-group">
                          <input className="modern-edit-address" onChange={e => setEditAddress(e.target.value)} placeholder="주소" value={editAddress} />
                          <input className="modern-edit-name" onChange={e => setEditName(e.target.value)} placeholder="건물명 (선택)" value={editName} />
                        </div>
                        <div className="edit-action-group">
                          <button className="edit-save-btn" onClick={() => { onUpdateBuilding(building.id, editName.trim(), editAddress.trim()); setEditingBuildingId(null) }}>저장</button>
                          <button className="edit-cancel-btn" onClick={() => setEditingBuildingId(null)}>취소</button>
                          <button className="edit-delete-btn" onClick={() => setShowDeleteConfirm(true)}>삭제</button>
                        </div>
                      </div>
                    )}

                    {isExpanded && !isEditing && (
                      <div className="bld-body">
                        <div className="unit-col-header">
                          <span>세대 정보</span>
                          <span>만남</span>
                          <span>부재</span>
                          <span>한국</span>
                        </div>

                        {(strategyFilter === '전체'
                          ? building.units
                          : building.units.filter(unitMatchesStrategyFilter)
                        ).map((unit) => {
                          const unitHistories = visitHistories.filter(h => h.unitId === unit.id)
                          const latestHistory = unitHistories[0]
                          const isUnitExpanded = expandedUnitId === unit.id

                          return (
                            <div className={`unit-grid-row${isUnitExpanded ? ' ugr-expanded' : ''}${unit.isRegularVisit ? ' ugr-regular' : ''}`} key={unit.id}>
                              <div className="unit-grid-main">
                                <button className="unit-name-btn" onClick={() => setExpandedUnitId(isUnitExpanded ? null : unit.id)} type="button">
                                  <span className="unit-chevron">{isUnitExpanded ? '▾' : '▸'}</span>
                                  <span className="unit-number-text">{unit.number}</span>
                                  {unit.isChinese && <span className="unit-chinese-badge">中</span>}
                                  {unit.isRegularVisit && <span className="unit-regular-badge">재방</span>}
                                  {latestHistory && (
                                    <span className="unit-recent-visit">
                                      [{latestHistory.visitedAt.slice(5).replace('-', '/')} {latestHistory.timeSlot}]
                                    </span>
                                  )}
                                </button>
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
                                <div className="unit-grid-detail">
                                  <div className="ugd-row">
                                    <span className="ugd-icon">📜</span>
                                    <span className="ugd-label">방문 기록</span>
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
                                              {history.visitedAt.slice(5).replace('-', '/')}({history.result[0]})
                                            </button>
                                            {isMenuOpen && (
                                              <div className="history-admin-menu">
                                                <button onClick={() => {
                                                  if (!requireRecordAccess()) return
                                                  setHistoryToEdit(history)
                                                  setEditingHistoryId(null)
                                                }} type="button">✎ 수정</button>
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
                                      {unitHistories.length === 0 && <span className="ugd-value">기록 없음</span>}
                                    </div>
                                  </div>
                                  <div className="ugd-row">
                                    <span className="ugd-icon">📊</span>
                                    <span className="ugd-label">누적 부재</span>
                                    <span className="ugd-value">
                                      {(() => {
                                        const counts = unitHistories.filter(h => h.result === '부재').reduce((acc, h) => {
                                          acc[h.timeSlot] = (acc[h.timeSlot] || 0) + 1;
                                          return acc;
                                        }, {} as Record<string, number>);
                                        const parts = [];
                                        if (counts['오전']) parts.push(`오전 ${counts['오전']}`);
                                        if (counts['오후']) parts.push(`오후 ${counts['오후']}`);
                                        if (counts['저녁']) parts.push(`저녁 ${counts['저녁']}`);
                                        return parts.length > 0 ? parts.join(', ') : '기록 없음';
                                      })()}
                                    </span>
                                  </div>
                                  <div className="ugd-memo-section">
                                    <div className="ugd-memo-head">
                                      <span>💬 메모</span>
                                      <div className="ugd-memo-checks">
                                        <label className="ugd-chinese-label" style={{ color: unit.isForbidden ? 'var(--danger-600)' : 'inherit' }}>
                                          <button className={`unit-check-btn ugd-check${unit.isForbidden ? ' ucb-forbidden' : ''}${!canRecordVisits ? ' locked' : ''}`}
                                            onClick={() => {
                                              if (!requireRecordAccess()) return
                                              onUpdateUnitFlags(unit.id, { isForbidden: !unit.isForbidden })
                                            }} type="button">
                                            {unit.isForbidden ? '✓' : ''}</button>
                                          방문금지
                                        </label>
                                        <label className="ugd-chinese-label">
                                          <button className={`unit-check-btn ugd-check${unit.isRegularVisit ? ' ucb-regular' : ''}${!canRecordVisits ? ' locked' : ''}`}
                                            onClick={() => {
                                              if (!requireRecordAccess()) return
                                              onToggleRegularVisit(building.id, unit.id)
                                            }} type="button">
                                            {unit.isRegularVisit ? '✓' : ''}</button>
                                          정기방문
                                        </label>
                                        <label className="ugd-chinese-label">
                                          <button className={`unit-check-btn ugd-check${unit.isChinese ? ' ucb-chinese' : ''}${!canRecordVisits ? ' locked' : ''}`}
                                            onClick={() => {
                                              if (!requireRecordAccess()) return
                                              onToggleChinese(building.id, unit.id)
                                            }} type="button">
                                            {unit.isChinese ? '✓' : ''}</button>
                                          중국인
                                        </label>
                                      </div>
                                    </div>
                                    <textarea className="ugd-memo-textarea" placeholder="메모를 입력하세요..."
                                      value={unitMemos[unit.id] ?? (unit.memo || '')}
                                      onChange={e => setUnitMemos(prev => ({ ...prev, [unit.id]: e.target.value }))}
                                      disabled={!canRecordVisits}
                                      onBlur={e => {
                                        if (!canRecordVisits) return
                                        onUpdateUnitFlags(unit.id, { memo: e.target.value })
                                      }} />
                                  </div>
                                    <button onClick={() => { if (confirm(`"${unit.number}" 세대를 삭제할까요?`)) { onDeleteUnit(building.id, unit.id); setExpandedUnitId(null) } }} style={{ marginLeft: 'auto', padding: '4px 10px', fontSize: '11px', minHeight: 'auto', borderRadius: 'var(--r-sm)', background: 'var(--danger-100)', color: 'var(--danger-600)', border: 'none', cursor: 'pointer' }} type="button">세대 삭제</button>
                                </div>
                              )}
                            </div>
                          )
                        })}

                        {addingUnitToBuildingId === building.id ? (
                          <div style={{ padding: '8px 10px', borderTop: '1px dashed #cbd5e1', display: 'flex', gap: '6px' }}>
                            <input autoFocus placeholder="호수 (예: 101호)" value={newUnitNumber} onChange={e => setNewUnitNumber(e.target.value)}
                              onKeyDown={e => { if (e.key === 'Enter' && newUnitNumber.trim()) { onAddUnit(building.id, newUnitNumber.trim()); setNewUnitNumber('') } }}
                              style={{ flex: 1, padding: '6px 8px', border: '1px solid #e2e8f0', borderRadius: 'var(--r-sm)', fontSize: '13px' }} />
                            <button disabled={!newUnitNumber.trim()} onClick={() => { onAddUnit(building.id, newUnitNumber.trim()); setNewUnitNumber('') }}
                              style={{ padding: '6px 12px', background: 'var(--accent-700)', color: '#fff', border: 'none', borderRadius: 'var(--r-sm)', fontWeight: 700, cursor: 'pointer', fontSize: '13px' }}>추가</button>
                            <button onClick={() => setAddingUnitToBuildingId(null)} style={{ padding: '6px 8px', background: '#f1f5f9', border: 'none', borderRadius: 'var(--r-sm)', cursor: 'pointer', color: 'var(--ink-500)', fontSize: '13px' }}>✕</button>
                          </div>
                        ) : (
                          <button className="bld-add-unit-btn" onClick={() => setAddingUnitToBuildingId(building.id)} type="button">+ 세대 추가</button>
                        )}
                      </div>
                    )}
                  </article>
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
                <h3 style={{ margin: '0 0 16px', fontSize: '18px', fontWeight: 700 }}>건물 추가</h3>
                {addLat && <p style={{ margin: '0 0 8px', fontSize: '12px', color: '#94a3b8' }}>{addLat.toFixed(5)}, {addLng?.toFixed(5)} {geocoding ? '· 주소 조회 중...' : ''}</p>}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  <div>
                    <label style={{ fontSize: '12px', fontWeight: 700, color: 'var(--ink-500)', display: 'block', marginBottom: '4px' }}>카드</label>
                    <select value={addCardId} onChange={e => setAddCardId(Number(e.target.value))} style={{ width: '100%', padding: '10px', border: '1px solid #e2e8f0', borderRadius: 'var(--r-md)', fontSize: '14px' }}>
                      {cards.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </select>
                  </div>
                  <div>
                    <label style={{ fontSize: '12px', fontWeight: 700, color: 'var(--ink-500)', display: 'block', marginBottom: '4px' }}>건물명 *</label>
                    <input value={addName} onChange={e => setAddName(e.target.value)} placeholder="예: 삼가동 우성빌라 A동"
                      style={{ width: '100%', padding: '10px', border: '1px solid #e2e8f0', borderRadius: 'var(--r-md)', fontSize: '14px', boxSizing: 'border-box' }} />
                  </div>
                  <div>
                    <label style={{ fontSize: '12px', fontWeight: 700, color: 'var(--ink-500)', display: 'block', marginBottom: '4px' }}>주소</label>
                    <input value={addAddress} onChange={e => setAddAddress(e.target.value)} placeholder="경기 용인시..."
                      style={{ width: '100%', padding: '10px', border: '1px solid #e2e8f0', borderRadius: 'var(--r-md)', fontSize: '14px', boxSizing: 'border-box' }} />
                  </div>
                  <div>
                    <label style={{ fontSize: '12px', fontWeight: 700, color: 'var(--ink-500)', display: 'block', marginBottom: '4px' }}>유형</label>
                    <select value={addType} onChange={e => setAddType(e.target.value as Building['type'])} style={{ width: '100%', padding: '10px', border: '1px solid #e2e8f0', borderRadius: 'var(--r-md)', fontSize: '14px' }}>
                      <option value="주택">주택</option>
                      <option value="상가">상가</option>
                    </select>
                  </div>
                </div>
                <div style={{ display: 'flex', gap: '8px', marginTop: '20px' }}>
                  <button onClick={closeAddModal} style={{ flex: 1, padding: '12px', borderRadius: 'var(--r-md)', border: '1px solid #e2e8f0', background: '#f8fafc', fontWeight: 700, cursor: 'pointer', fontSize: '15px' }}>취소</button>
                  <button onClick={handleConfirmAdd} disabled={!addName.trim()} style={{ flex: 2, padding: '12px', borderRadius: 'var(--r-md)', border: 'none', background: addName.trim() ? 'var(--accent-700)' : '#e2e8f0', color: addName.trim() ? '#fff' : '#94a3b8', fontWeight: 700, cursor: addName.trim() ? 'pointer' : 'not-allowed', fontSize: '15px' }}>추가</button>
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
                    <h3 style={{ margin: '0 0 16px', fontSize: '18px', fontWeight: 700 }}>건물 수정</h3>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                      <div>
                        <label style={{ fontSize: '12px', fontWeight: 700, color: 'var(--ink-500)', display: 'block', marginBottom: '4px' }}>건물명</label>
                        <input value={editName} onChange={e => setEditName(e.target.value)} style={{ width: '100%', padding: '10px', border: '1px solid #e2e8f0', borderRadius: 'var(--r-md)', fontSize: '14px', boxSizing: 'border-box' }} />
                      </div>
                      <div>
                        <label style={{ fontSize: '12px', fontWeight: 700, color: 'var(--ink-500)', display: 'block', marginBottom: '4px' }}>주소</label>
                        <input value={editAddress} onChange={e => setEditAddress(e.target.value)} style={{ width: '100%', padding: '10px', border: '1px solid #e2e8f0', borderRadius: 'var(--r-md)', fontSize: '14px', boxSizing: 'border-box' }} />
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: '8px', marginTop: '20px' }}>
                      <button onClick={() => setShowDeleteConfirm(true)} style={{ padding: '12px 16px', borderRadius: 'var(--r-md)', border: 'none', background: 'var(--danger-100)', color: 'var(--danger-600)', fontWeight: 700, cursor: 'pointer', fontSize: '14px' }}>삭제</button>
                      <button onClick={() => { setEditingBuildingId(null); setShowDeleteConfirm(false) }} style={{ flex: 1, padding: '12px', borderRadius: 'var(--r-md)', border: '1px solid #e2e8f0', background: '#f8fafc', fontWeight: 700, cursor: 'pointer', fontSize: '15px' }}>취소</button>
                      <button onClick={() => { onUpdateBuilding(editingBuilding.id, editName.trim(), editAddress.trim()); setEditingBuildingId(null) }} style={{ flex: 2, padding: '12px', borderRadius: 'var(--r-md)', border: 'none', background: 'var(--accent-700)', color: '#fff', fontWeight: 700, cursor: 'pointer', fontSize: '15px' }}>저장</button>
                    </div>
                  </>
                ) : (
                  <>
                    <h3 style={{ margin: '0 0 12px', fontSize: '18px', fontWeight: 700, color: 'var(--danger-600)' }}>건물 삭제</h3>
                    <p style={{ margin: '0 0 20px', fontSize: '15px', color: '#4b5563', lineHeight: 1.5 }}>정말 삭제할까요? 모든 세대와 방문 이력이 영구 삭제됩니다.</p>
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <button onClick={() => setShowDeleteConfirm(false)} style={{ flex: 1, padding: '12px', borderRadius: 'var(--r-md)', border: '1px solid #e2e8f0', background: '#f8fafc', fontWeight: 700, cursor: 'pointer', fontSize: '15px' }}>취소</button>
                      <button onClick={() => { onDeleteBuilding(editingBuilding.id); setEditingBuildingId(null); setShowDeleteConfirm(false) }} style={{ flex: 2, padding: '12px', borderRadius: 'var(--r-md)', border: 'none', background: 'var(--danger-600)', color: '#fff', fontWeight: 700, cursor: 'pointer', fontSize: '15px' }}>삭제하기</button>
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
            <h3>방문 기록 수정</h3>
            <div className="admin-modal-form">
              <label>상태</label>
              <select 
                value={historyToEdit.result} 
                onChange={e => setHistoryToEdit({ ...historyToEdit, result: e.target.value as any })}
                style={{ width: '100%', padding: '10px', marginBottom: '16px', borderRadius: 'var(--r-md)', border: '1px solid #ddd' }}
              >
                <option value="만남">만남</option>
                <option value="부재">부재</option>
                <option value="한국인">한국인</option>
                <option value="거절">거절</option>
              </select>
              
              <label>시간대</label>
              <select 
                value={historyToEdit.timeSlot} 
                onChange={e => setHistoryToEdit({ ...historyToEdit, timeSlot: e.target.value as any })}
                style={{ width: '100%', padding: '10px', marginBottom: '16px', borderRadius: 'var(--r-md)', border: '1px solid #ddd' }}
              >
                <option value="오전">오전</option>
                <option value="오후">오후</option>
                <option value="저녁">저녁</option>
              </select>

              <label>날짜 (YYYY-MM-DD)</label>
              <input 
                type="text"
                value={historyToEdit.visitedAt}
                onChange={e => setHistoryToEdit({ ...historyToEdit, visitedAt: e.target.value })}
                style={{ width: '100%', padding: '10px', marginBottom: '16px', borderRadius: 'var(--r-md)', border: '1px solid #ddd' }}
              />

              <label>메모</label>
              <textarea 
                value={historyToEdit.memo || ''} 
                onChange={e => setHistoryToEdit({ ...historyToEdit, memo: e.target.value })}
                style={{ width: '100%', padding: '10px', height: '80px', marginBottom: '16px', borderRadius: 'var(--r-md)', border: '1px solid #ddd' }}
              />
            </div>
            <div className="admin-modal-footer">
              <button 
                onClick={() => setHistoryToEdit(null)}
                style={{ background: '#f1f5f9', color: 'var(--ink-500)', padding: '10px 16px', borderRadius: 'var(--r-md)', border: 'none', cursor: 'pointer' }}
              >취소</button>
              <button onClick={() => {
                onUpdateVisitHistory(historyToEdit.id, historyToEdit.unitId, {
                  result: historyToEdit.result,
                  timeSlot: historyToEdit.timeSlot,
                  memo: historyToEdit.memo || '',
                  visitedAt: historyToEdit.visitedAt
                })
                setHistoryToEdit(null)
              }} style={{ background: 'var(--accent-700)', color: '#fff', padding: '10px 16px', borderRadius: 'var(--r-md)', border: 'none', cursor: 'pointer', fontWeight: 700 }}>저장</button>
            </div>
          </div>
        </div>
      )}
    </main>
  )
}
