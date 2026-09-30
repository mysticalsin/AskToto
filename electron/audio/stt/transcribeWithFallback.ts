export interface TranscribeProvider {
  name: string
  isAvailable(): boolean
  transcribe(wavBuffer: Buffer, language?: string): Promise<string>
}

/**
 * Try the preferred STT provider, then any other available provider.
 * Empty-string results (silence) are success. Total failure throws so
 * callers can retry the same PCM instead of treating it as silence.
 */
export async function transcribeWithFallback(
  providers: TranscribeProvider[],
  preferredName: string,
  wavBuffer: Buffer,
  language: string,
): Promise<string> {
  const errors: unknown[] = []
  const preferred = providers.find((p) => p.name === preferredName)

  if (preferred) {
    try {
      return await preferred.transcribe(wavBuffer, language)
    } catch (err) {
      errors.push(err)
    }
  } else {
    errors.push(new Error(`STT provider ${preferredName} not registered`))
  }

  for (const provider of providers) {
    if (provider.name === preferredName) continue
    if (!provider.isAvailable()) continue
    try {
      return await provider.transcribe(wavBuffer, language)
    } catch (err) {
      errors.push(err)
    }
  }

  const last = errors[errors.length - 1]
  throw last instanceof Error ? last : new Error('All STT providers failed')
}
