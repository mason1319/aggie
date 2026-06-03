import { ArrowLeft, ArrowRight, Image } from 'lucide-react'
import { Link } from 'react-router-dom'
import { useEffect, useState } from 'react'
import { AppHeader } from '../../../shared/components/AppHeader'
import { SectionTitle } from '../../../shared/components/SectionTitle'
import { ROUTES } from '../../../shared/constants/routes'
import { loadHonorGallery, type HonorGalleryItem } from '../../../shared/services/imageUpload'

export function HonorGalleryPage() {
  const [honorPhotos, setHonorPhotos] = useState<HonorGalleryItem[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const refreshHonorGallery = async () => {
    setLoading(true)
    setError('')
    try {
      const list = await loadHonorGallery()
      setHonorPhotos(list)
    } catch {
      setError('荣誉墙配置读取失败，请返回后重试。')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void refreshHonorGallery()
  }, [])

  return (
    <>
      <AppHeader />
      <main>
        <section className="section">
          <div className="container">
            <div className="section-inline-head">
              <div>
                <SectionTitle
                  eyebrow="机构风采"
                  title="荣誉展示"
                  description="上传到后台的荣誉照片统一展示于此。"
                />
              </div>
              <div className="feedback-hero-actions">
                <Link to={ROUTES.home} className="button button-ghost">
                  <ArrowLeft size={16} /> 返回首页
                </Link>
                <button className="button button-primary" onClick={() => void refreshHonorGallery()}>
                  <Image size={16} /> 刷新风采图
                </button>
              </div>
            </div>

            {loading ? (
              <div className="admin-upload-note">正在加载机构风采…</div>
            ) : error ? (
              <div className="admin-upload-error">{error}</div>
            ) : honorPhotos.length > 0 ? (
              <div className="honor-gallery-grid">
                {honorPhotos.map((photo) => (
                  <article className="honor-photo-card" key={photo.id}>
                    <img src={photo.url} alt={photo.name} />
                    <div className="honor-photo-caption">
                      <strong>{photo.title || photo.name}</strong>
                      <span>{photo.desc || '荣誉照片'}</span>
                    </div>
                  </article>
                ))}
              </div>
            ) : (
              <div className="promo-video-empty honor-photo-empty" role="status">
                <strong>暂未上传荣誉图片</strong>
                <span>请先在后台上传后刷新即可显示。</span>
                <div className="feedback-hero-actions">
                  <Link to={ROUTES.admin} className="text-link">
                    进入后台上传 <ArrowRight size={16} />
                  </Link>
                </div>
              </div>
            )}
          </div>
        </section>
      </main>
    </>
  )
}
