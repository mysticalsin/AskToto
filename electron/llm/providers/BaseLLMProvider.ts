import type { ProviderName, StreamCallbacks } from '../types'
import type { RateLimiter } from '../RateLimiter'

export interface LLMRequestOptions {
  transcript?: string
  query?: string
  screenshot?: string
  model?: string
  systemPrompt: string
  userMessage: string
  maxTokens?: number
  temperature?: number
}

/**
 * Abstract base class for LLM providers.
 * Each provider implements streaming, connection testing, and vision support.
 */
export abstract class BaseLLMProvider {
  abstract readonly name: ProviderName
  abstract readonly supportsVision: boolean

  protected rateLimiter: RateLimiter

  constructor(rateLimiter: RateLimiter) {
    this.rateLimiter = rateLimiter
  }

  abstract streamChat(
    opts: LLMRequestOptions,
    callbacks: StreamCallbacks,
    signal: AbortSignal
  ): Promise<void>

  abstract testConnection(): Promise<boolean>

  /** Check if this provider is available (has API key and not rate limited) */
  abstract isAvailable(): boolean

  /** Update the API key (e.g. when user changes it in settings) */
  abstract updateApiKey(key: string): void
}
