// PWA 업데이트 상태 + 적용 훅
import { useCallback, useEffect, useState } from 'react'
import { applyUpdate, checkForUpdate, isUpdateAvailable, onUpdateAvailable } from '../lib/pwa'
import { showToast } from '../lib/toast'
import { msg } from '../lib/msg'

export function useAppUpdate() {
  const [updateAvailable, setUpdateAvailable] = useState<boolean>(isUpdateAvailable())
  const [checking, setChecking] = useState(false)
  const [applying, setApplying] = useState(false)

  useEffect(() => {
    const off = onUpdateAvailable(() => setUpdateAvailable(true))
    return () => {
      off()
    }
  }, [])

  const check = useCallback(async () => {
    setChecking(true)
    try {
      const has = await checkForUpdate()
      setUpdateAvailable(has)
      return has
    } finally {
      setChecking(false)
    }
  }, [])

  const apply = useCallback(async () => {
    setApplying(true)
    try {
      await applyUpdate()
    } catch {
      showToast(msg('업데이트를 적용하지 못했습니다. 잠시 후 다시 눌러 주세요.'), 'error')
    } finally {
      setApplying(false)
    }
  }, [])

  return { updateAvailable, checking, applying, check, apply }
}
