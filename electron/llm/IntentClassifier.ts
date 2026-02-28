/**
 * Fast regex-based intent classification (~0ms).
 * Determines response style and prompt variant before the LLM call.
 */
export type IntentType =
  | 'question_answer'     // A question was asked in transcript
  | 'code_help'           // Code visible on screen
  | 'follow_up'           // Continue previous topic
  | 'summarize'           // Request for summary
  | 'what_should_i_say'   // Suggest what to say
  | 'explain'             // Explain something
  | 'action_item'         // Extract action items
  | 'general'             // Default

export class IntentClassifier {
  classify(opts: {
    transcript?: string
    query?: string
    hasScreenshot?: boolean
  }): IntentType {
    const query = (opts.query || '').toLowerCase()
    const transcript = (opts.transcript || '').toLowerCase()

    // Check explicit query patterns first (highest priority)
    if (/what should i (say|respond|answer|tell|reply)/i.test(query)) return 'what_should_i_say'
    if (/summar(y|ize|ise)|recap|overview/i.test(query)) return 'summarize'
    if (/action.?item|todo|follow.?up|next.?step/i.test(query)) return 'action_item'
    if (/explain|what (is|are|does|was|were)|how (does|do|is|are|did)/i.test(query)) return 'explain'
    if (/follow.?up|more detail|elaborate|continue|expand/i.test(query)) return 'follow_up'

    // Code detection — check query + screenshot
    if (opts.hasScreenshot && /code|function|error|bug|debug|fix|implement|syntax|compile/i.test(query)) {
      return 'code_help'
    }

    // Check if a question was just asked in transcript (last 300 chars)
    if (!query) {
      const recentTranscript = transcript.slice(-300)
      if (/\?\s*$/.test(recentTranscript)) return 'question_answer'
    }

    // Default: if there's a query treat as general, otherwise question_answer
    return query ? 'general' : 'question_answer'
  }
}
