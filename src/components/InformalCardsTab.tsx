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
  // ⋮ 메뉴 / 선택 모드
  const [openGroupMenu, setOpenGroupMenu] = useState<number | 'null' | null>(null)
  const [selectionGroup, setSelectionGroup] = useState<number | 'null' | null>(null)
  const [selectedAssetIds, setSelectedAssetIds] = useState<Set<number>>(new Set())
  const [bulkMoveOpen, setBulkMoveOpen] = useState(false)
  const [bulkDeleteConfirm, setBulkDeleteConfirm] = useState(false)

  const toggleSelect = (id: number) => {
    setSelectedAssetIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }
  const clearSelection = () => {
    setSelectionGroup(null)
    setSelectedAssetIds(new Set())
  }
  const enterSelection = (key: number | 'null') => {
    setSelectionGroup(key)
    setSelectedAssetIds(new Set())
    setOpenGroupMenu(null)
  }

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
      <section key={`group-${key}`}>
        {/* 그룹 헤더 (디자인 05: chev + 제목 + 카운트) */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 8,
          padding: '0 4px', justifyContent: 'space-between',
          marginBottom: 10,
        }}>
          <button
            type="button"
            onClick={() => toggleGroup(key)}
            style={{
              flex: 1, display: 'flex', alignItems: 'center', gap: 8,
              background: 'none', border: 'none', padding: 0, cursor: 'pointer',
              textAlign: 'left', minHeight: 0,
            }}
          >
            <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" style={{ color: 'var(--text)', transform: isCollapsed ? 'rotate(-90deg)' : 'rotate(0deg)', transition: 'transform 0.15s' }}>
              <polyline points="6 9 12 15 18 9" />
            </svg>
            <span style={{ fontSize: 15, fontWeight: 600, color: 'var(--ink)' }}>{title}</span>
            <span style={{ fontSize: 12, color: 'var(--muted)', fontVariantNumeric: 'tabular-nums' }}>{assets.length}</span>
          </button>
          {admin && (
            <div style={{ position: 'relative', display: 'flex', alignItems: 'center', gap: 4 }}>
              {/* 선택 모드 진입 중이면 "취소" 버튼 */}
              {selectionGroup === key ? (
                <button
                  type="button"
                  onClick={clearSelection}
                  style={{
                    height: 28, minHeight: 28, padding: '0 10px',
                    background: 'transparent', border: 'none',
                    color: 'var(--muted)', fontSize: 12, fontWeight: 600,
                    cursor: 'pointer', borderRadius: 6,
                  }}
                >취소</button>
              ) : (
                <>
                  <button
                    type="button"
                    onClick={() => setOpenGroupMenu(openGroupMenu === key ? null : key)}
                    aria-label="더보기"
                    style={{
                      width: 28, height: 28, minHeight: 28,
                      display: 'grid', placeItems: 'center',
                      background: 'transparent', border: 'none',
                      color: 'var(--text)', cursor: 'pointer', borderRadius: 6,
                    }}
                  >
                    <svg width={14} height={14} viewBox="0 0 24 24" fill="currentColor" aria-hidden>
                      <circle cx="12" cy="5" r="1.5" />
                      <circle cx="12" cy="12" r="1.5" />
                      <circle cx="12" cy="19" r="1.5" />
                    </svg>
                  </button>
                  {openGroupMenu === key && (
                    <>
                      <div
                        onClick={() => setOpenGroupMenu(null)}
                        style={{ position: 'fixed', inset: 0, zIndex: 30 }}
                      />
                      <div
                        style={{
                          position: 'absolute', top: '100%', right: 0,
                          marginTop: 4, zIndex: 31,
                          background: 'var(--surface)',
                          border: '1px solid var(--line)',
                          borderRadius: 8,
                          boxShadow: '0 4px 12px rgba(0,0,0,0.08)',
                          minWidth: 140,
                          padding: 4,
                        }}
                      >
                        <button
                          type="button"
                          onClick={() => { setOpenGroupMenu(null); enterSelection(key) }}
                          disabled={assets.length === 0}
                          style={{
                            width: '100%', textAlign: 'left',
                            padding: '8px 10px', minHeight: 0,
                            background: 'transparent', border: 'none',
                            fontSize: 13, color: assets.length === 0 ? 'var(--muted-2)' : 'var(--text)',
                            cursor: assets.length === 0 ? 'not-allowed' : 'pointer', borderRadius: 6,
                          }}
                        >
                          선택
                        </button>
                        {group && (
                          <>
                            <button
                              type="button"
                              onClick={() => { setOpenGroupMenu(null); handleRenameGroup(group) }}
                              style={{
                                width: '100%', textAlign: 'left',
                                padding: '8px 10px', minHeight: 0,
                                background: 'transparent', border: 'none',
                                fontSize: 13, color: 'var(--text)',
                                cursor: 'pointer', borderRadius: 6,
                              }}
                            >
                              이름 변경
                            </button>
                            <button
                              type="button"
                              onClick={() => { setOpenGroupMenu(null); setConfirmDeleteGroup(group) }}
                              style={{
                                width: '100%', textAlign: 'left',
                                padding: '8px 10px', minHeight: 0,
                                background: 'transparent', border: 'none',
                                fontSize: 13, color: 'var(--status-danger)',
                                cursor: 'pointer', borderRadius: 6,
                              }}
                            >
                              그룹 삭제
                            </button>
                          </>
                        )}
                      </div>
                    </>
                  )}
                </>
              )}
            </div>
          )}
        </div>
        {!isCollapsed && (
          <div style={{
            display: 'grid', gap: 10,
            gridTemplateColumns: 'repeat(2, 1fr)',
            marginBottom: 14,
          }}>
            {sorted.length === 0 ? (
              <p style={{
                gridColumn: '1 / -1', textAlign: 'center', padding: '20px 0',
                fontSize: 13, color: 'var(--muted)',
                background: 'var(--surface)', border: '1px dashed var(--line-2)',
                borderRadius: 12, margin: 0,
              }}>
                자료 없음
              </p>
            ) : (
              sorted.map((asset) => {
                const isSelectionMode = selectionGroup === key
                const isSelected = selectedAssetIds.has(asset.id)
                return (
                  <div
                    key={asset.id}
                    style={{
                      display: 'flex', flexDirection: 'column', gap: 6,
                    }}
                  >
                    <div
                      style={{
                        position: 'relative', aspectRatio: '4 / 3', borderRadius: 10,
                        border: isSelected ? '2px solid var(--ink)' : '1px solid var(--line)',
                        overflow: 'hidden', background: 'var(--paper)',
                        cursor: 'pointer',
                      }}
                      onClick={() => {
                        if (isSelectionMode) toggleSelect(asset.id)
                        else setPreview(asset)
                      }}
                    >
                      <img
                        src={asset.imageUrl}
                        alt={asset.name}
                        style={{
                          width: '100%', height: '100%', objectFit: 'cover', display: 'block',
                          opacity: isSelectionMode && !isSelected ? 0.6 : 1,
                          transition: 'opacity 0.15s',
                        }}
                        loading="lazy"
                      />
                      {isSelectionMode && (
                        <span
                          aria-hidden
                          style={{
                            position: 'absolute', top: 6, right: 6,
                            width: 22, height: 22, borderRadius: 6,
                            background: isSelected ? 'var(--ink)' : 'rgba(255,255,255,0.85)',
                            border: isSelected ? 'none' : '1.5px solid var(--line-2)',
                            display: 'grid', placeItems: 'center',
                            color: '#fff',
                          }}
                        >
                          {isSelected && (
                            <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round">
                              <polyline points="5 13 10 18 19 8" />
                            </svg>
                          )}
                        </span>
                      )}
                    </div>
                    <div style={{
                      padding: '0 2px', fontSize: 13, fontWeight: 600,
                      color: 'var(--ink)', overflow: 'hidden', textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}>{asset.name}</div>
                  </div>
                )
              })
            )}
          </div>
        )}
      </section>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* 상단 액션 + 자료 카운트 */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '0 4px',
      }}>
        <span style={{ fontSize: 13, color: 'var(--muted)' }}>
          전체 {totalAssets}개 · 그룹 {informalGroups.length}
        </span>
        {admin && (
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={running}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 4,
              height: 32, minHeight: 32, padding: '0 12px',
              borderRadius: 8, border: 'none',
              background: running ? 'var(--tint)' : 'var(--ink)',
              color: running ? 'var(--muted-2)' : '#fff',
              fontSize: 13, fontWeight: 600,
              cursor: running ? 'wait' : 'pointer',
              letterSpacing: '-0.005em',
            }}
          >+ 자료 추가</button>
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

      {/* + 그룹 추가 (admin 만, 디자인 05 의 dashed ghost) */}
      {admin && (
        <button
          type="button"
          onClick={handleCreateGroup}
          style={{
            padding: '14px',
            border: '1px dashed var(--line-2)',
            background: 'transparent',
            color: 'var(--muted)',
            borderRadius: 12,
            display: 'flex', gap: 8, alignItems: 'center', justifyContent: 'center',
            font: 'inherit', fontSize: 13, fontWeight: 500,
            cursor: 'pointer', minHeight: 0, width: '100%',
          }}
        >
          + 그룹 추가
        </button>
      )}

      {/* 빈 상태 */}
      {totalAssets === 0 && (
        <div style={{
          padding: '40px 16px', textAlign: 'center', fontSize: 13,
          color: 'var(--muted)', lineHeight: 1.6,
          background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 12,
        }}>
          {admin
            ? <>아직 등록된 비공식 자료가 없습니다.<br />위 + 자료 추가로 시작하세요.</>
            : <>관리자가 자료를 등록하면 여기에 표시됩니다.</>}
        </div>
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
                  <span style={{ marginLeft: 8, color: 'var(--ink)' }}>✓</span>
                )}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* ── 선택 모드 sticky 하단 액션 바 ─────────── */}
      {selectionGroup !== null && (
        <div
          style={{
            position: 'fixed', left: 0, right: 0, bottom: 0, zIndex: 150,
            padding: '12px 16px max(14px, env(safe-area-inset-bottom))',
            background: 'var(--bg)',
            borderTop: '1px solid var(--line)',
            display: 'flex', alignItems: 'center', gap: 8,
            boxShadow: '0 -8px 24px rgba(0,0,0,0.06)',
          }}
        >
          <span style={{ flex: 1, fontSize: 13, fontWeight: 600, color: 'var(--ink)' }}>
            {selectedAssetIds.size > 0 ? `${selectedAssetIds.size}개 선택` : '자료를 선택하세요'}
          </span>
          <button
            type="button"
            onClick={() => setBulkMoveOpen(true)}
            disabled={selectedAssetIds.size === 0}
            style={{
              height: 40, minHeight: 40, padding: '0 14px',
              border: '1px solid var(--line-2)', background: 'var(--surface)',
              color: 'var(--text)', borderRadius: 8,
              fontSize: 13, fontWeight: 600,
              cursor: selectedAssetIds.size === 0 ? 'not-allowed' : 'pointer',
              opacity: selectedAssetIds.size === 0 ? 0.5 : 1,
            }}
          >
            그룹 이동
          </button>
          <button
            type="button"
            onClick={() => setBulkDeleteConfirm(true)}
            disabled={selectedAssetIds.size === 0}
            style={{
              height: 40, minHeight: 40, padding: '0 14px',
              border: 'none', background: 'var(--status-danger)',
              color: '#fff', borderRadius: 8,
              fontSize: 13, fontWeight: 600,
              cursor: selectedAssetIds.size === 0 ? 'not-allowed' : 'pointer',
              opacity: selectedAssetIds.size === 0 ? 0.5 : 1,
            }}
          >
            삭제
          </button>
        </div>
      )}

      {/* ── 일괄 이동 시트 (그룹 선택) ──────────── */}
      {bulkMoveOpen && (
        <div
          onClick={() => setBulkMoveOpen(false)}
          style={{
            position: 'fixed', inset: 0, zIndex: 200,
            background: 'rgba(26,26,24,0.34)',
            display: 'flex', flexDirection: 'column', justifyContent: 'flex-end',
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              background: 'var(--bg)',
              borderTopLeftRadius: 18, borderTopRightRadius: 18,
              padding: '8px 16px max(18px, env(safe-area-inset-bottom))',
              maxHeight: '70vh',
              display: 'flex', flexDirection: 'column',
            }}
          >
            <div style={{ width: 32, height: 4, borderRadius: 99, background: 'var(--line-2)', margin: '4px auto 14px' }} />
            <div style={{ marginBottom: 12 }}>
              <span style={{ fontSize: 18, fontWeight: 700, color: 'var(--ink)' }}>그룹으로 이동</span>
              <p style={{ margin: '4px 0 0', fontSize: 13, color: 'var(--muted)' }}>
                {selectedAssetIds.size}개 자료를 이동할 그룹을 고르세요
              </p>
            </div>
            <div style={{ overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 6 }}>
              <button
                type="button"
                onClick={async () => {
                  const ids = Array.from(selectedAssetIds)
                  await Promise.all(ids.map((id) => onMoveAsset(id, null)))
                  setBulkMoveOpen(false)
                  clearSelection()
                  showToast(`${ids.length}개 자료를 미분류로 이동했습니다`, 'success')
                }}
                style={{
                  width: '100%', textAlign: 'left',
                  padding: '14px 16px', minHeight: 0,
                  background: 'var(--surface)', border: '1px solid var(--line)',
                  borderRadius: 10, fontSize: 14, fontWeight: 600,
                  color: 'var(--text)', cursor: 'pointer',
                }}
              >
                미분류
              </button>
              {sortedGroups.map((g) => (
                <button
                  key={g.id}
                  type="button"
                  onClick={async () => {
                    const ids = Array.from(selectedAssetIds)
                    await Promise.all(ids.map((id) => onMoveAsset(id, g.id)))
                    setBulkMoveOpen(false)
                    clearSelection()
                    showToast(`${ids.length}개 자료를 "${g.name}" 으로 이동했습니다`, 'success')
                  }}
                  style={{
                    width: '100%', textAlign: 'left',
                    padding: '14px 16px', minHeight: 0,
                    background: 'var(--surface)', border: '1px solid var(--line)',
                    borderRadius: 10, fontSize: 14, fontWeight: 600,
                    color: 'var(--ink)', cursor: 'pointer',
                  }}
                >
                  {g.name}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ── 일괄 삭제 confirm ───────────────────── */}
      {bulkDeleteConfirm && (
        <div
          onClick={() => setBulkDeleteConfirm(false)}
          style={{
            position: 'fixed', inset: 0, zIndex: 200,
            background: 'rgba(26,26,24,0.4)',
            display: 'grid', placeItems: 'center', padding: 20,
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              background: 'var(--surface)', borderRadius: 14,
              padding: '20px 20px 16px', maxWidth: 320, width: '100%',
              boxShadow: '0 12px 40px rgba(0,0,0,0.18)',
            }}
          >
            <p style={{ margin: '0 0 6px', fontSize: 16, fontWeight: 700, color: 'var(--ink)' }}>
              {selectedAssetIds.size}개 자료를 삭제할까요?
            </p>
            <p style={{ margin: '0 0 16px', fontSize: 13, color: 'var(--muted)', lineHeight: 1.5 }}>
              삭제한 자료는 되돌릴 수 없습니다.
            </p>
            <div style={{ display: 'flex', gap: 8 }}>
              <button
                type="button"
                onClick={() => setBulkDeleteConfirm(false)}
                style={{
                  flex: 1, height: 40, minHeight: 40, border: '1px solid var(--line-2)',
                  background: 'var(--surface)', color: 'var(--text)',
                  borderRadius: 8, fontSize: 14, fontWeight: 600, cursor: 'pointer',
                }}
              >취소</button>
              <button
                type="button"
                onClick={async () => {
                  const ids = Array.from(selectedAssetIds)
                  setBulkDeleteConfirm(false)
                  await Promise.all(ids.map((id) => onDelete(id)))
                  clearSelection()
                  showToast(`${ids.length}개 자료를 삭제했습니다`, 'success')
                }}
                style={{
                  flex: 1, height: 40, minHeight: 40, border: 'none',
                  background: 'var(--status-danger)', color: '#fff',
                  borderRadius: 8, fontSize: 14, fontWeight: 600, cursor: 'pointer',
                }}
              >삭제</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
