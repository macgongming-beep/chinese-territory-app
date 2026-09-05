/** Activate may be slower than posting SKIP_WAITING, especially on mobile. */
export function waitForController(
  container: ServiceWorkerContainer,
  waiting: ServiceWorker,
  timeoutMs = 15_000,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const finish = (error?: Error) => {
      clearTimeout(timer)
      container.removeEventListener('controllerchange', changed)
      if (error) reject(error)
      else resolve()
    }
    const changed = () => {
      if (container.controller === waiting) finish()
    }
    const timer = setTimeout(() => finish(new Error('Update activation timed out')), timeoutMs)
    container.addEventListener('controllerchange', changed)
    if (container.controller === waiting) finish()
    else {
      try { waiting.postMessage({ type: 'SKIP_WAITING' }) }
      catch (error) { finish(error instanceof Error ? error : new Error(String(error))) }
    }
  })
}
