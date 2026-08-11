// 전역 Confirm/Alert 렌더러 — Toast 와 동일하게 앱 루트에 1회 마운트.
// confirm.ts 의 이벤트 버스를 구독해 큐에 쌓고, 맨 앞 요청 하나만 표시한다.

import { useEffect, useState, useCallback } from 'react'
import { msg } from '../lib/msg'
import { registerDialogListener, type DialogRequest } from '../lib/confirm'

export function ConfirmDialog() {
  const [queue, setQueue] = useState<DialogRequest[]>([])

  useEffect(() => {
    return registerDialogListener((req) => {
      setQueue((prev) => [...prev, req])
    })
  }, [])

  const current = queue[0]

  const close = useCallback((value: boolean) => {
    if (!current) return
    current.resolve(value)
    setQueue((prev) => prev.slice(1))
  }, [current])

  // Esc=취소, Enter=확인
  useEffect(() => {
    if (!current) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { e.preventDefault(); close(false) }
      else if (e.key === 'Enter') { e.preventDefault(); close(true) }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [current, close])

  if (!current) return null

  // 문구는 여기서 한 번에 번역한다 — 호출부가 100곳이 넘어 각자 번역하게 두면
  // 빠뜨리기 쉽다. 이미 번역된 문구(t()로 만든 중국어 등)는 사전에 없으므로
  // 그대로 통과한다.
  const cancelLabel = msg(current.cancelLabel ?? '취소')
  const confirmLabel = msg(current.confirmLabel ?? '확인')

  return (
    <div
      className="cdlg-backdrop"
      onClick={() => close(current.kind === 'alert')}
      role="presentation"
    >
      <div
        className="cdlg"
        onClick={(e) => e.stopPropagation()}
        role="alertdialog"
        aria-modal="true"
      >
        {current.title && <h2 className="cdlg-title">{msg(current.title)}</h2>}
        <p className="cdlg-message">{msg(current.message)}</p>
        <div className="cdlg-actions">
          {current.kind === 'confirm' && (
            <button className="cdlg-btn cdlg-cancel" onClick={() => close(false)} type="button">
              {cancelLabel}
            </button>
          )}
          <button
            className={`cdlg-btn cdlg-confirm${current.danger ? ' cdlg-danger' : ''}`}
            onClick={() => close(true)}
            type="button"
            autoFocus
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}
