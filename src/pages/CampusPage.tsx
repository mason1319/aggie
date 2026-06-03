import {
  ArrowLeft, ArrowRight, CheckCircle2, CalendarDays, Copy, MapPinned, MessageCircle, ParkingCircle,
  Quote, School, ShieldCheck, Star, TrainFront, UsersRound,
} from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { AppHeader } from '../components/AppHeader'
import { SectionTitle } from '../components/SectionTitle'
import { WechatModal } from '../components/WechatModal'
import { getInstitutionProfile, getMediaAsset } from '../lib/storage'
import type { InstitutionProfile, MediaAsset } from '../types'

function iconByName(name: string) {
  switch (name) {
    case 'parking':
      return <ParkingCircle size={18} />
    case 'metro':
      return <TrainFront size={18} />
    case 'shield':
      return <ShieldCheck size={18} />
    default:
      return <UsersRound size={18} />
  }
}

function buildAmapNavigationUrl(institution: InstitutionProfile) {
  const latitude = institution.mapLatitude.trim()
  const longitude = institution.mapLongitude.trim()
  if (latitude && longitude) {
    return `https://uri.amap.com/navigation?from=&to=${longitude},${latitude},${encodeURIComponent(institution.name)}&mode=car&policy=1&src=mypage`
  }
  return `https://uri.amap.com/search?keyword=${encodeURIComponent(institution.address || institution.name)}&view=map&src=mypage&callnative=0`
}

function buildAmapNearbyUrl(institution: InstitutionProfile) {
  const latitude = institution.mapLatitude.trim()
  const longitude = institution.mapLongitude.trim()
  const keyword = encodeURIComponent(institution.name)
  if (latitude && longitude) {
    return `https://uri.amap.com/search?keyword=${keyword}&center=${longitude},${latitude}&view=map&src=mypage&callnative=0`
  }
  return `https://uri.amap.com/search?keyword=${keyword}&view=map&src=mypage&callnative=0`
}

