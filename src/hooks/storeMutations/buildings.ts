import type { Building, TerritoryCard, UnitStatus } from '../../types'
import type { CsvBuildingImport } from '../../utils/csvBuildingImport'
import { isValidMapCoordinate } from '../../utils/mapUtils'
import { supabase, showToast, reportMutationError } from './shared'
import { logServiceAction } from './serviceLog'

export function makeBuildingMutations(deps: {
  fetchAll: () => Promise<void>
  buildings: Building[]
  cards: TerritoryCard[]
}) {
  const { fetchAll, buildings, cards } = deps

  const createBuilding = async (input: {
    cardId: number
    name: string
    address: string
    type: Building['type']
    lat: number
    lng: number
  }) => {
    if (!input.address.trim()) {
      showToast('주소를 입력해 주세요.', 'error')
      return false
    }
    if (!cards.some((card) => card.id === input.cardId)) {
      showToast('건물을 추가할 카드를 찾지 못했습니다. 카드를 직접 선택해 주세요.', 'error')
      return false
    }
    // 이름이 없으면 주소에서 자동 추출 (예: "언동로 213")
    const autoName = input.name.trim() || (() => {
      const m = input.address.match(/([가-힣]+(?:로|길)\s*[\d-]+)/)
      if (m) return m[1].replace(/\s+/, ' ').trim()
      const parts = input.address.trim().split(/\s+/)
      return parts.slice(-2).join(' ')
    })()

    const result = await supabase.from('buildings').insert({
      card_id: input.cardId,
      name: autoName,
      address: input.address.trim(),
      type: input.type,
      lat: input.lat,
      lng: input.lng,
    })
    if (result.error) {
      reportMutationError('건물을 추가하지 못했습니다.', result.error)
      return false
    }
    const card = cards.find((c) => c.id === input.cardId)
    await logServiceAction({
      cardId: input.cardId,
      action: 'building_added',
      targetType: 'building',
      details: { building_name: autoName, card_name: card?.name ?? null },
    })
    await fetchAll()
    showToast(`"${autoName}" 건물이 추가됐습니다`)
    return true
  }

  const importBuildings = async (inputs: CsvBuildingImport[]) => {
    const cleanedInputs = inputs
      .map((input) => ({
        ...input,
        name: input.name.trim(),
        address: input.address.trim(),
        units: Array.from(
          new Map(
            input.units
              .map((unit) => ({ ...unit, number: unit.number.trim(), memo: unit.memo?.trim() }))
              .filter((unit) => unit.number)
              .map((unit) => [unit.number, unit]),
          ).values(),
        ),
      }))
      .filter((input) => input.name && input.address && isValidMapCoordinate(input.lat, input.lng))

    if (cleanedInputs.length === 0) {
      showToast('업로드할 건물 데이터가 없습니다.', 'error')
      return { inserted: 0, skipped: inputs.length }
    }

    let inserted = 0
    let skipped = inputs.length - cleanedInputs.length
    let visitHistoriesInserted = 0
    const existingKeys = new Set(buildings.map((building) => `${building.cardId}|${building.address}|${building.name}`))

    for (const input of cleanedInputs) {
      const key = `${input.cardId}|${input.address}|${input.name}`
      if (existingKeys.has(key)) {
        skipped += 1
        continue
      }

      const buildingResult = await supabase
        .from('buildings')
        .insert({
          card_id: input.cardId,
          name: input.name,
          address: input.address,
          type: input.type,
          lat: input.lat,
          lng: input.lng,
          ...(input.warning ? { warning: input.warning } : {}),
        })
        .select('id')
        .single()

      if (buildingResult.error || !buildingResult.data?.id) {
        skipped += 1
        continue
      }

      const units = input.units.length > 0
        ? input.units
        : [{ number: '101호', status: '미방문' as UnitStatus, isChinese: false, isRegularVisit: false, regularVisitor: undefined, regularVisitorStartDate: undefined, memo: undefined, visitHistories: [] }]
      const unitsResult = await supabase.from('units').insert(
        units.map((unit) => ({
          building_id: buildingResult.data.id,
          number: unit.number,
          status: unit.status,
          is_chinese: unit.isChinese,
          memo: unit.memo || null,
        })),
      ).select('id, number')

      if (unitsResult.error) {
        skipped += 1
        continue
      }

      const regularVisitRows = units
        .filter((unit) => unit.isRegularVisit && unit.regularVisitor)
        .map((unit) => {
          const insertedUnit = unitsResult.data?.find((item: { id: number; number: string }) => item.number === unit.number)
          if (!insertedUnit) return null
          return {
            unit_id: insertedUnit.id,
            visitor_name: unit.regularVisitor,
            ...(unit.regularVisitorStartDate ? { registered_at: unit.regularVisitorStartDate } : {}),
          }
        })
        .filter(Boolean)

      if (regularVisitRows.length > 0) {
        const regularResult = await supabase.from('regular_visits').insert(regularVisitRows)
        if (regularResult.error) {
          skipped += 1
          continue
        }
      }

      // 방문기록 삽입
      const visitRows: Array<{ unit_id: number; result: string; visitor_name: string; visited_at: string; time_slot?: string; memo?: string }> = []
      for (const unit of units) {
        if (!unit.visitHistories || unit.visitHistories.length === 0) continue
        const insertedUnit = unitsResult.data?.find((item: { id: number; number: string }) => item.number === unit.number)
        if (!insertedUnit) continue
        for (const vh of unit.visitHistories) {
          visitRows.push({
            unit_id: insertedUnit.id,
            result: vh.result,
            visitor_name: vh.visitor ?? '',
            visited_at: vh.visitedAt,
            ...(vh.timeSlot ? { time_slot: vh.timeSlot } : {}),
            ...(vh.memo ? { memo: vh.memo } : {}),
          })
        }
      }

      if (visitRows.length > 0) {
        const visitResult = await supabase.from('visit_histories').insert(visitRows)
        if (!visitResult.error) visitHistoriesInserted += visitRows.length
      }

      existingKeys.add(key)
      inserted += 1
    }

    await fetchAll()
    const visitMsg = visitHistoriesInserted > 0 ? `, 방문기록 ${visitHistoriesInserted}건` : ''
    showToast(`CSV 업로드 완료: 건물 ${inserted}개 추가${visitMsg}, ${skipped}개 제외`, inserted > 0 ? 'success' : 'info')
    return { inserted, skipped }
  }

  const addUnitToBuilding = async (buildingId: number, unitNumber: string | string[]) => {
    const unitNumbers = [...new Set(
      (Array.isArray(unitNumber) ? unitNumber : [unitNumber])
        .map((number) => number.trim())
        .filter(Boolean),
    )]
    if (unitNumbers.length === 0) return false

    // 새로 만든 id 를 돌려준다 — 추가 직후 바로 기록(예: 출입불가 → 대상외)해야 할 때 필요
    const result = await supabase.from('units').insert(
      unitNumbers.map((number) => ({
        building_id: buildingId,
        number,
        status: '미방문',
      })),
    ).select('id')
    if (result.error) {
      reportMutationError('호수를 추가하지 못했습니다.', result.error)
      return false
    }
    const newIds = (result.data ?? []).map((row) => (row as { id: number }).id)
    await fetchAll()
    showToast(
      unitNumbers.length === 1
        ? `${unitNumbers[0]} 호수가 추가됐습니다`
        : `${unitNumbers.length}개 호수가 추가됐습니다`,
    )
    return newIds
  }

  const deleteUnitFromBuilding = async (_buildingId: number, unitId: number) => {
    const result = await supabase.from('units').delete().eq('id', unitId)
    if (result.error) {
      reportMutationError('호수를 삭제하지 못했습니다.', result.error)
      return
    }
    await fetchAll()
    showToast('호수가 삭제됐습니다')
  }

  const deleteBuilding = async (buildingId: number) => {
    const result = await supabase.from('buildings').delete().eq('id', buildingId)
    if (result.error) {
      reportMutationError('건물을 삭제하지 못했습니다.', result.error)
      return
    }
    await fetchAll()
    showToast('건물이 삭제됐습니다')
  }

  const deleteBuildings = async (buildingIds: number[]) => {
    const ids = Array.from(new Set(buildingIds)).filter(Number.isFinite)
    if (ids.length === 0) {
      showToast('삭제할 건물이 없습니다.', 'info')
      return
    }
    const result = await supabase.from('buildings').delete().in('id', ids)
    if (result.error) {
      reportMutationError('건물을 삭제하지 못했습니다.', result.error)
      return
    }
    await fetchAll()
    showToast(`건물 ${ids.length}개가 삭제됐습니다`)
  }

  /**
   * 같은 카드 내 중복 주소 건물들을 합칩니다.
   * - 주소가 동일한 건물들 중 id가 가장 작은 건물(기준)에 나머지 건물의 호수를 모두 이전
   * - 호수 번호가 겹칠 경우 기준 건물의 호수를 유지 (중복 삽입 스킵)
   * - 나머지 건물 삭제
   */
  const mergeDuplicateBuildings = async (
    scopeCardId?: number,
    nameOverrides?: Record<number, string>,
    selectedPrimaryIds?: number[],
  ) => {
    const scope = scopeCardId
      ? buildings.filter((b) => b.cardId === scopeCardId)
      : buildings

    const normalizeAddr = (addr: string) =>
      addr.trim().toLowerCase().replace(/\s+/g, '').replace(/[-‐]/g, '-')

    const groups = new Map<string, typeof scope>()
    for (const b of scope) {
      const key = `${b.cardId}::${normalizeAddr(b.address)}`
      if (!groups.has(key)) groups.set(key, [])
      groups.get(key)!.push(b)
    }

    const selectedPrimaryIdSet = selectedPrimaryIds ? new Set(selectedPrimaryIds) : null
    const duplicateGroups = Array.from(groups.values()).filter((g) => {
      if (g.length <= 1) return false
      if (!selectedPrimaryIdSet) return true
      const primaryId = [...g].sort((a, b) => a.id - b.id)[0].id
      return selectedPrimaryIdSet.has(primaryId)
    })
    if (duplicateGroups.length === 0) {
      showToast('중복 주소 건물이 없습니다.', 'info')
      return
    }

    let mergedBuildings = 0
    let movedUnits = 0

    for (const group of duplicateGroups) {
      const sorted = [...group].sort((a, b) => a.id - b.id)
      const [primary, ...rest] = sorted

      const chosenName = nameOverrides?.[primary.id]
      if (chosenName && chosenName !== primary.name) {
        const nameRes = await supabase
          .from('buildings')
          .update({ name: chosenName })
          .eq('id', primary.id)
        if (nameRes.error) {
          reportMutationError('건물 이름 변경 중 오류가 발생했습니다.', nameRes.error)
          return
        }
      }

      const existingNumbers = new Set(primary.units.map((u) => u.number))

      for (const duplicate of rest) {
        for (const unit of duplicate.units) {
          if (existingNumbers.has(unit.number)) continue
          const res = await supabase
            .from('units')
            .update({ building_id: primary.id })
            .eq('id', unit.id)
          if (res.error) {
            reportMutationError('호수 이전 중 오류가 발생했습니다.', res.error)
            return
          }
          existingNumbers.add(unit.number)
          movedUnits++
        }
        const delRes = await supabase.from('buildings').delete().eq('id', duplicate.id)
        if (delRes.error) {
          reportMutationError('중복 건물 삭제 중 오류가 발생했습니다.', delRes.error)
          return
        }
        mergedBuildings++
      }
    }

    await fetchAll()
    showToast(`중복 건물 ${mergedBuildings}개 합병 완료 (호수 ${movedUnits}개 이전)`)
  }

  const updateBuilding = async (
    buildingId: number,
    name: string,
    address: string,
    lat?: number,
    lng?: number,
    type?: string,
    memo?: string,
    isChineseHeavy?: boolean,
  ) => {
    const payload: Record<string, unknown> = { name, address }
    if (lat !== undefined) payload.lat = lat
    if (lng !== undefined) payload.lng = lng
    if (type !== undefined) payload.type = type
    if (memo !== undefined) payload.memo = memo
    if (isChineseHeavy !== undefined) payload.is_chinese_heavy = isChineseHeavy
    const result = await supabase.from('buildings').update(payload).eq('id', buildingId)
    if (result.error) {
      reportMutationError('건물 정보를 수정하지 못했습니다.', result.error)
      return
    }
    const building = buildings.find((b) => b.id === buildingId)
    const card = building ? cards.find((c) => c.id === building.cardId) : undefined
    await logServiceAction({
      cardId: card?.id ?? null,
      action: 'building_updated',
      targetType: 'building',
      targetId: buildingId,
      details: { building_name: name, card_name: card?.name ?? null },
    })
    await fetchAll()
    if (lat === undefined) {
      showToast('건물 정보가 수정됐습니다')
    }
  }

  const moveBuildingToCard = async (buildingId: number, cardId: number) => {
    const result = await supabase.from('buildings').update({ card_id: cardId }).eq('id', buildingId)
    if (result.error) {
      reportMutationError('건물 카드를 변경하지 못했습니다.', result.error)
      return
    }
    await fetchAll()
    showToast('건물 카드가 변경됐습니다')
  }

  const reassignBuildingsToCards = async (
    updates: Array<{ buildingId: number; cardId: number }>,
  ) => {
    if (updates.length === 0) {
      showToast('재배정할 건물이 없습니다.', 'info')
      return { updated: 0, failed: 0 }
    }

    let updated = 0
    let failed = 0
    const chunkSize = 40
    for (let index = 0; index < updates.length; index += chunkSize) {
      const chunk = updates.slice(index, index + chunkSize)
      const results = await Promise.all(
        chunk.map((item) =>
          supabase
            .from('buildings')
            .update({ card_id: item.cardId })
            .eq('id', item.buildingId),
        ),
      )
      results.forEach((result) => {
        if (result.error) failed += 1
        else updated += 1
      })
    }

    await fetchAll()
    showToast(`좌표 기준 카드 재배정 완료: ${updated}개 변경${failed ? `, ${failed}개 실패` : ''}`, failed ? 'info' : 'success')
    return { updated, failed }
  }

  return {
    createBuilding,
    importBuildings,
    addUnitToBuilding,
    deleteUnitFromBuilding,
    deleteBuilding,
    deleteBuildings,
    mergeDuplicateBuildings,
    updateBuilding,
    moveBuildingToCard,
    reassignBuildingsToCards,
  }
}
