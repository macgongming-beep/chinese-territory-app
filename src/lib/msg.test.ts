import { describe, it, expect, afterEach } from 'vitest'
import { msg } from './msg'
import { setCurrentLang } from '../i18n'
import { messagesZh } from '../locales/messages.zh'
import { messagesEn } from '../locales/messages.en'

afterEach(() => setCurrentLang('ko'))

describe('msg', () => {
  it('한국어일 때는 원문 그대로', () => {
    setCurrentLang('ko')
    expect(msg('구역선이 삭제됐습니다')).toBe('구역선이 삭제됐습니다')
  })

  it('언어를 바꾸면 번역된 문구', () => {
    setCurrentLang('zh')
    expect(msg('구역선이 삭제됐습니다')).toBe('已删除区域线')
    setCurrentLang('en')
    expect(msg('구역선이 삭제됐습니다')).toBe('Boundary deleted')
  })

  it('사전에 없는 문장은 한국어 그대로 (빈 화면·키 노출 방지)', () => {
    setCurrentLang('zh')
    expect(msg('아직 번역하지 않은 새 문구')).toBe('아직 번역하지 않은 새 문구')
  })

  it('값을 끼워 넣는다', () => {
    setCurrentLang('ko')
    expect(msg('건물 {length}개가 삭제됐습니다', { length: 3 })).toBe('건물 3개가 삭제됐습니다')
    setCurrentLang('en')
    expect(msg('건물 {length}개가 삭제됐습니다', { length: 3 })).toBe('3 buildings deleted')
  })

  it('값이 없으면 자리표시자를 그대로 둔다 (문장 유실 방지)', () => {
    setCurrentLang('ko')
    expect(msg('건물 {length}개가 삭제됐습니다', {})).toBe('건물 {length}개가 삭제됐습니다')
  })

  it('중국어·영어 사전의 열쇠가 서로 같다 (한쪽만 빠지는 것 방지)', () => {
    expect(Object.keys(messagesZh).sort()).toEqual(Object.keys(messagesEn).sort())
  })

  it('번역문의 자리표시자가 원문과 일치한다', () => {
    const holders = (s: string) => (s.match(/\{(\w+)\}/g) ?? []).sort().join(',')
    const mismatched: string[] = []
    for (const [ko, zh] of Object.entries(messagesZh)) {
      if (holders(ko) !== holders(zh)) mismatched.push(`zh: ${ko}`)
    }
    for (const [ko, en] of Object.entries(messagesEn)) {
      if (holders(ko) !== holders(en)) mismatched.push(`en: ${ko}`)
    }
    expect(mismatched).toEqual([])
  })
})
