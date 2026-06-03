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

## 10. 公网为什么“本地有图/视频，公网看不到”的复现根因

已在 `aggieai.me` 复现到同一问题：

- `/api/honor` 已返回 `[]`（`AGGIE_CONTENT_KV` 绑定链路在工作）；
- `/api/media-upload-image-init` 返回 `500` 且消息为：`AGGIE_MEDIA_BUCKET 未绑定`；
- 本质是 `media` 路由已命中，但缺失 R2 绑定，导致文件无法落盘，前端自然无回显。

先把这条线补齐：`AGGIE_MEDIA_BUCKET` 必须在 Pages Functions Binding 中绑定到可写的 R2 桶。

## 11. CF 上线最终修复清单（照着做）

### 11.1 先在 Dashboard（推荐，最稳）
1. 登录 [Cloudflare Dashboard](https://dash.cloudflare.com)
2. 进入 `Workers & Pages -> aggieai -> Settings -> Functions -> Bindings`
3. 依次添加：
   - `R2 Bucket` -> `AGGIE_MEDIA_BUCKET` -> 选择你的 bucket（示例名：`aggie-media`）
   - `KV Namespace` -> `AGGIE_CONTENT_KV` -> 已有 namespace
   - `D1 Database` -> `FEEDBACK_DB` -> 已有数据库
4. 在 `Settings -> Environment variables` 设置：
   - `VITE_AGGIE_CONTENT_SOURCE=hybrid`
   - `VITE_AGGIE_CONTENT_API=/api`
   - `VITE_AGGIE_PLATFORM=web`
   - `VITE_AGGIE_CONTENT_ADMIN_TOKEN=<后端写权限 token>`（可选）
5. 继续补上后端鉴权配置（若你启用上传鉴权）：
   - `AGGIE_MEDIA_UPLOAD_TOKEN=<上传 token>`
   - `VITE_AGGIE_MEDIA_UPLOAD_TOKEN=<同上>`
6. 可选：如需公共 URL，设置 `AGGIE_MEDIA_PUBLIC_BASE`（不设置也可回退到 `/api/media-download?key=...`）。
7. 保存并重新触发一次部署（或等待自动发布）。

### 11.2 可执行 CLI 清单（含 token 示例）

```bash
# 安装 wrangler
npm i -g wrangler
wrangler login

# 已知账号与项目（按你实际值替换）
export CF_API_TOKEN=cfat_你真实的Token
export CF_ACCOUNT_ID=fc7c3a49d9ee4bc30625a28d895c2b0c
export CF_PROJECT_NAME=aggieai

# 验证项目状态
curl -sS "https://api.cloudflare.com/client/v4/accounts/$CF_ACCOUNT_ID/pages/projects/$CF_PROJECT_NAME" \
  -H "Authorization: Bearer $CF_API_TOKEN"

# 发布环境变量设置（部分版本会直接支持，若不支持请回到 Dashboard）
wrangler pages project env var put VITE_AGGIE_CONTENT_SOURCE=hybrid --project-name "$CF_PROJECT_NAME" --env production
wrangler pages project env var put VITE_AGGIE_CONTENT_API=/api --project-name "$CF_PROJECT_NAME" --env production
wrangler pages project env var put VITE_AGGIE_PLATFORM=web --project-name "$CF_PROJECT_NAME" --env production

# 密钥（建议 Secret，不留明文）
wrangler pages secret put AGGIE_MEDIA_UPLOAD_TOKEN --project-name "$CF_PROJECT_NAME" --env production
wrangler pages secret put VITE_AGGIE_MEDIA_UPLOAD_TOKEN --project-name "$CF_PROJECT_NAME" --env production
wrangler pages secret put VITE_AGGIE_CONTENT_ADMIN_TOKEN --project-name "$CF_PROJECT_NAME" --env production

# 触发一次手动部署
curl -sS -X POST "https://api.cloudflare.com/client/v4/accounts/$CF_ACCOUNT_ID/pages/projects/$CF_PROJECT_NAME/deployments" \
  -H "Authorization: Bearer $CF_API_TOKEN" \
  -H "Content-Type: application/json" \
  --data '{"branch":"main"}'
```

> 提示：`AGGIE_MEDIA_BUCKET`、`AGGIE_CONTENT_KV`、`FEEDBACK_DB` 是 **Bindings**，不总能通过 `env var` 命令统一设置；如 CLI 报错，回 Dashboard 按第一节操作。

### 11.3 绑定完成后的线上验收（按顺序执行）

```bash
curl -i "https://aggieai.me/api/honor" -H "Accept: application/json"

curl -i -X POST "https://aggieai.me/api/media-upload-image-init" \
  -H "Content-Type: application/json" \
  --data '{"category":"honor","fileName":"verify.png","mimeType":"image/png","fileSize":1024,"totalChunks":1,"title":"verify","desc":"verify"}'

curl -i -X POST "https://aggieai.me/api/media-upload-init" \
  -H "Content-Type: application/json" \
  --data '{"fileName":"verify.mp4","mimeType":"video/mp4","fileSize":5242880,"totalChunks":2,"title":"verify","desc":"verify"}'
```

期望结果：

- `/api/honor` 可返回数组（至少空数组也可）
- `/api/media-upload-image-init` 返回 `200` 且含 `uploadId`
- `/api/media-upload-init` 返回 `200` 且含 `uploadId`

若仍报 `AGGIE_MEDIA_BUCKET 未绑定`，说明 R2 绑定未生效，需要回到 Step 11.1 重新检查并保存设置。

## 12. 一次性命令清单（你现在可直接抄）

```bash
# A. 给我直接执行的顺序
1) Dashboard：Settings -> Functions -> Bindings
2) 设置：AGGIE_MEDIA_BUCKET、AGGIE_CONTENT_KV、FEEDBACK_DB
3) Settings -> Environment variables：VITE_AGGIE_CONTENT_SOURCE、VITE_AGGIE_CONTENT_API、VITE_AGGIE_PLATFORM
4) 可选 Secrets：AGGIE_MEDIA_UPLOAD_TOKEN、VITE_AGGIE_MEDIA_UPLOAD_TOKEN、VITE_AGGIE_CONTENT_ADMIN_TOKEN
5) 触发部署：在 Pages 点 Deploy / 刷新主分支
6) 验证：curl /api/media-upload-image-init 与 /api/media-upload-init

# B. 成功标准
- `/api/honor` 返回数组
- `/api/media-upload-image-init` 返回 200
- `/api/media-upload-init` 返回 200
- 上传成功后在前台 荣誉墙、师资照、反馈图 三类图能回显
```
