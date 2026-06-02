// 전역 Confirm/Alert 다이얼로그 — 토스트와 동일한 다크 글래스모피즘 테마.
// window.confirm / window.alert 를 대체하는 Promise 기반 명령형 API.
//
// 사용:
//   const ok = await confirmDialog({ message: '삭제할까요?', danger: true })
//   if (!ok) return
//   await alertDialog({ message: '저장되었습니다.' })

export type ConfirmOptions = {
  title?: string
  message: string
  confirmLabel?: string   // 기본 '확인'
  cancelLabel?: string    // 기본 '취소'
  danger?: boolean        // 확인 버튼을 다크 레드로
}

export type DialogRequest = ConfirmOptions & {
  id: number
  kind: 'confirm' | 'alert'
  resolve: (value: boolean) => void
}

type DialogListener = (req: DialogRequest) => void

let _listener: DialogListener | null = null
let _nextId = 0

export function registerDialogListener(fn: DialogListener): () => void {
  _listener = fn
  return () => {
    _listener = null
  }
}

// 확인/취소 → boolean. 리스너 미등록(이론상) 시 window.confirm 폴백.
export function confirmDialog(opts: ConfirmOptions): Promise<boolean> {
  return new Promise((resolve) => {
    if (!_listener) {
      resolve(window.confirm([opts.title, opts.message].filter(Boolean).join('\n')))
      return
    }
    _listener({ ...opts, id: ++_nextId, kind: 'confirm', resolve })
  })
}

// 단일 확인 버튼. resolve 는 항상 true.
export function alertDialog(opts: ConfirmOptions): Promise<boolean> {
  return new Promise((resolve) => {
    if (!_listener) {
      window.alert([opts.title, opts.message].filter(Boolean).join('\n'))
      resolve(true)
      return
    }
    _listener({ ...opts, id: ++_nextId, kind: 'alert', resolve })
  })
}
