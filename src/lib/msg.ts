// 알림 배너(토스트)·오류 문구 번역
//
// 왜 t(key) 가 아니라 한국어 문장을 그대로 열쇠로 쓰나:
//   토스트 문구는 300개가 넘고 코드 곳곳에 흩어져 있다. 하나하나 키를 붙이면
//   옮기는 과정에서 빠지거나 엉뚱한 키를 가리키기 쉽다. 한국어 문장을 열쇠로
//   두면 옮기는 작업이 기계적이고, 사전에 없는 문장은 한국어 그대로 나와서
//   최악의 경우에도 지금과 같다 (빈 화면·키 이름 노출 같은 사고가 없다).
//
// 쓰는 법:
//   showToast(msg('구역선이 삭제됐습니다'))
//   showToast(msg('{name} 건물이 추가됐습니다', { name: building.name }))
//
// 새 문구를 추가할 때는 locales/messages.zh.ts / messages.en.ts 에도 넣어 준다.
// 안 넣어도 동작은 한다 (한국어로 표시).

import { currentLang } from '../i18n'
import { messagesZh } from '../locales/messages.zh'
import { messagesEn } from '../locales/messages.en'

export function msg(korean: string, vars?: Record<string, string | number | undefined>): string {
  const lang = currentLang()
  const dict = lang === 'zh' ? messagesZh : lang === 'en' ? messagesEn : null
  const template = dict?.[korean] ?? korean
  if (!vars) return template
  return template.replace(/\{(\w+)\}/g, (whole: string, name: string) => {
    const value = vars[name]
    return value === undefined ? whole : String(value)
  })
}
