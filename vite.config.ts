import { randomUUID } from 'node:crypto'
import fsSync from 'node:fs'
import fs from 'node:fs/promises'
import path from 'node:path'
import { defineConfig, Plugin } from 'vite'
import react from '@vitejs/plugin-react'

const VIDEO_CHUNK_SIZE = 5 * 1024 * 1024
const IMAGE_CHUNK_SIZE = 1 * 1024 * 1024
const VIDEO_UPLOAD_MAX_BYTES = 1024 * 1024 * 1024
const IMAGE_UPLOAD_MAX_BYTES = 8 * 1024 * 1024
const AUDIO_UPLOAD_MAX_BYTES = 32 * 1024 * 1024
const VIDEO_ALLOWED_MIME = new Set(['video/mp4', 'video/x-m4v'])
const IMAGE_ALLOWED_MIME = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
])
const AUDIO_ALLOWED_MIME = new Set([
  'audio/mpeg',
  'audio/ogg',
  'audio/wav',
  'audio/wave',
  'audio/x-wav',
  'audio/aac',
  'audio/m4a',
  'audio/x-m4a',
  'audio/webm',
])
const IMAGE_ALLOWED_EXTENSIONS = ['jpg', 'jpeg', 'png', 'webp', 'gif']
const AUDIO_ALLOWED_EXTENSIONS = ['mp3', 'ogg', 'wav', 'm4a', 'aac', 'webm']

const PUBLIC_MEDIA_DIR = path.resolve(process.cwd(), 'public', 'media')
const MEDIA_UPLOAD_DIR = path.resolve(PUBLIC_MEDIA_DIR, 'videos')
const MEDIA_UPLOAD_TMP_DIR = path.resolve(process.cwd(), 'public', '.media-upload', 'chunks')
const MEDIA_TEACHER_DIR = path.resolve(PUBLIC_MEDIA_DIR, 'teachers')
const MEDIA_HONOR_DIR = path.resolve(PUBLIC_MEDIA_DIR, 'honorImg')
const MEDIA_FEEDBACK_DIR = path.resolve(PUBLIC_MEDIA_DIR, 'feedback')
const MEDIA_AUDIO_DIR = path.resolve(PUBLIC_MEDIA_DIR, 'audios')

const DATA_DIR = path.resolve(process.cwd(), 'src', 'data')
const MEDIA_VIDEO_CATALOG = path.resolve(DATA_DIR, 'video.json')
const HONOR_CATALOG = path.resolve(DATA_DIR, 'honor.json')

const MEDIA_UPLOAD_INIT_ENDPOINT = '/api/media-upload-init'
const MEDIA_UPLOAD_CHUNK_ENDPOINT = '/api/media-upload-chunk'
const MEDIA_UPLOAD_COMPLETE_ENDPOINT = '/api/media-upload-complete'
const MEDIA_IMAGE_UPLOAD_INIT_ENDPOINT = '/api/media-image-upload-init'
const MEDIA_IMAGE_UPLOAD_CHUNK_ENDPOINT = '/api/media-image-upload-chunk'
const MEDIA_IMAGE_UPLOAD_COMPLETE_ENDPOINT = '/api/media-image-upload-complete'
const MEDIA_DOWNLOAD_ENDPOINT = '/api/media-download'
const HONOR_DATA_ENDPOINT = '/api/honor.json'

interface InitPayload {
  fileName: string
  mimeType: string
  fileSize: number
  totalChunks: number
  title: string
  desc: string
}

