import type { AppContentBundle } from './types'
import { DATA_SOURCE_MODE, CONTENT_SOURCE_EVENT } from './config'
import { APP_CONTENT_VERSION } from './types'
import { DEFAULT_APP_CONTENT } from './defaults'
import { hybridContentSource } from './hybrid'
import { localContentSource } from './local'
import { remoteContentSource } from './remote'

const sourceByMode = {
  local: localContentSource,
  remote: remoteContentSource,
  hybrid: hybridContentSource,
} as const

let cachedBundle: AppContentBundle = {
  ...DEFAULT_APP_CONTENT,
  meta: {
    ...DEFAULT_APP_CONTENT.meta,
    updatedAt: new Date().toISOString(),
    schemaVersion: APP_CONTENT_VERSION,
    syncSource: DATA_SOURCE_MODE === 'remote' ? 'remote' : 'local',
  },
}
let initialized = false

let loading: Promise<AppContentBundle> | null = null

function emitRefresh(source: string) {
  window.dispatchEvent(new CustomEvent(CONTENT_SOURCE_EVENT, {
    detail: { source, time: Date.now() },
  }))
}

export function getContentSnapshot() {
  return { ...cachedBundle }
}

export function getContentMeta() {
  return { ...cachedBundle.meta }
}

export function getContentPlatform() {
  return cachedBundle.platform
}

export async function getContentBundle(forceRemote = false): Promise<AppContentBundle> {
  if (!forceRemote && initialized) {
    return { ...cachedBundle }
  }

  if (!loading) {
    loading = (async () => {
      const source = sourceByMode[DATA_SOURCE_MODE]
      const next = await source.getContentBundle()
      cachedBundle = { ...next, meta: { ...next.meta, schemaVersion: APP_CONTENT_VERSION } }
      initialized = true
      emitRefresh(DATA_SOURCE_MODE)
      return { ...cachedBundle }
    })().finally(() => {
      loading = null
    })
  }

  return loading
}

export async function refreshContentBundle(): Promise<AppContentBundle> {
  return getContentBundle(true)
}

export async function saveContentBundle(next: AppContentBundle): Promise<void> {
  const source = sourceByMode[DATA_SOURCE_MODE]
  const payload = {
    ...next,
    meta: {
      ...next.meta,
      updatedAt: new Date().toISOString(),
      schemaVersion: APP_CONTENT_VERSION,
    },
  }
  await source.saveContentBundle(payload)
  cachedBundle = payload
  initialized = true
  emitRefresh('save')
}
