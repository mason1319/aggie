interface Env {
  FEEDBACK_DB?: D1Database
}

interface FeedbackEntryRow {
  id: string
  role: string
  name: string
  subtitle: string
  content: string
  avatar_url: string
  image_url: string | null
  contact: string | null
  created_at: string
}

async function ensureSchema(db: D1Database) {
  await db.prepare(`
    CREATE TABLE IF NOT EXISTS feedback_entries (
      id TEXT PRIMARY KEY,
      role TEXT NOT NULL,
      name TEXT NOT NULL,
      subtitle TEXT NOT NULL,
      content TEXT NOT NULL,
      avatar_url TEXT NOT NULL,
      image_url TEXT,
      contact TEXT,
      created_at TEXT NOT NULL
    )
  `).run()
}

function toResponseEntry(row: FeedbackEntryRow) {
  return {
    id: row.id,
    role: row.role,
    name: row.name,
    subtitle: row.subtitle,
    content: row.content,
    avatarUrl: row.avatar_url,
    imageUrl: row.image_url ?? undefined,
    contact: row.contact ?? undefined,
    createdAt: row.created_at,
  }
}

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

function isValidString(value: unknown) {
  return typeof value === 'string' && value.trim().length > 0
}

export const onRequestGet: PagesFunction<Env> = async (context) => {
  const db = context.env.FEEDBACK_DB
  if (!db) {
    return json({ error: 'FEEDBACK_DB binding not configured' }, { status: 500 })
  }

  await ensureSchema(db)
  const result = await db.prepare(
    `SELECT id, role, name, subtitle, content, avatar_url, image_url, contact, created_at
     FROM feedback_entries
     ORDER BY datetime(created_at) DESC, rowid DESC`,
  ).all<FeedbackEntryRow>()

  return json({ entries: (result.results ?? []).map(toResponseEntry) })
}

export const onRequestPost: PagesFunction<Env> = async (context) => {
  const db = context.env.FEEDBACK_DB
  if (!db) {
    return json({ error: 'FEEDBACK_DB binding not configured' }, { status: 500 })
  }

  await ensureSchema(db)
  const payload = await context.request.json().catch(() => null) as null | Record<string, unknown>

  if (!payload || !isValidString(payload.role) || !isValidString(payload.name) || !isValidString(payload.subtitle) || !isValidString(payload.content) || !isValidString(payload.avatarUrl)) {
    return json({ error: '提交内容不完整' }, { status: 400 })
  }

  const entry = {
    id: isValidString(payload.id) ? payload.id.trim() : `feedback-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    role: payload.role.trim(),
    name: payload.name.trim(),
    subtitle: payload.subtitle.trim(),
    content: payload.content.trim(),
    avatarUrl: payload.avatarUrl.trim(),
    imageUrl: typeof payload.imageUrl === 'string' && payload.imageUrl.trim() ? payload.imageUrl.trim() : null,
    contact: typeof payload.contact === 'string' && payload.contact.trim() ? payload.contact.trim() : null,
    createdAt: typeof payload.createdAt === 'string' && payload.createdAt.trim() ? payload.createdAt.trim() : new Date().toISOString(),
  }

  await db.prepare(
    `INSERT INTO feedback_entries (id, role, name, subtitle, content, avatar_url, image_url, contact, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET
       role = excluded.role,
       name = excluded.name,
       subtitle = excluded.subtitle,
       content = excluded.content,
       avatar_url = excluded.avatar_url,
       image_url = excluded.image_url,
       contact = excluded.contact,
       created_at = excluded.created_at`,
  ).bind(
    entry.id,
    entry.role,
    entry.name,
    entry.subtitle,
    entry.content,
    entry.avatarUrl,
    entry.imageUrl,
    entry.contact,
    entry.createdAt,
  ).run()

  return json({ entry: {
    id: entry.id,
    role: entry.role,
    name: entry.name,
    subtitle: entry.subtitle,
    content: entry.content,
    avatarUrl: entry.avatarUrl,
    imageUrl: entry.imageUrl ?? undefined,
    contact: entry.contact ?? undefined,
    createdAt: entry.createdAt,
  }})
}
