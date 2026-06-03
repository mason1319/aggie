import {
  canUseAuth,
  getSessionFromBucketOrMemory,
  jsonResponse,
  corsPreflightResponse,
  makeTmpChunkKey,
  safeString,
  cleanupSessions,
  type Env,
} from './shared'

export const onRequestPost: PagesFunction<Env> = async (context) => {
  if (!canUseAuth(context.request, context.env.AGGIE_MEDIA_UPLOAD_TOKEN)) {
    return jsonResponse({ error: 'Unauthorized' }, { status: 401 })
  }

  const bucket = context.env.AGGIE_MEDIA_BUCKET
  if (!bucket) {
    return jsonResponse({ error: 'AGGIE_MEDIA_BUCKET 未绑定，无法上传视频。' }, { status: 500 })
  }

  const contentType = context.request.headers.get('content-type')
  if (!contentType || !contentType.includes('multipart/form-data')) {
    return jsonResponse({ error: '请使用 multipart/form-data 上传分片。' }, { status: 400 })
  }

  const formData = await context.request.formData().catch(() => null)
  const uploadId = safeString(formData?.get('uploadId'), '')
  const chunkIndexRaw = safeString(formData?.get('chunkIndex'), '')
  const chunkIndex = Number.isFinite(Number(chunkIndexRaw)) ? Number(chunkIndexRaw) : Number.NaN
  const rawChunk = formData?.get('file')
  const chunk = rawChunk instanceof Blob ? rawChunk : null

  cleanupSessions()
  if (!uploadId) {
    return jsonResponse({ error: '缺少 uploadId。' }, { status: 400 })
  }
  if (!Number.isInteger(chunkIndex) || chunkIndex < 0) {
    return jsonResponse({ error: 'chunkIndex 无效。' }, { status: 400 })
  }
  if (!chunk) {
    return jsonResponse({ error: '缺少分片文件。' }, { status: 400 })
  }

  const session = await getSessionFromBucketOrMemory(bucket, uploadId)
  if (!session) {
    return jsonResponse({ error: '未找到上传任务。' }, { status: 404 })
  }
  if (chunkIndex >= session.totalChunks) {
    return jsonResponse({ error: `chunkIndex 应在 0~${session.totalChunks - 1} 范围。` }, { status: 400 })
  }

  await bucket.put(
    makeTmpChunkKey(uploadId, chunkIndex),
    chunk,
    { httpMetadata: { contentType: session.mimeType || 'video/mp4' } },
  )
  return jsonResponse({ uploadId, chunkIndex })
}

export const onRequestOptions: PagesFunction = async () => corsPreflightResponse()
