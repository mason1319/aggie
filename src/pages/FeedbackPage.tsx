import { ArrowLeft, BadgeCheck, MessageSquareMore, Plus, School, Trash2, Users } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { AppHeader } from '../components/AppHeader'
import { SectionTitle } from '../components/SectionTitle'
import {
  addFeedbackEntry,
  getFeedbackLibrary,
  removeFeedbackEntry,
} from '../lib/storage'
import type { FeedbackEntry, FeedbackRole } from '../types'

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

export function FeedbackPage() {
  const [entries, setEntries] = useState<FeedbackEntry[]>(() => getFeedbackLibrary().entries)
  const [role, setRole] = useState<FeedbackRole>('家长')
  const [name, setName] = useState('')
  const [subtitle, setSubtitle] = useState('')
  const [content, setContent] = useState('')
  const [avatarUrl, setAvatarUrl] = useState(makeAvatarDataUrl('反馈', '#7bc8a4'))
  const [imageUrl, setImageUrl] = useState('')
  const [saveState, setSaveState] = useState<'idle' | 'saved'>('idle')

  useEffect(() => {
    const refresh = () => setEntries(getFeedbackLibrary().entries)
    window.addEventListener('storage', refresh)
    window.addEventListener('aggie-storage-change', refresh)
    return () => {
      window.removeEventListener('storage', refresh)
      window.removeEventListener('aggie-storage-change', refresh)
    }
  }, [])

  const summary = useMemo(() => ({
    parentCount: entries.filter((entry) => entry.role === '家长').length,
    studentCount: entries.filter((entry) => entry.role === '学生').length,
  }), [entries])

  const resetForm = () => {
    setRole('家长')
    setName('')
    setSubtitle('')
    setContent('')
    setAvatarUrl(makeAvatarDataUrl('反馈', '#7bc8a4'))
    setImageUrl('')
  }

  const submit = () => {
    if (!name.trim() || !content.trim()) return
    addFeedbackEntry({
      id: `feedback-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      role,
      name: name.trim(),
      subtitle: subtitle.trim() || (role === '家长' ? '家长反馈' : '学生反馈'),
      content: content.trim(),
      avatarUrl,
      imageUrl: imageUrl.trim() || undefined,
      createdAt: new Date().toISOString(),
    })
    setEntries(getFeedbackLibrary().entries)
    setSaveState('saved')
    window.setTimeout(() => setSaveState('idle'), 2000)
    resetForm()
  }

  const uploadAvatar = async (file: File | undefined) => {
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => setAvatarUrl(String(reader.result))
    reader.readAsDataURL(file)
  }

  const uploadImage = async (file: File | undefined) => {
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => setImageUrl(String(reader.result))
    reader.readAsDataURL(file)
  }

  return (
    <div className="feedback-page">
      <AppHeader />
      <main>
        <section className="feedback-hero">
          <div className="container feedback-hero-grid">
            <div>
              <span className="mini-label">家长与学生反馈</span>
              <h1>上传真实反馈，让招生页更有说服力</h1>
              <p>支持家长评价、学生学习感受、图片附件和头像展示。当前数据保存在本机浏览器中，便于先做内容设计和页面演示。</p>
              <div className="feedback-stats">
                <div><strong>{entries.length}</strong><span>条反馈</span></div>
                <div><strong>{summary.parentCount}</strong><span>家长反馈</span></div>
                <div><strong>{summary.studentCount}</strong><span>学生反馈</span></div>
              </div>
            </div>
            <div className="feedback-hero-card">
              <div className="feedback-hero-card-top">
                <BadgeCheck size={20} />
                <strong>反馈上传页</strong>
              </div>
              <p>可以直接上传“家长评价”“学生感受”，并作为官网素材展示。</p>
              <Link to="/" className="button button-primary full"><ArrowLeft size={17} /> 返回首页</Link>
            </div>
          </div>
        </section>

        <section className="section">
          <div className="container feedback-layout">
            <div className="feedback-form-card">
              <SectionTitle align="left" eyebrow="上传反馈" title="填写反馈内容并提交" description="可上传头像和图片，适合后续做招生展示。" />
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
                <label className="span-two">
                  头衔 / 年级
                  <input value={subtitle} onChange={(event) => setSubtitle(event.target.value)} placeholder="例如：三年级家长 / 五年级学生" />
                </label>
                <label className="span-two">
                  反馈内容
                  <textarea value={content} onChange={(event) => setContent(event.target.value)} placeholder="填写真实反馈内容" />
                </label>
                <label>
                  头像上传
                  <input type="file" accept="image/*" onChange={(event) => void uploadAvatar(event.target.files?.[0])} />
                </label>
                <label>
                  附图上传
                  <input type="file" accept="image/*" onChange={(event) => void uploadImage(event.target.files?.[0])} />
                </label>
              </div>
              <div className="feedback-form-preview">
                <div className="feedback-preview-avatar">
                  <img src={avatarUrl} alt="反馈头像预览" />
                </div>
                <div className="feedback-preview-copy">
                  <strong>{name || '姓名 / 昵称'}</strong>
                  <span>{subtitle || '头衔 / 年级'}</span>
                  <p>{content || '反馈内容预览'}</p>
                  {imageUrl && <img src={imageUrl} alt="反馈图片预览" className="feedback-preview-image" />}
                </div>
              </div>
              <div className="feedback-form-actions">
                <button className="button button-primary" onClick={submit}><Plus size={17} /> 提交反馈</button>
                {saveState === 'saved' && <span className="save-tip">已保存到本机</span>}
              </div>
            </div>

            <div className="feedback-list">
              <SectionTitle align="left" eyebrow="反馈展示" title="家长与学生的真实反馈" description="提交后会自动出现在这里，可用于招生页或机构页展示。" />
              <div className="feedback-card-grid">
                {entries.map((entry) => (
                  <article className="feedback-card" key={entry.id}>
                    <div className="feedback-card-top">
                      <img src={entry.avatarUrl} alt={entry.name} />
                      <div>
                        <strong>{entry.name}</strong>
                        <span>{entry.subtitle}</span>
                      </div>
                      <button className="icon-button" onClick={() => { removeFeedbackEntry(entry.id); setEntries(getFeedbackLibrary().entries) }} aria-label={`删除 ${entry.name}`}>
                        <Trash2 size={16} />
                      </button>
                    </div>
                    <div className="feedback-role-badge">
                      {entry.role === '家长' ? <Users size={15} /> : <School size={15} />}
                      <span>{entry.role}</span>
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
                  <span>先在左侧上传第一条家长或学生反馈。</span>
                </div>
              )}
            </div>
          </div>
        </section>
      </main>
    </div>
  )
}
