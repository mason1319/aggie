import { useEffect, useState } from 'react'
import { CONTENT_SOURCE_EVENT } from './config'
import { getContentBundle, getContentSnapshot, refreshContentBundle } from './contentStore'
import type { AppContentBundle } from './types'

export interface UseContentBundleResult {
  bundle: AppContentBundle
  loading: boolean
  refresh: () => Promise<void>
}

export function useContentBundle(): UseContentBundleResult {
  const [bundle, setBundle] = useState<AppContentBundle>(getContentSnapshot())
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let active = true

    const refresh = async () => {
      setLoading(true)
      try {
        const next = await refreshContentBundle()
        if (active) setBundle(next)
      } finally {
        if (active) setLoading(false)
      }
    }

    void refresh()

    const handleRefresh = () => {
      if (!active) return
      setBundle(getContentSnapshot())
    }
    const handleStorage = () => {
      if (!active) return
      void getContentBundle(true).then((next) => {
        if (active) setBundle(next)
      })
    }

    window.addEventListener(CONTENT_SOURCE_EVENT, handleRefresh)
    window.addEventListener('storage', handleStorage)
    window.addEventListener('aggie-storage-change', handleStorage)
    return () => {
      active = false
      window.removeEventListener(CONTENT_SOURCE_EVENT, handleRefresh)
      window.removeEventListener('storage', handleStorage)
      window.removeEventListener('aggie-storage-change', handleStorage)
    }
  }, [])

  const refresh = async () => {
    setLoading(true)
    const next = await refreshContentBundle()
    setBundle(next)
    setLoading(false)
  }

  return {
    bundle,
    loading,
    refresh,
  }
}
