import type { DataSourceMode } from './types'

export const CONTENT_SOURCE_EVENT = 'aggie-content-refresh'

export const DATA_SOURCE_MODE: DataSourceMode = (() => {
  const raw = (import.meta.env.VITE_AGGIE_CONTENT_SOURCE ?? 'hybrid').toLowerCase().trim()
  if (raw === 'local' || raw === 'remote' || raw === 'hybrid') {
    return raw
  }
  return 'hybrid'
})()
