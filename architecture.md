# OGP Parser — Architecture

## 概要

Cloudflare Workers 上で動作する OGP (Open Graph Protocol) メタデータ取得 API。
Hono フレームワークで実装し、Bun でテスト・型チェックを行う。

## 技術スタック

| レイヤー | 技術 |
|----------|------|
| ランタイム | Cloudflare Workers |
| フレームワーク | Hono v4 |
| HTML パース | Cloudflare HTMLRewriter (Workers 組み込み) |
| キャッシュ | Cloudflare Cache API (coloローカル) |
| レートリミット | Cloudflare Rate Limiting (`RATE_LIMITER` binding) |
| 言語 | TypeScript |
| テスト | Bun test |
| Lint | oxlint |
| Git フック | lefthook + commitlint |

## エンドポイント

| メソッド | パス | 説明 |
|----------|------|------|
| GET | `/robots.txt` | AI クローラーへの全拒否 (`Disallow: /`) |
| GET | `/ogp?url=<URL>` | 指定 URL の OGP メタデータを JSON で返す |

### `/ogp` レスポンス例

```json
{
  "url": "https://example.com",
  "title": "Example",
  "description": "...",
  "image": "https://example.com/og.png",
  "siteName": "Example Site",
  "type": "website",
  "twitterCard": "summary_large_image",
  "twitterTitle": "...",
  "twitterDescription": "...",
  "twitterImage": "..."
}
```

## リクエスト処理フロー

```
Client
  │
  ▼
[robots.txt] ─── GET /robots.txt → 即返却
  │
  ▼
[AI Bot ブロック] ─── User-Agent に既知 AI クローラーパターン → 403
  │
  ▼
[CORS] ─── ALLOWED_ORIGINS 環境変数で許可オリジン制御
  │
  ▼
GET /ogp
  │
  ├─ [Rate Limit] ─── CF-Connecting-IP で 60req/60s → 超過で 429
  │
  ├─ [URL バリデーション] ─── security.ts
  │     ├─ null チェック → 400
  │     ├─ http/https のみ許可 → 400
  │     ├─ ブロックホスト名 (localhost, metadata.google.internal) → 403
  │     ├─ ブロック IPv4 CIDR (プライベート・リンクローカル等) → 403
  │     └─ ブロック IPv6 (::1, fc/fd/fe80 プレフィックス) → 403
  │
  ├─ [キャッシュ確認] ─── Cache API
  │     └─ HIT → X-Cache: HIT ヘッダー付きで即返却
  │
  ├─ [SSRF 保護フェッチ] ─── fetch.ts
  │     ├─ リダイレクト手動追跡 (最大 3 ホップ)
  │     ├─ タイムアウト 5000ms
  │     ├─ Content-Type が text/html 以外 → 空 HTML を返す
  │     └─ Content-Length > 1MB → 502
  │
  ├─ [OGP 抽出] ─── ogp.ts / HTMLRewriter
  │     ├─ <meta property="og:*"> をパース
  │     ├─ <meta name="twitter:*"> をパース
  │     └─ og:title が未設定なら <title> テキストをフォールバック
  │
  └─ [キャッシュ書き込み] ─── waitUntil で非同期書き込み (TTL: 3600s)
        └─ X-Cache: MISS ヘッダー付きでレスポンス返却
```

## ソースファイル構成

```
src/
├── index.ts      — Hono アプリ本体・ミドルウェア定義・/ogp ルート
├── security.ts   — URL バリデーション・SSRF ブロックリスト (IPv4/IPv6 CIDR)
├── fetch.ts      — SSRF 保護付きフェッチ (リダイレクト追跡・サイズ制限)
├── ogp.ts        — HTMLRewriter による OGP/Twitter Card メタデータ抽出
├── cache.ts      — Cloudflare Cache API ラッパー (読み書き・TTL 管理)
├── ratelimit.ts  — Cloudflare Rate Limiting バインディングラッパー
└── bot.ts        — AI クローラー User-Agent パターン定義・判定

test/
├── index.test.ts     — エンドツーエンド: ルーティング・ミドルウェア統合
├── fetch.test.ts     — SSRF 保護フェッチのリダイレクト・エラー処理
├── ogp.test.ts       — OGP/Twitter Card 抽出ロジック
├── ratelimit.test.ts — レートリミット制御
└── security.test.ts  — URL バリデーション・CIDR ブロック

wrangler.toml   — Workers 設定 (Rate Limiter binding, ALLOWED_ORIGINS)
```

## セキュリティ対策

| 脅威 | 対策 |
|------|------|
| SSRF | プライベート IP CIDR・ブロックホスト名の拒否、リダイレクト先を再バリデーション |
| 過剰リクエスト | Cloudflare Rate Limiting (IP ベース 60req/min) |
| AI クローラー収集 | User-Agent パターンマッチング + robots.txt |
| 不正オリジン | CORS で ALLOWED_ORIGINS 環境変数による許可リスト制御 |
| レスポンス肥大化 | Content-Length > 1MB で拒否、フェッチタイムアウト 5s |
| 無限リダイレクト | 最大 3 ホップで打ち切り |

## 環境変数 / バインディング

| 名前 | 種別 | 説明 |
|------|------|------|
| `RATE_LIMITER` | Workers binding | Cloudflare Rate Limiting (60req/60s per IP) |
| `ALLOWED_ORIGINS` | 環境変数 (vars) | CORS 許可オリジン (カンマ区切り) |
