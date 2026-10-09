export type ResumeMeetingReason =
  | 'already-recording'
  | 'no-overlay'
  | 'missing-meeting'

export type ResumeMeetingPlan =
  | { action: 'resume'; meetingId: number }
  | { action: 'noop'; reason: ResumeMeetingReason }

/**
 * Decide whether "Resume Session" may start capture on an existing meeting.
 *
 * Calling toggle-recording here is unsafe: if a live meeting is already
 * recording, toggle stops it and ends that session. If nothing is recording,
 * toggle creates a brand-new meeting instead of continuing the selected one.
 */
export function planResumeMeeting(opts: {
  meetingId: unknown
  isRecording: boolean
  overlayAvailable: boolean
  meetingExists: boolean
}): ResumeMeetingPlan {
  const meetingId = typeof opts.meetingId === 'number' ? opts.meetingId : Number(opts.meetingId)
  if (!Number.isInteger(meetingId) || meetingId <= 0) {
    return { action: 'noop', reason: 'missing-meeting' }
  }
  if (!opts.overlayAvailable) {
    return { action: 'noop', reason: 'no-overlay' }
  }
  if (opts.isRecording) {
    return { action: 'noop', reason: 'already-recording' }
  }
  if (!opts.meetingExists) {
    return { action: 'noop', reason: 'missing-meeting' }
  }
  return { action: 'resume', meetingId }
}
