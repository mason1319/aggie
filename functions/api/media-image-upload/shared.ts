const IMAGE_CHUNK_SIZE = 1 * 1024 * 1024
const IMAGE_MAX_FILE_SIZE_BYTES = 8 * 1024 * 1024
const AUDIO_MAX_FILE_SIZE_BYTES = 32 * 1024 * 1024
const SESSION_TTL_MS = 90 * 60 * 1000
const CLEANUP_INTERVAL_MS = 3 * 60 * 1000
const SESSION_META_SUFFIX = 'session.json'

const ALLOWED_IMAGE_MIME = new Set([
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/webp',
  'image/gif',
])

const IMAGE_EXTENSIONS = ['jpg', 'jpeg', 'png', 'webp', 'gif']

const ALLOWED_AUDIO_MIME = new Set([
  'audio/mpeg',
  'audio/ogg',
  'audio/wav',
  'audio/wave',
  'audio/x-wav',
  'audio/aac',
  'audio/webm',
  'audio/m4a',
  'audio/x-m4a',
])

const IMAGE_PREFIX = 'media/honorImg'
const TEACHER_PREFIX = 'media/teachers'
const FEEDBACK_PREFIX = 'media/feedback'
const AUDIO_PREFIX = 'media/audios'
const TMP_PREFIX = 'media-image-uploads/tmp'

type ImageCategory = 'teacher' | 'honor' | 'feedback' | 'audio'

interface Env {
  AGGIE_MEDIA_BUCKET?: R2Bucket
  AGGIE_MEDIA_UPLOAD_TOKEN?: string
  AGGIE_MEDIA_PUBLIC_BASE?: string
}

interface ImageUploadSession {
  category: ImageCategory
  fileName: string
  mimeType: string
  fileSize: number
  totalChunks: number
  title: string
  desc: string
  createdAt: number
}

interface InitPayload {
  category: ImageCategory
  fileName: string
  mimeType: string
  fileSize: number
  totalChunks: number
  title: string
  desc: string
}

interface CompletePayload {
  uploadId: string
  title?: string
  desc?: string
}

const IMAGE_UPLOAD_SESSIONS = new Map<string, ImageUploadSession>()
let lastCleanup = 0

