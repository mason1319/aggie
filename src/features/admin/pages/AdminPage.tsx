import {
  ArrowLeft, CalendarDays, Check, Eye, EyeOff, LockKeyhole, MapPinned, Plus, RotateCcw, Save,
  ShieldAlert, Trash2, Upload,
} from 'lucide-react'
import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { courses } from '../../../shared/data/courses'
import { getContentSnapshot, saveContentBundle, useContentBundle } from '../../../shared/data-source'
import {
  getAdmissionSettings,
  getInstitutionProfile,
  getMediaAsset,
  getMediaBinding,
  resetFeedbackLibrary,
  resetAdmissionSettings,
  resetMediaState,
  resetInstitutionProfile,
  saveAdmissionSettings,
  saveInstitutionProfile,
  removeMediaAsset,
  updateMediaBinding,
  upsertMediaAsset,
} from '../../../shared/services/storage'
import type {
  AdmissionCampaign,
  AdmissionSettings,
  AdmissionStatus,
  CampaignKind,
} from '../../../shared/types/admission'
import type {
  InstitutionProfile,
  QualityHighlight,
  TeacherProfile,
  TimetableEntry,
} from '../../../shared/types/institution'
import type { MediaAsset } from '../../../shared/types/media'
import { ROUTES } from '../../../shared/constants/routes'

const adminPassword = import.meta.env.VITE_ADMIN_PASSWORD || 'aggie2026'

const AVATAR_MAX_SIZE_BYTES = 2 * 1024 * 1024
const AVATAR_ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp']
const VIDEO_ALLOWED_TYPES = ['video/mp4']
const VIDEO_UPLOAD_CHUNK_SIZE = 5 * 1024 * 1024
const MEDIA_UPLOAD_LOCAL_BASE = '/api'
const MEDIA_UPLOAD_PATH = {
  init: '/media-upload-init',
  chunk: '/media-upload-chunk',
  complete: '/media-upload-complete',
}
const MEDIA_UPLOAD_REMOTE_BASE = (import.meta.env.VITE_AGGIE_MEDIA_UPLOAD_BASE || '').trim().replace(/\/+$/, '')
const MEDIA_UPLOAD_REMOTE_TOKEN = (import.meta.env.VITE_AGGIE_MEDIA_UPLOAD_TOKEN || '').trim()
const VIDEO_CATALOG_DEFAULT_DESC = '机构宣传素材（待补充）'
const VIDEO_TITLE_FALLBACK = '机构视频'

function isLikelyHashedVideoName(value: string) {
  const normalized = value.replace(/\.[^/.]+$/, '').trim()
  if (!normalized) {
    return false
  }
  return /^[0-9a-f]{16,}$/i.test(normalized) || /^[0-9a-f]{8,}-[0-9a-f]{8,}$/i.test(normalized)
}

function getPromoVideoDisplayTitle(video: MediaAsset) {
  const raw = (video.title || video.name || '').trim()
  if (!raw || isLikelyHashedVideoName(raw)) {
    return VIDEO_TITLE_FALLBACK
  }
  return raw
}

interface MediaUploadTarget {
  key: 'local' | 'cf'
  base: string
  token?: string
}

interface VideoUploadInitResponse {
  uploadId: string
  chunkSize?: number
  totalChunks?: number
}

