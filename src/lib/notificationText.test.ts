import { describe, it, expect } from 'vitest'
import { translateNotificationText } from './notificationText'

describe('translateNotificationText', () => {
  it('한국어는 그대로', () => {
    expect(translateNotificationText('봉사 카드가 배정되었습니다', 'ko')).toBe('봉사 카드가 배정되었습니다')
  })

  it('서버가 보낸 알림 제목을 번역한다', () => {
    expect(translateNotificationText('봉사 카드가 배정되었습니다', 'zh')).toBe('已分配传道卡片')
    expect(translateNotificationText('새 공지', 'en')).toBe('New notice')
  })

  it('숫자가 들어간 제목도 번역한다', () => {
    expect(translateNotificationText('오늘 봉사 마련 3건', 'zh')).toBe('今日传道安排 3 项')
    expect(translateNotificationText('오늘 봉사 마련 1건', 'en')).toBe('1 service arrangements today')
  })

  it('이름이 들어간 시스템 문구도 번역한다', () => {
    expect(translateNotificationText('시스템: 장웅님이 합류했습니다.', 'zh')).toBe('系统：장웅 已加入。')
  })

  it('가입 승인 알림의 제목과 신청자 이름이 든 본문을 번역한다', () => {
    expect(translateNotificationText('새 가입 승인 요청', 'zh')).toBe('新注册审批请求')
    expect(translateNotificationText('장웅님의 가입 신청을 확인해 주세요.', 'en')).toBe("Please review 장웅's signup request.")
  })

  it('본문 앞부분만 사전에 있으면 그 부분만 바꾸고 데이터는 보존한다', () => {
    const body = '봉사 일정 · 2026-08-11 13:00 · 처인구 마평동 1'
    expect(translateNotificationText(body, 'zh')).toBe('传道日程 · 2026-08-11 13:00 · 처인구 마평동 1')
  })

  it('모르는 문구는 그대로 (알림이 비어 보이지 않게)', () => {
    expect(translateNotificationText('처인구 마평동 1 배정', 'zh')).toBe('처인구 마평동 1 배정')
  })

  it('빈 값도 안전하다', () => {
    expect(translateNotificationText(null, 'zh')).toBe('')
    expect(translateNotificationText(undefined, 'en')).toBe('')
  })
})
