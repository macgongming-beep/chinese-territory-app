// 알림 설정 (종류별 on/off + 방해금지 시간)
import { useState } from 'react'
import { useNotificationPrefs } from '../hooks/useNotificationPrefs'
import type { AppLanguage } from '../i18n'

type PrefKey =
  | 'pushNewNotice' | 'pushEventChange' | 'pushComment'
  | 'pushChat' | 'pushMention' | 'pushServiceStatus'

type SubItem = { key: PrefKey; labelKo: string; descKo: string; labelZh: string; descZh: string; labelEn: string; descEn: string }

type Group = {
  id: 'activity' | 'social' | 'notice'
  labelKo: string; labelZh: string; labelEn: string
  descKo: string; descZh: string; descEn: string
  items: SubItem[]
}

const GROUPS: Group[] = [
  {
    id: 'activity',
    labelKo: '봉사 활동', labelZh: '传道活动', labelEn: 'Service',
    descKo: '일정 변경 · 카드 배정 · 봉사 시작/종료', descZh: '日程变更 · 卡片分配 · 传道开始/结束', descEn: 'Event changes · Card assignment · Service start/end',
    items: [
      { key: 'pushEventChange', labelKo: '일정 변경', descKo: '봉사 시간/장소가 바뀔 때 (참여한 일정만)', labelZh: '日程变更', descZh: '传道时间/地点变更时（仅参与日程）', labelEn: 'Event update', descEn: 'When time/place changes (joined events only)' },
      { key: 'pushServiceStatus', labelKo: '봉사 시작/종료', descKo: '참여 봉사가 시작되거나 종료될 때', labelZh: '传道开始/结束', descZh: '参与的传道开始或结束时', labelEn: 'Service start/end', descEn: 'When your joined service starts or ends' },
    ],
  },
  {
    id: 'social',
    labelKo: '소통', labelZh: '交流', labelEn: 'Social',
    descKo: '채팅 · 멘션 · 댓글', descZh: '聊天 · @提及 · 评论', descEn: 'Chat · Mentions · Comments',
    items: [
      { key: 'pushChat', labelKo: '채팅 메시지', descKo: '봉사 채팅방에 새 메시지가 올 때', labelZh: '聊天消息', descZh: '传道聊天室有新消息时', labelEn: 'Chat message', descEn: 'New message in service chat' },
      { key: 'pushMention', labelKo: '@멘션', descKo: '누군가 회원님을 언급할 때', labelZh: '@提及', descZh: '有人提及您时', labelEn: '@Mention', descEn: 'When someone mentions you' },
      { key: 'pushComment', labelKo: '댓글', descKo: '내 게시물에 댓글이 달릴 때', labelZh: '评论', descZh: '我的帖子收到评论时', labelEn: 'Comment', descEn: 'When someone comments on your post' },
    ],
  },
  {
    id: 'notice',
    labelKo: '공지', labelZh: '公告', labelEn: 'Notice',
    descKo: '관리자가 새 공지를 올릴 때', descZh: '管理员发布新公告时', descEn: 'When admin posts a new notice',
    items: [
      { key: 'pushNewNotice', labelKo: '새 공지', descKo: '관리자가 새 공지를 올릴 때', labelZh: '新公告', descZh: '管理员发布新公告时', labelEn: 'New notice', descEn: 'When admin posts a new notice' },
    ],
  },
]

function gl(g: Group, lang: AppLanguage) {
  return lang === 'zh' ? g.labelZh : lang === 'en' ? g.labelEn : g.labelKo
}
function gd(g: Group, lang: AppLanguage) {
  return lang === 'zh' ? g.descZh : lang === 'en' ? g.descEn : g.descKo
}
function il(i: SubItem, lang: AppLanguage) {
  return lang === 'zh' ? i.labelZh : lang === 'en' ? i.labelEn : i.labelKo
}
function id_(i: SubItem, lang: AppLanguage) {
  return lang === 'zh' ? i.descZh : lang === 'en' ? i.descEn : i.descKo
}

