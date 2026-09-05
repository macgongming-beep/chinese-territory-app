import { useState } from 'react'
import { useAppUpdate } from '../hooks/useAppUpdate'
import { msg } from '../lib/msg'

export function AppUpdateNotice() {
  const { updateAvailable, applying, apply } = useAppUpdate()
  const [dismissed, setDismissed] = useState(false)
  if (!updateAvailable || dismissed) return null
  return (
    <aside className="app-update-notice" role="status">
      <strong>{msg('새 버전이 준비됐습니다.')}</strong>
      <p>{msg('입력한 내용을 저장한 뒤 업데이트해 주세요. 다른 앱 창도 새로고침됩니다.')}</p>
      <div>
        <button className="ds-btn" type="button" onClick={() => setDismissed(true)} disabled={applying}>{msg('나중에')}</button>
        <button className="ds-btn ds-btn-primary" type="button" onClick={() => void apply()} disabled={applying}>
          {applying ? msg('다시 불러오는 중...') : msg('지금 업데이트')}
        </button>
      </div>
    </aside>
  )
}
