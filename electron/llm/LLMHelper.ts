import { SettingsManager } from '../services/SettingsManager'
import { LLMRouter } from './LLMRouter'
import { IntentClassifier } from './IntentClassifier'
import { PostProcessor } from './PostProcessor'
import { getSystemPrompt, buildUserMessage } from './prompts'
import type { ProviderName, StreamCallbacks } from './types'
import logger from '../services/Logger'

/**
 * LLMHelper — Thin facade over LLMRouter with intent classification and post-processing.
 * This is the main interface used by IPC handlers.
 */
export class LLMHelper {
  private router: LLMRouter
  private intentClassifier: IntentClassifier
  private postProcessor: PostProcessor

  constructor(settings: SettingsManager) {
    this.router = new LLMRouter(settings)
    this.intentClassifier = new IntentClassifier()
    this.postProcessor = new PostProcessor()
  }

  abort() {
    this.router.abort()
  }

  async streamChat(opts: {
    transcript?: string
    query?: string
    screenshot?: string
    provider?: ProviderName
    model?: string
    activeMode?: string    // CRITICAL-4 fix: accept custom mode
    responseLanguage?: string  // Language for AI responses
  }, callbacks: StreamCallbacks): Promise<void> {
    // 1. Classify intent (~0ms, regex-based)
    const intent = this.intentClassifier.classify({
      transcript: opts.transcript,
      query: opts.query,
      hasScreenshot: !!opts.screenshot,
    })

    logger.debug('LLM', `Classified intent: ${intent}, mode: ${opts.activeMode || 'default'}, responseLang: ${opts.responseLanguage || 'en'}`)

    // 2. Build prompt with intent-specific guidance and response language
    // CRITICAL-4 fix: If a custom mode is set, use it to augment the system prompt
    let systemPrompt = getSystemPrompt(intent, opts.responseLanguage)
    if (opts.activeMode && opts.activeMode !== 'General' && opts.activeMode !== 'Default') {
      systemPrompt += `\n\nYou are currently in "${opts.activeMode}" mode. Tailor your responses accordingly.`
    }

    const userMessage = buildUserMessage({
      transcript: opts.transcript,
      query: opts.query,
      hasScreenshot: !!opts.screenshot,
    })

    // 3. Wrap callbacks with post-processing on complete
    const wrappedCallbacks: StreamCallbacks = {
      onChunk: callbacks.onChunk,
      onComplete: (fullResponse) => {
        const processed = this.postProcessor.process(fullResponse, intent)
        callbacks.onComplete(processed)
      },
      onError: callbacks.onError,
    }

    // 4. Route to provider with fallback chain
    await this.router.streamChat({
      ...opts,
      systemPrompt,
      userMessage,
    }, wrappedCallbacks)
  }

  async testConnection(provider: ProviderName): Promise<boolean> {
    return this.router.testConnection(provider)
  }

  /** Get the underlying router for advanced usage */
  getRouter(): LLMRouter {
    return this.router
  }
}
