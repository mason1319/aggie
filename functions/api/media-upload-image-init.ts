import {
  AUDIO_MAX_FILE_SIZE_BYTES,
  IMAGE_CHUNK_SIZE,
  canUseAuth,
  cleanupSessions,
  corsPreflightResponse,
  getSessionFromBucketOrMemory,
  isAudioType,
  isImageType,
  jsonResponse,
  persistSessionToBucket,
  safeNumber,
  safeString,
  setSession,
  type Env,
} from './media-image-upload/shared'

interface UploadInitPayload {
  category: 'teacher' | 'honor' | 'feedback' | 'audio'
  fileName: string
  mimeType: string
  fileSize: number
  totalChunks: number
  title: string
  desc: string
}

async function handleImageUploadInit(context: { request: Request, env: Env }): Promise<Response> {
  if (!canUseAuth(context.request, context.env.AGGIE_MEDIA_UPLOAD_TOKEN)) {
    return jsonResponse({ error: 'Unauthorized' }, { status: 401 })
  }

  const bucket = context.env.AGGIE_MEDIA_BUCKET
  if (!bucket) {
    return jsonResponse({ error: 'AGGIE_MEDIA_BUCKET 未绑定，无法初始化上传。' }, { status: 500 })
  }

  const body = await context.request.json().catch(() => null)
  const raw = body && typeof body === 'object' ? body as Partial<UploadInitPayload> : null
  const category = (typeof raw?.category === 'string' ? raw.category.trim().toLowerCase() : 'honor')
  const categoryLower = category as UploadInitPayload['category']
  const fileName = safeString(raw?.fileName, `image-${Date.now()}`)
  const mimeType = safeString(raw?.mimeType, categoryLower === 'audio' ? 'audio/mpeg' : 'image/jpeg')
  const fileSize = safeNumber(raw?.fileSize)
  const totalChunks = Math.max(1, Math.floor(safeNumber(raw?.totalChunks)))
  const title = safeString(raw?.title, fileName)
  const desc = safeString(raw?.desc, '图片上传')
  const isAudio = categoryLower === 'audio'

  if (!['teacher', 'honor', 'feedback', 'audio'].includes(categoryLower)) {
    return jsonResponse({ error: '图片分类不合法。' }, { status: 400 })
  }

  if (fileSize <= 0) {
    return jsonResponse({ error: '文件大小异常。' }, { status: 400 })
  }
  if (!Number.isFinite(totalChunks) || totalChunks < 1) {
    return jsonResponse({ error: 'totalChunks 无效。' }, { status: 400 })
  }
  const maxBytes = isAudio ? AUDIO_MAX_FILE_SIZE_BYTES : 8 * 1024 * 1024
  if (fileSize > maxBytes) {
    return jsonResponse({ error: `文件过大（${Math.ceil(fileSize / 1024 / 1024)}MB）。` }, { status: 413 })
  }

  if (isAudio ? !isAudioType(fileName, mimeType) : !isImageType(fileName, mimeType)) {
    return jsonResponse({ error: '图片文件类型不合法。' }, { status: 400 })
  }

  cleanupSessions()
  const uploadId = `${Date.now()}-${crypto.randomUUID().replace(/-/g, '').slice(0, 12)}`
  const sessionPayload = {
    category: categoryLower,
    fileName,
    mimeType,
    fileSize,
    totalChunks,
    title,
    desc,
  }

  setSession(uploadId, {
    category: categoryLower,
    fileName,
    mimeType,
    fileSize,
    totalChunks,
    title,
    desc,
    createdAt: Date.now(),
  })

  try {
    await persistSessionToBucket(bucket, uploadId, {
      category: categoryLower,
      fileName,
      mimeType,
      fileSize,
      totalChunks,
      title,
      desc,
      createdAt: Date.now(),
    })
  } catch {
    return jsonResponse({ error: '初始化上传会话失败，请稍后重试。' }, { status: 500 })
  }

  return jsonResponse({
    uploadId,
    chunkSize: IMAGE_CHUNK_SIZE,
    totalChunks,
  })
}

export const onRequest = async (context: { request: Request, env: Env }) => {
  if (context.request.method === 'POST') {
    return handleImageUploadInit(context)
  }
  if (context.request.method === 'OPTIONS') {
    return corsPreflightResponse()
  }
  return jsonResponse({ error: 'Method Not Allowed' }, { status: 405 })
}
