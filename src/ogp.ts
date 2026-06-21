const MAX_VALUE_LEN = { title: 200, description: 500, image: 2000, default: 200 } as const

type LenKey = keyof typeof MAX_VALUE_LEN

function clamp(value: string, key: LenKey): string {
  return value.trim().slice(0, MAX_VALUE_LEN[key])
}

function toAbsolute(value: string, base: string): string {
  try {
    return new URL(value, base).href
  } catch {
    return value
  }
}

export interface OgpData {
  url: string
  title?: string
  description?: string
  image?: string
  siteName?: string
  type?: string
  twitterCard?: string
  twitterTitle?: string
  twitterDescription?: string
  twitterImage?: string
}

class OgpHandler {
  data: Partial<OgpData> = {}

  constructor(private baseUrl: string) {}

  element(element: Element) {
    const property = element.getAttribute('property')?.toLowerCase()
    const name = element.getAttribute('name')?.toLowerCase()
    const content = element.getAttribute('content')
    if (!content) return

    switch (property) {
      case 'og:title':
        this.data.title = clamp(content, 'title')
        break
      case 'og:description':
        this.data.description = clamp(content, 'description')
        break
      case 'og:image':
        this.data.image = toAbsolute(clamp(content, 'image'), this.baseUrl)
        break
      case 'og:site_name':
        this.data.siteName = clamp(content, 'default')
        break
      case 'og:type':
        this.data.type = clamp(content, 'default')
        break
    }

    switch (name) {
      case 'twitter:card':
        this.data.twitterCard = clamp(content, 'default')
        break
      case 'twitter:title':
        this.data.twitterTitle = clamp(content, 'title')
        break
      case 'twitter:description':
        this.data.twitterDescription = clamp(content, 'description')
        break
      case 'twitter:image':
        this.data.twitterImage = toAbsolute(clamp(content, 'image'), this.baseUrl)
        break
    }
  }
}

class TitleHandler {
  private chunks: string[] = []

  constructor(private ogp: OgpHandler) {}

  text(chunk: Text) {
    this.chunks.push(chunk.text)
    if (chunk.lastInTextNode && !this.ogp.data.title) {
      this.ogp.data.title = clamp(this.chunks.join(''), 'title')
    }
  }
}

export async function extractOgp(res: Response, pageUrl: string): Promise<OgpData> {
  const handler = new OgpHandler(pageUrl)
  const titleHandler = new TitleHandler(handler)

  // Must consume the transformed response to trigger element/text handlers
  await new HTMLRewriter()
    .on('meta', handler)
    .on('title', titleHandler)
    .transform(res)
    .arrayBuffer()

  return { url: pageUrl, ...handler.data }
}
