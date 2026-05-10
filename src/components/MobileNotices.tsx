import { useState } from 'react'
import type { Notice, Role } from '../types'
import { CommentSection, type MentionUser } from './CommentSection'

const PRIORITY_COLOR: Record<Notice['priority'], { bg: string; color: string }> = {
  긴급: { bg: 'var(--danger-100)', color: '#b91c1c' },
  일반: { bg: '#eff6ff', color: 'var(--brand-700)' },
  정보: { bg: 'var(--accent-100)', color: 'var(--accent-700)' },
}

export function MobileNotices({
  currentVisitor,
  currentUserId,
  notices,
  role,
  mentionUsers = [],
  onCreateNotice,
  onDeleteNotice,
}: {
  currentVisitor: string
  currentUserId?: number | null
  notices: Notice[]
  role: Role
  mentionUsers?: MentionUser[]
  onCreateNotice: (input: { title: string; content: string; priority: Notice['priority']; author: string }) => void
  onDeleteNotice: (id: number) => void
}) {
  const isAdmin = role === 'admin'
  const [showCreate, setShowCreate] = useState(false)
  const [title, setTitle] = useState('')
  const [content, setContent] = useState('')
  const [priority, setPriority] = useState<Notice['priority']>('일반')

  const handleCreate = () => {
    if (!title.trim() || !content.trim()) return
    onCreateNotice({ title: title.trim(), content: content.trim(), priority, author: currentVisitor })
    setTitle(''); setContent(''); setPriority('일반')
    setShowCreate(false)
  }

  return (
    <div style={{ padding: '18px 18px 32px' }}>
      {showCreate && (
        <>
          <div className="mobile-sheet-backdrop" onClick={() => setShowCreate(false)} />
          <div className="mobile-sheet">
            <div className="mobile-sheet-handle" />
            <div className="mobile-sheet-title">
              <h2>공지 작성</h2>
              <button className="mobile-sheet-close" onClick={() => setShowCreate(false)} type="button">
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                  <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>
            <div className="mobile-form-field">
              <label>중요도</label>
              <select value={priority} onChange={(e) => setPriority(e.target.value as Notice['priority'])}>
                <option value="일반">일반</option>
                <option value="정보">정보</option>
                <option value="긴급">긴급</option>
              </select>
            </div>
            <div className="mobile-form-field">
              <label>제목 *</label>
              <input placeholder="공지 제목" value={title} onChange={(e) => setTitle(e.target.value)} />
            </div>
            <div className="mobile-form-field">
              <label>내용 *</label>
              <textarea placeholder="공지 내용을 입력하세요" value={content} onChange={(e) => setContent(e.target.value)} style={{ minHeight: '120px' }} />
            </div>
            <button className="mobile-form-save" disabled={!title.trim() || !content.trim()} onClick={handleCreate} type="button">등록</button>
            <button className="mobile-form-cancel" onClick={() => setShowCreate(false)} type="button">취소</button>
          </div>
        </>
      )}

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
        <h2 style={{ margin: 0, fontSize: '20px' }}>공지사항</h2>
        {isAdmin && (
          <button
            onClick={() => setShowCreate(true)}
            style={{ minHeight: '36px', padding: '0 14px', borderRadius: '999px', background: 'var(--ink-900)', color: '#fff', fontSize: '13px', fontWeight: 700 }}
            type="button"
          >
            + 공지 작성
          </button>
        )}
      </div>

      {notices.length === 0 && (
        <div style={{ padding: '48px 0', textAlign: 'center', color: '#9ca3af', fontSize: '14px', fontWeight: 600 }}>
          등록된 공지가 없습니다
        </div>
      )}

      {notices.map((notice) => (
        <div className="mobile-notice-card" key={notice.id}>
          <span className="mobile-notice-priority" style={{ background: PRIORITY_COLOR[notice.priority]?.bg, color: PRIORITY_COLOR[notice.priority]?.color }}>
            {notice.priority}
          </span>
          <h3 className="mobile-notice-title">{notice.title}</h3>
          <p className="mobile-notice-content">{notice.content}</p>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span className="mobile-notice-meta">{notice.author} · {notice.createdAt.slice(0, 10)}</span>
            {isAdmin && (
              <button
                onClick={() => { if (confirm('공지를 삭제할까요?')) onDeleteNotice(notice.id) }}
                style={{ minHeight: '28px', padding: '0 10px', borderRadius: 'var(--r-sm)', border: '1px solid var(--danger-100)', background: '#fff5f5', color: 'var(--danger-600)', fontSize: '12px', fontWeight: 700 }}
                type="button"
              >
                삭제
              </button>
            )}
          </div>
          <CommentSection
            compact
            currentUserId={currentUserId}
            currentVisitor={currentVisitor}
            role={role}
            targetId={notice.id}
            targetType="notice"
            users={mentionUsers}
          />
        </div>
      ))}
    </div>
  )
}
