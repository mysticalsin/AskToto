/**
 * Operation modes for the intelligence layer.
 * Maps to QuickActions in the UI: Assist, What should I say?, Follow-up, Recap, etc.
 */
export type OperationMode =
  | 'assist'
  | 'what_should_i_say'
  | 'follow_up'
  | 'recap'
  | 'manual'
  | 'follow_up_questions'

export interface ModeConfig {
  description: string
  promptSuffix: string
  maxResponseTokens: number
  includeScreenshot: boolean
}

export const MODE_CONFIG: Record<OperationMode, ModeConfig> = {
  assist: {
    description: 'General meeting assistance',
    promptSuffix: 'Provide concise, actionable help for the current moment. Focus on what the user needs to know right now.',
    maxResponseTokens: 300,
    includeScreenshot: true,
  },
  what_should_i_say: {
    description: 'Suggest response in first person',
    promptSuffix: 'Write a response the user should say, in FIRST PERSON. Make it natural and conversational — something they can read aloud. 2-4 sentences max.',
    maxResponseTokens: 200,
    includeScreenshot: false,
  },
  follow_up: {
    description: 'Continue from previous response',
    promptSuffix: 'Build on the previous response with additional details, nuances, or next steps. Do NOT repeat what was already said.',
    maxResponseTokens: 300,
    includeScreenshot: true,
  },
  recap: {
    description: 'Summarize the conversation so far',
    promptSuffix: 'Provide a structured recap:\n- **Key Points**: What was discussed\n- **Decisions**: Any decisions made\n- **Action Items**: Tasks and next steps',
    maxResponseTokens: 500,
    includeScreenshot: false,
  },
  manual: {
    description: 'Direct query mode',
    promptSuffix: 'Answer the user\'s specific question directly and thoroughly.',
    maxResponseTokens: 500,
    includeScreenshot: true,
  },
  follow_up_questions: {
    description: 'Suggest questions to ask',
    promptSuffix: 'Suggest 3-5 thoughtful, strategic follow-up questions the user could ask. Each should uncover useful information or advance the conversation.',
    maxResponseTokens: 250,
    includeScreenshot: false,
  },
}
