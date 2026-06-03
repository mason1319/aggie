import {
  ArrowRight, ArrowUpRight, BadgeCheck, BookOpenCheck, Brain, CalendarDays, Check, ChevronRight,
  Ear, Headphones, Image, Leaf, MapPinned, MessageCircle, Mic2, PencilLine, Play, School,
  Sparkles, Sprout, Star, UsersRound, Volume2,
} from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { AppHeader } from '../../../shared/components/AppHeader'
import { SectionTitle } from '../../../shared/components/SectionTitle'
import { WechatModal } from '../../../shared/components/WechatModal'
import { CAMPUS_ANCHORS, ROUTE, ROUTES } from '../../../shared/constants/routes'
import { useContentBundle } from '../../../shared/data-source'
import { getMediaAsset } from '../../../shared/services/storage'
import { FEEDBACK_SYNC_INTERVAL_MS, loadFeedbackEntries } from '../../../shared/services/feedbackApi'
import type { AdmissionCampaign } from '../../../shared/types/admission'
import type { FeedbackEntry } from '../../../shared/types/feedback'
import type { MediaAsset } from '../../../shared/types/media'

const methods = [
  { icon: Image, title: '图片联想记忆', text: '把抽象单词变成生动画面，理解以后更容易记住。', color: 'mint' },
  { icon: Volume2, title: '标准发音跟读', text: '听、读、看同步进行，从一开始就建立正确发音。', color: 'yellow' },
  { icon: Brain, title: '趣味闯关练习', text: '看图、听音、拼写多种练习，及时巩固不容易忘。', color: 'peach' },
  { icon: BookOpenCheck, title: '课内同步提升', text: '围绕课堂常见主题学习，让校内英语更有底气。', color: 'blue' },
]

const featureCards = [
  { icon: Ear, title: '听英语句子', text: '听得懂，读得好' },
  { icon: Mic2, title: '单词跟读练', text: '多开口，纠发音' },
  { icon: PencilLine, title: '单词听写测', text: '拼得对，记得牢' },
  { icon: Star, title: '单词消消乐', text: '游戏化，趣味学' },
]

function CampaignIcon({ campaign }: { campaign: AdmissionCampaign }) {
  if (campaign.icon === 'sprout') return <Sprout />
  if (campaign.icon === 'leaf') return <Leaf />
  return <Sparkles />
}

