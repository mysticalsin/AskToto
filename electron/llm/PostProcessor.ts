import type { IntentType } from './IntentClassifier'

/**
 * Sanitizes and formats LLM responses.
 * Strips filler prefixes, cleans markdown, limits sentences for concise intents.
 */
export class PostProcessor {
  process(response: string, intent: IntentType): string {
    let result = response

    // 1. Strip common LLM filler prefixes
    result = result.replace(/^(Sure|Of course|Certainly|Absolutely|Great question)[!,.]?\s*/i, '')
    result = result.replace(/^(Here'?s?|I'?d suggest|Let me|I think)\s+(a|the|my|some|that|you)?\s*/i, '')
    result = result.replace(/^(Based on (the|what I|your)|Looking at (the|your)|From (the|what))\s+/i, '')

    // 2. Clean up markdown artifacts
    result = result.replace(/```\n\n```/g, '')  // empty code blocks
    result = result.replace(/\n{3,}/g, '\n\n')   // excessive newlines
    result = result.replace(/^\n+/, '')           // leading newlines
    result = result.replace(/\n+$/, '')           // trailing newlines

    // 3. For concise intents, limit output length
    if (['what_should_i_say', 'question_answer'].includes(intent)) {
      result = this.limitSentences(result, 6)
    }

    // 4. Ensure code blocks are properly closed
    result = this.ensureCodeBlocksClosed(result)

    return result.trim()
  }

  private limitSentences(text: string, max: number): string {
    // Don't limit if text contains code blocks
    if (text.includes('```')) return text

    // Don't limit bulleted lists
    if (/^[\s]*[-*•]/m.test(text)) return text

    const sentences = text.match(/[^.!?]+[.!?]+/g)
    if (!sentences || sentences.length <= max) return text

    return sentences.slice(0, max).join('').trim()
  }

  private ensureCodeBlocksClosed(text: string): string {
    const backtickCount = (text.match(/```/g) || []).length
    if (backtickCount % 2 !== 0) {
      return text + '\n```'
    }
    return text
  }
}
