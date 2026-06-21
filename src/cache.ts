// Cache API is colo-local — cache misses happen per-colo on first request

const CACHE_TTL = 3600

export function buildCacheKey(url: URL): Request {
  return new Request(`https://ogp-cache.internal/${encodeURIComponent(url.href)}`)
}

export async function getCached(key: Request): Promise<Response | undefined> {
  const cached = await caches.default.match(key)
  return cached ?? undefined
}

export function scheduleCache(ctx: { waitUntil(promise: Promise<unknown>): void }, key: Request, res: Response): void {
  const toCache = new Response(res.body, res)
  toCache.headers.set('Cache-Control', `public, max-age=${CACHE_TTL}`)
  toCache.headers.set('X-Cache', 'MISS')
  ctx.waitUntil(caches.default.put(key, toCache))
}
