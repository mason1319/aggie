#!/usr/bin/env node
import process from 'node:process'

function parseArgs() {
  const args = process.argv.slice(2)
  const parsed = { base: process.env.AGGIE_API_BASE ?? process.env.aggie_api_base ?? '' }
  for (let i = 0; i < args.length; i += 1) {
    const arg = args[i]
    if ((arg === '--base' || arg === '-b') && args[i + 1]) {
      parsed.base = args[i + 1]
      i += 1
      continue
    }
    if ((arg === '--token' || arg === '-t') && args[i + 1]) {
      parsed.token = args[i + 1]
      i += 1
      continue
    }
  }
  return {
    base: parsed.base || 'https://aggieai.me',
    token: parsed.token || process.env.VITE_AGGIE_CONTENT_ADMIN_TOKEN || process.env.AGGIE_CONTENT_ADMIN_TOKEN || '',
  }
}

async function requestJson(url, init = {}) {
  const start = Date.now()
  const response = await fetch(url, {
    ...init,
    headers: {
      Accept: 'application/json',
      ...init.headers,
    },
  })
  const elapsed = Date.now() - start
  const text = await response.text()
  let json = null
  try {
    json = text ? JSON.parse(text) : null
  } catch {
    json = null
  }
  return { response, text, json, elapsed }
}

function logResult(label, detail) {
  const now = new Date().toISOString()
  console.log(`[${now}] ${label} ${detail}`)
}

function normalizeBase(raw) {
  return String(raw).replace(/\/+$/, '')
}

async function assertStatus(label, expected, actual) {
  if (actual !== expected) {
    throw new Error(`${label} 状态码不符: expect ${expected}，got ${actual}`)
  }
}

async function run() {
  const options = parseArgs()
  const base = normalizeBase(options.base)
  const token = options.token
  const headers = {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  }

  logResult('目标站点', base)

  const contentUrl = `${base}/api/content`
  const feedbackUrl = `${base}/api/feedback`

  const contentGet = await requestJson(contentUrl)
  logResult('GET /api/content', `HTTP ${contentGet.response.status} 耗时${contentGet.elapsed}ms`)
  if (!contentGet.response.ok && contentGet.response.status !== 404) {
    throw new Error(`GET /api/content 未通过：${contentGet.text}`)
  }
  logResult('返回示例', `bundle=${Boolean(contentGet.json?.bundle)} fields=${Object.keys(contentGet.json || {}).join(',') || 'none'}`)

  const sampleBundle = {
    brand: {
      name: 'Aggie速记英语',
      tagline: '听得懂、读得准、记得牢',
      description: '验收用示例数据',
    },
    contact: {
      wechatQrImageUrl: '/wechat-qr-placeholder.svg',
      contactHint: '验收联系人二维码占位',
    },
    courses: [],
    admission: {
      activeCampaignId: 'spring-acceptance',
      showInHomepage: true,
      campaigns: [],
    },
    institution: {
      id: 'verify-org',
      name: 'Aggie速记英语',
      motto: '可爱、清晰、易学',
      phone: '138-0000-0000',
      address: '广东省深圳市示例路',
      map: {
        addressHint: '验收示例',
      },
      teachers: [],
      nearbyPoints: [],
      qualityHighlights: [],
      promoVideoAssetIds: [],
      promoVideos: [],
      schedule: [],
    },
    media: { assets: [], itemBindings: {} },
    feedback: { entries: [] },
    meta: {
      schemaVersion: 2,
      generatedBy: 'verify-script',
      updatedAt: new Date().toISOString(),
      syncSource: 'remote',
    },
  }

  const contentPut = await requestJson(contentUrl, {
    method: 'PUT',
    headers,
    body: JSON.stringify({
      updatedAt: new Date().toISOString(),
      bundle: sampleBundle,
    }),
  })
  logResult('PUT /api/content', `HTTP ${contentPut.response.status} 耗时${contentPut.elapsed}ms`)

  if (!token) {
    await assertStatus('PUT /api/content(无token)', 200, contentPut.response.status)
      .catch(() => {
        throw new Error('当前未传入 token 时，预期返回 200，说明环境不限制写入。若你期望鉴权保护，请补充 AGGIE_CONTENT_ADMIN_TOKEN。')
      })
  } else {
    await assertStatus('PUT /api/content', 200, contentPut.response.status)
  }

  const contentGet2 = await requestJson(contentUrl)
  await assertStatus('GET /api/content(写入后)', 200, contentGet2.response.status)
  if (!contentGet2.json?.bundle) {
    throw new Error('GET /api/content 写入后未返回 bundle')
  }
  logResult('回读校验', `meta.updatedAt=${contentGet2.json.bundle.meta?.updatedAt || contentGet2.json.updatedAt || 'n/a'}`)

  const feedbackPayload = {
    role: '家长',
    name: '联调用户',
    subtitle: '验收',
    contact: '13800000000',
    content: '这是联调脚本提交的验证反馈',
    avatarUrl: 'https://picsum.photos/seed/aggie-verify/240',
    imageUrl: 'https://picsum.photos/seed/aggie-verify2/640',
    createdAt: new Date().toISOString(),
  }

  const feedbackPost = await requestJson(feedbackUrl, {
    method: 'POST',
    headers,
    body: JSON.stringify(feedbackPayload),
  })
  logResult('POST /api/feedback', `HTTP ${feedbackPost.response.status} 耗时${feedbackPost.elapsed}ms`)
  if (!feedbackPost.response.ok) {
    throw new Error(`POST /api/feedback 未通过: ${feedbackPost.text}`)
  }
  const feedbackPostEntry = feedbackPost.json?.entry
  if (!feedbackPostEntry?.id) {
    throw new Error('POST /api/feedback 未返回 entry.id')
  }

  const feedbackGet = await requestJson(feedbackUrl)
  logResult('GET /api/feedback', `HTTP ${feedbackGet.response.status} 耗时${feedbackGet.elapsed}ms`)
  if (!feedbackGet.response.ok) {
    throw new Error(`GET /api/feedback 未通过: ${feedbackGet.text}`)
  }
  if (!Array.isArray(feedbackGet.json?.entries)) {
    throw new Error('GET /api/feedback 返回 entries 字段异常')
  }

  logResult('反馈校验', `entries=${feedbackGet.json.entries.length}`)
  logResult('✅', 'Cloudflare API 校验完成')
}

run().catch((error) => {
  console.error(`❌ ${error?.message || error}`)
  process.exitCode = 1
})
