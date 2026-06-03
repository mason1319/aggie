import type { AppContentBundle } from './types'
import { courses } from '../data/courses'
import { defaultAdmissionSettings } from '../data/admissions'
import { defaultFeedbackEntries } from '../data/feedback'
import { defaultInstitutionProfile } from '../data/institution'
import { APP_CONTENT_VERSION } from './types'
import type { FeedbackLibrary } from '../types/feedback'
import type { MediaLibrary } from '../types/media'

export const DEFAULT_MEDIA_LIBRARY: MediaLibrary = {
  assets: [],
  itemBindings: {},
}

export const DEFAULT_FEEDBACK_LIBRARY: FeedbackLibrary = {
  entries: defaultFeedbackEntries,
}

export const DEFAULT_APP_CONTENT: AppContentBundle = {
  meta: {
    schemaVersion: APP_CONTENT_VERSION,
    generatedBy: 'local-storage-default',
    updatedAt: new Date().toISOString(),
    syncSource: 'local',
  },
  platform: 'web',
  brand: {
    name: 'Aggie速记英语',
    tagline: '听得懂、读得准、记得牢',
    description: '面向小学阶段的英语学习体验与招生官网',
  },
  contact: {
    wechatQrImageUrl: '/wechat-qr-placeholder.svg',
    contactHint: '扫描二维码添加老师微信，备注“孩子年级 + 想了解课程”。',
  },
  courses,
  admission: defaultAdmissionSettings,
  institution: defaultInstitutionProfile,
  media: DEFAULT_MEDIA_LIBRARY,
  feedback: DEFAULT_FEEDBACK_LIBRARY,
}
