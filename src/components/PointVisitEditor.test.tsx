// 편집기 자체의 동작. 조립 테스트가 안 덮는 것들이다.
import { describe, test, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { PointVisitEditor, type VisitDraft } from './PointVisitEditor'

const initial: VisitDraft = { result: '미방문', timeSlot: '오전', visitedAt: '2026-08-24', memo: '' }

function setup(over: Partial<Parameters<typeof PointVisitEditor>[0]> = {}) {
  const onSave = vi.fn()
  const onClose = vi.fn()
  render(<PointVisitEditor mode="add" label="언동로빌라 · 101호" initial={initial} onClose={onClose} onSave={onSave} {...over} />)
  return { onSave, onClose }
}
const save = () => screen.getByRole('button', { name: '저장' })

describe('PointVisitEditor', () => {
  test('초기값을 그대로 보여 준다', () => {
    setup()
    expect(screen.getByDisplayValue('2026-08-24')).toBeTruthy()
    expect(screen.getByDisplayValue('오전')).toBeTruthy()
    expect(screen.getByText('언동로빌라 · 101호')).toBeTruthy()
  })

  test('수정 모드면 제목이 다르다 — 새로 쓰는 줄 알고 덮으면 안 된다', () => {
    setup({ mode: 'edit' })
    expect(screen.getByText('방문 기록 수정')).toBeTruthy()
  })

  test('고친 값만 바뀌고 나머지는 초기값 그대로 나간다', async () => {
    const user = userEvent.setup()
    const { onSave } = setup()

    await user.selectOptions(screen.getByDisplayValue('미방문'), '만남')
    await user.type(screen.getByPlaceholderText('방문 당시 메모'), '문 열어줌')
    await user.click(save())

    expect(onSave).toHaveBeenCalledWith({
      result: '만남', timeSlot: '오전', visitedAt: '2026-08-24', memo: '문 열어줌',
    })
  })

  test('날짜를 비우면 저장을 막는다', async () => {
    const user = userEvent.setup()
    const { onSave } = setup()

    await user.clear(screen.getByDisplayValue('2026-08-24'))
    expect(save()).toHaveProperty('disabled', true)
    await user.click(save())
    expect(onSave).not.toHaveBeenCalled()
  })

  test('두 번 눌러도 부모가 두 번 받는다 — 중복 방지는 부모 몫임을 못 박는다', async () => {
    const user = userEvent.setup()
    const { onSave } = setup()
    await user.click(save())
    await user.click(save())
    // 편집기는 저장 결과를 모른다 (동기 콜백). 막는다면 부모가 막아야 한다.
    expect(onSave).toHaveBeenCalledTimes(2)
  })

  test('취소는 저장하지 않고 닫는다', async () => {
    const user = userEvent.setup()
    const { onSave, onClose } = setup()
    await user.click(screen.getByRole('button', { name: '취소' }))
    expect(onSave).not.toHaveBeenCalled()
    expect(onClose).toHaveBeenCalled()
  })
})

describe('방문자 고르기', () => {
  const OPTIONS = ['김휘민', '박진호', '정찬양']

  test('⚠ 목록을 안 주면 방문자 칸이 **아예 없다** — 일반 사용자에게 보이면 안 된다', () => {
    setup({ mode: 'edit' })
    expect(screen.queryByText('방문자')).toBeNull()
  })

  test('목록을 주면 칸이 보이고 현재 방문자가 선택돼 있다', () => {
    setup({ mode: 'edit', initial: { ...initial, visitor: '박진호' }, visitorOptions: OPTIONS })
    expect(screen.getByText('방문자')).toBeTruthy()
    expect((screen.getByDisplayValue('박진호') as HTMLSelectElement).value).toBe('박진호')
  })

  test('바꾸면 그 이름으로 저장된다', async () => {
    const user = userEvent.setup()
    const { onSave } = setup({
      mode: 'edit', initial: { ...initial, visitor: '박진호' }, visitorOptions: OPTIONS,
    })
    onSave.mockResolvedValue(true)
    await user.selectOptions(screen.getByDisplayValue('박진호'), '정찬양')
    await user.click(save())
    expect(onSave).toHaveBeenCalledWith(expect.objectContaining({ visitor: '정찬양' }))
  })

  test('⚠ 목록에 없는 이름도 유지된다 — 탈퇴·개명한 사람의 기록이 남의 것이 되면 안 된다', () => {
    setup({ mode: 'edit', initial: { ...initial, visitor: '위팅' }, visitorOptions: OPTIONS })
    const select = screen.getByDisplayValue('위팅') as HTMLSelectElement
    expect(select.value).toBe('위팅')
    expect([...select.options].map((o) => o.value)).toContain('위팅')
  })

  test('방문자를 안 건드리면 원래 이름 그대로 나간다', async () => {
    const user = userEvent.setup()
    const { onSave } = setup({
      mode: 'edit', initial: { ...initial, visitor: '박진호' }, visitorOptions: OPTIONS,
    })
    onSave.mockResolvedValue(true)
    await user.click(save())
    expect(onSave).toHaveBeenCalledWith(expect.objectContaining({ visitor: '박진호' }))
  })
})
