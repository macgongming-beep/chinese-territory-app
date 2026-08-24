import type { Building, TerritoryCard, Unit, UnitStatus } from '../../types'
import type { CsvBuildingImport } from '../../utils/csvBuildingImport'
import { isValidMapCoordinate } from '../../utils/mapUtils'
import { planDuplicateBuildingMerge } from '../../utils/duplicateBuildingMerge'
import { supabase, showToast, reportMutationError } from './shared'
import { logServiceAction } from './serviceLog'
import { msg } from '../../lib/msg'

export function makeBuildingMutations(deps: {
  fetchAll: () => Promise<void>
  buildings: Building[]
  cards: TerritoryCard[]
  /**
   * 세대 추가·삭제를 화면 상태에 바로 반영한다.
   * 이게 없으면 호수 하나 넣을 때마다 건물 전체(약 440KB)를 다시 받아야 해서
   * 일괄로 여러 개 넣을 때 눈에 띄게 느려진다. (방문 기록과 같은 방식)
   */
  appendUnits: (buildingId: number, units: Unit[]) => void
  removeUnit: (unitId: number) => void
}) {
  const { fetchAll, buildings, cards, appendUnits, removeUnit } = deps

  /** 성공하면 true, 실패하면 false. 이 계약이 화면까지 그대로 간다. */
  const createBuilding = async (input: {
    cardId: number
    name: string
    address: string
    type: Building['type']
    lat: number
    lng: number
  }): Promise<boolean> => {
    if (!input.address.trim()) {
      showToast(msg('주소를 입력해 주세요.'), 'error')
      return false
    }
    if (!cards.some((card) => card.id === input.cardId)) {
      showToast(msg('건물을 추가할 카드를 찾지 못했습니다. 카드를 직접 선택해 주세요.'), 'error')
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
      reportMutationError(msg('건물을 추가하지 못했습니다.'), result.error)
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
    showToast(msg('"{autoName}" 건물이 추가됐습니다', { autoName: autoName }))
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
      showToast(msg('업로드할 건물 데이터가 없습니다.'), 'error')
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
        : [{ number: '101호', status: '미방문' as UnitStatus, isChinese: false, isRestaurant: false, naverPlaceId: undefined, isRegularVisit: false, regularVisitor: undefined, regularVisitorStartDate: undefined, memo: undefined, visitHistories: [] }]
      const unitsResult = await supabase.from('units').insert(
        units.map((unit) => ({
          building_id: buildingResult.data.id,
          number: unit.number,
          status: unit.status,
          is_chinese: unit.isChinese,
          is_restaurant: unit.isRestaurant ?? false,
          naver_place_id: unit.naverPlaceId || null,
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
    showToast(msg('CSV 업로드 완료: 건물 {inserted}개 추가{visitMsg}, {skipped}개 제외', { inserted: inserted, visitMsg: visitMsg, skipped: skipped }), inserted > 0 ? 'success' : 'info')
    return { inserted, skipped }
  }

  /** 성공하면 새로 만든 호수 id 들, 실패하면 false. 화면이 입력을 지킬 수 있어야 한다 */
  const addUnitToBuilding = async (
    buildingId: number,
    unitNumber: string | string[],
  ): Promise<number[] | false> => {
    const unitNumbers = [...new Set(
      (Array.isArray(unitNumber) ? unitNumber : [unitNumber])
        .map((number) => number.trim())
        .filter(Boolean),
    )]
    if (unitNumbers.length === 0) return false

    // 새로 만든 행을 돌려받는다 — id 는 추가 직후 기록(출입불가 → 대상외)에,
    // 나머지는 화면에 바로 반영하는 데 쓴다
    const result = await supabase.from('units').insert(
      unitNumbers.map((number) => ({
        building_id: buildingId,
        number,
        status: '미방문',
      })),
    ).select('id, number, status')
    if (result.error) {
      reportMutationError(msg('호수를 추가하지 못했습니다.'), result.error)
      return false
    }
    const created = (result.data ?? []) as Array<{ id: number; number: string; status: string }>
    const newIds = created.map((row) => row.id)
    // 건물 전체를 다시 받지 않고 새 호수만 목록에 얹는다
    appendUnits(buildingId, created.map((row) => ({
      id: row.id,
      number: row.number,
      status: (row.status ?? '미방문') as UnitStatus,
      isChinese: false,
    })))
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
      reportMutationError(msg('호수를 삭제하지 못했습니다.'), result.error)
      return
    }
    removeUnit(unitId)
    showToast(msg('호수가 삭제됐습니다'))
  }

  const deleteBuilding = async (buildingId: number) => {
    const result = await supabase.from('buildings').delete().eq('id', buildingId)
    if (result.error) {
      reportMutationError(msg('건물을 삭제하지 못했습니다.'), result.error)
      return
    }
    await fetchAll()
    showToast(msg('건물이 삭제됐습니다'))
  }

  const deleteBuildings = async (buildingIds: number[]) => {
    const ids = Array.from(new Set(buildingIds)).filter(Number.isFinite)
    if (ids.length === 0) {
      showToast(msg('삭제할 건물이 없습니다.'), 'info')
      return
    }
    const result = await supabase.from('buildings').delete().in('id', ids)
    if (result.error) {
      reportMutationError(msg('건물을 삭제하지 못했습니다.'), result.error)
      return
    }
    await fetchAll()
    showToast(msg('건물 {length}개가 삭제됐습니다', { length: ids.length }))
  }

  /**
   * 같은 카드 내 중복 주소 건물들을 합칩니다.
   * - 주소가 동일한 건물들 중 id가 가장 작은 건물(기준)에 나머지 건물의 호수를 모두 이전
   * - 호수 번호가 겹칠 경우 기준 건물의 호수를 유지 (중복 삽입 스킵)
   * - 나머지 건물 삭제
   */
  /**
   * 같은 주소로 두 번 등록된 건물을 합친다.
   *
   * ⚠ 호수 번호가 겹치는 묶음은 **손대지 않는다.** 예전에는 겹치는 호수를
   *   "이동 건너뛰기" 하고 원본 건물을 지웠는데, units 가 visit_histories ·
   *   regular_visits 에 on delete cascade 로 물려 있어서 그 호수의
   *   **방문 기록이 조용히 사라졌다.** 무엇을 남길지는 사람이 볼 판단이다.
   *   판단은 utils/duplicateBuildingMerge.ts 에 있고 테스트로 덮여 있다.
   */
  const mergeDuplicateBuildings = async (
    scopeCardId?: number,
    nameOverrides?: Record<number, string>,
    selectedPrimaryIds?: number[],
  ) => {
    const plan = planDuplicateBuildingMerge(buildings, { scopeCardId, selectedPrimaryIds })

    if (plan.merge.length === 0) {
      showToast(
        plan.conflicts.length > 0
          ? msg('호수 번호가 겹쳐 병합할 수 없는 주소가 {n}곳 있습니다. 직접 정리해 주세요.', { n: plan.conflicts.length })
          : msg('중복 주소 건물이 없습니다.'),
        'info',
      )
      return
    }

    let mergedBuildings = 0
    let movedUnits = 0

    for (const { primary, absorbed } of plan.merge) {
      const chosenName = nameOverrides?.[primary.id]
      if (chosenName && chosenName !== primary.name) {
        const nameRes = await supabase
          .from('buildings')
          .update({ name: chosenName })
          .eq('id', primary.id)
        if (nameRes.error) {
          reportMutationError(msg('건물 이름 변경 중 오류가 발생했습니다.'), nameRes.error)
          await fetchAll()   // 여기까지 바뀐 것을 화면에 맞춘다
          return
        }
      }

      for (const duplicate of absorbed) {
        // 계획이 이미 충돌을 걸렀다. 여기 오는 호수는 겹치지 않는다.
        for (const unit of duplicate.units) {
          const res = await supabase
            .from('units')
            .update({ building_id: primary.id })
            .eq('id', unit.id)
          if (res.error) {
            reportMutationError(msg('호수 이전 중 오류가 발생했습니다.'), res.error)
            await fetchAll()
            return
          }
          movedUnits++
        }
        const delRes = await supabase.from('buildings').delete().eq('id', duplicate.id)
        if (delRes.error) {
          reportMutationError(msg('중복 건물 삭제 중 오류가 발생했습니다.'), delRes.error)
          await fetchAll()
          return
        }
        mergedBuildings++
      }
    }

    await fetchAll()
    showToast(
      plan.conflicts.length > 0
        ? msg('중복 건물 {mergedBuildings}개 합병 완료 (호수 {movedUnits}개 이전).\n호수가 겹치는 {skipped}곳은 건드리지 않았습니다.', { mergedBuildings: mergedBuildings, movedUnits: movedUnits, skipped: plan.conflicts.length })
        : msg('중복 건물 {mergedBuildings}개 합병 완료 (호수 {movedUnits}개 이전)', { mergedBuildings: mergedBuildings, movedUnits: movedUnits }),
    )
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
      reportMutationError(msg('건물 정보를 수정하지 못했습니다.'), result.error)
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
      showToast(msg('건물 정보가 수정됐습니다'))
    }
  }

  const moveBuildingToCard = async (buildingId: number, cardId: number) => {
    const result = await supabase.from('buildings').update({ card_id: cardId }).eq('id', buildingId)
    if (result.error) {
      reportMutationError(msg('건물 카드를 변경하지 못했습니다.'), result.error)
      return
    }
    await fetchAll()
    showToast(msg('건물 카드가 변경됐습니다'))
  }

  const reassignBuildingsToCards = async (
    updates: Array<{ buildingId: number; cardId: number }>,
  ) => {
    if (updates.length === 0) {
      showToast(msg('재배정할 건물이 없습니다.'), 'info')
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
    showToast(msg('좌표 기준 카드 재배정 완료: {updated}개 변경{v1}', { updated: updated, v1: failed ? `, ${failed}개 실패` : '' }), failed ? 'info' : 'success')
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
