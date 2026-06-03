export type AdmissionStatus = '即将开始' | '报名中' | '已满'
export type CampaignKind = 'trial' | 'spring' | 'autumn'

export interface AdmissionCampaign {
  id: CampaignKind
  title: string
  eyebrow: string
  description: string
  grades: string
  lessons: string
  feature: string
  quota: string
  status: AdmissionStatus
  accent: string
  icon: string
}

export interface AdmissionSettings {
  activeSeason: 'spring' | 'autumn'
  campaigns: AdmissionCampaign[]
}
