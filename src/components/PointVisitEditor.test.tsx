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
