export type HonorPhotoCategory = 'teacher' | 'honor' | 'feedback' | 'audio'

export interface UploadChunkResponse {
  uploadId: string
  chunkIndex: number
}

export interface ImageUploadInitResponse {
  uploadId: string
  chunkSize?: number
  totalChunks?: number
}

export interface ImageUploadResult {
  imageUrl: string
}

export interface HonorGalleryItem {
  id: string
  name: string
  url: string
  title: string
  desc: string
  uploadedAt: string
}

const API_BASE = '/api'
export const IMAGE_UPLOAD_CHUNK_SIZE = 1 * 1024 * 1024

const IMAGE_INIT_ENDPOINTS = [
  `${API_BASE}/media-image-upload-init`,
  `${API_BASE}/media-upload-image-init`,
]
const IMAGE_CHUNK_ENDPOINTS = [
  `${API_BASE}/media-image-upload-chunk`,
  `${API_BASE}/media-upload-image-chunk`,
]
const IMAGE_COMPLETE_ENDPOINTS = [
  `${API_BASE}/media-image-upload-complete`,
  `${API_BASE}/media-upload-image-complete`,
]
const HONOR_DATA_ENDPOINTS = [
  `${API_BASE}/honor.json`,
  `${API_BASE}/honor`,
]
const CONTENT_ENDPOINT = `${API_BASE}/content`

function normalizeErrorText(error: unknown, fallback: string) {
  if (error instanceof TypeError) {
    return '请求上传接口失败，请确认本地服务启动。'
  }
  if (error instanceof Error) {
    return error.message
  }
  return fallback
}

async function requestJson<T>(init: RequestInit, endpoint: string): Promise<T> {
  try {
    const response = await fetch(endpoint, init)
    const raw = await response.text()
    let parsed: unknown = null
    try {
      parsed = raw ? JSON.parse(raw) : null
    } catch {
      parsed = raw ? { message: raw } : null
    }

    if (!response.ok) {
      if (parsed && typeof parsed === 'object' && 'error' in parsed && typeof parsed.error === 'string') {
        throw new Error(parsed.error)
      }
      if (parsed && typeof parsed === 'object' && 'message' in parsed && typeof parsed.message === 'string') {
        throw new Error(parsed.message)
      }
      throw new Error(`上传失败（HTTP ${response.status}）`)
    }

    if (!parsed || typeof parsed !== 'object') {
      throw new Error('服务端返回异常')
    }

    return parsed as T
  } catch (error) {
    throw new Error(normalizeErrorText(error, '图片上传失败，请稍后再试。'))
  }
}

async function requestJsonWithFallback<T>(
  init: RequestInit,
  endpoints: string[],
): Promise<T> {
  if (!Array.isArray(endpoints) || endpoints.length === 0) {
    throw new Error('请求地址不存在')
  }

  for (const endpoint of endpoints) {
    try {
      return await requestJson<T>(init, endpoint)
    } catch (error) {
      if (endpoints[endpoints.length - 1] === endpoint) {
        throw error
      }
    }
  }

  throw new Error('上传服务不可用')
}

interface ContentBundle {
  bundle?: {
    media?: {
      assets?: unknown[]
    }
  }
  media?: {
    assets?: unknown[]
  }
}

function isHonorImageAsset(asset: unknown) {
  if (!asset || typeof asset !== 'object') {
    return false
  }
  const value = asset as Record<string, unknown>
  if (value.kind !== 'image') {
    return false
  }
  const url = typeof value.remoteUrl === 'string'
    ? value.remoteUrl
    : typeof value.dataUrl === 'string'
      ? value.dataUrl
      : ''
  if (!url) {
    return false
  }
  return url.includes('/media/honorImg/') || url.includes('media/honorImg')
}

function normalizeHonorAsset(asset: Record<string, unknown>): HonorGalleryItem {
  return {
    id: typeof asset.id === 'string' ? asset.id : `honor-${Date.now()}-${Math.random().toString(16).slice(2, 10)}`,
    name: typeof asset.name === 'string' ? asset.name : 'honor-image',
    url: typeof asset.url === 'string' ? asset.url : (typeof asset.remoteUrl === 'string' ? asset.remoteUrl : ''),
    title: typeof asset.title === 'string' ? asset.title : '荣誉照片',
    desc: typeof asset.desc === 'string' ? asset.desc : '荣誉墙照片',
    uploadedAt: typeof asset.uploadedAt === 'string' && asset.uploadedAt.trim()
      ? asset.uploadedAt
      : typeof asset.createdAt === 'string' && asset.createdAt.trim()
        ? asset.createdAt
        : new Date().toISOString(),
  }
}

