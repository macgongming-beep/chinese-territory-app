// 알림 문구 번역 (푸시 알림 + 앱 안 알림 목록 공용)
//
// 알림 문구는 서버(DB)에서 만들어진다. 서버는 받는 사람이 앱을 어떤 언어로
// 쓰는지 모르므로, 문구를 한국어로 보내고 **받는 기기에서** 번역한다.
// 그래서 이 파일은 서비스 워커(sw.ts)와 앱(NotificationCenter) 양쪽에서 쓰인다.
//
// 한계: 본문에는 일정 이름·구역 이름 같은 실제 데이터가 섞여 있어 그 부분은
//       한국어로 남는다 (앱 화면에서도 마찬가지라 어색하지 않다).

import type { AppLanguage } from '../i18n'
import { messagesZh } from '../locales/messages.zh'
import { messagesEn } from '../locales/messages.en'

// 숫자 등이 끼어 있어 통째로 찾을 수 없는 제목들
const PATTERNS: Array<{ re: RegExp; zh: (m: RegExpMatchArray) => string; en: (m: RegExpMatchArray) => string }> = [
  {
    re: /^시스템: (.*)님이 합류했습니다\.$/,
    zh: (m) => `系统：${m[1]} 已加入。`,
    en: (m) => `System: ${m[1]} joined.`,
  },
  {
    re: /^오늘 봉사 마련 (\d+)건$/,
    zh: (m) => `今日传道安排 ${m[1]} 项`,
    en: (m) => `${m[1]} service arrangements today`,
  },
]

export function translateNotificationText(text: string | null | undefined, lang: AppLanguage): string {
  if (!text) return ''
  if (lang === 'ko') return text

  const dict = lang === 'zh' ? messagesZh : messagesEn
  const exact = dict[text]
  if (exact) return exact

  for (const p of PATTERNS) {
    const m = text.match(p.re)
    if (m) return lang === 'zh' ? p.zh(m) : p.en(m)
  }

  // 본문처럼 데이터가 섞인 문구는 앞부분만 번역해 준다
  //   예: '봉사 일정 · 2026-08-11 13:00 · 처인구 마평동 1'
  const sepIndex = text.indexOf(' · ')
  if (sepIndex > 0) {
    const head = text.slice(0, sepIndex)
    const headTranslated = dict[head]
    if (headTranslated) return headTranslated + text.slice(sepIndex)
  }

  return text
}