interface ImageUploadSession extends InitPayload {
  category: 'teacher' | 'honor' | 'feedback' | 'audio'
  createdAt: number
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

interface VideoCatalogEntry {
  videoSrc: string
  title: string
  desc: string
}

interface HonorPhotoEntry {
  id: string
  name: string
  url: string
  title: string
  desc: string
  uploadedAt: string
}

interface ImageUploadResult {
  imageUrl: string
}

interface VideoUploadResult {
  videoSrc: string
  title: string
  desc: string
}

interface JsonErrorResponse {
  error: string
}

function sendJson(res: any, status: number, payload: unknown) {
  res.statusCode = status
  res.setHeader('content-type', 'application/json; charset=utf-8')
  res.end(JSON.stringify(payload))
}

function normalizePath(reqUrl: string | undefined) {
  return (reqUrl || '').split('?')[0]
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

function parseRange(rangeHeader: string | undefined, total: number) {
  if (!rangeHeader || !rangeHeader.startsWith('bytes=')) {
    return null
  }

  const match = /bytes=(\d*)-(\d*)/.exec(rangeHeader)
  if (!match) {
    return null
  }

  const startText = match[1]
  const endText = match[2]
  const start = startText ? Number(startText) : 0
  const end = endText ? Number(endText) : total - 1

  if (!Number.isInteger(start) || !Number.isInteger(end) || start < 0 || end < 0 || start > end || start >= total) {
    return null
  }

  const normalizedEnd = Math.min(end, total - 1)
  return {
    start,
    end: normalizedEnd,
    length: normalizedEnd - start + 1,
  }
}

function sanitizeBaseName(fileName: string, fallback: string) {
  const raw = fileName.trim().replace(/\.[^./\\]+$/, '')
  const safe = raw.replace(/[^a-zA-Z0-9_-]/g, '_')
  return safe || fallback
}

function sanitizeMimeExt(fileName: string, mimeType: string, fallback = '.jpg') {
  const extFromName = (fileName.split('.').pop() || '').toLowerCase()
  if (extFromName && /^[a-z0-9]+$/.test(extFromName)) {
    return `.${extFromName}`
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
  return fallback
}

function isSafeMediaKey(key: string) {
  const normalized = key.trim().replace(/^\/+/, '')
  return normalized.startsWith('media/') && !normalized.includes('..')
}

function isMp4(fileName: string, mimeType: string) {
  const nameExt = (fileName.split('.').pop() || '').toLowerCase() === 'mp4'
  const mime = mimeType.toLowerCase()
  return VIDEO_ALLOWED_MIME.has(mime) || nameExt
}

function isImageType(fileName: string, mimeType: string) {
  const ext = fileName.split('.').pop()?.toLowerCase() || ''
  const mime = mimeType.toLowerCase()
  return IMAGE_ALLOWED_MIME.has(mime) || IMAGE_ALLOWED_EXTENSIONS.includes(ext)
}

function isAudioType(fileName: string, mimeType: string) {
  const ext = fileName.split('.').pop()?.toLowerCase() || ''
  const mime = mimeType.toLowerCase()
  return AUDIO_ALLOWED_MIME.has(mime) || AUDIO_ALLOWED_EXTENSIONS.includes(ext)
}

async function collectBody(req: NodeJS.ReadableStream) {
  const chunks: Buffer[] = []
  for await (const chunk of req) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk))
  }
  return Buffer.concat(chunks)
}

function makeSessionDir(uploadId: string) {
  return path.join(MEDIA_UPLOAD_TMP_DIR, uploadId)
}

function getSessionChunkPath(uploadId: string, index: number) {
  return path.join(makeSessionDir(uploadId), `${index}.part`)
}

async function writeFileJson(filePath: string, payload: unknown) {
  await fs.mkdir(path.dirname(filePath), { recursive: true })
  await fs.writeFile(filePath, `${JSON.stringify(payload, null, 2)}\n`, 'utf8')
}

async function loadJsonArray<T>(filePath: string): Promise<T[]> {
  try {
    const raw = await fs.readFile(filePath, 'utf8')
    const data = JSON.parse(raw)
    if (Array.isArray(data)) {
      return data as T[]
    }
    return []
  } catch {
    return []
  }
}

