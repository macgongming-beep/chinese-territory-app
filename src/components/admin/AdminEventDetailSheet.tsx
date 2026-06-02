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
import type { CalendarEvent, Role, TerritoryCard } from '../../types'
import { confirmDialog } from '../../lib/confirm'
import { t, type AppLanguage } from '../../i18n'
import { CommentSection, type MentionUser } from '../CommentSection'

type Props = {
  language?: AppLanguage
  event: CalendarEvent
  cards?: TerritoryCard[]
  role: Role
  currentVisitor: string
  currentUserId?: number | null
  mentionUsers?: MentionUser[]
  onClose: () => void
  onDelete?: () => void
  onEdit?: () => void
  onApply?: () => void
  onCancelApply?: () => void
  onAddParticipant?: (userName: string) => void
  onRemoveParticipant?: (userName: string) => void
  onOpenAssignment?: () => void
  globalSettings?: Record<string, string>
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

function formatDateHeader(iso: string, language = 'ko') {
  const d = new Date(iso)
  const m = d.getMonth() + 1
  const day = d.getDate()
  if (language === 'zh') {
    const dows = ['星期日', '星期一', '星期二', '星期三', '星期四', '星期五', '星期六']
    return `${m}月${day}日 (${dows[d.getDay()]})`
  }
  if (language === 'en') {
    const dows = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
    return `${months[d.getMonth()]} ${day} (${dows[d.getDay()]})`
  }
  const dows = ['일요일', '월요일', '화요일', '수요일', '목요일', '금요일', '토요일']
  return `${m}월 ${day}일 (${dows[d.getDay()]})`
}

function getAssignmentCardIds(assignment: CalendarEvent['cardAssignments'][number]) {
  const ids = assignment.assignedCardIds?.length
    ? assignment.assignedCardIds
    : assignment.assignedCardId
      ? [assignment.assignedCardId]
      : []
  return Array.from(new Set(ids.filter((id): id is number => typeof id === 'number' && id > 0))).sort((a, b) => a - b)
}

function buildSharedAssignmentTeams(event: CalendarEvent, cards: TerritoryCard[]) {
  const cardNameById = new Map(cards.map((card) => [card.id, card.name]))
  const grouped = new Map<string, { members: string[]; cardIds: number[] }>()

  event.cardAssignments.forEach((assignment) => {
    const cardIds = getAssignmentCardIds(assignment)
    const key = cardIds.length ? cardIds.join(',') : `member:${assignment.userName}`
    const existing = grouped.get(key) ?? { members: [], cardIds }
    existing.members.push(assignment.userName)
    grouped.set(key, existing)
  })

  return Array.from(grouped.values()).map((team, index) => ({
    id: `${team.cardIds.join('-') || 'none'}-${index}`,
    label: `팀 ${index + 1}`,
    members: team.members,
    cardNames: team.cardIds.map((id) => cardNameById.get(id)).filter((name): name is string => Boolean(name)),
  }))
}

function SharedAssignmentTeams({ event, cards }: { event: CalendarEvent; cards: TerritoryCard[] }) {
  if (event.assignmentStatus !== 'shared') return null

  const teams = buildSharedAssignmentTeams(event, cards)
  if (teams.length === 0) return null

  return (
    <section className="shared-assignment-section">
      <SectionHead title="확정된 팀" />
      <div className="shared-assignment-list">
        {teams.map((team) => {
          const primaryCard = team.cardNames[0] ?? '카드 미배정'
          const extraCount = Math.max(0, team.cardNames.length - 1)
          return (
            <div className="shared-assignment-card" key={team.id}>
              <div className="shared-assignment-card__top">
                <div className="shared-assignment-card__summary">
                  <strong>{team.label}</strong>
                  <span>{team.members.join(', ') || '팀원 없음'}</span>
                </div>
                <span>{team.members.length}명</span>
              </div>
              <div className="shared-assignment-card__cards">
                {primaryCard}{extraCount > 0 ? ` 외 ${extraCount}개` : ''}
              </div>
            </div>
          )
        })}
      </div>
    </section>
  )
}

export function AdminEventDetailSheet({
  language = 'ko',
  event,
  cards = [],
  role,
  currentVisitor,
  currentUserId,
  mentionUsers = [],
  onClose,
  onDelete,
  onEdit,
  onApply,
  onCancelApply,
  onAddParticipant,
  onRemoveParticipant,
  onOpenAssignment,
  globalSettings = {},
}: Props) {
  const isApplied = useMemo(() => event.applicants.includes(currentVisitor), [event.applicants, currentVisitor])
  const canApply = event.allowApplications
  const applicants = event.applicants ?? []
  const canManageParticipants = role === 'admin' || role === 'developer' || role === 'leader'
  
  const [isAddParticipantModalOpen, setIsAddParticipantModalOpen] = useState(false)
  const [isRemoveParticipantMode, setIsRemoveParticipantMode] = useState(false)
  const [participantSearchText, setParticipantSearchText] = useState('')

  const hideParticipants = globalSettings.hide_participants_from_users === 'true' && role === 'user'
  const [menuOpen, setMenuOpen] = useState(false)

  // 채팅 열기 — AppHeader 가 'app:open-event-chat' 리스닝하고 GlobalChatModal 오픈
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

  const handleRemoveParticipant = async (name: string) => {
    if (!onRemoveParticipant) return
    const ok = await confirmDialog({ message: `${name}님을 이 일정에서 제외할까요?\n이미 팀이나 카드에 배정되어 있으면 배정에서도 제외됩니다.`, danger: true, confirmLabel: '제외' })
    if (!ok) return
    onRemoveParticipant(name)
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
            <span style={{ fontSize: 20, fontWeight: 700, color: 'var(--ink)', letterSpacing: '-0.015em' }}>{language === 'ko' ? '일정' : language === 'zh' ? '日程' : 'Event'}</span>
            <span style={{ fontSize: 12.5, fontWeight: 500, color: 'var(--muted)' }}>{formatDateHeader(event.date, language)}</span>
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
                    >{language === 'ko' ? '수정' : language === 'zh' ? '修改' : 'Edit'}</button>
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
                    >{language === 'ko' ? '삭제' : language === 'zh' ? '删除' : 'Delete'}</button>
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
          padding: '20px 16px max(28px, env(safe-area-inset-bottom))',
          display: 'flex',
          flexDirection: 'column',
          gap: 18,
        }}
      >
        {/* Hero — 디자인 02b: 시간 + pill / 26px 제목 / 인도자 행 */}
        <section style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 22, fontWeight: 700, color: 'var(--ink)', fontVariantNumeric: 'tabular-nums' }}>
              {event.endTime ? `${event.time} — ${event.endTime}` : (event.time || t(language ?? 'ko', 'calendar.timeTbd'))}
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
                {t(language ?? 'ko', 'calendar.meeting')}
              </span>
            )}
          </div>
          <h1 style={{ margin: 0, fontSize: 26, fontWeight: 700, color: 'var(--ink)', letterSpacing: '-0.02em', lineHeight: 1.2 }}>
            {event.title}
          </h1>
          {event.leader && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 2 }}>
              <Avatar name={event.leader} size={24} />
              <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink)' }}>{event.leader}</span>
              <span style={{ fontSize: 12, color: 'var(--muted)' }}>{language === 'ko' ? '인도자' : language === 'zh' ? '带头人' : 'Conductor'}</span>
            </div>
          )}
        </section>

        {/* 신청 버튼 */}
        {canApply && (
          <button
            type="button"
            onClick={isApplied ? onCancelApply : onApply}
            style={{
              height: 44,
              minHeight: 44,
              width: '100%',
              padding: '0 18px',
              borderRadius: 8,
              border: 'none',
              background: isApplied ? 'var(--tint)' : 'var(--ink)',
              color: isApplied ? 'var(--text)' : '#fff',
              fontSize: 14,
              fontWeight: 600,
              cursor: 'pointer',
              letterSpacing: '-0.005em',
            }}
          >
            {isApplied ? (language === 'ko' ? '신청 취소' : language === 'zh' ? '取消申请' : 'Cancel') : (language === 'ko' ? '신청하기' : language === 'zh' ? '申请参与' : 'Apply')}
          </button>
        )}

        {/* 상세 설명 */}
        {event.memo && (
          <section style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <SectionHead title={language === "ko" ? "상세 설명" : language === "zh" ? "详细说明" : "Details"} />
            <div style={{ fontSize: 14, color: 'var(--text)', lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>
              {event.memo}
            </div>
          </section>
        )}

        {/* 위치 — mapLink 있으면 카드 전체가 네이버 지도 링크,
            없으면 단순 한 줄 표시.
            지도 썸네일 미리보기는 네이버 X-Frame-Options 차단으로 불가능. */}
        {event.place && event.mapLink && (
          <section style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <SectionHead title={language === "ko" ? "위치" : language === "zh" ? "位置" : "Location"} />
            <a
              href={event.mapLink}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 12,
                padding: '14px 16px',
                background: 'var(--surface)',
                border: '1px solid var(--line)',
                borderRadius: 12,
                textDecoration: 'none',
                color: 'inherit',
              }}
            >
              <span style={{
                width: 36, height: 36, borderRadius: 10,
                background: 'var(--tint)', color: 'var(--text)',
                display: 'grid', placeItems: 'center', flexShrink: 0,
              }}>
                <PinIcon size={16} />
              </span>
              <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 2 }}>
                <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--ink)' }}>{event.place}</span>
                <span style={{ fontSize: 12, color: 'var(--muted)' }}>{language === 'ko' ? '네이버 지도에서 보기' : language === 'zh' ? '在 Naver 地图中查看' : 'View on Naver Map'}</span>
              </div>
              <span style={{ color: 'var(--muted-2)', flexShrink: 0 }}>
                <svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                  <path d="M7 17 17 7" />
                  <path d="M8 7h9v9" />
                </svg>
              </span>
            </a>
          </section>
        )}
        {event.place && !event.mapLink && (
          <section style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <SectionHead title={language === "ko" ? "위치" : language === "zh" ? "位置" : "Location"} />
            <div style={{
              display: 'flex', alignItems: 'center', gap: 12,
              padding: '14px 16px',
              background: 'var(--surface)',
              border: '1px solid var(--line)',
              borderRadius: 12,
            }}>
              <span style={{
                width: 36, height: 36, borderRadius: 10,
                background: 'var(--tint)', color: 'var(--text)',
                display: 'grid', placeItems: 'center', flexShrink: 0,
              }}>
                <PinIcon size={16} />
              </span>
              <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--ink)' }}>{event.place}</span>
            </div>
          </section>
        )}

        {/* 신청자 — 디자인 02b 가로 스크롤 칩 strip */}
        {!hideParticipants && (
        <section style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <SectionHead
              title={
                <>
                  {t(language ?? 'ko', 'calendar.applicantSection')}
                  <span style={{ fontWeight: 500, color: 'var(--muted)', fontSize: 13, marginLeft: 6 }}>
                    {applicants.length}
                  </span>
                </>
              }
            />
            {canManageParticipants && (onAddParticipant || onRemoveParticipant) && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, position: 'relative' }}>
                {onAddParticipant && (
                  <button
                    type="button"
                    onClick={() => setIsAddParticipantModalOpen(true)}
                    style={{
                      padding: '4px 10px',
                      borderRadius: 99,
                      border: '1px solid var(--line-muted)',
                      background: 'var(--surface)',
                      fontSize: 12,
                      fontWeight: 600,
                      color: 'var(--text)',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 4
                    }}
                  >
                    + 추가
                  </button>
                )}
                {onRemoveParticipant && applicants.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setIsRemoveParticipantMode((v) => !v)}
                    style={{
                      padding: '4px 10px',
                      borderRadius: 99,
                      border: '1px solid var(--line-muted)',
                      background: isRemoveParticipantMode ? 'var(--danger-50, #FEF2F2)' : 'var(--surface)',
                      fontSize: 12,
                      fontWeight: 600,
                      color: isRemoveParticipantMode ? 'var(--status-danger)' : 'var(--text)',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 4
                    }}
                  >
                    {isRemoveParticipantMode ? '제외 닫기' : '- 제외'}
                  </button>
                )}
              </div>
            )}
          </div>
          <div
            style={{
              display: 'flex',
              gap: 8,
              flexWrap: 'wrap',
              maxHeight: 150,
              overflowY: 'auto',
              paddingBottom: 4,
            }}
          >
            {applicants.map((name) => (
              <span
                key={name}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 8,
                  padding: isRemoveParticipantMode ? '5px 6px 5px 5px' : '5px 12px 5px 5px',
                  background: 'var(--surface)',
                  border: '1px solid var(--line)',
                  borderRadius: 99,
                  flexShrink: 0,
                }}
              >
                <Avatar name={name} size={22} />
                <span style={{ fontSize: 13, fontWeight: 600 }}>{name}</span>
                {isRemoveParticipantMode && onRemoveParticipant && (
                  <button
                    type="button"
                    onClick={() => handleRemoveParticipant(name)}
                    style={{
                      height: 22,
                      minHeight: 22,
                      padding: '0 8px',
                      borderRadius: 99,
                      border: 'none',
                      background: 'var(--danger-50, #FEF2F2)',
                      color: 'var(--status-danger)',
                      fontSize: 11,
                      fontWeight: 700,
                      cursor: 'pointer',
                    }}
                  >
                    제외
                  </button>
                )}
              </span>
            ))}
            {/* 점선 "+ 추가" 칩 제거 — 상단 "신청하기" 버튼과 동일 기능으로 중복 */}
            {applicants.length === 0 && !canApply && (
              <span style={{ fontSize: 13, color: 'var(--muted-2)', padding: '6px 4px', flexShrink: 0 }}>
                {t(language ?? 'ko', 'calendar.noApplicants')}
              </span>
            )}
          </div>
        </section>

        )}

        {/* 팀 구성 & 배정 진입 (인도자/관리자) */}
        {onOpenAssignment && (
          <button
            type="button"
            onClick={onOpenAssignment}
            style={{
              display: 'flex', alignItems: 'center', gap: 10,
              width: '100%', padding: '14px 16px', marginTop: 4,
              background: 'var(--surface, #fff)', color: 'var(--ink)',
              border: '1px solid var(--line)', borderRadius: 12,
              fontSize: 14, fontWeight: 700, cursor: 'pointer',
            }}
          >
            <span style={{
              width: 30, height: 30, borderRadius: 8, flexShrink: 0,
              display: 'grid', placeItems: 'center',
              background: 'var(--bg-muted, #f1f0ee)', color: 'var(--ink)',
            }} aria-hidden="true">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" />
                <path d="M23 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" />
              </svg>
            </span>
            <span style={{ flex: 1, textAlign: 'left' }}>
              팀 구성 &amp; 배정
              <span style={{ display: 'block', fontSize: 12, fontWeight: 500, color: 'var(--muted)', marginTop: 1 }}>
                신청자를 팀으로 묶고 구역을 나눠요
              </span>
            </span>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--muted-2, #94a3b8)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><polyline points="9 18 15 12 9 6"/></svg>
          </button>
        )}

        <SharedAssignmentTeams event={event} cards={cards} />

        <CommentSection
          compact
          language={language}
          currentUserId={currentUserId}
          currentVisitor={currentVisitor}
          role={role}
          targetId={event.id}
          targetType="calendar_event"
          users={mentionUsers}
          headerRight={
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
              <ChatIcon />
              {t(language ?? 'ko', 'calendar.openChat')}
            </button>
          }
        />

      {isAddParticipantModalOpen && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 100000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.4)' }} onClick={() => setIsAddParticipantModalOpen(false)} />
          <div style={{ background: 'var(--bg)', borderRadius: 16, width: '90%', maxWidth: 400, maxHeight: '80%', display: 'flex', flexDirection: 'column', zIndex: 1, overflow: 'hidden' }}>
            <div style={{ padding: 16, borderBottom: '1px solid var(--line-muted)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>신청자 수동 추가</h3>
              <button onClick={() => setIsAddParticipantModalOpen(false)} style={{ background: 'none', border: 'none', fontSize: 20, cursor: 'pointer', padding: 4 }}>×</button>
            </div>
            <div style={{ padding: 12, borderBottom: '1px solid var(--line-muted)' }}>
              <input 
                type="text" 
                placeholder="이름 검색..." 
                value={participantSearchText}
                onChange={e => setParticipantSearchText(e.target.value)}
                style={{ width: '100%', boxSizing: 'border-box', padding: '10px 12px', borderRadius: 8, border: '1px solid var(--line-muted)', background: 'var(--surface)', fontSize: 14 }}
              />
            </div>
            <div style={{ flex: 1, overflowY: 'auto', padding: 12, display: 'flex', flexDirection: 'column', gap: 4 }}>
              {(mentionUsers || [])
                .filter(u => !applicants.includes(u.name))
                .filter(u => participantSearchText ? u.name.includes(participantSearchText) : true)
                .map(u => (
                  <div 
                    key={u.id}
                    onClick={() => {
                      if (onAddParticipant) onAddParticipant(u.name);
                      setIsAddParticipantModalOpen(false);
                      setParticipantSearchText('');
                    }}
                    style={{ padding: '10px 12px', display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', borderRadius: 8 }}
                    onMouseOver={e => e.currentTarget.style.background = 'var(--surface)'}
                    onMouseOut={e => e.currentTarget.style.background = 'none'}
                  >
                    <Avatar name={u.name} size={28} />
                    <span style={{ fontSize: 14, fontWeight: 600 }}>{u.name}</span>
                  </div>
              ))}
              {(mentionUsers || []).filter(u => !applicants.includes(u.name)).length === 0 && (
                <div style={{ padding: 20, textAlign: 'center', color: 'var(--text-muted)', fontSize: 14 }}>
                  추가할 수 있는 사용자가 없습니다.
                </div>
              )}
            </div>
          </div>
        </div>
      )}

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
