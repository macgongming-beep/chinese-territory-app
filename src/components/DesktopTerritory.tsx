import { useEffect, useState } from 'react'
import { useAuth } from '../hooks/useAuth'
import { territoryAreasByRegion, territoryRegions } from '../data/territoryStructure'
import { showToast } from '../lib/toast'
import { findCardForCoordinates, formatDisplayAddress, isValidMapCoordinate, normalizeMapCoordinates, parseCoordinate } from '../utils/mapUtils'
import type { Building, CardBoundary, TerritoryCard, TerritoryRegion, Unit, UnitStatus, VisitHistory } from '../types'

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
  onImportBuildings,
  onMoveBuildingToCard,
  onReassignBuildingsToCards,
  onUpdateBuilding,
  onToggleChinese,
  onToggleRegularVisit,
  onSetRegularVisitor,
  onUpdateUnitFlags,
  onUpdateUnitStatus,
  onOpenCardMap,
  onOpenBuildingMap,
  visitHistories,
}: {
  buildings: Building[]
  cardBoundaries: CardBoundary[]
  cards: TerritoryCard[]
  role: 'user' | 'leader' | 'admin'
  onSetCardLeaders: (cardId: number, leaderNames: string[], options?: { silentSuccess?: boolean }) => Promise<void> | void
  onSetMultipleCardLeaders: (cardIds: number[], leaderNames: string[], options?: { silentSuccess?: boolean }) => Promise<void> | void
  onDeleteBuildings: (buildingIds: number[]) => void
  onDeleteCards: (cardIds: number[]) => void
  onImportBuildings: (inputs: CsvBuildingImport[]) => Promise<{ inserted: number; skipped: number }>
  onMoveBuildingToCard: (buildingId: number, cardId: number) => void
  onReassignBuildingsToCards: (updates: Array<{ buildingId: number; cardId: number }>) => Promise<{ updated: number; failed: number }>
  onUpdateBuilding: (buildingId: number, name: string, address: string, lat?: number, lng?: number, type?: Building['type'], memo?: string) => void
  onToggleChinese: (buildingId: number, unitId: number) => void
  onToggleRegularVisit: (buildingId: number, unitId: number, visitorName?: string) => void
  onSetRegularVisitor: (unitId: number, visitorName: string) => void
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
  const [assignmentFilter, setAssignmentFilter] = useState<'전체' | '미배정'>('전체')
  const [buildingCardFilter, setBuildingCardFilter] = useState<number | '전체'>('전체')
  const [buildingTypeFilter, setBuildingTypeFilter] = useState<Building['type'] | '전체'>('전체')
  const [pointStatusFilter, setPointStatusFilter] = useState<UnitStatus | '전체'>('전체')
  const [editingBuildingId, setEditingBuildingId] = useState<number | null>(null)
  const [buildingEditDraft, setBuildingEditDraft] = useState({
    name: '',
    address: '',
    type: '주택' as Building['type'],
    cardId: 0,
    memo: '',
  })
  const [showCsvModal, setShowCsvModal] = useState(false)
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
  const buildingUnitsTotal = filteredBuildings.reduce((sum, building) => sum + building.units.length, 0)
  const pointRows = filteredBuildings.flatMap((building) =>
    building.units
      .filter((unit) => unit.isChinese || unit.isRegularVisit)
      .map((unit) => {
        const histories = visitHistories.filter((history) => history.unitId === unit.id)
        return { building, unit, latestHistory: histories[0] }
      }),
  ).filter(({ unit }) => pointStatusFilter === '전체' || unit.status === pointStatusFilter)
  const chinesePointTotal = pointRows.filter(({ unit }) => unit.isChinese).length
  const regularPointTotal = pointRows.filter(({ unit }) => unit.isRegularVisit).length
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
        <div className="calendar-toolbar territory-toolbar">
          <div>
            <p>구역 관리</p>
            <h1>{activeTab}</h1>
          </div>
          <div className="toolbar-actions">
            {activeTab === '카드 관리' ? (
              <>
                <button onClick={() => setDetailPaneOpen((open) => !open)} type="button">
                  {detailPaneOpen ? '상세 접기' : '상세 열기'}
                </button>
                {isAdmin && (
                  <>
                    <button
                      className="danger-outline-btn"
                      disabled={checkedCardIds.size === 0}
                      onClick={handleDeleteCheckedCards}
                      type="button"
                    >
                      선택 삭제 {checkedCardIds.size > 0 ? checkedCardIds.size : ''}
                    </button>
                    <button className="cal-add-btn" onClick={openModal} style={{ width: 'auto', padding: '0 18px', borderRadius: 'var(--r-md)', minHeight: '42px', fontSize: '14px' }} type="button">
                      + 카드 추가
                    </button>
                  </>
                )}
              </>
            ) : (
              <>
                {isAdmin && (
                <button
                  className="danger-outline-btn"
                  disabled={checkedBuildingIds.size === 0}
                  onClick={handleDeleteCheckedBuildings}
                  type="button"
                >
                  선택 삭제 {checkedBuildingIds.size > 0 ? checkedBuildingIds.size : ''}
                </button>
                )}
                <button
                  disabled={reassigningByBoundary}
                  onClick={handleReassignByBoundary}
                  type="button"
                >
                  {reassigningByBoundary ? '재배정 중...' : '좌표 기준 재배정'}
                </button>
                <button className="cal-add-btn" onClick={() => setShowCsvModal(true)} style={{ width: 'auto', padding: '0 18px', borderRadius: 'var(--r-md)', minHeight: '42px', fontSize: '14px' }} type="button">
                  건물 CSV 업로드
                </button>
              </>
            )}
          </div>
        </div>

        <div className="territory-tabs" role="tablist" aria-label="구역 관리 방식">
          {(['카드 관리', '건물 관리'] as const).map((tab) => (
            <button
              aria-selected={activeTab === tab}
              className={activeTab === tab ? 'active' : ''}
              key={tab}
              onClick={() => setActiveTab(tab)}
              role="tab"
              type="button"
            >
              {tab}
            </button>
          ))}
        </div>

        <div className="territory-stats" aria-label="구역 요약">
          {activeTab === '카드 관리' ? (
            <>
              <div><strong>{totalCards}</strong><span>전체 카드</span></div>
              <div><strong>{assignedCards}</strong><span>인도자 배정</span></div>
              <div><strong>{totalUnits}</strong><span>전체 세대</span></div>
              <div><strong>{completedUnits}</strong><span>방문 완료</span></div>
            </>
          ) : (
            <>
              <div><strong>{filteredBuildings.length}</strong><span>표시 건물</span></div>
              <div><strong>{buildingUnitsTotal}</strong><span>표시 세대</span></div>
              <div><strong>{chinesePointTotal}</strong><span>중국인 포인트</span></div>
              <div><strong>{regularPointTotal}</strong><span>정기방문</span></div>
            </>
          )}
        </div>

        {activeTab === '건물 관리' && (
          <div className="territory-subtabs" role="tablist" aria-label="건물 관리 세부 메뉴">
            {(['건물 목록', '중국인 포인트'] as const).map((tab) => (
              <button
                aria-selected={buildingSubTab === tab}
                className={buildingSubTab === tab ? 'active' : ''}
                key={tab}
                onClick={() => setBuildingSubTab(tab)}
                role="tab"
                type="button"
              >
                {tab}
              </button>
            ))}
          </div>
        )}

        <div className="territory-filters" aria-label="카드 필터">
          <div className="territory-filter-group region-filter-group">
            <span>지역</span>
            {(['전체', ...territoryRegions] as Array<TerritoryRegion | '전체'>).map((filter) => (
              <button
                className={filter === regionFilter ? 'active' : ''}
                key={filter}
                onClick={() => { setRegionFilter(filter); setAreaFilter('전체') }}
                type="button"
              >
                {filter}
              </button>
            ))}
          </div>
          <div className="territory-filter-group area-filter-group">
            <span>동</span>
            <button className={areaFilter === '전체' ? 'active' : ''} onClick={() => setAreaFilter('전체')} type="button">전체 동</button>
            {areaFilterOptions.map((area) => (
              <button className={areaFilter === area ? 'active' : ''} key={area} onClick={() => setAreaFilter(area)} type="button">
                {area}<small>{getAreaMetricCount(area)}</small>
              </button>
            ))}
          </div>
          <div className="territory-filter-group assignment-filter-group">
            {activeTab === '카드 관리' ? (
              <>
                <span>배정</span>
                {(['전체', '미배정'] as const).map((filter) => (
                  <button className={filter === assignmentFilter ? 'active' : ''} key={filter} onClick={() => setAssignmentFilter(filter)} type="button">
                    {filter}
                  </button>
                ))}
                <div className="territory-filter-actions">
                  {isAdmin && (
                    <>
                      <details className="territory-multi-select">
                        <summary>
                          {bulkLeaderNames.length > 0 ? `인도자 선택 ${bulkLeaderNames.length}` : '인도자 선택'}
                        </summary>
                        <div className="territory-multi-select-menu">
                          {leaderOptions.map((leaderName) => (
                            <label key={leaderName} className="territory-multi-option">
                              <input
                                type="checkbox"
                                checked={bulkLeaderNames.includes(leaderName)}
                                onChange={() => toggleBulkLeaderName(leaderName)}
                              />
                              {leaderName}
                            </label>
                          ))}
                          <button
                            className="territory-multi-clear"
                            onClick={() => setBulkLeaderNames([])}
                            type="button"
                          >
                            모두 해제
                          </button>
                        </div>
                      </details>
                      <button
                        disabled={checkedCardIds.size === 0 || bulkAssigning}
                        onClick={handleAssignLeaderBulk}
                        type="button"
                      >
                        {bulkAssigning ? '적용 중...' : `일괄 적용 ${checkedCardIds.size > 0 ? checkedCardIds.size : ''}`}
                      </button>
                    </>
                  )}
                </div>
              </>
            ) : (
              <>
                <span>유형</span>
                {(['전체', '상가', '주택'] as Array<Building['type'] | '전체'>).map((filter) => (
                  <button className={filter === buildingTypeFilter ? 'active' : ''} key={filter} onClick={() => setBuildingTypeFilter(filter)} type="button">
                    {filter}
                  </button>
                ))}
              </>
            )}
          </div>
          {activeTab === '건물 관리' && (
            <label className="territory-card-select-filter">
              <span>카드</span>
              <select
                value={buildingCardFilter}
                onChange={(event) => setBuildingCardFilter(event.target.value === '전체' ? '전체' : Number(event.target.value))}
              >
                <option value="전체">전체 카드</option>
                {filteredCards.map((card) => (
                  <option key={card.id} value={card.id}>{card.name}</option>
                ))}
              </select>
            </label>
          )}
          {activeTab === '건물 관리' && buildingSubTab === '중국인 포인트' && (
            <label className="territory-card-select-filter">
              <span>상태</span>
              <select
                value={pointStatusFilter}
                onChange={(event) => setPointStatusFilter(event.target.value as UnitStatus | '전체')}
              >
                <option value="전체">전체 상태</option>
                <option value="미방문">미방문</option>
                <option value="만남">만남</option>
                <option value="부재">부재</option>
                <option value="한국인">한국인</option>
                <option value="확인필요">확인필요</option>
                <option value="거절">거절</option>
              </select>
            </label>
          )}
          <p className="territory-filter-summary">
            {regionFilter === '전체' ? '전체 지역' : regionFilter}
            {' · '}
            {areaFilter === '전체' ? '전체 동' : areaFilter}
            {' · 표시 '}
            {activeTab === '카드 관리'
              ? `${filteredCards.length}개 카드`
              : buildingSubTab === '건물 목록'
                ? `${filteredBuildings.length}개 건물`
                : `${pointRows.length}개 포인트`}
          </p>
        </div>

        {activeTab === '카드 관리' ? (
        <div className="card-table" role="table" aria-label="구역 카드 목록">
          <div className="card-table-head" role="row">
            <label className="bulk-check">
              <input
                checked={filteredCards.length > 0 && filteredCards.every((card) => checkedCardIds.has(card.id))}
                onChange={toggleAllFilteredCards}
                type="checkbox"
              />
            </label>
            <span>카드</span>
            <span>진행</span>
            <span>인도자</span>
            <span>건물</span>
            <span>중국인</span>
            <span>정기방문</span>
            <span>구역선</span>
            <span>상태</span>
            <span>지도</span>
          </div>
          {filteredCards.map((card) => {
            const cardBuildings = buildings.filter((building) => building.cardId === card.id)
            const chinesePointCount = cardBuildings.reduce(
              (sum, building) => sum + building.units.filter((unit) => unit.isChinese).length,
              0,
            )
            const hasBoundary = cardBoundaries.some((boundary) => boundary.cardId === card.id)
            return (
              <div className={card.id === selectedCard?.id ? 'card-row selected' : 'card-row'} key={card.id} role="row">
                <label className="bulk-check">
                  <input
                    checked={checkedCardIds.has(card.id)}
                    onChange={() => toggleCheckedCard(card.id)}
                    onClick={(event) => event.stopPropagation()}
                    type="checkbox"
                  />
                </label>
                <button className="card-row-main" onClick={() => setSelectedCardId(card.id)} type="button">
                  <strong>{card.name}</strong>
                  <em>{card.region} {card.area} · 건물 {card.buildings}개 · 세대 {card.units}개</em>
                </button>
                <span>
                  <i className="mini-progress"><b style={{ width: `${card.progress}%` }} /></i>
                  <em>{card.progress}%</em>
                </span>
                <span onClick={(event) => event.stopPropagation()}>
                  {isAdmin ? (
                    <details style={{ position: 'relative' }}>
                      <summary style={{ listStyle: 'none', cursor: 'pointer', minHeight: '34px', borderRadius: '8px', border: '1px solid #d1d5db', padding: '6px 10px', fontSize: '13px', background: '#fff' }}>
                        {getCardLeaderList(card).length > 0 ? getCardLeaderList(card).join(', ') : '미배정'}
                      </summary>
                      <div style={{ position: 'absolute', zIndex: 15, top: 'calc(100% + 6px)', left: 0, minWidth: '220px', maxHeight: '220px', overflow: 'auto', border: '1px solid #d1d5db', borderRadius: '10px', background: '#fff', padding: '8px' }}>
                        {leaderOptions.map((leaderName) => (
                          <label key={leaderName} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '5px 2px', fontSize: '13px', cursor: 'pointer' }}>
                            <input
                              type="checkbox"
                              checked={getCardLeaderList(card).includes(leaderName)}
                              onChange={() => void toggleCardLeader(card.id, leaderName)}
                            />
                            {leaderName}
                          </label>
                        ))}
                        <button
                          type="button"
                          style={{ marginTop: '8px', width: '100%', minHeight: '32px', borderRadius: '8px', border: '1px solid #d1d5db', background: '#fff', fontSize: '12px', fontWeight: 600 }}
                          onClick={() => void onSetCardLeaders(card.id, [])}
                        >
                          모두 해제
                        </button>
                      </div>
                    </details>
                  ) : (
                    <span style={{ display: 'inline-flex', alignItems: 'center', minHeight: '34px', padding: '0 10px', borderRadius: '8px', border: '1px solid #d1d5db', background: '#f8fafc', fontSize: '13px', color: 'var(--ink-700)', fontWeight: 600 }}>
                      {getCardLeaderList(card).length > 0 ? getCardLeaderList(card).join(', ') : '미배정'}
                    </span>
                  )}
                </span>
                <span>{card.buildings}개</span>
                <span>{chinesePointCount}건</span>
                <span>{card.regularVisits}건</span>
                <span>
                  <b className={hasBoundary ? 'territory-state-pill ok' : 'territory-state-pill muted'}>
                    {hasBoundary ? '있음' : '없음'}
                  </b>
                </span>
                <span>
                  <b className={`territory-state-pill status-${card.status}`}>{card.status}</b>
                </span>
                <span className="card-map-actions">
                  <button onClick={() => onOpenCardMap(card.id)} type="button">지도 보기</button>
                  <button onClick={() => onOpenCardMap(card.id, true)} type="button">구역선 수정</button>
                </span>
              </div>
            )
          })}
          {filteredCards.length === 0 && (
            <div className="empty-card-row">
              {cards.length === 0 ? '카드가 없습니다. 위의 + 카드 추가 버튼으로 첫 카드를 만들어보세요.' : '조건에 맞는 카드가 없습니다.'}
            </div>
          )}
        </div>
        ) : buildingSubTab === '건물 목록' ? (
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
            {filteredBuildings.map((building) => {
              const card = cardMap.get(building.cardId)
              const chineseCount = building.units.filter((unit) => unit.isChinese).length
              const regularCount = building.units.filter((unit) => unit.isRegularVisit).length
              const isEditing = editingBuildingId === building.id
              return (
                <div className="building-management-row" key={building.id} role="row">
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
              )
            })}
            {filteredBuildings.length === 0 && (
              <div className="empty-card-row">
                조건에 맞는 건물이 없습니다. 건물 CSV 업로드 또는 지도 탭에서 건물을 추가해 주세요.
              </div>
            )}
          </div>
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
                    <option value="확인필요">확인필요</option>
                    <option value="거절">거절</option>
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
      </div>

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
