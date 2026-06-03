import type { PracticeResult, ProgressState } from '../types/learning'

const PROGRESS_API_PATH = '/api/progress'

const DEFAULT_PROGRESS: ProgressState = {
  learnedItemIds: [],
  wrongItemIds: [],
  courseId: 'phonics',
  unitId: 'phonics-cvc',
  currentItemIndex: 0,
  practiceCount: 0,
  correctCount: 0,
}

function normalizePracticeResult(value: unknown): PracticeResult[] {
  if (!Array.isArray(value)) {
    return []
  }
  return value
    .filter((entry) => entry && typeof entry === 'object')
    .map((entry) => {
      const item = entry as Record<string, unknown>
      return {
        itemId: typeof item.itemId === 'string' ? item.itemId : '',
        mode: (item.mode === 'image' || item.mode === 'listen' || item.mode === 'spell' ? item.mode : 'spell') as PracticeResult['mode'],
        correct: item.correct === true,
        answer: typeof item.answer === 'string' ? item.answer : '',
        createdAt: typeof item.createdAt === 'string' ? item.createdAt : new Date().toISOString(),
      }
    })
    .filter((item) => item.itemId)
}

function normalizeProgress(value: unknown): ProgressState {
  const raw = value && typeof value === 'object' ? value as Record<string, unknown> : {}
  const normalized: ProgressState = {
    learnedItemIds: Array.isArray(raw.learnedItemIds) ? raw.learnedItemIds.filter((id) => typeof id === 'string') as string[] : [],
    wrongItemIds: Array.isArray(raw.wrongItemIds) ? raw.wrongItemIds.filter((id) => typeof id === 'string') as string[] : [],
    courseId: typeof raw.courseId === 'string' ? raw.courseId : 'phonics',
    unitId: typeof raw.unitId === 'string' ? raw.unitId : 'phonics-cvc',
    currentItemIndex: Number.isFinite(typeof raw.currentItemIndex === 'number' ? raw.currentItemIndex : NaN) ? raw.currentItemIndex as number : 0,
    practiceCount: Number.isFinite(typeof raw.practiceCount === 'number' ? raw.practiceCount : NaN) ? raw.practiceCount as number : 0,
    correctCount: Number.isFinite(typeof raw.correctCount === 'number' ? raw.correctCount : NaN) ? raw.correctCount as number : 0,
  }

  return {
    learnedItemIds: normalized.learnedItemIds,
    wrongItemIds: normalized.wrongItemIds,
    courseId: normalized.courseId,
    unitId: normalized.unitId,
    currentItemIndex: normalized.currentItemIndex < 0 ? 0 : normalized.currentItemIndex,
    practiceCount: normalized.practiceCount < 0 ? 0 : normalized.practiceCount,
    correctCount: normalized.correctCount < 0 ? 0 : normalized.correctCount,
  }
}

const progressCache = {
  progress: { ...DEFAULT_PROGRESS },
  practiceResults: [] as PracticeResult[],
}

function isFetchError(error: unknown) {
  return error instanceof Error || error instanceof DOMException
}

async function requestProgress<T>(init?: RequestInit): Promise<T> {
  const response = await fetch(PROGRESS_API_PATH, init)
  if (!response.ok) {
    const message = await response.text()
    throw new Error(message || `请求进度接口失败 (${response.status})`)
  }
  return response.json() as Promise<T>
}

export async function getProgressState(): Promise<ProgressState> {
  try {
    const payload = await requestProgress<{ progress: unknown; practiceResults?: unknown }>({ method: 'GET' })
    const progress = normalizeProgress(payload.progress)
    const nextResults = Array.isArray(payload.practiceResults) ? normalizePracticeResult(payload.practiceResults) : []
    progressCache.progress = progress
    progressCache.practiceResults = nextResults
    return progress
  } catch (error) {
    if (isFetchError(error)) {
      return { ...progressCache.progress }
    }
    throw error
  }
}

export async function getPracticeResultsState(): Promise<PracticeResult[]> {
  try {
    const payload = await requestProgress<{ progress?: unknown; practiceResults?: unknown }>({ method: 'GET' })
    const practiceResults = normalizePracticeResult(payload.practiceResults)
    progressCache.practiceResults = practiceResults
    return [...practiceResults]
  } catch (error) {
    if (isFetchError(error)) {
      return [...progressCache.practiceResults]
    }
    throw error
  }
}

export async function saveProgressState(progress: ProgressState): Promise<void> {
  const payload = {
    progress: {
      ...progress,
      learnedItemIds: [...progress.learnedItemIds],
      wrongItemIds: [...progress.wrongItemIds],
    },
  }
  try {
    await requestProgress<void>({
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
    progressCache.progress = { ...progress, learnedItemIds: [...progress.learnedItemIds], wrongItemIds: [...progress.wrongItemIds] }
  } catch (error) {
    progressCache.progress = {
      ...progressCache.progress,
      ...progress,
      learnedItemIds: [...progress.learnedItemIds],
      wrongItemIds: [...progress.wrongItemIds],
    }
    if (isFetchError(error)) {
      return
    }
    throw error
  }
}

export async function savePracticeResultState(result: PracticeResult): Promise<void> {
  const next = {
    ...result,
  }
  try {
    await requestProgress<void>({
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ practiceResult: next }),
    })
  } finally {
    const nextResults = [next, ...progressCache.practiceResults].slice(0, 200)
    progressCache.practiceResults = nextResults
  }
}