function jsonResponse(body: unknown, init?: ResponseInit) {
  return new Response(JSON.stringify(body), {
    ...init,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type,Authorization,X-Admin-Token',
      'Access-Control-Max-Age': '86400',
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
  return safe || `media-${Date.now()}`
}

function sanitizeMimeExt(fileName: string, mimeType: string, fallback = '.jpg') {
  const ext = (fileName.split('.').pop() || '').toLowerCase()
  if (ext && /^[a-z0-9]+$/.test(ext)) {
    return `.${ext}`
  }
  if (mimeType === 'image/png') {
    return '.png'
  }
  if (mimeType === 'image/webp') {
    return '.webp'
  }
  if (mimeType === 'image/gif') {
    return '.gif'
  }
  if (mimeType === 'audio/mpeg') {
    return '.mp3'
  }
  if (mimeType === 'audio/ogg') {
    return '.ogg'
  }
  if (mimeType === 'audio/wav' || mimeType === 'audio/wave' || mimeType === 'audio/x-wav') {
    return '.wav'
  }
  if (mimeType === 'audio/aac') {
    return '.aac'
  }
  if (mimeType === 'audio/webm') {
    return '.webm'
  }
  if (mimeType === 'audio/m4a' || mimeType === 'audio/x-m4a') {
    return '.m4a'
  }
  return fallback
}

function isImageType(fileName: string, mimeType: string) {
  const ext = fileName.split('.').pop()?.toLowerCase() || ''
  const mime = mimeType.toLowerCase()
  return ALLOWED_IMAGE_MIME.has(mime) || IMAGE_EXTENSIONS.includes(ext)
}

function isAudioType(fileName: string, mimeType: string) {
  const ext = fileName.split('.').pop()?.toLowerCase() || ''
  const mime = mimeType.toLowerCase()
  return ALLOWED_AUDIO_MIME.has(mime) || ['mp3', 'ogg', 'wav', 'm4a', 'aac', 'webm'].includes(ext)
}

function normalizeCategory(raw: string) {
  const normalized = raw.trim().toLowerCase()
  if (normalized === 'teacher' || normalized === 'honor' || normalized === 'feedback' || normalized === 'audio') {
    return normalized
  }
  return 'honor'
}

function categoryPrefix(category: ImageCategory) {
  if (category === 'teacher') {
    return TEACHER_PREFIX
  }
  if (category === 'honor') {
    return IMAGE_PREFIX
  }
  if (category === 'feedback') {
    return FEEDBACK_PREFIX
  }
  return AUDIO_PREFIX
}

function makeTempChunkKey(uploadId: string, chunkIndex: number) {
  return `${TMP_PREFIX}/${uploadId}/${chunkIndex}`
}

function makeSessionMetaKey(uploadId: string) {
  return `${TMP_PREFIX}/${uploadId}/${SESSION_META_SUFFIX}`
}

function makeFinalKey(category: ImageCategory, fileName: string, uploadId: string, mimeType: string) {
  const finalBase = sanitizeBaseName(fileName || `image-${Date.now()}`)
  const categoryPath = categoryPrefix(category)
  const ext = sanitizeMimeExt(fileName, mimeType, category === 'audio' ? '.mp3' : '.jpg')
  return `${categoryPath}/${finalBase}-${Date.now()}-${uploadId.slice(0, 8)}${ext}`
}

function makePublicUrl(env: Env, key: string) {
  const publicBase = safeString(env.AGGIE_MEDIA_PUBLIC_BASE, '').replace(/\/+$/, '')
  if (publicBase) {
    return `${publicBase}/${key}`
  }
  return `/api/media-download?key=${encodeURIComponent(key)}`
}

function isValidCategory(category: string): category is ImageCategory {
  return category === 'teacher' || category === 'honor' || category === 'feedback' || category === 'audio'
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
  if (now - lastCleanup < CLEANUP_INTERVAL_MS) {
    return
  }
  lastCleanup = now
  for (const [uploadId, session] of IMAGE_UPLOAD_SESSIONS) {
    if (now - session.createdAt > SESSION_TTL_MS) {
      IMAGE_UPLOAD_SESSIONS.delete(uploadId)
    }
  }
}

function getSession(uploadId: string) {
  return IMAGE_UPLOAD_SESSIONS.get(uploadId)
}

function setSession(uploadId: string, session: ImageUploadSession) {
  IMAGE_UPLOAD_SESSIONS.set(uploadId, session)
}

function dropSession(uploadId: string) {
  IMAGE_UPLOAD_SESSIONS.delete(uploadId)
}

async function persistSessionToBucket(bucket: R2Bucket, uploadId: string, session: ImageUploadSession) {
  const payload = {
    category: session.category,
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

async function removeSessionFromBucket(bucket: R2Bucket, uploadId: string) {
  await bucket.delete(makeSessionMetaKey(uploadId))
}

async function loadSessionFromBucket(bucket: R2Bucket, uploadId: string) {
  const rawObject = await bucket.get(makeSessionMetaKey(uploadId))
  if (!rawObject) {
    return null
  }

  const rawText = await rawObject.text()
  let parsed: unknown = null
  try {
    parsed = JSON.parse(rawText)
  } catch {
    return null
  }
  if (!parsed || typeof parsed !== 'object') {
    return null
  }

  const payload = parsed as Record<string, unknown>
  const category = normalizeCategory(safeString(payload.category, 'honor'))
  const fileName = safeString(payload.fileName, `image-${Date.now()}`)
  const mimeType = safeString(payload.mimeType, category === 'audio' ? 'audio/mpeg' : 'image/jpeg')
  const fileSize = safeNumber(payload.fileSize)
  const totalChunks = safeNumber(payload.totalChunks)
  const title = safeString(payload.title, fileName)
  const desc = safeString(payload.desc, '图片上传')
  const createdAt = safeNumber(payload.createdAt)

  if (!isValidCategory(category)) {
    return null
  }
  if (fileSize <= 0 || totalChunks <= 0) {
    return null
  }

  return {
    category,
    fileName,
    mimeType,
    fileSize,
    totalChunks,
    title,
    desc,
    createdAt,
  }
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

function isAllowedFile(session: ImageUploadSession) {
  if (session.category === 'audio') {
    return true
  }
  return true
}

export {
  IMAGE_CHUNK_SIZE,
  IMAGE_MAX_FILE_SIZE_BYTES,
  AUDIO_MAX_FILE_SIZE_BYTES,
  jsonResponse,
  corsPreflightResponse,
  safeNumber,
  safeString,
  makeFinalKey,
  makeTempChunkKey,
  makePublicUrl,
  makeSessionMetaKey,
  canUseAuth,
  isImageType,
  isAudioType,
  isAllowedFile,
  sanitizeBaseName,
  cleanupSessions,
  setSession,
  getSessionFromBucketOrMemory,
  persistSessionToBucket,
  removeSessionFromBucket,
  dropSession,
  getSession as getImageSession,
  loadSessionFromBucket,
  type Env,
  type ImageUploadSession,
  type InitPayload,
  type CompletePayload,
}
