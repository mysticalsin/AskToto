/**
 * An STT request is tagged with the recording epoch that submitted it.
 * `start()` bumps the epoch so a late result from meeting A cannot be
 * applied to meeting B's live transcript or persistence callback.
 */
export function sttResultBelongsToSession(
  startedEpoch: number,
  currentEpoch: number,
): boolean {
  return startedEpoch === currentEpoch
}
