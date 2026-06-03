import { BookOpen, Menu, X } from 'lucide-react'
import { useState } from 'react'
import { Link, NavLink } from 'react-router-dom'
import { HOME_ANCHORS, ROUTE, ROUTES } from '../constants/routes'

interface AppHeaderProps {
  onContact?: () => void
}

export function AppHeader({ onContact }: AppHeaderProps) {
  const [open, setOpen] = useState(false)

  const close = () => setOpen(false)

  return (
    <header className="site-header">
      <div className="container header-inner">
        <Link to={ROUTES.home} className="brand" onClick={close}>
          <span className="brand-mark"><BookOpen size={22} /></span>
          <span>
            <strong>Aggie速记英语</strong>
            <small>让英语学习更轻松</small>
          </span>
        </Link>
        <button className="menu-toggle" aria-label="切换菜单" onClick={() => setOpen(!open)}>
          {open ? <X /> : <Menu />}
        </button>
        <nav className={open ? 'site-nav open' : 'site-nav'}>
          <NavLink to={ROUTES.home} onClick={close}>首页</NavLink>
          <a href={ROUTE.homeWithHash(HOME_ANCHORS.courses)} onClick={close}>课程体系</a>
          <NavLink to={ROUTES.campus} onClick={close}>机构展示</NavLink>
          <a href={ROUTE.homeWithHash(HOME_ANCHORS.admissions)} onClick={close}>招生报名</a>
          <NavLink to={ROUTES.learn} onClick={close}>学习体验</NavLink>
          <NavLink to={ROUTES.feedback} onClick={close}>反馈上传</NavLink>
          <button className="button button-small button-primary" onClick={() => { close(); onContact?.() }}>
            微信咨询
          </button>
        </nav>
      </div>
    </header>
  )
}
