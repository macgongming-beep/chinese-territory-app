import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, test, vi } from 'vitest'
import { RestaurantServiceSheet } from './RestaurantServiceSheet'
import { setCurrentLang } from '../i18n'

afterEach(() => setCurrentLang('ko'))

describe('RestaurantServiceSheet 식당 추가 신청', () => {
  test('중국어 검색 빈 상태와 추가 신청에 한국어를 남기지 않는다', () => {
    setCurrentLang('zh')
    render(<RestaurantServiceSheet
      role="user"
      buildings={[]}
      cards={[]}
      visitHistories={[]}
      currentVisitor="金真秀"
      onStartSession={vi.fn()}
      onSubmitRequest={vi.fn()}
      onClose={vi.fn()}
      language="zh"
    />)

    fireEvent.change(screen.getByPlaceholderText('搜索餐厅名称或地址'), { target: { value: 'Jjj' } })
    expect(screen.getByText('没有找到“Jjj”')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: '申请添加这家餐厅' }))
    expect(screen.getByText('餐厅名称')).toBeTruthy()
    expect(screen.getByLabelText('当前状态')).toBeTruthy()
    expect(screen.getByRole('button', { name: '申请添加' })).toBeTruthy()
  })

  test('방문 상태·중국어 여부·정기방문 담당자를 함께 넘긴다', async () => {
    const onSubmitRequest = vi.fn().mockResolvedValue(true)
    render(<RestaurantServiceSheet
      role="user"
      buildings={[]}
      cards={[]}
      visitHistories={[]}
      currentVisitor="김진수"
      onStartSession={vi.fn()}
      onSubmitRequest={onSubmitRequest}
      onClose={vi.fn()}
      language="ko"
    />)

    fireEvent.change(screen.getByPlaceholderText(/식당/), { target: { value: '새 식당' } })
    fireEvent.click(screen.getByRole('button', { name: /이 식당 추가 신청/ }))
    fireEvent.change(screen.getByPlaceholderText('예: 청명남로 16'), { target: { value: '용인시 새길 3' } })
    fireEvent.change(screen.getByLabelText('현재 상태'), { target: { value: '정기방문' } })
    fireEvent.click(screen.getByLabelText('중국어를 사용하는 식당'))
    fireEvent.click(screen.getByRole('button', { name: '추가 신청' }))

    await waitFor(() => expect(onSubmitRequest).toHaveBeenCalledWith({
      name: '새 식당',
      address: '용인시 새길 3',
      memo: '',
      isChinese: false,
      initialState: '정기방문',
      regularVisitor: '김진수',
    }))
  })

  test('신청 저장이 거부되면 입력 화면과 값이 남는다', async () => {
    const onSubmitRequest = vi.fn().mockResolvedValue(false)
    render(<RestaurantServiceSheet
      role="user"
      buildings={[]}
      cards={[]}
      visitHistories={[]}
      currentVisitor="김진수"
      onStartSession={vi.fn()}
      onSubmitRequest={onSubmitRequest}
      onClose={vi.fn()}
      language="ko"
    />)

    fireEvent.change(screen.getByPlaceholderText(/식당/), { target: { value: '남아야 할 식당' } })
    fireEvent.click(screen.getByRole('button', { name: /이 식당 추가 신청/ }))
    const address = screen.getByPlaceholderText('예: 청명남로 16')
    fireEvent.change(address, { target: { value: '용인시 남을길 4' } })
    fireEvent.click(screen.getByRole('button', { name: '추가 신청' }))

    await waitFor(() => expect(onSubmitRequest).toHaveBeenCalledTimes(1))
    expect(screen.getByDisplayValue('남아야 할 식당')).toBeTruthy()
    expect(screen.getByDisplayValue('용인시 남을길 4')).toBeTruthy()
  })
})
