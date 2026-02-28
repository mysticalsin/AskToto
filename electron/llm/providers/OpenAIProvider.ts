import OpenAI from 'openai'
import { BaseLLMProvider, type LLMRequestOptions } from './BaseLLMProvider'
import type { ProviderName, StreamCallbacks } from '../types'
import type { RateLimiter } from '../RateLimiter'
import logger from '../../services/Logger'

const REQUEST_TIMEOUT = 60_000

export class OpenAIProvider extends BaseLLMProvider {
  readonly name: ProviderName = 'openai'
  readonly supportsVision = true
  private client: OpenAI | null = null
  private apiKey: string

  constructor(apiKey: string, rateLimiter: RateLimiter) {
    super(rateLimiter)
    this.apiKey = apiKey
    if (apiKey) {
      this.client = new OpenAI({ apiKey, timeout: REQUEST_TIMEOUT })
    }
  }

  updateApiKey(key: string): void {
    this.apiKey = key
    this.client = key ? new OpenAI({ apiKey: key, timeout: REQUEST_TIMEOUT }) : null
  }

  isAvailable(): boolean {
    return !!this.apiKey && this.rateLimiter.canProceed(this.name)
  }

  async streamChat(opts: LLMRequestOptions, callbacks: StreamCallbacks, signal: AbortSignal): Promise<void> {
    if (!this.client) throw new Error('OpenAI API key not set. Go to Settings > API Keys.')

    const userContent: any[] = []

    if (opts.screenshot) {
      userContent.push({
        type: 'image_url',
        image_url: { url: `data:image/jpeg;base64,${opts.screenshot}`, detail: 'high' }
      })
    }

    userContent.push({ type: 'text', text: opts.userMessage })

    const model = opts.model || 'gpt-4o'
    logger.debug('LLM', `OpenAI streaming with model=${model}`)

    const stream = await this.client.chat.completions.create({
      model,
      messages: [
        { role: 'system', content: opts.systemPrompt },
        { role: 'user', content: userContent }
      ],
      max_tokens: opts.maxTokens || 2048,
      temperature: opts.temperature || 0.7,
      stream: true,
    })

    let full = ''
    for await (const chunk of stream) {
      if (signal.aborted) break
      const delta = chunk.choices[0]?.delta?.content
      if (delta) {
        full += delta
        callbacks.onChunk(delta)
      }
    }
    if (!signal.aborted) callbacks.onComplete(full)
  }

  async testConnection(): Promise<boolean> {
    if (!this.client) return false
    try {
      await this.client.models.list()
      return true
    } catch {
      return false
    }
  }
}
