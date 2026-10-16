export const MAX_TRANSCRIPT_WORDS = 1500

/**
 * Fold a new STT segment into the overlay's rolling window.
 * Persistence must use `segment` (the new speech only). Saving `full`
 * on every cycle duplicates the entire meeting into SQLite.
 */
export function appendTranscriptSegment(
  previous: string,
  sttText: string,
  maxWords: number = MAX_TRANSCRIPT_WORDS,
): { full: string; segment: string } | null {
  const segment = sttText.trim()
  if (!segment) return null

  let full = previous ? `${previous} ${segment}` : segment
  const words = full.split(' ')
  if (words.length > maxWords) {
    full = words.slice(-maxWords).join(' ')
  }

  return { full, segment }
}
