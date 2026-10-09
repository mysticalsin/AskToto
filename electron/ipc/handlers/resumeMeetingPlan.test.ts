import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { planResumeMeeting } from './resumeMeetingPlan.ts'

describe('planResumeMeeting', () => {
  const ready = {
    meetingId: 7,
    isRecording: false,
    overlayAvailable: true,
    meetingExists: true,
  }

  it('resumes the selected meeting when capture is idle', () => {
    assert.deepEqual(planResumeMeeting(ready), { action: 'resume', meetingId: 7 })
  })

  it('does not stop a live recording to "resume" a past session', () => {
    assert.deepEqual(
      planResumeMeeting({ ...ready, isRecording: true }),
      { action: 'noop', reason: 'already-recording' },
    )
  })

  it('does not start when the overlay window is missing', () => {
    assert.deepEqual(
      planResumeMeeting({ ...ready, overlayAvailable: false }),
      { action: 'noop', reason: 'no-overlay' },
    )
  })

  it('does not create a session for an unknown meeting id', () => {
    assert.deepEqual(
      planResumeMeeting({ ...ready, meetingExists: false }),
      { action: 'noop', reason: 'missing-meeting' },
    )
  })

  it('rejects non-positive and non-integer ids', () => {
    assert.equal(planResumeMeeting({ ...ready, meetingId: 0 }).action, 'noop')
    assert.equal(planResumeMeeting({ ...ready, meetingId: -1 }).action, 'noop')
    assert.equal(planResumeMeeting({ ...ready, meetingId: 1.5 }).action, 'noop')
    assert.equal(planResumeMeeting({ ...ready, meetingId: 'nope' }).action, 'noop')
    assert.deepEqual(
      planResumeMeeting({ ...ready, meetingId: '12' }),
      { action: 'resume', meetingId: 12 },
    )
  })
})
