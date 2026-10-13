export const DEFAULT_PROVIDER_MODELS: Record<string, string> = {
  openai: 'gpt-4o',
  anthropic: 'claude-sonnet-4-20250514',
  gemini: 'gemini-2.0-flash',
  kimi: 'kimi-k2-0905-preview',
}

const MODEL_PREFIXES: Record<string, string[]> = {
  openai: ['gpt-', 'o1', 'o3', 'o4', 'chatgpt-'],
  anthropic: ['claude-'],
  gemini: ['gemini-'],
  kimi: ['kimi-', 'moonshot-'],
}

/** True when `model` is a name that provider will accept. */
export function modelBelongsToProvider(provider: string, model: string): boolean {
  if (!provider || !model) return false
  const prefixes = MODEL_PREFIXES[provider]
  if (!prefixes) return false
  return prefixes.some((prefix) => model.startsWith(prefix))
}

/**
 * Pick a model the target provider will actually accept.
 *
 * `activeModel` is a single global setting (default gpt-4o). If the caller
 * is using a different provider — or the stored model belongs to someone
 * else — return that provider's default instead of a foreign model id.
 */
export function resolveProviderModel(
  provider: string,
  activeProvider: string,
  activeModel?: string | null,
): string {
  const fallback = DEFAULT_PROVIDER_MODELS[provider] || ''
  if (
    provider === activeProvider &&
    activeModel &&
    modelBelongsToProvider(provider, activeModel)
  ) {
    return activeModel
  }
  return fallback
}
