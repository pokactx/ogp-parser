export interface RateLimiter {
  limit(opts: { key: string }): Promise<{ success: boolean }>
}

export async function checkRateLimit(limiter: RateLimiter, ip: string): Promise<void> {
  const { success } = await limiter.limit({ key: ip })
  if (!success) throw Object.assign(new Error('rate limit exceeded'), { status: 429 })
}
