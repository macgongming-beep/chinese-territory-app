// 비공식 증거 자료 관리 (관리자/개발자 전용)
// 설정 페이지에 임베드 — 이미지 업로드 + 자료 목록 + 삭제
import { useRef, useState } from 'react'
import type { InformalAsset, Role } from '../types'
import { showToast } from '../lib/toast'
import { compressImage } from '../lib/imageCompress'

const MAX_ORIGINAL_SIZE_MB = 30  // 압축 전 허용 최대 (원본이 너무 크면 메모리 부담)
const TARGET_SIZE_MB = 0.5       // Phase 5: 1.5MB → 0.5MB (대역폭 절감)

type QueueStatus = 'pending' | 'compressing' | 'uploading' | 'done' | 'error'
type QueueItem = {
  id: string
  originalFile: File
  name: string             // 사용자가 수정 가능한 자료 이름
  status: QueueStatus
  originalSize: number
  finalSize: number
  width?: number
  height?: number
  error?: string
}

function isAdminLike(role: Role | undefined | null): boolean {
  return role === 'admin' || role === 'developer'
}

type Props = {
  role: Role
  currentVisitor: string
  informalAssets: InformalAsset[]
  onUpload: (input: { file: File; name: string; uploadedBy: string }) =>
    Promise<{ ok: boolean; assetId?: number; error?: string }>
  onDelete: (assetId: number) => Promise<void>
}

