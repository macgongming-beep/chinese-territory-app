import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { RestaurantRegistrationModal } from './RestaurantRegistrationModal'
import type { Building } from '../types'

const buildings = [{
  id: 7, cardId: 1, name: '우정원', address: '용인시 우정원길 1', type: '상가',
  lat: 0, lng: 0, warning: false, isRestaurant: false,
  units: [{ id: 70, buildingId: 7, number: '기존식당', status: '미방문', isChinese: false, isRestaurant: true, memo: '' }],
}] as Building[]

describe('RestaurantRegistrationModal', () => {
  it('새 상가와 식당 이름을 함께 넘긴다', async () => {
    const onRegister = vi.fn().mockResolvedValue(true)
    const onClose = vi.fn()
    render(<RestaurantRegistrationModal buildings={buildings} onRegister={onRegister} onClose={onClose} />)
    fireEvent.change(screen.getByLabelText('식당 이름'), { target: { value: '새 식당' } })
    fireEvent.change(screen.getByLabelText('주소'), { target: { value: '용인시 새길 2' } })
    fireEvent.click(screen.getByRole('button', { name: '등록' }))
    await waitFor(() => expect(onRegister).toHaveBeenCalledWith({
      name: '새 식당', address: '용인시 새길 2', existingBuildingId: null,
      isChinese: true, initialState: '미방문', regularVisitor: null,
    }))
    expect(onClose).toHaveBeenCalledOnce()
  })

  it('식당 이름까지 검색해 기존 상가를 고른다', async () => {
    const onRegister = vi.fn().mockResolvedValue(true)
    render(<RestaurantRegistrationModal buildings={buildings} onRegister={onRegister} onClose={vi.fn()} />)
    fireEvent.change(screen.getByLabelText('식당 이름'), { target: { value: '두번째 식당' } })
    fireEvent.click(screen.getByLabelText('기존 건물'))
    fireEvent.change(screen.getByLabelText('건물 검색'), { target: { value: '기존식당' } })
    fireEvent.change(screen.getByLabelText('기존 건물', { selector: 'select' }), { target: { value: '7' } })
    fireEvent.click(screen.getByRole('button', { name: '등록' }))
    await waitFor(() => expect(onRegister).toHaveBeenCalledWith({
      name: '두번째 식당', address: '용인시 우정원길 1', existingBuildingId: 7,
      isChinese: true, initialState: '미방문', regularVisitor: null,
    }))
  })

  it('저장 실패 시 입력을 유지하고 다시 시도할 수 있다', async () => {
    const onRegister = vi.fn().mockResolvedValueOnce(false).mockResolvedValueOnce(true)
    render(<RestaurantRegistrationModal buildings={[]} onRegister={onRegister} onClose={vi.fn()} />)
    fireEvent.change(screen.getByLabelText('식당 이름'), { target: { value: '다시 식당' } })
    fireEvent.change(screen.getByLabelText('주소'), { target: { value: '용인시 다시길 3' } })
    fireEvent.click(screen.getByRole('button', { name: '등록' }))
    await screen.findByRole('alert')
    expect((screen.getByLabelText('식당 이름') as HTMLInputElement).value).toBe('다시 식당')
    fireEvent.click(screen.getByRole('button', { name: '등록' }))
    await waitFor(() => expect(onRegister).toHaveBeenCalledTimes(2))
  })

  it('정기방문은 담당자를 받고 중국어 여부와 함께 넘긴다', async () => {
    localStorage.setItem('currentVisitor', '김진수')
    const onRegister = vi.fn().mockResolvedValue(true)
    render(<RestaurantRegistrationModal buildings={[]} onRegister={onRegister} onClose={vi.fn()} />)
    fireEvent.change(screen.getByLabelText('식당 이름'), { target: { value: '정기 식당' } })
    fireEvent.change(screen.getByLabelText('주소'), { target: { value: '용인시 새길 4' } })
    fireEvent.change(screen.getByLabelText('현재 상태'), { target: { value: '정기방문' } })
    fireEvent.click(screen.getByLabelText('중국어를 사용하는 식당'))
    fireEvent.click(screen.getByRole('button', { name: '등록' }))
    await waitFor(() => expect(onRegister).toHaveBeenCalledWith(expect.objectContaining({
      initialState: '정기방문', regularVisitor: '김진수', isChinese: false,
    })))
  })

  it('주소로 찾은 기존 건물을 선택한다', () => {
    render(<RestaurantRegistrationModal buildings={buildings} onRegister={vi.fn()} onClose={vi.fn()} />)
    fireEvent.change(screen.getByLabelText('주소'), { target: { value: '우정원길 1' } })
    fireEvent.click(screen.getByRole('button', { name: /우정원/ }))
    expect((screen.getByLabelText('기존 건물', { selector: 'select' }) as HTMLSelectElement).value).toBe('7')
  })
})
