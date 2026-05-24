import re

with open('src/components/DesktopTerritory.tsx', 'r') as f:
    code = f.read()

# 1. State changes
code = code.replace(
'''  const [buildingCardFilter, setBuildingCardFilter] = useState<number | '전체'>('전체')
  const [buildingTypeFilter, setBuildingTypeFilter] = useState<Building['type'] | '전체'>('전체')
  const [pointStatusFilter, setPointStatusFilter] = useState<UnitStatus | '전체'>('전체')
  const [buildingRegularFilter, setBuildingRegularFilter] = useState<'전체' | '있음' | '없음'>('전체')
  const [buildingMemoFilter, setBuildingMemoFilter] = useState<'전체' | '있음' | '없음'>('전체')
  const [buildingChineseHeavyFilter, setBuildingChineseHeavyFilter] = useState<'전체' | '있음' | '없음'>('전체')
  const [pointRegularFilter, setPointRegularFilter] = useState<'전체' | '있음' | '없음'>('전체')
  const [pointMemoFilter, setPointMemoFilter] = useState<'전체' | '있음' | '없음'>('전체')
  type BuildingSortKey = '카드' | '건물' | '주소' | '유형'
  const [buildingSort, setBuildingSort] = useState<{ key: BuildingSortKey; dir: 'asc' | 'desc' }>({ key: '카드', dir: 'asc' })''',
'''  const [buildingCardFilter, setBuildingCardFilter] = useState<number | '전체'>('전체')
  const [buildingTypeFilter, setBuildingTypeFilter] = useState<Building['type'] | '전체'>('전체')
  const [pointStatusFilter, setPointStatusFilter] = useState<UnitStatus | '전체'>('전체')
  const [buildingChineseHeavyFilter, setBuildingChineseHeavyFilter] = useState<'전체' | '있음' | '없음'>('전체')
  const [pointRegularFilter, setPointRegularFilter] = useState<'전체' | '있음' | '없음'>('전체')
  const [pointMemoFilter, setPointMemoFilter] = useState<'전체' | '있음' | '없음'>('전체')
  type BuildingSortKey = '카드' | '건물' | '주소' | '유형'
  const [buildingSort, setBuildingSort] = useState<{ key: BuildingSortKey; dir: 'asc' | 'desc' }>({ key: '카드', dir: 'asc' })
  type PointSortKey = '카드' | '건물/주소' | '최근방문'
  const [pointSort, setPointSort] = useState<{ key: PointSortKey; dir: 'asc' | 'desc' }>({ key: '카드', dir: 'asc' })'''
)

code = code.replace(
'''  const [cardStatusFilter, setCardStatusFilter] = useState<TerritoryCard['status'] | '전체'>('전체')
  const [cardFilterPanelOpen, setCardFilterPanelOpen] = useState(false)
  const [buildingFilterPanelOpen, setBuildingFilterPanelOpen] = useState(false)
  const [pointFilterPanelOpen, setPointFilterPanelOpen] = useState(false)''',
'''  const [cardStatusFilter, setCardStatusFilter] = useState<TerritoryCard['status'] | '전체'>('전체')
  const [cardFilterPanelOpen, setCardFilterPanelOpen] = useState(false)'''
)

# 2. Filter counts removal
code = code.replace(
'''  const activeAdvancedBuildingFilterCount =
    (buildingRegularFilter !== '전체' ? 1 : 0) +
    (buildingMemoFilter !== '전체' ? 1 : 0) +
    (buildingChineseHeavyFilter !== '전체' ? 1 : 0)
  const activeAdvancedPointFilterCount =
    (pointRegularFilter !== '전체' ? 1 : 0) +
    (pointMemoFilter !== '전체' ? 1 : 0)''',
''
)

# 3. Unused helper functions removal
code = code.replace(
'''  const buildingHasRegularVisit = (building: Building) => building.units.some((unit) => unit.isRegularVisit)
  const buildingHasMemo = (building: Building) =>
    hasText(building.memo) || building.units.some((unit) => hasText(unit.memo))''',
''
)

# 4. Filter logic adjustment in baseFilteredBuildings
code = code.replace(
'''  const filteredBuildings = baseFilteredBuildings.filter((building) => {
    const hasRegular = buildingHasRegularVisit(building)
    if (buildingRegularFilter === '있음' && !hasRegular) return false
    if (buildingRegularFilter === '없음' && hasRegular) return false
    const hasMemo = buildingHasMemo(building)
    if (buildingMemoFilter === '있음' && !hasMemo) return false
    if (buildingMemoFilter === '없음' && hasMemo) return false
    if (buildingChineseHeavyFilter === '있음' && !building.isChineseHeavy) return false
    if (buildingChineseHeavyFilter === '없음' && building.isChineseHeavy) return false
    return true
  })''',
'''  const filteredBuildings = baseFilteredBuildings.filter((building) => {
    if (buildingChineseHeavyFilter === '있음' && !building.isChineseHeavy) return false
    if (buildingChineseHeavyFilter === '없음' && building.isChineseHeavy) return false
    return true
  })'''
)

# 5. Point rows sorting logic
code = code.replace(
'''    if (pointMemoFilter === '있음' && !hasMemo) return false
    if (pointMemoFilter === '없음' && hasMemo) return false
    return true
  })''',
'''    if (pointMemoFilter === '있음' && !hasMemo) return false
    if (pointMemoFilter === '없음' && hasMemo) return false
    return true
  }).sort((a, b) => {
    const dir = pointSort.dir === 'asc' ? 1 : -1
    if (pointSort.key === '카드') {
      const cardA = cardMap.get(a.building.cardId)?.name ?? ''
      const cardB = cardMap.get(b.building.cardId)?.name ?? ''
      return naturalCompare(cardA, cardB) * dir
    }
    if (pointSort.key === '건물/주소') {
      const nameComp = naturalCompare(a.building.name, b.building.name)
      if (nameComp !== 0) return nameComp * dir
      return naturalCompare(a.building.address, b.building.address) * dir
    }
    if (pointSort.key === '최근방문') {
      const dateA = a.latestHistory?.visitedAt ?? ''
      const dateB = b.latestHistory?.visitedAt ?? ''
      return naturalCompare(dateA, dateB) * dir
    }
    return 0
  })'''
)

# 6. Unused regularCount in JSX block
code = re.sub(
    r'(          const chineseCount = building.units.filter\(\(unit\) => unit.isChinese\).length\n)          const regularCount = building.units.filter\(\(unit\) => unit.isRegularVisit\).length\n',
    r'\1',
    code
)

with open('src/components/DesktopTerritory.tsx', 'w') as f:
    f.write(code)

print("Logic fixed!")