export function CampusPage() {
  const [institution, setInstitution] = useState<InstitutionProfile>(() => getInstitutionProfile())
  const [modalOpen, setModalOpen] = useState(false)
  const [modalTitle, setModalTitle] = useState('咨询机构详情')
  const [copyLabel, setCopyLabel] = useState('复制地址')
  const campusVideos = institution.promoVideoAssetIds
    .map((assetId) => getMediaAsset(assetId))
    .filter((asset): asset is MediaAsset => asset !== undefined && asset.kind === 'video')

  useEffect(() => {
    const refresh = () => setInstitution(getInstitutionProfile())
    window.addEventListener('storage', refresh)
    window.addEventListener('aggie-storage-change', refresh)
    return () => {
      window.removeEventListener('storage', refresh)
      window.removeEventListener('aggie-storage-change', refresh)
    }
  }, [])

  const copyAddress = async () => {
    try {
      await navigator.clipboard.writeText(institution.address)
      setCopyLabel('已复制')
      window.setTimeout(() => setCopyLabel('复制地址'), 1600)
    } catch {
      setCopyLabel('复制失败')
      window.setTimeout(() => setCopyLabel('复制地址'), 1600)
    }
  }

  return (
    <>
      <AppHeader onContact={() => { setModalTitle('咨询机构详情'); setModalOpen(true) }} />
      <main className="campus-page">
        <section className="campus-hero">
          <div className="container campus-hero-grid">
            <div>
              <span className="mini-label">机构展示</span>
              <h1>{institution.name}</h1>
              <p>师资、地址、周边环境、教学质量与周课表集中展示，家长一眼看懂机构实力。</p>
              <div className="campus-hero-actions">
                <button className="button button-primary" onClick={() => { setModalTitle('预约机构咨询'); setModalOpen(true) }}>
                  微信咨询 <MessageCircle size={18} />
                </button>
                <Link className="button button-ghost" to="/"><ArrowLeft size={18} /> 返回首页</Link>
              </div>
            </div>
            <div className="campus-hero-panel">
              <div className="campus-hero-panel-top">
                <span><MapPinned size={18} /> 地址</span>
                <strong>{institution.address}</strong>
              </div>
              <div className="campus-hero-panel-bottom">
                <span><Star size={17} /> 教学质量</span>
                <p>{institution.qualityHighlights[0]?.description}</p>
              </div>
            </div>
          </div>
        </section>

        <section className="section" id="teachers">
          <div className="container">
            <SectionTitle eyebrow="师资展示" title="照片、姓名、简介、教学特点" description="公开展示教学团队，让家长清楚知道是谁在教、怎么教。" />
            <div className="teacher-grid">
              {institution.teachers.map((teacher) => (
                <article className="teacher-card" key={teacher.id}>
                  <img src={teacher.avatarUrl} alt={teacher.name} />
                  <div className="teacher-content">
                    <span className="teacher-badge" style={{ color: teacher.accent, background: `${teacher.accent}18` }}>{teacher.title}</span>
                    <h3>{teacher.name}</h3>
                    <p>{teacher.intro}</p>
                    <div className="teacher-note">
                      <CheckCircle2 size={16} />
                      <span>{teacher.teachingStyle}</span>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="section soft-section" id="videos">
          <div className="container">
            <SectionTitle eyebrow="机构视频" title="宣传视频、课堂片段、家长说明可批量展示" description="支持上传多条视频，不再固定成单一视频卡片。" />
            <div className="video-count-bar">
              <strong>{campusVideos.length}</strong>
              <span>条视频素材</span>
            </div>
            <div className="promo-video-grid">
              {campusVideos.length > 0 ? campusVideos.map((video) => (
                <article className="promo-video-card" key={video.id}>
                  <video controls playsInline src={video.dataUrl} />
                  <div className="promo-video-copy">
                    <strong>{video.name}</strong>
                    <span>上传时间：{new Date(video.createdAt).toLocaleDateString('zh-CN')}</span>
                  </div>
                </article>
              )) : (
                <div className="promo-video-empty">
                  <strong>还没有视频</strong>
                  <span>在后台批量上传后，这里会展示多条机构视频。</span>
                </div>
              )}
            </div>
          </div>
        </section>

        <section className="section campus-map-section" id="environment">
          <div className="container campus-map-layout">
            <div>
              <SectionTitle align="left" eyebrow="机构地址" title="地址 + 一键导航 + 周边搜索" description="更像招生机构官网的高德地图展示：先看地址，再一键导航，顺手看周边环境。" />
              <div className="campus-map-shell">
                <div className="campus-map-visual">
                  <div className="campus-map-badge">高德地图</div>
                  <div className="campus-map-pin campus-map-pin-a" />
                  <div className="campus-map-pin campus-map-pin-b" />
                  <div className="campus-map-ribbon">周边环境 / 接送方便 / 停车便利</div>
                </div>
                <div className="campus-map-card">
                  <div className="campus-map-card-top">
                    <span><MapPinned size={18} /> 机构地址</span>
                    <strong>{institution.address}</strong>
                    <p>{institution.mapNote}</p>
                  </div>
                  <div className="campus-map-actions">
                    <a className="button button-primary full" href={buildAmapNavigationUrl(institution)} target="_blank" rel="noreferrer">
                      一键导航 <ArrowRight size={17} />
                    </a>
                    <a className="button button-ghost full" href={buildAmapNearbyUrl(institution)} target="_blank" rel="noreferrer">
                      周边搜索 <ArrowRight size={17} />
                    </a>
                    <button className="button button-ghost full" onClick={copyAddress}>
                      <Copy size={17} /> {copyLabel}
                    </button>
                  </div>
                  <div className="campus-map-tags">
                    <span>地铁可达</span>
                    <span>停车方便</span>
                    <span>家长接送</span>
                  </div>
                </div>
              </div>
            </div>
            <div className="campus-info-stack">
              <div className="campus-info-card">
                <span className="mini-label">详细地址</span>
                <h3>{institution.address}</h3>
                <p>{institution.mapNote}</p>
              </div>
              <div className="campus-info-card">
                <span className="mini-label">机构周边</span>
                <p>{institution.surroundingsSummary}</p>
                <div className="surrounding-grid">
                  {institution.nearbyPoints.map((point) => (
                    <div className="surrounding-item" key={point.id}>
                      <div className="surrounding-icon">{iconByName(point.icon)}</div>
                      <strong>{point.title}</strong>
                      <span>{point.description}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="section soft-section" id="quality">
          <div className="container">
            <SectionTitle eyebrow="教学质量" title="学习成果、家长反馈、进步案例、课堂亮点" description="用真实课堂与家长反馈来呈现教学效果，不靠空话。" />
            <div className="quality-grid">
              {institution.qualityHighlights.map((item) => (
                <article className="quality-card" key={item.id} style={{ '--quality-accent': item.accent } as React.CSSProperties}>
                  <div className="quality-card-top">
                    <span><Quote size={18} /></span>
                    <strong>{item.title}</strong>
                  </div>
                  <p>{item.description}</p>
                  <blockquote>{item.quote}</blockquote>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="section" id="schedule">
          <div className="container">
            <SectionTitle eyebrow="课程表" title="按星期、时间、班型展示周课表" description="家长可以直接看出哪天上什么课，方便安排接送与试听。" />
            <div className="timetable-card">
              <div className="timetable-grid timetable-head">
                <span>星期</span><span>时间</span><span>班型</span><span>课程内容</span><span>老师</span><span>教室</span>
              </div>
              {institution.timetable.map((entry) => (
                <div className="timetable-grid" key={entry.id}>
                  <strong>{entry.day}</strong>
                  <span>{entry.startTime} - {entry.endTime}</span>
                  <span>{entry.className}</span>
                  <span>{entry.course}</span>
                  <span>{entry.teacher}</span>
                  <span>{entry.room}</span>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="section final-cta">
          <div className="container">
            <div className="cta-card">
              <div>
                <span className="mini-label">预约试听与咨询</span>
                <h2>想看师资、地址和课表，先加微信更直接</h2>
                <p>家长可以把孩子年级、想试听的课程和时间告诉老师。</p>
              </div>
              <button className="button button-light" onClick={() => { setModalTitle('预约试听与咨询'); setModalOpen(true) }}>
                微信咨询 <MessageCircle size={19} />
              </button>
            </div>
          </div>
        </section>
      </main>
      <WechatModal open={modalOpen} title={modalTitle} onClose={() => setModalOpen(false)} />
    </>
  )
}
