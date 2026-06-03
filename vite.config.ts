import { randomUUID } from 'node:crypto'
import fs from 'node:fs/promises'
import path from 'node:path'
import { defineConfig, Plugin } from 'vite'
import react from '@vitejs/plugin-react'

const VIDEO_CHUNK_SIZE = 5 * 1024 * 1024
const MEDIA_UPLOAD_MAX_BYTES = 1024 * 1024 * 1024
const VIDEO_ALLOWED_MIME = new Set(['video/mp4', 'video/x-m4v'])
const MEDIA_UPLOAD_DIR = path.resolve(process.cwd(), 'public', 'media', 'videos')
const MEDIA_UPLOAD_TMP_DIR = path.resolve(process.cwd(), 'public', '.media-upload', 'chunks')
const MEDIA_VIDEO_CATALOG = path.resolve(process.cwd(), 'src', 'data', 'video.json')
const MEDIA_UPLOAD_INIT_ENDPOINT = '/api/media-upload-init'
const MEDIA_UPLOAD_CHUNK_ENDPOINT = '/api/media-upload-chunk'
const MEDIA_UPLOAD_COMPLETE_ENDPOINT = '/api/media-upload-complete'

interface InitPayload {
  fileName: string
  mimeType: string
  fileSize: number
  totalChunks: number
  title: string
  desc: string
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

function sanitizeBaseName(fileName: string) {
  const raw = fileName.trim().replace(/\.[^./\\]+$/, '')
  const safe = raw.replace(/[^a-zA-Z0-9_-]/g, '_')
  return safe || `video-${Date.now()}`
}

function isMp4(fileName: string, mimeType: string) {
  const nameExt = (fileName.split('.').pop() || '').toLowerCase() === 'mp4'
  const mime = mimeType.toLowerCase()
  return VIDEO_ALLOWED_MIME.has(mime) || nameExt
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

async function loadVideoCatalog() {
  try {
    const raw = await fs.readFile(MEDIA_VIDEO_CATALOG, 'utf8')
    const list = JSON.parse(raw)
    return Array.isArray(list) ? list as VideoCatalogEntry[] : []
  } catch {
    return []
  }
}

async function writeVideoCatalog(list: VideoCatalogEntry[]) {
  await fs.mkdir(path.dirname(MEDIA_VIDEO_CATALOG), { recursive: true })
  await fs.writeFile(MEDIA_VIDEO_CATALOG, `${JSON.stringify(list, null, 2)}\n`, 'utf8')
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

const localMediaUploadPlugin: Plugin = {
  name: 'aggie-local-media-upload',
  configureServer(server) {
    const sessions = new Map<string, UploadSession>()

    server.middlewares.use(async (req, res, next) => {
      if (req.method !== 'POST') {
        next()
        return
      }

      const target = normalizePath(req.url)

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
          if (fileSize > MEDIA_UPLOAD_MAX_BYTES) {
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

          const request = new Request('http://localhost/api/media/upload/chunk', {
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

          const completeTitle = safeString(raw.title, session.title)
          const completeDesc = safeString(raw.desc, session.desc)
          const chunkFiles = Array.from({ length: session.totalChunks }, (_, index) => getSessionChunkPath(uploadId, index))

          for (const chunkPath of chunkFiles) {
            try {
              await fs.access(chunkPath)
            } catch {
              sendJson(res, 400, { error: `缺少分片：${path.basename(chunkPath)}` })
              return
            }
          }

          const finalBase = sanitizeBaseName(session.fileName || `video-${Date.now()}`)
          const finalFileName = `${finalBase}-${Date.now()}-${uploadId.slice(0, 8)}.mp4`
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

          sendJson(res, 200, {
            videoSrc,
            title: completeTitle,
            desc: completeDesc,
          })
        } catch (error) {
          sendJson(res, 500, {
            error: error instanceof Error ? error.message : '合并上传失败。',
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
