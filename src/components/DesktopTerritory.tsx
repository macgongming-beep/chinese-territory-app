import { useEffect, useState } from 'react'
import { useAuth } from '../hooks/useAuth'
import { territoryAreasByRegion, territoryRegions } from '../data/territoryStructure'
import { showToast } from '../lib/toast'
import { findCardForCoordinates, formatDisplayAddress, isValidMapCoordinate, normalizeMapCoordinates, parseCoordinate } from '../utils/mapUtils'
import type { Building, CardBoundary, Role, TerritoryCard, TerritoryRegion, Unit, UnitStatus, VisitHistory } from '../types'

type CsvBuildingImport = {
  cardId: number
  name: string
  address: string
  type: Building['type']
  lat: number
  lng: number
  units: CsvUnitImport[]
}

type CsvUnitImport = {
  number: string
  status: UnitStatus
  isChinese: boolean
  isRegularVisit: boolean
  regularVisitor?: string
  memo?: string
}

type CsvPreviewRow = CsvBuildingImport & {
  rowNumber: number
  cardName: string
}

type CsvSkippedRow = {
  rowNumber: number
  reason: string
  hint: string
  address?: string
}

function normalizeCsvKey(value: string) {
  return value.trim().toLowerCase().replace(/[\s_-]/g, '')
}

function parseCsv(text: string) {
  const rows: string[][] = []
  let current = ''
  let row: string[] = []
  let inQuotes = false

  for (let i = 0; i < text.length; i += 1) {
    const char = text[i]
    const next = text[i + 1]

    if (char === '"' && inQuotes && next === '"') {
      current += '"'
      i += 1
      continue
    }
    if (char === '"') {
      inQuotes = !inQuotes
      continue
    }
    if (char === ',' && !inQuotes) {
      row.push(current.trim())
      current = ''
      continue
    }
    if ((char === '\n' || char === '\r') && !inQuotes) {
      if (char === '\r' && next === '\n') i += 1
      row.push(current.trim())
      if (row.some(Boolean)) rows.push(row)
      row = []
      current = ''
      continue
    }
    current += char
  }

  row.push(current.trim())
  if (row.some(Boolean)) rows.push(row)
  return rows
}

function splitUnitNumbers(value: string) {
  return Array.from(
    new Set(
      value
        .split(/[|;/,\n]+/)
        .map((unit) => unit.trim())
        .filter(Boolean),
    ),
  )
}

function normalizeUnitStatus(value: string): UnitStatus {
  const text = value.trim()
  if (text.includes('만남') || text.includes('초대장')) return '만남'
  if (text.includes('부재') || text.includes('삭제')) return '부재'
  if (text.includes('한국')) return '한국인'
  if (text.includes('거절')) return '거절'
  if (text.includes('확인') || text.includes('재확인')) return '확인필요'
  return '미방문'
}

function looksTruthy(value: string) {
  return /^(true|yes|y|1|중국인|중국|정기|재방|있음|ㅇ|예)$/i.test(value.trim())
}

function createCsvUnits(unitValue: string, input: {
  status: UnitStatus
  isChinese: boolean
  regularVisitor: string
  memo: string
}): CsvUnitImport[] {
  const unitNumbers = splitUnitNumbers(unitValue)
  const numbers = unitNumbers.length > 0 ? unitNumbers : ['1층']
  return numbers.map((number) => ({
    number,
    status: input.status,
    isChinese: input.isChinese || Boolean(input.regularVisitor) || input.status === '만남' || input.status === '부재',
    isRegularVisit: Boolean(input.regularVisitor),
    regularVisitor: input.regularVisitor || undefined,
    memo: input.memo || undefined,
  }))
}

function csvCell(value: string | number) {
  const text = String(value)
  return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text
}

