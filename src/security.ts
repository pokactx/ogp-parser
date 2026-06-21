const BLOCKED_HOSTNAMES = new Set(['localhost', 'metadata.google.internal'])

const IPV4_BLOCKED_CIDRS = [
  { net: 0x7f000000, mask: 0xff000000 }, // 127.0.0.0/8
  { net: 0x0a000000, mask: 0xff000000 }, // 10.0.0.0/8
  { net: 0xac100000, mask: 0xfff00000 }, // 172.16.0.0/12
  { net: 0xc0a80000, mask: 0xffff0000 }, // 192.168.0.0/16
  { net: 0xa9fe0000, mask: 0xffff0000 }, // 169.254.0.0/16
  { net: 0x64400000, mask: 0xffc00000 }, // 100.64.0.0/10
  { net: 0xc0000000, mask: 0xffffff00 }, // 192.0.0.0/24
  { net: 0xc6120000, mask: 0xfffe0000 }, // 198.18.0.0/15
  { net: 0xe0000000, mask: 0xf0000000 }, // 224.0.0.0/4 multicast
  { net: 0x00000000, mask: 0xffffffff }, // 0.0.0.0
]

function isBlockedIPv4(hostname: string): boolean {
  const parts = hostname.split('.')
  if (parts.length !== 4) return false
  const nums = parts.map(Number)
  if (nums.some((n) => isNaN(n) || n < 0 || n > 255)) return false
  const ip = (((nums[0] << 24) | (nums[1] << 16) | (nums[2] << 8) | nums[3]) >>> 0)
  // `&` returns signed int; `>>> 0` converts to unsigned so comparison with positive net literals works
  return IPV4_BLOCKED_CIDRS.some(({ net, mask }) => ((ip & mask) >>> 0) === net)
}

function isBlockedIPv6(hostname: string): boolean {
  // handle bracketed form "[::1]"
  const h = hostname.startsWith('[') ? hostname.slice(1, -1) : hostname
  return h === '::1' || h.startsWith('fc') || h.startsWith('fd') || h.startsWith('fe80')
}

export function validateUrl(raw: string | null): URL {
  if (!raw) throw Object.assign(new Error('url is required'), { status: 400 })

  let url: URL
  try {
    url = new URL(raw)
  } catch {
    throw Object.assign(new Error('invalid url'), { status: 400 })
  }

  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw Object.assign(new Error('only http/https allowed'), { status: 400 })
  }

  // strip fragment — not sent in fetch, shouldn't affect cache key
  url.hash = ''

  const hostname = url.hostname.toLowerCase().replace(/\.+$/, '')

  if (BLOCKED_HOSTNAMES.has(hostname)) {
    throw Object.assign(new Error('forbidden'), { status: 403 })
  }
  if (isBlockedIPv4(hostname) || isBlockedIPv6(hostname)) {
    throw Object.assign(new Error('forbidden'), { status: 403 })
  }

  return url
}
