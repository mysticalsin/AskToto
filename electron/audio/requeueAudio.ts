/**
 * Put failed (or too-short) PCM back at the front of the capture queue
 * so the next processing cycle can retry it. If the ring-buffer cap is
 * exceeded, drop the newest live chunks — not the audio we are retrying.
 */
export function requeueAudio(queue: Buffer[], pcm: Buffer, maxChunks: number): Buffer[] {
  if (pcm.length === 0) return queue
  const next = [pcm, ...queue]
  while (next.length > maxChunks) {
    next.pop()
  }
  return next
}
