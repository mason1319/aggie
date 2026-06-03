# Aggie速记英语

面向家长和小学生的英语学习官网。项目采用 `Vite + React + TypeScript`，支持网站、H5、后续微信小程序和 APP 共用同一套内容模型与数据契约。

## 一、架构目标（Web + H5 + 微信小程序 + APP）

核心原则：**统一内容模型，平台展示分离**。

- Web 网站、H5 页面、微信小程序、APP 都读取同一份内容包（`AppContentBundle`）。
- 学习内容、招生文案、机构信息、教学资源上传、反馈入口保持同一份数据定义。
- 每个平台只需要独立负责 UI 适配和路由承载，不重复业务模型定义。
- 当前实现聚焦“可运行原型 + 后续可扩展”，数据持久化支持：
  - 本地模式：走内存态默认值（不落浏览器持久化）
  - 远端模式：读写 Cloudflare Function 接口（为多端接入准备）
  - 混合模式：先尝试远端，失败回退本地（默认）

## 二、代码架构（整齐清晰）

```
src/
├── app/                  # 应用入口与路由
│   └── AppRouter.tsx
├── features/             # 业务页面（按域）
│   ├── home/
│   ├── learning/
│   ├── campus/
│   ├── feedback/
│   └── admin/
├── shared/               # 全局共享
│   ├── components/       # 全局组件（header / modal / section-title）
│   ├── constants/        # 路由与锚点
│   ├── data/             # 默认示例数据（课程、招生、反馈、机构）
│   ├── data-source/      # 统一内容源适配层（本地/远端/混合）
│   ├── services/         # 服务与 API 调用封装
│   └── types/            # 统一类型定义
└── main.tsx              # React 入口

functions/
└── api/
    ├── feedback.ts       # 反馈提交接口（已接 D1）
    └── content.ts        # 内容包接口（课程/招生/机构/媒体）
```

### 关键规则（防冗余）

- 所有页面都放在 `src/features/*/pages/*`，不再维护重复的 `src/pages`、`src/components`、`src/data`、`src/lib`。
- 数据模型只在 `src/shared/types` 与 `src/shared/data-source` 下维护。
- 业务页面不直接 `localStorage` 操作；统一从 `useContentBundle()` 获取配置、状态与刷新。
- 管理后台仅写入共享内容层，不在各页面重复自定义存储逻辑。
- 接口、页面、样式边界清晰，后续接入小程序/App 只新增 adapter，不改业务契约。

## 三、统一数据源说明

### 1) 内容契约
统一类型：`src/shared/data-source/types.ts`

- `AppContentBundle`
- `AdmissionSettings`
- `InstitutionProfile`
- `Course`
- `LearningItem`
- `MediaLibrary`
- `FeedbackLibrary`
- `AppMeta`（含版本号）

### 2) 数据源实现
- `src/shared/data-source/local.ts`：本地运行时模式（内存态快照，适合离线/本机演示）
- `src/shared/data-source/remote.ts`：云端请求 `/api/content`
- `src/shared/data-source/hybrid.ts`：远端优先，失败回退本地
- `src/shared/data-source/contentStore.ts`：统一缓存、加载态、刷新通知
- `src/shared/data-source/useContentBundle.ts`：页面级 Hook

### 3) 当前数据口径
- 招生、机构、反馈列表、媒体绑定：已通过统一 bundle 管理。
- 课程学习结构 `courses` 仍以默认示例为基线；后续可在云端接口返回值中逐步支持课程后台管理。
- 学习进度与练习记录走 `/api/progress` 服务端统一持久化（当前无本地浏览器持久化）。

## 四、云端内容 API

### `/api/feedback`
- GET：读取反馈列表
- POST：提交反馈
- 存储：`FEEDBACK_DB`（Cloudflare D1）

### `/api/content`（新增）
- GET：读取内容包
- PUT：保存内容包（写入 KV，需鉴权）

### `/api/media/upload/init` + `/api/media/upload/chunk` + `/api/media/upload/complete`
- POST：机构视频分片上传（本机环境默认写入 `public/media/videos`，并更新 `src/data/video.json`）
- 分片逻辑：`init` 返回 `uploadId`，`chunk` 逐段上传，`complete` 合并并返回播放地址
- `/api/media-download?key=...`：Cloudflare 环境下流式读取 R2 文件（支持 Range 断点续传）

