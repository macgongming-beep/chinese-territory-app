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
    <div style={{ background: '#fff', borderRadius: 12, padding: 16, border: '1px solid #e2e8f0' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
        <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: '#1e293b' }}>
          🔔 알림 설정
        </h3>
        {saving && <span style={{ fontSize: 11, color: '#94a3b8' }}>저장 중...</span>}
      </div>

      {/* 종류별 토글 */}
      <div style={{ marginBottom: 18 }}>
        <p style={{
          margin: '0 0 8px', fontSize: 11, fontWeight: 700, color: '#94a3b8',
          letterSpacing: '0.04em', textTransform: 'uppercase',
        }}>받을 알림 종류</p>
        {TYPES.map(({ key, label, desc }) => (
          <label
            key={key}
            style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              padding: '10px 0', borderBottom: '1px solid #f1f5f9',
              cursor: 'pointer',
            }}
          >
            <div style={{ flex: 1, minWidth: 0 }}>
              <p style={{ margin: 0, fontSize: 14, fontWeight: 600, color: '#1e293b' }}>{label}</p>
              <p style={{ margin: '2px 0 0', fontSize: 12, color: '#64748b' }}>{desc}</p>
            </div>
            <Toggle
              checked={prefs[key]}
              onChange={(v) => update({ [key]: v } as Partial<typeof prefs>)}
            />
          </label>
        ))}
        <p style={{ margin: '8px 0 0', fontSize: 11, color: '#94a3b8', lineHeight: 1.5 }}>
          ⓘ 새 일정 등록 시 알림은 보내지 않습니다 (일정 추가/삭제가 잦음)
        </p>
      </div>

      {/* 방해금지 시간 */}
      <div>
        <p style={{
          margin: '0 0 8px', fontSize: 11, fontWeight: 700, color: '#94a3b8',
          letterSpacing: '0.04em', textTransform: 'uppercase',
        }}>방해금지 시간</p>

        <label style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '10px 0', cursor: 'pointer',
        }}>
          <div style={{ flex: 1 }}>
            <p style={{ margin: 0, fontSize: 14, fontWeight: 600, color: '#1e293b' }}>방해금지 시간 사용</p>
            <p style={{ margin: '2px 0 0', fontSize: 12, color: '#64748b' }}>
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
            background: '#f8fafc', borderRadius: 8,
          }}>
            <div style={{ flex: 1 }}>
              <label style={{ display: 'block', fontSize: 11, color: '#64748b', marginBottom: 4 }}>시작</label>
              <input
                type="time"
                value={localStart}
                onChange={(e) => {
                  setLocalStart(e.target.value)
                  update({ quietHoursStart: e.target.value })
                }}
                style={{
                  width: '100%', padding: '7px 10px', borderRadius: 7,
                  border: '1px solid #e2e8f0', fontSize: 13, color: '#1e293b',
                }}
              />
            </div>
            <div style={{ flex: 1 }}>
              <label style={{ display: 'block', fontSize: 11, color: '#64748b', marginBottom: 4 }}>종료</label>
              <input
                type="time"
                value={localEnd}
                onChange={(e) => {
                  setLocalEnd(e.target.value)
                  update({ quietHoursEnd: e.target.value })
                }}
                style={{
                  width: '100%', padding: '7px 10px', borderRadius: 7,
                  border: '1px solid #e2e8f0', fontSize: 13, color: '#1e293b',
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
        background: checked ? '#2563eb' : '#cbd5e1',
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
          boxShadow: '0 1px 3px rgba(0,0,0,0.15)',
        }}
      />
    </button>
  )
}
