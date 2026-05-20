// 비공식 증거 카드 선택 모달 (디자인 v2 28d — 시트 + 사용자 정의 그룹)
import { useMemo, useState } from 'react'
import type { InformalAsset, InformalGroup } from '../types'

type Props = {
  open: boolean
  assets: InformalAsset[]
  groups?: InformalGroup[]
  alreadyAssignedIds: Set<number>
  onSelect: (assetId: number) => Promise<void> | void
  onClose: () => void
}

export function InformalPickerModal({
  open, assets, groups = [], alreadyAssignedIds, onSelect, onClose,
}: Props) {
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set())
  // 사용자가 구역-비공식카드 설정에서 만든 그룹 기준으로 묶기.
  // groupId 가 null/없는 자료는 "그룹 없음" 으로 묶고 마지막에 노출.
  const grouped = useMemo(() => {
    const sortedGroups = [...groups].sort((a, b) => a.position - b.position || a.id - b.id)
    const buckets = new Map<number | 'none', { name: string; position: number; items: InformalAsset[] }>()
    for (const g of sortedGroups) {
      buckets.set(g.id, { name: g.name, position: g.position, items: [] })
    }
    for (const asset of assets) {
      const key = asset.groupId != null && buckets.has(asset.groupId) ? asset.groupId : 'none'
      if (key === 'none' && !buckets.has('none')) {
        buckets.set('none', { name: '그룹 없음', position: Number.POSITIVE_INFINITY, items: [] })
      }
      buckets.get(key)!.items.push(asset)
    }
    // 각 그룹 안 자료는 createdAt 최신순
    for (const b of buckets.values()) {
      b.items.sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    }
    // 비어있는 사용자 그룹은 숨김 (none 그룹도 비면 숨김)
    return [...buckets.entries()]
      .filter(([, b]) => b.items.length > 0)
      .sort((a, b) => a[1].position - b[1].position)
      .map(([, b]) => b)
  }, [assets, groups])

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
            {grouped.map((group) => {
              const isCollapsed = collapsed.has(group.name)
              return (
                <section className={`v2-informal-group${isCollapsed ? ' is-collapsed' : ''}`} key={group.name}>
                  <button
                    type="button"
                    className="v2-informal-group-head"
                    aria-expanded={!isCollapsed}
                    onClick={() => setCollapsed((prev) => {
                      const next = new Set(prev)
                      if (next.has(group.name)) next.delete(group.name); else next.add(group.name)
                      return next
                    })}
                  >
                    <svg
                      width="12" height="12" viewBox="0 0 24 24"
                      fill="none" stroke="currentColor" strokeWidth="2.2"
                      aria-hidden
                      style={{ transform: isCollapsed ? 'rotate(-90deg)' : 'none', transition: 'transform .15s' }}
                    ><polyline points="6 9 12 15 18 9"/></svg>
                    <span className="v2-informal-group-name">{group.name}</span>
                    <span className="v2-informal-group-cnt">{group.items.length}</span>
                  </button>
                  {!isCollapsed && (
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
                  )}
                </section>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
