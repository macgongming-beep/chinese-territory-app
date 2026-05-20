// 비공식 증거 카드 선택 모달 (디자인 v2 28d — 시트 형식)
import type { InformalAsset } from '../types'

type Props = {
  open: boolean
  assets: InformalAsset[]
  alreadyAssignedIds: Set<number>
  onSelect: (assetId: number) => Promise<void> | void
  onClose: () => void
}

export function InformalPickerModal({
  open, assets, alreadyAssignedIds, onSelect, onClose,
}: Props) {
  if (!open) return null
  const sorted = [...assets].sort((a, b) => b.createdAt.localeCompare(a.createdAt))

  return (
    <div className="v2-picker-backdrop" onClick={onClose}>
      <div className="v2-picker-sheet" onClick={(e) => e.stopPropagation()}>
        <div className="v2-picker-grabber" />
        <div className="v2-picker-head">
          <span className="v2-picker-title">📋 비공식 증거 카드 선택</span>
          <button className="v2-picker-close" onClick={onClose} aria-label="닫기" type="button">×</button>
        </div>

        {sorted.length === 0 ? (
          <p className="v2-picker-empty">
            등록된 자료가 없습니다.
            <br />
            <span style={{ fontSize: 11, color: 'var(--muted-2)' }}>
              관리자가 설정에서 자료를 먼저 업로드해야 합니다.
            </span>
          </p>
        ) : (
          <div className="v2-informal-grid">
            {sorted.map((asset) => {
              const isAssigned = alreadyAssignedIds.has(asset.id)
              return (
                <button
                  key={asset.id}
                  type="button"
                  className="v2-informal-cell"
                  onClick={() => onSelect(asset.id)}
                  disabled={isAssigned}
                >
                  <div className="v2-informal-thumb">
                    {asset.imageUrl && (
                      <img src={asset.imageUrl} alt={asset.name} loading="lazy" />
                    )}
                    {isAssigned && (
                      <span className="v2-informal-added">추가됨</span>
                    )}
                  </div>
                  <span className="v2-informal-cell-name">{asset.name}</span>
                </button>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
