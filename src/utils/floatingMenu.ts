export type AnchorRect = {
  top: number
  right: number
  bottom: number
}

export type FloatingMenuPosition = {
  right: number
  top?: number
  bottom?: number
}

export function getFloatingMenuPosition(
  anchor: AnchorRect,
  viewport: { width: number; height: number },
  estimatedHeight: number,
  gap = 4,
  margin = 12,
): FloatingMenuPosition {
  const right = Math.max(margin, viewport.width - anchor.right)
  if (anchor.bottom + estimatedHeight + margin <= viewport.height) {
    return { right, top: anchor.bottom + gap }
  }
  return { right, bottom: viewport.height - anchor.top + gap }
}
