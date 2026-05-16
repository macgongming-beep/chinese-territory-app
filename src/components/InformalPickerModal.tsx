// 비공식 증거 카드 선택 모달 — 자료 풀에서 선택
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
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, zIndex: 250,
        background: 'rgba(15,23,42,0.55)',
        display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: '100%', maxWidth: 560, maxHeight: '85vh',
          background: '#fff', borderTopLeftRadius: 18, borderTopRightRadius: 18,
          display: 'flex', flexDirection: 'column',
        }}
      >
        <div style={{
          padding: '14px 16px', borderBottom: '1px solid #e2e8f0',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        }}>
          <h3 style={{ margin: 0, fontSize: 15, fontWeight: 800, color: '#1e293b' }}>
            📋 비공식 증거 카드 선택
          </h3>
          <button
            onClick={onClose}
            style={{ background: 'none', border: 'none', fontSize: 20, color: '#94a3b8', cursor: 'pointer' }}
            aria-label="닫기"
          >✕</button>
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: 16 }}>
          {sorted.length === 0 ? (
            <p style={{ padding: 32, textAlign: 'center', color: '#94a3b8', fontSize: 13 }}>
              등록된 자료가 없습니다.<br />
              <span style={{ fontSize: 11, color: '#cbd5e1' }}>
                관리자가 설정에서 자료를 먼저 업로드해야 합니다.
              </span>
            </p>
          ) : (
            <div style={{
              display: 'grid', gap: 10,
              gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))',
            }}>
              {sorted.map((asset) => {
                const isAssigned = alreadyAssignedIds.has(asset.id)
                return (
                  <button
                    key={asset.id}
                    type="button"
                    onClick={() => onSelect(asset.id)}
                    disabled={isAssigned}
                    style={{
                      position: 'relative',
                      aspectRatio: '4 / 5',
                      borderRadius: 12,
                      border: isAssigned ? '2px solid #94a3b8' : '1px solid #e5e7eb',
                      overflow: 'hidden',
                      background: '#fff',
                      cursor: isAssigned ? 'default' : 'pointer',
                      padding: 0,
                      opacity: isAssigned ? 0.5 : 1,
                    }}
                  >
                    <img
                      src={asset.imageUrl}
                      alt={asset.name}
                      style={{ width: '100%', height: '70%', objectFit: 'cover', display: 'block' }}
                      loading="lazy"
                    />
                    <div style={{
                      padding: '6px 8px', fontSize: 11, fontWeight: 700,
                      color: '#1e293b', textAlign: 'left',
                      overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                    }}>
                      {asset.name}
                    </div>
                    {isAssigned && (
                      <span style={{
                        position: 'absolute', top: 6, right: 6,
                        padding: '2px 6px', borderRadius: 6,
                        background: 'rgba(15,23,42,0.7)', color: '#fff',
                        fontSize: 10, fontWeight: 800,
                      }}>
                        추가됨
                      </span>
                    )}
                  </button>
                )
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
