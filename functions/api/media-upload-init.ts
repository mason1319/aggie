import {
  VIDEO_CHUNK_SIZE,
  MAX_FILE_SIZE_BYTES,
  canUseAuth,
  isValidMp4,
  jsonResponse,
  corsPreflightResponse,
  safeNumber,
  safeString,
  setSession,
  persistSessionToBucket,
  cleanupSessions,
  dropSession,
  type Env,
} from './media/upload/shared'

interface InitPayload {
  fileName: string
  mimeType: string
  fileSize: number
  totalChunks: number
  title: string
  desc: string
}

async function handleUploadInit(context: { request: Request, env: Env }): Promise<Response> {
  const request = context.request
  if (!canUseAuth(request, context.env.AGGIE_MEDIA_UPLOAD_TOKEN)) {
    return jsonResponse({ error: 'Unauthorized' }, { status: 401 })
  }

  const bucket = context.env.AGGIE_MEDIA_BUCKET
  if (!bucket) {
    return jsonResponse({ error: 'AGGIE_MEDIA_BUCKET 未绑定，无法初始化上传。' }, { status: 500 })
  }

  const body = await request.json().catch(() => null)
  const raw = body && typeof body === 'object' ? body as Partial<InitPayload> : null
  const fileName = safeString(raw?.fileName, `video-${Date.now()}.mp4`)
  const mimeType = safeString(raw?.mimeType, 'video/mp4')
  const fileSize = safeNumber(raw?.fileSize)
  const totalChunks = Math.max(1, Math.floor(safeNumber(raw?.totalChunks)))
  const title = safeString(raw?.title, fileName.replace(/\.[^/.]+$/, '') || '机构视频')
  const desc = safeString(raw?.desc, '机构宣传视频（待补充）')

  if (!fileName.trim()) {
    return jsonResponse({ error: '文件名不能为空' }, { status: 400 })
  }
  if (fileSize <= 0) {
    return jsonResponse({ error: '文件大小异常' }, { status: 400 })
  }
  if (fileSize > MAX_FILE_SIZE_BYTES) {
    return jsonResponse({ error: `文件过大（${Math.ceil(fileSize / 1024 / 1024)}MB），请压缩后再试。` }, { status: 413 })
  }
  if (!Number.isFinite(totalChunks) || totalChunks < 1) {
    return jsonResponse({ error: 'totalChunks 无效。' }, { status: 400 })
  }
  if (!isValidMp4(fileName, mimeType)) {
    return jsonResponse({ error: '仅支持 MP4 视频。' }, { status: 400 })
  }

  cleanupSessions()
  const uploadId = `${Date.now()}-${crypto.randomUUID().replace(/-/g, '').slice(0, 12)}`
  setSession(uploadId, {
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
      fileName,
      mimeType,
      fileSize,
      totalChunks,
      title,
      desc,
      createdAt: Date.now(),
    })
  } catch {
    dropSession(uploadId)
    return jsonResponse({ error: '初始化上传会话失败，请稍后重试。' }, { status: 500 })
  }

  return jsonResponse({
    uploadId,
    chunkSize: VIDEO_CHUNK_SIZE,
    totalChunks,
  })
}

export const onRequest = async (context: { request: Request, env: Env }) => {
  if (context.request.method === 'POST') {
    return handleUploadInit(context)
  }
  if (context.request.method === 'OPTIONS') {
    return corsPreflightResponse()
  }
  return jsonResponse({ error: 'Method Not Allowed' }, { status: 405 })
}
