// CSV 모달의 **비동기 생명주기**. 순수 함수 시험으로는 못 잡는 것들이다.
import { describe, test, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { CsvImportModal } from './CsvImportModal'

const parseMock = vi.fn()
vi.mock('../utils/csvBuildingImport', async (orig) => ({
  ...(await orig<Record<string, unknown>>()),
  parseBuildingCsvFile: (...args: unknown[]) => parseMock(...args),
  downloadCsvExample: vi.fn(),
}))

const okResult = (rows: number, name = '가나빌라') => ({
  ok: true, headers: ['주소'], skipped: 0, skippedDetails: [],
  rows: Array.from({ length: rows }, (_, i) => ({
    rowNumber: i + 2, cardId: 1, cardName: '카드', name: `${name}${i}`,
    address: `주소${i}`, type: '주택', lat: 1, lng: 1, units: [],
  })),
})

const open = (onImport = vi.fn(async () => ({ inserted: 1, skipped: 0, failures: [] }))) => {
  const onClose = vi.fn()
  render(
    <CsvImportModal
      onClose={onClose}
      cards={[] as never}
      cardBoundaries={[] as never}
      unassignedCardId={null}
      regionNames={[]}
      geocodeAddress={async () => null}
      onImportBuildings={onImport as never}
    />,
  )
  return { onClose, onImport }
}
const pickFile = async (user: ReturnType<typeof userEvent.setup>, name: string) => {
  const input = document.querySelector('input[type="file"]') as HTMLInputElement
  await user.upload(input, new File(['주소\n가'], name, { type: 'text/csv' }))
}

beforeEach(() => { parseMock.mockReset() })

describe('파일을 연달아 고를 때', () => {
  test('⚠ 늦게 끝난 이전 파일이 최신 파일을 덮지 않는다', async () => {
    const user = userEvent.setup()
    let resolveFirst: (v: unknown) => void = () => {}
    parseMock
      .mockImplementationOnce(() => new Promise((r) => { resolveFirst = r }))   // 느린 첫 파일
      .mockImplementationOnce(async () => okResult(2, '두번째'))                 // 빠른 두 번째
    open()

    await pickFile(user, 'a.csv')
    await pickFile(user, 'b.csv')
    await waitFor(() => expect(screen.getByText(/준비 2개/)).toBeTruthy())

    // 이제 첫 파일이 뒤늦게 끝난다 — 화면을 덮으면 안 된다
    resolveFirst(okResult(9, '첫번째'))
    await new Promise((r) => setTimeout(r, 10))
    expect(screen.getByText(/준비 2개/)).toBeTruthy()
    expect(screen.queryByText(/준비 9개/)).toBeNull()
  })
})

describe('바쁠 때는 닫히지 않는다', () => {
  test('올리는 중에는 취소·X 로 닫히지 않는다', async () => {
    const user = userEvent.setup()
    let finishUpload: (v: unknown) => void = () => {}
    parseMock.mockResolvedValue(okResult(1))
    const { onClose } = open(vi.fn(() => new Promise((r) => { finishUpload = r })) as never)

    await pickFile(user, 'a.csv')
    await waitFor(() => expect(screen.getByText(/준비 1개/)).toBeTruthy())
    await user.click(screen.getByRole('button', { name: '업로드' }))

    // 취소 버튼은 disabled 라 클릭이 안 들어간다 — 그것만 보면 시험이 헛돈다.
    // 진짜 방어선은 **배경 클릭**이다 (disabled 가 없다).
    const backdrop = document.querySelector('.cal-modal-backdrop') as HTMLElement
    await user.click(backdrop)
    expect(onClose).not.toHaveBeenCalled()

    // 버튼이 잠겨 있는 것도 함께 본다
    expect((screen.getByRole('button', { name: '취소' }) as HTMLButtonElement).disabled).toBe(true)

    finishUpload({ inserted: 1, skipped: 0, failures: [] })
    await waitFor(() => expect(onClose).toHaveBeenCalled())
  })
})

describe('실패했을 때', () => {
  test('일부만 올라가면 닫지 않고 **실패한 줄을 보여준다**', async () => {
    const user = userEvent.setup()
    parseMock.mockResolvedValue(okResult(2))
    const { onClose } = open(vi.fn(async () => ({
      inserted: 1, skipped: 1,
      failures: [{ rowNumber: 3, address: '유방동 9', error: '권한이 없습니다.' }],
    })) as never)

    await pickFile(user, 'a.csv')
    await waitFor(() => expect(screen.getByText(/준비 2개/)).toBeTruthy())
    await user.click(screen.getByRole('button', { name: '업로드' }))

    await waitFor(() => expect(screen.getByText(/올리지 못한 1개/)).toBeTruthy())
    expect(screen.getByText(/유방동 9/)).toBeTruthy()
    expect(screen.getByText(/권한이 없습니다/)).toBeTruthy()
    expect(onClose).not.toHaveBeenCalled()
  })

  test('하나도 안 올라가면 미리보기를 남긴다', async () => {
    const user = userEvent.setup()
    parseMock.mockResolvedValue(okResult(2))
    const { onClose } = open(vi.fn(async () => ({ inserted: 0, skipped: 2, failures: [] })) as never)

    await pickFile(user, 'a.csv')
    await waitFor(() => expect(screen.getByText(/준비 2개/)).toBeTruthy())
    await user.click(screen.getByRole('button', { name: '업로드' }))

    await waitFor(() => expect(onClose).not.toHaveBeenCalled())
    expect(screen.getByText(/준비 2개/)).toBeTruthy()   // 고쳐서 다시 시도할 수 있다
  })

  test('전부 성공하면 닫는다', async () => {
    const user = userEvent.setup()
    parseMock.mockResolvedValue(okResult(2))
    const { onClose } = open(vi.fn(async () => ({ inserted: 2, skipped: 0, failures: [] })) as never)

    await pickFile(user, 'a.csv')
    await waitFor(() => expect(screen.getByText(/준비 2개/)).toBeTruthy())
    await user.click(screen.getByRole('button', { name: '업로드' }))

    await waitFor(() => expect(onClose).toHaveBeenCalled())
  })
})
