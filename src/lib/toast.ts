export type ToastType = 'success' | 'error' | 'info'

type ToastListener = (message: string, type: ToastType, action?: { label: string; onClick: () => void }) => void

let _listener: ToastListener | null = null

export function showToast(message: string, type: ToastType = 'success', action?: { label: string; onClick: () => void }) {
  _listener?.(message, type, action)
}

export function registerToastListener(fn: ToastListener): () => void {
  _listener = fn
  return () => {
    _listener = null
  }
}
