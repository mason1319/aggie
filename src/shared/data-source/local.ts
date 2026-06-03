import { defaultFeedbackEntries } from '../data/feedback'
import videoCatalog from '../../data/video.json'
import type { AppContentBundle, AppDataSource, DataPlatform } from './types'
import { DEFAULT_APP_CONTENT } from './defaults'
import { APP_CONTENT_VERSION } from './types'
import type { MediaAsset } from '../types/media'
import type { FeedbackLibrary } from '../types/feedback'

function buildFeedbackFallback(feedbackEntries: FeedbackLibrary) {
  if (feedbackEntries.entries.length > 0) {
    return feedbackEntries
  }
  return { ...DEFAULT_APP_CONTENT.feedback, ...feedbackEntries }
}

const LOCAL_CONTENT_STORAGE_KEY = `aggie-content-bundle-v${APP_CONTENT_VERSION}`

type VideoCatalogEntry = {
  videoSrc: string
  title: string
  desc: string
}

function isLikelyHashed(value: string) {
  const normalized = value.replace(/\.[^/.]+$/, '').trim()
  if (!normalized) {
    return false
  }
  return /^[0-9a-f]{16,}$/i.test(normalized) || /^[0-9a-f]{8,}-[0-9a-f]{8,}$/i.test(normalized)
}

function normalizeCatalogEntries() {
  const raw = videoCatalog as unknown
  if (!Array.isArray(raw)) {
    return []
  }
  return raw.filter((entry): entry is VideoCatalogEntry => {
    if (!entry || typeof entry !== 'object') {
      return false
    }
    const typed = entry as Partial<VideoCatalogEntry>
    const title = typeof typed.title === 'string' ? typed.title.trim() : ''
    const desc = typeof typed.desc === 'string' ? typed.desc.trim() : ''
    const videoSrc = typeof typed.videoSrc === 'string' ? typed.videoSrc.trim() : ''
    if (!videoSrc || !title || !desc) {
      return false
    }
    if (isLikelyHashed(title)) {
      return false
    }
    return true
  })
}

function hashVideoIdSeed(videoSrc: string) {
  let hash = 0
  for (let i = 0; i < videoSrc.length; i += 1) {
    hash = (hash * 31 + videoSrc.charCodeAt(i)) % 0x1_0000_0000
  }
  return `seed-video-${Math.abs(hash).toString(36)}`
}

function syncCatalogVideos(bundle: AppContentBundle) {
  const entries = normalizeCatalogEntries()
  if (entries.length === 0) {
    return bundle
  }

  let nextMediaAssets: MediaAsset[] = [...bundle.media.assets]
  const nextPromoIds = new Set(bundle.institution.promoVideoAssetIds)
  let changed = false

  for (const entry of entries) {
    const videoSrc = entry.videoSrc.trim()
    const title = entry.title.trim()
    const desc = entry.desc.trim()
    const existedAsset = nextMediaAssets.find((asset) => asset.remoteUrl === videoSrc || asset.dataUrl === videoSrc)
    const assetId = existedAsset?.id ?? hashVideoIdSeed(videoSrc)
    if (!existedAsset) {
      nextMediaAssets = [...nextMediaAssets, {
        id: assetId,
        kind: 'video',
        name: title,
        title,
        desc,
        mimeType: 'video/mp4',
        dataUrl: '',
        remoteUrl: videoSrc,
        createdAt: new Date().toISOString(),
      }]
      changed = true
    }
    if (!nextPromoIds.has(assetId)) {
      nextPromoIds.add(assetId)
      changed = true
    }
  }

  if (!changed) {
    return bundle
  }

  return {
    ...bundle,
    media: {
      ...bundle.media,
      assets: nextMediaAssets,
    },
    institution: {
      ...bundle.institution,
      promoVideoAssetIds: Array.from(nextPromoIds),
    },
  }
}

function getPlatformFromEnv(): DataPlatform {
  const raw = (import.meta.env.VITE_AGGIE_PLATFORM ?? 'web').toLowerCase().trim()
  if (raw === 'h5' || raw === 'web' || raw === 'wechat-mini' || raw === 'app') {
    return raw
  }
  return 'web'
}

type PersistedLocalBundle = {
  version: number
  platform: DataPlatform
  bundle: unknown
  savedAt?: string
}

function isObject(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value)
}

