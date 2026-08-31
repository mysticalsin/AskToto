/**
 * Persist only the newly transcribed segment — never the accumulated
 * rolling transcript window. AudioManager emits both the full text (for
 * the live overlay) and the new STT segment (for durable storage).
 */
export function persistableTranscriptSegment(newSegment: string): string | null {
  const segment = newSegment.trim()
  return segment.length > 0 ? segment : null
}