export function HomePage() {
  const [modalOpen, setModalOpen] = useState(false)
  const [modalTitle, setModalTitle] = useState('添加老师微信')
  const { bundle } = useContentBundle()
  const [feedbackEntries, setFeedbackEntries] = useState<FeedbackEntry[]>(() => bundle.feedback.entries.slice(0, 3))
  const [feedbackSource, setFeedbackSource] = useState<'cloud' | 'cache' | 'offline'>('cache')
  const { admission: settings, institution, courses } = bundle

  useEffect(() => {
    const syncFeedback = async () => {
      const result = await loadFeedbackEntries()
      setFeedbackEntries(result.entries.slice(0, 3))
      setFeedbackSource(result.source)
    }
    void syncFeedback()
    const interval = window.setInterval(() => { void syncFeedback() }, FEEDBACK_SYNC_INTERVAL_MS)
    return () => {
      window.clearInterval(interval)
    }
  }, [])

  const activeCampaign = useMemo(
    () => settings.campaigns.find((campaign: AdmissionCampaign) => campaign.id === settings.activeSeason),
    [settings],
  )
  const promoVideos = useMemo(
    () => institution.promoVideoAssetIds
      .map((assetId) => getMediaAsset(assetId))
      .filter((asset): asset is MediaAsset => asset !== undefined && asset.kind === 'video'),
    [institution.promoVideoAssetIds],
  )

  const openContact = (title = '添加老师微信') => {
    setModalTitle(title)
    setModalOpen(true)
  }

  return (
    <>
      <AppHeader onContact={() => openContact()} />
      <main>
        <section className="hero">
          <div className="hero-orb orb-one" />
          <div className="hero-orb orb-two" />
          <div className="container hero-grid">
            <div className="hero-copy">
              <div className="hero-badge"><Sparkles size={16} /> 专为小学生设计的英语学习方法</div>
              <h1>听得懂，读得准，<br /><span>记得牢</span></h1>
              <p>从国际音标、自然拼读到课内同步，用图片、声音和趣味练习，帮助孩子建立真正能用的英语能力。</p>
              <div className="hero-actions">
                <button className="button button-primary" onClick={() => openContact('预约免费英语体验课')}>
                  免费体验课 <ArrowRight size={18} />
                </button>
                <Link className="button button-ghost" to={ROUTES.learn}>
                  <Play size={18} fill="currentColor" /> 立即体验学习
                </Link>
              </div>
              <div className="hero-points">
                <span><Check size={16} /> 适合小学阶段</span>
                <span><Check size={16} /> 学练一体</span>
                <span><Check size={16} /> 趣味不枯燥</span>
              </div>
            </div>
            <div className="hero-visual">
              <div className="visual-card main-word-card">
                <div className="word-card-top">
                  <span className="word-pill">今日单词</span>
                  <button aria-label="播放发音"><Volume2 size={20} /></button>
                </div>
                <div className="hero-word">sun</div>
                <div className="hero-phonetic">/sʌn/</div>
                <div className="sun-illustration">
                  <span className="sun-core">☀️</span>
                  <span className="cloud cloud-a">☁</span>
                  <span className="cloud cloud-b">☁</span>
                </div>
                <div className="word-meaning">太阳 · The sun is warm.</div>
              </div>
              <div className="floating-card float-a"><Headphones size={20} /><span>听音辨词</span></div>
              <div className="floating-card float-b"><BadgeCheck size={20} /><span>已掌握 86%</span></div>
              <div className="floating-card float-c"><Star size={20} /><span>连续学习 7 天</span></div>
            </div>
          </div>
        </section>

        <section className="trust-strip">
          <div className="container trust-grid">
            <div><strong>5</strong><span>大课程体系</span></div>
            <div><strong>4</strong><span>类趣味练习</span></div>
            <div><strong>1</strong><span>套科学记忆方法</span></div>
            <div><strong>每天</strong><span>进步一点点</span></div>
          </div>
        </section>

        <section className="section" id="courses">
          <div className="container">
            <SectionTitle eyebrow="课程体系" title="从发音基础到课内提升" description="不同阶段有不同重点，让孩子循序渐进地学会英语。" />
            <div className="course-grid">
              {courses.map((course) => (
                <Link to={ROUTES.learn} className={`course-card tone-${course.tone}`} key={course.id}>
                  <div className="course-icon">{course.icon}</div>
                  <div>
                    <h3>{course.title}</h3>
                    <strong>{course.subtitle}</strong>
                    <p>{course.description}</p>
                  </div>
                  <span className="course-arrow"><ChevronRight size={20} /></span>
                </Link>
              ))}
            </div>
          </div>
        </section>

        <section className="section soft-section">
          <div className="container">
            <SectionTitle eyebrow="为什么记得牢" title="不是死记硬背，是有方法地学" description="调动眼睛、耳朵、嘴巴和大脑，多感官参与，记忆更深刻。" />
            <div className="method-grid">
              {methods.map(({ icon: Icon, title, text, color }) => (
                <div className="method-card" key={title}>
                  <div className={`method-icon ${color}`}><Icon size={25} /></div>
                  <h3>{title}</h3>
                  <p>{text}</p>
                </div>
              ))}
            </div>
            <div className="learning-path">
              <div className="path-copy">
                <span className="mini-label">学练一体</span>
                <h2>一个单词，多种方式反复遇见</h2>
                <p>先看图理解，再听音跟读，然后通过选择和拼写巩固。每一次练习都在帮助孩子把知识变成长期记忆。</p>
                <Link to={ROUTES.learn} className="text-link">体验完整学习流程 <ArrowRight size={17} /></Link>
              </div>
              <div className="path-steps">
                {[
                  ['01', '看图理解', '建立单词与画面的联系'],
                  ['02', '听音跟读', '熟悉标准发音和节奏'],
                  ['03', '趣味练习', '在互动中及时巩固'],
                  ['04', '错词复习', '针对薄弱内容反复练'],
                ].map(([number, title, text]) => (
                  <div className="path-step" key={number}>
                    <span>{number}</span><div><strong>{title}</strong><p>{text}</p></div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        <section className="section">
          <div className="container">
            <SectionTitle eyebrow="功能体验" title="把英语学习变成孩子愿意做的事" />
            <div className="feature-showcase">
              <div className="phone-mockup">
                <div className="phone-top"><span /><strong>Aggie学习</strong><span /></div>
                <div className="phone-progress"><span>今日进度</span><strong>4 / 6</strong><div><i /></div></div>
                <div className="phone-card">
                  <span className="phone-emoji">🏫</span>
                  <h3>school</h3>
                  <p>/skuːl/</p>
                  <button><Volume2 size={18} /> 点击发音</button>
                </div>
                <div className="phone-options"><span>学校</span><span>教室</span></div>
              </div>
              <div className="feature-copy">
                <h2>听、说、读、写，<br />每一步都有反馈</h2>
                <p>孩子可以自主完成学习和练习，家长也能看到学习进度和需要复习的内容。</p>
                <div className="feature-card-grid">
                  {featureCards.map(({ icon: Icon, title, text }) => (
                    <div className="mini-feature-card" key={title}>
                      <Icon size={20} /><div><strong>{title}</strong><span>{text}</span></div>
                    </div>
                  ))}
                </div>
                <Link to={ROUTES.learn} className="button button-primary">现在开始体验 <ArrowRight size={18} /></Link>
              </div>
            </div>
          </div>
        </section>

        <section className="section soft-section">
          <div className="container">
            <SectionTitle eyebrow="机构视频" title="上传你自己的宣传视频与课堂片段" description="后台支持批量上传，首页自动展示多条视频素材。" />
            <div className="promo-video-grid">
              {promoVideos.length > 0 ? promoVideos.map((video) => (
                <article className="promo-video-card" key={video.id}>
                  <video controls playsInline src={video.dataUrl} />
                  <div className="promo-video-copy">
                    <strong>{video.name}</strong>
                    <span>来自后台上传的视频素材</span>
                  </div>
                </article>
              )) : (
                <div className="promo-video-empty">
                  <strong>还没有上传视频</strong>
                  <span>进入后台上传招生宣传视频、课堂花絮或家长说明视频后，这里会自动显示。</span>
                </div>
              )}
            </div>
            <div className="section-spacer" />
            <div className="section-inline-head">
              <div>
                <h3>家长与学生反馈</h3>
                <p>真实反馈可在独立页面上传并展示，支持图片和头像。当前同步状态：{feedbackSource === 'cloud' ? '云端已同步' : feedbackSource === 'cache' ? '本机缓存' : '离线缓存'}</p>
              </div>
              <Link to={ROUTES.feedback} className="text-link">打开反馈上传页 <ArrowRight size={17} /></Link>
            </div>
            <div className="feedback-preview-grid">
              {feedbackEntries.map((entry) => (
                <article className="feedback-preview-card" key={entry.id}>
                  <div className="feedback-preview-top">
                    <img src={entry.avatarUrl} alt={entry.name} />
                    <div>
                      <strong>{entry.name}</strong>
                      <span>{entry.subtitle}</span>
                    </div>
                    <span className="feedback-role">{entry.role}</span>
                  </div>
                  <p>{entry.content}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="section campus-overview-section" id="campus">
          <div className="container">
            <SectionTitle eyebrow="机构展示" title="师资、地址、周边和课表，一页看懂" description="首页先看概览，点击进入详情页查看更多师资照片、地图与课程安排。" />
            <div className="campus-overview-grid">
              <div className="campus-main-card">
                <div className="campus-main-copy">
                  <span className="mini-label">师资展示</span>
                  <h2>{institution.teachers[0]?.name} 带你了解机构教学团队</h2>
                  <p>{institution.teachers[0]?.intro}</p>
                  <div className="campus-mini-teachers">
                    {institution.teachers.slice(0, 3).map((teacher) => (
                      <div className="campus-mini-teacher" key={teacher.id}>
                        <img src={teacher.avatarUrl} alt={teacher.name} />
                        <div>
                          <strong>{teacher.name}</strong>
                          <span>{teacher.title}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
                <Link to={ROUTE.campusWithHash(CAMPUS_ANCHORS.teachers)} className="button button-primary">
                  查看师资详情 <ArrowUpRight size={17} />
                </Link>
              </div>
              <div className="campus-side-grid">
                <Link to={ROUTE.campusWithHash(CAMPUS_ANCHORS.environment)} className="campus-overview-tile">
                  <MapPinned size={22} />
                  <strong>机构地址与地图</strong>
                  <span>{institution.address}</span>
                </Link>
                <Link to={ROUTE.campusWithHash(CAMPUS_ANCHORS.environment)} className="campus-overview-tile">
                  <UsersRound size={22} />
                  <strong>周边环境</strong>
                  <span>{institution.surroundingsSummary}</span>
                </Link>
                <Link to={ROUTE.campusWithHash(CAMPUS_ANCHORS.quality)} className="campus-overview-tile">
                  <School size={22} />
                  <strong>教学质量</strong>
                  <span>{institution.qualityHighlights[0]?.description}</span>
                </Link>
                <Link to={ROUTE.campusWithHash(CAMPUS_ANCHORS.schedule)} className="campus-overview-tile">
                  <CalendarDays size={22} />
                  <strong>周课表</strong>
                  <span>{institution.timetable[0]?.day} {institution.timetable[0]?.startTime} · {institution.timetable[0]?.className}</span>
                </Link>
              </div>
            </div>
          </div>
        </section>

        <section className="section admission-section" id="admissions">
          <div className="container">
            <SectionTitle eyebrow="招生报名" title="选择适合孩子的英语成长计划" description="先体验，再报课。所有班型均可通过微信咨询具体时间与安排。" />
            {activeCampaign && (
              <div className="active-season-banner">
                <div><Sparkles size={20} /><span>当前重点招生</span><strong>{activeCampaign.title}</strong></div>
                <button onClick={() => openContact(`咨询${activeCampaign.title}`)}>立即咨询 <ArrowRight size={17} /></button>
              </div>
            )}
            <div className="admission-grid">
              {settings.campaigns.map((campaign: AdmissionCampaign) => {
                const isActive = campaign.id === 'trial' || campaign.id === settings.activeSeason
                return (
                  <article className={`admission-card ${isActive ? 'featured' : ''}`} key={campaign.id} style={{ '--campaign-accent': campaign.accent } as React.CSSProperties}>
                    <div className="admission-card-head">
                      <div className="campaign-icon"><CampaignIcon campaign={campaign} /></div>
                      <span className={`status status-${campaign.status}`}>{campaign.status}</span>
                    </div>
                    <span className="campaign-eyebrow">{campaign.eyebrow}</span>
                    <h3>{campaign.title}</h3>
                    <p>{campaign.description}</p>
                    <div className="campaign-details">
                      <span><Check size={16} /> {campaign.grades}</span>
                      <span><Check size={16} /> {campaign.lessons}</span>
                      <span><Check size={16} /> {campaign.feature}</span>
                      <span><Check size={16} /> {campaign.quota}</span>
                    </div>
                    <button className={isActive ? 'button button-primary full' : 'button button-outline full'} onClick={() => openContact(`${campaign.title}报名咨询`)}>
                      {campaign.id === 'trial' ? '预约体验课' : '微信咨询报课'} <ArrowRight size={17} />
                    </button>
                  </article>
                )
              })}
            </div>
          </div>
        </section>

        <section className="section final-cta">
          <div className="container">
            <div className="cta-card">
              <div>
                <span className="mini-label">让孩子爱上英语学习</span>
                <h2>从一次轻松、有趣的体验课开始</h2>
                <p>添加老师微信，告诉我们孩子的年级和英语学习情况。</p>
              </div>
              <button className="button button-light" onClick={() => openContact('预约免费英语体验课')}>
                <MessageCircle size={19} /> 免费预约体验
              </button>
            </div>
          </div>
        </section>
      </main>

      <footer className="site-footer">
        <div className="container footer-inner">
          <div className="brand footer-brand"><span className="brand-mark"><BookOpenCheck size={21} /></span><span><strong>Aggie速记英语</strong><small>听得懂 · 读得准 · 记得牢</small></span></div>
          <div className="footer-links">
            <Link to={ROUTES.learn}>学习体验</Link>
            <Link to={ROUTES.campus}>机构展示</Link>
            <Link to={ROUTES.admin}>招生管理</Link>
            <button onClick={() => openContact()}>微信咨询</button>
          </div>
          <p>© 2026 Aggie速记英语 · 首版为本地体验项目</p>
        </div>
      </footer>
      <WechatModal
        open={modalOpen}
        title={modalTitle}
        qrImageUrl={bundle.contact.wechatQrImageUrl}
        onClose={() => setModalOpen(false)}
      />
    </>
  )
}
