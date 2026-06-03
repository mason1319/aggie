export type AdmissionStatus = '即将开始' | '报名中' | '已满'
export type CampaignKind = 'trial' | 'spring' | 'autumn'
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

export interface AdmissionCampaign {
  id: CampaignKind
  title: string
  eyebrow: string
  description: string
  grades: string
  lessons: string
  feature: string
  quota: string
  status: AdmissionStatus
  accent: string
  icon: string
}

export interface AdmissionSettings {
  activeSeason: 'spring' | 'autumn'
  campaigns: AdmissionCampaign[]
}

export interface TeacherProfile {
  id: string
  name: string
  title: string
  intro: string
  teachingStyle: string
  avatarUrl: string
  accent: string
}

export interface EnvironmentPoint {
  id: string
  title: string
  description: string
  icon: string
}

export interface QualityHighlight {
  id: string
  title: string
  description: string
  quote: string
  accent: string
}

export interface TimetableEntry {
  id: string
  day: string
  startTime: string
  endTime: string
  className: string
  course: string
  teacher: string
  room: string
}

export interface InstitutionProfile {
  name: string
  address: string
  mapLatitude: string
  mapLongitude: string
  mapEmbedUrl: string
  mapLink: string
  mapNote: string
  surroundingsSummary: string
  promoVideoAssetIds: string[]
  nearbyPoints: EnvironmentPoint[]
  teachers: TeacherProfile[]
  qualityHighlights: QualityHighlight[]
  timetable: TimetableEntry[]
}

export type MediaKind = 'audio' | 'video'

export interface MediaAsset {
  id: string
  kind: MediaKind
  name: string
  mimeType: string
  dataUrl: string
  createdAt: string
}

export interface MediaBinding {
  wordAudioAssetId?: string
  sentenceAudioAssetId?: string
}

export interface MediaLibrary {
  assets: MediaAsset[]
  itemBindings: Record<string, MediaBinding>
}

export type FeedbackRole = '家长' | '学生'

export interface FeedbackEntry {
  id: string
  role: FeedbackRole
  name: string
  subtitle: string
  content: string
  avatarUrl: string
  imageUrl?: string
  createdAt: string
}

export interface FeedbackLibrary {
  entries: FeedbackEntry[]
}
