import { EventEmitter } from 'events'
import { LLMRouter } from '../llm/LLMRouter'
import { IntentClassifier, type IntentType } from '../llm/IntentClassifier'
import { PostProcessor } from '../llm/PostProcessor'
import { TemporalContextBuilder, type ContextEntry, type TemporalContext } from './TemporalContextBuilder'
import { ContextCompactor } from './ContextCompactor'
import { MODE_CONFIG, type OperationMode } from './modes'
import { SYSTEM_PROMPT, buildUserMessage } from '../llm/prompts'
import type { ProviderName, StreamCallbacks } from '../llm/types'
import logger from '../services/Logger'

const MAX_CONTEXT_ENTRIES = 1800
const CONTEXT_WINDOW_SECONDS = 120

/**
 * IntelligenceManager — Central orchestrator for the AI assistant.
 * Manages conversation context, intent classification, temporal awareness,
 * anti-repetition, and routes to the appropriate LLM strategy.
 *
 * Extends EventEmitter for decoupled communication:
 * - 'response-chunk': incremental streaming text
 * - 'response-complete': full processed response
 * - 'error': error message
 */
export class IntelligenceManager extends EventEmitter {
  private contextWindow: ContextEntry[] = []
  private llmRouter: LLMRouter
  private intentClassifier: IntentClassifier
  private postProcessor: PostProcessor
  private temporalContextBuilder: TemporalContextBuilder
  private contextCompactor: ContextCompactor
  private lastResponses: string[] = [] // Track last 10 responses for anti-repetition

  constructor(llmRouter: LLMRouter) {
    super()
    this.llmRouter = llmRouter
    this.intentClassifier = new IntentClassifier()
    this.postProcessor = new PostProcessor()
    this.temporalContextBuilder = new TemporalContextBuilder()
    this.contextCompactor = new ContextCompactor()
  }

  /**
   * Process an AI request through the full intelligence pipeline.
   */
  async processRequest(opts: {
    transcript?: string
    query?: string
    screenshot?: string
    mode?: OperationMode
    provider?: ProviderName
    model?: string
  }, callbacks: StreamCallbacks): Promise<void> {
    const mode = opts.mode || 'assist'
    const modeConfig = MODE_CONFIG[mode]

    // 1. Update context window with new data
    if (opts.transcript) {
      this.addToContext(opts.transcript, 'other', 'transcript')
    }
    if (opts.query) {
      this.addToContext(opts.query, 'user', 'query')
    }

    // 2. Classify intent
    const intent = this.intentClassifier.classify({
      transcript: opts.transcript,
      query: opts.query,
      hasScreenshot: !!opts.screenshot,
    })
    logger.debug('Intelligence', `Mode: ${mode}, Intent: ${intent}`)

    // 3. Build temporal context (anti-repetition)
    const temporalCtx = this.temporalContextBuilder.build(this.contextWindow)

    // 4. Compact context if it's too large
    if (this.contextWindow.length > MAX_CONTEXT_ENTRIES) {
      this.contextWindow = this.contextCompactor.compact(this.contextWindow)
    }

    // 5. Build system prompt with mode + intent guidance
    const systemPrompt = this.buildSystemPrompt(intent, mode, temporalCtx)

    // 6. Build user message
    const userMessage = this.buildEnhancedUserMessage(opts, temporalCtx)

    // 7. Route to LLM with wrapped callbacks
    const wrappedCallbacks: StreamCallbacks = {
      onChunk: (chunk) => {
        callbacks.onChunk(chunk)
        this.emit('response-chunk', chunk)
      },
      onComplete: (response) => {
        // Post-process the response
        const processed = this.postProcessor.process(response, intent)

        // Track for anti-repetition
        this.addToContext(processed, 'system', 'response')
        this.lastResponses.push(processed)
        if (this.lastResponses.length > 10) this.lastResponses.shift()

        callbacks.onComplete(processed)
        this.emit('response-complete', processed)
      },
      onError: (error) => {
        callbacks.onError(error)
        this.emit('error', error)
      },
    }

    await this.llmRouter.streamChat({
      ...opts,
      systemPrompt,
      userMessage,
      maxTokens: modeConfig.maxResponseTokens,
      screenshot: modeConfig.includeScreenshot ? opts.screenshot : undefined,
    }, wrappedCallbacks)
  }

  /** Add an entry to the context window */
  addToContext(text: string, speaker: ContextEntry['speaker'], source: ContextEntry['source']): void {
    this.contextWindow.push({
      text,
      speaker,
      timestamp: Date.now(),
      source,
    })
  }

  /** Get recent context entries (within the time window) */
  getRecentContext(): ContextEntry[] {
    const cutoff = Date.now() - (CONTEXT_WINDOW_SECONDS * 1000)
    return this.contextWindow.filter(e => e.timestamp > cutoff)
  }

  /** Clear all context (e.g., when starting a new meeting) */
  clearContext(): void {
    this.contextWindow = []
    this.lastResponses = []
    logger.info('Intelligence', 'Context cleared')
  }

  /** Get context size for monitoring */
  getContextSize(): number {
    return this.contextWindow.length
  }

  // ── Private Helpers ─────────────────────────────────────────────────

  private buildSystemPrompt(intent: IntentType, mode: OperationMode, temporalCtx: TemporalContext): string {
    const modeConfig = MODE_CONFIG[mode]
    let prompt = SYSTEM_PROMPT

    // Add mode-specific guidance
    prompt += `\n\n## Mode: ${mode}\n${modeConfig.promptSuffix}`

    // Add anti-repetition hint if we have previous responses
    if (temporalCtx.antiRepetitionHint) {
      prompt += `\n\n## Important\n${temporalCtx.antiRepetitionHint}`
    }

    return prompt
  }

  private buildEnhancedUserMessage(opts: {
    transcript?: string
    query?: string
    screenshot?: string
  }, temporalCtx: TemporalContext): string {
    const base = buildUserMessage({
      transcript: opts.transcript,
      query: opts.query,
      hasScreenshot: !!opts.screenshot,
    })

    // Add temporal context if we have recent conversation
    if (temporalCtx.recentTopics.length > 0) {
      return base + `\n\n## Conversation Context\nRecent topics: ${temporalCtx.recentTopics.join(', ')}`
    }

    return base
  }
}
