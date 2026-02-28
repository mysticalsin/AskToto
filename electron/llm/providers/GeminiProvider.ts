import { GoogleGenerativeAI } from '@google/generative-ai'
import { BaseLLMProvider, type LLMRequestOptions } from './BaseLLMProvider'
import type { ProviderName, StreamCallbacks } from '../types'
import type { RateLimiter } from '../RateLimiter'
import logger from '../../services/Logger'

export class GeminiProvider extends BaseLLMProvider {
  readonly name: ProviderName = 'gemini'
  readonly supportsVision = true
  private genAI: GoogleGenerativeAI | null = null
  private apiKey: string

  constructor(apiKey: string, rateLimiter: RateLimiter) {
    super(rateLimiter)
    this.apiKey = apiKey
    if (apiKey) {
      this.genAI = new GoogleGenerativeAI(apiKey)
    }
  }

  updateApiKey(key: string): void {
    this.apiKey = key
    this.genAI = key ? new GoogleGenerativeAI(key) : null
  }

  isAvailable(): boolean {
    return !!this.apiKey && this.rateLimiter.canProceed(this.name)
  }

  async streamChat(opts: LLMRequestOptions, callbacks: StreamCallbacks, signal: AbortSignal): Promise<void> {
    if (!this.genAI) throw new Error('Gemini API key not set. Go to Settings > API Keys.')

    const model = opts.model || 'gemini-2.0-flash'
    logger.debug('LLM', `Gemini streaming with model=${model}`)

    const genModel = this.genAI.getGenerativeModel({
      model,
      systemInstruction: opts.systemPrompt,
    })

    const parts: any[] = []

    if (opts.screenshot) {
      parts.push({ inlineData: { mimeType: 'image/jpeg', data: opts.screenshot } })
    }

    parts.push({ text: opts.userMessage })

    const result = await genModel.generateContentStream(parts)

    let full = ''
    for await (const chunk of result.stream) {
      if (signal.aborted) break
      const text = chunk.text()
      if (text) {
        full += text
        callbacks.onChunk(text)
      }
    }
    if (!signal.aborted) callbacks.onComplete(full)
  }

  async testConnection(): Promise<boolean> {
    if (!this.genAI) return false
    try {
      const model = this.genAI.getGenerativeModel({ model: 'gemini-2.0-flash' })
      const result = await model.generateContent('Hi')
      return !!result.response
    } catch {
      return false
    }
  }
}
