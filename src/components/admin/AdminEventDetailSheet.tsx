// 일정 상세 풀스크린 시트 — design_handoff 02b 화면
//
// Hero: 시간 + 봉사 모임 pill / 제목 / 인도자 아바타+이름
// Primary action: 신청하기 (풀폭 솔리드 lg) — admin 일 때는 숨김 또는 disabled
// Sections:
//   - 상세 설명
//   - 위치 (지도 썸네일 + 주소 + 네이버 버튼)
//   - 신청자 (가로 스크롤 칩 strip)
//   - 댓글 (썸 reply thread)
// Sticky 하단: 댓글 입력 composer
//
// 단순화: 댓글/지도 썸네일은 기본 placeholder 만, 본격 기능은 다음 라운드.

import { useMemo, useState } from 'react'
import type { CalendarEvent, Role } from '../../types'

type Props = {
  event: CalendarEvent
  role: Role
  currentVisitor: string
  onClose: () => void
  onDelete?: () => void
  onEdit?: () => void
  onApply?: () => void
  onCancelApply?: () => void
}

function ChevL({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <polyline points="15 6 9 12 15 18" />
    </svg>
  )
}
function DotsIcon() {
  return (
    <svg width={18} height={18} viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <circle cx="12" cy="5" r="1.5" />
      <circle cx="12" cy="12" r="1.5" />
      <circle cx="12" cy="19" r="1.5" />
    </svg>
  )
}
function PinIcon({ size = 14 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M12 21s6-5.2 6-11a6 6 0 0 0-12 0c0 5.8 6 11 6 11Z" />
      <circle cx="12" cy="10" r="2" />
    </svg>
  )
}
function ChatIcon({ size = 14 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" />
    </svg>
  )
}

function initial(name: string) {
  return name.slice(0, 1)
}

function formatDateHeader(iso: string) {
  const d = new Date(iso)
  const dows = ['일요일', '월요일', '화요일', '수요일', '목요일', '금요일', '토요일']
  return `${d.getMonth() + 1}월 ${d.getDate()}일 (${dows[d.getDay()]})`
}

