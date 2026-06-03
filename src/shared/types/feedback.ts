export type FeedbackRole = '家长' | '学生'

export interface FeedbackEntry {
  id: string
  role: FeedbackRole
  name: string
  subtitle: string
  content: string
  avatarUrl: string
  imageUrl?: string
  contact?: string
  createdAt: string
}

export interface FeedbackLibrary {
  entries: FeedbackEntry[]
}
