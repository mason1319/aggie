import type {
  InstitutionProfile,
  QualityHighlight,
  TeacherProfile,
} from '../types/institution'

function makeAvatarDataUrl(label: string, accent: string) {
  const svg = `
    <svg width="240" height="240" viewBox="0 0 240 240" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="g" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="${accent}" stop-opacity="0.95"/>
          <stop offset="100%" stop-color="#ffffff" stop-opacity="0.9"/>
        </linearGradient>
      </defs>
      <rect width="240" height="240" rx="32" fill="url(#g)"/>
      <circle cx="120" cy="98" r="48" fill="#fff" fill-opacity="0.72"/>
      <circle cx="120" cy="92" r="28" fill="#173f35" fill-opacity="0.18"/>
      <path d="M72 198c12-33 84-33 96 0" fill="#fff" fill-opacity="0.72"/>
      <text x="120" y="210" font-family="Arial, sans-serif" font-size="28" font-weight="700" text-anchor="middle" fill="#173f35">${label}</text>
    </svg>
  `
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`
}

const teachers: TeacherProfile[] = [
  {
    id: 'teacher-amy',
    name: 'Ageie胡老师',
    title: '新概念与综合英语主讲',
    intro: 'Ageie胡老师曾任职昆山少年宫英语特聘教师，英语高级教师。深耕英语教育领域10年，教学十年间教了超2000名学生，专攻新概念英语+译林英语综合教学小学部:80%孩子成绩常年稳居班级前五，年级排名前100，校内英语举一反三初中部:胡老师凭借新概念英语提优体系，打造初二提招班，中考英语升学率达到80%以上，中考成绩115+。通过系统化的知识点拓展与能力训练，让众多学生考上心仪的高中。扎实的教学功底深受学生和家长的喜爱与信赖。',
    teachingStyle: '专注提升听说读写综合能力，强调语音识别、句式迁移和错题复盘，帮助孩子形成稳定进步。',
    avatarUrl: makeAvatarDataUrl('A', '#7bc8a4'),
    accent: '#7bc8a4',
  },
  {
    id: 'teacher-lily',
    name: 'Lily 老师',
    title: '课内同步与阅读训练',
    intro: '熟悉小学英语课堂节奏，把课内词汇、句子和阅读训练串成完整学习路径。',
    teachingStyle: '强调复习节奏和错词巩固，帮助孩子把学过的内容真正留住。',
    avatarUrl: makeAvatarDataUrl('L', '#f6c95b'),
    accent: '#f6c95b',
  },
  {
    id: 'teacher-mike',
    name: 'Mike 老师',
    title: '新概念与口语表达',
    intro: '擅长通过句子跟读、情景对话和小任务，提升孩子的开口自信与表达欲望。',
    teachingStyle: '把学习拆成小步骤，先听懂、再模仿、最后输出。',
    avatarUrl: makeAvatarDataUrl('M', '#78b9eb'),
    accent: '#78b9eb',
  },
]

const qualityHighlights: QualityHighlight[] = [
  {
    id: 'quality-feedback',
    title: '家长反馈',
    description: '家长最常说的是：孩子开始愿意主动开口，做英语作业不再拖拉。',
    quote: '“以前总要催，现在会自己先读一遍再做题，发音也比以前稳很多。”',
    accent: '#7bc8a4',
  },
  {
    id: 'quality-results',
    title: '学习成果',
    description: '通过看图、跟读、拼写和错词复习，帮助孩子把“记住”变成“会用”。',
    quote: '“孩子把学过的单词放进句子里能更快说出来，不是只会认单词。”',
    accent: '#f6c95b',
  },
  {
    id: 'quality-classroom',
    title: '课堂亮点',
    description: '每节课都有示范、练习和反馈，学习节奏紧凑但不压迫，孩子更愿意坚持。',
    quote: '“课堂上孩子会自己抢着回答，回家还会把音频再听两遍。”',
    accent: '#78b9eb',
  },
]

export const defaultInstitutionProfile: InstitutionProfile = {
  name: 'Aggie速记英语',
  address: '请在后台填写机构正式地址',
  mapLatitude: '',
  mapLongitude: '',
  mapEmbedUrl: 'https://uri.amap.com/search?keyword=Aggie%E9%80%9F%E8%AE%B0%E8%8B%B1%E8%AF%AD&view=map&src=mypage&callnative=0',
  mapLink: 'https://uri.amap.com/search?keyword=Aggie%E9%80%9F%E8%AE%B0%E8%8B%B1%E8%AF%AD&view=map&src=mypage&callnative=0',
  mapNote: '填写经纬度后可直接调起高德导航；未填写时会打开高德搜索页。',
  surroundingsSummary: '机构周边强调接送便利、环境安静和家长等候舒适。',
  promoVideoAssetIds: [],
  nearbyPoints: [
    { id: 'nearby-1', title: '好接送', description: '门口动线清晰，适合家长接送孩子。', icon: 'users' },
    { id: 'nearby-2', title: '周边安静', description: '学习区远离嘈杂主干道，适合专注学习。', icon: 'shield' },
    { id: 'nearby-3', title: '停车方便', description: '附近有停车位或临停区域，便于家长短暂停留。', icon: 'parking' },
    { id: 'nearby-4', title: '交通便利', description: '可通过地铁/公交到达，方便固定上课。', icon: 'metro' },
  ],
  teachers,
  qualityHighlights,
  timetable: [
    { id: 't1', day: '周一', startTime: '18:30', endTime: '19:30', className: '自然拼读班', course: '基础拼读', teacher: 'Ageie胡老师', room: 'A 教室' },
    { id: 't2', day: '周二', startTime: '19:00', endTime: '20:00', className: '课内同步班', course: '校内英语巩固', teacher: 'Lily 老师', room: 'B 教室' },
    { id: 't3', day: '周三', startTime: '18:30', endTime: '19:30', className: '音标启蒙班', course: '国际音标', teacher: 'Ageie胡老师', room: 'A 教室' },
    { id: 't4', day: '周四', startTime: '19:00', endTime: '20:00', className: '新概念启蒙班', course: '句子与表达', teacher: 'Mike 老师', room: 'C 教室' },
    { id: 't5', day: '周六', startTime: '09:00', endTime: '10:30', className: '春季提升班', course: '综合提升', teacher: 'Lily 老师', room: '主教室' },
    { id: 't6', day: '周日', startTime: '15:00', endTime: '16:30', className: '体验课', course: '预约试听', teacher: '全体老师', room: '体验区' },
  ],
}
