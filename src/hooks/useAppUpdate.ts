// PWA 업데이트 상태 + 적용 훅
import { useCallback, useEffect, useState } from 'react'
import { applyUpdate, checkForUpdate, isUpdateAvailable, onUpdateAvailable } from '../lib/pwa'

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
    } finally {
      setApplying(false)
    }
  }, [])

  return { updateAvailable, checking, applying, check, apply }
}
