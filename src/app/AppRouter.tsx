import { Route, Routes } from 'react-router-dom'
import { ROUTES } from '../shared/constants/routes'
import { HomePage } from '../features/home/pages/HomePage'
import { LearnPage } from '../features/learning/pages/LearnPage'
import { CampusPage } from '../features/campus/pages/CampusPage'
import { FeedbackPage } from '../features/feedback/pages/FeedbackPage'
import { AdminPage } from '../features/admin/pages/AdminPage'
import { HonorGalleryPage } from '../features/honor/pages/HonorGalleryPage'

export function AppRouter() {
  return (
    <Routes>
      <Route path={ROUTES.home} element={<HomePage />} />
      <Route path={ROUTES.campus} element={<CampusPage />} />
      <Route path={ROUTES.feedback} element={<FeedbackPage />} />
      <Route path={ROUTES.honor} element={<HonorGalleryPage />} />
      <Route path={ROUTES.learn} element={<LearnPage />} />
      <Route path={ROUTES.admin} element={<AdminPage />} />
    </Routes>
  )
}
