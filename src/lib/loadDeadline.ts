// A stalled request must not leave the initial screen waiting indefinitely.
export async function withLoadDeadline<T>(work: Promise<T>, timeoutMs = 45_000): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined
  try {
    return await Promise.race([
      work,
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(new Error('App data load timed out')), timeoutMs)
      }),
    ])
  } finally {
    clearTimeout(timer)
  }
}
