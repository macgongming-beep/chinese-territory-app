import type { Building, CardBoundary } from '../../types'
import { findCardForCoordinates } from '../../utils/mapUtils'
import { geocodeFirstMatch } from '../../lib/naverGeocode'
import { getGeocodeCandidates } from '../../utils/geocodeCandidates'
import { shortAddress } from '../../utils/shortAddress'
import { ensureAffectedRows, reportMutationError, showToast, supabase } from './shared'
import { msg } from '../../lib/msg'

export function makeRestaurantServiceMutations(deps: {
  fetchAll: () => Promise<void>
  buildings: Building[]
  cardBoundaries: CardBoundary[]
}) {
  const { fetchAll, buildings, cardBoundaries } = deps



  /** 봉사자: 식당 방문 기록 직접 추가 (기존 is_restaurant 건물) */
  const addRestaurantVisit = async (
    unitId: number,
    memo: string,
  ): Promise<void> => {
    const visitor = localStorage.getItem('currentVisitor') ?? ''
    const now = new Date().toISOString()
    const result = await supabase.from('visit_histories').insert({
      unit_id: unitId,
      visitor_name: visitor,
      result: '만남',
      time_slot: (() => {
        const h = new Date().getHours()
        if (h < 12) return '오전'
        if (h < 17) return '오후'
        return '저녁'
      })(),
      memo: memo.trim() || null,
      visited_at: now,
      visit_type: 'restaurant',
    })
    if (result.error) {
      reportMutationError(msg('식당봉사 기록을 추가하지 못했습니다.'), result.error)
      return
    }
    await fetchAll()
    showToast(msg('식당봉사 기록이 저장됐습니다 🍜'))
  }

  /** 봉사자: 새 식당 추가 신청 */
  const submitRestaurantRequest = async (
    name: string,
    address: string,
    memo: string,
  ): Promise<void> => {
    const requestedBy = localStorage.getItem('currentVisitor') ?? ''
    const result = await supabase.from('restaurant_requests').insert({
      name: name.trim(),
      address: address.trim(),
      requested_by: requestedBy,
      memo: memo.trim() || null,
      visited_at: new Date().toISOString(),
    }).select('id')
    if (result.error) {
      reportMutationError(msg('식당 추가 신청을 하지 못했습니다.'), result.error)
      return
    }
    if (!ensureAffectedRows(result.data, msg('식당 추가 신청을 하지 못했습니다.'))) return
    await fetchAll()
    showToast(msg('식당 추가 신청이 완료됐습니다. 관리자 승인 후 반영됩니다.'))
  }

  /** 봉사자: 신청한 식당의 메모 업데이트 */
  const updateRestaurantRequestMemo = async (
    requestId: number,
    memo: string,
  ): Promise<void> => {
    const result = await supabase
      .from('restaurant_requests')
      .update({ memo: memo.trim() || null })
      .eq('id', requestId)
      .select('id')
    if (result.error) {
      reportMutationError(msg('메모를 저장하지 못했습니다.'), result.error)
      return
    }
    // 남의 신청이면 RLS 로 0행이 온다 — 오류가 아니므로 행 수로 봐야 한다
    if (!ensureAffectedRows(result.data, msg('메모를 저장하지 못했습니다.'))) return
    await fetchAll()
    showToast(msg('메모가 저장됐습니다 🍜'))
  }

  /** 관리자: 식당 신청 승인 */
  const approveRestaurantRequest = async (
    requestId: number,
    opts: {
      name: string
      address: string
      reviewer: string
      existingBuildingId?: number | null
      lat?: number
      lng?: number
    },
  ): Promise<void> => {
    // 기존 건물 직접 지정 OR 주소 매칭
    const existingBuilding = opts.existingBuildingId
      ? buildings.find((b) => b.id === opts.existingBuildingId) ?? null
      : buildings.find((b) => b.address.trim() === opts.address.trim()) ?? null

    let resolvedBuildingId: number
    let resolvedUnitId: number

    if (existingBuilding) {
      // 기존 건물 — is_restaurant 플래그 켜기
      const toggleRes = await supabase
        .from('buildings')
        .update({ is_restaurant: true })
        .eq('id', existingBuilding.id)
      if (toggleRes.error) {
        reportMutationError(msg('건물을 식당으로 표시하지 못했습니다.'), toggleRes.error)
        return
      }
      resolvedBuildingId = existingBuilding.id
      // 첫 번째 세대 사용
      const firstUnit = existingBuilding.units[0]
      if (!firstUnit) {
        // 세대가 없으면 하나 생성
        const uRes = await supabase
          .from('units')
          .insert({ building_id: resolvedBuildingId, number: opts.name.trim(), status: '만남', is_chinese: true, is_restaurant: true })
          .select('id')
          .single()
        if (uRes.error || !uRes.data) {
          reportMutationError(msg('세대를 생성하지 못했습니다.'), uRes.error)
          return
        }
        resolvedUnitId = uRes.data.id
      } else {
        resolvedUnitId = firstUnit.id
      }
    } else {
      // 새 건물을 만든다.
      //
      // 예전에는 좌표를 안 찾고(0, 0) 무조건 '미배정 건물' 카드에 넣었다.
      // 그래서 승인해도 **지도에 안 뜨고** 그 지역 구역 카드에도 안 들어갔다.
      // 건물 추가 화면과 같은 순서로 맞춘다: 주소 → 좌표 → 구역선으로 카드 찾기.
      let lat = opts.lat ?? 0
      let lng = opts.lng ?? 0
      if (!lat || !lng) {
        const found = await geocodeFirstMatch(getGeocodeCandidates(opts.address))
        if (found) { lat = found.lat; lng = found.lng }
      }

      let cardId: number | undefined
      if (lat && lng) {
        cardId = findCardForCoordinates(lat, lng, cardBoundaries) ?? undefined
      }
      if (!cardId) {
        // 좌표를 못 찾았거나 어느 구역선에도 안 들어간다 — 미배정으로 둔다
        const { data: cardData } = await supabase
          .from('cards').select('id').eq('name', '미배정 건물').limit(1).single()
        cardId = cardData?.id
      }
      if (!cardId) {
        showToast(msg('미배정 건물 카드를 찾을 수 없습니다.'), 'error')
        return
      }

      const bRes = await supabase
        .from('buildings')
        .insert({
          card_id: cardId,
          // 건물 이름은 **주소**, 가게 이름은 세대로 들어간다.
          // 기존 식당 200개가 전부 이 모양이고, 한 건물에 가게가 둘 이상인 곳도
          // 이미 있다. 가게 이름을 건물 이름으로 쓰면 두 번째 가게를 넣을 수 없다.
          name: shortAddress(opts.address),
          address: opts.address.trim(),
          type: '상가',
          lat,
          lng,
          is_restaurant: true,
        })
        .select('id')
        .single()

      if (bRes.error || !bRes.data) {
        reportMutationError(msg('식당 건물을 추가하지 못했습니다.'), bRes.error)
        return
      }
      resolvedBuildingId = bRes.data.id

      const uRes = await supabase
        .from('units')
        .insert({ building_id: resolvedBuildingId, number: opts.name.trim(), status: '만남', is_chinese: true, is_restaurant: true })
        .select('id')
        .single()
      if (uRes.error || !uRes.data) {
        reportMutationError(msg('세대를 생성하지 못했습니다.'), uRes.error)
        return
      }
      resolvedUnitId = uRes.data.id
    }

    // 신청 시 적어둔 메모가 있으면 방문이력 추가
    const { data: req } = await supabase
      .from('restaurant_requests')
      .select('memo, visited_at, requested_by')
      .eq('id', requestId)
      .single()

    if (req?.memo || req?.visited_at) {
      await supabase.from('visit_histories').insert({
        unit_id: resolvedUnitId,
        visitor_name: req.requested_by ?? opts.reviewer,
        result: '만남',
        time_slot: '저녁',
        memo: req.memo ?? null,
        visited_at: req.visited_at ?? new Date().toISOString(),
        visit_type: 'restaurant',
      })
    }

    // 신청 상태 업데이트
    const updateRes = await supabase
      .from('restaurant_requests')
      .update({
        status: 'approved',
        building_id: resolvedBuildingId,
        reviewer: opts.reviewer,
        reviewed_at: new Date().toISOString(),
      })
      .eq('id', requestId)
      .select('id')

    if (updateRes.error) {
      reportMutationError(msg('신청 상태 업데이트에 실패했습니다.'), updateRes.error)
      return
    }
    if (!ensureAffectedRows(updateRes.data, msg('신청 상태 업데이트에 실패했습니다.'))) return

    await fetchAll()
    showToast(msg('식당 신청이 승인됐습니다.'))
  }

  /** 관리자: 식당 신청 거절 */
  const rejectRestaurantRequest = async (
    requestId: number,
    reviewer: string,
  ): Promise<void> => {
    const result = await supabase
      .from('restaurant_requests')
      .update({
        status: 'rejected',
        reviewer,
        reviewed_at: new Date().toISOString(),
      })
      .eq('id', requestId)
      .select('id')
    if (result.error) {
      reportMutationError(msg('신청 거절에 실패했습니다.'), result.error)
      return
    }
    if (!ensureAffectedRows(result.data, msg('신청 거절에 실패했습니다.'))) return
    await fetchAll()
    showToast(msg('식당 신청이 거절됐습니다.'))
  }

  return {
    addRestaurantVisit,
    submitRestaurantRequest,
    updateRestaurantRequestMemo,
    approveRestaurantRequest,
    rejectRestaurantRequest,
  }
}