export function InformalAssetsManager({
  role, currentVisitor, informalAssets, onUpload, onDelete,
}: Props) {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [showForm, setShowForm] = useState(false)
  const [queue, setQueue] = useState<QueueItem[]>([])
  const [running, setRunning] = useState(false)
  const [preview, setPreview] = useState<InformalAsset | null>(null)
  const [confirmDelete, setConfirmDelete] = useState<InformalAsset | null>(null)

  const admin = isAdminLike(role)
  const sorted = [...informalAssets].sort((a, b) => b.createdAt.localeCompare(a.createdAt))

  if (!admin) {
    // 관리자가 아닌 경우 컴포넌트 자체 숨김 (안전망 — 호출부에서도 가드)
    return null
  }

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

  const handleUploadAll = async () => {
    const items = queue.filter((q) => q.status === 'pending' || q.status === 'error')
    if (items.length === 0) return
    setRunning(true)
    let okCount = 0
    let failCount = 0
    for (const item of items) {
      // 압축
      updateQueueItem(item.id, { status: 'compressing' })
      let compressed
      try {
        compressed = await compressImage(item.originalFile, {
          maxWidth: 1200,       // 1600→1200 (Phase 5)
          maxHeight: 1200,
          quality: 0.82,
          maxSizeMB: TARGET_SIZE_MB,
          outputType: 'image/webp',  // JPEG→WebP (30~40% 더 작음)
        })
      } catch (e) {
        const msg = e instanceof Error ? e.message : '압축 실패'
        updateQueueItem(item.id, { status: 'error', error: msg })
        failCount += 1
        continue
      }
      updateQueueItem(item.id, {
        finalSize: compressed.finalSize,
        width: compressed.width,
        height: compressed.height,
        status: 'uploading',
      })
      // 업로드
      const result = await onUpload({
        file: compressed.file,
        name: item.name.trim() || '비공식 증거 카드',
        uploadedBy: currentVisitor,
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

  const clearDone = () => {
    setQueue((prev) => prev.filter((q) => q.status !== 'done'))
  }

  const resetForm = () => {
    setQueue([])
    setShowForm(false)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  const handleDelete = async () => {
    if (!confirmDelete) return
    await onDelete(confirmDelete.id)
    setConfirmDelete(null)
  }

  return (
    <div style={{
      background: '#fff', borderRadius: 18, padding: 18,
      border: '1px solid #e5e7eb', boxShadow: '0 1px 2px rgba(16,24,40,0.04)',
    }}>
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        marginBottom: 14,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{
            display: 'grid', width: 38, height: 38, placeItems: 'center',
            borderRadius: 12, background: '#f5f3ff', color: '#7c3aed',
          }}>
            <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
              <polyline points="14 2 14 8 20 8" />
              <line x1="16" y1="13" x2="8" y2="13" />
              <line x1="16" y1="17" x2="8" y2="17" />
              <line x1="10" y1="9" x2="8" y2="9" />
            </svg>
          </span>
          <div>
            <h3 style={{ margin: 0, fontSize: 15, fontWeight: 800, color: '#111827', lineHeight: 1.25 }}>
              비공식 증거 카드
            </h3>
            <p style={{ margin: '3px 0 0', fontSize: 12, fontWeight: 600, color: '#6b7280' }}>
              인도자가 봉사자에게 배정할 수 있는 자료
            </p>
          </div>
        </div>
        {!showForm && (
          <button
            type="button"
            onClick={() => setShowForm(true)}
            style={{
              padding: '8px 12px', borderRadius: 10, border: '1px solid #c4b5fd',
              background: '#f5f3ff', color: '#6d28d9', fontSize: 13, fontWeight: 800,
              cursor: 'pointer',
            }}
          >
            + 자료 추가
          </button>
        )}
      </div>

      {/* 업로드 폼 (multi-file 큐) */}
      {showForm && (
        <div style={{
          padding: 14, marginBottom: 14, borderRadius: 12,
          background: '#fafafa', border: '1px solid #e5e7eb',
        }}>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            multiple
            onChange={(e) => handleFilesPick(e.target.files)}
            disabled={running}
            style={{ display: 'none' }}
          />
          {/* 드래그 앤 드롭 + 클릭 영역 */}
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            onDragOver={(e) => {
              e.preventDefault()
              e.currentTarget.style.background = '#ede9fe'
              e.currentTarget.style.borderColor = '#7c3aed'
            }}
            onDragLeave={(e) => {
              e.currentTarget.style.background = '#fff'
              e.currentTarget.style.borderColor = '#c4b5fd'
            }}
            onDrop={(e) => {
              e.preventDefault()
              e.currentTarget.style.background = '#fff'
              e.currentTarget.style.borderColor = '#c4b5fd'
              handleFilesPick(e.dataTransfer.files)
            }}
            disabled={running}
            style={{
              display: 'block', width: '100%',
              padding: '22px 16px', marginBottom: 10,
              border: '2px dashed #c4b5fd', borderRadius: 12,
              background: '#fff', color: '#6d28d9',
              fontSize: 13, fontWeight: 700, cursor: running ? 'wait' : 'pointer',
              textAlign: 'center',
            }}
          >
            <div style={{ fontSize: 24, marginBottom: 6 }}>📁</div>
            <div>여기를 누르거나 파일을 끌어다 놓기</div>
            <div style={{ marginTop: 4, fontSize: 11, fontWeight: 500, color: '#94a3b8', lineHeight: 1.4 }}>
              여러 장 동시 선택 가능<br />
              (Mac: Shift/Cmd+클릭 · Win: Shift/Ctrl+클릭)
            </div>
          </button>
          <p style={{ margin: '0 0 10px', fontSize: 11, color: '#94a3b8' }}>
            자동 압축 (가로 1600px / ~1.5MB)
          </p>

          {queue.length > 0 && (
            <div style={{
              maxHeight: 280, overflowY: 'auto',
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
                  <span style={{ fontSize: 14, flexShrink: 0 }}>
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
          )}

          {queue.some((q) => q.status === 'done') && !running && (
            <button
              type="button"
              onClick={clearDone}
              style={{
                marginBottom: 10, fontSize: 12, color: '#64748b',
                background: 'none', border: 'none', cursor: 'pointer',
              }}
            >
              완료된 항목 비우기
            </button>
          )}

          <div style={{ display: 'flex', gap: 8 }}>
            <button
              type="button"
              onClick={resetForm}
              disabled={running}
              style={{
                flex: 1, padding: '10px', borderRadius: 10,
                border: '1px solid #d8dbe0', background: '#fff', color: '#4b5563',
                fontSize: 13, fontWeight: 700, cursor: running ? 'wait' : 'pointer',
              }}
            >
              닫기
            </button>
            <button
              type="button"
              onClick={handleUploadAll}
              disabled={running || queue.filter((q) => q.status === 'pending' || q.status === 'error').length === 0}
              style={{
                flex: 2, padding: '10px', borderRadius: 10,
                border: 'none', background: '#7c3aed', color: '#fff',
                fontSize: 13, fontWeight: 800,
                cursor: running ? 'wait' : 'pointer',
                opacity: running || queue.filter((q) => q.status === 'pending' || q.status === 'error').length === 0 ? 0.6 : 1,
              }}
            >
              {running
                ? '진행 중...'
                : `${queue.filter((q) => q.status === 'pending' || q.status === 'error').length}개 업로드`}
            </button>
          </div>
        </div>
      )}

      {/* 자료 목록 */}
      {sorted.length === 0 ? (
        <p style={{
          padding: '24px 0', textAlign: 'center', fontSize: 13,
          color: '#94a3b8', fontWeight: 600, margin: 0,
        }}>
          아직 등록된 자료가 없습니다.
        </p>
      ) : (
        <div style={{
          display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))',
          gap: 10,
        }}>
          {sorted.map((asset) => (
            <div
              key={asset.id}
              style={{
                position: 'relative',
                aspectRatio: '4 / 5',
                borderRadius: 12,
                border: '1px solid #e5e7eb',
                overflow: 'hidden',
                background: '#f8fafc',
                cursor: 'pointer',
              }}
              onClick={() => setPreview(asset)}
            >
              <img
                src={asset.imageUrl}
                alt={asset.name}
                style={{
                  width: '100%', height: '70%', objectFit: 'cover',
                  display: 'block',
                }}
                loading="lazy"
              />
              <div style={{
                padding: '6px 8px', fontSize: 11, fontWeight: 700,
                color: '#1e293b', lineHeight: 1.3,
                overflow: 'hidden', textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}>
                {asset.name}
              </div>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation()
                  setConfirmDelete(asset)
                }}
                aria-label="삭제"
                style={{
                  position: 'absolute', top: 6, right: 6,
                  width: 24, height: 24, borderRadius: 6,
                  border: 'none', background: 'rgba(15,23,42,0.6)',
                  color: '#fff', fontSize: 12, fontWeight: 700,
                  cursor: 'pointer', lineHeight: 1,
                }}
              >
                ✕
              </button>
            </div>
          ))}
        </div>
      )}

      {/* 미리보기 모달 */}
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

      {/* 삭제 확인 */}
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
              "{confirmDelete.name}" — 이 작업은 되돌릴 수 없습니다.
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
              >
                취소
              </button>
              <button
                type="button"
                onClick={handleDelete}
                style={{
                  flex: 1, padding: '10px', borderRadius: 10,
                  border: 'none', background: '#dc2626', color: '#fff',
                  fontSize: 14, fontWeight: 800, cursor: 'pointer',
                }}
              >
                삭제
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
