// 알림 설정 (종류별 on/off + 방해금지 시간)
import { useState } from 'react'
import { useNotificationPrefs } from '../hooks/useNotificationPrefs'

const TYPES: Array<{
  key: keyof Pick<
    ReturnType<typeof useNotificationPrefs>['prefs'],
    'pushNewNotice' | 'pushEventChange' | 'pushComment' | 'pushChat' | 'pushMention' | 'pushServiceStatus'
  >
  label: string
  desc: string
}> = [
  { key: 'pushNewNotice', label: '새 공지', desc: '관리자가 새 공지를 올릴 때' },
  { key: 'pushEventChange', label: '일정 변경', desc: '봉사 시간/장소가 바뀔 때 (참여한 일정만)' },
  { key: 'pushComment', label: '댓글', desc: '내 게시물에 댓글이 달릴 때' },
  { key: 'pushChat', label: '채팅 메시지', desc: '봉사 채팅방에 새 메시지가 올 때' },
  { key: 'pushMention', label: '@멘션', desc: '누군가 회원님을 언급할 때' },
  { key: 'pushServiceStatus', label: '봉사 시작/종료', desc: '참여 봉사가 시작되거나 종료될 때' },
]

export function NotificationSettings({ userId }: { userId: number }) {
  const { prefs, saving, update } = useNotificationPrefs(userId)
  const dndEnabled = prefs.quietHoursStart !== null && prefs.quietHoursEnd !== null
  const [localStart, setLocalStart] = useState(prefs.quietHoursStart ?? '22:00')
  const [localEnd, setLocalEnd] = useState(prefs.quietHoursEnd ?? '07:00')

  return (
    <div style={{ background: '#fff', borderRadius: 18, padding: 18, border: '1px solid #e5e7eb', boxShadow: '0 1px 2px rgba(16,24,40,0.04)' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0 }}>
          <span style={{
            display: 'grid', width: 38, height: 38, placeItems: 'center',
            borderRadius: 12, background: '#f3f4f6', color: '#4b5563',
            flexShrink: 0,
          }}>
            <svg viewBox="0 0 24 24" aria-hidden="true" style={{ width: 20, height: 20, fill: 'none', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round' }}>
              <path d="M18 9a6 6 0 1 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9" />
              <path d="M10 21a2 2 0 0 0 4 0" />
            </svg>
          </span>
          <div style={{ minWidth: 0 }}>
            <h3 style={{ margin: 0, fontSize: 15, fontWeight: 800, color: '#111827', lineHeight: 1.25 }}>
              알림 설정
            </h3>
            <p style={{ margin: '3px 0 0', fontSize: 12, fontWeight: 700, color: '#6b7280' }}>
              받을 알림과 조용한 시간 관리
            </p>
          </div>
        </div>
        {saving && (
          <span style={{
            flexShrink: 0, padding: '5px 9px', borderRadius: 999,
            background: '#f3f4f6', color: '#6b7280', fontSize: 11, fontWeight: 800,
          }}>
            저장 중
          </span>
        )}
      </div>

      {/* 종류별 토글 */}
      <div style={{ marginBottom: 18 }}>
        <p style={{
          margin: '0 0 8px', fontSize: 12, fontWeight: 800, color: '#6b7280',
        }}>받을 알림 종류</p>
        {TYPES.map(({ key, label, desc }) => (
          <label
            key={key}
            style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              gap: 12, padding: '11px 0', borderBottom: '1px solid #eef1f5',
              cursor: 'pointer',
            }}
          >
            <div style={{ flex: 1, minWidth: 0 }}>
              <p style={{ margin: 0, fontSize: 14, fontWeight: 800, color: '#111827', lineHeight: 1.25 }}>{label}</p>
              <p style={{ margin: '3px 0 0', fontSize: 12, fontWeight: 700, color: '#6b7280', lineHeight: 1.35 }}>{desc}</p>
            </div>
            <Toggle
              checked={prefs[key]}
              onChange={(v) => update({ [key]: v } as Partial<typeof prefs>)}
            />
          </label>
        ))}
        <p style={{ margin: '10px 0 0', padding: '10px 12px', borderRadius: 12, background: '#f8fafc', fontSize: 12, fontWeight: 700, color: '#6b7280', lineHeight: 1.5 }}>
          새 일정 등록 알림은 보내지 않습니다. 일정 추가와 삭제가 잦은 흐름을 고려했습니다.
        </p>
      </div>

      {/* 방해금지 시간 */}
      <div>
        <p style={{
          margin: '0 0 8px', fontSize: 12, fontWeight: 800, color: '#6b7280',
        }}>방해금지 시간</p>

        <label style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          gap: 12, padding: '11px 0', cursor: 'pointer',
        }}>
          <div style={{ flex: 1 }}>
            <p style={{ margin: 0, fontSize: 14, fontWeight: 800, color: '#111827', lineHeight: 1.25 }}>방해금지 시간 사용</p>
            <p style={{ margin: '3px 0 0', fontSize: 12, fontWeight: 700, color: '#6b7280', lineHeight: 1.35 }}>
              설정한 시간에는 알림이 와도 무음 (배지로만 표시)
            </p>
          </div>
          <Toggle
            checked={dndEnabled}
            onChange={(v) => {
              if (v) {
                update({ quietHoursStart: localStart, quietHoursEnd: localEnd })
              } else {
                update({ quietHoursStart: null, quietHoursEnd: null })
              }
            }}
          />
        </label>

        {dndEnabled && (
          <div style={{
            display: 'flex', gap: 12, marginTop: 8, padding: '12px 14px',
            background: '#f8fafc', border: '1px solid #eef1f5', borderRadius: 12,
          }}>
            <div style={{ flex: 1 }}>
              <label style={{ display: 'block', fontSize: 11, fontWeight: 800, color: '#6b7280', marginBottom: 5 }}>시작</label>
              <input
                type="time"
                value={localStart}
                onChange={(e) => {
                  setLocalStart(e.target.value)
                  update({ quietHoursStart: e.target.value })
                }}
                style={{
                  width: '100%', padding: '8px 10px', borderRadius: 9,
                  border: '1px solid #d8dbe0', fontSize: 13, fontWeight: 700, color: '#111827',
                }}
              />
            </div>
            <div style={{ flex: 1 }}>
              <label style={{ display: 'block', fontSize: 11, fontWeight: 800, color: '#6b7280', marginBottom: 5 }}>종료</label>
              <input
                type="time"
                value={localEnd}
                onChange={(e) => {
                  setLocalEnd(e.target.value)
                  update({ quietHoursEnd: e.target.value })
                }}
                style={{
                  width: '100%', padding: '8px 10px', borderRadius: 9,
                  border: '1px solid #d8dbe0', fontSize: 13, fontWeight: 700, color: '#111827',
                }}
              />
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

function Toggle({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={(e) => {
        e.preventDefault()
        onChange(!checked)
      }}
      style={{
        position: 'relative',
        width: 42,
        height: 24,
        flexShrink: 0,
        borderRadius: 99,
        border: 'none',
        background: checked ? '#1d4ed8' : '#d8dbe0',
        cursor: 'pointer',
        transition: 'background 0.15s',
        padding: 0,
        marginLeft: 12,
      }}
    >
      <span
        style={{
          position: 'absolute',
          top: 2,
          left: checked ? 20 : 2,
          width: 20,
          height: 20,
          borderRadius: '50%',
          background: '#fff',
          transition: 'left 0.15s',
          boxShadow: '0 1px 2px rgba(16,24,40,0.18)',
        }}
      />
    </button>
  )
}
