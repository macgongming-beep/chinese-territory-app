// 비공식 카드 탭 — 자료 풀 + 그룹화 + 업로드 (admin/dev)
// 구역 탭 > 비공식 카드 sub-tab 안에 렌더링
import { useRef, useState } from 'react'
import type { InformalAsset, InformalGroup, Role } from '../types'
import { showToast } from '../lib/toast'
import { compressImage } from '../lib/imageCompress'

const MAX_ORIGINAL_SIZE_MB = 30
const TARGET_SIZE_MB = 1.5

type QueueStatus = 'pending' | 'compressing' | 'uploading' | 'done' | 'error'
type QueueItem = {
  id: string
  originalFile: File
  name: string
  status: QueueStatus
  originalSize: number
  finalSize: number
  width?: number
  height?: number
  error?: string
}

function isAdminLike(role: Role): boolean {
  return role === 'admin' || role === 'developer'
}

type Props = {
  role: Role
  currentVisitor: string
  informalAssets: InformalAsset[]
  informalGroups: InformalGroup[]
  onUpload: (input: { file: File; name: string; uploadedBy: string; groupId?: number | null }) =>
    Promise<{ ok: boolean; assetId?: number; error?: string }>
  onDelete: (assetId: number) => Promise<void>
  onCreateGroup: (input: { name: string; createdBy: string }) => Promise<number | null>
  onRenameGroup: (groupId: number, name: string) => Promise<void>
  onDeleteGroup: (groupId: number) => Promise<void>
  onMoveAsset: (assetId: number, groupId: number | null) => Promise<void>
}

