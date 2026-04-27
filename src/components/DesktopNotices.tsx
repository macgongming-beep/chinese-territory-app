import { useState } from 'react'
import type { Notice } from '../types'

const PRIORITY_COLORS: Record<Notice['priority'], { bg: string; color: string; label: string }> = {
  긴급: { bg: 'var(--danger-100)', color: '#b91c1c', label: '긴급' },
  일반: { bg: '#f0f9ff', color: '#0369a1', label: '일반' },
  정보: { bg: 'var(--accent-100)', color: 'var(--accent-700)', label: '정보' },
}

export function DesktopNotices({
  currentVisitor,
  notices,
  onCreateNotice,
  onDeleteNotice,
}: {
  currentVisitor: string
  notices: Notice[]
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
    <section className="desktop-content calendar-layout">
      <div className="calendar-pane">
        <div className="calendar-toolbar">
          <div>
            <p>공지사항</p>
            <h1>공지 목록 ({notices.length})</h1>
          </div>
          <button
            className="action-button"
            onClick={() => setShowForm((v) => !v)}
            type="button"
          >
            {showForm ? '취소' : '+ 공지 작성'}
          </button>
        </div>

        {showForm && (
          <div style={{ padding: '12px', borderBottom: '1px solid #e5e7eb', display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <input
              placeholder="제목"
              style={{ padding: '8px 10px', borderRadius: 'var(--r-sm)', border: '1px solid #d1d5db', fontSize: '14px' }}
              value={form.title}
              onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
            />
            <textarea
              placeholder="내용"
              rows={4}
              style={{ padding: '8px 10px', borderRadius: 'var(--r-sm)', border: '1px solid #d1d5db', fontSize: '14px', resize: 'vertical' }}
              value={form.content}
              onChange={(e) => setForm((f) => ({ ...f, content: e.target.value }))}
            />
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
              <label style={{ fontSize: '13px', color: 'var(--ink-500)' }}>우선순위</label>
              {(['긴급', '일반', '정보'] as Notice['priority'][]).map((p) => (
                <button
                  key={p}
                  onClick={() => setForm((f) => ({ ...f, priority: p }))}
                  style={{
                    padding: '3px 10px', borderRadius: '999px', fontSize: '12px', cursor: 'pointer',
                    background: form.priority === p ? PRIORITY_COLORS[p].bg : '#f3f4f6',
                    color: form.priority === p ? PRIORITY_COLORS[p].color : 'var(--ink-500)',
                    border: form.priority === p ? `1px solid ${PRIORITY_COLORS[p].color}` : '1px solid #e5e7eb',
                    fontWeight: form.priority === p ? 700 : 400,
                  }}
                  type="button"
                >
                  {p}
                </button>
              ))}
              <button
                className="action-button"
                disabled={!form.title.trim() || !form.content.trim()}
                onClick={handleCreate}
                style={{ marginLeft: 'auto' }}
                type="button"
              >
                등록
              </button>
            </div>
          </div>
        )}

        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', padding: '8px' }}>
          {notices.length === 0 && (
            <div className="map-empty-state">
              <p>등록된 공지가 없습니다</p>
            </div>
          )}
          {notices.map((notice) => {
            const pc = PRIORITY_COLORS[notice.priority]
            return (
              <button
                key={notice.id}
                onClick={() => setSelected(notice)}
                style={{
                  display: 'flex', alignItems: 'flex-start', gap: '10px',
                  padding: '10px 12px', textAlign: 'left', cursor: 'pointer',
                  background: selected?.id === notice.id ? 'var(--brand-50)' : '#fff',
                  border: selected?.id === notice.id ? '1px solid var(--brand-700)' : '1px solid #e5e7eb',
                  borderRadius: 'var(--r-md)',
                }}
                type="button"
              >
                <span style={{ padding: '2px 8px', borderRadius: '999px', fontSize: '11px', background: pc.bg, color: pc.color, fontWeight: 700, flexShrink: 0, marginTop: '2px' }}>
                  {notice.priority}
                </span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <strong style={{ fontSize: '14px', display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {notice.title}
                  </strong>
                  <p style={{ fontSize: '12px', color: 'var(--ink-500)', margin: '2px 0 0' }}>
                    {notice.author} · {notice.createdAt.slice(0, 10)}
                  </p>
                </div>
              </button>
            )
          })}
        </div>
      </div>

      <aside className="detail-pane" aria-label="공지 상세">
        {!selected ? (
          <div className="map-empty-state" style={{ marginTop: '40px' }}>
            <p>공지를 선택하세요</p>
          </div>
        ) : (
          <div className="detail-stack">
            <div className="detail-header">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div style={{ flex: 1 }}>
                  <span style={{
                    display: 'inline-block', padding: '2px 10px', borderRadius: '999px', fontSize: '12px',
                    background: PRIORITY_COLORS[selected.priority].bg,
                    color: PRIORITY_COLORS[selected.priority].color,
                    fontWeight: 700, marginBottom: '8px',
                  }}>
                    {selected.priority}
                  </span>
                  <h2 style={{ fontSize: '18px', margin: '0 0 6px', fontWeight: 700 }}>{selected.title}</h2>
                  <p style={{ fontSize: '12px', color: 'var(--ink-500)', margin: 0 }}>
                    {selected.author} · {selected.createdAt.slice(0, 10)}
                  </p>
                </div>
                <button
                  className="danger-action"
                  onClick={() => {
                    onDeleteNotice(selected.id)
                    setSelected(notices.find((n) => n.id !== selected.id) ?? null)
                  }}
                  style={{ fontSize: '12px', padding: '4px 10px', flexShrink: 0, marginLeft: '12px' }}
                  type="button"
                >
                  삭제
                </button>
              </div>
            </div>

            <article className="detail-card">
              <p style={{ fontSize: '14px', lineHeight: 1.7, whiteSpace: 'pre-wrap', margin: 0 }}>
                {selected.content}
              </p>
            </article>
          </div>
        )}
      </aside>
    </section>
  )
}
