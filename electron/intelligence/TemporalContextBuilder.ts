import logger from '../services/Logger'

export interface ContextEntry {
  text: string
  speaker: 'user' | 'other' | 'system'
  timestamp: number
  source: 'transcript' | 'query' | 'response'
}

export interface TemporalContext {
  recentTopics: string[]
  previousResponsePoints: string[]
  detectedSpeakers: string[]
  antiRepetitionHint: string
}

/**
 * Builds temporal context from the conversation window.
 * Used for anti-repetition and contextual awareness.
 */
export class TemporalContextBuilder {
  private readonly WINDOW_SECONDS = 180 // 3-minute window

  build(context: ContextEntry[]): TemporalContext {
    const now = Date.now()
    const cutoff = now - (this.WINDOW_SECONDS * 1000)
    const recent = context.filter(e => e.timestamp > cutoff)

    return {
      recentTopics: this.extractTopics(recent),
      previousResponsePoints: this.extractResponsePoints(recent),
      detectedSpeakers: this.detectSpeakers(recent),
      antiRepetitionHint: this.buildAntiRepetitionHint(recent),
    }
  }

  private extractTopics(entries: ContextEntry[]): string[] {
    // Extract key noun phrases from recent entries
    const topics = new Set<string>()
    const allText = entries.map(e => e.text).join(' ').toLowerCase()

    // Simple keyword extraction — look for capitalized words and repeated terms
    const words = allText.split(/\s+/)
    const wordFreq = new Map<string, number>()
    for (const w of words) {
      if (w.length < 4) continue
      const clean = w.replace(/[^a-z0-9]/g, '')
      if (clean) wordFreq.set(clean, (wordFreq.get(clean) || 0) + 1)
    }

    // Return words that appear more than once (likely topic-related)
    for (const [word, count] of wordFreq) {
      if (count >= 2 && word.length > 4) topics.add(word)
    }

    return Array.from(topics).slice(0, 10)
  }

  private extractResponsePoints(entries: ContextEntry[]): string[] {
    const responses = entries.filter(e => e.source === 'response')
    const points: string[] = []

    for (const r of responses.slice(-3)) { // Last 3 responses
      // Extract first sentence of each response as key point
      const firstSentence = r.text.match(/^[^.!?]+[.!?]/)
      if (firstSentence) {
        points.push(firstSentence[0].trim())
      }
    }

    return points
  }

  private detectSpeakers(entries: ContextEntry[]): string[] {
    const speakers = new Set<string>()
    for (const e of entries) {
      if (e.speaker !== 'system') speakers.add(e.speaker)
    }
    return Array.from(speakers)
  }

  private buildAntiRepetitionHint(entries: ContextEntry[]): string {
    const responses = entries.filter(e => e.source === 'response')
    if (responses.length === 0) return ''

    const points = this.extractResponsePoints(entries)
    if (points.length === 0) return ''

    return `Previously covered: ${points.join('; ')}. Provide NEW information — do NOT repeat these points.`
  }
}
