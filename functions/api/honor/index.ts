interface Env {
  AGGIE_CONTENT_KV?: KVNamespace
}

interface StoredContent {
  bundle?: {
    media?: {
      assets?: unknown[]
    }
  }
  media?: {
    assets?: unknown[]
  }
}

interface JsonImageEntry {
  id: string
  name: string
  url: string
  title: string
  desc: string
  uploadedAt: string
}

function isHonorImageAsset(asset: unknown) {
  if (!asset || typeof asset !== 'object') {
    return false
  }
  const value = asset as Record<string, unknown>
  if (value.kind !== 'image') {
    return false
  }

  const url = typeof value.remoteUrl === 'string' ? value.remoteUrl : typeof value.dataUrl === 'string' ? value.dataUrl : ''
  if (!url) {
    return false
  }
  return url.includes('/media/honorImg/') || url.includes('media/honorImg')
}

function resolveString(value: unknown, fallback = '') {
  return typeof value === 'string' && value.trim() ? value.trim() : fallback
}

function writeJson(payload: unknown, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
      'Access-Control-Allow-Origin': '*',
    },
  })
}

function normalizeHonorPayload(rawAssets: unknown): JsonImageEntry[] {
  if (!Array.isArray(rawAssets)) {
    return []
  }

  const list = rawAssets
    .filter(isHonorImageAsset)
    .map((item) => {
      const asset = item as Record<string, unknown>
      const id = resolveString(asset.id, `honor-${Date.now()}-${Math.random().toString(16).slice(2, 10)}`)
      const name = resolveString(asset.name, 'honor-image')
      const url = resolveString(asset.remoteUrl ?? asset.dataUrl, '')
      const title = resolveString(asset.title, name)
      const desc = resolveString(asset.desc, '荣誉墙照片')
      const uploadedAt = resolveString(asset.createdAt, new Date().toISOString())

      return {
        id,
        name,
        url,
        title,
        desc,
        uploadedAt,
      } as JsonImageEntry
    })

  return list.sort((a, b) => Date.parse(b.uploadedAt) - Date.parse(a.uploadedAt))
}

function normalizeContent(raw: unknown): JsonImageEntry[] {
  const payload = raw && typeof raw === 'object'
    ? (raw as Record<string, unknown>)
    : null
  if (!payload) {
    return []
  }

  const root = payload.bundle as unknown
  const stored = (root && typeof root === 'object') ? root as StoredContent : null
  const assets = payload.media?.assets || stored?.media?.assets || []
  return normalizeHonorPayload(assets)
}

export const onRequestGet = async (context: { env: Env }) => {
  if (!context.env.AGGIE_CONTENT_KV) {
    return writeJson([], 200)
  }

  const stored = await context.env.AGGIE_CONTENT_KV.get('aggie_content_bundle_v2', { type: 'json' })
    .catch(() => null)
  if (!stored) {
    return writeJson([], 200)
  }

  try {
    const list = normalizeContent(stored)
    return writeJson(list, 200)
  } catch {
    return writeJson([], 200)
  }
}
