/**
 * started_at is stored as localtime. julianday('now') is UTC, so mixing the two
 * skews duration by the local UTC offset (negative east of UTC, inflated west).
 * Both sides must use the same clock.
 */
export const END_MEETING_SQL = `UPDATE meetings SET
  ended_at = datetime('now','localtime'),
  duration_seconds = CAST((julianday('now','localtime') - julianday(started_at)) * 86400 AS INTEGER)
  WHERE id = ?`
