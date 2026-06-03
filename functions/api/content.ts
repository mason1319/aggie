interface Env {
  AGGIE_CONTENT_KV?: KVNamespace
  AGGIE_CONTENT_ADMIN_TOKEN?: string
}

const CONTENT_KEY = 'aggie_content_bundle_v2'

function json(body: unknown, init?: ResponseInit) {
  return new Response(JSON.stringify(body), {
    ...init,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
      ...(init?.headers ?? {}),
    },
  })
}

function normalizeAdminToken(raw: string | undefined) {
  return raw?.trim() || undefined
}

function isWriteAuthorized(request: Request, secret?: string) {
  if (!secret) return true
  const header = request.headers.get('authorization') ?? request.headers.get('x-admin-token')
  if (!header) return false
  const token = header.startsWith('Bearer ') ? header.slice(7).trim() : header.trim()
  return token === secret
}

function normalizePayload(value: unknown) {
  if (!value || typeof value !== 'object') {
    return { bundle: null as Record<string, unknown> | null, updatedAt: null as string | null }
  }

  const payload = value as Record<string, unknown>
  const rawBundle = (payload.bundle && typeof payload.bundle === 'object')
    ? payload.bundle
    : payload

  return {
    bundle: rawBundle as Record<string, unknown>,
    updatedAt: typeof payload.updatedAt === 'string' ? payload.updatedAt : new Date().toISOString(),
  }
}

export const onRequestGet: PagesFunction<Env> = async (context) => {
  const kv = context.env.AGGIE_CONTENT_KV
  if (!kv) {
    return json({ error: 'AGGIE_CONTENT_KV binding not configured' }, { status: 500 })
  }

  const stored = await kv.get(CONTENT_KEY, { type: 'json' }).catch(() => null)
  if (!stored || typeof stored !== 'object') {
    return json({ bundle: null }, { status: 404 })
  }

  return json(stored)
}

export const onRequestPut: PagesFunction<Env> = async (context) => {
  const kv = context.env.AGGIE_CONTENT_KV
  const secret = normalizeAdminToken(context.env.AGGIE_CONTENT_ADMIN_TOKEN)
  if (!kv) {
    return json({ error: 'AGGIE_CONTENT_KV binding not configured' }, { status: 500 })
  }

  if (!isWriteAuthorized(context.request, secret)) {
    return json({ error: 'Unauthorized' }, { status: 401 })
  }

  const requestBody = await context.request.json().catch(() => null)
  const { bundle, updatedAt } = normalizePayload(requestBody)
  if (!bundle) {
    return json({ error: '保存内容不合法' }, { status: 400 })
  }

  const next = {
    bundle,
    meta: {
      updatedAt,
      syncSource: 'remote',
    },
  }

  await kv.put(CONTENT_KEY, JSON.stringify(next))
  return json({ ok: true, updatedAt })
}
