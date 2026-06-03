import {
  canUseAuth,
  dropSession,
  getSessionFromBucketOrMemory,
  removeSessionFromBucket,
  jsonResponse,
  corsPreflightResponse,
  makeFinalFileName,
  makeFinalKey,
  makeTmpChunkKey,
  makeVideoSrc,
  safeString,
  cleanupSessions,
  type Env,
} from './shared'

interface CompletePayload {
  uploadId: string
  title?: string
  desc?: string
}

async function handleUploadComplete(context: { request: Request, env: Env }): Promise<Response> {
  if (!canUseAuth(context.request, context.env.AGGIE_MEDIA_UPLOAD_TOKEN)) {
    return jsonResponse({ error: 'Unauthorized' }, { status: 401 })
  }

  const bucket = context.env.AGGIE_MEDIA_BUCKET
  if (!bucket) {
    return jsonResponse({ error: 'AGGIE_MEDIA_BUCKET 未绑定，无法完成上传。' }, { status: 500 })
  }

  const body = await context.request.json().catch(() => null)
  const raw = body && typeof body === 'object' ? body as Partial<CompletePayload> : null
  const uploadId = safeString(raw?.uploadId, '')

  if (!uploadId) {
    return jsonResponse({ error: '缺少 uploadId。' }, { status: 400 })
  }

  cleanupSessions()
  const session = await getSessionFromBucketOrMemory(bucket, uploadId)
  if (!session) {
    return jsonResponse({ error: '未找到上传任务。' }, { status: 404 })
  }

  const chunkKeys: string[] = []
  for (let index = 0; index < session.totalChunks; index += 1) {
    chunkKeys.push(makeTmpChunkKey(uploadId, index))
  }

  const chunkParts: Uint8Array[] = []
  try {
    for (const chunkKey of chunkKeys) {
      const object = await bucket.get(chunkKey)
      if (!object) {
        return jsonResponse({ error: `缺少分片：${chunkKey.split('/').at(-1) ?? chunkKey}` }, { status: 400 })
      }
      const buffer = await object.arrayBuffer()
      chunkParts.push(new Uint8Array(buffer))
    }
  } catch {
    return jsonResponse({ error: '读取分片失败。' }, { status: 500 })
  }

  const finalFileName = makeFinalFileName(session.fileName, uploadId)
  const finalKey = makeFinalKey(finalFileName)
  const finalFile = new Blob(chunkParts, { type: 'video/mp4' })
  await bucket.put(finalKey, finalFile)

  try {
    await Promise.all(chunkKeys.map((chunkKey) => bucket.delete(chunkKey)))
    await removeSessionFromBucket(bucket, uploadId)
  } catch {
    // 删除失败不影响主流程
  }
  dropSession(uploadId)

  const title = safeString(raw?.title, session.title)
  const desc = safeString(raw?.desc, session.desc)
  const videoSrc = makeVideoSrc(context.env, finalKey)

  return jsonResponse({ uploadId, videoSrc, title, desc })
}

export const onRequest: PagesFunction<Env> = async (context) => {
  if (context.request.method === 'OPTIONS') {
    return corsPreflightResponse()
  }
  if (context.request.method === 'POST') {
    return handleUploadComplete(context)
  }
  return jsonResponse({ error: 'Method Not Allowed' }, { status: 405 })
}