async function loadHonorCatalog(): Promise<HonorPhotoEntry[]> {
  const list = await loadJsonArray<HonorPhotoEntry>(HONOR_CATALOG)
  return list
    .filter((item) => Boolean(item) && typeof item === 'object')
    .map((item) => ({
      id: safeString((item as HonorPhotoEntry).id, `honor-${Date.now()}`),
      name: safeString((item as HonorPhotoEntry).name, 'honor-image'),
      url: safeString((item as HonorPhotoEntry).url, ''),
      title: safeString((item as HonorPhotoEntry).title, 'honor'),
      desc: safeString((item as HonorPhotoEntry).desc, '荣誉墙照片'),
      uploadedAt: safeString((item as HonorPhotoEntry).uploadedAt, new Date().toISOString()),
    }))
}

async function writeJsonArray(filePath: string, list: unknown[]) {
  await writeFileJson(filePath, list)
}

async function upsertImageCatalog(catalogPath: string, payload: Omit<HonorPhotoEntry, 'url'> & { url: string }) {
  const list = await loadJsonArray<HonorPhotoEntry>(catalogPath)
  const next = [
    ...list.filter((item) => item.url !== payload.url),
    payload,
  ]
  await writeJsonArray(catalogPath, next)
}

async function loadVideoCatalog() {
  const raw = await loadJsonArray<VideoCatalogEntry>(MEDIA_VIDEO_CATALOG)
  return raw
    .filter((item) => Boolean(item) && typeof item === 'object')
    .map((item) => ({
      videoSrc: safeString(item.videoSrc, ''),
      title: safeString(item.title, '机构视频'),
      desc: safeString(item.desc, '机构宣传视频'),
    }))
    .filter((item) => Boolean(item.videoSrc))
}

async function writeVideoCatalog(list: VideoCatalogEntry[]) {
  await writeFileJson(MEDIA_VIDEO_CATALOG, list)
}

async function upsertVideoCatalog(payload: VideoCatalogEntry) {
  const list = await loadVideoCatalog()
  const index = list.findIndex((item) => item.videoSrc === payload.videoSrc)
  if (index >= 0) {
    list[index] = {
      ...list[index],
      title: payload.title,
      desc: payload.desc,
    }
    await writeVideoCatalog(list)
    return
  }
  await writeVideoCatalog([...list, payload])
}

async function writeJsonErrorResponse(response: JsonErrorResponse, status: number) {
  return response
}