function toHonorGallery(payload: unknown): HonorGalleryItem[] {
  if (!Array.isArray(payload)) {
    throw new Error('荣誉接口返回格式不符合预期')
  }
  return payload
    .map((item) => item as Record<string, unknown>)
    .filter((item): item is Record<string, unknown> => {
      if (!item || typeof item !== 'object') {
        return false
      }
      return (
        typeof item.url === 'string'
        && typeof item.id === 'string'
        && typeof item.name === 'string'
      )
    })
    .map(normalizeHonorAsset)
    .sort((a, b) => Date.parse(b.uploadedAt) - Date.parse(a.uploadedAt))
}

function toHonorGalleryFromContent(payload: unknown): HonorGalleryItem[] {
  if (!payload || typeof payload !== 'object') {
    throw new Error('内容接口返回格式不符合预期')
  }

  const record = payload as ContentBundle
  const root = record.bundle as unknown
  const container = root && typeof root === 'object' ? root as ContentBundle : record
  const assets = container.media?.assets || []
  if (!Array.isArray(assets)) {
    return []
  }

  return assets
    .filter(isHonorImageAsset)
    .map((item) => normalizeHonorAsset(item as Record<string, unknown>))
    .sort((a, b) => Date.parse(b.uploadedAt) - Date.parse(a.uploadedAt))
}

async function requestHonorFromEndpoint(endpoint: string): Promise<HonorGalleryItem[]> {
  const response = await requestJson<unknown>({}, endpoint)
  return toHonorGallery(response)
}

async function requestHonorFromContent(): Promise<HonorGalleryItem[]> {
  const response = await requestJson<unknown>({}, CONTENT_ENDPOINT)
  return toHonorGalleryFromContent(response)
}

export async function loadHonorGallery(): Promise<HonorGalleryItem[]> {
  const errors: Error[] = []
  for (const endpoint of HONOR_DATA_ENDPOINTS) {
    try {
      return await requestHonorFromEndpoint(endpoint)
    } catch (error) {
      if (error instanceof Error) {
        errors.push(error)
      } else {
        errors.push(new Error('荣誉接口读取异常'))
      }
    }
  }

  try {
    return await requestHonorFromContent()
  } catch (error) {
    errors.push(error instanceof Error ? error : new Error('内容接口读取异常'))
    return []
  }
}

interface UploadImageInput {
  file: File
  category: HonorPhotoCategory
  onProgress?: (percent: number) => void
  title?: string
  desc?: string
}

export async function uploadImageToLocalServer({
  file,
  category,
  onProgress,
  title,
  desc,
}: UploadImageInput): Promise<ImageUploadResult> {
  const chunkSize = IMAGE_UPLOAD_CHUNK_SIZE
  const totalChunks = Math.max(1, Math.ceil(file.size / chunkSize))

  const initPayload = {
    category,
    fileName: file.name,
    mimeType: file.type || 'image/jpeg',
    fileSize: file.size,
    totalChunks,
    title: title || file.name,
    desc: desc || '图片上传',
  }

  const initResult = await requestJsonWithFallback<ImageUploadInitResponse>({
    method: 'POST',
    headers: { 'Content-Type': 'application/json;charset=utf-8' },
    body: JSON.stringify(initPayload),
  }, IMAGE_INIT_ENDPOINTS)

  const uploadId = initResult.uploadId
  let uploaded = 0

  for (let chunkIndex = 0; chunkIndex < totalChunks; chunkIndex += 1) {
    const start = chunkIndex * chunkSize
    const end = Math.min(start + chunkSize, file.size)
    const chunk = file.slice(start, end)
    const formData = new FormData()
    formData.append('uploadId', uploadId)
    formData.append('chunkIndex', String(chunkIndex))
    formData.append('file', chunk)

    await requestJsonWithFallback<UploadChunkResponse>({
      method: 'POST',
      body: formData,
    }, IMAGE_CHUNK_ENDPOINTS)

    uploaded += chunk.size
    if (onProgress) {
      onProgress(Math.min(100, Math.round((uploaded / file.size) * 100)))
    }
  }

  const complete = await requestJsonWithFallback<ImageUploadResult>({
    method: 'POST',
    headers: { 'Content-Type': 'application/json;charset=utf-8' },
    body: JSON.stringify({
      uploadId,
      title: title || file.name,
      desc: desc || '图片上传',
    }),
  }, IMAGE_COMPLETE_ENDPOINTS)

  return complete
}
