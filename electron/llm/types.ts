export interface Message {
  role: 'system' | 'user' | 'assistant'
  content: string | ContentPart[]
}

export interface ContentPart {
  type: 'text' | 'image_url' | 'image'
  text?: string
  image_url?: { url: string; detail?: string }
  // Anthropic format
  source?: { type: 'base64'; media_type: string; data: string }
}

export interface LLMOptions {
  model?: string
  maxTokens?: number
  temperature?: number
  screenshot?: string // base64 PNG
}

export interface StreamCallbacks {
  onChunk: (chunk: string) => void
  onComplete: (fullResponse: string) => void
  onError: (error: string) => void
}

export type ProviderName = 'openai' | 'anthropic' | 'gemini' | 'kimi'
