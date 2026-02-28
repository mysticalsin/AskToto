import { SettingsManager } from '../services/SettingsManager'
import { WhisperCloudSTT } from './stt/WhisperCloudSTT'
import { WhisperLocalSTT } from './stt/WhisperLocalSTT'
import type { STTBackend } from './stt/STTBackend'
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

    // Try preferred provider first
    try {
      const provider = this.providers.get(preferred)
      if (!provider) throw new Error(`STT provider ${preferred} not registered`)
      return await provider.transcribe(wavBuffer, language)
    } catch (err) {
      logger.warn('STT', `Primary STT (${preferred}) failed, trying fallback`, err)

      // Try fallback providers
      for (const [name, provider] of this.providers) {
        if (name === preferred) continue
        if (!provider.isAvailable()) continue

        try {
          logger.info('STT', `Falling back to ${name}`)
          return await provider.transcribe(wavBuffer, language)
        } catch (fallbackErr) {
          logger.warn('STT', `Fallback STT (${name}) also failed`, fallbackErr)
          continue
        }
      }

      // All providers failed — graceful degradation
      logger.error('STT', 'All STT providers failed')
      return ''
    }
  }
}
