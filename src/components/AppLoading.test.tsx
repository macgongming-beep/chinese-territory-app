import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, expect, test, vi } from 'vitest'
import { AppLoading } from './AppLoading'
import { setCurrentLang } from '../i18n'
const apply = vi.hoisted(() => vi.fn())
vi.mock('../lib/pwa', () => ({ applyUpdate: apply }))
afterEach(() => { cleanup(); vi.useRealTimers(); setCurrentLang('ko'); apply.mockReset() })

test('slow loading keeps waiting and only reloads on a click', async () => {
  vi.useFakeTimers()
  render(<AppLoading kind="screen" />)
  expect(screen.queryByRole('button')).toBeNull()
  await act(() => vi.advanceTimersByTimeAsync(12_000))
  expect(apply).not.toHaveBeenCalled()
  apply.mockResolvedValue(undefined)
  await act(async () => fireEvent.click(screen.getByRole('button', { name: '앱 다시 불러오기' })))
  expect(apply).toHaveBeenCalledOnce()
})

test('failed update keeps a retry button and does not clear login storage', async () => {
  localStorage.setItem('auth_token', 'keep-me')
  apply.mockRejectedValue(new Error('offline'))
  render(<AppLoading failed />)
  await act(async () => fireEvent.click(screen.getByRole('button')))
  expect(screen.getByRole('alert').textContent).toContain('잠시 후')
  expect(screen.getByRole('button').hasAttribute('disabled')).toBe(false)
  expect(localStorage.getItem('auth_token')).toBe('keep-me')
  localStorage.removeItem('auth_token')
})

test.each([['zh', '重新加载应用'], ['en', 'Reload app']] as const)('recovery is translated for %s', (lang, label) => {
  setCurrentLang(lang)
  render(<AppLoading failed />)
  expect(screen.getByRole('button', { name: label })).toBeTruthy()
})
