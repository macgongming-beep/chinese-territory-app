import { useEffect, useMemo, useRef, useState, type ChangeEvent } from 'react'
import { useAuth } from '../hooks/useAuth'
import { territoryAreasByRegion, territoryRegions } from '../data/territoryStructure'
import { showToast } from '../lib/toast'
import { findCardForCoordinates, formatDisplayAddress, isValidMapCoordinate, normalizeMapCoordinates, parseCoordinate } from '../utils/mapUtils'
import { downloadCardBoundaryBackup, mergeCardBoundaryPoints, parseCardBoundaryBackup } from '../utils/boundaryMerge'
import { compareTerritoryCardsByOperationalPriority, getTerritoryCardOperationalState } from '../utils/cardSearch'
import type { CardMergeUndoSnapshot } from '../hooks/storeMutations/cardBoundaries'
import { compareUnitNumbers } from '../hooks/storeTransforms'
import type { Building, CardBoundary, GeoPoint, InformalAsset, InformalGroup, Role, TerritoryCard, TerritoryRegion, TimeSlot, Unit, UnitStatus, VisitHistory } from '../types'
import { InformalCardsTab } from './InformalCardsTab'
import { RestaurantsTab } from './RestaurantsTab'
import {
  type CsvBuildingImport,
  type CsvPreviewRow,
  type CsvSkippedRow,
  type CsvVisitHistory,
  normalizeCsvKey,
  parseCsv,
  normalizeUnitStatus,
  looksTruthy,
  parseCsvDate,
  normalizeTimeSlot,
  normalizeWarning,
  downloadCsvExample,
} from '../utils/csvBuildingImport'
import { AddUnitRow } from './AddUnitRow'
import { CardCreateModal } from './DesktopTerritoryCardModal'

// 상대 날짜 표시: "오늘", "어제", "N일 전", "N주 전", "N개월 전", "YYYY-MM-DD"
function formatRelativeDate(iso: string): string {
  if (!iso) return ''
  const d = new Date(iso)
  if (isNaN(d.getTime())) return iso
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const target = new Date(d)
  target.setHours(0, 0, 0, 0)
  const diffDays = Math.floor((today.getTime() - target.getTime()) / 86400000)
  if (diffDays === 0) return '오늘'
  if (diffDays === 1) return '어제'
  if (diffDays < 7) return `${diffDays}일 전`
  if (diffDays < 30) return `${Math.floor(diffDays / 7)}주 전`
  if (diffDays < 365) return `${Math.floor(diffDays / 30)}개월 전`
  return iso.slice(0, 10)
}

function getDefaultTimeSlot(): TimeSlot {
  const hour = new Date().getHours()
  if (hour < 12) return '오전'
  if (hour < 18) return '오후'
  return '저녁'
}

