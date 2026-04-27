import { useEffect, useState } from 'react'
import { registerToastListener } from '../lib/toast'

type ToastItem = {
  id: number
  message: string
  type: 'success' | 'error' | 'info'
  action?: { label: string; onClick: () => void }
}

let _nextId = 0

export function Toast() {
  const [toasts, setToasts] = useState<ToastItem[]>([])

  useEffect(() => {
    return registerToastListener((message, type, action) => {
      const id = ++_nextId
      setToasts((prev) => [...prev, { id, message, type, action }])
      
      const duration = action ? 8000 : 4000
      setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.id !== id))
      }, duration)
    })
  }, [])

  if (toasts.length === 0) return null

  return (
    <div className="toast-container" style={{ pointerEvents: 'none' }}>
      {toasts.map((toast) => (
        <div 
          className={`toast toast-${toast.type}`} 
          key={toast.id}
          style={{ pointerEvents: 'auto' }}
        >
          <span className="toast-message">{toast.message}</span>
          {toast.action && (
            <button 
              className="toast-action-btn"
              onClick={(e) => {
                e.stopPropagation()
                toast.action?.onClick()
                setToasts((prev) => prev.filter((t) => t.id !== toast.id))
              }}
              type="button"
            >
              {toast.action.label}
            </button>
          )}
        </div>
      ))}
    </div>
  )
}
