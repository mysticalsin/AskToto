import logger from '../services/Logger'

export interface Chunk {
  id: string
  text: string
  speaker: string
  meetingId: number
  startIndex: number
  tokenCount: number
}

const TARGET_TOKENS = 300
const MAX_TOKENS = 500

/**
 * Semantic chunker that splits transcripts on speaker turns.
 * Groups consecutive same-speaker utterances and splits on size limits.
 * Target: 300 tokens/chunk, range 100-500.
 */
export class SemanticChunker {
  chunk(transcript: string, meetingId: number): Chunk[] {
    if (!transcript || transcript.trim().length === 0) return []

    const turns = this.splitOnSpeakerTurns(transcript)
    const chunks: Chunk[] = []
    let buffer: string[] = []
    let bufferTokens = 0
    let chunkIndex = 0

    for (const turn of turns) {
      const turnTokens = this.estimateTokens(turn.text)

      // Flush buffer if adding this turn would exceed target
      if (bufferTokens + turnTokens > TARGET_TOKENS && buffer.length > 0) {
        chunks.push(this.createChunk(buffer.join('\n'), meetingId, chunkIndex++, bufferTokens))
        buffer = []
        bufferTokens = 0
      }

      buffer.push(turn.text)
      bufferTokens += turnTokens

      // Force flush if over max
      if (bufferTokens > MAX_TOKENS) {
        chunks.push(this.createChunk(buffer.join('\n'), meetingId, chunkIndex++, bufferTokens))
        buffer = []
        bufferTokens = 0
      }
    }

    // Flush remaining
    if (buffer.length > 0) {
      chunks.push(this.createChunk(buffer.join('\n'), meetingId, chunkIndex++, bufferTokens))
    }

    logger.info('SemanticChunker', `Chunked transcript into ${chunks.length} chunks for meeting ${meetingId}`)
    return chunks
  }

  private splitOnSpeakerTurns(transcript: string): { speaker: string; text: string }[] {
    const lines = transcript.split('\n').filter(l => l.trim())
    const turns: { speaker: string; text: string }[] = []

    for (const line of lines) {
      // Try to detect speaker pattern: "Speaker: text" or "[time] Speaker: text"
      const speakerMatch = line.match(/^(?:\[.*?\]\s*)?([A-Za-z\s]+?):\s+(.+)/)
      if (speakerMatch) {
        turns.push({ speaker: speakerMatch[1].trim(), text: line })
      } else {
        turns.push({ speaker: 'unknown', text: line })
      }
    }

    return turns
  }

  private createChunk(text: string, meetingId: number, index: number, tokenCount: number): Chunk {
    return {
      id: `meeting-${meetingId}-chunk-${index}`,
      text,
      speaker: this.extractPrimarySpeaker(text),
      meetingId,
      startIndex: index,
      tokenCount,
    }
  }

  private extractPrimarySpeaker(text: string): string {
    const match = text.match(/^(?:\[.*?\]\s*)?([A-Za-z\s]+?):/)
    return match ? match[1].trim() : 'unknown'
  }

  /** Rough token estimate: ~4 chars per token */
  private estimateTokens(text: string): number {
    return Math.ceil(text.length / 4)
  }
}
