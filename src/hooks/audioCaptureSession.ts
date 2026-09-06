/**
 * Tracks in-flight getUserMedia requests so a later stop (or a newer start)
 * can discard a stale stream instead of leaving the microphone open.
 */
export class AudioCaptureSession {
  private generation = 0

  /** Call when beginning a start attempt. Returns the generation to check later. */
  beginStart(): number {
    return ++this.generation
  }

  /** Invalidate any in-flight start (user stopped, or a newer start began). */
  invalidate(): void {
    this.generation++
  }

  isCurrent(generation: number): boolean {
    return generation === this.generation
  }
}

/** Stop every track on a stream that must not stay live. */
export function discardMediaStream(stream: { getTracks(): { stop(): void }[] }): void {
  stream.getTracks().forEach((track) => track.stop())
}
