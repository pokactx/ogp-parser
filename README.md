# ogp-parser

OGP (Open Graph Protocol) scraping API built on Cloudflare Workers.

## API

```
GET /ogp?url=<URL-encoded>
```

### Response

```json
{
  "url": "https://example.com",
  "title": "...",
  "description": "...",
  "image": "https://...",
  "siteName": "...",
  "type": "website",
  "twitterCard": "summary_large_image",
  "twitterTitle": "...",
  "twitterDescription": "...",
  "twitterImage": "https://..."
}
```

### Errors

| Status | Reason |
|--------|--------|
| 400 | Missing or invalid URL |
| 403 | SSRF target or blocked bot |
| 429 | Rate limit exceeded |
| 502 | Upstream fetch failed |

## Security

- **SSRF protection** — IPv4 CIDR denylist + redirect re-validation (max 3 hops)
- **Rate limiting** — 60 req/min per IP via Cloudflare RateLimit binding
- **AI bot blocking** — GPTBot, ClaudeBot, Bytespider, and others blocked by User-Agent
- **CORS** — restricted to configured origins (`ALLOWED_ORIGINS`)

## Development

```bash
bun install
bun run dev        # wrangler dev (localhost:8787)
bun run typecheck  # tsc --noEmit
bun run lint       # oxlint src
bun run fmt        # oxlint --fix src
```

## Deploy

```bash
bun run deploy     # wrangler deploy
```
