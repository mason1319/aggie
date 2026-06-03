import { ArrowLeft, BadgeCheck, Cloud, MessageSquareMore, Plus, RefreshCcw, School, Sparkles, Users } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { AppHeader } from '../../../shared/components/AppHeader'
import { SectionTitle } from '../../../shared/components/SectionTitle'
import { CONTENT_SOURCE_EVENT, getContentSnapshot, useContentBundle } from '../../../shared/data-source'
import { FEEDBACK_SYNC_INTERVAL_MS, loadFeedbackEntries, submitFeedbackEntry } from '../../../shared/services/feedbackApi'
import { uploadImageToLocalServer } from '../../../shared/services/imageUpload'
import { ROUTES } from '../../../shared/constants/routes'
import type { FeedbackEntry, FeedbackRole } from '../../../shared/types/feedback'

function makeAvatarDataUrl(label: string, accent: string) {
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

function sourceLabel(source: 'cloud' | 'cache' | 'offline') {
  if (source === 'cloud') return '云端已同步'
  if (source === 'cache') return '本机缓存'
  return '离线缓存'
}

export function FeedbackPage() {
  const { bundle } = useContentBundle()
  const [entries, setEntries] = useState<FeedbackEntry[]>(() => bundle.feedback.entries)
  useEffect(() => {
    setEntries(bundle.feedback.entries)
  }, [bundle.feedback.entries])
  const [role, setRole] = useState<FeedbackRole>('家长')
  const [name, setName] = useState('')
  const [subtitle, setSubtitle] = useState('')
  const [contact, setContact] = useState('')
  const [content, setContent] = useState('')
  const [avatarUrl, setAvatarUrl] = useState(makeAvatarDataUrl('反馈', '#7bc8a4'))
  const [imageUrl, setImageUrl] = useState('')
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [source, setSource] = useState<'cloud' | 'cache' | 'offline'>('cache')
  const [notice, setNotice] = useState('')
  const [error, setError] = useState('')
  const [avatarProgress, setAvatarProgress] = useState(0)
  const [feedbackImageProgress, setFeedbackImageProgress] = useState(0)

  const refreshEntries = async () => {
    try {
      setLoading(true)
      const result = await loadFeedbackEntries()
      setEntries(result.entries)
      setSource(result.source)
      setError('')
    } catch {
      setError('云端反馈暂时不可用，请稍后重试。')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void refreshEntries()

    const syncFromCache = () => {
      setEntries(getContentSnapshot().feedback.entries)
    }

    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        void refreshEntries()
      }
    }

    const interval = window.setInterval(() => {
      void refreshEntries()
    }, FEEDBACK_SYNC_INTERVAL_MS)

    window.addEventListener(CONTENT_SOURCE_EVENT, syncFromCache)
    window.addEventListener('focus', handleVisibility)
    document.addEventListener('visibilitychange', handleVisibility)

    return () => {
      window.clearInterval(interval)
      window.removeEventListener(CONTENT_SOURCE_EVENT, syncFromCache)
      window.removeEventListener('focus', handleVisibility)
      document.removeEventListener('visibilitychange', handleVisibility)
    }
  }, [])

  const summary = useMemo(() => ({
    total: entries.length,
    parentCount: entries.filter((entry) => entry.role === '家长').length,
    studentCount: entries.filter((entry) => entry.role === '学生').length,
  }), [entries])

  const resetForm = () => {
    setRole('家长')
    setName('')
    setSubtitle('')
    setContact('')
    setContent('')
    setAvatarUrl(makeAvatarDataUrl('反馈', '#7bc8a4'))
    setImageUrl('')
  }

  const submit = async () => {
    if (!name.trim() || !content.trim()) return
    setSubmitting(true)
    setError('')
    try {
      const result = await submitFeedbackEntry({
        role,
        name,
        subtitle: subtitle.trim() || (role === '家长' ? '家长反馈' : '学生反馈'),
        contact,
        content,
        avatarUrl,
        imageUrl: imageUrl.trim() || undefined,
      })
      setEntries(result.entries)
      setSource(result.source)
      setNotice(result.source === 'cloud' ? '反馈已同步到云端。' : '云端暂不可用，已先保存到本机缓存。')
      resetForm()
      window.setTimeout(() => setNotice(''), 2800)
    } catch {
      setError('提交失败，请稍后再试。')
    } finally {
      setSubmitting(false)
    }
  }

  const uploadAvatar = async (file: File | undefined) => {
    if (!file) return
    setError('')
    setAvatarProgress(0)
    try {
      const result = await uploadImageToLocalServer({
        category: 'feedback',
        file,
        title: `${name || '反馈者'}头像`,
        desc: '反馈头像',
        onProgress: setAvatarProgress,
      })
      setAvatarUrl(result.imageUrl)
      setAvatarProgress(0)
    } catch {
      setError('头像上传失败，请稍后重试。')
      setAvatarProgress(0)
    }
  }

  const uploadImage = async (file: File | undefined) => {
    if (!file) return
    setError('')
    setFeedbackImageProgress(0)
    try {
      const result = await uploadImageToLocalServer({
        category: 'feedback',
        file,
        title: `${name || '反馈者'}附件`,
        desc: '反馈附图',
        onProgress: setFeedbackImageProgress,
      })
      setImageUrl(result.imageUrl)
      setFeedbackImageProgress(0)
    } catch {
      setError('附件图片上传失败，请稍后重试。')
      setFeedbackImageProgress(0)
    }
  }

  return (
    <div className="feedback-page">
      <AppHeader />
      <main>
        <section className="feedback-hero">
          <div className="container feedback-hero-grid">
            <div>
              <span className="mini-label">家长与学生反馈提交</span>
              <h1>把真实反馈，沉淀成招生页最有力的证据</h1>
              <p>支持家长评价、学生学习感受、头像与图片附件。提交后会优先写入云端反馈库，并同步到首页展示区。</p>
              <div className="feedback-stats">
                <div><strong>{summary.total}</strong><span>条反馈</span></div>
                <div><strong>{summary.parentCount}</strong><span>家长反馈</span></div>
                <div><strong>{summary.studentCount}</strong><span>学生反馈</span></div>
              </div>
            </div>
            <div className="feedback-hero-card">
              <div className="feedback-hero-card-top">
                <BadgeCheck size={20} />
                <strong>云端反馈提交</strong>
              </div>
              <p>用于沉淀家长口碑、学生进步案例和招生素材。支持图片上传，适合正式招生官网展示。</p>
              <div className="feedback-hero-note">
                <Cloud size={16} />
                <span>{loading ? '正在同步云端数据…' : sourceLabel(source)}</span>
              </div>
              <div className="feedback-hero-actions">
                <Link to={ROUTES.home} className="button button-ghost full"><ArrowLeft size={17} /> 返回首页</Link>
                <button className="button button-primary full" onClick={() => void refreshEntries()}><RefreshCcw size={17} /> 刷新云端内容</button>
              </div>
            </div>
          </div>
        </section>

        <section className="section">
          <div className="container feedback-layout">
            <div className="feedback-form-card">
              <SectionTitle align="left" eyebrow="提交反馈" title="填写内容并上传到云端" description="可上传头像和图片，建议写真实场景和具体变化，便于后续招生展示。" />
              <div className="feedback-audit-strip">
                <span>提交后自动同步云端</span>
                <span>支持家长 / 学生两类反馈</span>
                <span>可附图和头像</span>
              </div>
              <div className="form-grid">
                <label>
                  角色
                  <select value={role} onChange={(event) => setRole(event.target.value as FeedbackRole)}>
                    {(['家长', '学生'] as const).map((item) => <option value={item} key={item}>{item}</option>)}
                  </select>
                </label>
                <label>
                  姓名 / 昵称
                  <input value={name} onChange={(event) => setName(event.target.value)} placeholder="例如：李女士 / 小宇" />
                </label>
                <label>
                  联系方式 / 微信（选填）
                  <input value={contact} onChange={(event) => setContact(event.target.value)} placeholder="例如：138****1234 / WeChat ID" />
                </label>
                <label className="span-two">
                  头衔 / 年级
                  <input value={subtitle} onChange={(event) => setSubtitle(event.target.value)} placeholder="例如：三年级家长 / 五年级学生" />
                </label>
                <label className="span-two">
                  反馈内容
                  <textarea value={content} onChange={(event) => setContent(event.target.value)} placeholder="填写真实反馈内容，比如学习变化、课堂感受、家长反馈。" />
                </label>
                <label>
                  头像上传
                  <input type="file" accept="image/*" onChange={(event) => void uploadAvatar(event.target.files?.[0])} />
                </label>
                {avatarProgress > 0 ? (
                  <div className="upload-progress">
                    <span>头像上传：{avatarProgress}%</span>
                    <div className="upload-progress-track"><i style={{ width: `${avatarProgress}%` }} /></div>
                  </div>
                ) : null}
                <label>
                  附图上传
                  <input type="file" accept="image/*" onChange={(event) => void uploadImage(event.target.files?.[0])} />
                </label>
                {feedbackImageProgress > 0 ? (
                  <div className="upload-progress">
                    <span>附件上传：{feedbackImageProgress}%</span>
                    <div className="upload-progress-track"><i style={{ width: `${feedbackImageProgress}%` }} /></div>
                  </div>
                ) : null}
              </div>
              <div className="feedback-form-preview">
                <div className="feedback-preview-avatar">
                  <img src={avatarUrl} alt="反馈头像预览" />
                </div>
                <div className="feedback-preview-copy">
                  <strong>{name || '姓名 / 昵称'}</strong>
                  <span>{subtitle || '头衔 / 年级'}</span>
                  <p>{content || '反馈内容预览'}</p>
                  {contact && <small>{contact}</small>}
                  {imageUrl && <img src={imageUrl} alt="反馈图片预览" className="feedback-preview-image" />}
                </div>
              </div>
              <div className="feedback-form-actions">
                <button className="button button-primary" onClick={() => void submit()} disabled={submitting}>
                  <Plus size={17} /> {submitting ? '提交中…' : '提交反馈'}
                </button>
                {notice && <span className="save-tip save-tip-success">{notice}</span>}
                {error && <span className="save-tip save-tip-error">{error}</span>}
              </div>
            </div>

            <div className="feedback-list">
              <SectionTitle align="left" eyebrow="云端展示墙" title="最近提交的家长与学生反馈" description="这里展示的是云端反馈库中的最新内容，会随提交自动刷新。" />
              <div className="feedback-list-meta">
                <span>{sourceLabel(source)}</span>
                <span>{loading ? '正在更新…' : `最新 ${entries.length} 条`}</span>
              </div>
              <div className="feedback-card-grid">
                {entries.map((entry) => (
                  <article className="feedback-card" key={entry.id}>
                    <div className="feedback-card-top">
                      <img src={entry.avatarUrl} alt={entry.name} />
                      <div>
                        <strong>{entry.name}</strong>
                        <span>{entry.subtitle}</span>
                      </div>
                      <span className="feedback-role-badge compact">
                        {entry.role === '家长' ? <Users size={15} /> : <School size={15} />}
                        <span>{entry.role}</span>
                      </span>
                    </div>
                    <p>{entry.content}</p>
                    {entry.imageUrl && <img src={entry.imageUrl} alt={entry.name} className="feedback-card-image" />}
                    <small>{new Date(entry.createdAt).toLocaleString('zh-CN')}</small>
                  </article>
                ))}
              </div>
              {entries.length === 0 && (
                <div className="feedback-empty">
                  <MessageSquareMore size={22} />
                  <strong>还没有反馈</strong>
                  <span>先在左侧提交第一条家长或学生反馈。</span>
                </div>
              )}
            </div>
          </div>
        </section>

        <section className="section soft-section">
          <div className="container">
            <SectionTitle eyebrow="提交建议" title="写出更像招生案例的反馈" description="建议直接写变化结果、学习场景和家长感受，内容会更有说服力。" />
            <div className="feedback-tip-grid">
              {[
                ['写变化', '比如“孩子开始主动开口读句子了”'],
                ['写场景', '比如“每天晚上会自己跟读 10 分钟”'],
                ['写结果', '比如“最近单词听写正确率明显提高”'],
              ].map(([title, text]) => (
                <article className="feedback-tip-card" key={title}>
                  <Sparkles size={18} />
                  <strong>{title}</strong>
                  <p>{text}</p>
                </article>
              ))}
            </div>
          </div>
        </section>
      </main>
    </div>
  )
}
