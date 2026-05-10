import { useState } from 'react'
import type { Notice, Role } from '../types'
import { CommentSection, type MentionUser } from './CommentSection'

const PRIORITY_BADGE: Record<Notice['priority'], string> = {
  긴급: 'notice-badge--danger',
  일반: 'notice-badge--primary',
  정보: 'notice-badge--neutral',
}

export function DesktopNotices({
  currentVisitor,
  currentUserId,
  role = 'user',
  notices,
  mentionUsers = [],
  onCreateNotice,
  onDeleteNotice,
}: {
  currentVisitor: string
  currentUserId?: number | null
  role?: Role
  notices: Notice[]
  mentionUsers?: MentionUser[]
  onCreateNotice: (input: { title: string; content: string; priority: Notice['priority']; author: string }) => void
  onDeleteNotice: (id: number) => void
}) {
  const [selected, setSelected] = useState<Notice | null>(notices[0] ?? null)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ title: '', content: '', priority: '일반' as Notice['priority'] })

  const handleCreate = () => {
    if (!form.title.trim() || !form.content.trim()) return
    onCreateNotice({ ...form, author: currentVisitor })
    setForm({ title: '', content: '', priority: '일반' })
    setShowForm(false)
  }

  return (
    <div className="notice-page">
      {/* ── 페이지 헤더 ── */}
      <div className="notice-page-head">
        <div className="notice-page-head__title-group">
          <p className="notice-page-head__eyebrow">공지사항</p>
          <h1 className="notice-page-head__title">
            공지 목록&nbsp;<span className="notice-count">{notices.length}</span>
          </h1>
        </div>
        <button
          className={`notice-write-btn${showForm ? ' is-cancel' : ''}`}
          onClick={() => setShowForm((v) => !v)}
          type="button"
        >
          {showForm ? '취소' : '+ 공지 작성'}
        </button>
      </div>

      {/* ── 본문 그리드 ── */}
      <div className="notice-grid">
        {/* 좌: 목록 */}
        <div className="notice-list-panel">
          {/* 작성 폼 */}
          {showForm && (
            <div className="notice-form">
              <input
                className="notice-form-input"
                placeholder="제목"
                value={form.title}
                onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
              />
              <textarea
                className="notice-form-textarea"
                placeholder="내용"
                rows={4}
                value={form.content}
                onChange={(e) => setForm((f) => ({ ...f, content: e.target.value }))}
              />
              <div className="notice-form-footer">
                <span className="notice-form-label">우선순위</span>
                {(['긴급', '일반', '정보'] as Notice['priority'][]).map((p) => (
                  <button
                    key={p}
                    className={`notice-priority-chip${form.priority === p ? ' is-active notice-priority-chip--' + (p === '긴급' ? 'danger' : p === '정보' ? 'neutral' : 'primary') : ''}`}
                    onClick={() => setForm((f) => ({ ...f, priority: p }))}
                    type="button"
                  >
                    {p}
                  </button>
                ))}
                <button
                  className="notice-submit-btn"
                  disabled={!form.title.trim() || !form.content.trim()}
                  onClick={handleCreate}
                  type="button"
                >
                  등록
                </button>
              </div>
            </div>
          )}

          {/* 목록 */}
          {notices.length === 0 ? (
            <div className="notice-empty">등록된 공지가 없습니다</div>
          ) : (
            notices.map((notice) => (
              <button
                key={notice.id}
                className={`notice-row${selected?.id === notice.id ? ' is-selected' : ''}`}
                onClick={() => setSelected(notice)}
                type="button"
              >
                <span className={`notice-badge ${PRIORITY_BADGE[notice.priority]}`}>
                  {notice.priority}
                </span>
                <div className="notice-row__body">
                  <strong className="notice-row__title">{notice.title}</strong>
                  <span className="notice-row__meta">{notice.author} · {notice.createdAt.slice(0, 10)}</span>
                </div>
                <span className="notice-row__chevron">›</span>
              </button>
            ))
          )}
        </div>

        {/* 우: 상세 */}
        <div className="notice-detail-panel">
          {!selected ? (
            <div className="notice-empty" style={{ marginTop: 60 }}>공지를 선택하세요</div>
          ) : (
            <>
              <div className="notice-detail-head">
                <div className="notice-detail-head__meta">
                  <span className={`notice-badge ${PRIORITY_BADGE[selected.priority]}`}>
                    {selected.priority}
                  </span>
                  <span className="notice-detail-head__author">
                    {selected.author} · {selected.createdAt.slice(0, 10)}
                  </span>
                </div>
                <button
                  className="notice-delete-btn"
                  onClick={() => {
                    onDeleteNotice(selected.id)
                    setSelected(notices.find((n) => n.id !== selected.id) ?? null)
                  }}
                  type="button"
                >
                  삭제
                </button>
              </div>

              <div className="notice-detail-body">
                <h2 className="notice-detail-title">{selected.title}</h2>
                <p className="notice-detail-content">{selected.content}</p>
                <CommentSection
                  currentUserId={currentUserId}
                  currentVisitor={currentVisitor}
                  role={role}
                  targetId={selected.id}
                  targetType="notice"
                  users={mentionUsers}
                />
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
