import type { FeedbackEntry } from '../types'

function avatarDataUrl(label: string, accent: string) {
  const svg = `
    <svg width="240" height="240" viewBox="0 0 240 240" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="g" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="${accent}" stop-opacity="0.95"/>
          <stop offset="100%" stop-color="#ffffff" stop-opacity="0.88"/>
        </linearGradient>
      </defs>
      <rect width="240" height="240" rx="32" fill="url(#g)"/>
      <circle cx="120" cy="96" r="44" fill="#fff" fill-opacity="0.72"/>
      <path d="M72 196c10-30 86-30 96 0" fill="#fff" fill-opacity="0.74"/>
      <text x="120" y="210" font-family="Arial, sans-serif" font-size="28" font-weight="700" text-anchor="middle" fill="#173f35">${label}</text>
    </svg>
  `
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`
}

export const defaultFeedbackEntries: FeedbackEntry[] = [
  {
    id: 'feedback-parent-1',
    role: '家长',
    name: '李女士',
    subtitle: '三年级家长',
    content: '孩子以前背单词很抗拒，现在会主动跟着老师发音，还会自己做复习。',
    avatarUrl: avatarDataUrl('李', '#7bc8a4'),
    createdAt: '2026-06-01T08:00:00.000Z',
  },
  {
    id: 'feedback-student-1',
    role: '学生',
    name: '小宇',
    subtitle: '五年级学生',
    content: '我最喜欢听音选词和拼写练习，感觉像在做游戏。',
    avatarUrl: avatarDataUrl('宇', '#78b9eb'),
    createdAt: '2026-06-01T09:00:00.000Z',
  },
  {
    id: 'feedback-parent-2',
    role: '家长',
    name: '王先生',
    subtitle: '二年级家长',
    content: '课程安排清楚，老师会给孩子及时反馈，家长也更放心。',
    avatarUrl: avatarDataUrl('王', '#f6c95b'),
    createdAt: '2026-06-01T10:00:00.000Z',
  },
  {
    id: 'feedback-student-2',
    role: '学生',
    name: '小雨',
    subtitle: '四年级学生',
    content: '我现在敢开口读句子了，发音比以前更准。',
    avatarUrl: avatarDataUrl('雨', '#f5a671'),
    createdAt: '2026-06-01T11:00:00.000Z',
  },
]
