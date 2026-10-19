/**
 * Decide which meeting row should receive a persisted AI response.
 *
 * Dashboard "Ask about this meeting" passes an explicit meetingId. Using the
 * live session instead writes another meeting's Q&A onto the current recording.
 */
export function isHistoricalMeetingAsk(requestedMeetingId: unknown): boolean {
  return typeof requestedMeetingId === 'number'
    && Number.isInteger(requestedMeetingId)
    && requestedMeetingId > 0
}

export function resolveAiPersistMeetingId(
  requestedMeetingId: unknown,
  activeMeetingId: number | null
): number | null {
  if (isHistoricalMeetingAsk(requestedMeetingId)) {
    return requestedMeetingId as number
  }
  return activeMeetingId
}
