import { validateUrl } from './security'

const MAX_HOPS = 3
const MAX_BODY_BYTES = 1 * 1024 * 1024

export async function fetchWithSsrfProtection(url: URL): Promise<Response> {
  let current = url

  for (let i = 0; i < MAX_HOPS; i++) {
    const res = await fetch(current.href, {
      redirect: 'manual',
      signal: AbortSignal.timeout(5000),
      headers: { 'User-Agent': 'OGP-Parser/1.0 (https://pokactx.run)' },
    })

    if (res.status >= 300 && res.status < 400) {
      const location = res.headers.get('Location')
      if (!location) throw Object.assign(new Error('redirect without Location'), { status: 502 })
      current = validateUrl(new URL(location, current.href).href)
      continue
    }

    if (!res.ok) throw Object.assign(new Error(`upstream ${res.status}`), { status: 502 })

    const ct = res.headers.get('content-type') ?? ''
    if (!ct.includes('text/html') && !ct.includes('application/xhtml+xml')) {
      return new Response('', { status: 200, headers: { 'content-type': 'text/html' } })
    }

    const cl = Number(res.headers.get('content-length') ?? 0)
    if (cl > MAX_BODY_BYTES) throw Object.assign(new Error('response too large'), { status: 502 })

    return res
  }

  throw Object.assign(new Error('too many redirects'), { status: 502 })
}
