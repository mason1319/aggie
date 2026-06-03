import { getFeedbackLibrary, saveFeedbackLibrary } from './storage'
import type { FeedbackEntry, FeedbackRole } from '../types'

const FEEDBACK_API_PATH = '/api/feedback'
const FEEDBACK_SYNC_INTERVAL_MS = 60_000

export type FeedbackSource = 'cloud' | 'cache' | 'offline'

export interface FeedbackSubmissionInput {
  role: FeedbackRole
  name: string
  subtitle: string
  content: string
  avatarUrl: string
  imageUrl?: string
  contact?: string
}

export interface FeedbackSyncResult {
  entries: FeedbackEntry[]
  source: FeedbackSource
}

function normalizeEntry(entry: FeedbackEntry): FeedbackEntry {
  return {
    ...entry,
    contact: entry.contact?.trim() || undefined,
    imageUrl: entry.imageUrl?.trim() || undefined,
  }
}

function normalizeEntries(entries: FeedbackEntry[]) {
  return entries.map(normalizeEntry)
}

function mergeEntries(entries: FeedbackEntry[], incoming: FeedbackEntry) {
  return [incoming, ...entries.filter((entry) => entry.id !== incoming.id)]
}

async function requestFeedbackApi<T>(init?: RequestInit): Promise<T> {
  const response = await fetch(FEEDBACK_API_PATH, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(init?.headers ?? {}),
    },
  })

  if (!response.ok) {
    const message = await response.text()
    throw new Error(message || `请求反馈接口失败 (${response.status})`)
  }

  return response.json() as Promise<T>
}

export async function loadFeedbackEntries(): Promise<FeedbackSyncResult> {
  try {
    const payload = await requestFeedbackApi<{ entries: FeedbackEntry[] }>()
    const entries = normalizeEntries(payload.entries ?? [])
    saveFeedbackLibrary({ entries })
    return { entries, source: 'cloud' }
  } catch {
    const cachedEntries = normalizeEntries(getFeedbackLibrary().entries)
    if (cachedEntries.length > 0) {
      return { entries: cachedEntries, source: 'cache' }
    }
    return { entries: [], source: 'offline' }
  }
}

export async function submitFeedbackEntry(input: FeedbackSubmissionInput): Promise<FeedbackSyncResult> {
  const draft: FeedbackEntry = normalizeEntry({
    id: `feedback-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    role: input.role,
    name: input.name.trim(),
    subtitle: input.subtitle.trim(),
    content: input.content.trim(),
    avatarUrl: input.avatarUrl,
    imageUrl: input.imageUrl?.trim() || undefined,
    contact: input.contact?.trim() || undefined,
    createdAt: new Date().toISOString(),
  })

  try {
    const payload = await requestFeedbackApi<{ entry: FeedbackEntry }>({
      method: 'POST',
      body: JSON.stringify(draft),
    })
    const entry = normalizeEntry(payload.entry)
    const cached = mergeEntries(normalizeEntries(getFeedbackLibrary().entries), entry)
    saveFeedbackLibrary({ entries: cached })
    return { entries: cached, source: 'cloud' }
  } catch {
    const cached = mergeEntries(normalizeEntries(getFeedbackLibrary().entries), draft)
    saveFeedbackLibrary({ entries: cached })
    return { entries: cached, source: 'offline' }
  }
}

export { FEEDBACK_SYNC_INTERVAL_MS }
