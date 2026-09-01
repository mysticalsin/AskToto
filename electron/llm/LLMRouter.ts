import type { ProviderName, StreamCallbacks } from './types'
import type { LLMRequestOptions } from './providers/BaseLLMProvider'
import type { BaseLLMProvider } from './providers/BaseLLMProvider'
import { RateLimiter } from './RateLimiter'
import { SettingsManager } from '../services/SettingsManager'
import { OpenAIProvider } from './providers/OpenAIProvider'
import { AnthropicProvider } from './providers/AnthropicProvider'
import { GeminiProvider } from './providers/GeminiProvider'
import { KimiProvider } from './providers/KimiProvider'
import { resolveAttemptModel } from './resolveAttemptModel'
import logger from '../services/Logger'

/**
 * LLM Router with automatic fallback chains.
 * Tries the preferred provider first, then falls back to others on failure.
 * Each provider is rate-limited independently.
 * MODERATE-7 fix: Uses event-driven key refresh via SettingsManager.onChange
 */
export class LLMRouter {
  private providers = new Map<ProviderName, BaseLLMProvider>()
  private rateLimiter: RateLimiter
  private settings: SettingsManager
  private activeAbort: AbortController | null = null
  private unsubscribers: (() => void)[] = []

  // Fallback chains (order matters)
  private textChain: ProviderName[] = ['openai', 'anthropic', 'gemini', 'kimi']
  private visionChain: ProviderName[] = ['gemini', 'openai', 'anthropic', 'kimi']

  constructor(settings: SettingsManager) {
    this.settings = settings
    this.rateLimiter = new RateLimiter()

    // Initialize all providers
    this.providers.set('openai', new OpenAIProvider(settings.get('openaiKey', ''), this.rateLimiter))
    this.providers.set('anthropic', new AnthropicProvider(settings.get('anthropicKey', ''), this.rateLimiter))
    this.providers.set('gemini', new GeminiProvider(settings.get('geminiKey', ''), this.rateLimiter))
    this.providers.set('kimi', new KimiProvider(settings.get('kimiKey', ''), this.rateLimiter))

    // MODERATE-7 fix: Subscribe to API key changes reactively instead of polling
    const keyMap: Record<string, ProviderName> = {
      openaiKey: 'openai',
      anthropicKey: 'anthropic',
      geminiKey: 'gemini',
      kimiKey: 'kimi',
    }
    for (const [settingKey, providerName] of Object.entries(keyMap)) {
      const unsub = settings.onChange(settingKey as any, (newVal: any) => {
        this.providers.get(providerName)?.updateApiKey(newVal || '')
        logger.info('LLMRouter', `API key updated for ${providerName}`)
      })
      this.unsubscribers.push(unsub)
    }

    logger.info('LLMRouter', 'Initialized with providers: ' +
      Array.from(this.providers.entries())
        .filter(([, p]) => p.isAvailable())
        .map(([name]) => name)
        .join(', ') || 'none (no API keys set)')
  }

  /** Cancel any in-progress streaming request */
  abort() {
    if (this.activeAbort) {
      this.activeAbort.abort()
      this.activeAbort = null
    }
  }

  /** Clean up event listeners */
  dispose() {
    this.unsubscribers.forEach(fn => fn())
    this.unsubscribers = []
  }

  /**
   * Stream a chat completion with automatic fallback.
   * Tries the preferred provider first, then falls back through the chain.
   */
  async streamChat(
    opts: LLMRequestOptions & { provider?: ProviderName },
    callbacks: StreamCallbacks
  ): Promise<void> {
    this.abort()
    this.activeAbort = new AbortController()

    const hasVision = !!opts.screenshot
    const chain = hasVision ? this.visionChain : this.textChain
    const preferred = opts.provider || this.settings.get('activeProvider', 'openai') as ProviderName

    // Build ordered provider list: preferred first, then chain
    const ordered: ProviderName[] = [preferred, ...chain.filter(p => p !== preferred)]

    const errors: string[] = []

    for (const providerName of ordered) {
      const provider = this.providers.get(providerName)
      if (!provider || !provider.isAvailable()) {
        continue
      }

      const model = resolveAttemptModel(
        providerName,
        preferred,
        opts.model,
        (p) => this.settings.getModelForProvider(p)
      )

      try {
        logger.info('LLMRouter', `Trying provider: ${providerName} model=${model}`)
        this.rateLimiter.consume(providerName)
        await provider.streamChat({ ...opts, model }, callbacks, this.activeAbort.signal)
        this.rateLimiter.reportSuccess(providerName)
        return // Success — done
      } catch (err: any) {
        if (err?.name === 'AbortError') return // User cancelled

        this.rateLimiter.reportFailure(providerName, err?.status)
        const msg = err?.message || 'Unknown error'
        errors.push(`${providerName}: ${msg}`)
        logger.warn('LLMRouter', `Provider ${providerName} failed: ${msg}`)
        continue // Try next provider
      }
    }

    // All providers failed
    const errorMsg = errors.length > 0
      ? `All providers failed:\n${errors.join('\n')}`
      : 'No available LLM providers. Check your API keys in Settings.'
    callbacks.onError(errorMsg)
  }

  /** Test connection to a specific provider */
  async testConnection(provider: ProviderName): Promise<boolean> {
    const p = this.providers.get(provider)
    if (!p) return false
    try {
      return await p.testConnection()
    } catch (err) {
      logger.error('LLMRouter', `Connection test failed for ${provider}`, err)
      return false
    }
  }

  /** Get the RateLimiter instance for external access */
  getRateLimiter(): RateLimiter {
    return this.rateLimiter
  }
}
