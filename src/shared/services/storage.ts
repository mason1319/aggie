import { DEFAULT_APP_CONTENT, DEFAULT_FEEDBACK_LIBRARY } from '../data-source/defaults'
import { defaultAdmissionSettings } from '../data/admissions'
import { defaultFeedbackEntries } from '../data/feedback'
import { defaultInstitutionProfile } from '../data/institution'
import type { AdmissionSettings } from '../types/admission'
import type { FeedbackEntry, FeedbackLibrary } from '../types/feedback'
import type { InstitutionProfile } from '../types/institution'
import type { MediaAsset, MediaBinding, MediaLibrary } from '../types/media'
import type { PracticeResult, ProgressState } from '../types/learning'
import { getProgressState, getPracticeResultsState, savePracticeResultState, saveProgressState } from './progressApi'
import { getContentSnapshot, saveContentBundle } from '../data-source/contentStore'

const defaultProgress: ProgressState = {
  learnedItemIds: [],
  wrongItemIds: [],
  courseId: 'phonics',
  unitId: 'phonics-cvc',
  currentItemIndex: 0,
  practiceCount: 0,
  correctCount: 0,
}

const defaultFeedbackLibrary: FeedbackLibrary = {
  entries: defaultFeedbackEntries,
}

function getBundleSnapshot() {
  return getContentSnapshot()
}

function getDefaultMediaLibrary(): MediaLibrary {
  return {
    ...DEFAULT_APP_CONTENT.media,
  }
}

function updateBundle(mutator: (current: {
  admission: AdmissionSettings
  institution: InstitutionProfile
  media: MediaLibrary
  feedback: FeedbackLibrary
}) => void) {
  const snapshot = getBundleSnapshot()
  const next = {
    ...snapshot,
    admission: { ...snapshot.admission },
    institution: { ...snapshot.institution },
    media: { ...snapshot.media, assets: [...snapshot.media.assets], itemBindings: { ...snapshot.media.itemBindings } },
    feedback: { ...snapshot.feedback, entries: [...snapshot.feedback.entries] },
  }
  updateBundleCore(next, mutator)
}

function updateBundleCore(
  base: ReturnType<typeof getBundleSnapshot>,
  mutator: (current: {
    admission: AdmissionSettings
    institution: InstitutionProfile
    media: MediaLibrary
    feedback: FeedbackLibrary
  }) => void,
) {
  const next = { ...base }
  mutator({
    admission: next.admission,
    institution: next.institution,
    media: next.media,
    feedback: next.feedback,
  })
  void saveContentBundle(next)
}

export async function getProgress(): Promise<ProgressState> {
  const result = await getProgressState()
  if (result) {
    return { ...defaultProgress, ...result }
  }
  return { ...defaultProgress }
}

export async function saveProgress(progress: ProgressState): Promise<void> {
  await saveProgressState(progress)
}

export async function getPracticeResults(): Promise<PracticeResult[]> {
  return getPracticeResultsState()
}

export async function savePracticeResult(result: PracticeResult): Promise<void> {
  await savePracticeResultState(result)
}

export function getAdmissionSettings() {
  return { ...defaultAdmissionSettings, ...getBundleSnapshot().admission }
}

export function saveAdmissionSettings(settings: AdmissionSettings) {
  updateBundle((draft) => {
    draft.admission = settings
  })
}

export function resetAdmissionSettings() {
  saveAdmissionSettings(defaultAdmissionSettings)
}

export function getInstitutionProfile() {
  return { ...defaultInstitutionProfile, ...getBundleSnapshot().institution }
}

export function saveInstitutionProfile(profile: InstitutionProfile) {
  updateBundle((draft) => {
    draft.institution = profile
  })
}

export function resetInstitutionProfile() {
  saveInstitutionProfile(defaultInstitutionProfile)
}

export function getMediaLibrary() {
  return {
    ...getDefaultMediaLibrary(),
    ...getBundleSnapshot().media,
    assets: [...getBundleSnapshot().media.assets],
    itemBindings: { ...getBundleSnapshot().media.itemBindings },
  }
}

export function saveMediaLibrary(library: MediaLibrary) {
  updateBundle((draft) => {
    draft.media = library
  })
}

export function resetMediaState() {
  saveMediaLibrary(getDefaultMediaLibrary())
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

export function getFeedbackLibrary() {
  const cached = getBundleSnapshot().feedback
  if (cached && Array.isArray(cached.entries)) {
    return { ...defaultFeedbackLibrary, ...cached, entries: cached.entries }
  }
  return {
    ...DEFAULT_FEEDBACK_LIBRARY,
    ...defaultFeedbackLibrary,
  }
}

export function saveFeedbackLibrary(library: FeedbackLibrary) {
  updateBundle((draft) => {
    draft.feedback = { ...library, entries: [...library.entries] }
  })
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