环境变量：
- `AGGIE_CONTENT_KV`：Cloudflare KV，用于存储内容包
- `AGGIE_CONTENT_ADMIN_TOKEN`：用于 `/api/content` 写权限（建议必配）
- `AGGIE_MEDIA_BUCKET`：CF 环境下视频存储桶（R2）
- `AGGIE_MEDIA_PUBLIC_BASE`：CF 视频公开访问前缀（如 `https://xxx.public.r2.dev`）
- `AGGIE_MEDIA_UPLOAD_TOKEN`：CF 分片上传鉴权 token（建议配置）

说明：`AGGIE_MEDIA_PUBLIC_BASE` 未配置时，系统会自动回退到
`/api/media-download?key=...`，因此同一个页面仍可正常通过 Cloudflare Functions 播放上传视频。若未绑定 R2，则上传会直接返回
`AGGIE_MEDIA_BUCKET 未绑定`，视频也无法展示。

前端配置：
- `VITE_AGGIE_CONTENT_SOURCE`：`local | remote | hybrid`
- `VITE_AGGIE_CONTENT_API`：如 `/api`
- `VITE_AGGIE_PLATFORM`：`web | h5 | wechat-mini | app`
- `VITE_AGGIE_CONTENT_ADMIN_TOKEN`：前端写 `/api/content` 时的鉴权 token（可选，未设置则不携带）
- `VITE_AGGIE_MEDIA_UPLOAD_BASE`：上传服务基址，默认留空走本地 `/api`，失败后可填 CF 上传域名（例如 `https://xxx.workers.dev/api`）
- `VITE_AGGIE_MEDIA_UPLOAD_TOKEN`：CF 上传鉴权 token

## 五、运行与部署

```bash
npm install
npm run dev
npm run build
```

Cloudflare Pages 重点配置：
- 构建命令：`npm run build`
- 输出目录：`dist`
- 详细部署步骤见：`CLOUDFLARE_DEPLOYMENT.md`
- 路由回退：`public/_redirects`（当前回退到 `/index.html`）
- 缓存策略：`public/_headers`
- 域名建议：`aggieai.me`
- 打开 `Always Use HTTPS`、`Auto Minify`、`Brotli`

## 六、页面入口
- `/`：官网首页
- `/learn`：学习体验
- `/campus`：机构/师资/地图/课表
- `/feedback`：反馈提交
- `/admin`：后台配置（本机演示）

## 七、现有能力清单
- 首页：课程体系、招生、反馈预览、师资与机构概览跳转
- 学习：课程选择、单元选择、听说读写练习、错词本、进度保存
- 机构：师资、地址+高德导航+周边搜索、教学质量、周课表
- 反馈：提交到云端 `/api/feedback`，失败时本机缓存兜底
- 管理：招生季、招生文案、机构信息、媒体（真人发音+机构视频）与课程表管理

## 八、下一步建议（建议你先执行）
1. 在本机完成 Cloudflare 接口联调：
   - 绑定 KV（`AGGIE_CONTENT_KV`）和 D1（`FEEDBACK_DB`）
   - 绑定 R2 Bucket：变量名 `AGGIE_MEDIA_BUCKET`（必配），挂载你的 R2 bucket
   - 执行 `npm run verify:api`（本地或线上）
2. 登录 Cloudflare Pages 后端环境变量：
   - `VITE_AGGIE_CONTENT_SOURCE=hybrid`
   - `VITE_AGGIE_CONTENT_API=/api`
   - `VITE_AGGIE_PLATFORM=web`
   - `VITE_ADMIN_PASSWORD=...`
   - `VITE_AGGIE_CONTENT_ADMIN_TOKEN=...`
3. 绑定自定义域名 `aggieai.me` 并开启 HTTPS、缓存策略。
4. 线上 smoke：访问 `/`, `/learn`, `/campus`, `/feedback`, `/admin`，确认按钮、地图、招生状态与媒体库联动正常。

## 九、运维说明
- 本仓库默认保留“可本机演示”优先级；Cloudflare 绑定 `FEEDBACK_DB` 与 `AGGIE_CONTENT_KV` 后可转为多人可用云端共享。
- 正式产品请在管理后台接入真实身份鉴权（不使用明文密码演示方案）。
