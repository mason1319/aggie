export const ROUTES = {
  home: '/',
  campus: '/campus',
  feedback: '/feedback',
  learn: '/learn',
  admin: '/admin',
} as const

export const CAMPUS_ANCHORS = {
  teachers: 'teachers',
  videos: 'videos',
  environment: 'environment',
  quality: 'quality',
  schedule: 'schedule',
} as const

export const HOME_ANCHORS = {
  courses: 'courses',
  admissions: 'admissions',
  campus: 'campus',
} as const

export const ROUTE = {
  ...ROUTES,
  homeWithHash: (hash: string) => `${ROUTES.home}#${hash}`,
  learnWithHash: (hash: string) => `${ROUTES.learn}#${hash}`,
  campusWithHash: (hash: string) => `${ROUTES.campus}#${hash}`,
  feedbackWithHash: (hash: string) => `${ROUTES.feedback}#${hash}`,
  adminWithHash: (hash: string) => `${ROUTES.admin}#${hash}`,
} as const

export type RouteKey = keyof typeof ROUTES
