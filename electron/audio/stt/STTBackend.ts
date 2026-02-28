/**
 * Abstract STT backend interface.
 * All speech-to-text providers implement this.
 */
export abstract class STTBackend {
  abstract readonly name: string

  /** Transcribe a WAV audio buffer to text */
  abstract transcribe(wavBuffer: Buffer, language?: string): Promise<string>

  /** Check if this backend is available/configured */
  abstract isAvailable(): boolean
}
