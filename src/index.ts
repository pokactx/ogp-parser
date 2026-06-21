import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { isAiBot } from './bot'
import { fetchWithSsrfProtection } from './fetch'
import { extractOgp } from './ogp'
import { validateUrl } from './security'
import { type RateLimiter, checkRateLimit } from './ratelimit'
import { buildCacheKey, getCached, scheduleCache } from './cache'

type Env = {
  Bindings: {
    RATE_LIMITER: RateLimiter
    ALLOWED_ORIGINS: string
    API_KEY: string
  }
}

const app = new Hono<Env>()

// robots.txt — AI クローラーへの意思表示（UA チェックより前に返す）
app.get('/robots.txt', (c) => {
  return c.text('User-agent: *\nDisallow: /\n', 200, { 'Content-Type': 'text/plain' })
})

// AI bot UA ブロック
app.use('*', async (c, next) => {
  const ua = c.req.header('User-Agent') ?? ''
  if (isAiBot(ua)) return c.json({ error: 'forbidden' }, 403)
  return next()
})

// CORS
app.use('*', async (c, next) => {
  const origins = c.env.ALLOWED_ORIGINS.split(',').map((s) => s.trim())
  return cors({ origin: origins })(c, next)
})

// API key 認証
app.use('/ogp', async (c, next) => {
  const key = c.req.header('X-Api-Key') ?? ''
  if (!c.env.API_KEY || key !== c.env.API_KEY) {
    return c.json({ error: 'forbidden' }, 403)
  }
  return next()
})

app.onError((err: unknown, c) => {
  const e = err as { status?: number; message?: string }
  const status = (e.status ?? 500) as 400 | 403 | 429 | 500 | 502
  return c.json({ error: e.message ?? 'internal error' }, status)
})

app.get('/ogp', async (c) => {
  const ip = c.req.header('CF-Connecting-IP') ?? 'unknown'
  await checkRateLimit(c.env.RATE_LIMITER, ip)

  const targetUrl = validateUrl(c.req.query('url') ?? null)
  const cacheKey = buildCacheKey(targetUrl)

  const cached = await getCached(cacheKey)
  if (cached) {
    const res = new Response(cached.body, cached)
    res.headers.set('X-Cache', 'HIT')
    return res
  }

  const upstream = await fetchWithSsrfProtection(targetUrl)
  const ogp = await extractOgp(upstream, targetUrl.href)

  const res = c.json(ogp)
  scheduleCache(c.executionCtx, cacheKey, res.clone())
  return res
})

export default app
