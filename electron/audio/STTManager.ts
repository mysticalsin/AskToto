import { SettingsManager } from '../services/SettingsManager'
import { WhisperCloudSTT } from './stt/WhisperCloudSTT'
import { WhisperLocalSTT } from './stt/WhisperLocalSTT'
import type { STTBackend } from './stt/STTBackend'
import { transcribeWithFallback } from './stt/transcribeWithFallback'
import logger from '../services/Logger'

export type STTProviderName = 'whisper-cloud' | 'whisper-local'

/**
 * STT Manager with automatic fallback.
 * Routes to the preferred STT provider and falls back on failure.
 */
export class STTManager {
  private providers = new Map<STTProviderName, STTBackend>()
  private settings: SettingsManager

  constructor(settings: SettingsManager) {
    this.settings = settings

    // Register available providers
    this.providers.set('whisper-cloud', new WhisperCloudSTT(settings))
    this.providers.set('whisper-local', new WhisperLocalSTT(settings))
  }

  /** Transcribe audio with automatic fallback on failure */
  async transcribe(wavBuffer: Buffer): Promise<string> {
    const mode = this.settings.get('sttMode', 'cloud')
    const preferred: STTProviderName = mode === 'local' ? 'whisper-local' : 'whisper-cloud'
    const language = this.settings.get('transcriptionLanguage', 'auto')
    const providers = [...this.providers.values()]

    try {
      return await transcribeWithFallback(providers, preferred, wavBuffer, language)
    } catch (err) {
      logger.error('STT', 'All STT providers failed', err)
      throw err
    }
  }
}
