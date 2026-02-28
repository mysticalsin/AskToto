import OpenAI from 'openai'
import { SettingsManager } from '../services/SettingsManager'
import logger from '../services/Logger'

interface QueueItem {
  text: string
  resolve: (embedding: number[]) => void
  reject: (error: Error) => void
}

const BATCH_SIZE = 10
const INITIAL_BACKOFF_MS = 1000
const MAX_BACKOFF_MS = 30_000

/**
 * Queue-based embedding pipeline using OpenAI's text-embedding-3-small (768 dimensions).
 * Processes embeddings in batches with exponential backoff on failure.
 * Designed for post-meeting processing (non-blocking).
 */
export class EmbeddingPipeline {
  private settings: SettingsManager
  private queue: QueueItem[] = []
  private processing = false
  private backoffMs = INITIAL_BACKOFF_MS

  constructor(settings: SettingsManager) {
    this.settings = settings
  }

  /** Embed a single text. Returns 768-dimensional vector. */
  async embed(text: string): Promise<number[]> {
    return new Promise((resolve, reject) => {
      this.queue.push({ text, resolve, reject })
      this.processQueue()
    })
  }

  /** Embed multiple texts in one call */
  async embedBatch(texts: string[]): Promise<number[][]> {
    return Promise.all(texts.map(t => this.embed(t)))
  }

  /** Check if pipeline is available (has OpenAI key) */
  isAvailable(): boolean {
    return !!this.settings.get('openaiKey', '')
  }

  private async processQueue() {
    if (this.processing || this.queue.length === 0) return
    this.processing = true

    while (this.queue.length > 0) {
      const batch = this.queue.splice(0, BATCH_SIZE)

      try {
        const apiKey = this.settings.get('openaiKey', '')
        if (!apiKey) throw new Error('OpenAI API key required for embeddings')

        const client = new OpenAI({ apiKey })
        const response = await client.embeddings.create({
          model: 'text-embedding-3-small',
          input: batch.map(b => b.text),
        })

        response.data.forEach((emb, i) => {
          batch[i].resolve(emb.embedding)
        })

        this.backoffMs = INITIAL_BACKOFF_MS // Reset on success
        logger.debug('Embeddings', `Embedded ${batch.length} texts`)
      } catch (err) {
        logger.error('Embeddings', `Batch embedding failed`, err)
        batch.forEach(b => b.reject(err as Error))
        this.backoffMs = Math.min(this.backoffMs * 2, MAX_BACKOFF_MS)
        await new Promise(r => setTimeout(r, this.backoffMs))
      }
    }

    this.processing = false
  }
}
