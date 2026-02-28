import { EventEmitter } from 'events'
import { BrowserWindow } from 'electron'
import { SettingsManager } from '../services/SettingsManager'
import { STTManager } from './STTManager'
import logger from '../services/Logger'

const MAX_CHUNKS = 60           // Max audio chunks in buffer (ring buffer)
const MIN_AUDIO_BYTES = 16000   // Min bytes to process (0.5s at 16kHz 16-bit mono)
const DEFAULT_PROCESS_INTERVAL = 5000 // 5 seconds
const MAX_TRANSCRIPT_WORDS = 1500     // Rolling window size

/**
 * AudioManager — Manages audio recording lifecycle with EventEmitter pattern.
 *
 * Events:
 * - 'transcript': updated full transcript text
 * - 'error': error during processing
 * - 'recording-start': recording began
 * - 'recording-stop': recording ended
 *
 * Features:
 * - Bounded chunk buffer (ring buffer, drops oldest)
 * - Backpressure: skips processing if previous transcription still in-flight
 * - Configurable processing interval
 * - Automatic STT fallback via STTManager
 */
export class AudioManager extends EventEmitter {
  private settings: SettingsManager
  private sttManager: STTManager
  private isRecording = false
  private audioChunks: Buffer[] = []
  private transcript = ''
  private transcriptCallback: ((text: string) => void) | null = null
  private chunkInterval: ReturnType<typeof setInterval> | null = null
  private targetWindow: BrowserWindow | null = null
  private processingInFlight = false

  constructor(settings: SettingsManager) {
    super()
    this.settings = settings
    this.sttManager = new STTManager(settings)
  }

  setTranscriptCallback(cb: (text: string) => void) {
    this.transcriptCallback = cb
  }

  async start(window: BrowserWindow): Promise<boolean> {
    if (this.isRecording) return true

    this.isRecording = true
    this.audioChunks = []
    this.transcript = ''
    this.targetWindow = window
    this.processingInFlight = false

    // Tell renderer to start capturing audio via Web Audio API
    if (!window.isDestroyed()) {
      window.webContents.send('start-audio-capture')
    }

    // Process accumulated audio at configured interval
    const interval = DEFAULT_PROCESS_INTERVAL
    this.chunkInterval = setInterval(() => {
      this.processAudioChunks().catch((err) =>
        logger.error('Audio', 'Chunk processing failed', err)
      )
    }, interval)

    logger.info('Audio', `Recording started (interval=${interval}ms)`)
    this.emit('recording-start')
    return true
  }

  async stop(): Promise<void> {
    this.isRecording = false

    if (this.chunkInterval) {
      clearInterval(this.chunkInterval)
      this.chunkInterval = null
    }

    if (this.targetWindow && !this.targetWindow.isDestroyed()) {
      this.targetWindow.webContents.send('stop-audio-capture')
    }
    this.targetWindow = null

    // Process any remaining audio
    await this.processAudioChunks()

    this.transcriptCallback = null
    logger.info('Audio', 'Recording stopped')
    this.emit('recording-stop')
  }

  addAudioChunk(chunk: Buffer) {
    if (!this.isRecording) return
    this.audioChunks.push(chunk)

    // Bounded ring buffer: drop oldest if over limit
    while (this.audioChunks.length > MAX_CHUNKS) {
      this.audioChunks.shift()
    }
  }

  private async processAudioChunks() {
    // Backpressure: skip if previous transcription still in-flight
    if (this.processingInFlight) {
      logger.debug('Audio', 'Skipping processing — previous transcription still in-flight')
      return
    }

    if (this.audioChunks.length === 0) return

    const chunks = [...this.audioChunks]
    this.audioChunks = []

    const audioBuffer = Buffer.concat(chunks)

    // Skip if too short
    if (audioBuffer.length < MIN_AUDIO_BYTES) return

    const wavBuffer = this.createWav(audioBuffer, 16000, 1, 16)

    this.processingInFlight = true
    try {
      const text = await this.sttManager.transcribe(wavBuffer)
      if (text && text.trim().length > 0) {
        this.transcript += (this.transcript ? ' ' : '') + text.trim()

        // Rolling window: keep last N words
        const words = this.transcript.split(' ')
        if (words.length > MAX_TRANSCRIPT_WORDS) {
          this.transcript = words.slice(-MAX_TRANSCRIPT_WORDS).join(' ')
        }

        this.transcriptCallback?.(this.transcript)
        this.emit('transcript', this.transcript)
      }
    } catch (err) {
      logger.error('Audio', 'Transcription failed', err)
      this.emit('error', err)
    } finally {
      this.processingInFlight = false
    }
  }

  getTranscript(): string {
    return this.transcript
  }

  getIsRecording(): boolean {
    return this.isRecording
  }

  private createWav(pcmData: Buffer, sampleRate: number, channels: number, bitsPerSample: number): Buffer {
    const dataLength = pcmData.length
    const headerLength = 44
    const buffer = Buffer.alloc(headerLength + dataLength)

    buffer.write('RIFF', 0)
    buffer.writeUInt32LE(36 + dataLength, 4)
    buffer.write('WAVE', 8)
    buffer.write('fmt ', 12)
    buffer.writeUInt32LE(16, 16)
    buffer.writeUInt16LE(1, 20)
    buffer.writeUInt16LE(channels, 22)
    buffer.writeUInt32LE(sampleRate, 24)
    buffer.writeUInt32LE(sampleRate * channels * bitsPerSample / 8, 28)
    buffer.writeUInt16LE(channels * bitsPerSample / 8, 32)
    buffer.writeUInt16LE(bitsPerSample, 34)
    buffer.write('data', 36)
    buffer.writeUInt32LE(dataLength, 40)
    pcmData.copy(buffer, 44)

    return buffer
  }
}
