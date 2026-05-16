// 비공식 증거 자료 관리 (관리자/개발자 전용)
// 설정 페이지에 임베드 — 이미지 업로드 + 자료 목록 + 삭제
import { useRef, useState } from 'react'
import type { InformalAsset, Role } from '../types'
import { showToast } from '../lib/toast'

const MAX_SIZE_MB = 5
const ACCEPTED_TYPES = ['image/jpeg', 'image/png', 'image/webp']

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
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [name, setName] = useState('')
  const [uploading, setUploading] = useState(false)
  const [preview, setPreview] = useState<InformalAsset | null>(null)
  const [confirmDelete, setConfirmDelete] = useState<InformalAsset | null>(null)

  const admin = isAdminLike(role)
  const sorted = [...informalAssets].sort((a, b) => b.createdAt.localeCompare(a.createdAt))

  if (!admin) {
    // 관리자가 아닌 경우 컴포넌트 자체 숨김 (안전망 — 호출부에서도 가드)
    return null
  }

  const handleFilePick = (file: File | null) => {
    if (!file) {
      setSelectedFile(null)
      return
    }
    if (!ACCEPTED_TYPES.includes(file.type)) {
      showToast('JPG, PNG, WebP 만 업로드 가능합니다.', 'error')
      return
    }
    if (file.size > MAX_SIZE_MB * 1024 * 1024) {
      showToast(`파일 크기는 ${MAX_SIZE_MB}MB 이하만 가능합니다.`, 'error')
      return
    }
    setSelectedFile(file)
    if (!name.trim()) {
      // 파일명에서 확장자 제거해 기본 이름 채움
      const baseName = file.name.replace(/\.[^.]+$/, '')
      setName(baseName.slice(0, 40))
    }
  }

  const handleUpload = async () => {
    if (!selectedFile) return
    setUploading(true)
    const result = await onUpload({
      file: selectedFile,
      name: name.trim() || '비공식 증거 카드',
      uploadedBy: currentVisitor,
    })
    setUploading(false)
    if (result.ok) {
      showToast('자료가 등록되었습니다', 'success')
      resetForm()
    }
  }

  const resetForm = () => {
    setSelectedFile(null)
    setName('')
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

      {/* 업로드 폼 */}
      {showForm && (
        <div style={{
          padding: 14, marginBottom: 14, borderRadius: 12,
          background: '#fafafa', border: '1px solid #e5e7eb',
        }}>
          <input
            ref={fileInputRef}
            type="file"
            accept={ACCEPTED_TYPES.join(',')}
            onChange={(e) => handleFilePick(e.target.files?.[0] ?? null)}
            style={{ width: '100%', marginBottom: 10, fontSize: 13 }}
          />
          {selectedFile && (
            <div style={{ marginBottom: 10, fontSize: 12, color: '#6b7280' }}>
              {selectedFile.name} · {(selectedFile.size / 1024).toFixed(0)} KB
            </div>
          )}
          <input
            type="text"
            placeholder="자료 이름 (예: QR 카드)"
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={50}
            style={{
              width: '100%', padding: '10px 12px', borderRadius: 10,
              border: '1px solid #d8dbe0', fontSize: 14, marginBottom: 10,
            }}
          />
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              type="button"
              onClick={resetForm}
              disabled={uploading}
              style={{
                flex: 1, padding: '10px', borderRadius: 10,
                border: '1px solid #d8dbe0', background: '#fff', color: '#4b5563',
                fontSize: 13, fontWeight: 700, cursor: 'pointer',
              }}
            >
              취소
            </button>
            <button
              type="button"
              onClick={handleUpload}
              disabled={!selectedFile || uploading}
              style={{
                flex: 2, padding: '10px', borderRadius: 10,
                border: 'none', background: '#7c3aed', color: '#fff',
                fontSize: 13, fontWeight: 800,
                cursor: uploading ? 'wait' : 'pointer',
                opacity: !selectedFile || uploading ? 0.6 : 1,
              }}
            >
              {uploading ? '업로드 중...' : '등록'}
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
