export interface TeacherProfile {
  id: string
  name: string
  title: string
  intro: string
  teachingStyle: string
  avatarUrl: string
  accent: string
}

export interface EnvironmentPoint {
  id: string
  title: string
  description: string
  icon: string
}

export interface QualityHighlight {
  id: string
  title: string
  description: string
  quote: string
  accent: string
}

export interface TimetableEntry {
  id: string
  day: string
  startTime: string
  endTime: string
  className: string
  course: string
  teacher: string
  room: string
}

export interface InstitutionProfile {
  name: string
  address: string
  mapLatitude: string
  mapLongitude: string
  mapEmbedUrl: string
  mapLink: string
  mapNote: string
  surroundingsSummary: string
  promoVideoAssetIds: string[]
  nearbyPoints: EnvironmentPoint[]
  teachers: TeacherProfile[]
  qualityHighlights: QualityHighlight[]
  timetable: TimetableEntry[]
}