function getTodayDateInputValue() {
  const now = new Date()
  const y = now.getFullYear()
  const m = String(now.getMonth() + 1).padStart(2, '0')
  const d = String(now.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

type CardStatusFilter = TerritoryCard['status'] | '전체' | '완료·제외'

export function DesktopTerritory({
  buildings,
  cardBoundaries,
  cards,
  role,
  onSetCardLeaders,
  onSetMultipleCardLeaders,
  onCreateCard,
  onDeleteBuildings,
  onDeleteCards,
  onMergeDuplicateBuildings,
  onImportBuildings,
  onMoveBuildingToCard,
  onReassignBuildingsToCards,
  onUpdateBuilding,
  onToggleChinese,
  onToggleRegularVisit,
  onSetRegularVisitor,
  onAddUnit,
  onDeleteUnit,
  onUpdateUnitFlags,
  onUpdateUnitStatus,
  onAddVisitHistory,
  onUpdateVisitHistory,
  onDeleteVisitHistory,
  onRestoreCardBoundaries,
  onMergeCardBoundaries,
  onUndoMergeCardBoundaries,
  onOpenCardMap,
  onOpenBuildingMap,
  visitHistories,
  onCreateBuilding,
  onSwitchToMap,
  // v2 신 배정 모델
  currentVisitor = '',
  informalAssets = [],
  informalGroups = [],
  onUploadInformalAsset,
  onDeleteInformalAsset,
  onCreateInformalGroup,
  onRenameInformalGroup,
  onDeleteInformalGroup,
  onMoveAssetToGroup,
  onToggleBuildingRestaurant,
  onBulkSetRestaurant,
  restaurantRequests = [],
  onApproveRestaurantRequest,
  onRejectRestaurantRequest,
}: {
  buildings: Building[]
  cardBoundaries: CardBoundary[]
  cards: TerritoryCard[]
  role: Role
  onSetCardLeaders: (cardId: number, leaderNames: string[], options?: { silentSuccess?: boolean }) => Promise<void> | void
  onSetMultipleCardLeaders: (cardIds: number[], leaderNames: string[], options?: { silentSuccess?: boolean }) => Promise<void> | void
  onDeleteBuildings: (buildingIds: number[]) => void
  onDeleteCards: (cardIds: number[]) => void
  onMergeDuplicateBuildings: (scopeCardId?: number, nameOverrides?: Record<number, string>, selectedPrimaryIds?: number[]) => Promise<void>
  onImportBuildings: (inputs: CsvBuildingImport[]) => Promise<{ inserted: number; skipped: number }>
  onMoveBuildingToCard: (buildingId: number, cardId: number) => void
  onReassignBuildingsToCards: (updates: Array<{ buildingId: number; cardId: number }>) => Promise<{ updated: number; failed: number }>
  onUpdateBuilding: (buildingId: number, name: string, address: string, lat?: number, lng?: number, type?: Building['type'], memo?: string, isChineseHeavy?: boolean) => void
  onToggleChinese: (buildingId: number, unitId: number) => void
  onToggleRegularVisit: (buildingId: number, unitId: number, visitorName?: string) => void
  onSetRegularVisitor: (unitId: number, visitorName: string) => void
  onAddUnit: (buildingId: number, unitNumber: string) => void
  onDeleteUnit: (buildingId: number, unitId: number) => void
  onUpdateUnitFlags: (unitId: number, flags: Partial<Unit>) => void
  onUpdateUnitStatus: (buildingId: number, unitId: number, status: UnitStatus, memo?: string) => void
  onAddVisitHistory: (
    buildingId: number,
    unitId: number,
    input: { result: UnitStatus; timeSlot: TimeSlot; memo: string; visitedAt: string },
  ) => void
  onUpdateVisitHistory: (
    historyId: number,
    unitId: number,
    input: { result: UnitStatus; timeSlot: TimeSlot; memo: string; visitedAt: string },
  ) => void
  onDeleteVisitHistory?: (historyId: number, unitId: number) => void
  onRestoreCardBoundaries?: (boundaries: CardBoundary[]) => Promise<void> | void
  onMergeCardBoundaries?: (input: {
    targetCardId: number
    sourceCardIds: number[]
    mergedPoints: GeoPoint[]
  }) => Promise<void> | void
  onUndoMergeCardBoundaries?: (snapshot: CardMergeUndoSnapshot) => Promise<void>
  onOpenCardMap: (cardId: number, editBoundary?: boolean) => void
  onOpenBuildingMap: (buildingId: number) => void
  visitHistories: VisitHistory[]
  onCreateCard: (input: {
    area: string
    region: string
    index: number
    pinCount: number
  }) => Promise<number | null> | number | null
  onCreateBuilding?: (input: { cardId: number; name: string; address: string; type: Building['type']; lat: number; lng: number }) => Promise<void> | void
  onSwitchToMap?: () => void
  currentVisitor?: string
  informalAssets?: InformalAsset[]
  informalGroups?: InformalGroup[]
  onUploadInformalAsset?: (input: { file: File; name: string; uploadedBy: string; groupId?: number | null }) => Promise<{ ok: boolean; assetId?: number; error?: string }>
  onDeleteInformalAsset?: (assetId: number) => Promise<void>
  onCreateInformalGroup?: (input: { name: string; createdBy: string }) => Promise<number | null>
  onRenameInformalGroup?: (groupId: number, name: string) => Promise<void>
  onDeleteInformalGroup?: (groupId: number) => Promise<void>
  onMoveAssetToGroup?: (assetId: number, groupId: number | null) => Promise<void>
  onToggleBuildingRestaurant?: (buildingId: number, isRestaurant: boolean) => Promise<void>
  onBulkSetRestaurant?: (buildingIds: number[]) => Promise<void>
  restaurantRequests?: import('../types').RestaurantRequest[]
  onApproveRestaurantRequest?: (id: number, opts: { name: string; address: string; reviewer: string; existingBuildingId?: number | null; lat?: number; lng?: number }) => Promise<void>
  onRejectRestaurantRequest?: (id: number, reviewer: string) => Promise<void>
}) {
  const { allUsers, fetchAllUsers } = useAuth()
  const isAdmin = role === 'admin'
  const [selectedCardId, setSelectedCardId] = useState<number | null>(null)
  const [checkedCardIds, setCheckedCardIds] = useState<Set<number>>(new Set())
  const [checkedBuildingIds, setCheckedBuildingIds] = useState<Set<number>>(new Set())
  const [cardMergeModalOpen, setCardMergeModalOpen] = useState(false)
  const [cardMergeTargetId, setCardMergeTargetId] = useState<number | null>(null)
  const [cardMergeUndo, setCardMergeUndo] = useState<CardMergeUndoSnapshot | null>(null)
  const [detailPaneOpen, setDetailPaneOpen] = useState(false)
  const [activeTab, setActiveTab] = useState<'카드 관리' | '건물 관리'>('카드 관리')
  // v2: 종류 sub-tab
  type ZoneKind = 'territory' | 'informal' | 'restaurant'
  const [zoneKind, setZoneKind] = useState<ZoneKind>('territory')
  const informalCount = informalAssets.length
  const restaurantCount = buildings.filter((b) => b.type === '상가' && b.isRestaurant).length
  const [buildingSubTab, setBuildingSubTab] = useState<'건물 목록' | '중국인 포인트'>('건물 목록')
  const [showCardModal, setShowCardModal] = useState(false)
  const [pendingBoundaryCard, setPendingBoundaryCard] = useState<{ id: number; name: string } | null>(null)
  const [regionFilter, setRegionFilter] = useState<TerritoryRegion | '전체'>('전체')
  const [areaFilter, setAreaFilter] = useState('전체')
  const [areaExpanded, setAreaExpanded] = useState(false)
  const AREA_CHIP_LIMIT = 10
  const [assignmentFilter, setAssignmentFilter] = useState<'전체' | '배정' | '미배정'>('전체')
  const [leaderFilter, setLeaderFilter] = useState('전체')
  const [regularVisitFilter, setRegularVisitFilter] = useState<'전체' | '있음' | '없음'>('전체')
  const [cardChineseHeavyFilter, setCardChineseHeavyFilter] = useState<'전체' | '있음' | '없음'>('전체')
  const [cardStatusFilter, setCardStatusFilter] = useState<CardStatusFilter>('전체')
  const [doneExcludedOpen, setDoneExcludedOpen] = useState(false)
  const [cardFilterPanelOpen, setCardFilterPanelOpen] = useState(false)
  const [buildingFilterPanelOpen, setBuildingFilterPanelOpen] = useState(false)
  const [pointFilterPanelOpen, setPointFilterPanelOpen] = useState(false)
  const [buildingCardFilter, setBuildingCardFilter] = useState<number | '전체'>('전체')
  const [buildingTypeFilter, setBuildingTypeFilter] = useState<Building['type'] | '전체'>('전체')
  const [pointStatusFilter, setPointStatusFilter] = useState<UnitStatus | '전체'>('전체')
  const [buildingRegularFilter, setBuildingRegularFilter] = useState<'전체' | '있음' | '없음'>('전체')
  const [buildingMemoFilter, setBuildingMemoFilter] = useState<'전체' | '있음' | '없음'>('전체')
  const [buildingChineseHeavyFilter, setBuildingChineseHeavyFilter] = useState<'전체' | '있음' | '없음'>('전체')
  const [pointRegularFilter, setPointRegularFilter] = useState<'전체' | '있음' | '없음'>('전체')
  const [pointMemoFilter, setPointMemoFilter] = useState<'전체' | '있음' | '없음'>('전체')
  type BuildingSortKey = '카드' | '건물' | '주소' | '유형'
  const [buildingSort, setBuildingSort] = useState<{ key: BuildingSortKey; dir: 'asc' | 'desc' }>({ key: '카드', dir: 'asc' })
  const [editingBuildingId, setEditingBuildingId] = useState<number | null>(null)
  const [editingUnitId, setEditingUnitId] = useState<number | null>(null)
  const [unitEditDraft, setUnitEditDraft] = useState<{ number: string; status: UnitStatus; memo: string; isChinese: boolean; isRegularVisit: boolean; isForbidden: boolean }>({ number: '', status: '미방문', memo: '', isChinese: false, isRegularVisit: false, isForbidden: false })
  const [buildingEditDraft, setBuildingEditDraft] = useState({
    name: '',
    address: '',
    type: '주택' as Building['type'],
    cardId: 0,
    memo: '',
  })
  const [showCsvModal, setShowCsvModal] = useState(false)
  // 중복 주소 합치기 이름 선택 모달
  const [mergeModalGroups, setMergeModalGroups] = useState<Array<{ primaryId: number; address: string; cardName: string; buildingCount: number; unitCount: number; names: string[] }> | null>(null)
  const [mergeNameChoices, setMergeNameChoices] = useState<Record<number, string>>({})
  const [mergeSelectedPrimaryIds, setMergeSelectedPrimaryIds] = useState<Set<number>>(new Set())
  const [pendingChineseToggle, setPendingChineseToggle] = useState<{
    buildingId: number
    unitId: number
    cardName: string
    buildingName: string
    unitNumber: string
  } | null>(null)
  // 건물 추가 모달
  const [addBuildingOpen, setAddBuildingOpen] = useState(false)
  const [addBuildingForm, setAddBuildingForm] = useState<{ name: string; address: string; type: Building['type']; cardId: number | 'auto' }>({ name: '', address: '', type: '주택', cardId: 'auto' })
  const [addBuildingGeoState, setAddBuildingGeoState] = useState<'idle' | 'loading' | 'ok' | 'fail'>('idle')
  const [addBuildingLatLng, setAddBuildingLatLng] = useState<{ lat: number; lng: number } | null>(null)
  const [addBuildingSubmitting, setAddBuildingSubmitting] = useState(false)
  const [csvPreviewRows, setCsvPreviewRows] = useState<CsvPreviewRow[]>([])
  const [csvSkippedRows, setCsvSkippedRows] = useState(0)
  const [csvSkippedDetails, setCsvSkippedDetails] = useState<CsvSkippedRow[]>([])
  const [csvHeaders, setCsvHeaders] = useState<string[]>([])
  const [csvParsing, setCsvParsing] = useState(false)
  const [csvImporting, setCsvImporting] = useState(false)
  const [reassigningByBoundary, setReassigningByBoundary] = useState(false)
  const [reassigningChecked, setReassigningChecked] = useState(false)
  // "미배정 건물" 카드 ID (이 카드에 속한 건물 = 아직 구역 미지정)
  const unassignedCardId = useMemo(
    () => cards.find((c) => c.name === '미배정 건물')?.id ?? null,
    [cards],
  )
  const [bulkLeaderNames, setBulkLeaderNames] = useState<string[]>([])
  const [bulkAssigning, setBulkAssigning] = useState(false)
  const [pointVisitEditor, setPointVisitEditor] = useState<{
    mode: 'add' | 'edit'
    buildingId: number
    unitId: number
    historyId?: number
    label: string
    result: UnitStatus
    timeSlot: TimeSlot
    visitedAt: string
    memo: string
  } | null>(null)
  const [selectedPointDetail, setSelectedPointDetail] = useState<{ buildingId: number; unitId: number } | null>(null)
  const [selectedPointDetailOffset, setSelectedPointDetailOffset] = useState(386)
  const [openHistoryActionId, setOpenHistoryActionId] = useState<number | null>(null)
  const pointTableRef = useRef<HTMLDivElement | null>(null)
  const pointDetailPaneRef = useRef<HTMLElement | null>(null)
  const pointRowRefs = useRef<Map<string, HTMLDivElement>>(new Map())
  const boundaryImportInputRef = useRef<HTMLInputElement | null>(null)

  useEffect(() => {
    if (isAdmin && allUsers.length === 0) {
      fetchAllUsers()
    }
  }, [allUsers.length, fetchAllUsers, isAdmin])

  const cardMap = useMemo(() => new Map(cards.map((card) => [card.id, card])), [cards])
  const buildingsByCardId = useMemo(() => {
    const map = new Map<number, Building[]>()
    buildings.forEach((building) => {
      const list = map.get(building.cardId)
      if (list) list.push(building)
      else map.set(building.cardId, [building])
    })
    return map
  }, [buildings])
  const visitHistoriesByUnitId = useMemo(() => {
    const map = new Map<number, VisitHistory[]>()
    visitHistories.forEach((history) => {
      const list = map.get(history.unitId)
      if (list) list.push(history)
      else map.set(history.unitId, [history])
    })
    map.forEach((list) => {
      list.sort((a, b) => {
        const at = new Date(a.visitedAt).getTime()
        const bt = new Date(b.visitedAt).getTime()
        if (bt !== at) return bt - at
        return b.id - a.id
      })
    })
    return map
  }, [visitHistories])

  const openPointVisitEditor = (input: {
    building: Building
    unit: Unit
    history?: VisitHistory
  }) => {
    const { building, unit, history } = input
    setPointVisitEditor({
      mode: history ? 'edit' : 'add',
      buildingId: building.id,
      unitId: unit.id,
      historyId: history?.id,
      label: `${building.name || formatDisplayAddress(building.address)} · ${unit.number}`,
      result: history?.result ?? unit.status,
      timeSlot: history?.timeSlot ?? getDefaultTimeSlot(),
      visitedAt: history?.visitedAt?.slice(0, 10) ?? getTodayDateInputValue(),
      memo: history?.memo ?? unit.memo ?? '',
    })
  }

  const savePointVisitEditor = () => {
    if (!pointVisitEditor) return
    const payload = {
      result: pointVisitEditor.result,
      timeSlot: pointVisitEditor.timeSlot,
      memo: pointVisitEditor.memo,
      visitedAt: pointVisitEditor.visitedAt,
    }
    if (pointVisitEditor.mode === 'edit' && pointVisitEditor.historyId) {
      onUpdateVisitHistory(pointVisitEditor.historyId, pointVisitEditor.unitId, payload)
    } else {
      onAddVisitHistory(pointVisitEditor.buildingId, pointVisitEditor.unitId, payload)
    }
    setPointVisitEditor(null)
  }

  const deletePointVisitHistory = (history: VisitHistory) => {
    if (!onDeleteVisitHistory) return
    if (!window.confirm('이 방문 기록을 삭제할까요?')) return
    onDeleteVisitHistory(history.id, history.unitId)
    setOpenHistoryActionId(null)
  }

  const areaFilterOptions =
    regionFilter === '전체'
      ? Array.from(new Set(cards.map((card) => card.area))).sort()
      : territoryAreasByRegion[regionFilter]

  const getAreaCardCount = (area: string) =>
    cards.filter((card) => {
      if (card.area !== area) return false
      if (regionFilter !== '전체' && card.region !== regionFilter) return false
      return true
    }).length

  const getAreaMetricCount = (area: string) => {
    if (activeTab === '건물 관리' && buildingSubTab === '중국인 포인트') {
      return buildings.reduce((sum, building) => {
        const card = cardMap.get(building.cardId)
        if (!card || card.area !== area) return sum
        if (regionFilter !== '전체' && card.region !== regionFilter) return sum
        return sum + building.units.filter((unit) => unit.isChinese || unit.isRegularVisit).length
      }, 0)
    }

    if (activeTab === '건물 관리') {
      return buildings.reduce((sum, building) => {
        const card = cardMap.get(building.cardId)
        if (!card || card.area !== area) return sum
        if (regionFilter !== '전체' && card.region !== regionFilter) return sum
        return sum + 1
      }, 0)
    }

    return getAreaCardCount(area)
  }


  const getCardLeaderList = (card: TerritoryCard) =>
    (card.assignedLeaders && card.assignedLeaders.length > 0)
      ? card.assignedLeaders
      : card.assignedLeader
        ? [card.assignedLeader]
        : []

  const cardHasRegularVisit = (card: TerritoryCard) =>
    card.regularVisits > 0 ||
    card.regularVisitPoints.length > 0 ||
    (buildingsByCardId.get(card.id) ?? []).some((building) => building.units.some((unit) => unit.isRegularVisit))
  const cardChineseHeavyCount = (cardId: number) =>
    (buildingsByCardId.get(cardId) ?? []).filter((building) => building.isChineseHeavy).length

  const leaderFilterOptions = Array.from(
    new Set(cards.flatMap((card) => getCardLeaderList(card))),
  ).sort((a, b) => a.localeCompare(b, 'ko'))

  const filteredCards = cards.filter((card) => {
    const operationalState = getTerritoryCardOperationalState(card)
    if (regionFilter !== '전체' && card.region !== regionFilter) return false
    if (areaFilter !== '전체' && card.area !== areaFilter) return false
    const leaders = getCardLeaderList(card)
    if (assignmentFilter === '배정' && leaders.length === 0) return false
    if (assignmentFilter === '미배정' && leaders.length > 0) return false
    if (leaderFilter !== '전체' && !leaders.includes(leaderFilter)) return false
    const hasRegularVisit = cardHasRegularVisit(card)
    if (regularVisitFilter === '있음' && !hasRegularVisit) return false
    if (regularVisitFilter === '없음' && hasRegularVisit) return false
    const hasChineseHeavy = cardChineseHeavyCount(card.id) > 0
    if (cardChineseHeavyFilter === '있음' && !hasChineseHeavy) return false
    if (cardChineseHeavyFilter === '없음' && hasChineseHeavy) return false
    if (cardStatusFilter !== '전체') {
      if (cardStatusFilter === '완료·제외') {
        if (operationalState !== '완료' && operationalState !== '대상없음') return false
      } else {
        if (operationalState === '대상없음') return false
        if (card.status !== cardStatusFilter) return false
      }
    }
    return true
  }).sort(compareTerritoryCardsByOperationalPriority)
  const isDoneExcludedCard = (card: TerritoryCard) => {
    const state = getTerritoryCardOperationalState(card)
    return state === '완료' || state === '대상없음'
  }
  const doneExcludedCards = cardStatusFilter === '완료·제외'
    ? []
    : filteredCards.filter(isDoneExcludedCard)
  const renderedCards = cardStatusFilter === '완료·제외' || doneExcludedOpen
    ? filteredCards
    : filteredCards.filter((card) => !isDoneExcludedCard(card))
  const selectedMergeCards = cards.filter((card) => checkedCardIds.has(card.id))

  const activeAdvancedCardFilterCount =
    (leaderFilter !== '전체' ? 1 : 0) +
    (regularVisitFilter !== '전체' ? 1 : 0) +
    (cardChineseHeavyFilter !== '전체' ? 1 : 0) +
    (cardStatusFilter !== '전체' ? 1 : 0)
  const activeAdvancedBuildingFilterCount =
    (buildingRegularFilter !== '전체' ? 1 : 0) +
    (buildingMemoFilter !== '전체' ? 1 : 0) +
    (buildingChineseHeavyFilter !== '전체' ? 1 : 0)
  const activeAdvancedPointFilterCount =
    (pointRegularFilter !== '전체' ? 1 : 0) +
    (pointMemoFilter !== '전체' ? 1 : 0)

  const selectedCard =
    filteredCards.find((card) => card.id === selectedCardId) ??
    filteredCards[0] ??
    cards.find((card) => card.id === selectedCardId) ??
    cards[0] ??
    null
  const selectedCardBuildings = selectedCard ? buildingsByCardId.get(selectedCard.id) ?? [] : []
  const selectedChinesePointCount = selectedCardBuildings.reduce(
    (sum, building) => sum + building.units.filter((unit) => unit.isChinese).length,
    0,
  )
  const selectedHasBoundary = selectedCard
    ? cardBoundaries.some((boundary) => boundary.cardId === selectedCard.id)
    : false
  // 마지막 방문 정보 (선택한 카드 내의 모든 unit 방문 중 가장 최근)
  const selectedLastVisit = useMemo(() => {
    if (!selectedCard) return null
    const cardUnitIds = new Set(
      selectedCardBuildings.flatMap((b) => b.units.map((u) => u.id))
    )
    let latest: VisitHistory | null = null
    for (const v of visitHistories) {
      if (!cardUnitIds.has(v.unitId)) continue
      if (!latest || v.visitedAt > latest.visitedAt) latest = v
    }
    return latest
  }, [selectedCard, selectedCardBuildings, visitHistories])
  const leaderOptions = Array.from(
    new Set(
      allUsers
        .filter((user) => user.role === 'leader' || user.role === 'admin')
        .map((user) => user.name)
        .concat(
          cards.flatMap((card) => getCardLeaderList(card)),
        ),
    ),
  ).sort((a, b) => a.localeCompare(b, 'ko'))

  const toggleCardLeader = async (cardId: number, leaderName: string) => {
    const targetCard = cards.find((card) => card.id === cardId)
    if (!targetCard) return
    const current = getCardLeaderList(targetCard)
    const next = current.includes(leaderName)
      ? current.filter((name) => name !== leaderName)
      : [...current, leaderName]
    await Promise.resolve(onSetCardLeaders(cardId, next))
  }

  const toggleBulkLeaderName = (leaderName: string) => {
    setBulkLeaderNames((current) =>
      current.includes(leaderName)
        ? current.filter((name) => name !== leaderName)
        : [...current, leaderName],
    )
  }

  const handleAssignLeaderBulk = async () => {
    const targetIds = Array.from(checkedCardIds)
    if (targetIds.length === 0) {
      showToast('먼저 카드를 선택해 주세요.', 'error')
      return
    }
    const actionLabel = bulkLeaderNames.length > 0
      ? `'${bulkLeaderNames.join(', ')}' 인도자로 배정`
      : '인도자 배정 해제'
    const confirmed = window.confirm(`선택한 카드 ${targetIds.length}개를 ${actionLabel}할까요?`)
    if (!confirmed) return

    setBulkAssigning(true)
    try {
      await Promise.resolve(onSetMultipleCardLeaders(targetIds, bulkLeaderNames, { silentSuccess: true }))
      showToast(
        bulkLeaderNames.length > 0
          ? `선택 카드 ${targetIds.length}개에 인도자를 배정했습니다.`
          : `선택 카드 ${targetIds.length}개의 인도자 배정을 해제했습니다.`,
        'success',
      )
      setCheckedCardIds(new Set())
    } finally {
      setBulkAssigning(false)
    }
  }

  const hasText = (value?: string | null) => Boolean(value?.trim())
  const buildingHasRegularVisit = (building: Building) => building.units.some((unit) => unit.isRegularVisit)
  const buildingHasMemo = (building: Building) =>
    hasText(building.memo) || building.units.some((unit) => hasText(unit.memo))
  const baseFilteredBuildings = buildings.filter((building) => {
    const card = cardMap.get(building.cardId)
    if (!card) return false
    if (regionFilter !== '전체' && card.region !== regionFilter) return false
    if (areaFilter !== '전체' && card.area !== areaFilter) return false
    if (buildingCardFilter !== '전체' && building.cardId !== buildingCardFilter) return false
    if (buildingTypeFilter !== '전체' && building.type !== buildingTypeFilter) return false
    return true
  })
  const filteredBuildings = baseFilteredBuildings.filter((building) => {
    const hasRegular = buildingHasRegularVisit(building)
    if (buildingRegularFilter === '있음' && !hasRegular) return false
    if (buildingRegularFilter === '없음' && hasRegular) return false
    const hasMemo = buildingHasMemo(building)
    if (buildingMemoFilter === '있음' && !hasMemo) return false
    if (buildingMemoFilter === '없음' && hasMemo) return false
    if (buildingChineseHeavyFilter === '있음' && !building.isChineseHeavy) return false
    if (buildingChineseHeavyFilter === '없음' && building.isChineseHeavy) return false
    return true
  })
  // 건물 추가 — 카드 자동 매칭 (동 이름 기준)
  const findCardForAddress = (address: string): number | null => {
    if (filteredCards.length === 0) return null
    // 주소에서 동 이름 추출
    const dongMatch = address.match(/([가-힣]+동)/)
    if (dongMatch) {
      const dong = dongMatch[1]
      const found = cards.find((c) => c.area.includes(dong) || dong.includes(c.area))
      if (found) return found.id
    }
    return filteredCards[0]?.id ?? null
  }

  const handleAddBuildingSubmit = async () => {
    if (!addBuildingForm.address.trim() || !onCreateBuilding) return
    setAddBuildingSubmitting(true)

    // 1. 좌표 확보 (이미 찾았으면 재사용)
    let latLng = addBuildingLatLng
    if (!latLng) {
      setAddBuildingGeoState('loading')
      latLng = await geocodeAddress(addBuildingForm.address)
      setAddBuildingGeoState(latLng ? 'ok' : 'fail')
    }

    // 2. 카드 자동 배정: 좌표 → 경계선 매칭 → 동 이름 매칭 → 첫 번째 카드 순
    let cardId: number
    if (addBuildingForm.cardId !== 'auto') {
      cardId = addBuildingForm.cardId
    } else if (latLng) {
      const byBoundary = findCardForCoordinates(latLng.lat, latLng.lng, cardBoundaries)
      if (byBoundary) {
        cardId = byBoundary
        const matchedCard = cards.find((c) => c.id === byBoundary)
        if (matchedCard) showToast(`"${matchedCard.name}" 카드에 자동 배정됐습니다`, 'success')
      } else {
        cardId = findCardForAddress(addBuildingForm.address) ?? cards[0]?.id ?? 0
      }
    } else {
      cardId = findCardForAddress(addBuildingForm.address) ?? cards[0]?.id ?? 0
    }

    await onCreateBuilding({
      cardId,
      name: addBuildingForm.name,
      address: addBuildingForm.address,
      type: addBuildingForm.type,
      lat: latLng?.lat ?? 0,
      lng: latLng?.lng ?? 0,
    })
    setAddBuildingOpen(false)
    setAddBuildingForm({ name: '', address: '', type: '주택', cardId: 'auto' })
    setAddBuildingLatLng(null)
    setAddBuildingGeoState('idle')
    setAddBuildingSubmitting(false)
  }

  // 정렬 적용
  const naturalCompare = (x: string, y: string) =>
    x.localeCompare(y, 'ko', { numeric: true, sensitivity: 'base' })

  const sortedBuildings = [...filteredBuildings].sort((a, b) => {
    // 미배정 건물은 별도 필터 없을 때 항상 맨 위
    if (buildingCardFilter === '전체' && unassignedCardId) {
      const aIsUnassigned = a.cardId === unassignedCardId
      const bIsUnassigned = b.cardId === unassignedCardId
      if (aIsUnassigned && !bIsUnassigned) return -1
      if (!aIsUnassigned && bIsUnassigned) return 1
    }
    const dir = buildingSort.dir === 'asc' ? 1 : -1
    if (buildingSort.key === '카드') {
      const cardA = cardMap.get(a.cardId)?.name ?? ''
      const cardB = cardMap.get(b.cardId)?.name ?? ''
      return naturalCompare(cardA, cardB) * dir
    }
    if (buildingSort.key === '건물') return naturalCompare(a.name, b.name) * dir
    if (buildingSort.key === '주소') return naturalCompare(a.address, b.address) * dir
    if (buildingSort.key === '유형') return naturalCompare(a.type, b.type) * dir
    return 0
  })

  // const buildingUnitsTotal = filteredBuildings.reduce((sum, building) => sum + building.units.length, 0)

  // 중복 주소 그룹 탐지 (필터된 건물 기준)
  // 주소 정규화: 공백 통일, 소문자, 숫자 앞뒤 공백 제거 (진덕로19-3 == 진덕로 19-3)
  const normalizeAddress = (addr: string) =>
    addr.trim().toLowerCase().replace(/\s+/g, '').replace(/[-‐]/g, '-')

  const duplicateAddressGroups = (() => {
    const groupMap = new Map<string, Building[]>()
    for (const b of filteredBuildings) {
      const key = `${b.cardId}::${normalizeAddress(b.address)}`
      if (!groupMap.has(key)) groupMap.set(key, [])
      groupMap.get(key)!.push(b)
    }
    return Array.from(groupMap.values()).filter((g) => g.length > 1)
  })()
  const duplicateBuildingIds = new Set(duplicateAddressGroups.flatMap((g) => g.map((b) => b.id)))
  const pointRows = baseFilteredBuildings.flatMap((building) =>
    building.units
      .filter((unit) => unit.isChinese || unit.isRegularVisit)
      .map((unit) => {
        const histories = visitHistoriesByUnitId.get(unit.id) ?? []
        return { building, unit, latestHistory: histories[0] }
      }),
  ).filter(({ unit }) => {
    if (pointStatusFilter !== '전체' && unit.status !== pointStatusFilter) return false
    if (pointRegularFilter === '있음' && !unit.isRegularVisit) return false
    if (pointRegularFilter === '없음' && unit.isRegularVisit) return false
    const hasMemo = hasText(unit.memo)
    if (pointMemoFilter === '있음' && !hasMemo) return false
    if (pointMemoFilter === '없음' && hasMemo) return false
    return true
  })
  const selectedPointDetailData = useMemo(() => {
    if (!selectedPointDetail) return null
    const building = buildings.find((item) => item.id === selectedPointDetail.buildingId)
    const unit = building?.units.find((item) => item.id === selectedPointDetail.unitId)
    if (!building || !unit) return null
    const card = cardMap.get(building.cardId)
    const histories = visitHistoriesByUnitId.get(unit.id) ?? []
    const rowIndex = pointRows.findIndex((row) => row.building.id === building.id && row.unit.id === unit.id)
    return { building, unit, card, histories, rowIndex }
  }, [buildings, cardMap, pointRows, selectedPointDetail, visitHistoriesByUnitId])
  const selectedPointDetailKey = selectedPointDetail
    ? `${selectedPointDetail.buildingId}-${selectedPointDetail.unitId}`
    : null

  useEffect(() => {
    if (!selectedPointDetailKey || !selectedPointDetailData) return

    const updatePointDetailOffset = () => {
      const rowEl = pointRowRefs.current.get(selectedPointDetailKey)
      const tableEl = pointTableRef.current
      const paneEl = pointDetailPaneRef.current
      const layoutEl = tableEl?.closest('.territory-layout') as HTMLElement | null
      if (!rowEl || !tableEl || !paneEl || !layoutEl) return

      const rowRect = rowEl.getBoundingClientRect()
      const tableRect = tableEl.getBoundingClientRect()
      const layoutRect = layoutEl.getBoundingClientRect()
      const layoutStyle = window.getComputedStyle(layoutEl)
      const layoutPaddingTop = parseFloat(layoutStyle.paddingTop) || 0
      const layoutContentTop = layoutRect.top + layoutPaddingTop
      const paneHeight = Math.min(paneEl.scrollHeight || paneEl.getBoundingClientRect().height, window.innerHeight - 132)
      const desiredTop = rowRect.top
      const minTop = tableRect.top
      const maxTop = Math.max(minTop, tableRect.bottom - paneHeight)
      const clampedTop = Math.max(minTop, Math.min(desiredTop, maxTop))
      const nextOffset = Math.max(0, Math.round(clampedTop - layoutContentTop))
      setSelectedPointDetailOffset((current) => current === nextOffset ? current : nextOffset)
    }

    const frame = window.requestAnimationFrame(updatePointDetailOffset)
    window.addEventListener('resize', updatePointDetailOffset)
    window.addEventListener('scroll', updatePointDetailOffset, true)
    return () => {
      window.cancelAnimationFrame(frame)
      window.removeEventListener('resize', updatePointDetailOffset)
      window.removeEventListener('scroll', updatePointDetailOffset, true)
    }
  }, [selectedPointDetailData, selectedPointDetailKey])
  // const chinesePointTotal = pointRows.filter(({ unit }) => unit.isChinese).length
  // const regularPointTotal = pointRows.filter(({ unit }) => unit.isRegularVisit).length
  const startBuildingEdit = (building: Building) => {
    setEditingBuildingId(building.id)
    setBuildingEditDraft({
      name: building.name,
      address: building.address,
      type: building.type,
      cardId: building.cardId,
      memo: building.memo ?? '',
    })
  }
  const saveBuildingEdit = (building: Building) => {
    const nextCardId = buildingEditDraft.cardId || building.cardId
    onUpdateBuilding(
      building.id,
      buildingEditDraft.name.trim(),
      buildingEditDraft.address.trim(),
      undefined,
      undefined,
      buildingEditDraft.type,
      buildingEditDraft.memo,
    )
    if (nextCardId !== building.cardId) {
      onMoveBuildingToCard(building.id, nextCardId)
    }
    setEditingBuildingId(null)
  }

  const toggleChineseHeavyBuilding = (building: Building) => {
    onUpdateBuilding(
      building.id,
      building.name,
      building.address,
      undefined,
      undefined,
      undefined,
      undefined,
      !building.isChineseHeavy,
    )
  }

  const totalCards = cards.length
  const assignedCards = cards.filter((card) => getCardLeaderList(card).length > 0).length
  const totalUnits = cards.reduce((sum, card) => sum + card.units, 0)
  const completedUnits = cards.reduce((sum, card) => sum + card.completed, 0)

  const getGeocodeCandidates = (address: string) => {
    const normalized = address.replace(/\s+/g, ' ').trim()
    const tokens = normalized.split(' ')
    const isDongToken = (token: string) => /동$/.test(token)
    const isRoadToken = (token: string) => /(로|길)/.test(token)
    const withoutDongBeforeRoad = tokens
      .filter((token, index) => !(isDongToken(token) && tokens.slice(index + 1).some(isRoadToken)))
      .join(' ')
    const withoutGyeonggiDo = normalized.replace(/^경기도\s+/, '경기 ')
    const withoutGyeonggiDoAndDong = withoutDongBeforeRoad.replace(/^경기도\s+/, '경기 ')

    return Array.from(
      new Set([
        normalized,
        withoutDongBeforeRoad,
        withoutGyeonggiDo,
        withoutGyeonggiDoAndDong,
      ].filter(Boolean)),
    )
  }

  const geocodeAddress = (address: string) =>
    new Promise<{ lat: number; lng: number } | null>((resolve) => {
      const naver = (window as any).naver
      if (!naver?.maps?.Service || !address.trim()) {
        resolve(null)
        return
      }
      const candidates = getGeocodeCandidates(address)
      const tryCandidate = (index: number) => {
        const query = candidates[index]
        if (!query) {
          resolve(null)
          return
        }
        naver.maps.Service.geocode({ query }, (status: any, response: any) => {
          if (status === naver.maps.Service.Status.OK && response.v2?.addresses?.length > 0) {
            const result = response.v2.addresses[0]
            const coordinates = normalizeMapCoordinates(Number(result.y), Number(result.x))
            if (coordinates) {
              resolve(coordinates)
              return
            }
          }
          tryCandidate(index + 1)
        })
      }
      tryCandidate(0)
    })

  const parseCsvFile = async (file: File) => {
    setCsvParsing(true)
    setCsvPreviewRows([])
    setCsvSkippedRows(0)
    setCsvSkippedDetails([])
    setCsvHeaders([])

    const rows = parseCsv(await file.text())
    if (rows.length < 2) {
      setCsvParsing(false)
      showToast('CSV에 헤더와 데이터 행이 필요합니다.', 'error')
      return
    }

    const headers = rows[0]
    setCsvHeaders(headers)
    const normalizedHeaders = headers.map(normalizeCsvKey)
    const findValue = (row: string[], keys: string[]) => {
      const normalizedKeys = keys.map(normalizeCsvKey)
      const index = normalizedHeaders.findIndex((header) => normalizedKeys.includes(header))
      return index >= 0 ? row[index]?.trim() ?? '' : ''
    }

    const previewRows: CsvPreviewRow[] = []
    const skippedDetails: CsvSkippedRow[] = []
    let skipped = 0
    const skipRow = (rowNumber: number, reason: string, hint: string, address?: string, rawRow?: string[]) => {
      skipped += 1
      skippedDetails.push({ rowNumber, reason, hint, address, rawRow })
    }

    // buildingKey → accumulated data (group rows by building)
    type AccumUnit = {
      status: UnitStatus
      isChinese: boolean
      regularVisitor: string
      regularVisitorStartDate: string
      memo: string
      visitHistories: CsvVisitHistory[]
    }
    type AccumBuilding = {
      rowNumber: number
      cardId: number
      cardName: string
      name: string
      address: string
      type: CsvBuildingImport['type']
      lat: number
      lng: number
      warning: string
      units: Map<string, AccumUnit>
    }
    const buildingAccumulator = new Map<string, AccumBuilding>()

    for (const [index, row] of rows.slice(1).entries()) {
      const rowNumber = index + 2
      const cardIdValue = findValue(row, ['cardId', 'card_id', '카드ID', '카드아이디'])
      const cardNameValue = findValue(row, ['card', 'cardName', '카드', '카드명', '구역카드'])
      const regionValue = findValue(row, ['region', '지역', '대권역', '구', '시군구'])
      const fullRegionValue = findValue(row, ['지역명', '전체지역명'])
      const areaValue = findValue(row, ['area', 'dong', '동', '법정동'])
      const cardIndexValue = findValue(row, ['cardIndex', 'cardNo', '카드번호', '카드순번', '카드'])
      const rawAddressValue = findValue(row, ['address', '주소'])
      const detailAddressValue = findValue(row, ['detailAddress', '상세주소', '건물명상세주소', '건물명/상세주소'])
      const address = rawAddressValue.startsWith('경기') || rawAddressValue.startsWith('서울') || rawAddressValue.startsWith('인천')
        ? rawAddressValue
        : [fullRegionValue, rawAddressValue].filter(Boolean).join(' ')
      const nameValue = findValue(row, ['name', 'buildingName', '건물명', '건물']) || detailAddressValue
      const typeValue = findValue(row, ['type', '유형', '건물유형'])
      const unitsValue = findValue(row, ['unit', 'units', '호수', '세대', '호수목록'])
      const statusValue = findValue(row, ['status', '상태'])
      const divisionValue = findValue(row, ['구분', 'division'])
      const chineseValue = findValue(row, ['chinese', 'isChinese', '중국인', '중국인여부'])
      const warningValue = findValue(row, ['warning', '방문금지', '경고'])
      const regularVisitorValue = findValue(row, ['regularVisitor', 'regular', '정기방문자', '재방문자', '정기방문'])
      const regularStartValue = findValue(row, ['정기방문시작일', '정기방문시작', 'regularStart', 'regularVisitorStartDate'])
      const memoValue = findValue(row, ['memo', 'note', '메모', '비고', '备注'])
      const latValue = findValue(row, ['lat', 'latitude', '위도'])
      const lngValue = findValue(row, ['lng', 'lon', 'longitude', '경도'])
      // 방문기록 컬럼
      const visitDateValue = findValue(row, ['방문일자', 'visitDate', 'visited_at', '방문날짜'])
      const visitResultValue = findValue(row, ['방문결과', 'visitResult', 'result'])
      const visitVisitorValue = findValue(row, ['방문자', 'visitor', 'visitVisitor'])
      const visitTimeSlotValue = findValue(row, ['시간대', 'timeSlot', 'time_slot'])
      const visitMemoValue = findValue(row, ['방문메모', 'visitMemo', 'visitNote'])

      const inferredRegion = territoryRegions.find((region) => regionValue === region || fullRegionValue.includes(region))
      const inferredArea = areaValue || cards.find((item) => item.area && detailAddressValue.includes(item.area))?.area
      const inferredCardName = inferredRegion && inferredArea && cardIndexValue
        ? `${inferredRegion} ${inferredArea} ${cardIndexValue}`
        : ''
      const cardById = cardIdValue
        ? cards.find((item) => item.id === Number(cardIdValue))
        : undefined
      const cardByName = cards.find((item) =>
            item.name === cardNameValue ||
            item.name === inferredCardName ||
            `${item.region} ${item.area}` === cardNameValue,
          )
      const explicitCard = cardById ?? cardByName

      if (!address) {
        skipRow(rowNumber, '주소 없음', '`주소` 컬럼에 지번/도로명 주소를 넣어 주세요.', undefined, row)
        continue
      }

      if (cardIdValue && !cardById) {
        skipRow(
          rowNumber,
          '카드 ID 매칭 실패',
          'CSV의 cardId/카드ID가 앱의 실제 카드 ID와 일치하는지 확인하거나, 카드 ID 칸을 비워 주소 기반 자동 배정을 사용해 주세요.',
          address,
          row
        )
        continue
      }

      let coordinates = normalizeMapCoordinates(parseCoordinate(latValue), parseCoordinate(lngValue))
      if (!coordinates) {
        const geocoded = await geocodeAddress(address)
        if (!geocoded) {
          skipRow(rowNumber, '주소 좌표 변환 실패', '주소를 더 자세히 쓰거나 위도/경도를 직접 입력해 주세요.', address, row)
          continue
        }
        coordinates = geocoded
      }
      const { lat, lng } = coordinates

      const autoCardId = explicitCard ? null : findCardForCoordinates(lat, lng, cardBoundaries)
      let card = explicitCard ?? cards.find((item) => item.id === autoCardId)

      if (!card && unassignedCardId) {
        card = cards.find((item) => item.id === unassignedCardId)
      }

      if (!card) {
        skipRow(
          rowNumber,
          '자동 카드 배정 실패',
          'CSV에 카드명을 직접 넣거나, 해당 주소가 포함되는 카드 구역선을 먼저 그려 주세요. (미배정 건물 카드도 없습니다)',
          address,
          row
        )
        continue
      }

      const buildingName = nameValue || address.split(' ').slice(-2).join(' ') || '새 건물'
      const buildingType: CsvBuildingImport['type'] = typeValue.includes('상가') ? '상가' : '주택'
      const buildingKey = `${card.id}|${address}|${buildingName}`

      // 구분 컬럼: 한국인 → false, 중국인 → true, 없으면 heuristic
      const status = normalizeUnitStatus(statusValue)
      let isChinese: boolean
      if (divisionValue === '한국인') {
        isChinese = false
      } else if (divisionValue === '중국인') {
        isChinese = true
      } else if (chineseValue) {
        isChinese = looksTruthy(chineseValue)
      } else {
        isChinese = Boolean(regularVisitorValue) || status === '만남' || status === '부재'
      }

      // 방문기록 파싱
      const visitedAt = visitDateValue ? parseCsvDate(visitDateValue) : null
      const visitHistory: CsvVisitHistory | null = visitedAt
        ? {
          visitedAt,
          result: normalizeUnitStatus(visitResultValue || statusValue) as string,
          visitor: visitVisitorValue,
          timeSlot: normalizeTimeSlot(visitTimeSlotValue),
          memo: visitMemoValue || undefined,
        }
        : null

      // 건물 누산
      if (!buildingAccumulator.has(buildingKey)) {
        buildingAccumulator.set(buildingKey, {
          rowNumber,
          cardId: card.id,
          cardName: card.name,
          name: buildingName,
          address,
          type: buildingType,
          lat,
          lng,
          warning: normalizeWarning(warningValue) ?? '',
          units: new Map(),
        })
      }
      const accum = buildingAccumulator.get(buildingKey)!
      // warning: if any row sets it, keep it
      if (!accum.warning && warningValue) {
        accum.warning = normalizeWarning(warningValue) ?? ''
      }

      // 세대 누산
      const unitNumber = unitsValue.trim() || '101호'
      if (!accum.units.has(unitNumber)) {
        accum.units.set(unitNumber, {
          status,
          isChinese,
          regularVisitor: regularVisitorValue,
          regularVisitorStartDate: regularStartValue ? (parseCsvDate(regularStartValue) ?? regularStartValue) : '',
          memo: memoValue,
          visitHistories: [],
        })
      }
      if (visitHistory) {
        accum.units.get(unitNumber)!.visitHistories.push(visitHistory)
      }
    }

    // buildingAccumulator → previewRows
    for (const accum of buildingAccumulator.values()) {
      const builtUnits = Array.from(accum.units.entries()).map(([number, u]) => {
        // 방문기록이 있으면 가장 최신 날짜 기준으로 상태 결정
        let finalStatus = u.status
        if (u.visitHistories.length > 0) {
          const sorted = [...u.visitHistories].sort((a, b) => b.visitedAt.localeCompare(a.visitedAt))
          const latestResult = sorted[0]!.result
          if (latestResult && latestResult !== '미방문') finalStatus = latestResult as typeof finalStatus
        }
        return {
          number,
          status: finalStatus,
          isChinese: u.isChinese,
          isRegularVisit: Boolean(u.regularVisitor),
          regularVisitor: u.regularVisitor || undefined,
          regularVisitorStartDate: u.regularVisitorStartDate || undefined,
          memo: u.memo || undefined,
          visitHistories: u.visitHistories,
        }
      }).sort((a, b) => compareUnitNumbers(a.number, b.number))

      previewRows.push({
        rowNumber: accum.rowNumber,
        cardId: accum.cardId,
        cardName: accum.cardName,
        name: accum.name,
        address: accum.address,
        type: accum.type,
        lat: accum.lat,
        lng: accum.lng,
        warning: accum.warning || undefined,
        units: builtUnits.length > 0 ? builtUnits : [{ number: '101호', status: '미방문', isChinese: false, isRegularVisit: false, regularVisitor: undefined, regularVisitorStartDate: undefined, memo: undefined, visitHistories: [] }],
      })
    }

    setCsvPreviewRows(previewRows)
    setCsvSkippedRows(skipped)
    setCsvSkippedDetails(skippedDetails)
    setCsvParsing(false)
    const totalVisits = previewRows.reduce((sum, r) => sum + r.units.reduce((s, u) => s + u.visitHistories.length, 0), 0)
    const visitMsg = totalVisits > 0 ? `, 방문기록 ${totalVisits}건` : ''
    showToast(`CSV 확인 완료: 건물 ${previewRows.length}개 준비${visitMsg}, ${skipped}개 제외`, previewRows.length > 0 ? 'success' : 'info')
  }

  const handleImportCsv = async () => {
    if (csvPreviewRows.length === 0 || csvImporting) return
    setCsvImporting(true)
    await onImportBuildings(csvPreviewRows)
    setCsvImporting(false)
    setShowCsvModal(false)
    setCsvPreviewRows([])
    setCsvSkippedRows(0)
    setCsvSkippedDetails([])
  }

  const exportCsvCell = (value: string | number | boolean | null | undefined) => {
    const text = value == null ? '' : String(value)
    return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text
  }

  const downloadFilteredBuildingCsv = () => {
    const isPointList = buildingSubTab === '중국인 포인트'
    const headers = isPointList
      ? ['카드명', '지역', '동', '건물명', '주소', '유형', '호수', '정기방문', '정기방문자', '최근 방문', '메모']
      : ['카드명', '지역', '동', '건물명', '주소', '유형', '세대', '중국인', '중국인 다수', '정기방문', '건물 메모', '세대 메모']
    const rows = isPointList
      ? pointRows.map(({ building, unit, latestHistory }) => {
          const card = cardMap.get(building.cardId)
          return [
            card?.name ?? '',
            card?.region ?? '',
            card?.area ?? '',
            building.name,
            building.address,
            building.type,
            unit.number,
            unit.isRegularVisit ? 'Y' : '',
            unit.regularVisitor ?? '',
            latestHistory ? `${latestHistory.visitedAt.slice(0, 10)} ${latestHistory.timeSlot} ${latestHistory.result}` : '',
            unit.memo ?? '',
          ]
        })
      : sortedBuildings.map((building) => {
          const card = cardMap.get(building.cardId)
          const chineseCount = building.units.filter((unit) => unit.isChinese).length
          const regularCount = building.units.filter((unit) => unit.isRegularVisit).length
          const unitMemos = building.units
            .filter((unit) => hasText(unit.memo))
            .map((unit) => `${unit.number}: ${unit.memo}`)
            .join(' / ')
          return [
            card?.name ?? '',
            card?.region ?? '',
            card?.area ?? '',
            building.name,
            building.address,
            building.type,
            building.units.length,
            chineseCount,
            building.isChineseHeavy ? 'Y' : '',
            regularCount,
            building.memo ?? '',
            unitMemos,
          ]
        })
    const csvContent = [headers, ...rows].map((row) => row.map(exportCsvCell).join(',')).join('\n')
    const blob = new Blob(['﻿' + csvContent], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    const suffix = new Date().toISOString().slice(0, 10)
    link.href = url
    link.download = isPointList ? `chinese_points_${suffix}.csv` : `buildings_${suffix}.csv`
    link.style.visibility = 'hidden'
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
    showToast(`${isPointList ? pointRows.length : sortedBuildings.length}개 항목을 내보냈습니다.`, 'success')
  }

  const handleReassignByBoundary = async () => {
    if (reassigningByBoundary) return
    const updates = buildings.flatMap((building) => {
      const lat = Number(building.lat)
      const lng = Number(building.lng)
      if (!isValidMapCoordinate(lat, lng)) return []
      const matchedCardId = findCardForCoordinates(lat, lng, cardBoundaries)
      if (!matchedCardId || matchedCardId === building.cardId) return []
      return [{ buildingId: building.id, cardId: matchedCardId }]
    })

    if (updates.length === 0) {
      showToast('좌표 기준으로 바꿀 건물이 없습니다.', 'info')
      return
    }

    const confirmed = window.confirm(`핀 좌표 기준으로 건물 ${updates.length}개의 카드를 다시 배정할까요?`)
    if (!confirmed) return
    setReassigningByBoundary(true)
    await onReassignBuildingsToCards(updates)
    setReassigningByBoundary(false)
  }

  // 선택된 건물만 좌표 기준 재배정 (미배정 필터 사용 시)
  const handleReassignCheckedByBoundary = async () => {
    if (reassigningChecked || checkedBuildingIds.size === 0) return
    const checkedBuildings = buildings.filter((b) => checkedBuildingIds.has(b.id))
    const updates: Array<{ buildingId: number; cardId: number }> = []
    let noCoords = 0
    let outsideBounds = 0

    for (const building of checkedBuildings) {
      const lat = Number(building.lat)
      const lng = Number(building.lng)
      if (!isValidMapCoordinate(lat, lng)) { noCoords++; continue }
      const matchedCardId = findCardForCoordinates(lat, lng, cardBoundaries)
      if (!matchedCardId) { outsideBounds++; continue }
      if (matchedCardId !== building.cardId) updates.push({ buildingId: building.id, cardId: matchedCardId })
    }

    if (updates.length === 0) {
      const msgs = []
      if (noCoords > 0) msgs.push(`좌표 없음 ${noCoords}개`)
      if (outsideBounds > 0) msgs.push(`구역선 밖 ${outsideBounds}개`)
      showToast(`재배정 가능한 건물이 없습니다. (${msgs.join(', ') || '이미 올바른 카드'})`, 'info')
      return
    }

    const parts = [`${updates.length}개 재배정 예정`]
    if (noCoords > 0) parts.push(`좌표없음 ${noCoords}개 건너뜀`)
    if (outsideBounds > 0) parts.push(`구역선밖 ${outsideBounds}개 건너뜀`)
    const confirmed = window.confirm(parts.join(' · ') + '\n\n계속할까요?')
    if (!confirmed) return

    setReassigningChecked(true)
    await onReassignBuildingsToCards(updates)
    setReassigningChecked(false)
    setCheckedBuildingIds(new Set())
  }

  const toggleCheckedCard = (cardId: number) => {
    setCheckedCardIds((current) => {
      const next = new Set(current)
      if (next.has(cardId)) next.delete(cardId)
      else next.add(cardId)
      return next
    })
  }

  const toggleCheckedBuilding = (buildingId: number) => {
    setCheckedBuildingIds((current) => {
      const next = new Set(current)
      if (next.has(buildingId)) next.delete(buildingId)
      else next.add(buildingId)
      return next
    })
  }

  const toggleAllFilteredCards = () => {
    setCheckedCardIds((current) => {
      const visibleIds = filteredCards.map((card) => card.id)
      const allVisibleChecked = visibleIds.length > 0 && visibleIds.every((id) => current.has(id))
      const next = new Set(current)
      visibleIds.forEach((id) => {
        if (allVisibleChecked) next.delete(id)
        else next.add(id)
      })
      return next
    })
  }

  const toggleAllFilteredBuildings = () => {
    setCheckedBuildingIds((current) => {
      const visibleIds = filteredBuildings.map((building) => building.id)
      const allVisibleChecked = visibleIds.length > 0 && visibleIds.every((id) => current.has(id))
      const next = new Set(current)
      visibleIds.forEach((id) => {
        if (allVisibleChecked) next.delete(id)
        else next.add(id)
      })
      return next
    })
  }

  const handleDeleteCheckedCards = () => {
    const ids = Array.from(checkedCardIds)
    if (ids.length === 0) return
    const idSet = new Set(ids)
    const relatedBuildingCount = buildings.filter((building) => idSet.has(building.cardId)).length
    const confirmed = window.confirm(`선택한 카드 ${ids.length}개를 삭제할까요?\n이 카드에 속한 건물 ${relatedBuildingCount}개도 함께 삭제됩니다.`)
    if (!confirmed) return
    onDeleteCards(ids)
    setCheckedCardIds(new Set())
    if (selectedCardId && ids.includes(selectedCardId)) setSelectedCardId(null)
  }

  const handleExportCardBoundaries = () => {
    downloadCardBoundaryBackup(cards, cardBoundaries)
    showToast('구역선 백업 파일을 내보냈습니다.', 'success')
  }

  const handleImportCardBoundaries = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file || !onRestoreCardBoundaries) return
    try {
      const text = await file.text()
      const boundaries = parseCardBoundaryBackup(text)
      if (boundaries.length === 0) {
        showToast('가져올 구역선이 없습니다.', 'error')
        return
      }
      const confirmed = window.confirm(`백업 파일의 구역선 ${boundaries.length}개를 현재 카드에 복구할까요?`)
      if (!confirmed) return
      await Promise.resolve(onRestoreCardBoundaries(boundaries))
    } catch (error) {
      console.error(error)
      showToast('구역선 백업 파일을 읽지 못했습니다.', 'error')
    }
  }

  const handleOpenCardMergeModal = () => {
    if (!onMergeCardBoundaries) return
    const ids = Array.from(checkedCardIds)
    if (ids.length < 2) {
      showToast('병합할 카드를 2개 이상 선택해 주세요.', 'error')
      return
    }
    const firstWithBoundary = ids.find((id) => cardBoundaries.some((boundary) => boundary.cardId === id))
    setCardMergeTargetId(firstWithBoundary ?? ids[0] ?? null)
    setCardMergeModalOpen(true)
  }

  const handleApplyCardMerge = async () => {
    if (!onMergeCardBoundaries || !cardMergeTargetId) return
    const selectedIds = Array.from(checkedCardIds)
    const targetCard = cards.find((card) => card.id === cardMergeTargetId)
    if (!targetCard || selectedIds.length < 2) return

    const selectedBoundaries = selectedIds
      .map((id) => cardBoundaries.find((boundary) => boundary.cardId === id))
      .filter((boundary): boundary is CardBoundary => Boolean(boundary))

    if (selectedBoundaries.length < 2) {
      showToast('구역선이 있는 카드를 2개 이상 선택해야 병합할 수 있습니다.', 'error')
      return
    }

    const mergeResult = mergeCardBoundaryPoints(selectedBoundaries)
    if (!mergeResult || mergeResult.points.length < 3) {
      showToast('선택한 구역선을 병합하지 못했습니다.', 'error')
      return
    }

    const confirmed = window.confirm(
      `${targetCard.name} 카드로 ${selectedIds.length}개 카드의 건물과 구역선을 합칠까요?\n` +
      '원본 카드는 남기고, 원본 카드의 구역선만 비워집니다.\n병합 후 화면에서 되돌리기 버튼으로 취소할 수 있습니다.',
    )
    if (!confirmed) return

    // 되돌리기용 스냅샷 캡처 (경계선 없는 카드는 null로 기록)
    const allMergeIds = [cardMergeTargetId, ...selectedIds.filter((id) => id !== cardMergeTargetId)]
    const undoBoundaries = allMergeIds.map((id) => ({
      cardId: id,
      points: cardBoundaries.find((b) => b.cardId === id)?.points ?? null,
    }))
    const undoBuildingCards = buildings
      .filter((b) => allMergeIds.includes(b.cardId))
      .map((b) => ({ buildingId: b.id, cardId: b.cardId }))

    await Promise.resolve(onMergeCardBoundaries({
      targetCardId: cardMergeTargetId,
      sourceCardIds: selectedIds.filter((id) => id !== cardMergeTargetId),
      mergedPoints: mergeResult.points,
    }))

    setCardMergeUndo({ boundaries: undoBoundaries, buildingCards: undoBuildingCards, targetCardName: targetCard.name })
    setCardMergeModalOpen(false)
    setCheckedCardIds(new Set([cardMergeTargetId]))
    setSelectedCardId(cardMergeTargetId)
  }

  const handleUndoCardMerge = async () => {
    if (!cardMergeUndo || !onUndoMergeCardBoundaries) return
    await onUndoMergeCardBoundaries(cardMergeUndo)
    setCardMergeUndo(null)
  }

  const handleDeleteCheckedBuildings = () => {
    const ids = Array.from(checkedBuildingIds)
    if (ids.length === 0) return
    const confirmed = window.confirm(`선택한 건물 ${ids.length}개를 삭제할까요?\n건물에 속한 호수와 방문 정보도 함께 정리될 수 있습니다.`)
    if (!confirmed) return
    onDeleteBuildings(ids)
    setCheckedBuildingIds(new Set())
  }



  const showPointDetailPane = activeTab === '건물 관리' && buildingSubTab === '중국인 포인트' && selectedPointDetailData
  const territoryLayoutClassName = showPointDetailPane
    ? 'territory-layout point-detail-open'
    : activeTab === '건물 관리' || !detailPaneOpen
      ? 'territory-layout building-management-only'
      : 'territory-layout'

  return (
    <section className={territoryLayoutClassName}>
      {/* ── 카드 추가 모달 ── */}
      {showCardModal && (
        <CardCreateModal
          cards={cards}
          onClose={() => setShowCardModal(false)}
          onCreateCard={onCreateCard}
          onCreated={(id, name) => {
            setSelectedCardId(id)
            setPendingBoundaryCard({ id, name })
          }}
        />
      )}

      {/* ── 구역선 그리기 제안 모달 ── */}
      {pendingBoundaryCard && (
        <div className="cal-modal-backdrop" onClick={() => setPendingBoundaryCard(null)}>
          <div className="cal-modal" style={{ maxWidth: '380px' }} onClick={(e) => e.stopPropagation()}>
            <div className="cal-modal-head">
              <div className="cal-modal-title">
                <h2>카드 생성 완료</h2>
              </div>
            </div>
            <div className="cal-modal-body">
              <p style={{ margin: 0, fontSize: '15px', color: '#374151', fontWeight: 600 }}>
                <strong style={{ color: 'var(--ink-900)' }}>{pendingBoundaryCard.name}</strong> 카드가 생성됐습니다.<br />
                지도에서 구역선을 바로 그릴까요?
              </p>
            </div>
            <div className="cal-modal-foot">
              <button className="cal-cancel-btn" onClick={() => setPendingBoundaryCard(null)} type="button">나중에</button>
              <button
                className="cal-save-btn"
                onClick={() => { onOpenCardMap(pendingBoundaryCard.id, true); setPendingBoundaryCard(null) }}
                type="button"
              >
                구역선 그리기
              </button>
            </div>
          </div>
        </div>
      )}

      {cardMergeUndo && (
        <div style={{
          position: 'fixed', bottom: 80, left: '50%', transform: 'translateX(-50%)',
          zIndex: 900, display: 'flex', alignItems: 'center', gap: 12,
          background: 'var(--gray-900)', color: '#fff', borderRadius: 12,
          padding: '12px 20px', boxShadow: '0 4px 20px rgba(0,0,0,.3)',
          fontSize: 14, whiteSpace: 'nowrap',
        }}>
          <span>"{cardMergeUndo.targetCardName}" 카드로 병합 완료</span>
          <button
            onClick={handleUndoCardMerge}
            style={{ background: 'var(--primary-500)', color: '#fff', border: 'none', borderRadius: 8, padding: '6px 14px', fontWeight: 700, cursor: 'pointer', fontSize: 13 }}
            type="button"
          >
            병합 취소
          </button>
          <button
            onClick={() => setCardMergeUndo(null)}
            style={{ background: 'none', border: 'none', color: 'var(--gray-400)', cursor: 'pointer', fontSize: 18, lineHeight: 1, padding: '0 2px' }}
            type="button"
            aria-label="닫기"
          >×</button>
        </div>
      )}

      {cardMergeModalOpen && (
        <div className="cal-modal-backdrop" onClick={() => setCardMergeModalOpen(false)}>
          <div className="cal-modal merge-name-modal" style={{ maxWidth: '520px' }} onClick={(e) => e.stopPropagation()}>
            <div className="cal-modal-head">
              <div className="cal-modal-title">
                <h2>카드 구역선 병합</h2>
                <p className="merge-name-modal-sub">선택한 카드의 건물은 기준 카드로 이동하고, 구역선은 하나로 합쳐집니다.</p>
              </div>
            </div>
            <div className="cal-modal-body">
              <label className="merge-name-field">
                <span>기준 카드</span>
                <select
                  value={cardMergeTargetId ?? ''}
                  onChange={(event) => setCardMergeTargetId(Number(event.target.value))}
                >
                  {selectedMergeCards.map((card) => (
                    <option key={card.id} value={card.id}>{card.name}</option>
                  ))}
                </select>
              </label>
              <div className="merge-name-list">
                {selectedMergeCards.map((card) => {
                  const buildingCount = buildingsByCardId.get(card.id)?.length ?? 0
                  const hasBoundary = cardBoundaries.some((boundary) => boundary.cardId === card.id)
                  return (
                    <div className="merge-name-row" key={card.id}>
                      <div>
                        <strong>{card.name}</strong>
                        <span>{card.region} · {card.area} · 건물 {buildingCount}개</span>
                      </div>
                      <em>{card.id === cardMergeTargetId ? '기준' : hasBoundary ? '병합' : '구역선 없음'}</em>
                    </div>
                  )
                })}
              </div>
              <p className="merge-name-modal-sub" style={{ marginTop: 12 }}>
                병합 후 원본 카드는 삭제하지 않고 남깁니다. 원본 카드의 구역선만 비우며, 토스트의 실행 취소로 되돌릴 수 있습니다.
              </p>
            </div>
            <div className="cal-modal-foot">
              <button className="cal-cancel-btn" onClick={() => setCardMergeModalOpen(false)} type="button">취소</button>
              <button className="cal-save-btn" onClick={handleApplyCardMerge} type="button">병합 실행</button>
            </div>
          </div>
        </div>
      )}

      {pendingChineseToggle && (
        <div className="cal-modal-backdrop" onClick={() => setPendingChineseToggle(null)}>
          <div className="cal-modal territory-confirm-modal" onClick={(e) => e.stopPropagation()}>
            <div className="cal-modal-head">
              <div className="cal-modal-title">
                <h2>중국인 거주 표시 해제</h2>
                <p className="merge-name-modal-sub">해제하면 이 항목은 중국인 포인트 목록에서 사라질 수 있습니다.</p>
              </div>
            </div>
            <div className="cal-modal-body">
              <div className="territory-confirm-summary">
                <strong>{pendingChineseToggle.cardName}</strong>
                <span>{pendingChineseToggle.buildingName} · {pendingChineseToggle.unitNumber}</span>
              </div>
            </div>
            <div className="cal-modal-foot">
              <button className="cal-cancel-btn" onClick={() => setPendingChineseToggle(null)} type="button">취소</button>
              <button
                className="cal-save-btn danger"
                onClick={() => {
                  onToggleChinese(pendingChineseToggle.buildingId, pendingChineseToggle.unitId)
                  setPendingChineseToggle(null)
                }}
                type="button"
              >
                해제
              </button>
            </div>
          </div>
        </div>
      )}

      {pointVisitEditor && (
        <div className="cal-modal-backdrop" onClick={() => setPointVisitEditor(null)}>
          <div className="cal-modal territory-confirm-modal" onClick={(e) => e.stopPropagation()}>
            <div className="cal-modal-head">
              <div className="cal-modal-title">
                <h2>{pointVisitEditor.mode === 'edit' ? '방문 기록 수정' : '방문 기록 등록'}</h2>
                <p className="merge-name-modal-sub">{pointVisitEditor.label}</p>
              </div>
            </div>
            <div className="cal-modal-body">
              <div className="point-visit-editor-form">
                <label>
                  <span>방문일</span>
                  <input
                    type="date"
                    value={pointVisitEditor.visitedAt}
                    onChange={(event) => setPointVisitEditor((prev) => prev ? { ...prev, visitedAt: event.target.value } : prev)}
                  />
                </label>
                <label>
                  <span>시간대</span>
                  <select
                    value={pointVisitEditor.timeSlot}
                    onChange={(event) => setPointVisitEditor((prev) => prev ? { ...prev, timeSlot: event.target.value as TimeSlot } : prev)}
                  >
                    <option value="오전">오전</option>
                    <option value="오후">오후</option>
                    <option value="저녁">저녁</option>
                  </select>
                </label>
                <label>
                  <span>결과</span>
                  <select
                    value={pointVisitEditor.result}
                    onChange={(event) => setPointVisitEditor((prev) => prev ? { ...prev, result: event.target.value as UnitStatus } : prev)}
                  >
                    <option value="미방문">미방문</option>
                    <option value="만남">만남</option>
                    <option value="부재">부재</option>
                    <option value="한국인">한국인</option>
                  </select>
                </label>
                <label className="wide">
                  <span>메모</span>
                  <textarea
                    value={pointVisitEditor.memo}
                    onChange={(event) => setPointVisitEditor((prev) => prev ? { ...prev, memo: event.target.value } : prev)}
                    placeholder="방문 당시 메모"
                  />
                </label>
              </div>
            </div>
            <div className="cal-modal-foot">
              <button className="cal-cancel-btn" onClick={() => setPointVisitEditor(null)} type="button">취소</button>
              <button
                className="cal-save-btn"
                disabled={!pointVisitEditor.visitedAt}
                onClick={savePointVisitEditor}
                type="button"
              >
                저장
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 건물 추가 모달 */}
      {addBuildingOpen && (
        <div className="cal-modal-backdrop" onClick={() => setAddBuildingOpen(false)}>
          <div className="cal-modal add-building-modal" onClick={(e) => e.stopPropagation()}>
            <div className="cal-modal-head">
              <div className="cal-modal-title">
                <h2>건물 추가</h2>
                <p className="merge-name-modal-sub">주소 입력 후 자동으로 좌표를 찾고 카드에 배정됩니다.</p>
              </div>
              <button className="cal-modal-close" onClick={() => setAddBuildingOpen(false)} type="button">
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                  <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>
            <div className="add-building-modal-body">
              <label className="add-building-field">
                <span>주소 <em className="add-building-required">*</em></span>
                <div className="add-building-address-row">
                  <input
                    className="add-building-input"
                    placeholder="예) 경기도 용인시 처인구 언동로 213"
                    value={addBuildingForm.address}
                    onChange={(e) => {
                      setAddBuildingForm((f) => ({ ...f, address: e.target.value }))
                      setAddBuildingLatLng(null)
                      setAddBuildingGeoState('idle')
                    }}
                    onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); geocodeAddress(addBuildingForm.address).then((r) => { setAddBuildingLatLng(r); setAddBuildingGeoState(r ? 'ok' : 'fail') }) }}}
                  />
                  <button
                    className="add-building-geocode-btn"
                    type="button"
                    disabled={!addBuildingForm.address.trim() || addBuildingGeoState === 'loading'}
                    onClick={async () => {
                      setAddBuildingGeoState('loading')
                      const r = await geocodeAddress(addBuildingForm.address)
                      setAddBuildingLatLng(r)
                      setAddBuildingGeoState(r ? 'ok' : 'fail')
                    }}
                  >
                    {addBuildingGeoState === 'loading' ? '검색 중...' : '좌표 찾기'}
                  </button>
                </div>
                {addBuildingGeoState === 'ok' && addBuildingLatLng && (
                  <span className="add-building-geo-ok">📍 좌표 확인 ({addBuildingLatLng.lat.toFixed(5)}, {addBuildingLatLng.lng.toFixed(5)})</span>
                )}
                {addBuildingGeoState === 'fail' && (
                  <span className="add-building-geo-fail">주소를 찾지 못했습니다. 핀 없이 건물이 생성됩니다.</span>
                )}
              </label>
              <label className="add-building-field">
                <span>건물명 <em className="add-building-hint">(비워두면 주소에서 자동 설정)</em></span>
                <input
                  className="add-building-input"
                  placeholder="예) 언동로빌라, 고진로상가 등"
                  value={addBuildingForm.name}
                  onChange={(e) => setAddBuildingForm((f) => ({ ...f, name: e.target.value }))}
                />
              </label>
              <div className="add-building-row2">
                <label className="add-building-field">
                  <span>유형</span>
                  <select className="add-building-select" value={addBuildingForm.type} onChange={(e) => setAddBuildingForm((f) => ({ ...f, type: e.target.value as Building['type'] }))}>
                    <option value="주택">주택</option>
                    <option value="상가">상가</option>
                  </select>
                </label>
                <label className="add-building-field">
                  <span>카드 배정</span>
                  <select className="add-building-select" value={addBuildingForm.cardId === 'auto' ? 'auto' : String(addBuildingForm.cardId)} onChange={(e) => setAddBuildingForm((f) => ({ ...f, cardId: e.target.value === 'auto' ? 'auto' : Number(e.target.value) }))}>
                    <option value="auto">자동 (주소 기준)</option>
                    {cards.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </label>
              </div>
            </div>
            <div className="merge-name-modal-footer">
              <button className="cal-cancel-btn" onClick={() => setAddBuildingOpen(false)} type="button">취소</button>
              <button
                className="dup-address-merge-btn"
                type="button"
                disabled={!addBuildingForm.address.trim() || addBuildingSubmitting}
                onClick={handleAddBuildingSubmit}
                style={{ background: '#2563eb' }}
              >
                {addBuildingSubmitting ? '추가 중...' : '건물 추가'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 중복 주소 건물 이름 선택 모달 */}
      {mergeModalGroups && (
        <div className="cal-modal-backdrop" onClick={() => setMergeModalGroups(null)}>
          <div className="cal-modal merge-name-modal" onClick={(e) => e.stopPropagation()}>
            <div className="cal-modal-head">
              <div className="cal-modal-title">
                <h2>합칠 건물 이름 선택</h2>
                <p className="merge-name-modal-sub">합칠 주소 그룹을 선택하고, 각 주소별로 남길 건물 이름을 선택해주세요.</p>
              </div>
              <button className="cal-modal-close" onClick={() => setMergeModalGroups(null)} type="button">
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                  <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>
            <div className="merge-name-toolbar">
              <label className="merge-name-select-all">
                <input
                  checked={mergeModalGroups.length > 0 && mergeSelectedPrimaryIds.size === mergeModalGroups.length}
                  onChange={(event) => {
                    setMergeSelectedPrimaryIds(event.target.checked
                      ? new Set(mergeModalGroups.map((group) => group.primaryId))
                      : new Set())
                  }}
                  type="checkbox"
                />
                전체 선택
              </label>
              <span>선택 {mergeSelectedPrimaryIds.size} / {mergeModalGroups.length}그룹</span>
            </div>
            <div className="merge-name-modal-body">
              {mergeModalGroups.map((group) => (
                <div className={`merge-name-group${mergeSelectedPrimaryIds.has(group.primaryId) ? '' : ' is-unselected'}`} key={group.primaryId}>
                  <div className="merge-name-group-head">
                    <label className="merge-name-group-check">
                      <input
                        checked={mergeSelectedPrimaryIds.has(group.primaryId)}
                        onChange={(event) => {
                          setMergeSelectedPrimaryIds((prev) => {
                            const next = new Set(prev)
                            if (event.target.checked) next.add(group.primaryId)
                            else next.delete(group.primaryId)
                            return next
                          })
                        }}
                        type="checkbox"
                      />
                      <span className="merge-name-address">{group.address}</span>
                    </label>
                    <span className="merge-name-count">{group.cardName} · 건물 {group.buildingCount}개 · 세대 {group.unitCount}개</span>
                  </div>
                  <div className="merge-name-chips">
                    {group.names.map((name) => (
                      <button
                        key={name}
                        type="button"
                        disabled={!mergeSelectedPrimaryIds.has(group.primaryId)}
                        className={`merge-name-chip${mergeNameChoices[group.primaryId] === name ? ' active' : ''}`}
                        onClick={() => setMergeNameChoices((prev) => ({ ...prev, [group.primaryId]: name }))}
                      >
                        {name}
                      </button>
                    ))}
                  </div>
                  <input
                    className="merge-name-custom-input"
                    disabled={!mergeSelectedPrimaryIds.has(group.primaryId)}
                    placeholder="직접 입력 (또는 위에서 선택)"
                    value={mergeNameChoices[group.primaryId] ?? ''}
                    onChange={(e) => setMergeNameChoices((prev) => ({ ...prev, [group.primaryId]: e.target.value }))}
                  />
                </div>
              ))}
            </div>
            <div className="merge-name-modal-footer">
              <button className="cal-cancel-btn" onClick={() => setMergeModalGroups(null)} type="button">취소</button>
              <button
                className="dup-address-merge-btn"
                disabled={mergeSelectedPrimaryIds.size === 0}
                type="button"
                onClick={async () => {
                  // 빈 입력은 첫 번째 이름으로 fallback
                  const finalChoices: Record<number, string> = {}
                  const selectedPrimaryIds = Array.from(mergeSelectedPrimaryIds)
                  mergeModalGroups.filter((g) => mergeSelectedPrimaryIds.has(g.primaryId)).forEach((g) => {
                    finalChoices[g.primaryId] = mergeNameChoices[g.primaryId]?.trim() || g.names[0]
                  })
                  setMergeModalGroups(null)
                  setMergeSelectedPrimaryIds(new Set())
                  await onMergeDuplicateBuildings(undefined, finalChoices, selectedPrimaryIds)
                }}
              >
                선택한 주소 합치기
              </button>
            </div>
          </div>
        </div>
      )}

      {showCsvModal && (
        <div className="cal-modal-backdrop" onClick={() => setShowCsvModal(false)}>
          <div className="cal-modal csv-import-modal" style={{ maxWidth: '720px' }} onClick={(e) => e.stopPropagation()}>
            <div className="cal-modal-head">
              <div className="cal-modal-title">
                <h2>CSV 건물 업로드</h2>
              </div>
              <button className="cal-modal-close" onClick={() => setShowCsvModal(false)} type="button">
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                  <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>
            <div className="cal-modal-body">
              <div className="csv-guide-box">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                  <strong>권장 헤더</strong>
                  <button
                    onClick={downloadCsvExample}
                    style={{ background: 'var(--brand-100)', color: 'var(--brand-700)', border: 'none', padding: '4px 10px', borderRadius: '6px', fontSize: '12px', fontWeight: 700, cursor: 'pointer' }}
                    type="button"
                  >
                    📥 예시 파일 다운로드
                  </button>
                </div>
                <p style={{ fontWeight: 600, marginBottom: 2 }}>건물 정보</p>
                <p style={{ marginTop: 0 }}>카드명, 지역, 동, 주소, 건물명, 유형, 호수, 상태, <b>구분</b>(중국인/한국인), <b>방문금지</b>, 정기방문자, <b>정기방문시작일</b>, 메모</p>
                <p style={{ fontWeight: 600, marginBottom: 2 }}>방문기록 (선택 — 있으면 과거 기록도 함께 삽입)</p>
                <p style={{ marginTop: 0 }}>방문일자(YYYY-MM-DD), 방문결과, 방문자, 시간대(오전/오후/저녁), 방문메모</p>
                <small>한 세대에 방문기록이 여러 건이면 같은 주소+호수로 여러 행을 작성하세요. 카드 정보가 비어 있으면 구역선 기준으로 자동 배정합니다.</small>
              </div>

              <label className="csv-file-drop">
                <input
                  accept=".csv,text/csv"
                  type="file"
                  onChange={(event) => {
                    const file = event.target.files?.[0]
                    if (file) void parseCsvFile(file)
                    event.currentTarget.value = ''
                  }}
                />
                <span>{csvParsing ? 'CSV 확인 중...' : 'CSV 파일 선택'}</span>
              </label>

              <div className="csv-preview-summary">
                <span>준비 {csvPreviewRows.length}개</span>
                <span>제외 {csvSkippedRows}개</span>
              </div>

              {csvPreviewRows.length > 0 && (
                <div className="csv-preview-table">
                  <div>
                    <span>행</span>
                    <span>카드</span>
                    <span>건물</span>
                    <span>주소</span>
                    <span>세대</span>
                    <span>방문기록</span>
                  </div>
                  {csvPreviewRows.slice(0, 8).map((row) => {
                    const visitCount = row.units.reduce((sum, u) => sum + u.visitHistories.length, 0)
                    return (
                      <div key={`${row.rowNumber}-${row.address}`}>
                        <span>{row.rowNumber}</span>
                        <span>{row.cardName}</span>
                        <span>{row.name}</span>
                        <span>{row.address}</span>
                        <span>{row.units.length || 1}</span>
                        <span>{visitCount > 0 ? `${visitCount}건` : '-'}</span>
                      </div>
                    )
                  })}
                  {csvPreviewRows.length > 8 && <p>외 {csvPreviewRows.length - 8}개 건물이 더 있습니다.</p>}
                </div>
              )}

              {csvSkippedDetails.length > 0 && (
                <div className="csv-skip-list">
                  <strong>제외된 행</strong>
                  {csvSkippedDetails.slice(0, 8).map((item) => (
                    <div key={`${item.rowNumber}-${item.reason}`}>
                      <span>{item.rowNumber}행</span>
                      <b>{item.reason}</b>
                      <em>{item.hint}</em>
                      {item.address && <small>{item.address}</small>}
                    </div>
                  ))}
                  {csvSkippedDetails.length > 8 && <p>외 {csvSkippedDetails.length - 8}개 제외 사유가 더 있습니다.</p>}
                  
                  {csvHeaders.length > 0 && (
                    <button
                      type="button"
                      onClick={() => {
                        const csvContent = [
                          csvHeaders.map(h => `"${String(h).replace(/"/g, '""')}"`).join(','),
                          ...csvSkippedDetails
                            .filter(item => item.rawRow)
                            .map(item => item.rawRow!.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(','))
                        ].join('\n')
                        const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' })
                        const url = URL.createObjectURL(blob)
                        const link = document.createElement('a')
                        link.href = url
                        link.download = 'skipped_rows.csv'
                        link.click()
                        URL.revokeObjectURL(url)
                      }}
                      style={{
                        marginTop: 12, padding: '8px 12px', background: '#fff', border: '1px solid #d8dbe0',
                        borderRadius: 8, fontSize: 13, fontWeight: 700, color: '#4b5563', cursor: 'pointer',
                        display: 'flex', alignItems: 'center', gap: 6, width: 'fit-content'
                      }}
                    >
                      <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>
                      제외된 항목 다운로드
                    </button>
                  )}
                </div>
              )}
            </div>
            <div className="cal-modal-foot">
              <button className="cal-cancel-btn" onClick={() => setShowCsvModal(false)} type="button">취소</button>
              <button
                className="cal-save-btn"
                disabled={csvPreviewRows.length === 0 || csvParsing || csvImporting}
                onClick={handleImportCsv}
                type="button"
              >
                {csvImporting ? '업로드 중...' : '업로드'}
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="territory-main">
        {/* ── 페이지 헤더: 종류 탭이 곧 제목 (구역 카드 / 비공식 카드 / 식당) ── */}
        <header className="page-header">
          <div className="page-header-text">
            <div className="zone-kind-tabs" role="tablist" aria-label="구역 종류">
              {[
                { id: 'territory' as const, label: '구역 카드', count: cards.length },
                { id: 'informal' as const, label: '비공식 카드', count: informalCount },
                { id: 'restaurant' as const, label: '식당', count: restaurantCount },
              ].map((t) => {
                const active = zoneKind === t.id
                return (
                  <button
                    key={t.id}
                    role="tab"
                    aria-selected={active}
                    onClick={() => setZoneKind(t.id)}
                    type="button"
                    className={`zone-kind-tab${active ? ' is-active' : ''}`}
                  >
                    {t.label}
                    <em className="zone-kind-tab-count">{t.count}</em>
                  </button>
                )
              })}
            </div>
          </div>
        </header>

        {/* 비공식 카드 탭 */}
        {zoneKind === 'informal' && (
          <div style={{ paddingTop: 4 }}>
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
          <div style={{ paddingTop: 4 }}>
            <RestaurantsTab
              role={role}
              buildings={buildings}
              cards={cards}
              currentVisitor={currentVisitor}
              restaurantRequests={restaurantRequests}
              onToggleRestaurantFlag={onToggleBuildingRestaurant}
              onBulkSetRestaurant={onBulkSetRestaurant}
              onApproveRestaurantRequest={onApproveRestaurantRequest}
              onRejectRestaurantRequest={onRejectRestaurantRequest}
              onOpenMap={(cardId) => onOpenCardMap(cardId)}
            />
          </div>
        )}

        {/* 구역 카드 탭 (기존 컨텐츠) */}
        {zoneKind === 'territory' && (<>

        {/* ── Segment Tab + 컨텍스트 액션 ── */}
        <div className="territory-toolbar">
          <div className="tbl-seg-tab" style={{ marginBottom: 0 }}>
            {(['카드 관리', '건물 관리'] as const).map((tab) => (
              <button className={activeTab === tab ? 'active' : ''} key={tab} onClick={() => setActiveTab(tab)} type="button">
                {tab}
              </button>
            ))}
          </div>
          <div className="territory-toolbar-actions">
            {activeTab === '카드 관리' ? (
              <>
                <button
                  onClick={() => setDetailPaneOpen((o) => !o)}
                  title={detailPaneOpen ? '상세 접기' : '상세 열기'}
                  type="button"
                  className={`tbl-toolbar-btn${detailPaneOpen ? ' is-active' : ''}`}
                >
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="3" y="3" width="18" height="18" rx="2"/><line x1="9" y1="3" x2="9" y2="21"/>
                  </svg>
                  {detailPaneOpen ? '상세 접기' : '상세 열기'}
                </button>
                {isAdmin && (
                  <>
                    <button className="tbl-ghost-btn" onClick={handleExportCardBoundaries} type="button">
                      구역선 백업
                    </button>
                    {onRestoreCardBoundaries && (
                      <>
                        <input
                          ref={boundaryImportInputRef}
                          accept="application/json"
                          onChange={handleImportCardBoundaries}
                          style={{ display: 'none' }}
                          type="file"
                        />
                        <button className="tbl-ghost-btn" onClick={() => boundaryImportInputRef.current?.click()} type="button">
                          구역선 가져오기
                        </button>
                      </>
                    )}
                    {onMergeCardBoundaries && (
                      <button className="tbl-ghost-btn" disabled={checkedCardIds.size < 2} onClick={handleOpenCardMergeModal} type="button">
                        카드 병합{checkedCardIds.size > 1 ? ` ${checkedCardIds.size}` : ''}
                      </button>
                    )}
                    <button className="tbl-ghost-btn" disabled={checkedCardIds.size === 0} onClick={handleDeleteCheckedCards} type="button">
                      선택 삭제{checkedCardIds.size > 0 ? ` ${checkedCardIds.size}` : ''}
                    </button>
                    <button className="tbl-primary-btn" onClick={() => setShowCardModal(true)} type="button">+ 카드 추가</button>
                  </>
                )}
              </>
            ) : (
              <>
                {isAdmin && (
                  <button className="tbl-ghost-btn" disabled={checkedBuildingIds.size === 0} onClick={handleDeleteCheckedBuildings} type="button">
                    선택 삭제{checkedBuildingIds.size > 0 ? ` ${checkedBuildingIds.size}` : ''}
                  </button>
                )}
                {buildingCardFilter === unassignedCardId && checkedBuildingIds.size > 0 && (
                  <button
                    className="tbl-ghost-btn"
                    style={{ color: 'var(--primary-600)', fontWeight: 600 }}
                    disabled={reassigningChecked}
                    onClick={handleReassignCheckedByBoundary}
                    type="button"
                  >
                    {reassigningChecked ? '재배정 중...' : `선택 ${checkedBuildingIds.size}개 카드 재배정`}
                  </button>
                )}
                <button className="tbl-ghost-btn" disabled={reassigningByBoundary} onClick={handleReassignByBoundary} type="button">
                  {reassigningByBoundary ? '재배정 중...' : '좌표 기준 재배정'}
                </button>
                {onCreateBuilding && (
                  <button className="tbl-ghost-btn" onClick={() => { setAddBuildingForm({ name: '', address: '', type: '주택', cardId: 'auto' }); setAddBuildingLatLng(null); setAddBuildingGeoState('idle'); setAddBuildingOpen(true) }} type="button">
                    + 건물 추가
                  </button>
                )}
                <button className="tbl-primary-btn" onClick={() => setShowCsvModal(true)} type="button">건물 CSV 업로드</button>
              </>
            )}
            {onSwitchToMap && (
              <button onClick={onSwitchToMap} type="button" className="tbl-toolbar-btn">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="3 6 9 3 15 6 21 3 21 21 15 18 9 21 3 18 3 6"/><line x1="9" y1="3" x2="9" y2="21"/><line x1="15" y1="6" x2="15" y2="18"/></svg>
                지도
              </button>
            )}
          </div>
        </div>

        {/* ── KPI (카드 관리만) ── */}
        {activeTab === '카드 관리' && (
          <div className="desk-grid-12" style={{ marginBottom: 16 }}>
            <div className="desk-kpi" style={{ gridColumn: 'span 3' }}>
              <div className="desk-kpi__num tnum">{totalCards}</div>
              <div className="desk-kpi__label">전체 카드</div>
            </div>
            <div className="desk-kpi" style={{ gridColumn: 'span 3' }}>
              <div className="desk-kpi__num tnum">{assignedCards}</div>
              <div className="desk-kpi__label">인도자 배정</div>
            </div>
            <div className="desk-kpi" style={{ gridColumn: 'span 3' }}>
              <div className="desk-kpi__num tnum">{totalUnits}</div>
              <div className="desk-kpi__label">전체 세대</div>
            </div>
            <div className="desk-kpi" style={{ gridColumn: 'span 3' }}>
              <div className="desk-kpi__num tnum">{completedUnits}</div>
              <div className="desk-kpi__label">방문 완료</div>
            </div>
          </div>
        )}

        {/* ── 건물 관리 서브탭 ── */}
        {activeTab === '건물 관리' && (
          <div className="territory-subtabs" style={{ marginBottom: 16 }}>
            {(['건물 목록', '중국인 포인트'] as const).map((tab) => (
              <button className={buildingSubTab === tab ? 'active' : ''} key={tab} onClick={() => setBuildingSubTab(tab)} type="button">{tab}</button>
            ))}
          </div>
        )}

        {/* ── Big Card ── */}
        <div className="desk-card" style={{ padding: 0, overflow: 'visible' }}>
          {/* Layer 1: 지역 칩 */}
          <div className="tbl-filter-layer">
            <span className="tbl-filter-label">지역</span>
            <div className="tbl-chip-row">
              {(['전체', ...territoryRegions] as Array<TerritoryRegion | '전체'>).map((r) => {
                const count = r === '전체' ? cards.length : cards.filter((c) => c.region === r).length
                return (
                  <button key={r} className={`tbl-chip${regionFilter === r ? ' active' : ''}`} onClick={() => { setRegionFilter(r); setAreaFilter('전체'); setAreaExpanded(false) }} type="button">
                    {r}<span className="tbl-chip__count">{count}</span>
                  </button>
                )
              })}
            </div>
          </div>

          {/* Layer 2: 동 칩 */}
          <div className="tbl-filter-layer tbl-filter-layer--area">
            <span className="tbl-filter-label">동</span>
            <div className="tbl-chip-row">
              <button className={`tbl-chip${areaFilter === '전체' ? ' active' : ''}`} onClick={() => setAreaFilter('전체')} type="button">
                전체 동<span className="tbl-chip__count">{filteredCards.length}</span>
              </button>
              {(areaExpanded ? areaFilterOptions : areaFilterOptions.slice(0, AREA_CHIP_LIMIT)).map((area) => (
                <button key={area} className={`tbl-chip${areaFilter === area ? ' active' : ''}`} onClick={() => setAreaFilter(area)} type="button">
                  {area}<span className="tbl-chip__count">{getAreaMetricCount(area)}</span>
                </button>
              ))}
              {areaFilterOptions.length > AREA_CHIP_LIMIT && (
                <button
                  className="tbl-chip"
                  onClick={() => setAreaExpanded((v) => !v)}
                  type="button"
                  style={{ color: 'var(--ink-700)', borderColor: 'var(--line-3)', background: 'var(--gray-50)' }}
                >
                  {areaExpanded ? '접기 ▴' : `더보기 ▾`}
                  {!areaExpanded && <span className="tbl-chip__count" style={{ background: 'var(--gray-200)', color: 'var(--ink-700)' }}>{areaFilterOptions.length - AREA_CHIP_LIMIT}</span>}
                </button>
              )}
            </div>
          </div>

          {/* Layer 3: 배정 필터 (카드 관리) */}
          {activeTab === '카드 관리' && (
            <div className="tbl-filter-layer tbl-filter-layer--compact">
              <div className="tbl-filter-group">
                <span className="tbl-filter-label">배정</span>
                <div className="tbl-mini-seg">
                  {(['전체', '배정', '미배정'] as const).map((f) => (
                    <button key={f} className={assignmentFilter === f ? 'active' : ''} onClick={() => setAssignmentFilter(f)} type="button">{f}</button>
                  ))}
                </div>
              </div>
              <button
                className={`tbl-filter-toggle${cardFilterPanelOpen ? ' active' : ''}`}
                onClick={() => setCardFilterPanelOpen((open) => !open)}
                type="button"
              >
                필터
                {activeAdvancedCardFilterCount > 0 && <span>{activeAdvancedCardFilterCount}</span>}
              </button>
              <div style={{ flex: 1 }} />
              {isAdmin && (
                <>
                  <details className="territory-multi-select">
                    <summary>{bulkLeaderNames.length > 0 ? `인도자 선택 ${bulkLeaderNames.length}` : '인도자 선택'}</summary>
                    <div className="territory-multi-select-menu">
                      {leaderOptions.map((name) => (
                        <label key={name} className="territory-multi-option">
                          <input type="checkbox" checked={bulkLeaderNames.includes(name)} onChange={() => toggleBulkLeaderName(name)} />
                          {name}
                        </label>
                      ))}
                      <button className="territory-multi-clear" onClick={() => setBulkLeaderNames([])} type="button">모두 해제</button>
                    </div>
                  </details>
                  <button className="tbl-ghost-btn sm" disabled={checkedCardIds.size === 0 || bulkAssigning} onClick={handleAssignLeaderBulk} type="button">
                    {bulkAssigning ? '적용 중...' : `일괄 적용${checkedCardIds.size > 0 ? ` ${checkedCardIds.size}` : ''}`}
                  </button>
                </>
              )}
              {cardFilterPanelOpen && (
                <div className="tbl-advanced-filter-panel">
                  <div className="tbl-filter-group">
                    <span className="tbl-filter-label">인도자</span>
                    <select className="tbl-filter-select" value={leaderFilter} onChange={(e) => setLeaderFilter(e.target.value)}>
                      <option value="전체">전체</option>
                      {leaderFilterOptions.map((leaderName) => (
                        <option key={leaderName} value={leaderName}>{leaderName}</option>
                      ))}
                    </select>
                  </div>
                  <div className="tbl-filter-group">
                    <span className="tbl-filter-label">정기방문</span>
                    <div className="tbl-mini-seg">
                      {(['전체', '있음', '없음'] as const).map((f) => (
                        <button key={f} className={regularVisitFilter === f ? 'active' : ''} onClick={() => setRegularVisitFilter(f)} type="button">{f}</button>
                      ))}
                    </div>
                  </div>
                  <div className="tbl-filter-group">
                    <span className="tbl-filter-label">중국인 다수</span>
                    <div className="tbl-mini-seg">
                      {(['전체', '있음', '없음'] as const).map((f) => (
                        <button key={f} className={cardChineseHeavyFilter === f ? 'active' : ''} onClick={() => setCardChineseHeavyFilter(f)} type="button">{f}</button>
                      ))}
                    </div>
                  </div>
                  <div className="tbl-filter-group">
                    <span className="tbl-filter-label">상태</span>
                    <div className="tbl-mini-seg">
                      {(['전체', '미배정', '완료·제외', '보류'] as CardStatusFilter[]).map((f) => (
                        <button key={f} className={cardStatusFilter === f ? 'active' : ''} onClick={() => setCardStatusFilter(f)} type="button">{f}</button>
                      ))}
                    </div>
                  </div>
                  <button
                    className="tbl-filter-reset"
                    disabled={activeAdvancedCardFilterCount === 0}
                    onClick={() => {
                      setLeaderFilter('전체')
                      setRegularVisitFilter('전체')
                      setCardChineseHeavyFilter('전체')
                      setCardStatusFilter('전체')
                    }}
                    type="button"
                  >
                    초기화
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Layer 3: 건물 관리 필터 */}
          {activeTab === '건물 관리' && buildingSubTab === '건물 목록' && (
            <div className="tbl-filter-layer" style={{ gap: 12 }}>
              <span className="tbl-filter-label">유형</span>
              <div className="tbl-mini-seg">
                {(['전체', '상가', '주택'] as Array<Building['type'] | '전체'>).map((f) => (
                  <button key={f} className={buildingTypeFilter === f ? 'active' : ''} onClick={() => setBuildingTypeFilter(f)} type="button">{f}</button>
                ))}
              </div>
              <span className="tbl-filter-label">카드</span>
              <select className="tbl-filter-select" value={buildingCardFilter} onChange={(e) => setBuildingCardFilter(e.target.value === '전체' ? '전체' : Number(e.target.value))}>
                <option value="전체">전체 카드</option>
                {unassignedCardId && (
                  <option value={unassignedCardId}>⚠ 미배정 건물</option>
                )}
                {filteredCards.filter((c) => c.id !== unassignedCardId).map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
              <button
                className={`tbl-filter-toggle${buildingFilterPanelOpen ? ' active' : ''}`}
                onClick={() => setBuildingFilterPanelOpen((open) => !open)}
                type="button"
              >
                필터
                {activeAdvancedBuildingFilterCount > 0 && <span>{activeAdvancedBuildingFilterCount}</span>}
              </button>
              {buildingFilterPanelOpen && (
                <div className="tbl-advanced-filter-panel">
                  <div className="tbl-filter-group">
                    <span className="tbl-filter-label">정기방문</span>
                    <div className="tbl-mini-seg">
                      {(['전체', '있음', '없음'] as const).map((f) => (
                        <button key={f} className={buildingRegularFilter === f ? 'active' : ''} onClick={() => setBuildingRegularFilter(f)} type="button">{f}</button>
                      ))}
                    </div>
                  </div>
                  <div className="tbl-filter-group">
                    <span className="tbl-filter-label">메모</span>
                    <div className="tbl-mini-seg">
                      {(['전체', '있음', '없음'] as const).map((f) => (
                        <button key={f} className={buildingMemoFilter === f ? 'active' : ''} onClick={() => setBuildingMemoFilter(f)} type="button">{f}</button>
                      ))}
                    </div>
                  </div>
                  <div className="tbl-filter-group">
                    <span className="tbl-filter-label">중국인 다수</span>
                    <div className="tbl-mini-seg">
                      {(['전체', '있음', '없음'] as const).map((f) => (
                        <button key={f} className={buildingChineseHeavyFilter === f ? 'active' : ''} onClick={() => setBuildingChineseHeavyFilter(f)} type="button">{f}</button>
                      ))}
                    </div>
                  </div>
                  <button
                    className="tbl-filter-reset"
                    disabled={activeAdvancedBuildingFilterCount === 0}
                    onClick={() => {
                      setBuildingRegularFilter('전체')
                      setBuildingMemoFilter('전체')
                      setBuildingChineseHeavyFilter('전체')
                    }}
                    type="button"
                  >
                    초기화
                  </button>
                </div>
              )}
            </div>
          )}
          {activeTab === '건물 관리' && buildingSubTab === '건물 목록' && (
            <div className="tbl-filter-layer tbl-filter-layer--sort">
              <span className="tbl-filter-label">정렬</span>
              <div className="tbl-mini-seg">
                {(['카드', '건물', '주소', '유형'] as BuildingSortKey[]).map((key) => (
                  <button key={key} className={buildingSort.key === key ? 'active' : ''} onClick={() => setBuildingSort((prev) => prev.key === key ? { key, dir: prev.dir === 'asc' ? 'desc' : 'asc' } : { key, dir: 'asc' })} type="button">
                    {key}{buildingSort.key === key ? (buildingSort.dir === 'asc' ? ' ↑' : ' ↓') : ''}
                  </button>
                ))}
              </div>
            </div>
          )}
          {activeTab === '건물 관리' && buildingSubTab === '중국인 포인트' && (
            <div className="tbl-filter-layer" style={{ gap: 12 }}>
              <span className="tbl-filter-label">상태</span>
              <select className="tbl-filter-select" value={pointStatusFilter} onChange={(e) => setPointStatusFilter(e.target.value as UnitStatus | '전체')}>
                <option value="전체">전체 상태</option>
                <option value="미방문">미방문</option>
                <option value="만남">만남</option>
                <option value="부재">부재</option>
                <option value="한국인">한국인</option>
              </select>
              <button
                className={`tbl-filter-toggle${pointFilterPanelOpen ? ' active' : ''}`}
                onClick={() => setPointFilterPanelOpen((open) => !open)}
                type="button"
              >
                필터
                {activeAdvancedPointFilterCount > 0 && <span>{activeAdvancedPointFilterCount}</span>}
              </button>
              {pointFilterPanelOpen && (
                <div className="tbl-advanced-filter-panel">
                  <div className="tbl-filter-group">
                    <span className="tbl-filter-label">정기방문</span>
                    <div className="tbl-mini-seg">
                      {(['전체', '있음', '없음'] as const).map((f) => (
                        <button key={f} className={pointRegularFilter === f ? 'active' : ''} onClick={() => setPointRegularFilter(f)} type="button">{f}</button>
                      ))}
                    </div>
                  </div>
                  <div className="tbl-filter-group">
                    <span className="tbl-filter-label">메모</span>
                    <div className="tbl-mini-seg">
                      {(['전체', '있음', '없음'] as const).map((f) => (
                        <button key={f} className={pointMemoFilter === f ? 'active' : ''} onClick={() => setPointMemoFilter(f)} type="button">{f}</button>
                      ))}
                    </div>
                  </div>
                  <button
                    className="tbl-filter-reset"
                    disabled={activeAdvancedPointFilterCount === 0}
                    onClick={() => {
                      setPointRegularFilter('전체')
                      setPointMemoFilter('전체')
                    }}
                    type="button"
                  >
                    초기화
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Layer 4: 결과 카운트 */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, padding: '10px 18px', fontSize: 12, color: 'var(--gray-500)', borderBottom: '1px solid var(--border-subtle)' }}>
            <span>
              {regionFilter === '전체' ? '전체 지역' : regionFilter}
              {' · '}{areaFilter === '전체' ? '전체 동' : areaFilter}
              {' · 표시 '}
              {activeTab === '카드 관리' ? `${filteredCards.length}개 카드` : buildingSubTab === '건물 목록' ? `${filteredBuildings.length}개 건물` : `${pointRows.length}개 포인트`}
            </span>
            {activeTab === '건물 관리' && (
              <button className="tbl-ghost-btn sm" onClick={downloadFilteredBuildingCsv} type="button">
                엑셀 내보내기
              </button>
            )}
          </div>

          {/* ── 카드 관리 테이블 ── */}
          {activeTab === '카드 관리' ? (
          <table className="tbl">
            <thead>
              <tr>
                {isAdmin && (
                  <th style={{ width: 52, paddingLeft: 18 }}>
                    <input type="checkbox" checked={filteredCards.length > 0 && filteredCards.every((c) => checkedCardIds.has(c.id))} onChange={toggleAllFilteredCards} />
                  </th>
                )}
                <th>카드</th>
                <th style={{ width: 140 }}>진행</th>
                <th>인도자</th>
                <th style={{ width: 150 }}>유형</th>
                <th style={{ width: 80, textAlign: 'right' }}>중국인</th>
                <th style={{ width: 90, textAlign: 'right' }}>정기방문</th>
                <th style={{ width: 80 }}>구역선</th>
                <th style={{ width: 80 }}>상태</th>
                <th style={{ width: 160, textAlign: 'right', paddingRight: 18 }}>작업</th>
              </tr>
            </thead>
            <tbody>
              {renderedCards.map((card) => {
                const cardBuildings = buildingsByCardId.get(card.id) ?? []
                const operationalState = getTerritoryCardOperationalState(card)
                const chinesePointCount = cardBuildings.reduce((sum, b) => sum + b.units.filter((u) => u.isChinese).length, 0)
                const storeCount = cardBuildings.filter((building) => building.type === '상가').length
                const houseCount = cardBuildings.filter((building) => building.type === '주택').length
                const chineseHeavyCount = cardChineseHeavyCount(card.id)
                const hasBoundary = cardBoundaries.some((b) => b.cardId === card.id)
                const leaders = getCardLeaderList(card)
                return (
                  <tr key={card.id} onClick={() => setSelectedCardId(card.id)} style={{ cursor: 'pointer' }}>
                    {isAdmin && (
                      <td style={{ width: 52, paddingLeft: 18 }} onClick={(e) => e.stopPropagation()}>
                        <input type="checkbox" checked={checkedCardIds.has(card.id)} onChange={() => toggleCheckedCard(card.id)} />
                      </td>
                    )}
                    <td>
                      <div className="tbl__title">{card.name}</div>
                      <div className="tbl__sub">{card.region} {card.area}</div>
                    </td>
                    <td style={{ width: 140 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <div style={{ flex: 1, height: 6, background: 'var(--gray-100)', borderRadius: 'var(--radius-full)', overflow: 'hidden' }}>
                          <div style={{ height: '100%', width: `${card.progress}%`, background: card.progress >= 100 ? 'var(--success-500)' : card.progress > 0 ? 'var(--warning-500)' : 'var(--gray-300)', borderRadius: 'var(--radius-full)' }} />
                        </div>
                        <span className="tnum" style={{ fontSize: 12, color: 'var(--gray-600)', minWidth: 32, textAlign: 'right' }}>{card.progress}%</span>
                      </div>
                    </td>
                    <td onClick={(e) => e.stopPropagation()}>
                      {isAdmin ? (
                        <details style={{ position: 'relative' }}>
                          <summary style={{ listStyle: 'none', cursor: 'pointer', fontSize: 13, color: leaders.length > 0 ? 'var(--gray-900)' : '#B45309', fontWeight: leaders.length > 0 ? 500 : 600 }}>
                            {leaders.length > 0 ? leaders.join(', ') : '미배정'}
                          </summary>
                          <div style={{ position: 'absolute', zIndex: 15, top: 'calc(100% + 4px)', left: 0, minWidth: 200, maxHeight: 200, overflow: 'auto', border: '1px solid var(--border-default)', borderRadius: 'var(--radius-lg)', background: '#fff', padding: 8, boxShadow: 'var(--shadow-md)' }}>
                            {leaderOptions.map((name) => (
                              <label key={name} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '5px 4px', fontSize: 13, cursor: 'pointer' }}>
                                <input type="checkbox" checked={getCardLeaderList(card).includes(name)} onChange={() => void toggleCardLeader(card.id, name)} />
                                {name}
                              </label>
                            ))}
                            <button type="button" style={{ marginTop: 8, width: '100%', minHeight: 32, borderRadius: 8, border: '1px solid var(--border-default)', background: '#fff', fontSize: 12, fontWeight: 600 }} onClick={() => void onSetCardLeaders(card.id, [])}>모두 해제</button>
                          </div>
                        </details>
                      ) : (
                        <span style={{ fontSize: 13, color: leaders.length > 0 ? 'var(--gray-900)' : '#B45309', fontWeight: leaders.length > 0 ? 500 : 600 }}>
                          {leaders.length > 0 ? leaders.join(', ') : '미배정'}
                        </span>
                      )}
                    </td>
                    <td style={{ width: 150 }}>
                      <div className="card-building-type-summary">
                        <span><b>전체</b> <em className="tnum">{card.buildings}</em></span>
                        <span>주택 <em className="tnum">{houseCount}</em></span>
                        <span>상가 <em className="tnum">{storeCount}</em></span>
                      </div>
                    </td>
                    <td className="tnum" style={{ width: 80, textAlign: 'right', fontSize: 13 }}>
                      <div className="card-chinese-summary">
                        <span>{chinesePointCount}건</span>
                        {chineseHeavyCount > 0 && <small>다수 {chineseHeavyCount}</small>}
                      </div>
                    </td>
                    <td className="tnum" style={{ width: 90, textAlign: 'right', fontSize: 13 }}>{card.regularVisits}건</td>
                    <td style={{ width: 80 }}>
                      <span style={{ padding: '2px 8px', borderRadius: 'var(--radius-sm)', background: hasBoundary ? 'var(--gray-100)' : 'transparent', color: hasBoundary ? 'var(--gray-600)' : 'var(--gray-400)', fontSize: 11, fontWeight: 600 }}>
                        {hasBoundary ? '있음' : '없음'}
                      </span>
                    </td>
                    <td style={{ width: 80 }}>
                      <span style={{ padding: '2px 8px', borderRadius: 'var(--radius-sm)', fontSize: 11, fontWeight: 600,
                        background: operationalState === '대상없음' ? 'var(--gray-100)' : card.status === '진행중' ? 'var(--primary-100)' : card.status === '미배정' ? 'var(--warning-100)' : 'var(--success-100)',
                        color: operationalState === '대상없음' ? 'var(--gray-500)' : card.status === '진행중' ? 'var(--primary-700)' : card.status === '미배정' ? 'var(--warning-700)' : 'var(--success-700)',
                      }}>
                        {operationalState === '대상없음' ? '완료·제외' : card.status === '완료' ? '완료' : card.status}
                      </span>
                    </td>
                    <td style={{ width: 160, textAlign: 'right', paddingRight: 18 }} onClick={(e) => e.stopPropagation()}>
                      <div style={{ display: 'inline-flex', gap: 6 }}>
                        <button className="tbl-ghost-btn sm" onClick={() => onOpenCardMap(card.id)} type="button">지도</button>
                        {isAdmin && (
                          <button className="tbl-soft-btn sm" onClick={() => onOpenCardMap(card.id, true)} type="button">수정</button>
                        )}
                      </div>
                    </td>
                  </tr>
                )
              })}
              {doneExcludedCards.length > 0 && (
                <tr>
                  <td colSpan={isAdmin ? 10 : 9} style={{ padding: '10px 18px', background: 'var(--bg-subtle)', borderTop: '1px solid var(--border-subtle)' }}>
                    <button
                      className="tbl-ghost-btn sm"
                      onClick={() => setDoneExcludedOpen((open) => !open)}
                      type="button"
                      style={{ width: '100%', justifyContent: 'center', minHeight: 36 }}
                    >
                      완료·제외 {doneExcludedCards.length}개 {doneExcludedOpen ? '접기' : '펼치기'}
                    </button>
                  </td>
                </tr>
              )}
              {filteredCards.length === 0 && (
                <tr><td colSpan={isAdmin ? 10 : 9} style={{ textAlign: 'center', padding: '32px 18px', color: 'var(--gray-400)', fontSize: 13 }}>
                  {cards.length === 0 ? '카드가 없습니다. 위의 + 카드 추가 버튼으로 첫 카드를 만들어보세요.' : '조건에 맞는 카드가 없습니다.'}
                </td></tr>
              )}
            </tbody>
          </table>
          ) : buildingSubTab === '건물 목록' ? (
          <>
          {duplicateAddressGroups.length > 0 && (
            <div className="dup-address-banner">
              <span className="dup-address-icon">⚠️</span>
              <span className="dup-address-text">
                중복 주소 건물 <strong>{duplicateAddressGroups.length}그룹</strong> ({duplicateAddressGroups.reduce((s, g) => s + g.length, 0)}개 건물) 발견
              </span>
              <button
                className="dup-address-merge-btn"
                onClick={() => {
                  // 각 그룹의 이름 목록 수집
                  const groups = duplicateAddressGroups.map((group) => {
                    const sorted = [...group].sort((a, b) => a.id - b.id)
                    return {
                      primaryId: sorted[0].id,
                      address: sorted[0].address,
                      cardName: cardMap.get(sorted[0].cardId)?.name ?? '카드 없음',
                      buildingCount: sorted.length,
                      unitCount: sorted.reduce((sum, building) => sum + building.units.length, 0),
                      names: sorted.map((b) => b.name),
                    }
                  })
                  setMergeModalGroups(groups)
                  setMergeNameChoices({})
                  setMergeSelectedPrimaryIds(new Set(groups.map((group) => group.primaryId)))
                }}
                type="button"
              >
                중복 주소 합치기
              </button>
            </div>
          )}
          <div className="building-management-table" role="table" aria-label="건물 관리 목록">
            <div className="building-management-head" role="row">
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-start', paddingLeft: 6 }}>
                <input
                  checked={filteredBuildings.length > 0 && filteredBuildings.every((building) => checkedBuildingIds.has(building.id))}
                  onChange={toggleAllFilteredBuildings}
                  type="checkbox"
                />
              </div>
              <span>건물</span>
              <span>주소</span>
              <span>카드</span>
              <span>유형</span>
              <span>세대</span>
              <span>중국인</span>
              <span>다수</span>
              <span>작업</span>
            </div>
            {sortedBuildings.map((building) => {
              const card = cardMap.get(building.cardId)
              const chineseCount = building.units.filter((unit) => unit.isChinese).length
              const isEditing = editingBuildingId === building.id
              const isDuplicate = duplicateBuildingIds.has(building.id)
              // 미배정 필터 활성 시 추천 카드 계산
              const showRecommendation = buildingCardFilter === unassignedCardId && unassignedCardId !== null
              const recommendationBadge = showRecommendation
                ? (() => {
                    const lat = Number(building.lat); const lng = Number(building.lng)
                    if (!isValidMapCoordinate(lat, lng)) return { label: '좌표없음', color: '#d97706', bg: '#fffbeb' }
                    const cId = findCardForCoordinates(lat, lng, cardBoundaries)
                    if (!cId) return { label: '구역선밖', color: '#dc2626', bg: '#fef2f2' }
                    const cName = cardMap.get(cId)?.name ?? `카드${cId}`
                    return { label: `→ ${cName}`, color: '#16a34a', bg: '#f0fdf4' }
                  })()
                : null
              return (
                <div className={`building-management-block${isDuplicate ? ' dup-address-row' : ''}`} key={building.id}>
                  <div className={`building-management-row${isEditing ? ' is-editing' : ''}`} role="row">
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-start', paddingLeft: 6 }}>
                      <input
                        checked={checkedBuildingIds.has(building.id)}
                        onChange={() => toggleCheckedBuilding(building.id)}
                        type="checkbox"
                      />
                    </div>
                    {isEditing ? (
                      <>
                        <input
                          aria-label="건물명"
                          value={buildingEditDraft.name}
                          onChange={(event) => setBuildingEditDraft((draft) => ({ ...draft, name: event.target.value }))}
                        />
                        <input
                          aria-label="주소"
                          value={buildingEditDraft.address}
                          onChange={(event) => setBuildingEditDraft((draft) => ({ ...draft, address: event.target.value }))}
                        />
                        <select
                          aria-label="카드 재배정"
                          value={buildingEditDraft.cardId}
                          onChange={(event) => setBuildingEditDraft((draft) => ({ ...draft, cardId: Number(event.target.value) }))}
                        >
                          {cards.map((item) => (
                            <option key={item.id} value={item.id}>{item.name}</option>
                          ))}
                        </select>
                        <select
                          aria-label="건물 유형"
                          value={buildingEditDraft.type}
                          onChange={(event) => setBuildingEditDraft((draft) => ({ ...draft, type: event.target.value as Building['type'] }))}
                        >
                          <option value="상가">상가</option>
                          <option value="주택">주택</option>
                        </select>
                        <span>{building.units.length}개</span>
                        <span>{chineseCount}건</span>
                        <button
                          className={`building-heavy-toggle${building.isChineseHeavy ? ' active' : ''}`}
                          onClick={() => toggleChineseHeavyBuilding(building)}
                          type="button"
                        >
                          {building.isChineseHeavy ? '다수' : '-'}
                        </button>
                        <span className="building-row-actions">
                          <button onClick={() => saveBuildingEdit(building)} type="button">저장</button>
                          <button onClick={() => setEditingBuildingId(null)} type="button">취소</button>
                        </span>
                      </>
                    ) : (
                      <>
                        <button
                          className="building-name-link"
                          onClick={() => onOpenBuildingMap(building.id)}
                          type="button"
                        >
                          {building.name || '건물명 없음'}
                        </button>
                        <span title={building.address}>{formatDisplayAddress(building.address)}</span>
                        <span>
                          {card?.name ?? '카드 없음'}
                          {recommendationBadge && (
                            <span style={{
                              display: 'inline-block', marginLeft: 6, fontSize: 10.5, fontWeight: 600,
                              color: recommendationBadge.color, background: recommendationBadge.bg,
                              border: `1px solid ${recommendationBadge.color}30`,
                              borderRadius: 5, padding: '1px 5px', verticalAlign: 'middle',
                            }}>{recommendationBadge.label}</span>
                          )}
                        </span>
                        <span>{building.type}</span>
                        <span>{building.units.length}개</span>
                        <span>{chineseCount}건</span>
                        <button
                          className={`building-heavy-toggle${building.isChineseHeavy ? ' active' : ''}`}
                          onClick={() => toggleChineseHeavyBuilding(building)}
                          type="button"
                        >
                          {building.isChineseHeavy ? '다수' : '-'}
                        </button>
                        <span className="building-row-actions">
                          <button onClick={() => startBuildingEdit(building)} type="button">수정</button>
                          <button onClick={() => onOpenBuildingMap(building.id)} type="button">지도</button>
                        </span>
                      </>
                    )}
                  </div>
                  {/* 수정 모드: 세대 목록 */}
                  {isEditing && (
                    <div className="building-units-panel">
                      <div className="building-units-panel-head">
                        <strong>세대 목록</strong>
                        <span className="building-units-count">{building.units.length}개</span>
                      </div>
                      <div className="building-units-list">
                        {[...building.units].sort((a, b) => compareUnitNumbers(a.number, b.number)).map((unit) => {
                          const isEditingThisUnit = editingUnitId === unit.id
                          return (
                            <div className="building-unit-row" key={unit.id}>
                              {isEditingThisUnit ? (
                                <div className="unit-edit-layout">
                                  <div className="unit-edit-row1">
                                    <input
                                      aria-label="호수"
                                      className="unit-number-input"
                                      value={unitEditDraft.number}
                                      onChange={(e) => setUnitEditDraft((d) => ({ ...d, number: e.target.value }))}
                                    />
                                    <select
                                      aria-label="상태"
                                      value={unitEditDraft.status}
                                      onChange={(e) => setUnitEditDraft((d) => ({ ...d, status: e.target.value as UnitStatus }))}
                                    >
                                      {(['미방문', '만남', '부재', '한국인'] as UnitStatus[]).map((s) => (
                                        <option key={s} value={s}>{s}</option>
                                      ))}
                                    </select>
                                    <input
                                      aria-label="메모"
                                      className="unit-memo-input"
                                      placeholder="메모"
                                      value={unitEditDraft.memo}
                                      onChange={(e) => setUnitEditDraft((d) => ({ ...d, memo: e.target.value }))}
                                    />
                                    <span className="unit-row-actions">
                                      <button
                                        onClick={() => {
                                          onUpdateUnitStatus(building.id, unit.id, unitEditDraft.status, unitEditDraft.memo)
                                          onUpdateUnitFlags(unit.id, {
                                            isChinese: unitEditDraft.isChinese,
                                            isRegularVisit: unitEditDraft.isRegularVisit,
                                            isForbidden: unitEditDraft.isForbidden,
                                            memo: unitEditDraft.memo,
                                          })
                                          setEditingUnitId(null)
                                        }}
                                        type="button"
                                      >저장</button>
                                      <button onClick={() => setEditingUnitId(null)} type="button">취소</button>
                                    </span>
                                  </div>
                                  <div className="unit-edit-flags">
                                    <label className="unit-flag-label">
                                      <input
                                        type="checkbox"
                                        checked={unitEditDraft.isForbidden}
                                        onChange={(e) => setUnitEditDraft((d) => ({ ...d, isForbidden: e.target.checked }))}
                                      />
                                      방문금지
                                    </label>
                                    <label className="unit-flag-label">
                                      <input
                                        type="checkbox"
                                        checked={unitEditDraft.isRegularVisit}
                                        onChange={(e) => setUnitEditDraft((d) => ({ ...d, isRegularVisit: e.target.checked }))}
                                      />
                                      정기방문
                                    </label>
                                    <label className="unit-flag-label">
                                      <input
                                        type="checkbox"
                                        checked={unitEditDraft.isChinese}
                                        onChange={(e) => setUnitEditDraft((d) => ({ ...d, isChinese: e.target.checked }))}
                                      />
                                      중국인
                                    </label>
                                  </div>
                                </div>
                              ) : (
                                <>
                                  <span className="unit-number">{unit.number}{/^\d+$/.test(unit.number) ? '호' : ''}</span>
                                  <span className={`unit-status unit-status-${unit.status}`}>{unit.status}</span>
                                  <div className="unit-flags-display">
                                    {unit.isForbidden && <span className="unit-flag-chip forbidden">방문금지</span>}
                                    {unit.isRegularVisit && <span className="unit-flag-chip regular">정기</span>}
                                    {unit.isChinese && <span className="unit-flag-chip chinese">中</span>}
                                  </div>
                                  <span className="unit-memo">{unit.memo || '-'}</span>
                                  <span className="unit-row-actions">
                                    <button
                                      onClick={() => {
                                        setEditingUnitId(unit.id)
                                        setUnitEditDraft({
                                          number: unit.number,
                                          status: unit.status,
                                          memo: unit.memo ?? '',
                                          isChinese: unit.isChinese ?? false,
                                          isRegularVisit: unit.isRegularVisit ?? false,
                                          isForbidden: unit.isForbidden ?? false,
                                        })
                                      }}
                                      type="button"
                                    >수정</button>
                                    <button
                                      onClick={() => {
                                        if (window.confirm(`${unit.number}${/^\d+$/.test(unit.number) ? '호' : ''}를 삭제할까요?`)) onDeleteUnit(building.id, unit.id)
                                      }}
                                      type="button"
                                    >삭제</button>
                                  </span>
                                </>
                              )}
                            </div>
                          )
                        })}
                        {/* 새 세대 추가 행 */}
                        <AddUnitRow
                          buildingId={building.id}
                          existingNumbers={new Set(building.units.map((u) => u.number))}
                          onAdd={onAddUnit}
                        />
                      </div>
                    </div>
                  )}
                </div>
              )
            })}
            {filteredBuildings.length === 0 && (
              <div className="empty-card-row">
                조건에 맞는 건물이 없습니다. 건물 CSV 업로드 또는 지도 탭에서 건물을 추가해 주세요.
              </div>
            )}
          </div>
          </>
        ) : (
          <div className="point-management-table" ref={pointTableRef} role="table" aria-label="중국인 포인트 목록">
            <div className="point-management-head" role="row">
              <span>카드</span>
              <span>건물/주소</span>
              <span>포인트</span>
              <span>정기</span>
              <span>최근 방문</span>
              <span>메모</span>
              <span>지도</span>
            </div>
            {pointRows.map(({ building, unit, latestHistory }) => {
              const card = cardMap.get(building.cardId)
              return (
                <div
	                  className={`point-management-row${selectedPointDetail?.buildingId === building.id && selectedPointDetail?.unitId === unit.id ? ' selected' : ''}`}
	                  key={`${building.id}-${unit.id}`}
	                  onClick={() => setSelectedPointDetail({ buildingId: building.id, unitId: unit.id })}
	                  ref={(node) => {
	                    const key = `${building.id}-${unit.id}`
	                    if (node) pointRowRefs.current.set(key, node)
	                    else pointRowRefs.current.delete(key)
	                  }}
	                  role="row"
	                >
                  <span>{card?.name ?? '카드 없음'}</span>
                  <span title={building.address}>{building.name || formatDisplayAddress(building.address)}</span>
                  <strong title={unit.number}>{unit.number}</strong>
	                  {unit.isRegularVisit ? (
	                    <input
	                      aria-label={`${unit.number} 정기방문자`}
	                      className="regular-visitor-input"
	                      defaultValue={unit.regularVisitor ?? ''}
                        onClick={(event) => event.stopPropagation()}
	                      onBlur={(event) => onSetRegularVisitor(unit.id, event.currentTarget.value)}
	                      placeholder="방문자"
	                    />
	                  ) : (
	                    <button
	                      className="point-toggle"
	                      onClick={(event) => {
                          event.stopPropagation()
                          onToggleRegularVisit(building.id, unit.id)
                        }}
	                      type="button"
	                    >
	                      등록
                    </button>
                  )}
                  <span className="point-visit-cell">
                    <span title={latestHistory ? `${latestHistory.visitedAt} ${latestHistory.timeSlot} ${latestHistory.result}` : undefined}>
                      {latestHistory ? `${latestHistory.visitedAt.slice(5)} ${latestHistory.timeSlot} ${latestHistory.result}` : '-'}
                    </span>
	                    <button
	                      className="point-visit-edit-btn"
	                      onClick={(event) => {
                          event.stopPropagation()
                          openPointVisitEditor({ building, unit, history: latestHistory })
                        }}
	                      type="button"
	                    >
	                      {latestHistory ? '수정' : '등록'}
	                    </button>
	                    <button
	                      className="point-visit-edit-btn"
	                      onClick={(event) => {
                          event.stopPropagation()
                          setSelectedPointDetail({ buildingId: building.id, unitId: unit.id })
                        }}
	                      type="button"
	                    >
	                      기록
	                    </button>
	                  </span>
	                  <input
	                    aria-label={`${unit.number} 메모`}
	                    defaultValue={unit.memo ?? ''}
                      onClick={(event) => event.stopPropagation()}
	                    onBlur={(event) => onUpdateUnitFlags(unit.id, { memo: event.currentTarget.value })}
	                  />
	                  <button
                      onClick={(event) => {
                        event.stopPropagation()
                        onOpenBuildingMap(building.id)
                      }}
                      type="button"
                    >지도</button>
	                </div>
              )
            })}
            {pointRows.length === 0 && (
              <div className="empty-card-row">
                표시할 중국인 포인트가 없습니다. 지도에서 호수를 기록하거나 CSV로 포인트를 업로드해 주세요.
              </div>
            )}
          </div>
        )}
        </div>{/* /desk-card */}
        </>)}
      </div>{/* /territory-main */}

      {showPointDetailPane && selectedPointDetailData && (
	        <aside
	          className="territory-side point-detail-pane"
	          ref={pointDetailPaneRef}
	          style={{ '--point-detail-offset': `${selectedPointDetailOffset}px` } as React.CSSProperties}
	        >
          <div className="point-detail-scroll">
            <div className="point-detail-head">
              <div>
                <p>{selectedPointDetailData.card?.name ?? '카드 없음'}</p>
                <h3>{selectedPointDetailData.unit.number}</h3>
                <span>{selectedPointDetailData.building.name || formatDisplayAddress(selectedPointDetailData.building.address)}</span>
              </div>
              <button onClick={() => setSelectedPointDetail(null)} type="button">닫기</button>
            </div>

            <div className="point-detail-summary">
              <div>
                <strong>{selectedPointDetailData.histories[0] ? `${selectedPointDetailData.histories[0].visitedAt.slice(5)} ${selectedPointDetailData.histories[0].timeSlot} ${selectedPointDetailData.histories[0].result}` : '아직 없음'}</strong>
                <span>최근 방문</span>
              </div>
              <div>
                <strong>{selectedPointDetailData.histories.length}건</strong>
                <span>누적 기록</span>
              </div>
            </div>

            <div className="point-detail-actions">
              <button
                className="primary"
                onClick={() => openPointVisitEditor({ building: selectedPointDetailData.building, unit: selectedPointDetailData.unit })}
                type="button"
              >
                + 방문 기록 추가
              </button>
              <button onClick={() => onOpenBuildingMap(selectedPointDetailData.building.id)} type="button">지도</button>
            </div>

            {selectedPointDetailData.unit.isRegularVisit && (
              <div className="point-detail-info">
                <span>정기방문</span>
                <strong>{selectedPointDetailData.unit.regularVisitor || '방문자 미지정'}</strong>
              </div>
            )}

            <div className="point-history-list">
              <div className="point-history-title">방문 기록</div>
              {selectedPointDetailData.histories.length > 0 ? (
                selectedPointDetailData.histories.map((history) => (
                  <div className="point-history-item" key={history.id}>
                    <div className="point-history-main">
                      <div className="point-history-date-line">
                        <strong>{history.visitedAt.slice(0, 10)} {history.timeSlot}</strong>
                        <span className={`point-history-result result-${history.result}`}>{history.result}</span>
                      </div>
                      <div className="point-history-menu">
                        <button
                          aria-label="방문 기록 작업"
                          className="point-history-menu-btn"
                          onClick={() => setOpenHistoryActionId((current) => current === history.id ? null : history.id)}
                          type="button"
                        >
                          ...
                        </button>
                        {openHistoryActionId === history.id && (
                          <div className="point-history-menu-popover">
                            <button
                              onClick={() => {
                                setOpenHistoryActionId(null)
                                openPointVisitEditor({
                                  building: selectedPointDetailData.building,
                                  unit: selectedPointDetailData.unit,
                                  history,
                                })
                              }}
                              type="button"
                            >
                              수정
                            </button>
                            {onDeleteVisitHistory && (
                              <button className="danger" onClick={() => deletePointVisitHistory(history)} type="button">삭제</button>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                    {history.memo && <p>{history.memo}</p>}
                  </div>
                ))
              ) : (
                <div className="point-history-empty">등록된 방문 기록이 없습니다.</div>
              )}
            </div>

            <div className="point-detail-info">
              <span>메모</span>
              <strong>{selectedPointDetailData.unit.memo || '메모 없음'}</strong>
            </div>
          </div>
        </aside>
      )}

      {zoneKind === 'territory' && activeTab === '카드 관리' && detailPaneOpen && (
      <aside className="territory-side">
        {!selectedCard ? (
          <div style={{ height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 12, color: '#94a3b8' }}>
            <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="3" width="18" height="18" rx="2"/><line x1="9" y1="3" x2="9" y2="21"/><line x1="14" y1="8" x2="19" y2="8"/><line x1="14" y1="12" x2="19" y2="12"/><line x1="14" y1="16" x2="19" y2="16"/>
            </svg>
            <p style={{ fontSize: 13, fontWeight: 600, margin: 0 }}>카드를 선택하세요</p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'auto' }}>

            {/* 헤더 */}
            <div style={{ padding: '18px 20px 14px', borderBottom: '1px solid #f1f5f9' }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}>
                <div>
                  <p style={{ margin: 0, fontSize: 11, fontWeight: 600, color: '#94a3b8', letterSpacing: '0.04em', textTransform: 'uppercase' }}>
                    {selectedCard.region} · {selectedCard.area}
                  </p>
                  <h3 style={{ margin: '4px 0 0', fontSize: 16, fontWeight: 700, color: '#1e293b' }}>{selectedCard.name}</h3>
                </div>
                <span style={{
                  fontSize: 11, fontWeight: 700, padding: '3px 8px', borderRadius: 6,
                  background: selectedCard.status === '완료' ? '#f0fdf4' : selectedCard.status === '진행중' ? '#eff6ff' : '#f8fafc',
                  color: selectedCard.status === '완료' ? '#16a34a' : selectedCard.status === '진행중' ? '#2563eb' : '#94a3b8',
                  border: `1px solid ${selectedCard.status === '완료' ? '#bbf7d0' : selectedCard.status === '진행중' ? '#bfdbfe' : '#e2e8f0'}`,
                  flexShrink: 0,
                }}>{selectedCard.status}</span>
              </div>

              {/* 진행률 바 */}
              <div style={{ marginTop: 12 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: '#64748b', marginBottom: 5 }}>
                  <span>진행률</span>
                  <span style={{ fontWeight: 700, color: '#1e293b' }}>{selectedCard.progress}%</span>
                </div>
                <div style={{ height: 5, background: '#f1f5f9', borderRadius: 99, overflow: 'hidden' }}>
                  <div style={{ height: '100%', width: `${selectedCard.progress}%`, background: selectedCard.progress >= 80 ? '#16a34a' : selectedCard.progress >= 40 ? '#2563eb' : '#94a3b8', borderRadius: 99, transition: 'width .3s' }} />
                </div>
              </div>

              {/* 마지막 방문 */}
              <div style={{ marginTop: 14, display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 8, fontSize: 12 }}>
                <span style={{ color: '#64748b', fontWeight: 600 }}>마지막 방문</span>
                {selectedLastVisit ? (
                  <span style={{ color: '#1e293b' }}>
                    <strong style={{ fontWeight: 700 }}>{formatRelativeDate(selectedLastVisit.visitedAt)}</strong>
                    <span style={{ color: '#94a3b8', marginLeft: 6 }}>· {selectedLastVisit.visitor}</span>
                  </span>
                ) : (
                  <span style={{ color: '#cbd5e1' }}>아직 없음</span>
                )}
              </div>
            </div>

            {/* 통계 칩 */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, padding: '14px 20px', borderBottom: '1px solid #f1f5f9' }}>
              {[
                { label: '건물', value: `${selectedCard.buildings}개` },
                { label: '세대', value: `${selectedCard.units}개` },
                { label: '완료', value: `${selectedCard.completed}개` },
                { label: '중국인', value: `${selectedChinesePointCount}건`, highlight: selectedChinesePointCount > 0 },
                { label: '정기방문', value: `${selectedCard.regularVisits}건` },
                { label: '구역선', value: selectedHasBoundary ? '있음' : '없음' },
              ].map(({ label, value, highlight }) => (
                <div key={label} style={{ background: '#f8fafc', borderRadius: 8, padding: '8px 12px', border: '1px solid #f1f5f9' }}>
                  <div style={{ fontSize: 10, fontWeight: 600, color: '#94a3b8', marginBottom: 2 }}>{label}</div>
                  <div style={{ fontSize: 14, fontWeight: 700, color: highlight ? '#dc2626' : '#1e293b' }}>{value}</div>
                </div>
              ))}
            </div>

            {/* 인도자 배정 */}
            <div style={{ padding: '14px 20px', borderBottom: '1px solid #f1f5f9' }}>
              <p style={{ margin: '0 0 10px', fontSize: 11, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.04em' }}>인도자 배정</p>
              {isAdmin ? (
                <>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {leaderOptions.map((leaderName) => (
                      <label key={leaderName} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: '#334155', cursor: 'pointer' }}>
                        <input
                          type="checkbox"
                          checked={getCardLeaderList(selectedCard).includes(leaderName)}
                          onChange={() => void toggleCardLeader(selectedCard.id, leaderName)}
                          style={{ accentColor: '#2563eb', width: 14, height: 14 }}
                        />
                        {leaderName}
                      </label>
                    ))}
                  </div>
                  {getCardLeaderList(selectedCard).length > 0 && (
                    <button
                      type="button"
                      onClick={() => void onSetCardLeaders(selectedCard.id, [])}
                      style={{ marginTop: 10, width: '100%', padding: '7px 0', borderRadius: 8, border: '1px solid #e2e8f0', background: '#fff', fontSize: 12, fontWeight: 600, color: '#94a3b8', cursor: 'pointer' }}
                    >인도자 모두 해제</button>
                  )}
                </>
              ) : (
                <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: getCardLeaderList(selectedCard).length > 0 ? '#1e293b' : '#94a3b8' }}>
                  {getCardLeaderList(selectedCard).length > 0 ? getCardLeaderList(selectedCard).join(', ') : '미배정'}
                </p>
              )}
            </div>

            {/* 배정된 사용자 */}
            <div style={{ padding: '14px 20px', borderBottom: '1px solid #f1f5f9' }}>
              <p style={{ margin: '0 0 10px', fontSize: 11, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.04em' }}>배정 사용자</p>
              {selectedCard.assignedUsers.length === 0 ? (
                <p style={{ margin: 0, fontSize: 12, color: '#cbd5e1' }}>아직 없음</p>
              ) : (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                  {selectedCard.assignedUsers.map((person) => (
                    <span key={person} style={{ fontSize: 12, fontWeight: 600, padding: '3px 9px', borderRadius: 99, background: '#f1f5f9', color: '#475569', border: '1px solid #e2e8f0' }}>
                      {person}
                    </span>
                  ))}
                </div>
              )}
            </div>

            {/* 정기방문 포인트 */}
            <div style={{ padding: '14px 20px' }}>
              <p style={{ margin: '0 0 10px', fontSize: 11, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.04em' }}>정기방문</p>
              {selectedCard.regularVisitPoints.length === 0 ? (
                <p style={{ margin: 0, fontSize: 12, color: '#cbd5e1' }}>등록된 정기방문 없음</p>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {selectedCard.regularVisitPoints.map((point) => (
                    <div key={`${point.point}-${point.visitor}`} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: 12, padding: '6px 10px', background: '#f8fafc', borderRadius: 8, border: '1px solid #f1f5f9' }}>
                      <span style={{ fontWeight: 600, color: '#1e293b' }}>{point.point}</span>
                      <span style={{ color: '#64748b' }}>{point.visitor}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

          </div>
        )}
      </aside>
      )}
    </section>
  )
}
