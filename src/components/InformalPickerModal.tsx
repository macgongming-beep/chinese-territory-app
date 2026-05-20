// 비공식 증거 카드 선택 모달 (디자인 v2 28d — 시트 + 그룹화)
import { useMemo } from 'react'
import type { InformalAsset } from '../types'

type Props = {
  open: boolean
  assets: InformalAsset[]
  alreadyAssignedIds: Set<number>
  onSelect: (assetId: number) => Promise<void> | void
  onClose: () => void
}

// 자료명에서 그룹 추출. "용인대" / "단국대(평화이광장)" → 첫 토큰 (괄호/공백/-_ 이전).
function parseGroup(name: string): string {
  const match = name.match(/^[^\s(\-_·:[]+/)
  return (match ? match[0] : name).trim() || '기타'
}

export function InformalPickerModal({
  open, assets, alreadyAssignedIds, onSelect, onClose,
}: Props) {
  const groups = useMemo(() => {
    const map = new Map<string, InformalAsset[]>()
    for (const a of assets) {
      const g = parseGroup(a.name)
      const list = map.get(g) ?? []
      list.push(a)
      map.set(g, list)
    }
    // 각 그룹 안은 createdAt 최신순
    for (const list of map.values()) {
      list.sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    }
    return [...map.entries()]
      .map(([name, items]) => ({ name, items }))
      .sort((a, b) => a.name.localeCompare(b.name, 'ko'))
  }, [assets])

  if (!open) return null

  return (
    <div className="v2-picker-backdrop" onClick={onClose}>
      <div className="v2-picker-sheet" onClick={(e) => e.stopPropagation()}>
        <div className="v2-picker-grabber" />
        <div className="v2-picker-head">
          <span className="v2-picker-title">📋 비공식 증거 카드 선택</span>
          <button className="v2-picker-close" onClick={onClose} aria-label="닫기" type="button">×</button>
        </div>

        {assets.length === 0 ? (
          <p className="v2-picker-empty">
            등록된 자료가 없습니다.
            <br />
            <span style={{ fontSize: 11, color: 'var(--muted-2)' }}>
              관리자가 설정에서 자료를 먼저 업로드해야 합니다.
            </span>
          </p>
        ) : (
          <div className="v2-informal-scroll">
            {groups.map((group) => (
              <section className="v2-informal-group" key={group.name}>
                <header className="v2-informal-group-head">
                  <span className="v2-informal-group-name">{group.name}</span>
                  <span className="v2-informal-group-cnt">{group.items.length}</span>
                </header>
                <div className="v2-informal-grid">
                  {group.items.map((asset) => {
                    const isAssigned = alreadyAssignedIds.has(asset.id)
                    return (
                      <button
                        key={asset.id}
                        type="button"
                        className={`v2-informal-cell${isAssigned ? ' is-added' : ''}`}
                        onClick={() => !isAssigned && onSelect(asset.id)}
                        aria-disabled={isAssigned}
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
              </section>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
