import {
  canUseAuth,
  corsPreflightResponse,
  getSessionFromBucketOrMemory,
  makeTempChunkKey,
  makeFinalKey,
  makePublicUrl,
  jsonResponse,
  cleanupSessions,
  removeSessionFromBucket,
  dropSession,
  safeString,
  type Env,
} from './media-image-upload/shared'

interface ImageUploadCompletePayload {
  uploadId: string
  title?: string
  desc?: string
}

async function handleImageUploadComplete(context: { request: Request, env: Env }): Promise<Response> {
  if (!canUseAuth(context.request, context.env.AGGIE_MEDIA_UPLOAD_TOKEN)) {
    return jsonResponse({ error: 'Unauthorized' }, { status: 401 })
  }

  const bucket = context.env.AGGIE_MEDIA_BUCKET
  if (!bucket) {
    return jsonResponse({ error: 'AGGIE_MEDIA_BUCKET 未绑定，无法完成上传。' }, { status: 500 })
  }

  const body = await context.request.json().catch(() => null)
  const raw = body && typeof body === 'object' ? body as Partial<ImageUploadCompletePayload> : null
  const uploadId = safeString(raw?.uploadId, '')

  if (!uploadId) {
    return jsonResponse({ error: '缺少 uploadId。' }, { status: 400 })
  }

  cleanupSessions()
  const session = await getSessionFromBucketOrMemory(bucket, uploadId)
  if (!session) {
    return jsonResponse({ error: '未找到上传任务。' }, { status: 404 })
  }

  const chunkKeys = Array.from({ length: session.totalChunks }, (_, index) => makeTempChunkKey(uploadId, index))

  const chunkBuffers: Uint8Array[] = []
  try {
    for (const chunkKey of chunkKeys) {
      const chunkObject = await bucket.get(chunkKey)
      if (!chunkObject) {
        return jsonResponse({ error: `缺少分片：${chunkKey.split('/').at(-1) ?? chunkKey}` }, { status: 400 })
      }
      const buffer = await chunkObject.arrayBuffer()
      chunkBuffers.push(new Uint8Array(buffer))
    }
  } catch {
    return jsonResponse({ error: '读取分片失败。' }, { status: 500 })
  }

  const finalKey = makeFinalKey(
    session.category,
    session.fileName,
    uploadId,
    session.mimeType,
  )
  const finalBlob = new Blob(chunkBuffers, {
    type: session.mimeType || 'image/jpeg',
  })

  const finalUrl = makePublicUrl(context.env, finalKey)

  await bucket.put(finalKey, finalBlob, {
    httpMetadata: { contentType: session.mimeType || 'image/jpeg' },
  })

  try {
    await Promise.all(chunkKeys.map((chunkKey) => bucket.delete(chunkKey)))
    await removeSessionFromBucket(bucket, uploadId)
  } finally {
    dropSession(uploadId)
  }

  const title = safeString(raw?.title, session.title)
  const desc = safeString(raw?.desc, session.desc)

  return jsonResponse({ imageUrl: finalUrl, title, desc })
}

export const onRequest = async (context: { request: Request, env: Env }) => {
  if (context.request.method === 'POST') {
    return handleImageUploadComplete(context)
  }
  if (context.request.method === 'OPTIONS') {
    return corsPreflightResponse()
  }
  return jsonResponse({ error: 'Method Not Allowed' }, { status: 405 })
}
