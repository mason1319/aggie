interface Env {
  AGGIE_MEDIA_BUCKET?: R2Bucket
}

function jsonResponse(body: unknown, init?: ResponseInit) {
  return new Response(JSON.stringify(body), {
    ...init,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
      'Access-Control-Allow-Origin': '*',
      ...(init?.headers ?? {}),
    },
  })
}

function parseRange(rangeHeader: string | null, total: number) {
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

  if (!Number.isInteger(start) || !Number.isInteger(end) || start < 0 || end < 0 || start > end) {
    return null
  }
  if (start >= total) {
    return null
  }
  const normalizedEnd = Math.min(end, total - 1)
  const length = normalizedEnd - start + 1
  return { start, end: normalizedEnd, length }
}

export const onRequestGet = async (context: { request: Request, env: Env }) => {
  const bucket = context.env.AGGIE_MEDIA_BUCKET
  if (!bucket) {
    return jsonResponse({ error: 'AGGIE_MEDIA_BUCKET 未绑定，暂不支持流媒体下载。' }, { status: 500 })
  }

  const url = new URL(context.request.url)
  const rawKey = url.searchParams.get('key')
  if (!rawKey || !rawKey.trim()) {
    return jsonResponse({ error: '缺少下载 key。' }, { status: 400 })
  }
  const key = decodeURIComponent(rawKey)

  const object = await bucket.get(key)
  if (!object) {
    return jsonResponse({ error: '视频文件不存在。' }, { status: 404 })
  }

  const total = object.size || 0
  if (typeof total === 'number' && total <= 0) {
    return jsonResponse({ error: '视频文件为空。' }, { status: 400 })
  }

  const range = parseRange(context.request.headers.get('Range'), total)
  const headers = new Headers({
    'Access-Control-Allow-Origin': '*',
    'Accept-Ranges': 'bytes',
    'Cache-Control': 'private, max-age=31536000, immutable',
    'Content-Type': object.httpMetadata?.contentType || 'video/mp4',
    'Content-Length': String(range ? range.length : total),
  })

  if (!range) {
    return new Response(object.body, { status: 200, headers })
  }

  const sliced = await bucket.get(key, { range: { offset: range.start, length: range.length } })
  if (!sliced || !sliced.body) {
    return jsonResponse({ error: '读取视频片段失败。' }, { status: 500 })
  }
  const contentRange = `bytes ${range.start}-${range.end}/${total}`
  headers.set('Content-Range', contentRange)
  return new Response(sliced.body, {
    status: 206,
    headers,
  })
}