export function AdminEventDetailSheet({
  event,
  role,
  currentVisitor,
  onClose,
  onDelete,
  onEdit,
  onApply,
  onCancelApply,
}: Props) {
  const isApplied = useMemo(() => event.applicants.includes(currentVisitor), [event.applicants, currentVisitor])
  const canApply = event.allowApplications && role !== 'admin'
  const applicants = event.applicants ?? []
  const previewApplicants = applicants.slice(0, 6)
  const overflow = applicants.length - previewApplicants.length
  const [menuOpen, setMenuOpen] = useState(false)

  const openChat = () => {
    window.dispatchEvent(new CustomEvent('app:open-event-chat', {
      detail: {
        eventId: event.id,
        eventTitle: event.title,
        eventDate: event.date,
        eventTime: event.time,
      },
    }))
    onClose()
  }

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 250,
        background: 'var(--bg)',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      {/* 커스텀 헤더 */}
      <header
        style={{
          height: 56,
          padding: '0 12px 0 12px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          borderBottom: '1px solid var(--line)',
          flexShrink: 0,
          background: 'var(--bg)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <button
            type="button"
            onClick={onClose}
            style={{
              width: 36,
              height: 36,
              minHeight: 36,
              border: 'none',
              background: 'transparent',
              borderRadius: 8,
              color: 'var(--text)',
              display: 'grid',
              placeItems: 'center',
              cursor: 'pointer',
            }}
          >
            <ChevL />
          </button>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
            <span style={{ fontSize: 20, fontWeight: 700, color: 'var(--ink)', letterSpacing: '-0.015em' }}>일정</span>
            <span style={{ fontSize: 12.5, fontWeight: 500, color: 'var(--muted)' }}>{formatDateHeader(event.date)}</span>
          </div>
        </div>
        {role === 'admin' && (onDelete || onEdit) && (
          <div style={{ position: 'relative' }}>
            <button
              type="button"
              onClick={() => setMenuOpen((v) => !v)}
              style={{
                width: 36,
                height: 36,
                minHeight: 36,
                border: 'none',
                background: 'transparent',
                borderRadius: 8,
                color: 'var(--text)',
                display: 'grid',
                placeItems: 'center',
                cursor: 'pointer',
              }}
              aria-label="더보기"
            >
              <DotsIcon />
            </button>
            {menuOpen && (
              <>
                <div
                  onClick={() => setMenuOpen(false)}
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
                  {onEdit && (
                    <button
                      type="button"
                      onClick={() => { setMenuOpen(false); onEdit() }}
                      style={{
                        width: '100%', textAlign: 'left',
                        padding: '8px 10px', minHeight: 0,
                        background: 'transparent', border: 'none',
                        fontSize: 13, color: 'var(--text)',
                        cursor: 'pointer', borderRadius: 6,
                      }}
                    >수정</button>
                  )}
                  {onDelete && (
                    <button
                      type="button"
                      onClick={() => { setMenuOpen(false); onDelete() }}
                      style={{
                        width: '100%', textAlign: 'left',
                        padding: '8px 10px', minHeight: 0,
                        background: 'transparent', border: 'none',
                        fontSize: 13, color: 'var(--status-danger)',
                        cursor: 'pointer', borderRadius: 6,
                      }}
                    >삭제</button>
                  )}
                </div>
              </>
            )}
          </div>
        )}
      </header>

      {/* 본문 */}
      <div
        style={{
          flex: 1,
          overflowY: 'auto',
          padding: '20px 16px 84px',
          display: 'flex',
          flexDirection: 'column',
          gap: 18,
        }}
      >
        {/* Hero */}
        <section style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 22, fontWeight: 700, color: 'var(--ink)', fontVariantNumeric: 'tabular-nums' }}>
              {event.endTime ? `${event.time} — ${event.endTime}` : (event.time || '시간 미정')}
            </span>
            {event.hasMeeting && (
              <span
                style={{
                  fontSize: 11.5,
                  padding: '3px 9px',
                  borderRadius: 999,
                  background: 'var(--tint)',
                  color: 'var(--text)',
                  fontWeight: 500,
                }}
              >
                봉사 모임
              </span>
            )}
          </div>
          <h1 style={{ margin: 0, fontSize: 26, fontWeight: 700, color: 'var(--ink)', letterSpacing: '-0.02em' }}>
            {event.title}
          </h1>
          {event.leader && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 4 }}>
              <Avatar name={event.leader} size={24} />
              <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink)' }}>{event.leader}</span>
              <span style={{ fontSize: 12, color: 'var(--muted)' }}>인도자</span>
            </div>
          )}
        </section>

        {/* 신청 버튼 */}
        {canApply && (
          <button
            type="button"
            onClick={isApplied ? onCancelApply : onApply}
            style={{
              height: 48,
              minHeight: 48,
              width: '100%',
              borderRadius: 8,
              border: 'none',
              background: isApplied ? 'var(--tint)' : 'var(--ink)',
              color: isApplied ? 'var(--text)' : '#fff',
              fontSize: 15,
              fontWeight: 600,
              cursor: 'pointer',
              letterSpacing: '-0.005em',
            }}
          >
            {isApplied ? '신청 취소' : '신청하기'}
          </button>
        )}

        {/* 상세 설명 */}
        {event.memo && (
          <section style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <SectionHead title="상세 설명" />
            <div style={{ fontSize: 14, color: 'var(--text)', lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>
              {event.memo}
            </div>
          </section>
        )}

        {/* 위치 — mapLink 가 있을 때만 지도 썸네일+네이버 카드 형태,
            없으면 간단한 한 줄 표시 */}
        {event.place && event.mapLink && (
          <section style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <SectionHead title="위치" />
            <div style={{ background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 12, overflow: 'hidden' }}>
              <div
                style={{
                  aspectRatio: '16/9',
                  background:
                    'linear-gradient(135deg, transparent 49%, var(--line-2) 49%, var(--line-2) 51%, transparent 51%), linear-gradient(45deg, transparent 49%, var(--line-2) 49%, var(--line-2) 51%, transparent 51%), var(--paper)',
                  backgroundSize: '24px 24px, 24px 24px, 100% 100%',
                }}
              />
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px' }}>
                <PinIcon />
                <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>
                  <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--ink)' }}>{event.place}</span>
                </div>
                <a
                  href={event.mapLink}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    height: 30,
                    minHeight: 30,
                    padding: '0 10px',
                    gap: 4,
                    background: 'var(--surface)',
                    border: '1px solid var(--line-2)',
                    borderRadius: 8,
                    color: 'var(--text)',
                    fontSize: 12,
                    fontWeight: 600,
                    textDecoration: 'none',
                  }}
                >
                  네이버
                </a>
              </div>
            </div>
          </section>
        )}
        {event.place && !event.mapLink && (
          <section style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <SectionHead title="위치" />
            <div style={{
              display: 'flex', alignItems: 'center', gap: 10,
              padding: '12px 14px',
              background: 'var(--surface)',
              border: '1px solid var(--line)',
              borderRadius: 12,
            }}>
              <PinIcon />
              <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--ink)' }}>{event.place}</span>
            </div>
          </section>
        )}

        {/* 신청자 */}
        {applicants.length > 0 && (
          <section style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <SectionHead
              title={
                <>
                  신청자{' '}
                  <span style={{ fontWeight: 500, color: 'var(--muted)', fontSize: 13, marginLeft: 6 }}>
                    {applicants.length}
                  </span>
                </>
              }
            />
            <div
              style={{
                display: 'flex',
                gap: 8,
                overflowX: 'auto',
                paddingBottom: 4,
                marginLeft: -16,
                marginRight: -16,
                paddingLeft: 16,
                paddingRight: 16,
              }}
            >
              {previewApplicants.map((name) => (
                <span
                  key={name}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 8,
                    padding: '5px 12px 5px 5px',
                    background: 'var(--surface)',
                    border: '1px solid var(--line)',
                    borderRadius: 99,
                    flexShrink: 0,
                  }}
                >
                  <Avatar name={name} size={22} />
                  <span style={{ fontSize: 13, fontWeight: 600 }}>{name}</span>
                </span>
              ))}
              {overflow > 0 && (
                <span
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    padding: '5px 14px',
                    background: 'var(--surface)',
                    border: '1px solid var(--line)',
                    borderRadius: 99,
                    flexShrink: 0,
                    fontSize: 13,
                    fontWeight: 600,
                    color: 'var(--muted)',
                  }}
                >
                  +{overflow}
                </span>
              )}
            </div>
          </section>
        )}

        {/* 댓글 (간단히) */}
        <section style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <SectionHead
            title={<>댓글</>}
            right={
              <button
                type="button"
                onClick={openChat}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 4,
                  fontSize: 13,
                  fontWeight: 500,
                  color: 'var(--muted)',
                  background: 'transparent',
                  border: 'none',
                  cursor: 'pointer',
                  minHeight: 0,
                  padding: '4px 2px',
                }}
              >
                <ChatIcon /> 채팅 열기
              </button>
            }
          />
          <div style={{ fontSize: 13, color: 'var(--muted-2)', padding: '20px 0', textAlign: 'center' }}>
            아직 댓글이 없습니다
          </div>
        </section>
      </div>

      {/* Sticky 하단 composer (placeholder) */}
      <div
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          bottom: 0,
          padding: '10px 12px max(14px, env(safe-area-inset-bottom))',
          background: 'var(--bg)',
          borderTop: '1px solid var(--line)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Avatar name={currentVisitor || '?'} size={28} />
          <button
            type="button"
            onClick={openChat}
            style={{
              flex: 1,
              padding: '10px 14px',
              background: 'var(--surface)',
              border: '1px solid var(--line)',
              borderRadius: 10,
              fontSize: 14,
              color: 'var(--muted-2)',
              textAlign: 'left',
              minHeight: 0,
              cursor: 'pointer',
            }}
          >
            메시지 · @로 멘션
          </button>
        </div>
      </div>
    </div>
  )
}

function SectionHead({ title, right }: { title: React.ReactNode; right?: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', padding: '0 4px' }}>
      <h2 style={{ margin: 0, fontSize: 16, fontWeight: 600, color: 'var(--ink)', letterSpacing: '-0.01em' }}>{title}</h2>
      {right}
    </div>
  )
}

function Avatar({ name, size = 28 }: { name: string; size?: number }) {
  return (
    <span
      style={{
        width: size,
        height: size,
        borderRadius: '50%',
        background: 'var(--ink)',
        color: '#fff',
        display: 'grid',
        placeItems: 'center',
        fontSize: Math.round(size * 0.45),
        fontWeight: 700,
        flexShrink: 0,
      }}
    >
      {initial(name)}
    </span>
  )
}
