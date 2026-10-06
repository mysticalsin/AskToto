/** 2 minutes of 16 kHz 16-bit mono PCM. Must outlast STT (local timeout is 30s). */
export const MAX_AUDIO_BUFFER_BYTES = 16000 * 2 * 120

/**
 * Drop oldest PCM chunks until total bytes fit in maxBytes.
 * Used while transcription is in-flight and new capture still arrives.
 */
export function evictOldestChunks(chunks: Buffer[], maxBytes: number): Buffer[] {
  if (chunks.length === 0) return chunks

  let total = 0
  for (const chunk of chunks) total += chunk.length
  if (total <= maxBytes) return chunks

  const next = chunks.slice()
  while (next.length > 0 && total > maxBytes) {
    const dropped = next.shift()
    if (!dropped) break
    total -= dropped.length
  }
  return next
}