const localMediaUploadPlugin: Plugin = {
  name: 'aggie-local-media-upload',
  configureServer(server) {
    const sessions = new Map<string, UploadSession>()
    const imageSessions = new Map<string, ImageUploadSession>()

    server.middlewares.use(async (req, res, next) => {
      const target = normalizePath(req.url)

      if ((req.method === 'GET' || req.method === 'HEAD') && target === MEDIA_DOWNLOAD_ENDPOINT) {
        try {
          const requestUrl = new URL(req.url || '', 'http://127.0.0.1')
          const rawKey = requestUrl.searchParams.get('key') || ''
          const decodedKey = decodeURIComponent(rawKey).replace(/^\/+/, '')
          if (!isSafeMediaKey(decodedKey)) {
            sendJson(res, 400, { error: '下载 key 无效。' })
            return
          }

          const filePath = path.resolve(process.cwd(), 'public', decodedKey)
          const publicRoot = path.resolve(process.cwd(), 'public')
          if (!filePath.startsWith(publicRoot)) {
            sendJson(res, 400, { error: '下载路径非法。' })
            return
          }

          let stat
          try {
            stat = await fs.stat(filePath)
          } catch {
            sendJson(res, 404, { error: '视频文件不存在。' })
            return
          }

          const total = stat.size
          const range = parseRange(
            typeof req.headers.range === 'string' ? req.headers.range : undefined,
            total,
          )

          res.setHeader('Access-Control-Allow-Origin', '*')
          res.setHeader('Accept-Ranges', 'bytes')
          res.setHeader('Cache-Control', 'no-cache')
          res.setHeader('Content-Type', 'video/mp4')

          if (!range) {
            res.statusCode = 200
            res.setHeader('Content-Length', String(total))
            if (req.method === 'HEAD') {
              res.end()
              return
            }
            fsSync.createReadStream(filePath).pipe(res)
            return
          }

          res.statusCode = 206
          res.setHeader('Content-Length', String(range.length))
          res.setHeader('Content-Range', `bytes ${range.start}-${range.end}/${total}`)
          if (req.method === 'HEAD') {
            res.end()
            return
          }
          fsSync.createReadStream(filePath, { start: range.start, end: range.end }).pipe(res)
        } catch {
          sendJson(res, 500, { error: '视频下载失败。' })
        }
        return
      }

      if (req.method === 'GET' && target === HONOR_DATA_ENDPOINT) {
        try {
          const list = await loadJsonArray(HONOR_CATALOG)
          sendJson(res, 200, list)
        } catch {
          sendJson(res, 500, { error: '读取 honor.json 失败。' })
        }
        return
      }

      if (req.method !== 'POST') {
        next()
        return
      }

      if (target === MEDIA_UPLOAD_INIT_ENDPOINT) {
        try {
          const body = await collectBody(req)
          const raw = JSON.parse(body.toString('utf8')) as Partial<InitPayload>
          const fileName = safeString(raw.fileName, `video-${Date.now()}.mp4`)
          const mimeType = safeString(raw.mimeType, 'video/mp4')
          const fileSize = safeNumber(raw.fileSize)
          const totalChunks = Math.max(1, Math.floor(safeNumber(raw.totalChunks)))
          const title = safeString(raw.title, fileName.replace(/\.[^/.]+$/, '') || '机构视频')
          const desc = safeString(raw.desc, '机构宣传视频（待补充）')

          if (fileSize <= 0) {
            sendJson(res, 400, { error: '文件大小异常。' })
            return
          }
          if (!Number.isFinite(totalChunks) || totalChunks < 1) {
            sendJson(res, 400, { error: 'totalChunks 无效。' })
            return
          }
          if (fileSize > VIDEO_UPLOAD_MAX_BYTES) {
            sendJson(res, 413, { error: `文件过大（${Math.ceil(fileSize / 1024 / 1024)}MB），建议改为更小视频重试。` })
            return
          }
          if (!isMp4(fileName, mimeType)) {
            sendJson(res, 400, { error: '仅支持 MP4 文件。' })
            return
          }

          const uploadId = `${Date.now()}-${randomUUID().replace(/-/g, '').slice(0, 12)}`
          const session: UploadSession = {
            fileName,
            mimeType,
            fileSize,
            totalChunks,
            title,
            desc,
            createdAt: Date.now(),
          }
          sessions.set(uploadId, session)
          await fs.mkdir(makeSessionDir(uploadId), { recursive: true })

          sendJson(res, 200, { uploadId, chunkSize: VIDEO_CHUNK_SIZE, totalChunks })
        } catch {
          sendJson(res, 500, { error: '初始化上传失败。' })
        }
        return
      }

      if (target === MEDIA_UPLOAD_CHUNK_ENDPOINT) {
        try {
          const body = await collectBody(req)
          const contentType = req.headers['content-type']
          if (!contentType || !contentType.includes('multipart/form-data')) {
            sendJson(res, 400, { error: '请使用 multipart/form-data 上传分片。' })
            return
          }

          const request = new Request(`http://localhost${MEDIA_UPLOAD_CHUNK_ENDPOINT}`, {
            method: 'POST',
            headers: { 'content-type': String(contentType) },
            body,
          })
          const formData = await request.formData()
          const uploadId = safeString(formData.get('uploadId'), '')
          const chunkIndex = Number(safeString(formData.get('chunkIndex'), '0'))

          if (!uploadId) {
            sendJson(res, 400, { error: '缺少 uploadId。' })
            return
          }
          if (!Number.isInteger(chunkIndex) || chunkIndex < 0) {
            sendJson(res, 400, { error: 'chunkIndex 无效。' })
            return
          }

          const session = sessions.get(uploadId)
          if (!session) {
            sendJson(res, 404, { error: '未找到上传任务。' })
            return
          }
          if (chunkIndex >= session.totalChunks) {
            sendJson(res, 400, { error: `chunkIndex 应在 0~${session.totalChunks - 1} 范围。` })
            return
          }

          const rawFile = formData.get('file')
          if (!(rawFile instanceof Blob)) {
            sendJson(res, 400, { error: '缺少分片文件。' })
            return
          }
          const chunkBuffer = Buffer.from(await rawFile.arrayBuffer())
          if (chunkBuffer.length > VIDEO_CHUNK_SIZE + 1024) {
            sendJson(res, 400, { error: '分片大小异常。' })
            return
          }

          await fs.mkdir(makeSessionDir(uploadId), { recursive: true })
          await fs.writeFile(getSessionChunkPath(uploadId, chunkIndex), chunkBuffer)
          sendJson(res, 200, { uploadId, chunkIndex })
        } catch {
          sendJson(res, 500, { error: '分片上传失败。' })
        }
        return
      }

      if (target === MEDIA_UPLOAD_COMPLETE_ENDPOINT) {
        try {
          const body = await collectBody(req)
          const raw = JSON.parse(body.toString('utf8')) as Record<string, unknown>
          const uploadId = safeString(raw.uploadId, '')
          if (!uploadId) {
            sendJson(res, 400, { error: '缺少 uploadId。' })
            return
          }

          const session = sessions.get(uploadId)
          if (!session) {
            sendJson(res, 404, { error: '未找到上传任务。' })
            return
          }

          const completeTitle = safeString(raw.title as unknown, session.title)
          const completeDesc = safeString(raw.desc as unknown, session.desc)
          const chunkFiles = Array.from({ length: session.totalChunks }, (_, index) => getSessionChunkPath(uploadId, index))

          for (const chunkPath of chunkFiles) {
            try {
              await fs.access(chunkPath)
            } catch {
              sendJson(res, 400, { error: `缺少分片：${path.basename(chunkPath)}` })
              return
            }
          }

          const finalBase = sanitizeBaseName(session.fileName || `video-${Date.now()}`, `video-${Date.now()}`)
          const ext = sanitizeMimeExt(session.fileName, session.mimeType, '.mp4')
          const finalFileName = `${finalBase}-${Date.now()}-${uploadId.slice(0, 8)}${ext}`
          const finalPath = path.join(MEDIA_UPLOAD_DIR, finalFileName)

          await fs.mkdir(MEDIA_UPLOAD_DIR, { recursive: true })
          await fs.writeFile(finalPath, Buffer.alloc(0))
          for (const chunkPath of chunkFiles) {
            const chunkBuffer = await fs.readFile(chunkPath)
            await fs.appendFile(finalPath, chunkBuffer)
            await fs.rm(chunkPath, { force: true })
          }

          await fs.rm(makeSessionDir(uploadId), { recursive: true, force: true })
          sessions.delete(uploadId)

          const videoSrc = `/media/videos/${finalFileName}`
          await upsertVideoCatalog({
            videoSrc,
            title: completeTitle,
            desc: completeDesc,
          })

          const response: VideoUploadResult = {
            videoSrc,
            title: completeTitle,
            desc: completeDesc,
          }
          sendJson(res, 200, response)
        } catch (error) {
          sendJson(res, 500, {
            error: error instanceof Error ? error.message : '合并上传失败。',
          })
        }
        return
      }

      if (target === MEDIA_IMAGE_UPLOAD_INIT_ENDPOINT) {
        try {
          const body = await collectBody(req)
          const raw = JSON.parse(body.toString('utf8')) as {
            category?: string
            fileName?: string
            mimeType?: string
            fileSize?: number
            totalChunks?: number
            title?: string
            desc?: string
          }

          const fileName = safeString(raw.fileName, `image-${Date.now()}`)
          const mimeType = safeString(raw.mimeType, 'image/jpeg')
          const fileSize = safeNumber(raw.fileSize)
          const totalChunks = Math.max(1, Math.floor(safeNumber(raw.totalChunks)))
          const category = (safeString(raw.category as unknown as string, 'honor') as ImageUploadSession['category'])
          const title = safeString(raw.title, fileName)
          const desc = safeString(raw.desc, '图片上传')

          if (!['teacher', 'honor', 'feedback', 'audio'].includes(category)) {
            sendJson(res, 400, { error: '图片分类不合法。' })
            return
          }

          if (fileSize <= 0) {
            sendJson(res, 400, { error: '文件大小异常。' })
            return
          }
          if (!Number.isFinite(totalChunks) || totalChunks < 1) {
            sendJson(res, 400, { error: 'totalChunks 无效。' })
            return
          }
          if (category === 'audio') {
            if (!isAudioType(fileName, mimeType)) {
              sendJson(res, 400, { error: '仅支持常见音频格式（mp3/wav/m4a/ogg）。' })
              return
            }
          } else if (!isImageType(fileName, mimeType)) {
            sendJson(res, 400, { error: '仅支持 JPG / PNG / WEBP / GIF。' })
            return
          }

          if (fileSize > (category === 'audio' ? AUDIO_UPLOAD_MAX_BYTES : IMAGE_UPLOAD_MAX_BYTES)) {
            sendJson(res, 413, { error: `文件过大（${Math.ceil(fileSize / 1024 / 1024)}MB）。` })
            return
          }

          const uploadId = `${Date.now()}-${randomUUID().replace(/-/g, '').slice(0, 12)}`
          const session: ImageUploadSession = {
            category,
            fileName,
            mimeType,
            fileSize,
            totalChunks,
            title,
            desc,
            createdAt: Date.now(),
          }
          imageSessions.set(uploadId, session)
          await fs.mkdir(makeSessionDir(uploadId), { recursive: true })

          sendJson(res, 200, { uploadId, chunkSize: IMAGE_CHUNK_SIZE, totalChunks })
        } catch {
          sendJson(res, 500, { error: '初始化图片上传失败。' })
        }
        return
      }

      if (target === MEDIA_IMAGE_UPLOAD_CHUNK_ENDPOINT) {
        try {
          const body = await collectBody(req)
          const contentType = req.headers['content-type']
          if (!contentType || !contentType.includes('multipart/form-data')) {
            sendJson(res, 400, { error: '请使用 multipart/form-data 上传分片。' })
            return
          }

          const request = new Request(`http://localhost${MEDIA_IMAGE_UPLOAD_CHUNK_ENDPOINT}`, {
            method: 'POST',
            headers: { 'content-type': String(contentType) },
            body,
          })
          const formData = await request.formData()
          const uploadId = safeString(formData.get('uploadId'), '')
          const chunkIndex = Number(safeString(formData.get('chunkIndex'), '0'))

          if (!uploadId) {
            sendJson(res, 400, { error: '缺少 uploadId。' })
            return
          }
          if (!Number.isInteger(chunkIndex) || chunkIndex < 0) {
            sendJson(res, 400, { error: 'chunkIndex 无效。' })
            return
          }

          const session = imageSessions.get(uploadId)
          if (!session) {
            sendJson(res, 404, { error: '未找到上传任务。' })
            return
          }
          if (chunkIndex >= session.totalChunks) {
            sendJson(res, 400, { error: `chunkIndex 应在 0~${session.totalChunks - 1} 范围。` })
            return
          }

          const rawFile = formData.get('file')
          if (!(rawFile instanceof Blob)) {
            sendJson(res, 400, { error: '缺少分片文件。' })
            return
          }
          const chunkBuffer = Buffer.from(await rawFile.arrayBuffer())
          if (chunkBuffer.length > IMAGE_CHUNK_SIZE + 1024) {
            sendJson(res, 400, { error: '分片大小异常。' })
            return
          }

          await fs.mkdir(makeSessionDir(uploadId), { recursive: true })
          await fs.writeFile(getSessionChunkPath(uploadId, chunkIndex), chunkBuffer)
          sendJson(res, 200, { uploadId, chunkIndex })
        } catch {
          sendJson(res, 500, { error: '图片分片上传失败。' })
        }
        return
      }

      if (target === MEDIA_IMAGE_UPLOAD_COMPLETE_ENDPOINT) {
        try {
          const body = await collectBody(req)
          const raw = JSON.parse(body.toString('utf8')) as Record<string, unknown>
          const uploadId = safeString(raw.uploadId, '')
          if (!uploadId) {
            sendJson(res, 400, { error: '缺少 uploadId。' })
            return
          }

          const session = imageSessions.get(uploadId)
          if (!session) {
            sendJson(res, 404, { error: '未找到上传任务。' })
            return
          }

          const chunkFiles = Array.from({ length: session.totalChunks }, (_, index) => getSessionChunkPath(uploadId, index))
          for (const chunkPath of chunkFiles) {
            try {
              await fs.access(chunkPath)
            } catch {
              sendJson(res, 400, { error: `缺少分片：${path.basename(chunkPath)}` })
              return
            }
          }

          const finalBase = sanitizeBaseName(session.fileName || `image-${Date.now()}`, `image-${Date.now()}`)
          const ext = sanitizeMimeExt(session.fileName, session.mimeType, session.category === 'audio' ? '.mp3' : '.jpg')
          const finalFileName = `${finalBase}-${Date.now()}-${uploadId.slice(0, 8)}${ext}`

          const targetDir = session.category === 'teacher'
            ? MEDIA_TEACHER_DIR
            : session.category === 'honor'
              ? MEDIA_HONOR_DIR
              : session.category === 'feedback'
                ? MEDIA_FEEDBACK_DIR
                : MEDIA_AUDIO_DIR
          const publicPath = session.category === 'teacher'
            ? `/media/teachers/${finalFileName}`
            : session.category === 'honor'
              ? `/media/honorImg/${finalFileName}`
              : session.category === 'feedback'
                ? `/media/feedback/${finalFileName}`
                : `/media/audios/${finalFileName}`

          const finalPath = path.join(targetDir, finalFileName)
          await fs.mkdir(targetDir, { recursive: true })
          await fs.writeFile(finalPath, Buffer.alloc(0))
          for (const chunkPath of chunkFiles) {
            const chunkBuffer = await fs.readFile(chunkPath)
            await fs.appendFile(finalPath, chunkBuffer)
            await fs.rm(chunkPath, { force: true })
          }

          await fs.rm(makeSessionDir(uploadId), { recursive: true, force: true })
          imageSessions.delete(uploadId)

          if (session.category === 'honor') {
            const catalog = await loadHonorCatalog()
            const newEntry: HonorPhotoEntry = {
              id: `honor-${Date.now()}-${uploadId.slice(0, 6)}`,
              name: session.fileName,
              url: publicPath,
              title: safeString(raw.title as unknown, session.title || session.fileName),
              desc: safeString(raw.desc as unknown, session.desc || '荣誉墙照片'),
              uploadedAt: new Date().toISOString(),
            }
            await upsertImageCatalog(HONOR_CATALOG, newEntry)
          }

          const response: ImageUploadResult = {
            imageUrl: publicPath,
          }
          sendJson(res, 200, response)
        } catch (error) {
          sendJson(res, 500, {
            error: error instanceof Error ? error.message : '图片合并上传失败。',
          })
        }
        return
      }

      next()
    })
  },
}

export default defineConfig({
  plugins: [react(), localMediaUploadPlugin],
})