function downloadCsvExample() {
  const headers = ['카드명', '지역', '동', '카드번호', '주소', '건물명', '유형', '호수', '상태', '중국인', '정기방문자', '메모', '위도', '경도', '원본역번']
  const data = [
    ['처인구 고림동 1', '처인구', '고림동', '1', '경기도 용인시 처인구 경안천로 232', '감자탕형제들', '상가', '1층', '부재', '중국인', '', '중국인 없음', '', '', '1'],
    ['처인구 고림동 1', '처인구', '고림동', '1', '경기도 용인시 처인구 고진로 45', '동아빌라 301호', '주택', '301호', '만남', '중국인', '박진호', '정기방문 등록', '', '', '5'],
    ['', '처인구', '김량장동', '1', '경기도 용인시 처인구 금령로 108-1', '김밥천국', '상가', '1층', '미방문', '', '', '', '', '', '17'],
  ]
  const csvContent = [headers, ...data].map((row) => row.map(csvCell).join(',')).join('\n')
  const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.setAttribute('href', url)
  link.setAttribute('download', 'building_import_example.csv')
  link.style.visibility = 'hidden'
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}

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
  onOpenCardMap,
  onOpenBuildingMap,
  visitHistories,
  onCreateBuilding,
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
  onUpdateBuilding: (buildingId: number, name: string, address: string, lat?: number, lng?: number, type?: Building['type'], memo?: string) => void
  onToggleChinese: (buildingId: number, unitId: number) => void
  onToggleRegularVisit: (buildingId: number, unitId: number, visitorName?: string) => void
  onSetRegularVisitor: (unitId: number, visitorName: string) => void
  onAddUnit: (buildingId: number, unitNumber: string) => void
  onDeleteUnit: (buildingId: number, unitId: number) => void
  onUpdateUnitFlags: (unitId: number, flags: Partial<Unit>) => void
  onUpdateUnitStatus: (buildingId: number, unitId: number, status: UnitStatus, memo?: string) => void
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
}) {
  const { allUsers, fetchAllUsers } = useAuth()
  const isAdmin = role === 'admin'
  const [selectedCardId, setSelectedCardId] = useState<number | null>(null)
  const [checkedCardIds, setCheckedCardIds] = useState<Set<number>>(new Set())
  const [checkedBuildingIds, setCheckedBuildingIds] = useState<Set<number>>(new Set())
  const [detailPaneOpen, setDetailPaneOpen] = useState(false)
  const [activeTab, setActiveTab] = useState<'카드 관리' | '건물 관리'>('카드 관리')
  const [buildingSubTab, setBuildingSubTab] = useState<'건물 목록' | '중국인 포인트'>('건물 목록')
  const [showCardModal, setShowCardModal] = useState(false)
  const [newCardArea, setNewCardArea] = useState('고림동')
  const [newCardRegion, setNewCardRegion] = useState('처인구')
  const [newCardIndex, setNewCardIndex] = useState(3)
  const [newCardPinCount, setNewCardPinCount] = useState(5)
  const [creatingCard, setCreatingCard] = useState(false)
  const [pendingBoundaryCard, setPendingBoundaryCard] = useState<{ id: number; name: string } | null>(null)
  const [regionFilter, setRegionFilter] = useState<TerritoryRegion | '전체'>('전체')
  const [areaFilter, setAreaFilter] = useState('전체')
  const [areaExpanded, setAreaExpanded] = useState(false)
  const AREA_CHIP_LIMIT = 10
  const [assignmentFilter, setAssignmentFilter] = useState<'전체' | '미배정'>('전체')
  const [buildingCardFilter, setBuildingCardFilter] = useState<number | '전체'>('전체')
  const [buildingTypeFilter, setBuildingTypeFilter] = useState<Building['type'] | '전체'>('전체')
  const [pointStatusFilter, setPointStatusFilter] = useState<UnitStatus | '전체'>('전체')
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
  // 건물 추가 모달
  const [addBuildingOpen, setAddBuildingOpen] = useState(false)
  const [addBuildingForm, setAddBuildingForm] = useState<{ name: string; address: string; type: Building['type']; cardId: number | 'auto' }>({ name: '', address: '', type: '주택', cardId: 'auto' })
  const [addBuildingGeoState, setAddBuildingGeoState] = useState<'idle' | 'loading' | 'ok' | 'fail'>('idle')
  const [addBuildingLatLng, setAddBuildingLatLng] = useState<{ lat: number; lng: number } | null>(null)
  const [addBuildingSubmitting, setAddBuildingSubmitting] = useState(false)
  const [csvPreviewRows, setCsvPreviewRows] = useState<CsvPreviewRow[]>([])
  const [csvSkippedRows, setCsvSkippedRows] = useState(0)
  const [csvSkippedDetails, setCsvSkippedDetails] = useState<CsvSkippedRow[]>([])
  const [csvParsing, setCsvParsing] = useState(false)
  const [csvImporting, setCsvImporting] = useState(false)
  const [reassigningByBoundary, setReassigningByBoundary] = useState(false)
  const [bulkLeaderNames, setBulkLeaderNames] = useState<string[]>([])
  const [bulkAssigning, setBulkAssigning] = useState(false)

  useEffect(() => {
    if (isAdmin && allUsers.length === 0) {
      fetchAllUsers()
    }
  }, [allUsers.length, fetchAllUsers, isAdmin])

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
        const card = cards.find((item) => item.id === building.cardId)
        if (!card || card.area !== area) return sum
        if (regionFilter !== '전체' && card.region !== regionFilter) return sum
        return sum + building.units.filter((unit) => unit.isChinese || unit.isRegularVisit).length
      }, 0)
    }

    if (activeTab === '건물 관리') {
      return buildings.reduce((sum, building) => {
        const card = cards.find((item) => item.id === building.cardId)
        if (!card || card.area !== area) return sum
        if (regionFilter !== '전체' && card.region !== regionFilter) return sum
        return sum + 1
      }, 0)
    }

    return getAreaCardCount(area)
  }

  const getNextCardIndex = (region: string, area: string) => {
    const indexes = cards
      .filter((card) => card.region === region && card.area === area)
      .map((card) => {
        const match = card.name.match(/(\d+)$/)
        return match ? Number(match[1]) : 0
      })
      .filter((index) => Number.isFinite(index))
    return Math.max(0, ...indexes) + 1
  }

  const getCardLeaderList = (card: TerritoryCard) =>
    (card.assignedLeaders && card.assignedLeaders.length > 0)
      ? card.assignedLeaders
      : card.assignedLeader
        ? [card.assignedLeader]
        : []

  const filteredCards = cards.filter((card) => {
    if (regionFilter !== '전체' && card.region !== regionFilter) return false
    if (areaFilter !== '전체' && card.area !== areaFilter) return false
    if (assignmentFilter === '미배정' && getCardLeaderList(card).length > 0) return false
    return true
  })

  const selectedCard =
    filteredCards.find((card) => card.id === selectedCardId) ??
    filteredCards[0] ??
    cards.find((card) => card.id === selectedCardId) ??
    cards[0] ??
    null
  const selectedCardBuildings = selectedCard
    ? buildings.filter((building) => building.cardId === selectedCard.id)
    : []
  const selectedChinesePointCount = selectedCardBuildings.reduce(
    (sum, building) => sum + building.units.filter((unit) => unit.isChinese).length,
    0,
  )
  const selectedHasBoundary = selectedCard
    ? cardBoundaries.some((boundary) => boundary.cardId === selectedCard.id)
    : false
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

  const cardMap = new Map(cards.map((card) => [card.id, card]))
  const filteredBuildings = buildings.filter((building) => {
    const card = cardMap.get(building.cardId)
    if (!card) return false
    if (regionFilter !== '전체' && card.region !== regionFilter) return false
    if (areaFilter !== '전체' && card.area !== areaFilter) return false
    if (buildingCardFilter !== '전체' && building.cardId !== buildingCardFilter) return false
    if (buildingTypeFilter !== '전체' && building.type !== buildingTypeFilter) return false
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
  const pointRows = filteredBuildings.flatMap((building) =>
    building.units
      .filter((unit) => unit.isChinese || unit.isRegularVisit)
      .map((unit) => {
        const histories = visitHistories.filter((history) => history.unitId === unit.id)
        return { building, unit, latestHistory: histories[0] }
      }),
  ).filter(({ unit }) => pointStatusFilter === '전체' || unit.status === pointStatusFilter)
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

  const totalCards = cards.length
  const assignedCards = cards.filter((card) => getCardLeaderList(card).length > 0).length
  const totalUnits = cards.reduce((sum, card) => sum + card.units, 0)
  const completedUnits = cards.reduce((sum, card) => sum + card.completed, 0)
  const newCardName = `${newCardRegion} ${newCardArea} ${newCardIndex}`
  const duplicateCard = cards.find((card) => card.name === newCardName)

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

    const rows = parseCsv(await file.text())
    if (rows.length < 2) {
      setCsvParsing(false)
      showToast('CSV에 헤더와 데이터 행이 필요합니다.', 'error')
      return
    }

    const headers = rows[0].map(normalizeCsvKey)
    const findValue = (row: string[], keys: string[]) => {
      const normalizedKeys = keys.map(normalizeCsvKey)
      const index = headers.findIndex((header) => normalizedKeys.includes(header))
      return index >= 0 ? row[index]?.trim() ?? '' : ''
    }

    const previewRows: CsvPreviewRow[] = []
    const skippedDetails: CsvSkippedRow[] = []
    let skipped = 0
    const skipRow = (rowNumber: number, reason: string, hint: string, address?: string) => {
      skipped += 1
      skippedDetails.push({ rowNumber, reason, hint, address })
    }

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
      const statusValue = findValue(row, ['status', '상태', '방문결과', '결과'])
      const chineseValue = findValue(row, ['chinese', 'isChinese', '중국인', '중국인여부'])
      const regularVisitorValue = findValue(row, ['regularVisitor', 'regular', '정기방문자', '재방문자', '정기방문'])
      const memoValue = findValue(row, ['memo', 'note', '메모', '비고', '备注'])
      const latValue = findValue(row, ['lat', 'latitude', '위도'])
      const lngValue = findValue(row, ['lng', 'lon', 'longitude', '경도'])
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
        skipRow(rowNumber, '주소 없음', '`주소` 컬럼에 지번/도로명 주소를 넣어 주세요.')
        continue
      }

      if (cardIdValue && !cardById) {
        skipRow(
          rowNumber,
          '카드 ID 매칭 실패',
          'CSV의 cardId/카드ID가 앱의 실제 카드 ID와 일치하는지 확인하거나, 카드 ID 칸을 비워 주소 기반 자동 배정을 사용해 주세요.',
          address,
        )
        continue
      }

      let coordinates = normalizeMapCoordinates(parseCoordinate(latValue), parseCoordinate(lngValue))
      if (!coordinates) {
        const geocoded = await geocodeAddress(address)
        if (!geocoded) {
          skipRow(rowNumber, '주소 좌표 변환 실패', '주소를 더 자세히 쓰거나 위도/경도를 직접 입력해 주세요.', address)
          continue
        }
        coordinates = geocoded
      }
      const { lat, lng } = coordinates

      const autoCardId = explicitCard ? null : findCardForCoordinates(lat, lng, cardBoundaries)
      const card = explicitCard ?? cards.find((item) => item.id === autoCardId)

      if (!card) {
        skipRow(
          rowNumber,
          '자동 카드 배정 실패',
          'CSV에 카드명을 직접 넣거나, 해당 주소가 포함되는 카드 구역선을 먼저 그려 주세요.',
          address,
        )
        continue
      }

      const name = nameValue || address.split(' ').slice(-2).join(' ') || '새 건물'
      previewRows.push({
        rowNumber,
        cardId: card.id,
        cardName: card.name,
        name,
        address,
        type: typeValue.includes('상가') ? '상가' : '주택',
        lat,
        lng,
        units: createCsvUnits(unitsValue, {
          status: normalizeUnitStatus(statusValue),
          isChinese: looksTruthy(chineseValue),
          regularVisitor: regularVisitorValue,
          memo: memoValue,
        }),
      })
    }

    setCsvPreviewRows(previewRows)
    setCsvSkippedRows(skipped)
    setCsvSkippedDetails(skippedDetails)
    setCsvParsing(false)
    showToast(`CSV 확인 완료: ${previewRows.length}개 준비, ${skipped}개 제외`, previewRows.length > 0 ? 'success' : 'info')
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
    const relatedBuildingCount = buildings.filter((building) => ids.includes(building.cardId)).length
    const confirmed = window.confirm(`선택한 카드 ${ids.length}개를 삭제할까요?\n이 카드에 속한 건물 ${relatedBuildingCount}개도 함께 삭제됩니다.`)
    if (!confirmed) return
    onDeleteCards(ids)
    setCheckedCardIds(new Set())
    if (selectedCardId && ids.includes(selectedCardId)) setSelectedCardId(null)
  }

  const handleDeleteCheckedBuildings = () => {
    const ids = Array.from(checkedBuildingIds)
    if (ids.length === 0) return
    const confirmed = window.confirm(`선택한 건물 ${ids.length}개를 삭제할까요?\n건물에 속한 호수와 방문 정보도 함께 정리될 수 있습니다.`)
    if (!confirmed) return
    onDeleteBuildings(ids)
    setCheckedBuildingIds(new Set())
  }

  useEffect(() => {
    if (regionFilter === '전체') return
    setNewCardRegion(regionFilter)
    if (areaFilter !== '전체') {
      setNewCardArea(areaFilter)
      return
    }
    setNewCardArea(territoryAreasByRegion[regionFilter][0] ?? '')
  }, [areaFilter, regionFilter])

  useEffect(() => {
    if (!newCardRegion || !newCardArea) return
    setNewCardIndex(getNextCardIndex(newCardRegion, newCardArea))
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cards, newCardArea, newCardRegion])

  const handleCreateCard = async () => {
    if (duplicateCard || creatingCard) return
    setCreatingCard(true)
    const newCardId = await onCreateCard({
      area: newCardArea,
      region: newCardRegion,
      index: newCardIndex,
      pinCount: newCardPinCount,
    })
    setCreatingCard(false)
    if (!newCardId) return
    setSelectedCardId(newCardId)
    setShowCardModal(false)
    setPendingBoundaryCard({ id: newCardId, name: newCardName })
    setNewCardIndex(newCardIndex + 1)
  }

  const openModal = () => {
    setNewCardIndex(getNextCardIndex(newCardRegion, newCardArea))
    setShowCardModal(true)
  }

  return (
    <section className={activeTab === '건물 관리' || !detailPaneOpen ? 'territory-layout building-management-only' : 'territory-layout'}>
      {/* ── 카드 추가 모달 ── */}
      {showCardModal && (
        <div className="cal-modal-backdrop" onClick={() => setShowCardModal(false)}>
          <div className="cal-modal" style={{ maxWidth: '440px' }} onClick={(e) => e.stopPropagation()}>
            <div className="cal-modal-head">
              <div className="cal-modal-title">
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" /><line x1="12" y1="18" x2="12" y2="12" /><line x1="9" y1="15" x2="15" y2="15" />
                </svg>
                <h2>새 구역 카드 추가</h2>
              </div>
              <button className="cal-modal-close" onClick={() => setShowCardModal(false)} type="button">
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                  <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>

            <div className="cal-modal-body">
              <div className="cal-field-row">
                <div className="cal-field">
                  <label>지역</label>
                  <select
                    className="cal-input"
                    value={newCardRegion}
                    onChange={(e) => {
                      const nextRegion = e.target.value as keyof typeof territoryAreasByRegion
                      setNewCardRegion(nextRegion)
                      setNewCardArea(territoryAreasByRegion[nextRegion][0] ?? '')
                    }}
                  >
                    {territoryRegions.map((region) => (
                      <option key={region} value={region}>{region}</option>
                    ))}
                  </select>
                </div>
                <div className="cal-field">
                  <label>동</label>
                  <select
                    className="cal-input"
                    value={newCardArea}
                    onChange={(e) => setNewCardArea(e.target.value)}
                  >
                    {(territoryAreasByRegion[newCardRegion as keyof typeof territoryAreasByRegion] ?? []).map((area) => (
                      <option key={area} value={area}>{area}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="cal-field-row">
                <div className="cal-field">
                  <label>번호</label>
                  <input
                    className="cal-input"
                    min="1"
                    type="number"
                    value={newCardIndex}
                    onChange={(e) => setNewCardIndex(Number(e.target.value))}
                  />
                </div>
                <div className="cal-field">
                  <label>핀 수</label>
                  <input
                    className="cal-input"
                    max="6"
                    min="4"
                    type="number"
                    value={newCardPinCount}
                    onChange={(e) => setNewCardPinCount(Number(e.target.value))}
                  />
                </div>
              </div>

              <div style={{ padding: '12px 14px', borderRadius: 'var(--r-md)', background: '#f3f4f6' }}>
                <span style={{ fontSize: '12px', color: 'var(--ink-500)', fontWeight: 700 }}>생성될 카드 이름</span>
                <p style={{ margin: '4px 0 0', fontSize: '16px', fontWeight: 700, color: 'var(--ink-900)' }}>{newCardName}</p>
              </div>

              {duplicateCard && (
                <p style={{ margin: 0, fontSize: '13px', color: 'var(--danger-600)', fontWeight: 700 }}>
                  이미 같은 이름의 카드가 있습니다. 번호를 바꿔주세요.
                </p>
              )}
            </div>

            <div className="cal-modal-foot">
              <button className="cal-cancel-btn" onClick={() => setShowCardModal(false)} type="button">취소</button>
              <button
                className="cal-save-btn"
                disabled={creatingCard || Boolean(duplicateCard)}
                onClick={handleCreateCard}
                type="button"
              >
                {creatingCard ? '생성 중...' : '카드 생성'}
              </button>
            </div>
          </div>
        </div>
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
                <p>카드명, 지역, 동, 카드번호, 주소, 건물명, 유형, 호수, 상태, 중국인, 정기방문자, 메모</p>
                <small>카드 정보가 비어 있으면 주소 좌표가 들어간 구역선 기준으로 자동 배정합니다. 상태/중국인/정기방문자/메모는 호수 포인트에 함께 저장됩니다.</small>
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
                    <span>호수</span>
                  </div>
                  {csvPreviewRows.slice(0, 8).map((row) => (
                    <div key={`${row.rowNumber}-${row.address}`}>
                      <span>{row.rowNumber}</span>
                      <span>{row.cardName}</span>
                      <span>{row.name}</span>
                      <span>{row.address}</span>
                      <span>{row.units.length || 1}</span>
                    </div>
                  ))}
                  {csvPreviewRows.length > 8 && <p>외 {csvPreviewRows.length - 8}개 행이 더 있습니다.</p>}
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
        {/* ── Page Head ── */}
        <div className="home-page-head" style={{ marginBottom: 20, alignItems: 'center' }}>
          <div>
            <p className="home-page-eyebrow">구역 관리</p>
            <h1 className="home-page-title">{activeTab}</h1>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            {activeTab === '카드 관리' ? (
              <>
                <button className="tbl-ghost-btn" onClick={() => setDetailPaneOpen((o) => !o)} type="button">
                  {detailPaneOpen ? '상세 접기' : '상세 열기'}
                </button>
                {isAdmin && (
                  <>
                    <button className="tbl-ghost-btn" disabled={checkedCardIds.size === 0} onClick={handleDeleteCheckedCards} type="button">
                      선택 삭제{checkedCardIds.size > 0 ? ` ${checkedCardIds.size}` : ''}
                    </button>
                    <button className="tbl-primary-btn" onClick={openModal} type="button">+ 카드 추가</button>
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
          </div>
        </div>

        {/* ── Segment Tab ── */}
        <div className="tbl-seg-tab">
          {(['카드 관리', '건물 관리'] as const).map((tab) => (
            <button className={activeTab === tab ? 'active' : ''} key={tab} onClick={() => setActiveTab(tab)} type="button">
              {tab}
            </button>
          ))}
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
          <div className="tbl-filter-layer">
            <span className="tbl-filter-label">동</span>
            <div className="tbl-chip-row" style={{ flexWrap: 'wrap' }}>
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
                  style={{ color: 'var(--primary-600)', borderColor: 'var(--primary-200)', background: 'var(--primary-50)' }}
                >
                  {areaExpanded ? '접기 ▴' : `더보기 ▾`}
                  {!areaExpanded && <span className="tbl-chip__count" style={{ background: 'var(--primary-100)', color: 'var(--primary-700)' }}>{areaFilterOptions.length - AREA_CHIP_LIMIT}</span>}
                </button>
              )}
            </div>
          </div>

          {/* Layer 3: 배정 필터 (카드 관리) */}
          {activeTab === '카드 관리' && (
            <div className="tbl-filter-layer">
              <span className="tbl-filter-label">배정</span>
              <div className="tbl-mini-seg">
                {(['전체', '미배정'] as const).map((f) => (
                  <button key={f} className={assignmentFilter === f ? 'active' : ''} onClick={() => setAssignmentFilter(f)} type="button">{f}</button>
                ))}
              </div>
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
              <select value={buildingCardFilter} onChange={(e) => setBuildingCardFilter(e.target.value === '전체' ? '전체' : Number(e.target.value))} style={{ fontSize: 12, border: '1px solid var(--border-default)', borderRadius: 'var(--radius-sm)', padding: '4px 8px', background: 'var(--bg-card)' }}>
                <option value="전체">전체 카드</option>
                {filteredCards.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
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
            <div className="tbl-filter-layer">
              <span className="tbl-filter-label">상태</span>
              <select value={pointStatusFilter} onChange={(e) => setPointStatusFilter(e.target.value as UnitStatus | '전체')} style={{ fontSize: 12, border: '1px solid var(--border-default)', borderRadius: 'var(--radius-sm)', padding: '4px 8px', background: 'var(--bg-card)' }}>
                <option value="전체">전체 상태</option>
                <option value="미방문">미방문</option>
                <option value="만남">만남</option>
                <option value="부재">부재</option>
                <option value="한국인">한국인</option>
              </select>
            </div>
          )}

          {/* Layer 4: 결과 카운트 */}
          <div style={{ padding: '10px 18px', fontSize: 12, color: 'var(--gray-500)', borderBottom: '1px solid var(--border-subtle)' }}>
            {regionFilter === '전체' ? '전체 지역' : regionFilter}
            {' · '}{areaFilter === '전체' ? '전체 동' : areaFilter}
            {' · 표시 '}
            {activeTab === '카드 관리' ? `${filteredCards.length}개 카드` : buildingSubTab === '건물 목록' ? `${filteredBuildings.length}개 건물` : `${pointRows.length}개 포인트`}
          </div>

          {/* ── 카드 관리 테이블 ── */}
          {activeTab === '카드 관리' ? (
          <table className="tbl">
            <thead>
              <tr>
                <th style={{ width: 52, paddingLeft: 18 }}>
                  <input type="checkbox" checked={filteredCards.length > 0 && filteredCards.every((c) => checkedCardIds.has(c.id))} onChange={toggleAllFilteredCards} />
                </th>
                <th>카드</th>
                <th style={{ width: 140 }}>진행</th>
                <th>인도자</th>
                <th style={{ width: 60, textAlign: 'right' }}>건물</th>
                <th style={{ width: 80, textAlign: 'right' }}>중국인</th>
                <th style={{ width: 90, textAlign: 'right' }}>정기방문</th>
                <th style={{ width: 80 }}>구역선</th>
                <th style={{ width: 80 }}>상태</th>
                <th style={{ width: 160, textAlign: 'right', paddingRight: 18 }}>작업</th>
              </tr>
            </thead>
            <tbody>
              {filteredCards.map((card) => {
                const cardBuildings = buildings.filter((b) => b.cardId === card.id)
                const chinesePointCount = cardBuildings.reduce((sum, b) => sum + b.units.filter((u) => u.isChinese).length, 0)
                const hasBoundary = cardBoundaries.some((b) => b.cardId === card.id)
                const leaders = getCardLeaderList(card)
                return (
                  <tr key={card.id} onClick={() => setSelectedCardId(card.id)} style={{ cursor: 'pointer' }}>
                    <td style={{ width: 52, paddingLeft: 18 }} onClick={(e) => e.stopPropagation()}>
                      <input type="checkbox" checked={checkedCardIds.has(card.id)} onChange={() => toggleCheckedCard(card.id)} />
                    </td>
                    <td>
                      <div className="tbl__title">{card.name}</div>
                      <div className="tbl__sub">{card.region} {card.area} · 건물 {card.buildings}개 · 세대 {card.units}개</div>
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
                    <td className="tnum" style={{ width: 60, textAlign: 'right', fontSize: 13 }}>{card.buildings}개</td>
                    <td className="tnum" style={{ width: 80, textAlign: 'right', fontSize: 13 }}>{chinesePointCount}건</td>
                    <td className="tnum" style={{ width: 90, textAlign: 'right', fontSize: 13 }}>{card.regularVisits}건</td>
                    <td style={{ width: 80 }}>
                      <span style={{ padding: '2px 8px', borderRadius: 'var(--radius-sm)', background: hasBoundary ? 'var(--gray-100)' : 'transparent', color: hasBoundary ? 'var(--gray-600)' : 'var(--gray-400)', fontSize: 11, fontWeight: 600 }}>
                        {hasBoundary ? '있음' : '없음'}
                      </span>
                    </td>
                    <td style={{ width: 80 }}>
                      <span style={{ padding: '2px 8px', borderRadius: 'var(--radius-sm)', fontSize: 11, fontWeight: 600,
                        background: card.status === '진행중' ? 'var(--primary-100)' : card.status === '미배정' ? 'var(--warning-100)' : 'var(--success-100)',
                        color: card.status === '진행중' ? 'var(--primary-700)' : card.status === '미배정' ? 'var(--warning-700)' : 'var(--success-700)',
                      }}>
                        {card.status}
                      </span>
                    </td>
                    <td style={{ width: 160, textAlign: 'right', paddingRight: 18 }} onClick={(e) => e.stopPropagation()}>
                      <div style={{ display: 'inline-flex', gap: 6 }}>
                        <button className="tbl-ghost-btn sm" onClick={() => onOpenCardMap(card.id)} type="button">지도</button>
                        <button className="tbl-soft-btn sm" onClick={() => onOpenCardMap(card.id, true)} type="button">수정</button>
                      </div>
                    </td>
                  </tr>
                )
              })}
              {filteredCards.length === 0 && (
                <tr><td colSpan={10} style={{ textAlign: 'center', padding: '32px 18px', color: 'var(--gray-400)', fontSize: 13 }}>
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
              <label className="bulk-check">
                <input
                  checked={filteredBuildings.length > 0 && filteredBuildings.every((building) => checkedBuildingIds.has(building.id))}
                  onChange={toggleAllFilteredBuildings}
                  type="checkbox"
                />
              </label>
              <span>건물</span>
              <span>주소</span>
              <span>카드</span>
              <span>유형</span>
              <span>세대</span>
              <span>중국인</span>
              <span>정기</span>
              <span>메모</span>
              <span>작업</span>
            </div>
            {sortedBuildings.map((building) => {
              const card = cardMap.get(building.cardId)
              const chineseCount = building.units.filter((unit) => unit.isChinese).length
              const regularCount = building.units.filter((unit) => unit.isRegularVisit).length
              const isEditing = editingBuildingId === building.id
              const isDuplicate = duplicateBuildingIds.has(building.id)
              return (
                <div className={`building-management-block${isDuplicate ? ' dup-address-row' : ''}`} key={building.id}>
                  <div className={`building-management-row${isEditing ? ' is-editing' : ''}`} role="row">
                    <label className="bulk-check">
                      <input
                        checked={checkedBuildingIds.has(building.id)}
                        onChange={() => toggleCheckedBuilding(building.id)}
                        type="checkbox"
                      />
                    </label>
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
                        <span>{regularCount}건</span>
                        <input
                          aria-label="메모"
                          value={buildingEditDraft.memo}
                          onChange={(event) => setBuildingEditDraft((draft) => ({ ...draft, memo: event.target.value }))}
                        />
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
                        <span>{card?.name ?? '카드 없음'}</span>
                        <span>{building.type}</span>
                        <span>{building.units.length}개</span>
                        <span>{chineseCount}건</span>
                        <span>{regularCount}건</span>
                        <span>{building.memo || '-'}</span>
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
                        {[...building.units].sort((a, b) => a.number.localeCompare(b.number, 'ko', { numeric: true })).map((unit) => {
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
          <div className="point-management-table" role="table" aria-label="중국인 포인트 목록">
            <div className="point-management-head" role="row">
              <span>포인트</span>
              <span>건물/주소</span>
              <span>카드</span>
              <span>상태</span>
              <span>중국인</span>
              <span>정기</span>
              <span>최근 방문</span>
              <span>메모</span>
              <span>지도</span>
            </div>
            {pointRows.map(({ building, unit, latestHistory }) => {
              const card = cardMap.get(building.cardId)
              const isConfirmedChinese = unit.isChinese || unit.isRegularVisit
              return (
                <div className="point-management-row" key={`${building.id}-${unit.id}`} role="row">
                  <strong>{unit.number}</strong>
                  <span title={building.address}>{building.name || formatDisplayAddress(building.address)}</span>
                  <span>{card?.name ?? '카드 없음'}</span>
                  <select
                    aria-label={`${unit.number} 상태`}
                    value={unit.status}
                    onChange={(event) => onUpdateUnitStatus(building.id, unit.id, event.target.value as UnitStatus, unit.memo)}
                  >
                    <option value="미방문">미방문</option>
                    <option value="만남">만남</option>
                    <option value="부재">부재</option>
                    <option value="한국인">한국인</option>
                  </select>
                  <button
                    className={isConfirmedChinese ? 'point-toggle active' : 'point-toggle'}
                    onClick={() => onToggleChinese(building.id, unit.id)}
                    type="button"
                  >
                    {isConfirmedChinese ? '중국인' : '확인 필요'}
                  </button>
                  {unit.isRegularVisit ? (
                    <input
                      aria-label={`${unit.number} 정기방문자`}
                      className="regular-visitor-input"
                      defaultValue={unit.regularVisitor ?? ''}
                      onBlur={(event) => onSetRegularVisitor(unit.id, event.currentTarget.value)}
                      placeholder="방문자"
                    />
                  ) : (
                    <button
                      className="point-toggle"
                      onClick={() => onToggleRegularVisit(building.id, unit.id)}
                      type="button"
                    >
                      등록
                    </button>
                  )}
                  <span>{latestHistory ? `${latestHistory.visitedAt.slice(5)} ${latestHistory.timeSlot} ${latestHistory.result}` : '-'}</span>
                  <input
                    aria-label={`${unit.number} 메모`}
                    defaultValue={unit.memo ?? ''}
                    onBlur={(event) => onUpdateUnitFlags(unit.id, { memo: event.currentTarget.value })}
                  />
                  <button onClick={() => onOpenBuildingMap(building.id)} type="button">지도</button>
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
      </div>{/* /territory-main */}

      {activeTab === '카드 관리' && detailPaneOpen && (
      <aside className="territory-side">
        {!selectedCard ? (
          <div className="cal-empty-state" style={{ height: '100%' }}>
            <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" />
            </svg>
            <h3>카드를 선택하세요</h3>
            <p>목록에서 카드를 클릭하면 상세 정보를 볼 수 있습니다</p>
          </div>
        ) : (
          <>
            <div className="detail-header">
              <p>{selectedCard.name}</p>
              <strong>{selectedCard.region} {selectedCard.area} · {selectedCard.status}</strong>
            </div>

            <div className="territory-card-detail">
              <div className="territory-progress-ring">
                <strong>{selectedCard.progress}%</strong>
                <span>진행률</span>
              </div>
              <dl className="event-meta territory-meta">
                <div><dt>건물</dt><dd>{selectedCard.buildings}개</dd></div>
                <div><dt>세대</dt><dd>{selectedCard.units}개</dd></div>
                <div><dt>완료</dt><dd>{selectedCard.completed}개</dd></div>
                <div><dt>중국인</dt><dd>{selectedChinesePointCount}건</dd></div>
                <div><dt>정기방문</dt><dd>{selectedCard.regularVisits}건</dd></div>
                <div><dt>구역선</dt><dd>{selectedHasBoundary ? '있음' : '없음'}</dd></div>
              </dl>

              <div className="assignment-box">
                <div className="box-heading">
                  <strong>인도자 배정</strong>
                </div>
                {isAdmin ? (
                  <div className="leader-select-field">
                    <span>담당 인도자 (다중 선택)</span>
                    <div style={{ display: 'grid', gap: '6px', marginTop: '6px' }}>
                      {leaderOptions.map((leaderName) => (
                        <label key={leaderName} style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', color: 'var(--ink-700)', cursor: 'pointer' }}>
                          <input
                            type="checkbox"
                            checked={getCardLeaderList(selectedCard).includes(leaderName)}
                            onChange={() => void toggleCardLeader(selectedCard.id, leaderName)}
                          />
                          {leaderName}
                        </label>
                      ))}
                    </div>
                    <button
                      type="button"
                      style={{ marginTop: '8px', minHeight: '34px', borderRadius: '8px', border: '1px solid #d1d5db', background: '#fff', padding: '0 10px', fontSize: '12px', fontWeight: 600 }}
                      onClick={() => void onSetCardLeaders(selectedCard.id, [])}
                    >
                      인도자 모두 해제
                    </button>
                  </div>
                ) : (
                  <div className="leader-select-field">
                    <span>담당 인도자</span>
                    <p className="leader-current-note" style={{ marginTop: '8px' }}>
                      {getCardLeaderList(selectedCard).length > 0 ? getCardLeaderList(selectedCard).join(', ') : '미배정'}
                    </p>
                  </div>
                )}
                {getCardLeaderList(selectedCard).length > 0 && (
                  <p className="leader-current-note">현재 담당: {getCardLeaderList(selectedCard).join(', ')}</p>
                )}
              </div>

              <div className="assignment-box">
                <div className="box-heading">
                  <strong>인도자가 재배정한 사용자</strong>
                </div>
                <div className="person-chips">
                  {selectedCard.assignedUsers.length === 0 && <span>아직 없음</span>}
                  {selectedCard.assignedUsers.map((person) => (
                    <span className="assigned user-assignment-chip" key={person}>
                      <strong>{person}</strong>
                      <em>배정일 기록 없음</em>
                    </span>
                  ))}
                </div>
              </div>

              <div className="assignment-box">
                <div className="box-heading">
                  <strong>정기방문 포인트</strong>
                </div>
                <div className="regular-visit-list">
                  {selectedCard.regularVisitPoints.length === 0 && <p>등록된 정기방문 포인트가 없습니다.</p>}
                  {selectedCard.regularVisitPoints.map((point) => (
                    <div key={`${point.point}-${point.visitor}`}>
                      <strong>{point.point}</strong>
                      <span>{point.visitor} 정기방문</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="assignment-box">
                <div className="box-heading">
                  <strong>지도</strong>
                </div>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button onClick={() => onOpenCardMap(selectedCard.id)} style={{ flex: 1, minHeight: '40px', border: '1px solid #cdd8e8', background: '#fff', color: 'var(--brand-700)', fontSize: '13px', fontWeight: 700, borderRadius: 'var(--r-md)' }} type="button">
                    지도 보기
                  </button>
                  <button onClick={() => onOpenCardMap(selectedCard.id, true)} style={{ flex: 1, minHeight: '40px', border: '1px solid #bcd7c8', background: 'var(--accent-100)', color: 'var(--accent-700)', fontSize: '13px', fontWeight: 700, borderRadius: 'var(--r-md)' }} type="button">
                    구역선 수정
                  </button>
                </div>
              </div>
            </div>
          </>
        )}
      </aside>
      )}
    </section>
  )
}

function AddUnitRow({
  buildingId,
  existingNumbers,
  onAdd,
}: {
  buildingId: number
  existingNumbers: Set<string>
  onAdd: (buildingId: number, unitNumber: string) => void
}) {
  const [value, setValue] = useState('')
  const [showBulk, setShowBulk] = useState(false)
  const [startFloor, setStartFloor] = useState(1)
  const [endFloor, setEndFloor] = useState(3)
  const [unitsPerFloor, setUnitsPerFloor] = useState(5)
  const [startUnit, setStartUnit] = useState(1)
  const [hasBasement, setHasBasement] = useState(false)
  const [basementFloors, setBasementFloors] = useState(1)
  const [adding, setAdding] = useState(false)

  const handleAdd = () => {
    if (!value.trim()) return
    onAdd(buildingId, value.trim())
    setValue('')
  }

  // 미리보기 생성 (지하 + 지상)
  const preview = (() => {
    const list: string[] = []
    const upf = Math.max(1, unitsPerFloor)
    const su = Math.max(1, startUnit)
    // 지하 (B층 → B101, B102...)
    if (hasBasement) {
      const bf = Math.max(1, basementFloors)
      for (let f = bf; f >= 1; f--) {
        for (let u = su; u < su + upf; u++) {
          list.push(`B${f}${String(u).padStart(2, '0')}`)
        }
      }
    }
    // 지상
    const sf = Math.max(1, startFloor)
    const ef = Math.max(sf, endFloor)
    for (let f = sf; f <= ef; f++) {
      for (let u = su; u < su + upf; u++) {
        list.push(`${f}${String(u).padStart(2, '0')}`)
      }
    }
    return list
  })()

  const newOnes = preview.filter((n) => !existingNumbers.has(n))
  const skipped = preview.length - newOnes.length

  const handleBulkAdd = async () => {
    if (newOnes.length === 0) return
    setAdding(true)
    for (const num of newOnes) {
      await new Promise<void>((resolve) => {
        onAdd(buildingId, num)
        setTimeout(resolve, 30)
      })
    }
    setAdding(false)
    setShowBulk(false)
  }

  return (
    <div className="unit-add-section">
      {/* 단일 추가 행 */}
      <div className="building-unit-row building-unit-add-row">
        <input
          className="unit-number-input"
          placeholder="호수 입력"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') handleAdd() }}
        />
        <span className="unit-row-actions">
          <button onClick={handleAdd} type="button">+ 추가</button>
          <button
            className={`unit-bulk-toggle${showBulk ? ' active' : ''}`}
            onClick={() => setShowBulk((v) => !v)}
            type="button"
          >
            일괄 추가 {showBulk ? '▴' : '▾'}
          </button>
        </span>
      </div>

      {/* 일괄 추가 패널 */}
      {showBulk && (
        <div className="unit-bulk-panel">
          {/* 지상층 설정 */}
          <div className="unit-bulk-section-label">지상</div>
          <div className="unit-bulk-fields">
            <label className="unit-bulk-field">
              <span>시작층</span>
              <input type="number" min={1} value={startFloor}
                onChange={(e) => setStartFloor(Number(e.target.value))} />
            </label>
            <span className="unit-bulk-sep">~</span>
            <label className="unit-bulk-field">
              <span>끝층</span>
              <input type="number" min={startFloor} value={endFloor}
                onChange={(e) => setEndFloor(Number(e.target.value))} />
            </label>
            <label className="unit-bulk-field">
              <span>층당 호수</span>
              <input type="number" min={1} value={unitsPerFloor}
                onChange={(e) => setUnitsPerFloor(Number(e.target.value))} />
            </label>
            <label className="unit-bulk-field">
              <span>시작 호번호</span>
              <input type="number" min={1} value={startUnit}
                onChange={(e) => setStartUnit(Number(e.target.value))} />
            </label>
          </div>

          {/* 지하 설정 */}
          <div className="unit-bulk-basement-row">
            <label className="unit-bulk-checkbox-label">
              <input
                type="checkbox"
                checked={hasBasement}
                onChange={(e) => setHasBasement(e.target.checked)}
              />
              지하 포함
            </label>
            {hasBasement && (
              <>
                <label className="unit-bulk-field">
                  <span>지하 층수</span>
                  <input type="number" min={1} value={basementFloors}
                    onChange={(e) => setBasementFloors(Number(e.target.value))} />
                </label>
                <span className="unit-bulk-basement-hint">
                  B{basementFloors}층 ~ B1층 · 층당 {unitsPerFloor}개
                  → B{basementFloors}{String(startUnit).padStart(2,'0')} ~ B1{String(startUnit + unitsPerFloor - 1).padStart(2,'0')}
                </span>
              </>
            )}
          </div>

          {/* 미리보기 */}
          <div className="unit-bulk-preview">
            <div className="unit-bulk-preview-label">
              미리보기 &nbsp;
              <strong>총 {newOnes.length}개 추가</strong>
              {skipped > 0 && (
                <span className="unit-bulk-skip"> · {skipped}개 이미 있어 자동 스킵</span>
              )}
            </div>
            <div className="unit-bulk-preview-grid">
              {preview.map((n) => (
                <span key={n} className={`unit-bulk-chip${n.startsWith('B') ? ' basement' : ''}${existingNumbers.has(n) ? ' skip' : ''}`}>
                  {n}호
                </span>
              ))}
            </div>
          </div>

          <div className="unit-bulk-footer">
            <button
              className="unit-bulk-add-btn"
              disabled={newOnes.length === 0 || adding}
              onClick={handleBulkAdd}
              type="button"
            >
              {adding ? '추가 중...' : `${newOnes.length}개 추가하기`}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
