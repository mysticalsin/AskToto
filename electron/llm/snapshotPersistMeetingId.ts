/**
 * Capture which meeting should receive an Assist response.
 *
 * Must run when `trigger-ai` starts, not when the stream completes.
 * `meetingSession.id` at onComplete can belong to a later meeting, or
 * be null if the user already stopped recording — either drops the
 * answer or writes it onto the wrong session.
 */
export function snapshotPersistMeetingId(
  activeMeetingId: number | null | undefined
): number | null {
  if (
    typeof activeMeetingId !== 'number' ||
    !Number.isInteger(activeMeetingId) ||
    activeMeetingId <= 0
  ) {
    return null
  }
  return activeMeetingId
}
