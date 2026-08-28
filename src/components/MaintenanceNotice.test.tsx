// 점검 공지 팝업. 여기가 헛돌기 쉬운 자리라 조심해서 썼다.
//
// ⚠ '버튼을 눌러도 안 닫힌다' 를 클릭으로 시험하면 **잠금을 빼도 통과한다** —
//   disabled 버튼은 클릭이 아예 안 들어가기 때문이다 (같은 함정에 한 번 빠졌다).
//   그래서 **disabled 속성 자체**와 **닫혔는지**를 따로 본다.
import { describe, test, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MaintenanceNotice } from './MaintenanceNotice'

const fetchMock = vi.hoisted(() => vi.fn())
vi.mock('../hooks/storeMutations/appSettings', () => ({ fetchMaintenanceNotice: fetchMock }))

const NOTICE = { message: '앱을 완전히 껐다 켜 주세요', id: 'v1' }

beforeEach(() => { localStorage.clear(); fetchMock.mockReset() })

describe('점검 공지', () => {
  test('공지가 있으면 본문이 보인다', async () => {
    fetchMock.mockResolvedValue(NOTICE)
    render(<MaintenanceNotice userId={7} />)
    expect(await screen.findByText(NOTICE.message)).toBeTruthy()
  })

  test('공지가 없으면 아무것도 안 그린다', async () => {
    fetchMock.mockResolvedValue(null)
    const { container } = render(<MaintenanceNotice userId={7} />)
    await waitFor(() => expect(fetchMock).toHaveBeenCalled())
    expect(container.textContent).toBe('')
  })

  test('체크 전에는 확인 버튼이 잠겨 있다', async () => {
    fetchMock.mockResolvedValue(NOTICE)
    render(<MaintenanceNotice userId={7} />)
    await screen.findByText(NOTICE.message)
    // ⚠ 클릭이 아니라 **속성**을 본다. 클릭은 disabled 면 안 들어가 늘 통과한다
    expect(screen.getByRole('button').hasAttribute('disabled')).toBe(true)
  })

  test('체크하면 잠금이 풀리고, 눌러야 닫힌다', async () => {
    fetchMock.mockResolvedValue(NOTICE)
    const user = userEvent.setup()
    render(<MaintenanceNotice userId={7} />)
    await screen.findByText(NOTICE.message)

    await user.click(screen.getByRole('checkbox'))
    expect(screen.getByRole('button').hasAttribute('disabled')).toBe(false)
    // 체크만 해서는 **아직 안 닫힌다**
    expect(screen.queryByText(NOTICE.message)).toBeTruthy()

    await user.click(screen.getByRole('button'))
    await waitFor(() => expect(screen.queryByText(NOTICE.message)).toBeNull())
  })

  test('확인한 공지는 다시 안 뜬다 — 사용자별·공지별로 기억한다', async () => {
    fetchMock.mockResolvedValue(NOTICE)
    const user = userEvent.setup()
    const first = render(<MaintenanceNotice userId={7} />)
    await screen.findByText(NOTICE.message)
    await user.click(screen.getByRole('checkbox'))
    await user.click(screen.getByRole('button'))
    await waitFor(() => expect(screen.queryByText(NOTICE.message)).toBeNull())
    first.unmount()

    // 같은 사람 → 안 뜬다
    const again = render(<MaintenanceNotice userId={7} />)
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2))
    expect(again.container.textContent).toBe('')
    again.unmount()

    // ⚠ **다른 사람에게는 떠야 한다.** 한 사람이 확인했다고 전원이 넘어가면
    //   정작 안내가 필요한 사람이 못 본다
    render(<MaintenanceNotice userId={8} />)
    expect(await screen.findByText(NOTICE.message)).toBeTruthy()
  })

  test('공지 id 를 바꾸면 확인했던 사람에게도 다시 뜬다', async () => {
    localStorage.setItem('maintenanceNoticeSeen:7:v1', '1')
    fetchMock.mockResolvedValue({ message: '두 번째 공지', id: 'v2' })
    render(<MaintenanceNotice userId={7} />)
    expect(await screen.findByText('두 번째 공지')).toBeTruthy()
  })
})

describe('언어', () => {
  test('언어를 그대로 넘겨 받아온다 (본문은 언어별로 담겨 있다)', async () => {
    fetchMock.mockResolvedValue({ message: '请完全关闭应用', id: 'v1' })
    render(<MaintenanceNotice userId={7} language="zh" />)
    expect(await screen.findByText('请完全关闭应用')).toBeTruthy()
    expect(fetchMock).toHaveBeenCalledWith('zh')
  })

  test('UI 문구도 그 언어로 나온다 (본문만 번역되면 반쪽이다)', async () => {
    fetchMock.mockResolvedValue(NOTICE)
    render(<MaintenanceNotice userId={7} language="zh" />)
    await screen.findByText(NOTICE.message)
    expect(screen.getByText('维护通知')).toBeTruthy()          // 제목
    expect(screen.getByRole('button').textContent).toBe('确定') // 버튼
  })
})
