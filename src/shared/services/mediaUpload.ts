const IMAGE_CHUNK_SIZE = 1 * 1024 * 1024
const IMAGE_UPLOAD_API_BASE = '/api'

const IMAGE_UPLOAD_PATH = {
  init: '/media-image-upload-init',
  chunk: '/media-image-upload-chunk',
  complete: '/media-image-upload-complete',
} as const

export type ImageCategory = 'teacher' | 'honor' | 'feedback'

interface ImageUploadInitPayload {
  category: ImageCategory
  fileName: string
  mimeType: string
  fileSize: number
  totalChunks: number
  title: string
  desc: string
}

interface ImageUploadInitResponse {
  uploadId: string
  chunkSize?: number
  totalChunks?: number
}

interface ImageUploadChunkResponse {
  uploadId: string
  chunkIndex: number
}

interface ImageUploadCompleteResponse {
  imageUrl: string
}

function imageUploadEndpoint(path: keyof typeof IMAGE_UPLOAD_PATH) {
  return `${IMAGE_UPLOAD_API_BASE}${IMAGE_UPLOAD_PATH[path]}`
}

async function requestImageUpload<T>(path: keyof typeof IMAGE_UPLOAD_PATH, init: RequestInit): Promise<T> {
  const endpoint = imageUploadEndpoint(path)
  try {
    const response = await fetch(endpoint, init)
    const responseText = await response.text()

    let payload: unknown = null
    try {
      payload = JSON.parse(responseText)
    } catch {
      payload = responseText ? { raw: responseText } : null
    }

    if (!response.ok) {
      const detail = payload && typeof payload === 'object'
        && 'error' in payload
        && typeof (payload as { error?: string }).error === 'string'
        ? (payload as { error: string }).error
        : `请求失败 (${response.status})`
      throw new Error(`${detail}（${endpoint}）`)
    }

    if (!payload || typeof payload !== 'object') {
      throw new Error(`服务端返回异常（${endpoint}）`)
    }

    return payload as T
  } catch (error) {
    if (error instanceof TypeError) {
      throw new Error(`请求 ${endpoint} 失败（本机上传服务未就绪或被拦截）。请确认开发服务器已启动。`)
    }
    if (error instanceof Error) {
      throw error
    }
    throw new Error('上传请求失败，请稍后重试。')
  }
}

export async function uploadImageToLocalServer(
  file: File,
  category: ImageCategory,
  title: string,
  desc: string,
  onProgress?: (percent: number) => void,
): Promise<string> {
  const fileName = file.name || `image-${Date.now()}`
  const mimeType = file.type || 'image/jpeg'
  const totalChunks = Math.max(1, Math.ceil(file.size / IMAGE_CHUNK_SIZE))

  const initPayload: ImageUploadInitPayload = {
    category,
    fileName,
    mimeType,
    fileSize: file.size,
    totalChunks,
    title,
    desc,
  }

  const initResult = await requestImageUpload<ImageUploadInitResponse>('init', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json;charset=utf-8' },
    body: JSON.stringify(initPayload),
  })

  if (typeof initResult.uploadId !== 'string' || !initResult.uploadId) {
    throw new Error('图片上传服务未返回有效的分片任务ID')
  }

  const uploadId = initResult.uploadId
  let uploadedBytes = 0

  for (let chunkIndex = 0; chunkIndex < totalChunks; chunkIndex += 1) {
    const start = chunkIndex * IMAGE_CHUNK_SIZE
    const end = Math.min(start + IMAGE_CHUNK_SIZE, file.size)
    const chunk = file.slice(start, end)

    const formData = new FormData()
    formData.append('uploadId', uploadId)
    formData.append('chunkIndex', String(chunkIndex))
    formData.append('file', chunk, `chunk-${chunkIndex}`)

    await requestImageUpload<ImageUploadChunkResponse>('chunk', {
      method: 'POST',
      body: formData,
    })

    uploadedBytes += chunk.size
    if (onProgress) {
      onProgress(Math.min(100, Math.round((uploadedBytes / file.size) * 100)))
    }
  }

  const completePayload = await requestImageUpload<ImageUploadCompleteResponse>('complete', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json;charset=utf-8' },
    body: JSON.stringify({ uploadId, title, desc }),
  })

  if (typeof completePayload.imageUrl !== 'string' || !completePayload.imageUrl) {
    throw new Error('图片服务返回地址异常')
  }

  return completePayload.imageUrl
}
