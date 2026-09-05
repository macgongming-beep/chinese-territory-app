import type { ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { getOverlayRoot } from '../lib/overlayRoot'

/** 글씨 크기 확대가 적용되는 #root 내부 공용 오버레이 자리로 렌더한다. */
export function OverlayPortal({ children }: { children: ReactNode }) {
  const target = getOverlayRoot()
  return target ? createPortal(children, target) : null
}
