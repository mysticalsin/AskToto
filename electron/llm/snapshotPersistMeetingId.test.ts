import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { snapshotPersistMeetingId } from './snapshotPersistMeetingId.ts'

describe('snapshotPersistMeetingId', () => {
  it('keeps a positive integer meeting id captured at request start', () => {
    assert.equal(snapshotPersistMeetingId(7), 7)
  })

  it('does not persist when no meeting was active at request start', () => {
    assert.equal(snapshotPersistMeetingId(null), null)
    assert.equal(snapshotPersistMeetingId(undefined), null)
  })

  it('rejects invalid ids so a later session cannot inherit the write', () => {
    assert.equal(snapshotPersistMeetingId(0), null)
    assert.equal(snapshotPersistMeetingId(-3), null)
    assert.equal(snapshotPersistMeetingId(1.5), null)
  })

  it('does not follow a meeting id that appears only after the request started', () => {
    const capturedAtStart = snapshotPersistMeetingId(12)
    const idAfterStopThenNewMeeting = 13
    assert.equal(capturedAtStart, 12)
    assert.notEqual(capturedAtStart, idAfterStopThenNewMeeting)
  })
})
