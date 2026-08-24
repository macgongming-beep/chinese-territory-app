// 모달 자체의 동작. 조립 테스트(DesktopTerritory.addBuilding)가 안 덮는 것들이다.
//
// 좌표 찾기는 사용자가 저장 전에 눌러 확인하는 단계다. 여기가 깨지면
// "핀 없이 생성됩니다" 를 못 보고 저장해 버린다 — 지도에 안 뜨는 건물이 생긴다.
import { describe, test, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { AddBuildingModal } from './AddBuildingModal'
import { testCard } from '../test/territoryFixture'

function setup(geocode: ReturnType<typeof vi.fn>) {
  const onSubmit = vi.fn(async () => true)
  const onClose = vi.fn()
  render(
    <AddBuildingModal
      cards={[testCard(1, '수지구 죽전동 1')]}
      onClose={onClose}
      onGeocode={geocode}
      onSubmit={onSubmit}
    />,
  )
  return { onSubmit, onClose }
}

const address = () => screen.getByPlaceholderText(/경기도 용인시/)

describe('AddBuildingModal — 좌표 찾기', () => {
  test('찾으면 좌표를 보여 준다', async () => {
    const user = userEvent.setup()
    setup(vi.fn(async () => ({ lat: 37.12345, lng: 127.6789 })))

    await user.type(address(), '경기도 용인시 수지구 죽전동 1')
    await user.click(screen.getByRole('button', { name: '좌표 찾기' }))

    expect(await screen.findByText(/좌표 확인/)).toBeTruthy()
    expect(screen.getByText(/37\.12345/)).toBeTruthy()
  })

  test('못 찾으면 핀 없이 생성된다고 알린다', async () => {
    const user = userEvent.setup()
    setup(vi.fn(async () => null))

    await user.type(address(), '없는 주소')
    await user.click(screen.getByRole('button', { name: '좌표 찾기' }))

    expect(await screen.findByText(/핀 없이 건물이 생성됩니다/)).toBeTruthy()
  })

  test('주소를 고치면 찾아 둔 좌표를 버린다', async () => {
    const user = userEvent.setup()
    setup(vi.fn(async () => ({ lat: 37.5, lng: 127.1 })))

    await user.type(address(), '첫 주소')
    await user.click(screen.getByRole('button', { name: '좌표 찾기' }))
    expect(await screen.findByText(/좌표 확인/)).toBeTruthy()

    // 옛 좌표가 남아 있으면 엉뚱한 자리에 핀이 꽂힌다
    await user.type(address(), '2')
    expect(screen.queryByText(/좌표 확인/)).toBeNull()
  })

  test('주소가 비면 좌표 찾기를 못 누른다', () => {
    setup(vi.fn())
    expect(screen.getByRole('button', { name: '좌표 찾기' })).toHaveProperty('disabled', true)
  })

  test('이미 찾은 좌표가 있으면 저장할 때 다시 찾지 않는다', async () => {
    const user = userEvent.setup()
    const geocode = vi.fn(async () => ({ lat: 37.5, lng: 127.1 }))
    const { onSubmit } = setup(geocode)

    await user.type(address(), '경기도 용인시 수지구 죽전동 1')
    await user.click(screen.getByRole('button', { name: '좌표 찾기' }))
    await screen.findByText(/좌표 확인/)
    await user.click(screen.getByRole('button', { name: '건물 추가' }))

    expect(geocode).toHaveBeenCalledTimes(1)
    expect(onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({ address: '경기도 용인시 수지구 죽전동 1' }),
      { lat: 37.5, lng: 127.1 },
    )
  })

  test('카드를 직접 고르면 그대로 넘긴다', async () => {
    const user = userEvent.setup()
    const { onSubmit } = setup(vi.fn(async () => null))

    await user.type(address(), '어딘가')
    await user.selectOptions(screen.getByDisplayValue('자동 (주소 기준)'), '1')
    await user.click(screen.getByRole('button', { name: '건물 추가' }))

    expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({ cardId: 1 }), null)
  })
})
