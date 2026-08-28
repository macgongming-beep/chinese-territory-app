// 점검 공지 읽기 — 언어별 본문과 fallback.
//
// ⚠ 여기가 조용히 틀리기 쉽다: 번역을 안 넣었는데 **빈 화면**이 뜨면
//   중국어 쓰는 사람은 안내를 아예 못 본다. 한국어로 떨어져야 한다.
import { describe, test, expect, vi, beforeEach } from 'vitest'

const rows = vi.hoisted(() => ({ data: [] as Array<{ key: string; value: string }>, error: null as unknown }))
vi.mock('../../lib/supabase', () => ({
  supabase: { from: () => ({ select: () => ({ in: () => Promise.resolve(rows) }) }) },
}))
const { fetchMaintenanceNotice } = await import('./appSettings')

const set = (o: Record<string, string>) => {
  rows.data = Object.entries(o).map(([key, value]) => ({ key, value }))
  rows.error = null
}
beforeEach(() => { rows.data = []; rows.error = null })

describe('점검 공지 읽기', () => {
  test('한국어 칸이 비면 공지가 없는 것이다 (끄기는 그 한 칸만 비운다)', async () => {
    set({ maintenance_notice: '', maintenance_notice_zh: '有通知' })
    expect(await fetchMaintenanceNotice('zh')).toBeNull()
  })

  test('중국어 사용자는 중국어 본문을 받는다', async () => {
    set({ maintenance_notice: '한국어', maintenance_notice_zh: '中文', maintenance_notice_en: 'English' })
    expect((await fetchMaintenanceNotice('zh'))?.message).toBe('中文')
    expect((await fetchMaintenanceNotice('en'))?.message).toBe('English')
    expect((await fetchMaintenanceNotice('ko'))?.message).toBe('한국어')
  })

  test('⚠ 번역이 없으면 **한국어로 떨어진다** — 빈 화면이 되면 안 된다', async () => {
    set({ maintenance_notice: '한국어만 있음' })
    expect((await fetchMaintenanceNotice('zh'))?.message).toBe('한국어만 있음')
    expect((await fetchMaintenanceNotice('en'))?.message).toBe('한국어만 있음')
  })

  test('번역 칸이 공백뿐이어도 한국어로 떨어진다', async () => {
    set({ maintenance_notice: '한국어', maintenance_notice_zh: '   ' })
    expect((await fetchMaintenanceNotice('zh'))?.message).toBe('한국어')
  })

  test('id 가 없으면 default (없다고 팝업이 안 뜨면 안 된다)', async () => {
    set({ maintenance_notice: '본문' })
    expect((await fetchMaintenanceNotice('ko'))?.id).toBe('default')
  })

  test('읽기가 실패해도 앱을 막지 않는다', async () => {
    // ⚠ `data: []` 로 시험하면 안 된다 — 오류 처리를 빼도 어차피 null 이라
    //   **어느 쪽이든 통과**한다 (변형 검사에서 잡혔다).
    //   실패하면 supabase 는 data 를 null 로 준다. 그래야 가드를 뺐을 때 던진다.
    rows.data = null as unknown as Array<{ key: string; value: string }>
    rows.error = new Error('네트워크')
    expect(await fetchMaintenanceNotice('ko')).toBeNull()
  })
})