function normalizeBundle(bundle: Partial<AppContentBundle>): AppContentBundle {
  return {
    ...DEFAULT_APP_CONTENT,
    ...bundle,
    platform: getPlatformFromEnv(),
    courses: Array.isArray(bundle.courses) && bundle.courses.length > 0
      ? [...bundle.courses]
      : [...DEFAULT_APP_CONTENT.courses],
    institution: {
      ...DEFAULT_APP_CONTENT.institution,
      ...bundle.institution,
    },
    admission: {
      ...DEFAULT_APP_CONTENT.admission,
      ...bundle.admission,
    },
    contact: {
      ...DEFAULT_APP_CONTENT.contact,
      ...bundle.contact,
    },
    brand: {
      ...DEFAULT_APP_CONTENT.brand,
      ...bundle.brand,
    },
    media: {
      ...DEFAULT_APP_CONTENT.media,
      ...bundle.media,
      assets: Array.isArray(bundle.media?.assets)
        ? [...bundle.media.assets]
        : [...DEFAULT_APP_CONTENT.media.assets],
      itemBindings: {
        ...DEFAULT_APP_CONTENT.media.itemBindings,
        ...(bundle.media?.itemBindings && isObject(bundle.media.itemBindings)
          ? bundle.media.itemBindings
          : {}),
      },
    },
    feedback: {
      ...DEFAULT_APP_CONTENT.feedback,
      entries: Array.isArray(bundle.feedback?.entries)
        ? [...bundle.feedback.entries]
        : buildFeedbackFallback({ entries: [] }).entries,
    },
    meta: {
      ...DEFAULT_APP_CONTENT.meta,
      ...bundle.meta,
      schemaVersion: APP_CONTENT_VERSION,
      syncSource: 'local',
      updatedAt: bundle.meta?.updatedAt ?? new Date().toISOString(),
    },
  }
}

function safeLoadStoredBundle(): AppContentBundle | null {
  if (typeof window === 'undefined' || !window.localStorage) {
    return null
  }

  try {
    const raw = window.localStorage.getItem(LOCAL_CONTENT_STORAGE_KEY)
    if (!raw) {
      return null
    }

    const parsed = JSON.parse(raw) as PersistedLocalBundle
    if (!isObject(parsed) || typeof parsed.version !== 'number') {
      return null
    }
    if (parsed.version !== APP_CONTENT_VERSION) {
      return null
    }
    if (!isObject(parsed.bundle)) {
      return null
    }

    return normalizeBundle(parsed.bundle)
  } catch {
    return null
  }
}

function persistBundle(bundle: AppContentBundle): void {
  if (typeof window === 'undefined' || !window.localStorage) {
    return
  }
  const payload: PersistedLocalBundle = {
    version: APP_CONTENT_VERSION,
    platform: bundle.platform,
    bundle,
    savedAt: new Date().toISOString(),
  }
  window.localStorage.setItem(LOCAL_CONTENT_STORAGE_KEY, JSON.stringify(payload))
}

let runtimeBundle: AppContentBundle = {
  ...DEFAULT_APP_CONTENT,
  platform: getPlatformFromEnv(),
  meta: {
    ...DEFAULT_APP_CONTENT.meta,
    syncSource: 'local',
    updatedAt: new Date().toISOString(),
  },
}

const storedBundle = safeLoadStoredBundle()
if (storedBundle) {
  runtimeBundle = storedBundle
}

export const localContentSource: AppDataSource = {
  async getContentBundle(): Promise<AppContentBundle> {
    const syncedBundle = syncCatalogVideos(runtimeBundle)
    if (syncedBundle !== runtimeBundle) {
      runtimeBundle = syncedBundle
      persistBundle(runtimeBundle)
    }

    return {
      ...runtimeBundle,
      admission: { ...runtimeBundle.admission },
      institution: { ...runtimeBundle.institution },
      media: {
        ...runtimeBundle.media,
        assets: [...runtimeBundle.media.assets],
        itemBindings: { ...runtimeBundle.media.itemBindings },
      },
      feedback: buildFeedbackFallback({
        entries: [...runtimeBundle.feedback.entries],
      }),
      platform: getPlatformFromEnv(),
    }
  },
  async saveContentBundle(bundle: AppContentBundle): Promise<void> {
    runtimeBundle = normalizeBundle({
      ...bundle,
      platform: getPlatformFromEnv(),
    })
    persistBundle(runtimeBundle)
    return
  },
}
