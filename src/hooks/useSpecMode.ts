import { useEffect, useState } from 'react'
import type { SpecMode } from '../types'

const key = 'siaab-spec-mode-v1'
export function useSpecMode() {
  const [mode, setMode] = useState<SpecMode>('simple')
  const [storageLoaded, setStorageLoaded] = useState(false)
  useEffect(() => {
    setMode(window.localStorage.getItem(key) === 'advanced' ? 'advanced' : 'simple')
    setStorageLoaded(true)
  }, [])
  useEffect(() => {
    if (storageLoaded) window.localStorage.setItem(key, mode)
  }, [mode, storageLoaded])
  return [mode, setMode] as const
}
