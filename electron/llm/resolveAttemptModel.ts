import type { ProviderName } from './types'

export const DEFAULT_PROVIDER_MODELS: Record<ProviderName, string> = {
  openai: 'gpt-4o',
  anthropic: 'claude-sonnet-4-20250514',
  gemini: 'gemini-2.0-flash',
  kimi: 'kimi-k2-0905-preview',
}

/**
 * Each fallback attempt must use a model that belongs to THAT provider.
 * Passing the preferred provider's model (e.g. gpt-4o) through to Anthropic,
 * Gemini, or Kimi makes the entire fallback chain fail with invalid-model errors.
 */
export function resolveAttemptModel(
  providerName: ProviderName,
  preferredProvider: ProviderName,
  requestedModel: string | undefined,
  modelForProvider: (provider: ProviderName) => string = (p) => DEFAULT_PROVIDER_MODELS[p]
): string {
  if (providerName === preferredProvider && requestedModel) {
    return requestedModel
  }
  return modelForProvider(providerName) || DEFAULT_PROVIDER_MODELS[providerName]
}
