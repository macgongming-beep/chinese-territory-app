import type { InformalKind } from '../types'
import { INFORMAL_KIND_STYLE, informalKindSvgPath } from '../utils/informalKind'

/**
 * 비공식 장소 종류 아이콘.
 *
 * ⚠ 이모지를 쓰지 않는다. 폰트마다 다르게 그려지고(안드로이드·iOS·PC 가 전부 다르다),
 *   이 앱의 다른 아이콘은 전부 선(stroke) svg 라 혼자 튄다.
 *   지도 핀과 **같은 도형**을 쓴다 — 목록에서 본 모양이 지도에서 그대로 보이게.
 */
export function InformalKindIcon({
  kind, size = 14, color,
}: { kind: InformalKind; size?: number; color?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill={color ?? INFORMAL_KIND_STYLE[kind].color}
      aria-hidden
      style={{ display: 'block', flexShrink: 0 }}
    >
      <path d={informalKindSvgPath(kind)} />
    </svg>
  )
}
