import type { ProviderName } from './types'
import logger from '../services/Logger'

interface ProviderState {
  tokens: number
  maxTokens: number
  refillRate: number        // tokens per second
  lastRefill: number        // timestamp
  backoffUntil: number      // timestamp — don't use before this time
  consecutiveFailures: number
}

const DEFAULT_MAX_TOKENS = 10
const DEFAULT_REFILL_RATE = 1 // 1 token per second
const BASE_BACKOFF_MS = 60_000 // 60 seconds on 429

/**
 * Per-provider rate limiter with token bucket and exponential backoff.
 * Prevents 429 errors from free-tier API usage.
 */
export class RateLimiter {
  private providers = new Map<ProviderName, ProviderState>()

  private getOrCreate(provider: ProviderName): ProviderState {
    let state = this.providers.get(provider)
    if (!state) {
      state = {
        tokens: DEFAULT_MAX_TOKENS,
        maxTokens: DEFAULT_MAX_TOKENS,
        refillRate: DEFAULT_REFILL_RATE,
        lastRefill: Date.now(),
        backoffUntil: 0,
        consecutiveFailures: 0,
      }
      this.providers.set(provider, state)
    }
    return state
  }

  private refill(state: ProviderState): void {
    const now = Date.now()
    const elapsed = (now - state.lastRefill) / 1000
    const newTokens = elapsed * state.refillRate
    state.tokens = Math.min(state.maxTokens, state.tokens + newTokens)
    state.lastRefill = now
  }

  /** Check if a request can proceed (has tokens and not in backoff) */
  canProceed(provider: ProviderName): boolean {
    const state = this.getOrCreate(provider)
    this.refill(state)

    if (Date.now() < state.backoffUntil) {
      return false
    }

    return state.tokens >= 1
  }

  /** Consume a token before making a request */
  consume(provider: ProviderName): void {
    const state = this.getOrCreate(provider)
    this.refill(state)
    state.tokens = Math.max(0, state.tokens - 1)
  }

  /** Report a failed request — triggers backoff on rate limit errors */
  reportFailure(provider: ProviderName, statusCode?: number): void {
    const state = this.getOrCreate(provider)
    state.consecutiveFailures++

    if (statusCode === 429) {
      // Rate limited — exponential backoff
      const backoff = BASE_BACKOFF_MS * Math.pow(2, Math.min(state.consecutiveFailures - 1, 5))
      state.backoffUntil = Date.now() + backoff
      logger.warn('RateLimiter', `Provider ${provider} rate limited. Backing off for ${backoff / 1000}s`)
    }
  }

  /** Report a successful request — resets failure counter */
  reportSuccess(provider: ProviderName): void {
    const state = this.getOrCreate(provider)
    state.consecutiveFailures = 0
    state.backoffUntil = 0
  }

  /** Get remaining backoff time in ms (0 if not in backoff) */
  getBackoffMs(provider: ProviderName): number {
    const state = this.getOrCreate(provider)
    return Math.max(0, state.backoffUntil - Date.now())
  }
}
