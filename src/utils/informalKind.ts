import type { InformalKind } from '../types'

/**
 * 비공식 장소 종류의 색과 형태.
 *
 * ⚠ 건물 핀이 이미 쓰는 뜻과 겹치지 않게 골랐다 —
 *   파랑=방문필요, 초록=방문완료, 금색=정기방문, 검정=방문금지 (utils/buildingPin).
 *   같은 색이 두 뜻을 가지면 반드시 헷갈린다.
 *
 * ⚠ 색만으로 나누지 않는다. 지도 핀은 26px 쯤이라 실제 크기에서는
 *   **형태가 색보다 먼저** 눈에 들어온다 (핀 개편 때 배웠다).
 */
export const INFORMAL_KIND_STYLE: Record<InformalKind, { color: string }> = {
  비공식구역: { color: '#7A5C8A' },
  거점:       { color: '#C44536' },
  대화장소:   { color: '#5B6B7C' },
}

/** 지도 핀 안에 넣는 도형. 26px 안에서 구분되도록 단순하게 그린다 */
export function informalKindSvgPath(kind: InformalKind): string {
  switch (kind) {
    case '거점':
      // 하트
      return 'M12 20s-6.5-4.6-6.5-9.2A3.9 3.9 0 0 1 12 8.4a3.9 3.9 0 0 1 6.5 2.4C18.5 15.4 12 20 12 20z'
    case '대화장소':
      // 말풍선 — 이모지(💬)를 쓰면 폰마다 그림이 달라 앱의 다른 아이콘과 따로 논다
      return 'M5 6h14a1 1 0 0 1 1 1v8a1 1 0 0 1-1 1h-6l-4 3v-3H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1z'
    case '비공식구역':
    default:
      // 별
      return 'M12 4.5l2.3 4.9 5.2.7-3.8 3.7.9 5.2-4.6-2.5-4.6 2.5.9-5.2L4.5 10l5.2-.7z'
  }
}
