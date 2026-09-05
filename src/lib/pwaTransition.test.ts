import { afterEach, expect, test, vi } from 'vitest'
import { waitForController } from './pwaTransition'

afterEach(() => vi.useRealTimers())

test('message delivery does not finish the update; only the target controller does', async () => {
  const container = Object.assign(new EventTarget(), { controller: {} })
  const waiting = { postMessage: vi.fn() }
  const done = vi.fn()
  const promise = waitForController(container as ServiceWorkerContainer, waiting as unknown as ServiceWorker).then(done)
  expect(waiting.postMessage).toHaveBeenCalledWith({ type: 'SKIP_WAITING' })
  container.dispatchEvent(new Event('controllerchange'))
  await Promise.resolve()
  expect(done).not.toHaveBeenCalled()
  container.controller = waiting
  container.dispatchEvent(new Event('controllerchange'))
  await promise
  expect(done).toHaveBeenCalledOnce()
})

test('activation timeout rejects and removes listeners, allowing retry', async () => {
  vi.useFakeTimers()
  const container = Object.assign(new EventTarget(), { controller: null })
  const remove = vi.spyOn(container, 'removeEventListener')
  const promise = waitForController(container as ServiceWorkerContainer, { postMessage: vi.fn() } as unknown as ServiceWorker)
  const rejected = expect(promise).rejects.toThrow('timed out')
  await vi.advanceTimersByTimeAsync(15_000)
  await rejected
  expect(remove).toHaveBeenCalledWith('controllerchange', expect.any(Function))
})
