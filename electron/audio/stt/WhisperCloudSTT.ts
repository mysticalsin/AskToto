import OpenAI, { toFile } from 'openai'
import { STTBackend } from './STTBackend'
import { SettingsManager } from '../../services/SettingsManager'
import logger from '../../services/Logger'

/**
 * OpenAI Whisper API cloud transcription.
 * Uses `toFile()` to avoid writing temp files to disk.
 * MODERATE-8 fix: Caches client instance, only recreates when API key changes.
 */
export class WhisperCloudSTT extends STTBackend {
  readonly name = 'whisper-cloud'
  private settings: SettingsManager
  private client: OpenAI | null = null
  private cachedKey: string = ''

  constructor(settings: SettingsManager) {
    super()
    this.settings = settings
  }

  isAvailable(): boolean {
    return !!this.settings.get('openaiKey', '')
  }

  private getClient(): OpenAI {
    const apiKey = this.settings.get('openaiKey', '')
    if (!apiKey) throw new Error('OpenAI API key required for cloud transcription')

    // Reuse client if key hasn't changed
    if (this.client && this.cachedKey === apiKey) {
      return this.client
    }

    this.client = new OpenAI({ apiKey })
    this.cachedKey = apiKey
    return this.client
  }

  async transcribe(wavBuffer: Buffer, language?: string): Promise<string> {
    const client = this.getClient()
    const lang = language || this.settings.get('transcriptionLanguage', 'auto')

    // Use toFile() to create a file-like object from buffer — no temp file needed
    const file = await toFile(wavBuffer, 'audio.wav', { type: 'audio/wav' })

    logger.debug('STT', `Cloud transcription: ${(wavBuffer.length / 1024).toFixed(0)}KB, lang=${lang === 'auto' ? 'auto-detect' : lang}`)

    // When lang is 'auto', omit the language param — Whisper auto-detects
    const transcription = await client.audio.transcriptions.create({
      file,
      model: 'whisper-1',
      response_format: 'text',
      ...(lang !== 'auto' ? { language: lang } : {}),
    })

    return transcription as unknown as string
  }
}
