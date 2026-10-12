/**
 * Serializes start/stop recording so overlapping IPC handlers cannot
 * close the wrong meeting or clear the new session's transcript callback.
 */
export class RecordingOpGate {
  private inFlight = false

  tryBegin(): boolean {
    if (this.inFlight) return false
    this.inFlight = true
    return true
  }

  end(): void {
    this.inFlight = false
  }

  get isInFlight(): boolean {
    return this.inFlight
  }
}

export const recordingOpGate = new RecordingOpGate()

export type RecordingTogglePlan =
  | { action: 'skip'; reason: 'no-overlay' }
  | { action: 'stop' }
  | { action: 'start'; endPreviousMeetingId: number | null }

/**
 * Decide the next recording toggle step.
 *
 * Start must close any still-active meeting first. Otherwise a second
 * toggle that races through `stop()` (which sets isRecording=false before
 * awaiting STT) will `start()` a new row, then the in-flight stop will
 * `endMeeting()` that new id and null the transcript callback.
 */
export function planRecordingToggle(opts: {
  isRecording: boolean
  overlayAvailable: boolean
  activeMeetingId: number | null
}): RecordingTogglePlan {
  if (!opts.overlayAvailable) {
    return { action: 'skip', reason: 'no-overlay' }
  }
  if (opts.isRecording) {
    return { action: 'stop' }
  }
  return { action: 'start', endPreviousMeetingId: opts.activeMeetingId }
}