function avatarDataUrl(label: string, accent: string) {
  const svg = `
    <svg width="240" height="240" viewBox="0 0 240 240" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="g" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="${accent}" stop-opacity="0.92"/>
          <stop offset="100%" stop-color="#ffffff" stop-opacity="0.85"/>
        </linearGradient>
      </defs>
      <rect width="240" height="240" rx="32" fill="url(#g)"/>
      <circle cx="120" cy="92" r="38" fill="#fff" fill-opacity="0.7"/>
      <path d="M76 198c10-28 78-28 88 0" fill="#fff" fill-opacity="0.72"/>
      <text x="120" y="206" font-family="Arial, sans-serif" font-size="34" font-weight="700" text-anchor="middle" fill="#173f35">${label}</text>
    </svg>
  `
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`
}

function emptyTeacher(index: number): TeacherProfile {
  const accentMap = ['#7bc8a4', '#f6c95b', '#78b9eb', '#f5a671']
  const accent = accentMap[index % accentMap.length]
  return {
    id: `teacher-${Date.now()}-${index}`,
    name: `新老师${index + 1}`,
    title: '课程老师',
    intro: '请填写老师简介。',
    teachingStyle: '请填写教学特点。',
    avatarUrl: avatarDataUrl('T', accent),
    accent,
  }
}

function emptyQuality(index: number): QualityHighlight {
  const accentMap = ['#7bc8a4', '#f6c95b', '#78b9eb', '#f5a671']
  const accent = accentMap[index % accentMap.length]
  return {
    id: `quality-${Date.now()}-${index}`,
    title: `质量亮点 ${index + 1}`,
    description: '请填写教学质量说明。',
    quote: '请填写家长反馈或进步案例。',
    accent,
  }
}

function emptyTimetable(index: number): TimetableEntry {
  return {
    id: `timetable-${Date.now()}-${index}`,
    day: '周一',
    startTime: '18:30',
    endTime: '19:30',
    className: '新班型',
    course: '课程内容',
    teacher: '老师姓名',
    room: '教室',
  }
}

function updateArrayItem<T extends { id: string }>(
  items: T[],
  id: string,
  updater: (item: T) => T,
) {
  return items.map((item) => (item.id === id ? updater(item) : item))
}

function readFileAsDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result))
    reader.onerror = () => reject(new Error('文件读取失败'))
    reader.readAsDataURL(file)
  })
}

interface VideoInitPayload {
  fileName: string
  mimeType: string
  fileSize: number
  totalChunks: number
  title: string
  desc: string
}

interface VideoUploadChunkResponse {
  uploadId: string
  chunkIndex: number
}

interface VideoUploadResult {
  videoSrc: string
}

function buildMediaUploadEndpoint(base: string, path: keyof typeof MEDIA_UPLOAD_PATH) {
  const normalizedBase = base.replace(/\/+$/, '')
  const normalizedPath = MEDIA_UPLOAD_PATH[path]
  return `${normalizedBase}${normalizedPath}`
}

function getMediaUploadTargets(): MediaUploadTarget[] {
  const targets: MediaUploadTarget[] = []
  const remoteBase = MEDIA_UPLOAD_REMOTE_BASE
  if (import.meta.env.DEV) {
    targets.push({
      key: 'local',
      base: MEDIA_UPLOAD_LOCAL_BASE,
    })
  }
  if (remoteBase) {
    targets.push({
      key: 'cf',
      base: remoteBase,
      token: MEDIA_UPLOAD_REMOTE_TOKEN || undefined,
    })
  } else if (import.meta.env.DEV) {
    targets.push({ key: 'local', base: MEDIA_UPLOAD_LOCAL_BASE })
  }
  return targets
}

class MediaUploadError extends Error {
  canFallback = false

  constructor(message: string, canFallback = false) {
    super(message)
    this.canFallback = canFallback
    this.name = 'MediaUploadError'
  }
}

function mediaUploadHeaders(target: MediaUploadTarget): Record<string, string> {
  return target.key === 'cf' && target.token ? { Authorization: `Bearer ${target.token}` } : {}
}

async function requestMediaUpload<T>(
  target: MediaUploadTarget,
  path: keyof typeof MEDIA_UPLOAD_PATH,
  init: RequestInit,
): Promise<T> {
  const endpoint = buildMediaUploadEndpoint(target.base, path)
  try {
    const requestHeaders = new Headers(init.headers ?? {})
    const authHeaders = mediaUploadHeaders(target)
    for (const key of Object.keys(authHeaders)) {
      requestHeaders.set(key, authHeaders[key])
    }
  const response = await fetch(endpoint, {
      ...init,
      headers: requestHeaders,
    })
    const payload = await response.json().catch(() => null)
    if (!response.ok) {
      const detail = payload && typeof payload === 'object' && 'error' in payload && typeof payload.error === 'string'
        ? payload.error
        : `请求失败 (${response.status})`
      if (target.key === 'cf' && (response.status === 404 || response.status === 405)) {
        throw new MediaUploadError(`云端上传接口暂不可用（${response.status}），将自动尝试本地通道。`, true)
      }
      if (target.key === 'local' && response.status === 404) {
        throw new MediaUploadError(detail, true)
      }
      throw new Error(detail)
    }
    if (!payload || typeof payload !== 'object') {
      throw new Error('服务端返回异常')
    }
    return payload as T
  } catch (error) {
    if (error instanceof MediaUploadError) {
      throw error
    }
    if (error instanceof TypeError) {
      if (target.key === 'local') {
        throw new MediaUploadError('本地服务未启用上传接口，请确认使用 npm run dev 启动本机服务，或改用外链上传。', true)
      }
      if (target.key === 'cf') {
        throw new MediaUploadError('云端上传接口暂不可达，已尝试切换上传通道。', true)
      }
    }
    throw error
  }
}

async function uploadVideoByTarget(
  target: MediaUploadTarget,
  file: File,
  title: string,
  desc: string,
): Promise<VideoUploadResult> {
  const totalChunks = Math.max(1, Math.ceil(file.size / VIDEO_UPLOAD_CHUNK_SIZE))
  const initPayload: VideoInitPayload = {
    fileName: file.name,
    mimeType: file.type || 'video/mp4',
    fileSize: file.size,
    totalChunks,
    title,
    desc,
  }
  const initResult = await requestMediaUpload<VideoUploadInitResponse>(target, 'init', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json;charset=utf-8' },
    body: JSON.stringify(initPayload),
  })

  if (typeof initResult.uploadId !== 'string' || !initResult.uploadId) {
    throw new Error('上传服务未返回有效的分片任务ID')
  }
  const uploadId: string = initResult.uploadId

  for (let chunkIndex = 0; chunkIndex < totalChunks; chunkIndex += 1) {
    const start = chunkIndex * VIDEO_UPLOAD_CHUNK_SIZE
    const end = Math.min(start + VIDEO_UPLOAD_CHUNK_SIZE, file.size)
    const chunk = file.slice(start, end)
    const formData = new FormData()
    formData.append('uploadId', uploadId)
    formData.append('chunkIndex', String(chunkIndex))
    formData.append('file', chunk, `chunk-${chunkIndex}`)

    const chunkPayload = await requestMediaUpload<VideoUploadChunkResponse>(target, 'chunk', {
      method: 'POST',
      body: formData,
    })
    if (typeof chunkPayload.uploadId !== 'string') {
      throw new Error('上传服务返回分片状态异常')
    }
  }

  const completePayload = await requestMediaUpload<VideoUploadResult>(target, 'complete', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json;charset=utf-8' },
    body: JSON.stringify({ uploadId, title, desc }),
  })

  if (typeof completePayload.videoSrc !== 'string' || !completePayload.videoSrc) {
    throw new Error('服务端返回视频地址异常')
  }

  return completePayload
}

function buildVideoMetaTitle(fileName: string, userTitle: string, fallbackIndex: number) {
  const trimTitle = userTitle.trim()
  const baseTitle = trimTitle || fileName.replace(/\.[^/.]+$/, '').trim() || '机构视频'
  if (fallbackIndex <= 1) {
    return baseTitle
  }
  return `${baseTitle} ${fallbackIndex}`
}

function normalizeErrorMessage(error: unknown) {
  if (error instanceof DOMException && error.name === 'QuotaExceededError') {
    return '服务器存储受限，建议先删除旧文件并压缩后重试。'
  }
  if (error instanceof Error) {
    return error.message
  }
  return '上传失败，请稍后重试。'
}

async function uploadVideoToLocalServer(
  file: File,
  title: string,
  desc: string,
): Promise<VideoUploadResult> {
  const targets = getMediaUploadTargets()
  let lastLocalError = ''
  let lastRemoteError = ''
  for (const target of targets) {
    try {
      return await uploadVideoByTarget(target, file, title, desc)
    } catch (error) {
      if (error instanceof MediaUploadError && error.canFallback) {
        if (target.key === 'local') {
        lastLocalError = error.message
        continue
        }
        if (target.key === 'cf') {
          lastRemoteError = error.message
          continue
        }
      }
      if (error instanceof Error) {
        if (target.key === 'cf') {
          lastRemoteError = error.message
        } else {
          throw error
        }
      } else if (target.key === 'local') {
        throw new Error('上传服务异常，请稍后重试。')
      }
    }
  }
  throw new Error(lastRemoteError || lastLocalError || '视频上传服务暂时不可用，请稍后重试。')
}

function readImageSize(file: File) {
  return new Promise<{ width: number; height: number }>((resolve, reject) => {
    const img = new Image()
    const url = URL.createObjectURL(file)
    img.onload = () => {
      const { width, height } = img
      URL.revokeObjectURL(url)
      resolve({ width, height })
    }
    img.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new Error('图片解析失败'))
    }
    img.src = url
  })
}

function isValidHttpUrl(value: string) {
  try {
    const parsed = new URL(value)
    return parsed.protocol === 'http:' || parsed.protocol === 'https:'
  } catch {
    return false
  }
}

function validateAvatarFile(file: File) {
  if (!AVATAR_ALLOWED_TYPES.includes(file.type)) {
    return '图片格式需为 JPG / PNG / WEBP。'
  }
  if (file.size > AVATAR_MAX_SIZE_BYTES) {
    return '图片大小不能超过2MB。'
  }
  return ''
}

function validateVideoFile(file: File) {
  const lowerType = file.type.toLowerCase()
  const extension = file.name.split('.').pop()?.toLowerCase() || ''
  if (!VIDEO_ALLOWED_TYPES.includes(lowerType) && extension !== 'mp4') {
    return '请上传 MP4 视频。'
  }
  return ''
}

function createMediaId(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

export function AdminPage() {
  const [authenticated, setAuthenticated] = useState(false)
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loginError, setLoginError] = useState('')
  const { bundle } = useContentBundle()
  const [settings, setSettings] = useState<AdmissionSettings>(() => bundle.admission)
  const [institution, setInstitution] = useState<InstitutionProfile>(() => bundle.institution)
  const [hydrated, setHydrated] = useState(false)
  const [selectedCourseId, setSelectedCourseId] = useState(courses[0].id)
  const [selectedUnitId, setSelectedUnitId] = useState(courses[0].units[0].id)
  const [selectedItemId, setSelectedItemId] = useState(courses[0].units[0].items[0].id)
  const [saved, setSaved] = useState(false)
  const [teacherAvatarErrors, setTeacherAvatarErrors] = useState<Record<string, string>>({})
  const [videoUploadErrors, setVideoUploadErrors] = useState<string[]>([])
  const [remoteVideoUrl, setRemoteVideoUrl] = useState('')
  const [remoteVideoTitle, setRemoteVideoTitle] = useState('')
  const [videoNameKeyword, setVideoNameKeyword] = useState('')
  const [removeOldCount, setRemoveOldCount] = useState('1')

  useEffect(() => {
    if (hydrated) return
    setSettings(bundle.admission)
    setInstitution(bundle.institution)
    setHydrated(true)
  }, [bundle, hydrated])

  const selectedCourse = useMemo(
    () => courses.find((course) => course.id === selectedCourseId) ?? courses[0],
    [selectedCourseId],
  )
  const selectedUnit = useMemo(
    () => selectedCourse.units.find((unit) => unit.id === selectedUnitId) ?? selectedCourse.units[0],
    [selectedCourse, selectedUnitId],
  )
  const selectedItem = useMemo(
    () => selectedUnit.items.find((item) => item.id === selectedItemId) ?? selectedUnit.items[0],
    [selectedItemId, selectedUnit],
  )
  const selectedBinding = getMediaBinding(selectedItem.id)
  const selectedWordAudio = getMediaAsset(selectedBinding.wordAudioAssetId)
  const selectedSentenceAudio = getMediaAsset(selectedBinding.sentenceAudioAssetId)
  const promoVideos = institution.promoVideoAssetIds
    .map((assetId) => getMediaAsset(assetId))
    .filter((asset): asset is MediaAsset => asset !== undefined && asset.kind === 'video')

  const removeAllPromoVideos = () => {
    if (!window.confirm('确认清空全部机构视频？此操作会删除当前配置中的机构视频记录。')) {
      return
    }
    const promoAssetIds = [...institution.promoVideoAssetIds]
    promoAssetIds.forEach((assetId) => {
      removeMediaAsset(assetId)
    })
    setInstitutionAndPersist((current) => ({
      ...current,
      promoVideoAssetIds: [],
    }))
    setVideoUploadErrors(['已清空全部机构视频。'])
  }

  const removePromoVideosByKeyword = (keyword: string) => {
    const targetKeyword = keyword.trim()
    if (!targetKeyword) return
    const targets = promoVideos
      .filter((video) => video.name.includes(targetKeyword))
      .map((video) => video.id)
    if (targets.length === 0) {
      setVideoUploadErrors([`未匹配到包含“${targetKeyword}”的机构视频。`])
      return
    }
    if (!window.confirm(`确认删除匹配“${targetKeyword}”的 ${targets.length} 个视频？`)) {
      return
    }
    targets.forEach((assetId) => {
      removeMediaAsset(assetId)
    })
    setInstitutionAndPersist((current) => ({
      ...current,
      promoVideoAssetIds: current.promoVideoAssetIds.filter((assetId) => !targets.includes(assetId)),
    }))
    setVideoUploadErrors([`已删除 ${targets.length} 个匹配“${targetKeyword}”的视频。`])
    setVideoNameKeyword('')
  }

  const removeOldestPromoVideos = (count: number) => {
    if (count <= 0) return
    const sorted = promoVideos
      .slice()
      .sort((a, b) => (a.createdAt > b.createdAt ? 1 : a.createdAt < b.createdAt ? -1 : 0))
    const targets = sorted.slice(0, count)
    if (targets.length === 0) {
      setVideoUploadErrors(['当前暂无机构视频可清理。'])
      return
    }
    const ids = targets.map((video) => video.id)
    if (!window.confirm(`确认删除按时间排序最早的 ${targets.length} 个视频？`)) {
      return
    }
    ids.forEach((assetId) => {
      removeMediaAsset(assetId)
    })
    setInstitutionAndPersist((current) => ({
      ...current,
      promoVideoAssetIds: current.promoVideoAssetIds.filter((assetId) => !ids.includes(assetId)),
    }))
    setVideoUploadErrors([`已按时间清理最早 ${targets.length} 个视频。`])
    setRemoveOldCount('1')
  }

  const uploadPromoVideoFromUrl = () => {
    const link = remoteVideoUrl.trim()
    const title = remoteVideoTitle.trim()
    if (!link) return
    if (!isValidHttpUrl(link)) {
      setVideoUploadErrors(['请输入有效的视频外链（http/https）。'])
      return
    }
    const fileName = title || link.split('?')[0].split('/').pop() || `外部视频-${Date.now()}`
    const resolvedTitle = fileName
    const resolvedDesc = `${VIDEO_CATALOG_DEFAULT_DESC}：${resolvedTitle}`
    const asset: MediaAsset = {
      id: createMediaId('video'),
      kind: 'video',
      name: fileName,
      title: resolvedTitle,
      desc: resolvedDesc,
      mimeType: 'video/mp4',
      dataUrl: '',
      remoteUrl: link,
      createdAt: new Date().toISOString(),
    }
    try {
      upsertMediaAsset(asset)
      setInstitutionAndPersist((current) => ({
        ...current,
        promoVideoAssetIds: Array.from(new Set([...current.promoVideoAssetIds, asset.id])),
      }))
      setRemoteVideoUrl('')
      setRemoteVideoTitle('')
      setVideoUploadErrors([])
    } catch (error) {
      setVideoUploadErrors([normalizeErrorMessage(error)])
    }
  }

  const pickCourse = (courseId: string) => {
    const nextCourse = courses.find((course) => course.id === courseId) ?? courses[0]
    const nextUnit = nextCourse.units[0]
    setSelectedCourseId(nextCourse.id)
    setSelectedUnitId(nextUnit.id)
    setSelectedItemId(nextUnit.items[0].id)
  }

  const pickUnit = (unitId: string) => {
    const nextUnit = selectedCourse.units.find((unit) => unit.id === unitId) ?? selectedCourse.units[0]
    setSelectedUnitId(nextUnit.id)
    setSelectedItemId(nextUnit.items[0].id)
  }

  const pickItem = (itemId: string) => {
    setSelectedItemId(itemId)
  }

  const login = (event: FormEvent) => {
    event.preventDefault()
    if (password === adminPassword) {
      setAuthenticated(true)
      setLoginError('')
    } else {
      setLoginError('密码不正确，请重新输入。')
    }
  }

  const updateCampaign = (id: CampaignKind, field: keyof AdmissionCampaign, value: string) => {
    setSaved(false)
    setSettings((current) => ({
      ...current,
      campaigns: current.campaigns.map((campaign) => (campaign.id === id ? { ...campaign, [field]: value } : campaign)),
    }))
  }

  const updateInstitution = <K extends keyof InstitutionProfile>(field: K, value: InstitutionProfile[K]) => {
    setSaved(false)
    setInstitution((current) => ({ ...current, [field]: value }))
  }

  const updateTeacher = (id: string, field: keyof TeacherProfile, value: string) => {
    setSaved(false)
    setInstitution((current) => ({
      ...current,
      teachers: updateArrayItem(current.teachers, id, (teacher) => ({ ...teacher, [field]: value })),
    }))
  }

  const updateQuality = (id: string, field: keyof QualityHighlight, value: string) => {
    setSaved(false)
    setInstitution((current) => ({
      ...current,
      qualityHighlights: updateArrayItem(current.qualityHighlights, id, (item) => ({ ...item, [field]: value })),
    }))
  }

  const updateTimetable = (id: string, field: keyof TimetableEntry, value: string) => {
    setSaved(false)
    setInstitution((current) => ({
      ...current,
      timetable: updateArrayItem(current.timetable, id, (item) => ({ ...item, [field]: value })),
    }))
  }

  const updateNearbyPoint = (id: string, field: 'title' | 'description' | 'icon', value: string) => {
    setSaved(false)
    setInstitution((current) => ({
      ...current,
      nearbyPoints: updateArrayItem(current.nearbyPoints, id, (item) => ({ ...item, [field]: value })),
    }))
  }

  const setInstitutionAndPersist = (updater: (current: InstitutionProfile) => InstitutionProfile) => {
    setSaved(false)
    setInstitution((current) => {
      const nextInstitution = updater(current)
      saveInstitutionProfile(nextInstitution)
      return nextInstitution
    })
  }

  const uploadTeacherAvatar = async (id: string, file: File | undefined) => {
    if (!file) return
    const typeError = validateAvatarFile(file)
    setTeacherAvatarErrors((current) => ({ ...current, [id]: '' }))
    if (typeError) {
      setTeacherAvatarErrors((current) => ({ ...current, [id]: typeError }))
      return
    }
    try {
      const { width, height } = await readImageSize(file)
      if (width < 300 || height < 300 || width > 2000 || height > 2000) {
        setTeacherAvatarErrors((current) => ({
          ...current,
          [id]: `图片尺寸不符合要求（当前 ${width}x${height}，建议 300~2000px）。`,
        }))
        return
      }
    } catch {
      setTeacherAvatarErrors((current) => ({ ...current, [id]: '图片读取失败，请重新选择文件。' }))
      return
    }
    const reader = new FileReader()
    reader.onload = () => {
      setSaved(false)
      setTeacherAvatarErrors((current) => {
        const next = { ...current }
        delete next[id]
        return next
      })
      setInstitution((current) => ({
        ...current,
        teachers: updateArrayItem(current.teachers, id, (teacher) => ({ ...teacher, avatarUrl: String(reader.result) })),
      }))
    }
    reader.onerror = () => {
      setTeacherAvatarErrors((current) => ({ ...current, [id]: '头像读取失败，请重试。' }))
    }
    reader.readAsDataURL(file)
  }

  const uploadPromoVideo = async (
    file: File | undefined,
    titleInput = '',
    index = 1,
  ): Promise<string | undefined> => {
    if (!file) return '未选择文件。'
    const typeError = validateVideoFile(file)
    if (typeError) return typeError
    const resolvedTitle = buildVideoMetaTitle(file.name, titleInput, index)
    const resolvedDesc = `${VIDEO_CATALOG_DEFAULT_DESC}：${resolvedTitle}`
    try {
      const { videoSrc } = await uploadVideoToLocalServer(file, resolvedTitle, resolvedDesc)
      const asset: MediaAsset = {
        id: createMediaId('video'),
        kind: 'video',
        name: resolvedTitle,
        title: resolvedTitle,
        desc: resolvedDesc,
        mimeType: file.type,
        dataUrl: '',
        remoteUrl: videoSrc,
        createdAt: new Date().toISOString(),
      }
      upsertMediaAsset(asset)
      setInstitutionAndPersist((current) => ({
        ...current,
        promoVideoAssetIds: Array.from(new Set([...current.promoVideoAssetIds, asset.id])),
      }))
      return
    } catch (error) {
      if (error instanceof Error) {
        return error.message
      }
      return '上传服务异常，请稍后重试。'
    }
  }


  const uploadItemAudio = async (kind: 'wordAudioAssetId' | 'sentenceAudioAssetId', file: File | undefined) => {
    if (!file) return
    const previousBinding = getMediaBinding(selectedItem.id)
    const previousAssetId = previousBinding[kind]
    if (previousAssetId) {
      removeMediaAsset(previousAssetId)
    }
    const dataUrl = await readFileAsDataUrl(file)
    const asset: MediaAsset = {
      id: createMediaId(kind === 'wordAudioAssetId' ? 'word-audio' : 'sentence-audio'),
      kind: 'audio',
      name: file.name,
      mimeType: file.type,
      dataUrl,
      createdAt: new Date().toISOString(),
    }
    upsertMediaAsset(asset)
    updateMediaBinding(selectedItem.id, {
      ...previousBinding,
      [kind]: asset.id,
    })
    setSaved(false)
  }

  const clearItemAudio = (kind: 'wordAudioAssetId' | 'sentenceAudioAssetId') => {
    const binding = getMediaBinding(selectedItem.id)
    const assetId = binding[kind]
    if (assetId) {
      removeMediaAsset(assetId)
    }
    updateMediaBinding(selectedItem.id, {
      ...binding,
      [kind]: undefined,
    })
    setSaved(false)
  }

  const removePromoVideo = (assetId: string) => {
    removeMediaAsset(assetId)
    setInstitutionAndPersist((current) => ({
      ...current,
      promoVideoAssetIds: current.promoVideoAssetIds.filter((id) => id !== assetId),
    }))
  }

  const save = () => {
    void (async () => {
      const snapshot = getContentSnapshot()
      await saveContentBundle({
        ...snapshot,
        admission: settings,
        institution,
      })
      setSaved(true)
      window.setTimeout(() => setSaved(false), 2400)
    })()
  }

  const reset = () => {
    resetAdmissionSettings()
    resetMediaState()
    resetFeedbackLibrary()
    resetInstitutionProfile()
    setSettings(getAdmissionSettings())
    setInstitution(getInstitutionProfile())
    setSaved(false)
  }

  if (!authenticated) {
    return (
      <div className="admin-login-page">
        <div className="admin-login-card">
          <div className="admin-lock"><LockKeyhole size={28} /></div>
          <span className="mini-label">招生管理后台</span>
          <h1>招生管理登录</h1>
          <p>输入演示管理密码，修改首页的招生季、机构展示、课表与教学内容。</p>
          <form onSubmit={login}>
            <label htmlFor="password">管理密码</label>
            <div className="password-field">
              <input
                id="password"
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder="请输入管理密码"
                autoFocus
              />
              <button type="button" aria-label="显示或隐藏密码" onClick={() => setShowPassword(!showPassword)}>
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
            {loginError && <div className="login-error">{loginError}</div>}
            <button className="button button-primary full">进入管理后台</button>
          </form>
          <div className="admin-warning">
            <ShieldAlert size={18} />
            <span>当前为服务端配置方案。正式上线前请完善管理员鉴权和正式账号体系。</span>
          </div>
            <Link to={ROUTES.home}><ArrowLeft size={16} /> 返回官网</Link>
        </div>
      </div>
    )
  }

  return (
    <div className="admin-page">
      <header className="admin-header">
        <div>
          <span className="mini-label">Aggie速记英语</span>
          <h1>招生与机构管理</h1>
          <p>当前配置会写入内容服务端，刷新后自动同步展示页。</p>
        </div>
        <div className="admin-header-actions">
          <Link className="button button-ghost" to={ROUTES.home}><ArrowLeft size={17} /> 查看官网</Link>
          <button className="button button-primary" onClick={save}><Save size={17} /> 保存修改</button>
        </div>
      </header>

      <main className="admin-main">
        <section className="admin-section">
          <div className="admin-section-heading">
            <div>
              <h2>当前重点招生季</h2>
              <p>首页会突出显示所选季节的班型。</p>
            </div>
          </div>
          <div className="season-switcher">
            {(['spring', 'autumn'] as const).map((season) => (
              <button
                className={settings.activeSeason === season ? 'active' : ''}
                onClick={() => {
                  setSaved(false)
                  setSettings({ ...settings, activeSeason: season })
                }}
                key={season}
              >
                <span>{season === 'spring' ? '🌱' : '🍂'}</span>
                <strong>{season === 'spring' ? '春季招生' : '秋季招生'}</strong>
                {settings.activeSeason === season && <Check size={18} />}
              </button>
            ))}
          </div>
        </section>

        <section className="admin-section">
          <div className="admin-section-heading">
            <div>
              <h2>招生卡片内容</h2>
              <p>修改后点击保存，首页会同步更新。</p>
            </div>
            <button className="reset-button" onClick={reset}><RotateCcw size={16} /> 恢复默认</button>
          </div>
          <div className="admin-campaign-list">
            {settings.campaigns.map((campaign) => (
              <div className="admin-campaign-card" key={campaign.id}>
                <div className="admin-card-title">
                  <span style={{ background: campaign.accent }}>{campaign.id === 'trial' ? '✨' : campaign.id === 'spring' ? '🌱' : '🍂'}</span>
                  <div>
                    <strong>{campaign.title}</strong>
                    <small>{campaign.id === 'trial' ? '体验课' : campaign.id === 'spring' ? '春季班' : '秋季班'}</small>
                  </div>
                </div>
                <div className="form-grid">
                  <label>标题<input value={campaign.title} onChange={(event) => updateCampaign(campaign.id, 'title', event.target.value)} /></label>
                  <label>标签<input value={campaign.eyebrow} onChange={(event) => updateCampaign(campaign.id, 'eyebrow', event.target.value)} /></label>
                  <label className="span-two">介绍<textarea value={campaign.description} onChange={(event) => updateCampaign(campaign.id, 'description', event.target.value)} /></label>
                  <label>适合年级<input value={campaign.grades} onChange={(event) => updateCampaign(campaign.id, 'grades', event.target.value)} /></label>
                  <label>课时说明<input value={campaign.lessons} onChange={(event) => updateCampaign(campaign.id, 'lessons', event.target.value)} /></label>
                  <label>课程特色<input value={campaign.feature} onChange={(event) => updateCampaign(campaign.id, 'feature', event.target.value)} /></label>
                  <label>名额说明<input value={campaign.quota} onChange={(event) => updateCampaign(campaign.id, 'quota', event.target.value)} /></label>
                  <label>
                    招生状态
                    <select value={campaign.status} onChange={(event) => updateCampaign(campaign.id, 'status', event.target.value as AdmissionStatus)}>
                      <option>即将开始</option>
                      <option>报名中</option>
                      <option>已满</option>
                    </select>
                  </label>
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="admin-section">
          <div className="admin-section-heading">
            <div>
              <h2>机构基本信息</h2>
              <p>用于首页概览、机构详情页和地图展示。</p>
            </div>
          </div>
          <div className="form-grid">
            <label>机构名称<input value={institution.name} onChange={(event) => updateInstitution('name', event.target.value)} /></label>
            <label>详细地址<input value={institution.address} onChange={(event) => updateInstitution('address', event.target.value)} /></label>
            <label>高德地图纬度<input value={institution.mapLatitude} onChange={(event) => updateInstitution('mapLatitude', event.target.value)} placeholder="例如：31.230416" /></label>
            <label>高德地图经度<input value={institution.mapLongitude} onChange={(event) => updateInstitution('mapLongitude', event.target.value)} placeholder="例如：121.473701" /></label>
            <label className="span-two">高德地图说明<textarea value={institution.mapNote} onChange={(event) => updateInstitution('mapNote', event.target.value)} /></label>
            <label className="span-two">周边概述<textarea value={institution.surroundingsSummary} onChange={(event) => updateInstitution('surroundingsSummary', event.target.value)} /></label>
          </div>
          <div className="mini-card-list">
            {institution.nearbyPoints.map((point) => (
              <div className="mini-edit-card" key={point.id}>
                <MapPinned size={16} />
                <div className="form-grid compact">
                  <label>标题<input value={point.title} onChange={(event) => updateNearbyPoint(point.id, 'title', event.target.value)} /></label>
                  <label>说明<input value={point.description} onChange={(event) => updateNearbyPoint(point.id, 'description', event.target.value)} /></label>
                  <label>图标<input value={point.icon} onChange={(event) => updateNearbyPoint(point.id, 'icon', event.target.value)} /></label>
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="admin-section">
          <div className="admin-section-heading">
            <div>
              <h2>媒体上传</h2>
              <p>上传真人发音和机构视频；学习页优先播放你上传的素材。</p>
            </div>
          </div>
          <div className="media-admin-grid">
            <div className="media-admin-card">
              <div className="admin-card-title">
                <span>🎧</span>
                <div>
                  <strong>真人发音</strong>
                  <small>按课程、单元和词条绑定单词/句子录音</small>
                </div>
              </div>
              <div className="form-grid">
                <label>
                  课程
                  <select value={selectedCourseId} onChange={(event) => pickCourse(event.target.value)}>
                    {courses.map((course) => <option value={course.id} key={course.id}>{course.title}</option>)}
                  </select>
                </label>
                <label>
                  单元
                  <select value={selectedUnitId} onChange={(event) => pickUnit(event.target.value)}>
                    {selectedCourse.units.map((unit) => <option value={unit.id} key={unit.id}>{unit.title}</option>)}
                  </select>
                </label>
                <label className="span-two">
                  词条
                  <select value={selectedItemId} onChange={(event) => pickItem(event.target.value)}>
                    {selectedUnit.items.map((item) => <option value={item.id} key={item.id}>{item.word} · {item.meaning}</option>)}
                  </select>
                </label>
              </div>
              <div className="media-item-preview">
                <strong>{selectedItem.word}</strong>
                <span>{selectedItem.phonetic} · {selectedItem.meaning}</span>
                <small>{selectedItem.sentence}</small>
              </div>
              <div className="media-upload-block">
                <label>
                  单词真人发音
                  <input
                    type="file"
                    accept="audio/*"
                    onChange={(event) => void uploadItemAudio('wordAudioAssetId', event.target.files?.[0])}
                  />
                </label>
                <div className="media-inline-actions">
                  <span>{selectedWordAudio ? `已绑定：${selectedWordAudio.name}` : '未上传'}</span>
                  <button className="button button-small button-ghost" onClick={() => clearItemAudio('wordAudioAssetId')}>清除单词发音</button>
                </div>
              </div>
              <div className="media-upload-block">
                <label>
                  句子真人发音
                  <input
                    type="file"
                    accept="audio/*"
                    onChange={(event) => void uploadItemAudio('sentenceAudioAssetId', event.target.files?.[0])}
                  />
                </label>
                <div className="media-inline-actions">
                  <span>{selectedSentenceAudio ? `已绑定：${selectedSentenceAudio.name}` : '未上传'}</span>
                  <button className="button button-small button-ghost" onClick={() => clearItemAudio('sentenceAudioAssetId')}>清除句子发音</button>
                </div>
              </div>
            </div>

            <div className="media-admin-card">
              <div className="admin-card-title">
                <span>🎬</span>
                <div>
                  <strong>机构视频</strong>
                  <small>上传宣传视频、课堂片段或家长说明视频</small>
                </div>
              </div>
              <label>
                上传视频
                <input
                  type="file"
                  accept="video/*"
                  multiple
                  onChange={async (event) => {
                    setVideoUploadErrors([])
                    const files = Array.from(event.target.files ?? [])
                    const errors: string[] = []
                    for (let i = 0; i < files.length; i += 1) {
                      const file = files[i]
                      const error = await uploadPromoVideo(file, remoteVideoTitle, i + 1)
                      if (error) {
                        errors.push(`${file.name}：${error}`)
                      }
                    }
                    if (errors.length > 0) {
                      setVideoUploadErrors(errors)
                    }
                    event.target.value = ''
                  }}
                />
              </label>
              <div className="admin-upload-note">本地上传默认按 5MB 分片上传（MP4），文件内容仅留存远端链接。</div>
              <small className="admin-upload-note">建议清晰横版 16:9，便于页面展示。</small>
              <label>
                外链上传（R2/对象存储）
                <div className="media-upload-block">
                  <input
                    type="text"
                    value={remoteVideoTitle}
                    onChange={(event) => setRemoteVideoTitle(event.target.value)}
                    placeholder="标题（可选）"
                  />
                  <input
                    type="text"
                    value={remoteVideoUrl}
                    onChange={(event) => setRemoteVideoUrl(event.target.value)}
                    placeholder="粘贴视频外链（如 R2 公开链接）"
                  />
                </div>
              </label>
              <div className="media-inline-actions">
                <button className="button button-small button-ghost" onClick={uploadPromoVideoFromUrl}>
                  <Upload size={15} /> 添加外链视频
                </button>
              </div>
              <div className="media-inline-actions">
                <button className="button button-small button-ghost" type="button" onClick={removeAllPromoVideos}>
                  一键清空机构视频
                </button>
                <button
                  className="button button-small button-ghost"
                  type="button"
                  onClick={() => {
                    const count = Number.parseInt(removeOldCount, 10)
                    if (Number.isNaN(count)) {
                      setVideoUploadErrors(['请输入有效的清理数量（正整数）。'])
                      return
                    }
                    removeOldestPromoVideos(count)
                  }}
                >
                  按时间清理旧视频
                </button>
                <label>
                  数量
                  <input
                    type="number"
                    value={removeOldCount}
                    min="1"
                    onChange={(event) => setRemoveOldCount(event.target.value)}
                    style={{ width: '120px' }}
                  />
                </label>
              </div>
              <div className="media-upload-block">
                <label>
                  按名称清理（支持包含匹配）
                  <input
                    type="text"
                    value={videoNameKeyword}
                    onChange={(event) => setVideoNameKeyword(event.target.value)}
                    placeholder="例如：983d8a65d80539 或 mp4"
                  />
                </label>
                <div className="media-inline-actions">
                  <button className="button button-small button-ghost" type="button" onClick={() => removePromoVideosByKeyword(videoNameKeyword)}>
                    按名称清理
                  </button>
                </div>
              </div>
              {videoUploadErrors.length > 0 ? (
                <div className="admin-upload-error">
                  {videoUploadErrors.map((error, index) => <div key={`${index}-${error}`}>{error}</div>)}
                </div>
              ) : null}
              <div className="promo-video-admin-list">
              {promoVideos.length > 0 ? promoVideos.map((video) => (
                  <article className="promo-video-card admin-video-card" key={video.id}>
                    <video controls playsInline src={video.remoteUrl || video.dataUrl} />
                    <div className="promo-video-copy">
                      <strong>{getPromoVideoDisplayTitle(video)}</strong>
                      <span>{video.desc || '机构宣传视频（待补充）'}</span>
                    </div>
                    <button className="button button-small button-ghost" onClick={() => removePromoVideo(video.id)}>
                      <Trash2 size={15} /> 删除视频
                    </button>
                  </article>
                )) : (
                  <div className="promo-video-empty">
                    <strong>还没有上传视频</strong>
                    <span>支持 mp4 / webm 等常见格式。上传后首页会自动展示。</span>
                  </div>
                )}
              </div>
            </div>
          </div>
        </section>

        <section className="admin-section">
          <div className="admin-section-heading">
            <div>
              <h2>师资展示</h2>
              <p>支持照片上传、姓名、简介和教学特点编辑。</p>
            </div>
            <button
              className="button button-small button-outline"
              onClick={() => {
                setSaved(false)
                setInstitution((current) => ({ ...current, teachers: [...current.teachers, emptyTeacher(current.teachers.length)] }))
              }}
            >
              <Plus size={16} /> 添加老师
            </button>
          </div>
          <div className="admin-entity-list">
            {institution.teachers.map((teacher, index) => (
              <div className="admin-entity-card" key={teacher.id}>
                <div className="admin-entity-head">
                  <img src={teacher.avatarUrl} alt={teacher.name} />
                  <div className="admin-entity-meta">
                    <strong>{teacher.name}</strong>
                    <span>{teacher.title}</span>
                  </div>
                  <button
                    className="icon-button"
                    onClick={() => {
                      setSaved(false)
                      setTeacherAvatarErrors((current) => {
                        const next = { ...current }
                        delete next[teacher.id]
                        return next
                      })
                      setInstitution((current) => ({
                        ...current,
                        teachers: current.teachers.filter((item) => item.id !== teacher.id),
                      }))
                    }}
                    aria-label={`删除 ${teacher.name}`}
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
                <div className="form-grid">
                  <label>姓名<input value={teacher.name} onChange={(event) => updateTeacher(teacher.id, 'name', event.target.value)} /></label>
                  <label>头衔<input value={teacher.title} onChange={(event) => updateTeacher(teacher.id, 'title', event.target.value)} /></label>
                  <label className="span-two">简介<textarea value={teacher.intro} onChange={(event) => updateTeacher(teacher.id, 'intro', event.target.value)} /></label>
                  <label className="span-two">教学特点<textarea value={teacher.teachingStyle} onChange={(event) => updateTeacher(teacher.id, 'teachingStyle', event.target.value)} /></label>
                  <label>头像链接<input value={teacher.avatarUrl} onChange={(event) => updateTeacher(teacher.id, 'avatarUrl', event.target.value)} /></label>
                  <label>图片上传<input type="file" accept="image/jpeg,image/png,image/webp" onChange={(event) => void uploadTeacherAvatar(teacher.id, event.target.files?.[0])} /></label>
                  <small className="admin-upload-note">支持 JPG / PNG / WEBP，单文件 ≤2MB，尺寸 300~2000px。</small>
                  {teacherAvatarErrors[teacher.id]
                    ? <small className="admin-upload-error">{teacherAvatarErrors[teacher.id]}</small>
                    : <small className="admin-upload-note">成功后头像会立即更新到列表。</small>}
                  <label>主题色<input value={teacher.accent} onChange={(event) => updateTeacher(teacher.id, 'accent', event.target.value)} /></label>
                </div>
                <div className="inline-note">当前老师序号：{index + 1}</div>
              </div>
            ))}
          </div>
        </section>

        <section className="admin-section">
          <div className="admin-section-heading">
            <div>
              <h2>教学质量</h2>
              <p>用于展示学习成果、家长反馈和课堂亮点。</p>
            </div>
            <button
              className="button button-small button-outline"
              onClick={() => {
                setSaved(false)
                setInstitution((current) => ({ ...current, qualityHighlights: [...current.qualityHighlights, emptyQuality(current.qualityHighlights.length)] }))
              }}
            >
              <Plus size={16} /> 添加内容
            </button>
          </div>
          <div className="admin-entity-list">
            {institution.qualityHighlights.map((item) => (
              <div className="admin-entity-card" key={item.id}>
                <div className="admin-entity-head">
                  <div className="quality-dot" style={{ background: item.accent }} />
                  <div>
                    <strong>{item.title}</strong>
                    <span>{item.quote}</span>
                  </div>
                  <button
                    className="icon-button"
                    onClick={() => {
                      setSaved(false)
                      setInstitution((current) => ({
                        ...current,
                        qualityHighlights: current.qualityHighlights.filter((highlight) => highlight.id !== item.id),
                      }))
                    }}
                    aria-label={`删除 ${item.title}`}
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
                <div className="form-grid">
                  <label>标题<input value={item.title} onChange={(event) => updateQuality(item.id, 'title', event.target.value)} /></label>
                  <label>描述<textarea value={item.description} onChange={(event) => updateQuality(item.id, 'description', event.target.value)} /></label>
                  <label className="span-two">家长反馈 / 案例<textarea value={item.quote} onChange={(event) => updateQuality(item.id, 'quote', event.target.value)} /></label>
                  <label>主题色<input value={item.accent} onChange={(event) => updateQuality(item.id, 'accent', event.target.value)} /></label>
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="admin-section">
          <div className="admin-section-heading">
            <div>
              <h2>周课表</h2>
              <p>按星期、时间、班型维护课程安排，方便家长查看。</p>
            </div>
            <button
              className="button button-small button-outline"
              onClick={() => {
                setSaved(false)
                setInstitution((current) => ({ ...current, timetable: [...current.timetable, emptyTimetable(current.timetable.length)] }))
              }}
            >
              <Plus size={16} /> 添加课表
            </button>
          </div>
          <div className="admin-schedule-list">
            {institution.timetable.map((entry) => (
              <div className="admin-schedule-card" key={entry.id}>
                <div className="admin-entity-head">
                  <CalendarDays size={17} />
                  <div>
                    <strong>{entry.day} {entry.startTime}-{entry.endTime}</strong>
                    <span>{entry.className}</span>
                  </div>
                  <button
                    className="icon-button"
                    onClick={() => {
                      setSaved(false)
                      setInstitution((current) => ({
                        ...current,
                        timetable: current.timetable.filter((schedule) => schedule.id !== entry.id),
                      }))
                    }}
                    aria-label={`删除 ${entry.className}`}
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
                <div className="form-grid">
                  <label>星期<input value={entry.day} onChange={(event) => updateTimetable(entry.id, 'day', event.target.value)} /></label>
                  <label>开始时间<input value={entry.startTime} onChange={(event) => updateTimetable(entry.id, 'startTime', event.target.value)} /></label>
                  <label>结束时间<input value={entry.endTime} onChange={(event) => updateTimetable(entry.id, 'endTime', event.target.value)} /></label>
                  <label>班型<input value={entry.className} onChange={(event) => updateTimetable(entry.id, 'className', event.target.value)} /></label>
                  <label>课程内容<input value={entry.course} onChange={(event) => updateTimetable(entry.id, 'course', event.target.value)} /></label>
                  <label>老师<input value={entry.teacher} onChange={(event) => updateTimetable(entry.id, 'teacher', event.target.value)} /></label>
                  <label>教室<input value={entry.room} onChange={(event) => updateTimetable(entry.id, 'room', event.target.value)} /></label>
                </div>
              </div>
            ))}
          </div>
        </section>
      </main>

      {saved && <div className="save-toast"><Check size={18} /> 配置已保存</div>}
    </div>
  )
}
