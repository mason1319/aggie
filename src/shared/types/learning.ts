export type PracticeMode = 'image' | 'listen' | 'spell'

export interface LearningItem {
  id: string
  word: string
  phonetic: string
  meaning: string
  sentence: string
  sentenceMeaning: string
  illustration: string
  color: string
  audioAssetId?: string
  sentenceAudioAssetId?: string
}

export interface Unit {
  id: string
  title: string
  subtitle: string
  items: LearningItem[]
}

export interface Course {
  id: string
  title: string
  subtitle: string
  description: string
  icon: string
  tone: string
  units: Unit[]
}

export interface ProgressState {
  learnedItemIds: string[]
  wrongItemIds: string[]
  courseId: string
  unitId: string
  currentItemIndex: number
  practiceCount: number
  correctCount: number
}

export interface PracticeResult {
  itemId: string
  mode: PracticeMode
  correct: boolean
  answer: string
  createdAt: string
}
