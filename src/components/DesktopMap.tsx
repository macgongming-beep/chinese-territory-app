/* eslint-disable @typescript-eslint/no-explicit-any -- 네이버 지도 SDK(window.naver)는 공식 TS 타입이 없어 any 사용이 불가피함 */
import { t, type AppLanguage, currentLang } from '../i18n';
import { useEffect, useRef, useState, useMemo } from 'react'
import { MapCanvas } from './MapCanvas'
import type { MapAggregateMarker } from './MapCanvas'
import { SpecialPeriodBanner } from './SpecialPeriodBanner'
import { UnitSlotGrid } from './UnitSlotGrid'
import { getRegionNames } from '../lib/regions'
import type {
  Building,
  BuildingStatus,
  CardBoundary,
  GeoPoint,
  InformalAsset,
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
import { confirmDialog } from '../lib/confirm'
import { getLocalDateString } from '../utils/dateUtils'
import { findActivePeriod } from '../utils/specialPeriod'
import { geocodeQuery } from '../lib/naverGeocode'
import { getCurrentTimeSlot } from '../utils/timeUtils'
import { mergeCardBoundaryPoints } from '../utils/boundaryMerge'
import type { CardMergeUndoSnapshot } from '../hooks/storeMutations/cardBoundaries'
import { msg } from '../lib/msg'

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


export function DesktopMap({
  language,
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
  onMergeCardBoundaries,
  onUndoMergeCardBoundaries,
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
  informalAssets = [],
  onCreateInformalPlace,
  focusedInformalId,
  onSaveInformalShape,
}: {
  language: AppLanguage;
  buildings: Building[]
  /** 비공식 봉사 장소 — 핀이 찍힌 것만 지도에 뜬다 (docs/비공식-봉사-재설계.md) */
  informalAssets?: InformalAsset[]
  /** 비공식 화면에서 '지도에서 보기' 로 들어왔을 때 그 장소로 옮긴다 */
  focusedInformalId?: number | null
  onSaveInformalShape?: (assetId: number, field: 'boundary' | 'route', points: GeoPoint[]) => Promise<boolean>
  onCreateInformalPlace?: (input: {
    name: string; createdBy: string; groupId?: number | null
    lat: number; lng: number; memo?: string; zoom?: number | null
  }) => Promise<boolean>
  boundaryEditRequest?: number
  cardBoundaries: CardBoundary[]
  cards: TerritoryCard[]
  currentVisitor: string
  actualRole: Role
  serviceSessions: ServiceSession[]
  focusedCardId?: number | null
  focusedBuildingId?: number | null
  onAddUnit: (buildingId: number, unitNumber: string | string[]) => void | Promise<boolean | void | number[]>
  onCreateBuilding: (input: {
    cardId: number
    name: string
    address: string
    type: Building['type']
    lat: number
    lng: number
  }) => Promise<boolean | void> | boolean | void
  onDeleteBuilding: (buildingId: number) => void
  onUpdateBuilding: (buildingId: number, name: string, address: string, lat?: number, lng?: number, type?: Building['type'], memo?: string, isChineseHeavy?: boolean) => void
  onDeleteCardBoundary: (cardId: number) => void
  onDeleteUnit: (buildingId: number, unitId: number) => void
  onSaveCardBoundary: (cardId: number, points: GeoPoint[]) => Promise<void> | void
  onMergeCardBoundaries?: (input: {
    targetCardId: number
    sourceCardIds: number[]
    mergedPoints: GeoPoint[]
  }) => Promise<void> | void
  onUndoMergeCardBoundaries?: (snapshot: CardMergeUndoSnapshot) => Promise<void>
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
  onToggleInvitationLeft?: (buildingId: number, unitId: number, mode?: 'direct' | 'door') => void
  onUpdateUnitFlags: (unitId: number, flags: Partial<Unit>) => void
  visitHistories: VisitHistory[]
  specialPeriods?: SpecialPeriod[]
  onSwitchToList?: () => void
}) {
  // 지역 목록·순서는 DB 에서 온다 (lib/regions). 렌더마다 최신 값을 읽는다
  const regionNames = getRegionNames()
  const [cardFilter, setCardFilter] = useState<number | '전체'>('전체')
  const [regionFilter, setRegionFilter] = useState<TerritoryRegion | '전체'>('전체')
  const [areaFilter, setAreaFilter] = useState('전체')
  const [regionAllCards, setRegionAllCards] = useState(false)
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
  const [creatingBuilding, setCreatingBuilding] = useState(false)
  const creatingBuildingRef = useRef(false)
  const [geocodeStatus, setGeocodeStatus] = useState<'idle' | 'ok' | 'fail'>('idle')
  const [addingBuilding, setAddingBuilding] = useState(false)
  // 비공식 봉사 장소 (docs/비공식-봉사-재설계.md)
  const [addingInformal, setAddingInformal] = useState(false)
  // 비공식은 기본으로 감춘다. 호별방문 지도에 섞이면 구역이 안 보인다.
  // 비공식 화면에서 '지도에서 보기' 로 들어온 경우(informalId)에는 켜고 시작한다.
  const [showInformal, setShowInformal] = useState<boolean>(() => Boolean(focusedInformalId))
  const [informalDraft, setInformalDraft] = useState<{ lat: number; lng: number; name: string; memo: string } | null>(null)
  const [savingInformal, setSavingInformal] = useState(false)
  /**
   * 구역선 그리기의 대상. null 이면 구역 카드(기존 동작).
   * 도구는 그대로 쓰고 '어디에 저장하느냐' 만 바꾼다.
   */
  const [informalShapeTarget, setInformalShapeTarget] = useState<
    { assetId: number; field: 'boundary' | 'route' } | null
  >(null)
  const [showMapActionMenu, setShowMapActionMenu] = useState(false)
  const [showBoundaryActionMenu, setShowBoundaryActionMenu] = useState(false)
  const [editingPinMode, setEditingPinMode] = useState(false)
  const [showAddBuildingModal, setShowAddBuildingModal] = useState(false)
  const [newUnitNumber, setNewUnitNumber] = useState('101')
  const [boundaryCardId, setBoundaryCardId] = useState<number>(cards[0]?.id ?? 1)
  const [visibleBoundarySelection, setVisibleBoundarySelection] = useState<number | '전체' | null>('전체')
  const [boundaryMultiSelectMode, setBoundaryMultiSelectMode] = useState(false)
  const [selectedBoundaryCardIds, setSelectedBoundaryCardIds] = useState<Set<number>>(new Set())
  const [mergeTargetCardId, setMergeTargetCardId] = useState<number | null>(null)
  const [showMapMergeModal, setShowMapMergeModal] = useState(false)
  const [mapMergeUndo, setMapMergeUndo] = useState<CardMergeUndoSnapshot | null>(null)
  const [drawingBoundary, setDrawingBoundary] = useState(false)
  const [savingBoundary, setSavingBoundary] = useState(false)
  const [draftBoundaryPoints, setDraftBoundaryPoints] = useState<GeoPoint[]>([])
  const [detailOpen, setDetailOpen] = useState(false)
  const [undoStack, setUndoStack] = useState<GeoPoint[][]>([])
  const [expandedUnitId, setExpandedUnitId] = useState<number | null>(null)
  const [unitDeleteMenuId, setUnitDeleteMenuId] = useState<number | null>(null)
  const [expandedBuildingIds, setExpandedBuildingIds] = useState<Set<number>>(new Set())
  const [collapsedStatusGroups, setCollapsedStatusGroups] = useState<Set<BuildingStatus>>(new Set(['방문완료']))
  const [hiddenMapStatuses, setHiddenMapStatuses] = useState<Set<BuildingStatus>>(new Set())
  const [unitMemos, setUnitMemos] = useState<Record<number, string>>({})
  const [unitMemoEdits, setUnitMemoEdits] = useState<Record<number, string | undefined>>({})
  const [_absentTimestamps, _setAbsentTimestamps] = useState<Record<number, number>>({})
  // 초대장 팝업: 어떤 unitId에 팝업이 열려있는지
  const [invitationPopupUnitId, setInvitationPopupUnitId] = useState<number | null>(null)
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
    showToast(t(language, 'map.viewOnlyDesc'), 'info')
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
      showToast(msg('구역 "{v1}" 자동 선택됨', { v1: matchedCard?.name ?? matchedCardId }), 'success')
    } else {
      if (unassignedCard) {
        setNewBuildingCardId(unassignedCard.id)
        showToast(msg('구역선 밖입니다. "미배정 건물" 카드로 설정됩니다.'), 'info')
      } else {
        showToast(msg('구역선 밖입니다. 카드를 수동으로 선택해 주세요.'), 'info')
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

  const informalPins = useMemo(
    () => (!showInformal ? [] : informalAssets)
      .filter((a) => typeof a.lat === 'number' && typeof a.lng === 'number')
      .map((a) => ({ id: a.id, name: a.name, lat: a.lat as number, lng: a.lng as number })),
    [informalAssets, showInformal],
  )

  const informalDraftModal = informalDraft ? (
    <div className="cal-modal-backdrop" onClick={() => setInformalDraft(null)}>
      <div className="cal-modal" style={{ maxWidth: 380 }} onClick={(e) => e.stopPropagation()}>
        <div className="cal-modal-head">
          <div className="cal-modal-title"><h2>비공식 봉사 장소</h2></div>
          <button className="cal-modal-close" onClick={() => setInformalDraft(null)} type="button">×</button>
        </div>
        <div className="cal-modal-body">
          <div className="cal-field">
            <label>이름</label>
            <input
              autoFocus
              className="cal-input"
              placeholder="예: 명지대(함박관)"
              value={informalDraft.name}
              onChange={(e) => setInformalDraft({ ...informalDraft, name: e.target.value })}
            />
          </div>
          <div className="cal-field">
            <label>메모</label>
            <textarea
              className="cal-input"
              placeholder="1층 카페 앞. 점심때 사람 많음"
              rows={3}
              value={informalDraft.memo}
              onChange={(e) => setInformalDraft({ ...informalDraft, memo: e.target.value })}
            />
            <p style={{ margin: '6px 0 0', fontSize: 12.5, color: 'var(--muted)', lineHeight: 1.6 }}>
              사진보다 이런 메모가 실제로 도움이 됩니다. 어디로 들어가는지, 언제 사람이 많은지.
            </p>
          </div>
        </div>
        <div className="cal-modal-foot">
          <button className="cal-cancel-btn" onClick={() => setInformalDraft(null)} type="button">취소</button>
          <button
            className="cal-save-btn"
            disabled={savingInformal || !informalDraft.name.trim()}
            onClick={() => void saveInformalDraft()}
            type="button"
          >
            {savingInformal ? '저장 중…' : '저장'}
          </button>
        </div>
      </div>
    </div>
  ) : null

  const selectedInformal = useMemo(
    () => (focusedInformalId ? informalAssets.find((a) => a.id === focusedInformalId) ?? null : null),
    [focusedInformalId, informalAssets],
  )

  // 그리는 중에는 원본 대신 지금 찍고 있는 점을 보여 준다
  const informalShape = useMemo(() => {
    if (!selectedInformal || !showInformal) return null
    if (informalShapeTarget?.assetId === selectedInformal.id) {
      return informalShapeTarget.field === 'boundary'
        ? { boundary: draftBoundaryPoints, route: selectedInformal.route }
        : { boundary: selectedInformal.boundary, route: draftBoundaryPoints }
    }
    return { boundary: selectedInformal.boundary, route: selectedInformal.route }
  }, [selectedInformal, showInformal, informalShapeTarget, draftBoundaryPoints])

  const informalFocusPoint = useMemo(() => {
    if (!focusedInformalId) return null
    const place = informalAssets.find((a) => a.id === focusedInformalId)
    if (!place || typeof place.lat !== 'number' || typeof place.lng !== 'number') return null
    return { lat: place.lat, lng: place.lng, zoom: place.zoom ?? null }
  }, [focusedInformalId, informalAssets])

  const handleMapClick = (lat: number, lng: number) => {
    // 비공식 추가 중이면 그쪽이 우선이다. 두 모드가 동시에 켜지지 않게 서로 끈다.
    if (addingInformal) {
      setAddingInformal(false)
      setInformalDraft({ lat, lng, name: '', memo: '' })
      return
    }
    openAddBuildingAt(lat, lng)
  }

  const openAddInformalMode = () => {
    setShowMapActionMenu(false)
    setEditingPinMode(false)
    setAddingBuilding(false)
    setAddingInformal(true)
    setShowInformal(true)
    showToast(msg('지도에서 비공식 봉사 장소를 누르세요'), 'info')
  }

  const saveInformalDraft = async () => {
    if (!informalDraft || !onCreateInformalPlace || savingInformal) return
    if (!informalDraft.name.trim()) return
    setSavingInformal(true)
    const ok = await onCreateInformalPlace({
      name: informalDraft.name,
      createdBy: currentVisitor,
      lat: informalDraft.lat,
      lng: informalDraft.lng,
      memo: informalDraft.memo,
    })
    setSavingInformal(false)
    if (ok) setInformalDraft(null)
  }

  const openAddBuildingMode = () => {
    setShowMapActionMenu(false)
    setEditingPinMode(false)
    setAddingBuilding(true)
    showToast(msg('지도에서 건물을 추가할 위치를 눌러주세요'), 'info')
  }

  const toggleEditPinMode = () => {
    const next = !editingPinMode
    setShowMapActionMenu(false)
    setAddingBuilding(false)
    setEditingPinMode(next)
    showToast(next ? '핀 위치 수정 모드입니다. 옮길 핀을 드래그하세요' : '핀 위치 수정 모드를 종료했습니다', 'info')
  }


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
      geocodeQuery(building.address).then((coordinates) => {
        if (!coordinates) return
        onUpdateBuilding(building.id, building.name, building.address, coordinates.lat, coordinates.lng, building.type)
        showToast(msg('"{v1}" 좌표를 주소로 보정했습니다', { v1: building.name || building.address }), 'success')
      })
    })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [buildings, coordinateRepairTick])

  const revealAddedBuildingCard = (cardId: number) => {
    const card = cards.find((item) => item.id === cardId)
    if (card) {
      setRegionFilter(
        regionNames.includes(card.region as TerritoryRegion)
          ? (card.region as TerritoryRegion)
          : '전체',
      )
      setAreaFilter(card.area)
    }
    setRegionAllCards(false)
    setCardFilter(cardId)
    setBoundaryCardId(cardId)
    setVisibleBoundarySelection(cardId)
    setTargetTypeFilter('전체')
    setStatusFilter('전체')
    setChineseOnlyFilter(false)
    setVisitResultFilter('전체')
  }

  const handleConfirmAddBuilding = async () => {
    if (!newBuildingName.trim() || creatingBuildingRef.current) return

    // 좌표 있음 → 바로 건물 생성
    if (newBuildingLat != null && newBuildingLng != null) {
      const matchedCardId = findCardForCoordinates(newBuildingLat, newBuildingLng, cardBoundaries)
      const targetCardId = matchedCardId ?? unassignedCard?.id ?? newBuildingCardId
      creatingBuildingRef.current = true
      setCreatingBuilding(true)
      try {
        const created = await onCreateBuilding({
          cardId: targetCardId,
          name: newBuildingName.trim(),
          address: newBuildingAddress.trim(),
          type: newBuildingType,
          lat: newBuildingLat,
          lng: newBuildingLng,
        })
        if (created === false) return

        setNewBuildingCardId(targetCardId)
        revealAddedBuildingCard(targetCardId)
        if (matchedCardId) {
          const matchedCard = cards.find((card) => card.id === matchedCardId)
          showToast(msg('구역 "{v1}" 카드에 자동 배정됐습니다', { v1: matchedCard?.name }), 'success')
        } else if (unassignedCard) {
          showToast(msg('구역선 밖 — "미배정 건물" 카드에 배정됐습니다'), 'info')
        }
        closeAddBuildingModal()
      } finally {
        creatingBuildingRef.current = false
        setCreatingBuilding(false)
      }
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
              showToast(msg('지도에서 위치를 확인 후 추가하세요 (구역: "{v1}")', { v1: matchedCard?.name }), 'info')
            } else {
              showToast(msg('지도에서 위치를 확인 후 추가를 누르세요'), 'info')
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
    // eslint-disable-next-line react-hooks/exhaustive-deps -- cardMatchesStructureFilters는 regionFilter/areaFilter만 참조(이미 포함)
    [cards, regionFilter, areaFilter]
  );
  // 카드 정렬: 대권역 순서 + 미배정 마지막
  const orderedCards = useMemo(() => {
    const regionOrder = new Map<TerritoryRegion, number>();
    regionNames.forEach((r, i) => regionOrder.set(r, i));
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
  }, [structureFilteredCards, regionNames]);

  // 필터링된 카드 ID 세트 (하이라이트용)
  const highlightedCardIds = useMemo(() => new Set(orderedCards.map((c) => c.id)), [orderedCards])

  // 구/동 드릴다운용 파생 데이터
  const regionCardCounts = useMemo(() => {
    const map = new Map<string, number>()
    for (const c of cards) map.set(c.region, (map.get(c.region) ?? 0) + 1)
    return map
  }, [cards])

  const dongList = useMemo(() => {
    if (regionFilter === '전체') return []
    const areas = cards.filter((c) => c.region === regionFilter).map((c) => c.area)
    const unique = Array.from(new Set(areas))
    return unique.sort((a, b) => a.localeCompare(b, 'ko'))
  }, [cards, regionFilter])

  const dongCardCounts = useMemo(() => {
    const map = new Map<string, number>()
    for (const c of cards) {
      if (c.region === regionFilter) map.set(c.area, (map.get(c.area) ?? 0) + 1)
    }
    return map
  }, [cards, regionFilter])

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
    // eslint-disable-next-line react-hooks/exhaustive-deps -- 필터 함수는 이미 포함된 필터 state만 참조함
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
    // eslint-disable-next-line react-hooks/exhaustive-deps -- 필터 함수는 이미 포함된 필터 state만 참조함
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

  // 집계 마커 (항상 동 단위) — 동 미선택 + 카드 미선택 + 그리기 모드 X 일 때 활성
  // 구 단위 클러스터는 건너뜀 — 처음부터 동별 묶음을 보고, 동 클릭 시 개별 마커
  // 카드·동 미선택 시 집계 마커 사용 (구 선택 여부와 무관)
  const shouldUseAggregateMap =
    cardFilter === '전체' &&
    areaFilter === '전체' &&
    !focusedBuildingId &&
    !drawingBoundary &&
    !addingBuilding &&
    !editingPinMode

  const mapAggregateMarkers = useMemo<MapAggregateMarker[]>(() => {
    if (!shouldUseAggregateMap) return []
    type Acc = MapAggregateMarker & { latSum: number; lngSum: number; pointCount: number }
    const groups = new Map<string, Acc>()

    // 구 미선택 → 구 단위 집계 (건물 전체를 처리하지 않고 buildings 전체를 사용하면 무거우므로
    //   contextBuildings 대신 buildings를 직접 순회하되 구 단위라 마커 수가 5~6개로 매우 적음)
    if (regionFilter === '전체') {
      buildings.forEach((building) => {
        const card = cardMap.get(building.cardId)
        if (!card) return
        const region = String(card.region)
        if (!region) return
        const id = `region:${region}`
        const current = groups.get(id) ?? {
          id, label: region,
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
    } else {
      // 구 선택 → 동 단위 집계 (해당 구 건물만)
      mapBuildings.forEach((building) => {
        const card = cardMap.get(building.cardId)
        if (!card) return
        const region = String(card.region)
        const area = card.area
        if (!area) return
        const id = `area:${region}::${area}`
        const current = groups.get(id) ?? {
          id, label: area,
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
    }

    return Array.from(groups.values())
      .filter((g) => g.pointCount > 0)
      .map((g) => ({
        id: g.id, label: g.label,
        count: g.count, unitCount: g.unitCount,
        houseCount: g.houseCount, shopCount: g.shopCount,
        lat: g.latSum / g.pointCount, lng: g.lngSum / g.pointCount,
      }))
      .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label, 'ko'))
  }, [buildings, mapBuildings, cardMap, shouldUseAggregateMap, regionFilter])

  const aggregateMapBuildings = shouldUseAggregateMap ? [] : mapBuildings

  const handleSelectAggregateMarker = (id: string) => {
    if (id.startsWith('region:')) {
      // 구 클릭 → 구 선택 (동 목록으로 이동)
      const region = id.replace('region:', '')
      setRegionFilter(region as TerritoryRegion | '전체')
      setAreaFilter('전체')
      setRegionAllCards(false)
      setCardFilter('전체')
      setDetailOpen(false)
    } else {
      // 동 클릭 → 구+동 동시 설정 → 개별 마커
      const m = id.match(/^area:(.+?)::(.+)$/)
      if (!m) return
      const [, region, area] = m
      setRegionFilter(region as TerritoryRegion | '전체')
      setAreaFilter(area)
      setRegionAllCards(false)
      setCardFilter('전체')
      setDetailOpen(false)
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
      regionNames.includes(focusedCard.region as TerritoryRegion)
        ? (focusedCard.region as TerritoryRegion)
        : '전체',
    )
    setAreaFilter(focusedCard.area)
    setRegionAllCards(false)
    setTargetTypeFilter('전체')
    setCardFilter(focusedCardId)
    setBoundaryCardId(focusedCardId)
    setVisibleBoundarySelection(focusedCardId)
  }, [cards, focusedCardId, regionNames])

  useEffect(() => {
    if (!focusedBuildingId) return
    const focusedBuilding = buildings.find((building) => building.id === focusedBuildingId)
    if (!focusedBuilding) return
    const focusedCard = cards.find((card) => card.id === focusedBuilding.cardId)

    if (focusedCard) {
      setRegionFilter(
        regionNames.includes(focusedCard.region as TerritoryRegion)
          ? (focusedCard.region as TerritoryRegion)
          : '전체',
      )
      setAreaFilter(focusedCard.area)
      setRegionAllCards(false)
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
    setDetailOpen(true)  // 하단 패널 자동 열기

    window.setTimeout(() => {
      document.getElementById(`bld-row-${focusedBuilding.id}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' })
    }, 120)
  }, [buildings, cards, focusedBuildingId, regionNames])

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
  const selectedBoundaryCards = useMemo(
    () => cards.filter((card) => selectedBoundaryCardIds.has(card.id)),
    [cards, selectedBoundaryCardIds],
  )

  const handleStartBoundaryDrawing = () => {
    setShowBoundaryActionMenu(false)
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
    if (informalShapeTarget && onSaveInformalShape) {
      await onSaveInformalShape(informalShapeTarget.assetId, informalShapeTarget.field, draftBoundaryPoints)
      setInformalShapeTarget(null)
    } else {
      await onSaveCardBoundary(boundaryCardId, draftBoundaryPoints)
    }
    setSavingBoundary(false)
    setDrawingBoundary(false)
    setDraftBoundaryPoints([])
    setUndoStack([])
  }

  /** 비공식 장소의 구역선·동선 그리기 시작. 도구는 구역 카드와 같은 것을 쓴다 */
  const startInformalShapeDrawing = (field: 'boundary' | 'route') => {
    if (!selectedInformal) return
    setShowMapActionMenu(false)
    setShowInformal(true)
    setInformalShapeTarget({ assetId: selectedInformal.id, field })
    setDraftBoundaryPoints((field === 'boundary' ? selectedInformal.boundary : selectedInformal.route) ?? [])
    setUndoStack([])
    setDrawingBoundary(true)
  }

  const handleSelectCardForMap = (cardId: number) => {
    if (drawingBoundary) return
    if (boundaryMultiSelectMode) {
      setSelectedBoundaryCardIds((current) => {
        const next = new Set(current)
        if (next.has(cardId)) next.delete(cardId)
        else next.add(cardId)
        return next
      })
      setBoundaryCardId(cardId)
      setVisibleBoundarySelection('전체')
      setDrawingBoundary(false)
      setDraftBoundaryPoints([])
      setUndoStack([])
      return
    }
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
      setDetailOpen(false)
      return
    }
    setDetailOpen(true)
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
    const latLng = new naver.maps.LatLng(lat, lng)
    if (map.getZoom() >= 16) {
      map.panTo(latLng)
    } else {
      map.morph(latLng, 17)
    }
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
  const getActivePeriodForDate = (dateStr: string): SpecialPeriod | null =>
    findActivePeriod(specialPeriods, dateStr)

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

  const toggleBoundaryMultiSelectMode = () => {
    setShowBoundaryActionMenu(false)
    setBoundaryMultiSelectMode((current) => {
      const next = !current
      if (next) {
        const seed = typeof visibleBoundarySelection === 'number' ? visibleBoundarySelection : boundaryCardId
        setSelectedBoundaryCardIds(seed ? new Set([seed]) : new Set())
        setMergeTargetCardId(seed || null)
        setVisibleBoundarySelection('전체')
        setCardFilter('전체')
        setDrawingBoundary(false)
      } else {
        setSelectedBoundaryCardIds(new Set())
        setMergeTargetCardId(null)
      }
      return next
    })
  }

  const openMapMergeModal = () => {
    if (!onMergeCardBoundaries) return
    if (selectedBoundaryCardIds.size < 2) {
      showToast(msg('병합할 구역 카드를 2개 이상 선택해 주세요.'), 'error')
      return
    }
    const firstWithBoundary = Array.from(selectedBoundaryCardIds).find((id) => boundariesByCardId.has(id))
    setMergeTargetCardId(firstWithBoundary ?? Array.from(selectedBoundaryCardIds)[0] ?? null)
    setShowMapMergeModal(true)
  }

  const applyMapBoundaryMerge = async () => {
    if (!onMergeCardBoundaries || !mergeTargetCardId) return
    const selectedIds = Array.from(selectedBoundaryCardIds)
    const targetCard = cardMap.get(mergeTargetCardId)
    if (!targetCard || selectedIds.length < 2) return

    const selectedBoundaries = selectedIds
      .map((id) => boundariesByCardId.get(id))
      .filter((boundary): boundary is CardBoundary => Boolean(boundary))
    if (selectedBoundaries.length < 2) {
      showToast(msg('구역선이 있는 카드를 2개 이상 선택해야 병합할 수 있습니다.'), 'error')
      return
    }

    const mergeResult = mergeCardBoundaryPoints(selectedBoundaries)
    if (!mergeResult || mergeResult.points.length < 3) {
      showToast(msg('선택한 구역선을 병합하지 못했습니다.'), 'error')
      return
    }

    const confirmed = await confirmDialog({
      message: msg('{name} 카드로 {length}개 카드의 건물과 구역선을 합칠까요?\n', { name: targetCard.name, length: selectedIds.length }) +
        '원본 카드는 남기고, 원본 카드의 구역선만 비워집니다.\n병합 후 되돌리기 버튼으로 취소할 수 있습니다.',
    })
    if (!confirmed) return

    const allMergeIds = [mergeTargetCardId, ...selectedIds.filter((id) => id !== mergeTargetCardId)]
    const undoBoundaries = allMergeIds.map((id) => ({
      cardId: id,
      points: cardBoundaries.find((b) => b.cardId === id)?.points ?? null,
    }))
    const undoBuildingCards = buildings
      .filter((b) => allMergeIds.includes(b.cardId))
      .map((b) => ({ buildingId: b.id, cardId: b.cardId }))

    await Promise.resolve(onMergeCardBoundaries({
      targetCardId: mergeTargetCardId,
      sourceCardIds: selectedIds.filter((id) => id !== mergeTargetCardId),
      mergedPoints: mergeResult.points,
    }))
    setMapMergeUndo({ boundaries: undoBoundaries, buildingCards: undoBuildingCards, targetCardName: targetCard.name })
    setShowMapMergeModal(false)
    setBoundaryMultiSelectMode(false)
    setSelectedBoundaryCardIds(new Set())
    setBoundaryCardId(mergeTargetCardId)
    setVisibleBoundarySelection(mergeTargetCardId)
    setCardFilter(mergeTargetCardId)
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
      {mapMergeUndo && (
        <div style={{
          position: 'fixed', bottom: 80, left: '50%', transform: 'translateX(-50%)',
          zIndex: 900, display: 'flex', alignItems: 'center', gap: 12,
          background: 'var(--gray-900)', color: '#fff', borderRadius: 12,
          padding: '12px 20px', boxShadow: '0 4px 20px rgba(0,0,0,.3)',
          fontSize: 14, whiteSpace: 'nowrap',
        }}>
          <span>"{mapMergeUndo.targetCardName}" 카드로 병합 완료</span>
          <button
            onClick={async () => {
              if (!onUndoMergeCardBoundaries) return
              await onUndoMergeCardBoundaries(mapMergeUndo)
              setMapMergeUndo(null)
            }}
            style={{ background: 'var(--primary-500)', color: '#fff', border: 'none', borderRadius: 8, padding: '6px 14px', fontWeight: 700, cursor: 'pointer', fontSize: 13 }}
            type="button"
          >
            병합 취소
          </button>
          <button
            onClick={() => setMapMergeUndo(null)}
            style={{ background: 'none', border: 'none', color: 'var(--gray-400)', cursor: 'pointer', fontSize: 18, lineHeight: 1, padding: '0 2px' }}
            type="button"
            aria-label="닫기"
          >×</button>
        </div>
      )}

      {showMapMergeModal && (
        <div className="cal-modal-backdrop" onClick={() => setShowMapMergeModal(false)}>
          <div className="cal-modal merge-name-modal" style={{ maxWidth: '520px' }} onClick={(e) => e.stopPropagation()}>
            <div className="cal-modal-head">
              <div className="cal-modal-title">
                <h2>지도에서 구역 병합</h2>
                <p className="merge-name-modal-sub">지도에서 선택한 카드의 건물과 구역선을 기준 카드로 합칩니다.</p>
              </div>
            </div>
            <div className="cal-modal-body">
              <label className="merge-name-field">
                <span>기준 카드</span>
                <select
                  value={mergeTargetCardId ?? ''}
                  onChange={(event) => setMergeTargetCardId(Number(event.target.value))}
                >
                  {selectedBoundaryCards.map((card) => (
                    <option key={card.id} value={card.id}>{card.name}</option>
                  ))}
                </select>
              </label>
              <div className="merge-name-list">
                {selectedBoundaryCards.map((card) => {
                  const buildingCount = buildingsByCardId.get(card.id)?.length ?? 0
                  const hasBoundary = boundariesByCardId.has(card.id)
                  return (
                    <div className="merge-name-row" key={card.id}>
                      <div>
                        <strong>{card.name}</strong>
                        <span>{card.region} · {card.area} · 건물 {buildingCount}개</span>
                      </div>
                      <em>{card.id === mergeTargetCardId ? '기준' : hasBoundary ? '병합' : '구역선 없음'}</em>
                    </div>
                  )
                })}
              </div>
            </div>
            <div className="cal-modal-foot">
              <button className="cal-cancel-btn" onClick={() => setShowMapMergeModal(false)} type="button">{t(language, 'map.cancel')}</button>
              <button className="cal-save-btn" onClick={applyMapBoundaryMerge} type="button">병합 실행</button>
            </div>
          </div>
        </div>
      )}
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
                {regionNames.map((r) => renderChip(r, r, regionCounts.get(r) ?? 0))}
              </>
            )
          })()}
        </div>
        <div className="map-toolbar" aria-label="지도 필터">
          {/* 건물 유형 segment */}
          <div className="map-toolbar-item">
            <span className="map-toolbar-label">{t(language, 'map.buildings')}</span>
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
            <span className="map-toolbar-label">{t(language, 'map.status')}</span>
            <div className="map-toolbar-seg">
              {([
                { key: '전체', label: '전체' },
                { key: '중국인', label: t(language, 'map.chinese') },
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
            <div className="map-boundary-action-wrap">
              {boundaryMultiSelectMode ? (
                <>
                  <button className="tbl-ghost-btn" onClick={() => setSelectedBoundaryCardIds(new Set())} disabled={selectedBoundaryCardIds.size === 0} type="button">
                    선택 해제
                  </button>
                  <button className="tbl-primary-btn" onClick={openMapMergeModal} disabled={selectedBoundaryCardIds.size < 2} type="button">
                    구역 병합{selectedBoundaryCardIds.size > 1 ? ` ${selectedBoundaryCardIds.size}` : ''}
                  </button>
                  <button className="tbl-ghost-btn" onClick={toggleBoundaryMultiSelectMode} type="button">완료</button>
                </>
              ) : (
                <button
                  aria-label="구역선 작업"
                  className="tbl-toolbar-btn"
                  onClick={() => setShowBoundaryActionMenu((open) => !open)}
                  type="button"
                >
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="1" /><circle cx="19" cy="12" r="1" /><circle cx="5" cy="12" r="1" />
                  </svg>
                </button>
              )}
              {showBoundaryActionMenu && !boundaryMultiSelectMode && (
                <div className="map-boundary-action-popover">
                  <button onClick={handleStartBoundaryDrawing} disabled={drawingBoundary} type="button">
                    {savedBoundary ? '구역선 변경' : '구역선 그리기'}
                  </button>
                  <button onClick={toggleBoundaryMultiSelectMode} type="button">
                    카드 다중 선택
                  </button>
                  <button onClick={openMapMergeModal} disabled={selectedBoundaryCardIds.size < 2 || !onMergeCardBoundaries} type="button">
                    구역 병합
                  </button>
                  {savedBoundary && (
                    <button
                      className="danger"
                      disabled={drawingBoundary}
                      onClick={async () => {
                        setShowBoundaryActionMenu(false)
                        if (await confirmDialog({ message: msg('{v1} 구역선을 삭제할까요?', { v1: selectedBoundaryCard?.name ?? '선택 카드' }), danger: true, confirmLabel: '삭제' })) {
                          handleDeleteBoundary(boundaryCardId)
                        }
                      }}
                      type="button"
                    >
                      구역선 삭제
                    </button>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        <div className="map-workspace">
          <aside className="map-card-panel" aria-label="지도 카드 목록">
            {/* 패널 헤더 */}
            <div className="map-card-panel-head">
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
                {regionFilter !== '전체' && (
                  <button
                    type="button"
                    onClick={() => {
                      if (areaFilter !== '전체') { setAreaFilter('전체'); setRegionAllCards(false); setCardFilter('전체'); setDetailOpen(false) }
                      else if (regionAllCards) { setRegionAllCards(false); setCardFilter('전체'); setDetailOpen(false) }
                      else { setRegionFilter('전체'); setAreaFilter('전체'); setRegionAllCards(false); setCardFilter('전체'); setDetailOpen(false) }
                    }}
                    style={{ width: 28, height: 28, borderRadius: 8, border: '1px solid var(--border-default)', background: 'var(--gray-50)', color: 'var(--gray-700)', fontSize: 18, lineHeight: 1, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}
                  >‹</button>
                )}
                <div style={{ minWidth: 0 }}>
                  <p style={{ margin: 0, fontSize: 11, fontWeight: 600, color: 'var(--gray-500)', textTransform: 'uppercase', letterSpacing: '0.04em', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {regionFilter === '전체' ? '구역 카드' : (areaFilter !== '전체') ? `${regionFilter} · ${areaFilter}` : regionFilter}
                  </p>
                  <strong style={{ fontSize: 15, fontWeight: 700, color: 'var(--gray-900)', lineHeight: 1.3 }}>
                    {regionFilter === '전체'
                      ? '지역 선택'
                      : (areaFilter !== '전체' || regionAllCards)
                        ? `${orderedCards.length}개 카드`
                        : `${dongList.length}개 동`}
                  </strong>
                </div>
              </div>
              {(areaFilter !== '전체' || regionAllCards) && (
                <button
                  className="tbl-soft-btn sm"
                  style={{ flexShrink: 0 }}
                  onClick={toggleAllBoundaries}
                  type="button"
                >
                  전체 보기
                </button>
              )}
            </div>

            {/* 패널 콘텐츠 — 3단계 드릴다운 */}
            <div className="map-card-list">
              {/* 1단계: 구/시 목록 */}
              {regionFilter === '전체' && (
                <>
                  {regionNames.map((region) => {
                    const count = regionCardCounts.get(region) ?? 0
                    if (count === 0) return null
                    return (
                      <button
                        key={region}
                        type="button"
                        className="map-nav-item"
                        onClick={() => { setRegionFilter(region); setAreaFilter('전체'); setRegionAllCards(false); setCardFilter('전체'); setDetailOpen(false) }}
                      >
                        <span className="map-nav-item__name">{region}</span>
                        <span className="map-nav-item__badge">{count}</span>
                      </button>
                    )
                  })}
                </>
              )}

              {/* 2단계: 동 목록 */}
              {regionFilter !== '전체' && areaFilter === '전체' && !regionAllCards && (
                <>
                  <button
                    key="__all__"
                    type="button"
                    className="map-nav-item"
                    onClick={() => { setRegionAllCards(true); setCardFilter('전체'); setDetailOpen(false) }}
                  >
                    <span className="map-nav-item__name">{regionFilter} 전체</span>
                    <span className="map-nav-item__badge">{regionCardCounts.get(regionFilter as string) ?? 0}</span>
                  </button>
                  {dongList.map((area) => {
                    const count = dongCardCounts.get(area) ?? 0
                    return (
                      <button
                        key={area}
                        type="button"
                        className="map-nav-item"
                        onClick={() => { setAreaFilter(area); setCardFilter('전체'); setDetailOpen(false) }}
                      >
                        <span className="map-nav-item__name">{area}</span>
                        <span className="map-nav-item__badge">{count}</span>
                      </button>
                    )
                  })}
                </>
              )}

              {/* 3단계: 카드 목록 */}
              {(areaFilter !== '전체' || regionAllCards) && (
                <>
                  {orderedCards.length === 0 && (
                    <div className="map-empty-state">
                      <p>카드가 없습니다</p>
                    </div>
                  )}
                  {orderedCards.map((card) => {
                    const cardBuildings = buildingsByCardId.get(card.id) ?? []
                    const hasBoundary = boundariesByCardId.has(card.id)
                    const boundaryVisible = visibleBoundarySelection === card.id || visibleBoundarySelection === '전체'
                    return (
                      <article
                        className={[
                          'map-card-item',
                          cardFilter === card.id || selectedBoundaryCardIds.has(card.id) ? 'selected' : '',
                          boundaryMultiSelectMode ? 'multi-selecting' : '',
                        ].filter(Boolean).join(' ')}
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
                          onClick={(e) => {
                            e.stopPropagation()
                            if (boundaryMultiSelectMode) {
                              handleSelectCardForMap(card.id)
                              return
                            }
                            setVisibleBoundarySelection((prev) => prev === card.id ? null : card.id)
                          }}
                          type="button"
                        >
                          {boundaryMultiSelectMode ? selectedBoundaryCardIds.has(card.id) ? '선택됨' : '선택' : '구역선'}
                        </button>
                      </article>
                    )
                  })}
                </>
              )}
            </div>
          </aside>

          <div className="map-canvas-panel">
              <div className="map-legend-card">
                {[
                  { status: '방문필요', color: '#2D6CDF', label: '방문필요' },
                  { status: '방문완료', color: '#4F7A4B', label: '방문완료' },
                  { status: '방문금지', color: '#1A1A18', label: t(language, 'map.forbidden') },
                  { status: '정기방문', color: '#B8862A', label: t(language, 'map.regularVisit') },
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
              selectedCardIds={boundaryMultiSelectMode ? selectedBoundaryCardIds : undefined}
              cards={cards}
              drawingBoundary={drawingBoundary}
              addingBuilding={addingBuilding}
              editingBuildingLocation={editingPinMode}
              previewPinLat={newBuildingLat}
              previewPinLng={newBuildingLng}
              draftBoundaryPoints={draftBoundaryPoints}
              selectedBuildingId={selectedBuildingId ?? 0}
              focusBuildingId={focusedBuildingId}
              selectedCardId={
                // 비공식 모양을 그리는 중에는 구역 카드를 고르지 않는다.
                // boundaryCardId 로 바뀌면 지도가 그 카드 범위로 맞춰지면서
                // 방금 보고 있던 자리에서 튕겨 나간다 (줌이 풀린다)
                informalShapeTarget ? visibleBoundarySelection
                  : drawingBoundary ? boundaryCardId
                    : visibleBoundarySelection
              }
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
                    const b = buildings.find(item => item.id === id)
                    if (b) {
                      const grp = getBuildingStatus(b)
                      setCollapsedStatusGroups((prev) => { const n = new Set(prev); n.delete(grp); return n })
                    }
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
                  setExpandedUnitId(null)

                  const b = buildings.find(item => item.id === id)
                  if (b) {
                    // 해당 건물 그룹이 접혀 있으면 자동으로 펼치기
                    const grp = getBuildingStatus(b)
                    setCollapsedStatusGroups((prev) => { const n = new Set(prev); n.delete(grp); return n })
                    if (cardFilter !== '전체' && b.cardId !== cardFilter) {
                      setCardFilter(b.cardId)
                    }
                  }

                  setTimeout(() => {
                    document.getElementById(`bld-row-${id}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' })
                  }, 80)
                }
              }}
              onSelectCardBoundary={handleSelectCardForMap}
              onUpdateBoundaryPoint={updateDraftBoundaryPoint}
              onMapRightClick={handleMapRightClick}
              focusPoint={informalFocusPoint}
              informalShape={informalShape}
              informalPlaces={informalPins}
              onSelectInformal={(id) => {
                const place = informalAssets.find((a) => a.id === id)
                if (place) showToast(place.memo?.trim() || place.name, 'info')
              }}
              onMapClick={(addingBuilding || addingInformal) ? handleMapClick : undefined}
              onMovePreviewPin={(lat, lng) => {
                setNewBuildingLat(lat)
                setNewBuildingLng(lng)
              }}
              onMoveBuilding={(id, lat, lng) => {
                const b = buildings.find(item => item.id === id)
                if (b) {
                  onUpdateBuilding(id, b.name, b.address, lat, lng)
                  showToast(msg('{v1} 핀 위치가 저장됐습니다', { v1: b.name || b.address }), 'success')
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
                {onCreateInformalPlace && (actualRole === 'admin' || actualRole === 'developer') && (
                  <button onClick={openAddInformalMode} type="button">비공식 장소 추가</button>
                )}
                <button
                  onClick={() => { setShowInformal((v) => !v); setShowMapActionMenu(false) }}
                  type="button"
                >
                  {showInformal ? '비공식 숨기기' : '비공식 보기'}
                </button>
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
            <strong>{t(language, 'map.viewOnly')}</strong>
            <span>{t(language, 'map.viewOnlyDesc')}</span>
          </div>
        )}

        <div className="building-accordion-list">
          {panelBuildings.length === 0 && (
            <div className="map-empty-state panel-empty">
              <p>{t(language, 'map.noBuildings')}</p>
              <small>{t(language, 'map.noBuildingsHint')}</small>
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
                    {isHiddenOnMap && <em>{t(language, 'map.hideOnMap')}</em>}
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
                      title={t(language, 'map.editBuilding')}
                      type="button"
                    >⋮</button>
                  </div>
                ) : (
                  <div className="building-edit-mode">
                    <div className="edit-input-group">
                      <input className="modern-edit-address" onChange={(e) => setEditAddress(e.target.value)} placeholder={t(language, 'map.buildingAddressPlaceholder')} value={editAddress} />
                      <input className="modern-edit-name" onChange={(e) => setEditName(e.target.value)} placeholder={t(language, 'map.buildingNameOptional')} value={editName} />
                      <select value={editType} onChange={e => setEditType(e.target.value as Building['type'])} style={{ padding: '4px 8px', borderRadius: 'var(--r-sm)', border: '1px solid #e2e8f0', fontSize: '12px', background: '#f8fafc' }}>
                        <option value="주택">{t(language, 'map.house')}</option>
                        <option value="상가">{t(language, 'map.shop')}</option>
                      </select>
                    </div>
                    <div className="edit-action-group">
                      <button className="edit-save-btn" onClick={() => { onUpdateBuilding(building.id, editName.trim(), editAddress.trim(), undefined, undefined, editType); setEditingBuildingId(null) }}>{t(language, 'map.save')}</button>
                      <button className="edit-cancel-btn" onClick={() => setEditingBuildingId(null)}>{t(language, 'map.cancel')}</button>
                      <button className="edit-delete-btn" onClick={() => { setPendingDeleteBuildingId(building.id); setShowDeleteBuildingConfirmModal(true) }}>{t(language, 'common.delete')}</button>
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

                    <div className={`unit-col-header${getActivePeriodForDate(getLocalDateString())?.hasInvitation ? ' with-invitation' : ''}`}>
                      <span>{t(language, 'map.unitInfo')}</span>
                      {getActivePeriodForDate(getLocalDateString())?.hasInvitation && <span style={{ color: '#f59e0b' }}>{t(language, 'map.invitation')}</span>}
                      <span>{t(language, 'map.met')}</span>
                      <span>{t(language, 'map.absent')}</span>
                      <span>{t(language, 'map.notTarget')}</span>
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
                          <div className={`unit-grid-main${getActivePeriodForDate(getLocalDateString())?.hasInvitation ? ' with-invitation' : ''}`}>
                            <button className="unit-name-btn" onClick={() => { setExpandedUnitId(isUnitExpanded ? null : unit.id); if (!isUnitExpanded) moveMapToBuilding(building) }} type="button">
                              <span className="unit-chevron">{isUnitExpanded ? '▾' : '▸'}</span>
                              <span className="unit-number-text">{unit.number}</span>
                              {unit.isChinese && <span className="unit-chinese-badge">中</span>}
                              {unit.isForbidden && <span className="unit-forbidden-badge">{t(language, 'map.forbidden')}</span>}
                              {unit.isRegularVisit && <span className="unit-regular-badge">{t(language, 'map.revisitShort')}</span>}
                              {latestHistory && (
                                <span className="unit-recent-visit">
                                  [{latestHistory.visitedAt.slice(5).replace('-', '/')} {latestHistory.timeSlot}]
                                </span>
                              )}
                            </button>
                            {getActivePeriodForDate(getLocalDateString())?.hasInvitation && (() => {
                              const todayInvitation = unitHistories.find(
                                (h) => h.visitedAt === getLocalDateString() && h.invitationLeft,
                              )
                              const isPopupOpen = invitationPopupUnitId === unit.id
                              return (
                                <div style={{ position: 'relative', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
                                  <button
                                    className={`unit-check-btn unit-check-btn-invitation${todayInvitation ? ' ucb-invitation' : ''}${!canRecordVisits ? ' locked' : ''}`}
                                    onClick={() => {
                                      if (!requireRecordAccess()) return
                                      if (todayInvitation) {
                                        // 이미 켜져 있으면 바로 끄기
                                        onToggleInvitationLeft?.(building.id, unit.id)
                                      } else {
                                        // 꺼져 있으면 팝업 열기
                                        setInvitationPopupUnitId(isPopupOpen ? null : unit.id)
                                      }
                                    }}
                                    type="button"
                                    title={t(language, 'map.invitationLeft')}
                                  >{todayInvitation ? '✓' : ''}</button>
                                  {isPopupOpen && (
                                    <div style={{ position: 'absolute', top: '100%', left: '50%', transform: 'translateX(-50%)', zIndex: 200, marginTop: 4, background: 'var(--bg-card)', border: '1px solid var(--border-default)', borderRadius: 10, boxShadow: '0 4px 16px rgba(0,0,0,0.15)', padding: '10px 8px', width: 160, display: 'flex', flexDirection: 'column', gap: 6 }}>
                                      <p style={{ margin: '0 0 6px', fontSize: 11, color: 'var(--gray-500)', textAlign: 'center', fontWeight: 600 }}>{t(language, 'map.invitationMethod')}</p>
                                      <button type="button"
                                        onClick={() => { onToggleInvitationLeft?.(building.id, unit.id, 'direct'); setInvitationPopupUnitId(null) }}
                                        style={{ padding: '7px 10px', border: 0, borderRadius: 7, background: '#4F7A4B', color: '#fff', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>
                                        {t(language, 'map.invitationDirect')}
                                      </button>
                                      <button type="button"
                                        onClick={() => { onToggleInvitationLeft?.(building.id, unit.id, 'door'); setInvitationPopupUnitId(null) }}
                                        style={{ padding: '7px 10px', border: 0, borderRadius: 7, background: '#C44536', color: '#fff', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>
                                        {t(language, 'map.invitationDoor')}
                                      </button>
                                      <button type="button"
                                        onClick={() => setInvitationPopupUnitId(null)}
                                        style={{ padding: '5px', border: 0, borderRadius: 6, background: 'none', color: 'var(--gray-400)', fontSize: 11, cursor: 'pointer' }}>
                                        {t(language, 'common.cancel')}
                                      </button>
                                    </div>
                                  )}
                                </div>
                              )
                            })()}
                            <button
                              className={`unit-check-btn${unit.status === '만남' ? ' ucb-meet' : ''}${!canRecordVisits ? ' locked' : ''}`}
                              onClick={() => {
                                if (!requireRecordAccess()) return
                                if (unit.status === '만남') onUndoLatestVisit(building.id, unit.id)
                                else onQuickLogVisit(building.id, unit.id, '만남')
                              }}
                              type="button"
                            >{unit.status === '만남' ? '✓' : ''}</button>
                            <button
                              className={`unit-check-btn${(unit.status === '부재' && latestHistory?.visitedAt === getLocalDateString()) ? ' ucb-absent' : ''}${!canRecordVisits ? ' locked' : ''}`}
                              onClick={() => {
                                if (!requireRecordAccess()) return
                                if (unit.status === '부재' && latestHistory?.visitedAt === getLocalDateString()) onUndoLatestVisit(building.id, unit.id)
                                else onQuickLogVisit(building.id, unit.id, '부재')
                              }}
                              type="button"
                            >{(unit.status === '부재' && latestHistory?.visitedAt === getLocalDateString()) ? '✓' : ''}</button>
                            <button
                              className={`unit-check-btn${unit.status === '대상외' ? ' ucb-korean' : ''}${!canRecordVisits ? ' locked' : ''}`}
                              onClick={() => {
                                if (!requireRecordAccess()) return
                                if (unit.status === '대상외') onUndoLatestVisit(building.id, unit.id)
                                else onQuickLogVisit(building.id, unit.id, '대상외')
                              }}
                              type="button"
                            >{unit.status === '대상외' ? '✓' : ''}</button>
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
                                  <span style={{ fontSize: 12, color: '#64748b', fontWeight: 600 }}>{t(currentLang(), 'territory.visitHistory', { defaultValue: '방문 기록' })}</span>
                                  <button
                                    className="history-add-btn"
                                    onClick={() => openHistoryEditorForAdd(building.id, unit.id)}
                                    style={{ marginLeft: 'auto' }}
                                    type="button"
                                  >+ {t(currentLang(), 'map.addRecord')}</button>
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
                                            <button onClick={() => openHistoryEditorForEdit(building.id, history)} type="button">{t(currentLang(), 'map.edit')}</button>
                                            <button onClick={async () => {
                                              if (!requireRecordAccess()) return
                                              if (await confirmDialog({ message: '이 방문 기록을 삭제할까요?', danger: true, confirmLabel: '삭제' })) {
                                                onDeleteVisitHistory(history.id, unit.id)
                                              }
                                              setEditingHistoryId(null)
                                            }} className="delete" type="button">{t(currentLang(), 'map.delete')}</button>
                                          </div>
                                        )}
                                      </div>
                                    )
                                  })}
                                  {unitHistories.length === 0 && <span className="ugd-value" style={{ fontSize: 12, color: '#cbd5e1' }}>{t(currentLang(), 'map.noRecords')}</span>}
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
                                    중국어
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
                                        onClick={async () => {
                                          setUnitDeleteMenuId(null)
                                          if (await confirmDialog({ message: t(language, 'map.deleteUnitConfirm'), danger: true, confirmLabel: '삭제' })) {
                                            onDeleteUnit(building.id, unit.id)
                                            setExpandedUnitId(null)
                                          }
                                        }}
                                        style={{ display: 'block', width: '100%', padding: '12px 16px', background: 'none', border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 700, color: 'var(--danger-600)', textAlign: 'left' }}
                                        type="button"
                                      >{t(language, 'map.deleteUnit')}</button>
                                    </div>
                                  )}
                                </div>
                              </div>

                              {/* ── 세대 메모 (클릭 편집 → 저장/취소) ──
                                   방문 기록의 메모와 다른 것 — 이 세대에 계속 남는 정보 */}
                              <div style={{ padding: '8px 12px' }}>
                                <p style={{ margin: '0 0 4px', fontSize: 11, fontWeight: 700, color: '#94a3b8' }}>
                                  {t(language, 'map.unitMemoLabel')}
                                </p>
                                {unitMemoEdits[unit.id] !== undefined ? (
                                  <>
                                    <textarea
                                      className="ugd-memo-textarea"
                                      placeholder={t(language, 'map.addMemo') + '...'}
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
                                      >{t(language, 'map.save')}</button>
                                      <button
                                        onClick={() => setUnitMemoEdits((prev) => { const next = { ...prev }; delete next[unit.id]; return next })}
                                        style={{ flex: 1, padding: '6px 0', borderRadius: 8, border: '1px solid #e2e8f0', background: '#fff', color: '#64748b', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}
                                        type="button"
                                      >{t(language, 'map.cancel')}</button>
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
                                  >{(unitMemos[unit.id] ?? unit.memo) || t(language, 'map.addMemo') + '...'}</button>
                                )}
                              </div>
                            </div>
                          )}
                        </div>
                      )
                    })}

                    {addingUnitToBuildingId === building.id ? (
                      <div className="inline-add-unit-form bld-add-unit-form">
                        <input autoFocus placeholder={t(currentLang(), 'unit.addUnitPlaceholder')} value={newUnitNumber} onChange={(e) => setNewUnitNumber(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter' && newUnitNumber.trim()) { onAddUnit(building.id, newUnitNumber.trim()); setNewUnitNumber('') } }} />
                        <button disabled={!newUnitNumber.trim()} onClick={() => { onAddUnit(building.id, newUnitNumber.trim()); setNewUnitNumber('') }}>{t(language, 'map.add')}</button>
                        <button onClick={() => setAddingUnitToBuildingId(null)} style={{ background: '#f1f5f9', color: 'var(--ink-500)' }}>✕</button>
                      </div>
                    ) : (
                      <button className="bld-add-unit-btn" onClick={() => setAddingUnitToBuildingId(building.id)} type="button">{t(currentLang(), 'map.addUnit')}</button>
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
                <span>{t(currentLang(), 'map.addBuilding')}</span>
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
                    {geocodeStatus === 'ok' && <span className="building-add-geocode-ok">{t(currentLang(), 'map.autoAddress')}</span>}
                    {geocoding && <span> {t(currentLang(), 'map.searchingAddress')}</span>}
                  </p>
                )}
                {!newBuildingLat && (
                  <p className="building-add-coords">
                    {t(currentLang(), 'map.addBuildingDesc')}
                  </p>
                )}
                {geocodeStatus === 'fail' && (
                  <p className="building-add-coords building-add-geocode-fail">
                    {t(currentLang(), 'map.addressNotFoundExt')}
                  </p>
                )}
                <div className="cal-field">
                  <label>{t(language, 'map.cardStr')}</label>
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
                  <label>{t(currentLang(), 'map.buildingNameReq')}</label>
                  <input
                    className="cal-input"
                    placeholder={t(currentLang(), 'map.buildingNamePlaceholder')}
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
                  <label>{t(currentLang(), 'map.addressLabel')}</label>
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
                  <label>{t(language, 'map.type')}</label>
                  <select
                    className="cal-input"
                    value={newBuildingType}
                    onChange={(e) => setNewBuildingType(e.target.value as Building['type'])}
                  >
                    <option value="주택">{t(language, 'map.house')}</option>
                    <option value="상가">{t(language, 'map.shop')}</option>
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
                  disabled={creatingBuilding || !newBuildingName.trim() || geocoding || (newBuildingLat == null && !newBuildingAddress.trim())}
                  onClick={handleConfirmAddBuilding}
                >
                  {creatingBuilding ? '추가 중...' : geocoding ? t(language, 'map.checkingAddress') + '...' : newBuildingLat == null ? t(language, 'map.checkLocation') : t(language, 'map.add')}
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
            <h3 style={{ margin: '0 0 16px', fontSize: '18px', fontWeight: 700 }}>{t(language, 'map.registerRegularVisit')}</h3>
            <p style={{ margin: '0 0 12px', fontSize: '14px', color: '#666' }}>{t(currentLang(), 'modal.enterRegularVisitorName')}</p>
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
              placeholder={t(language, 'map.visitorName')}
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
            <h3 style={{ margin: '0 0 16px', fontSize: '18px', fontWeight: 700 }}>{t(language, 'map.unregisterRegularVisit')}</h3>
            <p style={{ margin: '0 0 20px', fontSize: '15px', color: '#4b5563', lineHeight: '1.5' }}>
              {t(currentLang(), 'modal.removeRegularVisit')}
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
            <h3 style={{ margin: '0 0 16px', fontSize: '18px', fontWeight: 700, color: 'var(--danger-600)' }}>{t(language, 'map.deleteBuilding')}</h3>
            <p style={{ margin: '0 0 20px', fontSize: '15px', color: '#4b5563', lineHeight: '1.5' }}>
              {t(currentLang(), 'modal.confirmDeleteBuilding')}
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
            <h3>{historyEditor.mode === 'add' ? t(language, 'map.addHistory') : t(language, 'map.editHistory')}</h3>
            <div className="admin-modal-form">
              <label>{t(language, 'map.status')}</label>
              <select 
                value={historyEditor.result}
                onChange={e => setHistoryEditor({ ...historyEditor, result: e.target.value as UnitStatus })}
                style={{ width: '100%', padding: '8px', marginBottom: '12px' }}
              >
                <option value="미방문">{t(language, 'map.unvisited')}</option>
                <option value="만남">{t(language, 'map.met')}</option>
                <option value="부재">{t(language, 'map.absent')}</option>
                <option value="대상외">{t(language, 'map.notTarget')}</option>
              </select>

              <label>{t(language, 'map.timeSlot')}</label>
              <select 
                value={historyEditor.timeSlot}
                onChange={e => setHistoryEditor({ ...historyEditor, timeSlot: e.target.value as TimeSlot })}
                style={{ width: '100%', padding: '8px', marginBottom: '12px' }}
              >
                <option value="오전">{t(language, 'map.morning')}</option>
                <option value="오후">{t(language, 'map.afternoon')}</option>
                <option value="저녁">{t(language, 'map.evening')}</option>
              </select>

              <label>{t(language, 'map.dateIso')}</label>
              <input 
                type="date"
                value={historyEditor.visitedAt}
                onChange={e => setHistoryEditor({ ...historyEditor, visitedAt: e.target.value })}
                style={{ width: '100%', padding: '8px', marginBottom: '12px' }}
              />

              <label>{t(language, 'map.memoLabel')}</label>
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
                    {t(language, 'map.invitationLeft')}
                  </label>
                </div>
              )}
            </div>
            <div className="admin-modal-footer">
              <button
                onClick={() => setHistoryEditor(null)}
                style={{ background: '#f1f5f9', color: 'var(--ink-500)' }}
              >{t(language, 'map.cancel')}</button>
              <button onClick={saveHistoryEditor}>{t(language, 'map.save')}</button>
            </div>
          </div>
        </div>
      )}

      {informalDraftModal}

      {/* 비공식 장소로 들어왔을 때 — 그 장소의 모양을 그리는 자리.
          그리는 중에는 아래쪽 구역선 도구(저장/취소)가 그대로 뜬다 */}
      {selectedInformal && showInformal && !drawingBoundary && onSaveInformalShape && (
        <div style={{
          position: 'absolute', left: 16, bottom: 16, zIndex: 30,
          background: 'var(--surface, #fff)', border: '1px solid var(--line)',
          borderRadius: 12, padding: 12, boxShadow: '0 8px 24px rgba(0,0,0,.14)',
          maxWidth: 280,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
            <span style={{ width: 10, height: 10, borderRadius: 3, background: '#7A5C8A' }} />
            <strong style={{ fontSize: 13.5 }}>{selectedInformal.name}</strong>
          </div>
          {selectedInformal.memo?.trim() && (
            <p style={{ margin: '0 0 8px', fontSize: 12.5, color: 'var(--muted)', lineHeight: 1.6 }}>
              {selectedInformal.memo}
            </p>
          )}
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            <button className="ds-btn" onClick={() => startInformalShapeDrawing('boundary')} type="button">
              {selectedInformal.boundary?.length ? '구역선 수정' : '구역선 그리기'}
            </button>
            <button className="ds-btn" onClick={() => startInformalShapeDrawing('route')} type="button">
              {selectedInformal.route?.length ? '동선 수정' : '동선 그리기'}
            </button>
          </div>
          <p style={{ margin: '8px 0 0', fontSize: 12, color: 'var(--muted)', lineHeight: 1.55 }}>
            지도를 눌러 점을 찍습니다. 구역선은 3점, 동선은 2점부터 저장됩니다.
          </p>
        </div>
      )}
    </section>
  )
}
