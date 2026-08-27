// CSV 미리보기 한 줄을 import_building_tx 가 받는 모양으로 바꾼다.
//
// 화면에서 떼어 둔다 — 이 변환이 틀리면 세대가 통째로 빠지거나 방문기록이
// 사라지는데, 화면 안에 있으면 확인할 방법이 없다.
import type { CsvBuildingImport } from './csvBuildingImport'

export type ImportBuildingPayload = {
  building: Record<string, unknown>
  units: Record<string, unknown>[]
}

/** 세대가 하나도 없으면 '101호' 하나를 만든다 (예전 동작 그대로) */
export const DEFAULT_UNIT_NUMBER = '101호'

export function buildImportPayload(input: CsvBuildingImport): ImportBuildingPayload {
  const units = input.units.length > 0
    ? input.units
    : [{
        number: DEFAULT_UNIT_NUMBER, status: '미방문' as const, isChinese: false,
        isRestaurant: false, naverPlaceId: undefined, isRegularVisit: false,
        regularVisitor: undefined, regularVisitorStartDate: undefined,
        memo: undefined, visitHistories: [],
      }]

  return {
    building: {
      card_id: input.cardId,
      name: input.name,
      address: input.address,
      type: input.type,
      lat: input.lat,
      lng: input.lng,
      ...(input.warning ? { warning: input.warning } : {}),
    },
    units: units.map((unit) => ({
      number: unit.number,
      status: unit.status,
      is_chinese: unit.isChinese,
      is_restaurant: unit.isRestaurant ?? false,
      naver_place_id: unit.naverPlaceId || null,
      memo: unit.memo || null,
      // 정기방문은 '정기방문자 이름이 있을 때만' 만든다 (예전 동작 그대로)
      ...(unit.isRegularVisit && unit.regularVisitor
        ? {
            regular_visitor: unit.regularVisitor,
            ...(unit.regularVisitorStartDate
              ? { regular_visitor_start_date: unit.regularVisitorStartDate }
              : {}),
          }
        : {}),
      visits: (unit.visitHistories ?? []).map((vh) => ({
        result: vh.result,
        visitor_name: vh.visitor ?? '',
        visited_at: vh.visitedAt,
        ...(vh.timeSlot ? { time_slot: vh.timeSlot } : {}),
        ...(vh.memo ? { memo: vh.memo } : {}),
      })),
    })),
  }
}
