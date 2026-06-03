# Cloudflare Pages 部署清单（Aggie速记英语）

本文档适用于当前仓库的 `Vite + React` 页面和 `functions/api/*`。

## 0. 前置
- 仓库已设置为 `https://github.com/mason1319/aggie` 的主干分支。
- 本地 `.env.local` 仅用于本地运行，不会自动上传到线上。

## 1. 登录并创建页面项目
1. 登录 [Cloudflare Dashboard](https://dash.cloudflare.com)。
2. 进入 **Pages** → **Create application** → **Connect to Git**。
3. 选择仓库 `mason1319/aggie`。
4. 构建设置：
   - Framework preset：`Vite`（或 `Other`）
   - Build command：`npm run build`
   - Build output directory：`dist`
   - Node version：`20`（或项目兼容版本）
5. 绑定自定义域名：`aggieai.me`。
6. 开启：
   - `Always Use HTTPS`
   - `Auto Minify`
   - `Brotli`

## 2. 路由与缓存
- 已有文件：
  - `public/_redirects`（SPA 回退到 `index.html`）
  - `public/_headers`（静态资源长期缓存、HTML 禁缓存、HTTPS 头）

## 3. 数据源环境变量（Pages -> Settings -> Environment variables）
建议添加/更新：
- `VITE_AGGIE_CONTENT_SOURCE=hybrid`
- `VITE_AGGIE_CONTENT_API=/api`
- `VITE_AGGIE_PLATFORM=web`
- `VITE_ADMIN_PASSWORD=...`（演示后台密码）
- `VITE_AGGIE_CONTENT_ADMIN_TOKEN=...`（用于 `/api/content` 写权限，可选）

> 说明：Cloudflare Pages 前端环境变量会在构建时注入到 JS。  

## 4. 反馈数据库（D1）绑定
### 4.1 创建 D1
1. 进入 **Workers & Pages** → **D1 SQL Database** → **Create**。
2. 记录 `Database ID` 与 `Database name`。

### 4.2 绑定到 Pages
1. 在 Pages 项目 Settings → Functions → **Bindings** 新增：
   - 类型：`D1 Database`
   - Variable name：`FEEDBACK_DB`
   - 选择步骤 4.1 创建的数据库
2. 验证接口：
   - `GET https://<你的域名>/api/feedback`
   - 首次会自动建表，返回空列表。

## 5. 内容存储（KV）绑定（可选，/api/content）
### 5.1 创建 KV
1. 进入 **Workers & Pages** → **KV** → **Create**。
2. 创建命名空间，例如 `AGGIE_CONTENT_KV`。
3. 记录 Namespace ID。

### 5.2 绑定到 Pages
1. 在项目 Settings → Functions → **Bindings** 新增：
   - 类型：`KV Namespace`
   - Variable name：`AGGIE_CONTENT_KV`
   - 选择上一步的 namespace

### 5.3 写权限（建议）
- 如需线上后台保存内容生效，需要设置：
  - 变量名：`AGGIE_CONTENT_ADMIN_TOKEN`
  - 变量值：你自定义的密钥（与前端 `VITE_AGGIE_CONTENT_ADMIN_TOKEN` 保持一致）

## 6. 视频存储（R2）绑定（必须，/api/media-upload）
### 6.1 创建 R2
1. 进入 **Workers & Pages** → **R2** → **Create bucket**。
2. 记录 bucket 名称与可绑定对象。

### 6.2 绑定到 Pages
1. 在项目 Settings → Functions → **Bindings** 新增：
   - 类型：`R2 Bucket`
   - Variable name：`AGGIE_MEDIA_BUCKET`
   - 选择上一步的 bucket
2. 可选：设置变量 `AGGIE_MEDIA_PUBLIC_BASE` 为公开访问前缀（如 `https://xxx.public.r2.dev/media/videos`）。不配置时会自动回退到 `/api/media-download?key=...`。
3. 可选：如需上传鉴权，设置 `AGGIE_MEDIA_UPLOAD_TOKEN`（与前端 `VITE_AGGIE_MEDIA_UPLOAD_TOKEN` 一致）。

## 7. 远端内容 API
- `GET /api/content`：返回内容包
- `PUT /api/content`：携带 `Authorization: Bearer <token>`（或 `X-Admin-Token`）时可写入
- 本地模式请保留 `VITE_AGGIE_CONTENT_SOURCE=hybrid`，默认会优先取远端、失败后回退本地 `localStorage`，保证演示可用。

## 8. 常用校验命令
```bash
npm run build
npm run preview
```

### 8.1 一键 API 联调脚本（推荐）
```bash
npm run verify:api
```

脚本默认使用 `https://aggieai.me`，可通过环境变量覆盖：
```bash
AGGIE_API_BASE=https://aggieai.me \
AGGIE_CONTENT_ADMIN_TOKEN=<你的TOKEN> \
npm run verify:api
```

参数方式：
```bash
npm run verify:api -- --base https://aggieai.me --token <你的TOKEN>
```

本地预览模式（需先启动站点）：
```bash
npm run dev -- --host 0.0.0.0 --port 4173
npm run verify:api -- --base http://localhost:4173 --token <你的TOKEN>
```

### 8.2 命令级验收预期
- `GET /api/content`：第一次绑定 KV 前可为 `404`，绑定 KV 后应返回 JSON；
- `PUT /api/content`：携带正确 Token 时应返回 `200`；
- `GET /api/content`（写后）：应返回 JSON 中可见 `bundle`；
- `POST /api/feedback`：应返回 `entry.id`；
- `GET /api/feedback`：应返回 `{ "entries": [...] }`。
 - `POST /api/media-upload-init`（有测试文件时）：应返回 `200` 并包含 `uploadId`；
 - `POST /api/media-download?key=media/videos/...`：已上传 key 应返回 `200/206`，播放器可正常播放。

## 9. 后续（小程序 / APP）
- 已建立统一内容契约 `AppContentBundle`，下一步只需新增对应端数据层适配器：
  - 读取 `https://aggieai.me/api/content`
  - 缓存 `meta.schemaVersion`
  - 适配 `InstitutionProfile`、`AdmissionSettings`、课程结构与媒体列表显示
