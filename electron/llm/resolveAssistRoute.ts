import type { ProviderName } from './types'

const PROVIDERS: ProviderName[] = ['openai', 'anthropic', 'gemini', 'kimi']

function isProviderName(value: string | undefined): value is ProviderName {
  return !!value && (PROVIDERS as string[]).includes(value)
}

/**
 * Resolve which provider Assist should call.
 *
 * Settings are the source of truth. The overlay window caches
 * `activeProvider` once on mount and would otherwise override a later
 * Dashboard change, sending the old provider (and its model) forever.
 */
export function resolveAssistProvider(
  settingsActiveProvider: string | undefined,
  _rendererProvider?: string
): ProviderName {
  if (isProviderName(settingsActiveProvider)) return settingsActiveProvider
  return 'openai'
}
