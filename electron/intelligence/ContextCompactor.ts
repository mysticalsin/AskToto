import type { ContextEntry } from './TemporalContextBuilder'
import logger from '../services/Logger'

/**
 * Compacts old context entries by summarizing them.
 * When context exceeds the threshold, older entries are batch-summarized
 * to prevent token bloat in long meetings.
 */
export class ContextCompactor {
  private readonly KEEP_RECENT = 600   // Keep last 600 entries verbatim
  private readonly BATCH_SIZE = 200    // Summarize in batches of 200

  /**
   * Compact context by summarizing older entries.
   * Returns a new array with summaries replacing old entries.
   */
  compact(entries: ContextEntry[]): ContextEntry[] {
    if (entries.length <= this.KEEP_RECENT) return entries

    const keep = entries.slice(-this.KEEP_RECENT)
    const toCompact = entries.slice(0, -this.KEEP_RECENT)

    logger.info('ContextCompactor', `Compacting ${toCompact.length} entries, keeping ${keep.length} recent`)

    // Create simple text summaries (no LLM call needed for basic compaction)
    const summaries: ContextEntry[] = []
    for (let i = 0; i < toCompact.length; i += this.BATCH_SIZE) {
      const batch = toCompact.slice(i, i + this.BATCH_SIZE)
      const summary = this.summarizeBatch(batch)
      summaries.push({
        text: summary,
        speaker: 'system',
        timestamp: batch[0].timestamp,
        source: 'response',
      })
    }

    logger.info('ContextCompactor', `Compacted ${toCompact.length} entries into ${summaries.length} summaries`)
    return [...summaries, ...keep]
  }

  private summarizeBatch(batch: ContextEntry[]): string {
    // Group by speaker and extract key points
    const speakerTexts = new Map<string, string[]>()

    for (const entry of batch) {
      const list = speakerTexts.get(entry.speaker) || []
      list.push(entry.text)
      speakerTexts.set(entry.speaker, list)
    }

    const parts: string[] = ['[Compacted context summary]']
    for (const [speaker, texts] of speakerTexts) {
      // Take first and last entries as representative
      const first = texts[0]?.slice(0, 100)
      const last = texts[texts.length - 1]?.slice(0, 100)
      parts.push(`${speaker} (${texts.length} entries): "${first}"${texts.length > 1 ? ` ... "${last}"` : ''}`)
    }

    return parts.join('\n')
  }
}
