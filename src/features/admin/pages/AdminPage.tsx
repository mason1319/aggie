import {
  ArrowLeft, CalendarDays, Check, Eye, EyeOff, LockKeyhole, MapPinned, Plus, RotateCcw, Save,
  ShieldAlert, Trash2,
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
    const reader = new FileReader()
    reader.onload = () => {
      setSaved(false)
      setInstitution((current) => ({
        ...current,
        teachers: updateArrayItem(current.teachers, id, (teacher) => ({ ...teacher, avatarUrl: String(reader.result) })),
      }))
    }
    reader.readAsDataURL(file)
  }

  const uploadPromoVideo = async (file: File | undefined) => {
    if (!file) return
    const dataUrl = await readFileAsDataUrl(file)
    const asset: MediaAsset = {
      id: createMediaId('video'),
      kind: 'video',
      name: file.name,
      mimeType: file.type,
      dataUrl,
      createdAt: new Date().toISOString(),
    }
    upsertMediaAsset(asset)
    setInstitutionAndPersist((current) => ({
      ...current,
      promoVideoAssetIds: Array.from(new Set([...current.promoVideoAssetIds, asset.id])),
    }))
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
          <span className="mini-label">本地演示后台</span>
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
            <span>这是本机演示方案，不适合直接公开上线。正式上线需接入真实管理员认证和数据库。</span>
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
          <p>当前配置仅保存在本机浏览器中</p>
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
                    const files = Array.from(event.target.files ?? [])
                    for (const file of files) {
                      await uploadPromoVideo(file)
                    }
                    event.target.value = ''
                  }}
                />
              </label>
              <div className="promo-video-admin-list">
                {promoVideos.length > 0 ? promoVideos.map((video) => (
                  <article className="promo-video-card admin-video-card" key={video.id}>
                    <video controls playsInline src={video.dataUrl} />
                    <div className="promo-video-copy">
                      <strong>{video.name}</strong>
                      <span>{video.mimeType || 'video/*'}</span>
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
                  <div>
                    <strong>{teacher.name}</strong>
                    <span>{teacher.title}</span>
                  </div>
                  <button
                    className="icon-button"
                    onClick={() => {
                      setSaved(false)
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
                  <label>图片上传<input type="file" accept="image/*" onChange={(event) => uploadTeacherAvatar(teacher.id, event.target.files?.[0])} /></label>
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
