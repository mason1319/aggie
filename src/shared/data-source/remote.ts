import type { AppContentBundle, AppDataSource, DataPlatform } from './types'
import { DEFAULT_APP_CONTENT } from './defaults'

const DEFAULT_TIMEOUT_MS = 12_000
const REMOTE_ADMIN_TOKEN = (import.meta.env.VITE_AGGIE_CONTENT_ADMIN_TOKEN ?? '').trim()

function getPlatformFromEnv(): DataPlatform {
  const raw = (import.meta.env.VITE_AGGIE_PLATFORM ?? 'web').toLowerCase().trim()
  if (raw === 'h5' || raw === 'web' || raw === 'wechat-mini' || raw === 'app') {
    return raw
  }
  return 'web'
}

function getApiBase() {
  return (import.meta.env.VITE_AGGIE_CONTENT_API ?? '').replace(/\/+$/, '')
}

function normalizeIncoming(data: unknown): AppContentBundle {
  const payload = (data && typeof data === 'object' ? data as Record<string, unknown> : {}) as Record<string, unknown>
  const raw = (payload.bundle && typeof payload.bundle === 'object' ? payload.bundle : payload) as Partial<AppContentBundle>
  return {
    ...DEFAULT_APP_CONTENT,
    ...raw,
    platform: getPlatformFromEnv(),
    courses: raw.courses || DEFAULT_APP_CONTENT.courses,
    institution: { ...DEFAULT_APP_CONTENT.institution, ...raw.institution },
    admission: { ...DEFAULT_APP_CONTENT.admission, ...raw.admission },
    contact: { ...DEFAULT_APP_CONTENT.contact, ...raw.contact },
    brand: { ...DEFAULT_APP_CONTENT.brand, ...raw.brand },
    feedback: {
      entries: (raw.feedback && Array.isArray(raw.feedback.entries)) ? raw.feedback.entries : DEFAULT_APP_CONTENT.feedback.entries,
    },
    media: {
      assets: (raw.media && Array.isArray((raw.media as { assets?: unknown }).assets)
        ? (raw.media as { assets: unknown[] }).assets : DEFAULT_APP_CONTENT.media.assets) as AppContentBundle['media']['assets'],
      itemBindings: (raw.media && raw.media.itemBindings && typeof raw.media.itemBindings === 'object' && !Array.isArray(raw.media.itemBindings))
        ? (raw.media.itemBindings as Record<string, unknown>) as AppContentBundle['media']['itemBindings']
        : DEFAULT_APP_CONTENT.media.itemBindings,
    },
    meta: {
      ...DEFAULT_APP_CONTENT.meta,
      ...raw.meta,
      schemaVersion: raw.meta?.schemaVersion ?? DEFAULT_APP_CONTENT.meta.schemaVersion,
      syncSource: 'remote',
      updatedAt: raw.meta?.updatedAt ?? new Date().toISOString(),
      generatedBy: raw.meta?.generatedBy ?? 'remote',
    },
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const apiBase = getApiBase()
  if (!apiBase) {
    throw new Error('远程内容接口未配置')
  }

  const controller = new AbortController()
  const timeout = window.setTimeout(() => controller.abort(), DEFAULT_TIMEOUT_MS)

  try {
    const response = await fetch(`${apiBase}${path}`, {
      signal: controller.signal,
      headers: {
        Accept: 'application/json',
        ...(init?.headers ?? {}),
      },
      ...init,
    })

    if (!response.ok) {
      const message = await response.text().catch(() => '')
      throw new Error(message || `远程内容接口返回异常 (${response.status})`)
    }

    return await response.json() as T
  } finally {
    window.clearTimeout(timeout)
  }
}

export const remoteContentSource: AppDataSource = {
  async getContentBundle() {
    const raw = await request<unknown>('/content')
    return normalizeIncoming(raw)
  },

  async saveContentBundle(bundle: AppContentBundle) {
    const body = JSON.stringify({ bundle })
    const headers: Record<string, string> = { 'Content-Type': 'application/json' }
    if (REMOTE_ADMIN_TOKEN) {
      headers.Authorization = `Bearer ${REMOTE_ADMIN_TOKEN}`
    }
    await request<void>('/content', {
      method: 'PUT',
      headers,
      body,
    })
  },
}
