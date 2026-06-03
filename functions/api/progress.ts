interface Env {
  AGGIE_CONTENT_KV?: KVNamespace
}

interface ProgressPayload {
  learnedItemIds: string[]
  wrongItemIds: string[]
  courseId: string
  unitId: string
  currentItemIndex: number
  practiceCount: number
  correctCount: number
}

interface ProgressRequestBody {
  progress?: unknown
}

type PracticeResultEntry = {
  itemId: string
  mode: 'image' | 'listen' | 'spell'
  correct: boolean
  answer: string
  createdAt: string
}

const PROGRESS_KEY = 'aggie_learning_progress_v1'

const DEFAULT_PROGRESS: ProgressPayload = {
  learnedItemIds: [],
  wrongItemIds: [],
  courseId: 'phonics',
  unitId: 'phonics-cvc',
  currentItemIndex: 0,
  practiceCount: 0,
  correctCount: 0,
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

function normalizePracticeResult(value: unknown): PracticeResultEntry[] {
  if (!Array.isArray(value)) {
    return []
  }
  return value
    .filter((entry) => entry && typeof entry === 'object')
    .map((entry) => {
      const item = entry as Record<string, unknown>
      return {
        itemId: typeof item.itemId === 'string' ? item.itemId : '',
        mode: item.mode === 'image' || item.mode === 'listen' || item.mode === 'spell' ? item.mode : 'spell',
        correct: item.correct === true,
        answer: typeof item.answer === 'string' ? item.answer : '',
        createdAt: typeof item.createdAt === 'string' ? item.createdAt : new Date().toISOString(),
      }
    })
    .filter((item) => item.itemId)
}

function normalizeProgress(value: unknown): ProgressPayload {
  if (!value || typeof value !== 'object') {
    return { ...DEFAULT_PROGRESS }
  }
  const raw = value as Record<string, unknown>
  return {
    learnedItemIds: Array.isArray(raw.learnedItemIds) ? raw.learnedItemIds.filter((item) => typeof item === 'string') as string[] : [],
    wrongItemIds: Array.isArray(raw.wrongItemIds) ? raw.wrongItemIds.filter((item) => typeof item === 'string') as string[] : [],
    courseId: typeof raw.courseId === 'string' ? raw.courseId : DEFAULT_PROGRESS.courseId,
    unitId: typeof raw.unitId === 'string' ? raw.unitId : DEFAULT_PROGRESS.unitId,
    currentItemIndex: Number.isFinite(typeof raw.currentItemIndex === 'number' ? raw.currentItemIndex : NaN) ? (raw.currentItemIndex as number) : 0,
    practiceCount: Number.isFinite(typeof raw.practiceCount === 'number' ? raw.practiceCount : NaN) ? (raw.practiceCount as number) : 0,
    correctCount: Number.isFinite(typeof raw.correctCount === 'number' ? raw.correctCount : NaN) ? (raw.correctCount as number) : 0,
  }
}

async function readStore(kv: KVNamespace) {
  const stored = await kv.get(PROGRESS_KEY, { type: 'json' })
  if (!stored || typeof stored !== 'object') {
    return {
      progress: DEFAULT_PROGRESS,
      practiceResults: [] as PracticeResultEntry[],
    }
  }

  const raw = stored as Record<string, unknown>
  return {
    progress: normalizeProgress(raw.progress),
    practiceResults: normalizePracticeResult(raw.practiceResults),
  }
}

async function writeStore(kv: KVNamespace, progress: ProgressPayload, practiceResults: PracticeResultEntry[]) {
  await kv.put(
    PROGRESS_KEY,
    JSON.stringify({
      progress,
      practiceResults,
    }),
  )
}

export const onRequestGet: PagesFunction<Env> = async (context) => {
  const kv = context.env.AGGIE_CONTENT_KV
  if (!kv) {
    return json({ error: 'AGGIE_CONTENT_KV binding not configured' }, { status: 500 })
  }

  const data = await readStore(kv)
  return json(data)
}

export const onRequestPut: PagesFunction<Env> = async (context) => {
  const kv = context.env.AGGIE_CONTENT_KV
  if (!kv) {
    return json({ error: 'AGGIE_CONTENT_KV binding not configured' }, { status: 500 })
  }

  const body = await context.request.json().catch(() => null)
  const requestBody = body && typeof body === 'object' ? body as ProgressRequestBody : null
  const progress = normalizeProgress(requestBody?.progress)
  const snapshot = await readStore(kv)
  await writeStore(
    kv,
    progress,
    snapshot.practiceResults,
  )
  return json({ ok: true, progress })
}

export const onRequestPost: PagesFunction<Env> = async (context) => {
  const kv = context.env.AGGIE_CONTENT_KV
  if (!kv) {
    return json({ error: 'AGGIE_CONTENT_KV binding not configured' }, { status: 500 })
  }

  const body = await context.request.json().catch(() => null)
  const requestBody = body && typeof body === 'object' ? body as ProgressRequestBody : null
  const nextEntry = normalizePracticeResult([requestBody?.practiceResult])[0]
  const snapshot = await readStore(kv)
  const nextResults = [nextEntry, ...snapshot.practiceResults]
    .filter((item) => item.itemId)
    .slice(0, 200)

  await writeStore(kv, snapshot.progress, nextResults)
  return json({ ok: true, practiceResult: nextEntry })
}
