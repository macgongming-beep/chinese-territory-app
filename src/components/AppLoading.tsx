import { useEffect, useState } from 'react'
import { msg } from '../lib/msg'
import { applyUpdate } from '../lib/pwa'

export function AppLoading({ kind = 'data', failed = false }: {
  kind?: 'data' | 'screen' | 'login'
  failed?: boolean
}) {
  const [slow, setSlow] = useState(false)
  const [retrying, setRetrying] = useState(false)
  const [retryFailed, setRetryFailed] = useState(false)
  useEffect(() => {
    const timer = setTimeout(() => setSlow(true), 12_000)
    return () => clearTimeout(timer)
  }, [])

  async function retry() {
    setRetrying(true)
    setRetryFailed(false)
    try { await applyUpdate() }
    catch { setRetryFailed(true) }
    finally { setRetrying(false) }
  }

  return (
    <div className="app-loading" role="status">
      {!failed && <div className="app-loading-spinner" />}
      <p>{failed ? msg('자료를 불러오지 못했습니다. 연결을 확인하고 다시 시도해 주세요.')
        : kind === 'data' ? msg('데이터 불러오는 중...')
          : kind === 'login' ? msg('로그인 화면 불러오는 중...') : msg('화면 구성 불러오는 중...')}</p>
      {(slow || failed) && (
        <div className="app-loading-recovery">
          {!failed && <p>{msg('평소보다 오래 걸리고 있습니다. 연결 상태를 확인해 주세요.')}</p>}
          <button className="ds-btn ds-btn-primary" type="button" disabled={retrying} onClick={() => void retry()}>
            {retrying ? msg('다시 불러오는 중...') : msg('앱 다시 불러오기')}
          </button>
          {retryFailed && <p role="alert">{msg('업데이트를 적용하지 못했습니다. 잠시 후 다시 눌러 주세요.')}</p>}
        </div>
      )}
    </div>
  )
}
