import { X } from 'lucide-react'

interface WechatModalProps {
  open: boolean
  title?: string
  qrImageUrl?: string
  onClose: () => void
}

export function WechatModal({ open, title = '添加老师微信', qrImageUrl = '/wechat-qr-placeholder.svg', onClose }: WechatModalProps) {
  if (!open) return null

  return (
    <div className="modal-backdrop" role="presentation" onClick={onClose}>
      <div className="wechat-modal" role="dialog" aria-modal="true" aria-label={title} onClick={(event) => event.stopPropagation()}>
        <button className="modal-close" aria-label="关闭" onClick={onClose}><X size={20} /></button>
        <span className="mini-label">报名与咨询</span>
        <h2>{title}</h2>
        <p>扫描二维码添加老师微信，备注“孩子年级 + 想了解的课程”。</p>
        <img src={qrImageUrl} alt="微信二维码占位图" />
        <div className="modal-note">正式上线前，将此图片替换为老师微信二维码即可。</div>
      </div>
    </div>
  )
}
