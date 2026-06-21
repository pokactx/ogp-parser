const AI_BOT_PATTERNS = [
  'GPTBot',
  'ChatGPT-User',
  'ClaudeBot',
  'Claude-Web',
  'anthropic-ai',
  'Meta-ExternalAgent',
  'Meta-ExternalFetcher',
  'Bytespider',
  'Amazonbot',
  'PerplexityBot',
  'cohere-ai',
  'YouBot',
  'CCBot',
  'omgili',
]

const BOT_REGEX = new RegExp(AI_BOT_PATTERNS.join('|'), 'i')

export function isAiBot(userAgent: string): boolean {
  return BOT_REGEX.test(userAgent)
}