export function InformalCardsTab({
  role, currentVisitor, informalAssets, informalGroups,
  onUpload, onDelete, onCreateGroup, onRenameGroup, onDeleteGroup, onMoveAsset,
}: Props) {
  const admin = isAdminLike(role)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [uploadGroupId, setUploadGroupId] = useState<number | null>(null) // null = 미분류
  const [queue, setQueue] = useState<QueueItem[]>([])
  const [running, setRunning] = useState(false)
  const [preview, setPreview] = useState<InformalAsset | null>(null)
  const [confirmDelete, setConfirmDelete] = useState<InformalAsset | null>(null)
  const [confirmDeleteGroup, setConfirmDeleteGroup] = useState<InformalGroup | null>(null)
  const [collapsedGroups, setCollapsedGroups] = useState<Set<number | 'null'>>(new Set())
  const [moveTargetAsset, setMoveTargetAsset] = useState<InformalAsset | null>(null)

  // 그룹별 자료 그룹화
  const assetsByGroup = new Map<number | null, InformalAsset[]>()
  for (const asset of informalAssets) {
    const key = asset.groupId ?? null
    const list = assetsByGroup.get(key) ?? []
    list.push(asset)
    assetsByGroup.set(key, list)
  }

  const sortedGroups = [...informalGroups].sort((a, b) =>
    a.position - b.position || a.createdAt.localeCompare(b.createdAt),
  )
  const unassignedAssets = assetsByGroup.get(null) ?? []
  const totalAssets = informalAssets.length

  // ── 업로드 큐 ────────────────────────────────────────
  const makeId = () =>
    typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(36).slice(2)}`

  const handleFilesPick = (files: FileList | null) => {
    if (!files || files.length === 0) return
    const accepted: QueueItem[] = []
    const rejected: string[] = []
    Array.from(files).forEach((file) => {
      if (file.type && !file.type.startsWith('image/')) {
        rejected.push(`${file.name} (이미지 아님)`)
        return
      }
      if (file.size > MAX_ORIGINAL_SIZE_MB * 1024 * 1024) {
        rejected.push(`${file.name} (${MAX_ORIGINAL_SIZE_MB}MB 초과)`)
        return
      }
      const baseName = file.name.replace(/\.[^.]+$/, '').slice(0, 40)
      accepted.push({
        id: makeId(),
        originalFile: file,
        name: baseName || '비공식 증거 카드',
        status: 'pending',
        originalSize: file.size,
        finalSize: file.size,
      })
    })
    if (rejected.length > 0) {
      showToast(`일부 파일 거부됨:\n${rejected.join('\n')}`, 'error')
    }
    if (accepted.length > 0) {
      setQueue((prev) => [...prev, ...accepted])
    }
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  const updateQueueItem = (id: string, patch: Partial<QueueItem>) => {
    setQueue((prev) => prev.map((q) => (q.id === id ? { ...q, ...patch } : q)))
  }
  const removeQueueItem = (id: string) => {
    setQueue((prev) => prev.filter((q) => q.id !== id))
  }
  const clearDone = () => setQueue((prev) => prev.filter((q) => q.status !== 'done'))

  const handleUploadAll = async () => {
    const items = queue.filter((q) => q.status === 'pending' || q.status === 'error')
    if (items.length === 0) return
    setRunning(true)
    let okCount = 0
    let failCount = 0
    for (const item of items) {
      updateQueueItem(item.id, { status: 'compressing' })
      let compressed
      try {
        compressed = await compressImage(item.originalFile, {
          maxWidth: 1600,
          maxHeight: 1600,
          quality: 0.85,
          maxSizeMB: TARGET_SIZE_MB,
          outputType: 'image/jpeg',
        })
      } catch (e) {
        updateQueueItem(item.id, { status: 'error', error: e instanceof Error ? e.message : '압축 실패' })
        failCount += 1
        continue
      }
      updateQueueItem(item.id, {
        finalSize: compressed.finalSize,
        width: compressed.width,
        height: compressed.height,
        status: 'uploading',
      })
      const result = await onUpload({
        file: compressed.file,
        name: item.name.trim() || '비공식 증거 카드',
        uploadedBy: currentVisitor,
        groupId: uploadGroupId,
      })
      if (result.ok) {
        updateQueueItem(item.id, { status: 'done' })
        okCount += 1
      } else {
        updateQueueItem(item.id, { status: 'error', error: result.error ?? '업로드 실패' })
        failCount += 1
      }
    }
    setRunning(false)
    if (okCount > 0) showToast(`${okCount}개 자료를 등록했습니다`, 'success')
    if (failCount > 0) showToast(`${failCount}개 실패`, 'error')
  }

  // ── 그룹 액션 ────────────────────────────────────────
  const handleCreateGroup = async () => {
    const name = prompt('새 그룹 이름', '')
    if (!name || !name.trim()) return
    await onCreateGroup({ name: name.trim(), createdBy: currentVisitor })
  }

  const handleRenameGroup = async (group: InformalGroup) => {
    const next = prompt('그룹 이름 변경', group.name)
    if (!next || !next.trim() || next.trim() === group.name) return
    await onRenameGroup(group.id, next.trim())
  }

  const toggleGroup = (key: number | 'null') => {
    setCollapsedGroups((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  // ── 렌더 ────────────────────────────────────────────
  const renderGroupSection = (group: InformalGroup | null, assets: InformalAsset[]) => {
    const key: number | 'null' = group?.id ?? 'null'
    const isCollapsed = collapsedGroups.has(key)
    const title = group?.name ?? '미분류'
    const sorted = [...assets].sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    return (
      <section
        key={`group-${key}`}
        style={{
          marginBottom: 12, border: '1px solid #e5e7eb', borderRadius: 12,
          background: '#fff', overflow: 'hidden',
        }}
      >
        <div style={{
          display: 'flex', alignItems: 'center', gap: 8,
          padding: '10px 12px', borderBottom: isCollapsed ? 'none' : '1px solid #f1f5f9',
          background: '#f8fafc',
        }}>
          <button
            type="button"
            onClick={() => toggleGroup(key)}
            style={{
              flex: 1, display: 'flex', alignItems: 'center', gap: 8,
              background: 'none', border: 'none', padding: 0, cursor: 'pointer',
              textAlign: 'left',
            }}
          >
            <span style={{ fontSize: 14, color: '#64748b' }}>{isCollapsed ? '›' : '⌄'}</span>
            <strong style={{ fontSize: 14, fontWeight: 700, color: '#1e293b' }}>{title}</strong>
            <span style={{ fontSize: 12, fontWeight: 600, color: '#94a3b8' }}>{assets.length}</span>
          </button>
          {admin && group && (
            <>
              <button
                type="button"
                onClick={() => handleRenameGroup(group)}
                aria-label="이름 변경"
                style={{
                  background: 'none', border: 'none', padding: '4px 6px',
                  color: '#94a3b8', fontSize: 12, cursor: 'pointer',
                }}
              >이름</button>
              <button
                type="button"
                onClick={() => setConfirmDeleteGroup(group)}
                aria-label="삭제"
                style={{
                  background: 'none', border: 'none', padding: '4px 6px',
                  color: '#dc2626', fontSize: 12, cursor: 'pointer',
                }}
              >삭제</button>
            </>
          )}
        </div>
        {!isCollapsed && (
          <div style={{
            display: 'grid', gap: 8, padding: 10,
            gridTemplateColumns: 'repeat(auto-fill, minmax(110px, 1fr))',
          }}>
            {sorted.length === 0 ? (
              <p style={{
                gridColumn: '1 / -1', textAlign: 'center', padding: '12px 0',
                fontSize: 12, color: '#94a3b8',
              }}>
                자료 없음
              </p>
            ) : (
              sorted.map((asset) => (
                <div
                  key={asset.id}
                  style={{
                    position: 'relative', aspectRatio: '4 / 5', borderRadius: 10,
                    border: '1px solid #e5e7eb', overflow: 'hidden', background: '#fff',
                    cursor: 'pointer',
                  }}
                  onClick={() => setPreview(asset)}
                >
                  <img
                    src={asset.imageUrl}
                    alt={asset.name}
                    style={{ width: '100%', height: '70%', objectFit: 'cover', display: 'block' }}
                    loading="lazy"
                  />
                  <div style={{
                    padding: '5px 7px', fontSize: 10, fontWeight: 700,
                    color: '#1e293b', overflow: 'hidden', textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}>{asset.name}</div>
                  {admin && (
                    <>
                      <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); setMoveTargetAsset(asset) }}
                        aria-label="그룹 이동"
                        style={{
                          position: 'absolute', top: 4, left: 4,
                          width: 22, height: 22, borderRadius: 6, border: 'none',
                          background: 'rgba(15,23,42,0.55)', color: '#fff',
                          fontSize: 10, fontWeight: 800, cursor: 'pointer', padding: 0,
                        }}
                      >↔</button>
                      <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); setConfirmDelete(asset) }}
                        aria-label="삭제"
                        style={{
                          position: 'absolute', top: 4, right: 4,
                          width: 22, height: 22, borderRadius: 6, border: 'none',
                          background: 'rgba(15,23,42,0.55)', color: '#fff',
                          fontSize: 11, fontWeight: 800, cursor: 'pointer', padding: 0,
                        }}
                      >✕</button>
                    </>
                  )}
                </div>
              ))
            )}
          </div>
        )}
      </section>
    )
  }

  return (
    <div>
      {/* 상단 액션 + 자료 카운트 */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        marginBottom: 12,
      }}>
        <p style={{ margin: 0, fontSize: 13, fontWeight: 700, color: '#64748b' }}>
          전체 {totalAssets}개 · 그룹 {informalGroups.length}
        </p>
        {admin && (
          <div style={{ display: 'flex', gap: 6 }}>
            <button
              type="button"
              onClick={handleCreateGroup}
              style={{
                padding: '7px 10px', borderRadius: 9, border: '1px solid #e5e7eb',
                background: '#fff', color: '#475569', fontSize: 12, fontWeight: 700,
                cursor: 'pointer',
              }}
            >+ 그룹</button>
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={running}
              style={{
                padding: '7px 12px', borderRadius: 9, border: '1px solid #c4b5fd',
                background: '#f5f3ff', color: '#6d28d9', fontSize: 12, fontWeight: 800,
                cursor: running ? 'wait' : 'pointer',
              }}
            >+ 자료 추가</button>
          </div>
        )}
      </div>

      {/* 업로드 input + 대상 그룹 선택 + 큐 */}
      {admin && (
        <>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            multiple
            onChange={(e) => handleFilesPick(e.target.files)}
            disabled={running}
            style={{ display: 'none' }}
          />
          {queue.length > 0 && (
            <div style={{
              padding: 12, marginBottom: 12, borderRadius: 12,
              background: '#fafafa', border: '1px solid #e5e7eb',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                <label style={{ fontSize: 12, fontWeight: 700, color: '#475569' }}>
                  대상 그룹
                </label>
                <select
                  value={uploadGroupId ?? ''}
                  onChange={(e) => setUploadGroupId(e.target.value ? Number(e.target.value) : null)}
                  disabled={running}
                  style={{
                    flex: 1, padding: '6px 8px', borderRadius: 8,
                    border: '1px solid #d8dbe0', fontSize: 13,
                  }}
                >
                  <option value="">미분류</option>
                  {sortedGroups.map((g) => (
                    <option key={g.id} value={g.id}>{g.name}</option>
                  ))}
                </select>
              </div>

              <div style={{
                maxHeight: 240, overflowY: 'auto',
                border: '1px solid #e5e7eb', borderRadius: 10, marginBottom: 10,
                background: '#fff',
              }}>
                {queue.map((item) => (
                  <div
                    key={item.id}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 8,
                      padding: '8px 10px', borderBottom: '1px solid #f1f5f9',
                    }}
                  >
                    <span style={{ fontSize: 14 }}>
                      {item.status === 'pending' && '⏳'}
                      {item.status === 'compressing' && '🌀'}
                      {item.status === 'uploading' && '⬆️'}
                      {item.status === 'done' && '✅'}
                      {item.status === 'error' && '❌'}
                    </span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      {item.status === 'pending' || item.status === 'error' ? (
                        <input
                          type="text"
                          value={item.name}
                          onChange={(e) => updateQueueItem(item.id, { name: e.target.value })}
                          maxLength={50}
                          disabled={running}
                          style={{
                            width: '100%', padding: '4px 6px', borderRadius: 6,
                            border: '1px solid #e5e7eb', fontSize: 12, fontWeight: 600,
                          }}
                        />
                      ) : (
                        <p style={{
                          margin: 0, fontSize: 12, fontWeight: 700, color: '#1e293b',
                          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                        }}>{item.name}</p>
                      )}
                      <p style={{
                        margin: '2px 0 0', fontSize: 10, color: '#94a3b8',
                        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                      }}>
                        {item.status === 'done' || item.status === 'uploading'
                          ? `${Math.round(item.originalSize / 1024).toLocaleString()} KB → ${Math.round(item.finalSize / 1024).toLocaleString()} KB`
                          : item.status === 'error'
                            ? item.error ?? '실패'
                            : `${Math.round(item.originalSize / 1024).toLocaleString()} KB · ${item.originalFile.name}`}
                      </p>
                    </div>
                    {(item.status === 'pending' || item.status === 'error' || item.status === 'done') && !running && (
                      <button
                        type="button"
                        onClick={() => removeQueueItem(item.id)}
                        aria-label="제거"
                        style={{
                          background: 'none', border: 'none', color: '#94a3b8',
                          fontSize: 14, cursor: 'pointer', padding: 4,
                        }}
                      >✕</button>
                    )}
                  </div>
                ))}
              </div>

              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                {queue.some((q) => q.status === 'done') && !running && (
                  <button
                    type="button"
                    onClick={clearDone}
                    style={{
                      fontSize: 12, color: '#64748b',
                      background: 'none', border: 'none', cursor: 'pointer',
                    }}
                  >완료 항목 비우기</button>
                )}
                <button
                  type="button"
                  onClick={handleUploadAll}
                  disabled={running || queue.filter((q) => q.status === 'pending' || q.status === 'error').length === 0}
                  style={{
                    marginLeft: 'auto', padding: '8px 14px', borderRadius: 10,
                    border: 'none', background: '#7c3aed', color: '#fff',
                    fontSize: 13, fontWeight: 800,
                    cursor: running ? 'wait' : 'pointer',
                    opacity: running ? 0.6 : 1,
                  }}
                >
                  {running
                    ? '진행 중...'
                    : `${queue.filter((q) => q.status === 'pending' || q.status === 'error').length}개 업로드`}
                </button>
              </div>
            </div>
          )}
        </>
      )}

      {/* 그룹 섹션들 (그룹 → 미분류 순) */}
      {sortedGroups.map((g) => renderGroupSection(g, assetsByGroup.get(g.id) ?? []))}
      {(unassignedAssets.length > 0 || sortedGroups.length === 0) && renderGroupSection(null, unassignedAssets)}

      {/* 빈 상태 */}
      {totalAssets === 0 && (
        <p style={{
          padding: '40px 16px', textAlign: 'center', fontSize: 13,
          color: '#94a3b8', fontWeight: 600,
        }}>
          {admin
            ? '아직 등록된 비공식 자료가 없습니다.\n위 + 자료 추가로 시작하세요.'
            : '관리자가 자료를 등록하면 여기에 표시됩니다.'}
        </p>
      )}

      {/* 미리보기 */}
      {preview && (
        <div
          onClick={() => setPreview(null)}
          style={{
            position: 'fixed', inset: 0, zIndex: 300,
            background: 'rgba(0,0,0,0.85)',
            display: 'grid', placeItems: 'center', padding: 20,
            cursor: 'zoom-out',
          }}
        >
          <img
            src={preview.imageUrl}
            alt={preview.name}
            style={{
              maxWidth: '100%', maxHeight: '90vh',
              borderRadius: 12, boxShadow: '0 20px 60px rgba(0,0,0,0.6)',
            }}
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}

      {/* 자료 삭제 확인 */}
      {confirmDelete && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 310,
          background: 'rgba(15,23,42,0.55)',
          display: 'grid', placeItems: 'center', padding: 20,
        }} onClick={() => setConfirmDelete(null)}>
          <div style={{
            background: '#fff', borderRadius: 16, padding: 22,
            width: '100%', maxWidth: 320, textAlign: 'center',
          }} onClick={(e) => e.stopPropagation()}>
            <p style={{ margin: 0, fontSize: 15, fontWeight: 700, color: '#1e293b' }}>
              자료를 삭제하시겠어요?
            </p>
            <p style={{ margin: '6px 0 16px', fontSize: 13, color: '#64748b' }}>
              "{confirmDelete.name}"
            </p>
            <div style={{ display: 'flex', gap: 8 }}>
              <button
                type="button"
                onClick={() => setConfirmDelete(null)}
                style={{
                  flex: 1, padding: '10px', borderRadius: 10,
                  border: '1px solid #e2e8f0', background: '#fff',
                  color: '#475569', fontSize: 14, fontWeight: 700, cursor: 'pointer',
                }}
              >취소</button>
              <button
                type="button"
                onClick={async () => {
                  await onDelete(confirmDelete.id)
                  setConfirmDelete(null)
                }}
                style={{
                  flex: 1, padding: '10px', borderRadius: 10,
                  border: 'none', background: '#dc2626', color: '#fff',
                  fontSize: 14, fontWeight: 800, cursor: 'pointer',
                }}
              >삭제</button>
            </div>
          </div>
        </div>
      )}

      {/* 그룹 삭제 확인 */}
      {confirmDeleteGroup && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 310,
          background: 'rgba(15,23,42,0.55)',
          display: 'grid', placeItems: 'center', padding: 20,
        }} onClick={() => setConfirmDeleteGroup(null)}>
          <div style={{
            background: '#fff', borderRadius: 16, padding: 22,
            width: '100%', maxWidth: 320, textAlign: 'center',
          }} onClick={(e) => e.stopPropagation()}>
            <p style={{ margin: 0, fontSize: 15, fontWeight: 700, color: '#1e293b' }}>
              그룹을 삭제하시겠어요?
            </p>
            <p style={{ margin: '6px 0 16px', fontSize: 13, color: '#64748b', lineHeight: 1.5 }}>
              "{confirmDeleteGroup.name}"<br />
              <span style={{ fontSize: 12, color: '#92400e' }}>
                그룹 안의 자료는 "미분류" 로 이동됩니다.
              </span>
            </p>
            <div style={{ display: 'flex', gap: 8 }}>
              <button
                type="button"
                onClick={() => setConfirmDeleteGroup(null)}
                style={{
                  flex: 1, padding: '10px', borderRadius: 10,
                  border: '1px solid #e2e8f0', background: '#fff',
                  color: '#475569', fontSize: 14, fontWeight: 700, cursor: 'pointer',
                }}
              >취소</button>
              <button
                type="button"
                onClick={async () => {
                  await onDeleteGroup(confirmDeleteGroup.id)
                  setConfirmDeleteGroup(null)
                }}
                style={{
                  flex: 1, padding: '10px', borderRadius: 10,
                  border: 'none', background: '#dc2626', color: '#fff',
                  fontSize: 14, fontWeight: 800, cursor: 'pointer',
                }}
              >삭제</button>
            </div>
          </div>
        </div>
      )}

      {/* 자료 → 그룹 이동 */}
      {moveTargetAsset && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 310,
          background: 'rgba(15,23,42,0.55)',
          display: 'flex', alignItems: 'flex-end',
        }} onClick={() => setMoveTargetAsset(null)}>
          <div style={{
            background: '#fff', borderTopLeftRadius: 18, borderTopRightRadius: 18,
            width: '100%', maxHeight: '70vh', overflowY: 'auto',
          }} onClick={(e) => e.stopPropagation()}>
            <div style={{
              padding: '14px 16px', borderBottom: '1px solid #e2e8f0',
              fontSize: 14, fontWeight: 800, color: '#1e293b',
            }}>
              "{moveTargetAsset.name}" 그룹 이동
            </div>
            <button
              type="button"
              onClick={async () => {
                await onMoveAsset(moveTargetAsset.id, null)
                setMoveTargetAsset(null)
              }}
              style={{
                width: '100%', padding: '14px 16px', textAlign: 'left',
                border: 'none', background: '#fff', borderBottom: '1px solid #f1f5f9',
                fontSize: 14, fontWeight: 600, color: '#1e293b', cursor: 'pointer',
              }}
            >
              미분류
              {moveTargetAsset.groupId === null && (
                <span style={{ marginLeft: 8, color: '#7c3aed' }}>✓</span>
              )}
            </button>
            {sortedGroups.map((g) => (
              <button
                key={g.id}
                type="button"
                onClick={async () => {
                  await onMoveAsset(moveTargetAsset.id, g.id)
                  setMoveTargetAsset(null)
                }}
                style={{
                  width: '100%', padding: '14px 16px', textAlign: 'left',
                  border: 'none', background: '#fff', borderBottom: '1px solid #f1f5f9',
                  fontSize: 14, fontWeight: 600, color: '#1e293b', cursor: 'pointer',
                }}
              >
                {g.name}
                {moveTargetAsset.groupId === g.id && (
                  <span style={{ marginLeft: 8, color: '#7c3aed' }}>✓</span>
                )}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