export function NotificationSettings({ userId, language = 'ko' }: { userId: number; language?: string }) {
  const lang = (language ?? 'ko') as AppLanguage
  const { prefs, saving, update } = useNotificationPrefs(userId)
  const dndEnabled = prefs.quietHoursStart !== null && prefs.quietHoursEnd !== null
  const [localStart, setLocalStart] = useState(prefs.quietHoursStart ?? '22:00')
  const [localEnd, setLocalEnd] = useState(prefs.quietHoursEnd ?? '07:00')
  const [expandedGroup, setExpandedGroup] = useState<Group['id'] | null>(null)

  return (
    <div style={{ background: 'var(--surface)', borderRadius: 12, padding: 16, border: '1px solid var(--line)' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0 }}>
          <span style={{
            display: 'grid', width: 32, height: 32, placeItems: 'center',
            borderRadius: 9, background: 'var(--tint)', color: 'var(--text)',
            flexShrink: 0,
          }}>
            <svg viewBox="0 0 24 24" aria-hidden="true" style={{ width: 16, height: 16, fill: 'none', stroke: 'currentColor', strokeWidth: 1.75, strokeLinecap: 'round', strokeLinejoin: 'round' }}>
              <path d="M18 9a6 6 0 1 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9" />
              <path d="M10 21a2 2 0 0 0 4 0" />
            </svg>
          </span>
          <div style={{ minWidth: 0 }}>
            <h3 style={{ margin: 0, fontSize: 15, fontWeight: 600, color: 'var(--ink)', lineHeight: 1.3, letterSpacing: '-0.01em' }}>
              {lang === 'zh' ? '通知设置' : lang === 'en' ? 'Notification Settings' : '알림 설정'}
            </h3>
            <p style={{ margin: '2px 0 0', fontSize: 12.5, fontWeight: 500, color: 'var(--muted)' }}>
              {lang === 'zh' ? '管理接收通知和免打扰时间' : lang === 'en' ? 'Manage alerts and quiet hours' : '받을 알림과 조용한 시간 관리'}
            </p>
          </div>
        </div>
        {saving && (
          <span style={{
            flexShrink: 0, padding: '3px 9px', borderRadius: 999,
            background: 'var(--tint)', color: 'var(--muted)', fontSize: 11.5, fontWeight: 500,
          }}>
            {lang === 'zh' ? '保存中' : lang === 'en' ? 'Saving...' : '저장 중'}
          </span>
        )}
      </div>

      {/* 그룹 토글 + 세부 펼침 */}
      <div style={{ marginBottom: 16 }}>
        <p style={{
          margin: '0 0 8px', fontSize: 12.5, fontWeight: 500, color: 'var(--muted)',
        }}>{lang === 'zh' ? '接收通知类型' : lang === 'en' ? 'Notification types' : '받을 알림 종류'}</p>
        {GROUPS.map((group) => {
          const groupOn = group.items.every((item) => prefs[item.key])
          const someOn = !groupOn && group.items.some((item) => prefs[item.key])
          const isOpen = expandedGroup === group.id
          return (
            <div key={group.id} style={{ borderBottom: '1px solid var(--line)' }}>
              <div style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                gap: 12, padding: '12px 0',
              }}>
                <button
                  type="button"
                  onClick={() => setExpandedGroup(isOpen ? null : group.id)}
                  style={{
                    flex: 1, minWidth: 0, minHeight: 0, display: 'flex', alignItems: 'center', gap: 10,
                    background: 'none', border: 'none', padding: 0, textAlign: 'left',
                    cursor: 'pointer',
                  }}
                >
                  <span
                    aria-hidden
                    style={{
                      width: 6, height: 6, borderRadius: 99,
                      background: groupOn ? 'var(--ink)' : 'var(--muted-2)', flexShrink: 0,
                    }}
                  />
                  <span style={{ flex: 1, minWidth: 0 }}>
                    <span style={{ display: 'block', fontSize: 14, fontWeight: 600, color: 'var(--ink)', lineHeight: 1.3 }}>
                      {gl(group, lang)}
                      {someOn && <em style={{ fontStyle: 'normal', marginLeft: 6, fontSize: 11.5, color: 'var(--muted)' }}>{lang === 'zh' ? '(部分)' : lang === 'en' ? '(partial)' : '(일부)'}</em>}
                    </span>
                    <span style={{ display: 'block', marginTop: 2, fontSize: 12.5, fontWeight: 500, color: 'var(--muted)', lineHeight: 1.4 }}>
                      {gd(group, lang)}
                    </span>
                  </span>
                  <span aria-hidden style={{ color: 'var(--muted-2)', fontSize: 14, transform: isOpen ? 'rotate(0deg)' : 'rotate(-90deg)', transition: 'transform 0.15s' }}>
                    ⌄
                  </span>
                </button>
                <Toggle
                  checked={groupOn}
                  onChange={(v) => {
                    const patch: Partial<typeof prefs> = {}
                    group.items.forEach((item) => { (patch as Record<string, boolean>)[item.key] = v })
                    update(patch)
                  }}
                />
              </div>
              {isOpen && (
                <div style={{ paddingBottom: 10 }}>
                  {group.items.map((item) => (
                    <label
                      key={item.key}
                      style={{
                        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                        gap: 12, padding: '8px 12px 8px 28px',
                        cursor: 'pointer',
                      }}
                    >
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: 'var(--text)', lineHeight: 1.3 }}>{il(item, lang)}</p>
                        <p style={{ margin: '2px 0 0', fontSize: 11.5, color: 'var(--muted)', lineHeight: 1.4 }}>{id_(item, lang)}</p>
                      </div>
                      <Toggle
                        checked={prefs[item.key]}
                        onChange={(v) => update({ [item.key]: v } as Partial<typeof prefs>)}
                      />
                    </label>
                  ))}
                </div>
              )}
            </div>
          )
        })}
        <p style={{ margin: '12px 0 0', padding: '10px 12px', borderRadius: 10, background: 'var(--paper)', fontSize: 12, fontWeight: 500, color: 'var(--muted)', lineHeight: 1.5 }}>
          {lang === 'zh' ? '不发送新日程添加通知。展开分组可单独开关详细通知。' : lang === 'en' ? 'New event creation alerts are not sent. Expand a group to toggle individual alerts.' : '새 일정 등록 알림은 보내지 않습니다. 그룹을 펼치면 세부 알림을 따로 켜고 끌 수 있어요.'}
        </p>
      </div>

      {/* 방해금지 시간 */}
      <div>
        <p style={{
          margin: '0 0 8px', fontSize: 12.5, fontWeight: 500, color: 'var(--muted)',
        }}>{lang === 'zh' ? '免打扰时间' : lang === 'en' ? 'Quiet hours' : '방해금지 시간'}</p>

        <label style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          gap: 12, padding: '11px 0', cursor: 'pointer',
        }}>
          <div style={{ flex: 1 }}>
            <p style={{ margin: 0, fontSize: 14, fontWeight: 600, color: 'var(--ink)', lineHeight: 1.3 }}>{lang === 'zh' ? '启用免打扰时间' : lang === 'en' ? 'Enable quiet hours' : '방해금지 시간 사용'}</p>
            <p style={{ margin: '2px 0 0', fontSize: 12.5, fontWeight: 500, color: 'var(--muted)', lineHeight: 1.4 }}>
              {lang === 'zh' ? '设定时间内收到通知仅显示角标，不响铃' : lang === 'en' ? 'Notifications silenced during this time (badge only)' : '설정한 시간에는 알림이 와도 무음 (배지로만 표시)'}
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
            background: 'var(--paper)', border: '1px solid var(--line)', borderRadius: 10,
          }}>
            <div style={{ flex: 1 }}>
              <label style={{ display: 'block', fontSize: 11.5, fontWeight: 500, color: 'var(--muted)', marginBottom: 5 }}>{lang === 'zh' ? '开始' : lang === 'en' ? 'Start' : '시작'}</label>
              <input
                type="time"
                value={localStart}
                onChange={(e) => {
                  setLocalStart(e.target.value)
                  update({ quietHoursStart: e.target.value })
                }}
                style={{
                  width: '100%', padding: '8px 10px', borderRadius: 8,
                  border: '1px solid var(--line)', fontSize: 13, fontWeight: 600, color: 'var(--ink)',
                  background: 'var(--surface)',
                }}
              />
            </div>
            <div style={{ flex: 1 }}>
              <label style={{ display: 'block', fontSize: 11.5, fontWeight: 500, color: 'var(--muted)', marginBottom: 5 }}>{lang === 'zh' ? '结束' : lang === 'en' ? 'End' : '종료'}</label>
              <input
                type="time"
                value={localEnd}
                onChange={(e) => {
                  setLocalEnd(e.target.value)
                  update({ quietHoursEnd: e.target.value })
                }}
                style={{
                  width: '100%', padding: '8px 10px', borderRadius: 8,
                  border: '1px solid var(--line)', fontSize: 13, fontWeight: 600, color: 'var(--ink)',
                  background: 'var(--surface)',
                }}
              />
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

// 디자인 09 의 .toggle 매칭 (40×24 트랙, 18 노브, ink on)
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
        width: 40,
        height: 24,
        minHeight: 24,
        flexShrink: 0,
        borderRadius: 99,
        border: 'none',
        background: checked ? 'var(--ink)' : 'var(--line)',
        cursor: 'pointer',
        transition: 'background 0.18s',
        padding: 0,
        marginLeft: 12,
      }}
    >
      <span
        style={{
          position: 'absolute',
          top: 3,
          left: checked ? 19 : 3,
          width: 18,
          height: 18,
          borderRadius: '50%',
          background: '#fff',
          transition: 'left 0.18s',
          boxShadow: '0 1px 3px rgba(0,0,0,0.18)',
        }}
      />
    </button>
  )
}
