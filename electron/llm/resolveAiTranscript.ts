/**
 * Choose which transcript the LLM should see.
 *
 * The overlay keeps React state across recordings. A new recording clears
 * AudioManager's transcript immediately, but the renderer still holds the
 * previous meeting until the first STT result. `opts.transcript || live`
 * would then send meeting A's text into meeting B.
 *
 * While recording, the live AudioManager buffer is the source of truth
 * (empty is correct — a new session has no speech yet). After stop, prefer
 * the renderer copy so Assist still has the meeting that just ended.
 */
export function resolveAiTranscript(opts: {
  isRecording: boolean
  liveTranscript: string
  rendererTranscript?: string
}): string {
  if (opts.isRecording) return opts.liveTranscript || ''
  return opts.rendererTranscript || opts.liveTranscript || ''
}
