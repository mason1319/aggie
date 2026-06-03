import { defaultAdmissionSettings } from '../data/admissions'
import { defaultFeedbackEntries } from '../data/feedback'
import { defaultInstitutionProfile } from '../data/institution'
import type { AdmissionSettings } from '../types/admission'
import type { FeedbackEntry, FeedbackLibrary } from '../types/feedback'
import type { InstitutionProfile } from '../types/institution'
import type { MediaAsset, MediaBinding, MediaLibrary } from '../types/media'
import type { PracticeResult, ProgressState } from '../types/learning'

export const STORAGE_KEYS = {
  progress: 'aggie_english_progress_v1',
  practiceResults: 'aggie_english_practice_results_v1',
  admissions: 'aggie_english_admissions_v1',
  institution: 'aggie_english_institution_v1',
  media: 'aggie_english_media_v1',
  feedback: 'aggie_english_feedback_v1',
}

const defaultProgress: ProgressState = {
  learnedItemIds: [],
  wrongItemIds: [],
  courseId: 'phonics',
  unitId: 'phonics-cvc',
  currentItemIndex: 0,
  practiceCount: 0,
  correctCount: 0,
}

function readJson<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key)
    return raw ? (JSON.parse(raw) as T) : fallback
  } catch {
    return fallback
  }
}

function writeJson<T>(key: string, value: T) {
  localStorage.setItem(key, JSON.stringify(value))
  window.dispatchEvent(new CustomEvent('aggie-storage-change', { detail: { key } }))
}

const defaultMediaLibrary: MediaLibrary = {
  assets: [],
  itemBindings: {},
}

const defaultFeedbackLibrary: FeedbackLibrary = {
  entries: defaultFeedbackEntries,
}

export function getProgress() {
  return readJson<ProgressState>(STORAGE_KEYS.progress, defaultProgress)
}

export function saveProgress(progress: ProgressState) {
  writeJson(STORAGE_KEYS.progress, progress)
}

export function getPracticeResults() {
  return readJson<PracticeResult[]>(STORAGE_KEYS.practiceResults, [])
}

export function savePracticeResult(result: PracticeResult) {
  writeJson(STORAGE_KEYS.practiceResults, [...getPracticeResults(), result].slice(-100))
}

export function getAdmissionSettings() {
  return readJson<AdmissionSettings>(STORAGE_KEYS.admissions, defaultAdmissionSettings)
}

export function saveAdmissionSettings(settings: AdmissionSettings) {
  writeJson(STORAGE_KEYS.admissions, settings)
}

export function resetAdmissionSettings() {
  saveAdmissionSettings(defaultAdmissionSettings)
}

export function getInstitutionProfile() {
  return { ...defaultInstitutionProfile, ...readJson<InstitutionProfile>(STORAGE_KEYS.institution, defaultInstitutionProfile) }
}

export function saveInstitutionProfile(profile: InstitutionProfile) {
  writeJson(STORAGE_KEYS.institution, profile)
}

export function resetInstitutionProfile() {
  saveInstitutionProfile(defaultInstitutionProfile)
}

export function getMediaLibrary() {
  return readJson<MediaLibrary>(STORAGE_KEYS.media, defaultMediaLibrary)
}

export function saveMediaLibrary(library: MediaLibrary) {
  writeJson(STORAGE_KEYS.media, library)
}

export function resetMediaLibrary() {
  saveMediaLibrary(defaultMediaLibrary)
}

export function getMediaAsset(assetId?: string) {
  if (!assetId) return undefined
  return getMediaLibrary().assets.find((asset) => asset.id === assetId)
}

export function getMediaBinding(itemId: string): MediaBinding {
  return getMediaLibrary().itemBindings[itemId] ?? {}
}

export function upsertMediaAsset(asset: MediaAsset) {
  const library = getMediaLibrary()
  const existingIndex = library.assets.findIndex((item) => item.id === asset.id)
  const assets = existingIndex >= 0
    ? library.assets.map((item) => (item.id === asset.id ? asset : item))
    : [...library.assets, asset]
  saveMediaLibrary({ ...library, assets })
}

export function updateMediaBinding(itemId: string, binding: MediaBinding) {
  const library = getMediaLibrary()
  saveMediaLibrary({
    ...library,
    itemBindings: {
      ...library.itemBindings,
      [itemId]: binding,
    },
  })
}

export function clearMediaBinding(itemId: string) {
  const library = getMediaLibrary()
  const nextBindings = { ...library.itemBindings }
  delete nextBindings[itemId]
  saveMediaLibrary({ ...library, itemBindings: nextBindings })
}

export function removeMediaAsset(assetId: string) {
  const library = getMediaLibrary()
  const assets = library.assets.filter((asset) => asset.id !== assetId)
  const itemBindings: Record<string, MediaBinding> = {}
  for (const [itemId, binding] of Object.entries(library.itemBindings)) {
    const nextBinding: MediaBinding = {
      wordAudioAssetId: binding.wordAudioAssetId === assetId ? undefined : binding.wordAudioAssetId,
      sentenceAudioAssetId: binding.sentenceAudioAssetId === assetId ? undefined : binding.sentenceAudioAssetId,
    }
    if (nextBinding.wordAudioAssetId || nextBinding.sentenceAudioAssetId) {
      itemBindings[itemId] = nextBinding
    }
  }
  saveMediaLibrary({ assets, itemBindings })
}

export function resetMediaState() {
  resetMediaLibrary()
}

export function getFeedbackLibrary() {
  return readJson<FeedbackLibrary>(STORAGE_KEYS.feedback, defaultFeedbackLibrary)
}

export function saveFeedbackLibrary(library: FeedbackLibrary) {
  writeJson(STORAGE_KEYS.feedback, library)
}

export function resetFeedbackLibrary() {
  saveFeedbackLibrary(defaultFeedbackLibrary)
}

export function addFeedbackEntry(entry: FeedbackEntry) {
  const library = getFeedbackLibrary()
  saveFeedbackLibrary({ entries: [entry, ...library.entries] })
}

export function removeFeedbackEntry(entryId: string) {
  const library = getFeedbackLibrary()
  saveFeedbackLibrary({ entries: library.entries.filter((entry) => entry.id !== entryId) })
}
