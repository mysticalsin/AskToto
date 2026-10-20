export type SttMode = 'cloud' | 'local'

export type SttReadiness =
  | { ok: true }
  | { ok: false; reason: string }

export const CLOUD_STT_REQUIRES_OPENAI =
  'Cloud transcription requires an OpenAI API key. Add one in Settings → API Keys, or switch Speech-to-Text to Local.'

/**
 * Cloud Whisper is the default STT backend and only works with an OpenAI key.
 * Local mode is opted-in separately. Call this before starting a recording so
 * we do not create a meeting that can never be transcribed.
 */
export function getSttReadiness(sttMode: SttMode | string, hasOpenAIKey: boolean): SttReadiness {
  if (sttMode === 'local') return { ok: true }
  if (hasOpenAIKey) return { ok: true }
  return { ok: false, reason: CLOUD_STT_REQUIRES_OPENAI }
}
