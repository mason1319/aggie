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

const IMAGE_INIT_ENDPOINT = `${API_BASE}/media-image-upload-init`
const IMAGE_CHUNK_ENDPOINT = `${API_BASE}/media-image-upload-chunk`
const IMAGE_COMPLETE_ENDPOINT = `${API_BASE}/media-image-upload-complete`
const HONOR_DATA_ENDPOINT = `${API_BASE}/honor.json`

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

export async function loadHonorGallery(): Promise<HonorGalleryItem[]> {
  const response = await requestJson<unknown>(
    {
      headers: {
        Accept: 'application/json',
      },
    },
    HONOR_DATA_ENDPOINT,
  )

  if (!Array.isArray(response)) {
    return []
  }

  const toString = (value: unknown) => (typeof value === 'string' ? value : '')
  const toHonors = (item: Record<string, unknown>): HonorGalleryItem => ({
    id: toString(item.id) || String(Date.now() + Math.random()),
    name: toString(item.name) || 'honor-image',
    url: toString(item.url),
    title: toString(item.title) || '荣誉照片',
    desc: toString(item.desc) || '荣誉墙照片',
    uploadedAt: toString(item.uploadedAt) || new Date().toISOString(),
  })

  return response
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
    .map(toHonors)
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

  const initResult = await requestJson<ImageUploadInitResponse>({
    method: 'POST',
    headers: { 'Content-Type': 'application/json;charset=utf-8' },
    body: JSON.stringify(initPayload),
  }, IMAGE_INIT_ENDPOINT)

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

    await requestJson<UploadChunkResponse>({
      method: 'POST',
      body: formData,
    }, IMAGE_CHUNK_ENDPOINT)

    uploaded += chunk.size
    if (onProgress) {
      onProgress(Math.min(100, Math.round((uploaded / file.size) * 100)))
    }
  }

  const complete = await requestJson<ImageUploadResult>({
    method: 'POST',
    headers: { 'Content-Type': 'application/json;charset=utf-8' },
    body: JSON.stringify({
      uploadId,
      title: title || file.name,
      desc: desc || '图片上传',
    }),
  }, IMAGE_COMPLETE_ENDPOINT)

  return complete
}
