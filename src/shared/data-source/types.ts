import type { AdmissionSettings } from '../types/admission'
import type { Course } from '../types/learning'
import type { FeedbackLibrary } from '../types/feedback'
import type { InstitutionProfile } from '../types/institution'
import type { MediaLibrary } from '../types/media'

export type DataPlatform = 'web' | 'h5' | 'wechat-mini' | 'app'
export type ContentSyncSource = 'local' | 'remote'
export type DataSourceMode = 'local' | 'remote' | 'hybrid'

export interface BrandProfile {
  name: string
  tagline: string
  description: string
}

export interface ContactConfig {
  wechatQrImageUrl: string
  contactHint: string
}

export interface AppMeta {
  schemaVersion: number
  generatedBy: string
  updatedAt: string
  syncSource: ContentSyncSource
}

export interface AppContentBundle {
  meta: AppMeta
  platform: DataPlatform
  brand: BrandProfile
  contact: ContactConfig
  courses: Course[]
  admission: AdmissionSettings
  institution: InstitutionProfile
  media: MediaLibrary
  feedback: FeedbackLibrary
}

export interface AppDataSource {
  getContentBundle(): Promise<AppContentBundle>
  saveContentBundle(bundle: AppContentBundle): Promise<void>
}

export const APP_CONTENT_VERSION = 2
