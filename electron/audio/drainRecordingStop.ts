/**
 * Finish a recording without dropping the last capture window.
 *
 * `processAudioChunks()` returns immediately while STT is in-flight
 * (backpressure). If `stop()` then clears the persist callback, the
 * in-flight result and any leftover PCM never reach the meeting row.
 */
export async function drainRecordingStop(opts: {
  inFlight: Promise<void> | null
  flush: () => Promise<void>
  timeoutMs?: number
  timeout?: (ms: number) => Promise<void>
}): Promise<void> {
  if (opts.inFlight) {
    const timeoutMs = opts.timeoutMs ?? 35_000
    const timeout = opts.timeout ?? ((ms) => new Promise((resolve) => setTimeout(resolve, ms)))
    await Promise.race([opts.inFlight, timeout(timeoutMs)])
  }
  await opts.flush()
}
