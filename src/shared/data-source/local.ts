import { defaultFeedbackEntries } from '../data/feedback'
import type { AppContentBundle, AppDataSource, DataPlatform } from './types'
import { DEFAULT_APP_CONTENT } from './defaults'
import {
  getAdmissionSettings,
  getFeedbackLibrary,
  getInstitutionProfile,
  getMediaLibrary,
  saveAdmissionSettings,
  saveFeedbackLibrary,
  saveInstitutionProfile,
  saveMediaLibrary,
} from '../services/storage'
import type { FeedbackLibrary } from '../types/feedback'

function buildFeedbackFallback(feedbackLibrary: FeedbackLibrary) {
  if (feedbackLibrary.entries.length > 0) {
    return feedbackLibrary
  }
  return { ...DEFAULT_APP_CONTENT.feedback, ...feedbackLibrary }
}

function getPlatformFromEnv(): DataPlatform {
  const raw = (import.meta.env.VITE_AGGIE_PLATFORM ?? 'web').toLowerCase().trim()
  if (raw === 'h5' || raw === 'web' || raw === 'wechat-mini' || raw === 'app') {
    return raw
  }
  return 'web'
}

export const localContentSource: AppDataSource = {
  async getContentBundle(): Promise<AppContentBundle> {
    return {
      ...DEFAULT_APP_CONTENT,
      meta: {
        ...DEFAULT_APP_CONTENT.meta,
        updatedAt: new Date().toISOString(),
        syncSource: 'local',
      },
      platform: getPlatformFromEnv(),
      admission: getAdmissionSettings(),
      institution: getInstitutionProfile(),
      media: getMediaLibrary(),
      feedback: buildFeedbackFallback(getFeedbackLibrary()),
      courses: DEFAULT_APP_CONTENT.courses,
    }
  },
  async saveContentBundle(bundle: AppContentBundle): Promise<void> {
    saveAdmissionSettings(bundle.admission)
    saveInstitutionProfile(bundle.institution)
    saveMediaLibrary(bundle.media)
    saveFeedbackLibrary(bundle.feedback.entries.length > 0 ? bundle.feedback : DEFAULT_APP_CONTENT.feedback)
    if (bundle.feedback.entries.length === 0 && defaultFeedbackEntries.length > 0) {
      saveFeedbackLibrary({ entries: [...defaultFeedbackEntries] })
    }
  },
}
