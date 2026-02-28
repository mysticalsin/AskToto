import Anthropic from '@anthropic-ai/sdk'
import { BaseLLMProvider, type LLMRequestOptions } from './BaseLLMProvider'
import type { ProviderName, StreamCallbacks } from '../types'
import type { RateLimiter } from '../RateLimiter'
import logger from '../../services/Logger'

const REQUEST_TIMEOUT = 60_000

export class AnthropicProvider extends BaseLLMProvider {
  readonly name: ProviderName = 'anthropic'
  readonly supportsVision = true
  private client: Anthropic | null = null
  private apiKey: string

  constructor(apiKey: string, rateLimiter: RateLimiter) {
    super(rateLimiter)
    this.apiKey = apiKey
    if (apiKey) {
      this.client = new Anthropic({ apiKey, timeout: REQUEST_TIMEOUT })
    }
  }

  updateApiKey(key: string): void {
    this.apiKey = key
    this.client = key ? new Anthropic({ apiKey: key, timeout: REQUEST_TIMEOUT }) : null
  }

  isAvailable(): boolean {
    return !!this.apiKey && this.rateLimiter.canProceed(this.name)
  }

  async streamChat(opts: LLMRequestOptions, callbacks: StreamCallbacks, signal: AbortSignal): Promise<void> {
    if (!this.client) throw new Error('Anthropic API key not set. Go to Settings > API Keys.')

    const content: any[] = []

    if (opts.screenshot) {
      content.push({
        type: 'image',
        source: { type: 'base64', media_type: 'image/jpeg', data: opts.screenshot }
      })
    }

    content.push({ type: 'text', text: opts.userMessage })

    const model = opts.model || 'claude-sonnet-4-20250514'
    logger.debug('LLM', `Anthropic streaming with model=${model}`)

    const stream = this.client.messages.stream({
      model,
      system: opts.systemPrompt,
      messages: [{ role: 'user', content }],
      max_tokens: opts.maxTokens || 2048,
      temperature: opts.temperature || 0.7,
    })

    // MINOR-8 fix: Abort the underlying stream when signal fires
    const onAbort = () => { stream.abort() }
    signal.addEventListener('abort', onAbort, { once: true })

    let full = ''
    stream.on('text', (text) => {
      if (signal.aborted) return
      full += text
      callbacks.onChunk(text)
    })

    try {
      await stream.finalMessage()
      if (!signal.aborted) callbacks.onComplete(full)
    } finally {
      signal.removeEventListener('abort', onAbort)
    }
  }

  async testConnection(): Promise<boolean> {
    if (!this.client) return false
    try {
      const msg = await this.client.messages.create({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 10,
        messages: [{ role: 'user', content: 'Hi' }]
      })
      return !!msg.content
    } catch {
      return false
    }
  }
}
