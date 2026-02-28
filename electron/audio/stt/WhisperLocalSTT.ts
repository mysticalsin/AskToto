import { STTBackend } from './STTBackend'
import { SettingsManager } from '../../services/SettingsManager'
import logger from '../../services/Logger'

/**
 * Local Faster-Whisper server transcription.
 * Sends audio to the Python FastAPI server running locally.
 */
export class WhisperLocalSTT extends STTBackend {
  readonly name = 'whisper-local'
  private settings: SettingsManager

  constructor(settings: SettingsManager) {
    super()
    this.settings = settings
  }

  isAvailable(): boolean {
    // Always "available" if configured — the server might not be running though
    return this.settings.get('sttMode', 'cloud') === 'local'
  }

  async transcribe(wavBuffer: Buffer, language?: string): Promise<string> {
    const port = this.settings.get('localWhisperPort', 8765)
    const lang = language || this.settings.get('transcriptionLanguage', 'auto')

    const formData = new FormData()
    const blob = new Blob([wavBuffer], { type: 'audio/wav' })
    formData.append('audio', blob, 'audio.wav')

    logger.debug('STT', `Local transcription: ${(wavBuffer.length / 1024).toFixed(0)}KB, port=${port}, lang=${lang === 'auto' ? 'auto-detect' : lang}`)

    // When lang is 'auto', omit the language query param — server auto-detects
    const url = lang === 'auto'
      ? `http://localhost:${port}/transcribe`
      : `http://localhost:${port}/transcribe?language=${lang}`

    const response = await fetch(url, {
      method: 'POST',
      body: formData,
      signal: AbortSignal.timeout(30_000), // 30s timeout
    })

    if (!response.ok) throw new Error(`Local Whisper server error: ${response.status}`)

    const data = await response.json()
    return data.segments?.map((s: any) => s.text).join(' ') || data.text || ''
  }
}
