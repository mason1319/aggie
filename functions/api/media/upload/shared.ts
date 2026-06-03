const VIDEO_CHUNK_SIZE = 5 * 1024 * 1024
const MAX_FILE_SIZE_BYTES = 1024 * 1024 * 1024
const SESSION_TTL_MS = 90 * 60 * 1000
const CLEANUP_INTERVAL_MS = 3 * 60 * 1000
const ALLOWED_MIME = new Set(['video/mp4', 'video/x-m4v'])
const TEMP_PREFIX = 'media-uploads/tmp'
const PUBLIC_PREFIX = 'media/videos'

interface Env {
  AGGIE_MEDIA_BUCKET?: R2Bucket
  AGGIE_MEDIA_UPLOAD_TOKEN?: string
  AGGIE_MEDIA_PUBLIC_BASE?: string
}

interface UploadSession {
  fileName: string
  mimeType: string
  fileSize: number
  totalChunks: number
  title: string
  desc: string
  createdAt: number
}

interface UploadSessionPayload {
  fileName: string
  mimeType: string
  fileSize: number
  totalChunks: number
  title: string
  desc: string
  createdAt: number
}

const uploadSessions = new Map<string, UploadSession>()
let lastCleanup = 0
const SESSION_META_SUFFIX = 'session.json'

function jsonResponse(body: unknown, init?: ResponseInit) {
  return new Response(JSON.stringify(body), {
    ...init,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type,Authorization,X-Admin-Token',
      'Access-Control-Max-Age': '86400',
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
      ...(init?.headers ?? {}),
    },
  })
}

function corsPreflightResponse() {
  return new Response(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type,Authorization,X-Admin-Token',
      'Access-Control-Max-Age': '86400',
    },
  })
}

function safeString(value: unknown, fallback: string) {
  return typeof value === 'string' && value.trim() ? value.trim() : fallback
}

function safeNumber(value: unknown, fallback = 0) {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value
  }
  if (typeof value === 'string') {
    const parsed = Number(value)
    return Number.isFinite(parsed) ? parsed : fallback
  }
  return fallback
}

function sanitizeBaseName(fileName: string) {
  const raw = fileName.replace(/\.[^./\\]+$/, '').trim()
  const safe = raw.replace(/[^a-zA-Z0-9_-]/g, '_')
  return safe || `video-${Date.now()}`
}

function isValidMp4(fileName: string, mimeType: string) {
  return ALLOWED_MIME.has((mimeType || '').toLowerCase()) || fileName.toLowerCase().endsWith('.mp4')
}

function makeFinalFileName(fileName: string, uploadId: string) {
  return `${sanitizeBaseName(fileName)}-${Date.now()}-${uploadId.slice(0, 8)}.mp4`
}

function makeTmpChunkKey(uploadId: string, chunkIndex: number) {
  return `${TEMP_PREFIX}/${uploadId}/${chunkIndex}`
}

function makeFinalKey(fileName: string) {
  return `${PUBLIC_PREFIX}/${fileName}`
}

function makeSessionMetaKey(uploadId: string) {
  return `${TEMP_PREFIX}/${uploadId}/${SESSION_META_SUFFIX}`
}

function makeVideoSrc(env: Env, key: string) {
  const publicBase = safeString(env.AGGIE_MEDIA_PUBLIC_BASE, '').replace(/\/+$/, '')
  if (publicBase) {
    return `${publicBase}/${key}`
  }
  return `/${key}`
}

function canUseAuth(request: Request, token?: string) {
  if (!token) return true
  const raw = request.headers.get('authorization') ?? request.headers.get('x-admin-token')
  if (!raw) return false
  const candidate = raw.startsWith('Bearer ') ? raw.slice(7).trim() : raw.trim()
  return token === candidate
}

function cleanupSessions() {
  const now = Date.now()
  if (now - lastCleanup < CLEANUP_INTERVAL_MS) return
  lastCleanup = now
  for (const [uploadId, session] of uploadSessions) {
    if (now - session.createdAt > SESSION_TTL_MS) {
      uploadSessions.delete(uploadId)
    }
  }
}

function getSession(uploadId: string) {
  return uploadSessions.get(uploadId)
}

function setSession(uploadId: string, session: UploadSession) {
  uploadSessions.set(uploadId, session)
}

function dropSession(uploadId: string) {
  uploadSessions.delete(uploadId)
}

async function persistSessionToBucket(bucket: R2Bucket, uploadId: string, session: UploadSession) {
  const payload: UploadSessionPayload = {
    fileName: session.fileName,
    mimeType: session.mimeType,
    fileSize: session.fileSize,
    totalChunks: session.totalChunks,
    title: session.title,
    desc: session.desc,
    createdAt: session.createdAt,
  }
  await bucket.put(makeSessionMetaKey(uploadId), JSON.stringify(payload), {
    httpMetadata: { contentType: 'application/json' },
  })
}

async function loadSessionFromBucket(bucket: R2Bucket, uploadId: string) {
  const object = await bucket.get(makeSessionMetaKey(uploadId))
  if (!object) {
    return null
  }
  const raw = await object.text()
  let parsed: unknown = null
  try {
    parsed = JSON.parse(raw)
  } catch {
    return null
  }
  if (!parsed || typeof parsed !== 'object') {
    return null
  }
  const payload = parsed as Record<string, unknown>
  const fileName = safeString(payload.fileName, `video-${Date.now()}.mp4`)
  const mimeType = safeString(payload.mimeType, 'video/mp4')
  const fileSize = safeNumber(payload.fileSize)
  const totalChunks = Math.max(1, safeNumber(payload.totalChunks))
  const title = safeString(payload.title, fileName.replace(/\.[^/.]+$/, '') || '机构视频')
  const desc = safeString(payload.desc, '机构宣传视频（待补充）')
  const createdAt = safeNumber(payload.createdAt)
  if (fileSize <= 0 || totalChunks <= 0) {
    return null
  }
  return { fileName, mimeType, fileSize, totalChunks, title, desc, createdAt }
}

async function removeSessionFromBucket(bucket: R2Bucket, uploadId: string) {
  await bucket.delete(makeSessionMetaKey(uploadId))
}

async function getSessionFromBucketOrMemory(bucket: R2Bucket, uploadId: string) {
  const memorySession = getSession(uploadId)
  if (memorySession) {
    return memorySession
  }
  const restored = await loadSessionFromBucket(bucket, uploadId)
  if (restored) {
    setSession(uploadId, restored)
  }
  return restored
}

export type {
  Env,
}

export {
  VIDEO_CHUNK_SIZE,
  MAX_FILE_SIZE_BYTES,
  jsonResponse,
  corsPreflightResponse,
  safeNumber,
  safeString,
  isValidMp4,
  makeFinalFileName,
  makeFinalKey,
  makeTmpChunkKey,
  makeVideoSrc,
  canUseAuth,
  cleanupSessions,
  getSession,
  setSession,
  persistSessionToBucket,
  getSessionFromBucketOrMemory,
  removeSessionFromBucket,
  dropSession,
}
