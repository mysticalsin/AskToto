import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { RecordingOpGate, planRecordingToggle } from './recordingOpGate.ts'

describe('RecordingOpGate', () => {
  it('rejects a second begin until the first operation ends', () => {
    const gate = new RecordingOpGate()
    assert.equal(gate.tryBegin(), true)
    assert.equal(gate.isInFlight, true)
    assert.equal(gate.tryBegin(), false)
    gate.end()
    assert.equal(gate.isInFlight, false)
    assert.equal(gate.tryBegin(), true)
  })

  it('end is safe to call when idle', () => {
    const gate = new RecordingOpGate()
    gate.end()
    assert.equal(gate.tryBegin(), true)
  })
})

describe('planRecordingToggle', () => {
  it('stops when capture is already running', () => {
    assert.deepEqual(
      planRecordingToggle({ isRecording: true, overlayAvailable: true, activeMeetingId: 4 }),
      { action: 'stop' },
    )
  })

  it('starts a new meeting and closes an orphaned active session', () => {
    assert.deepEqual(
      planRecordingToggle({ isRecording: false, overlayAvailable: true, activeMeetingId: 4 }),
      { action: 'start', endPreviousMeetingId: 4 },
    )
  })

  it('starts without closing when no meeting is active', () => {
    assert.deepEqual(
      planRecordingToggle({ isRecording: false, overlayAvailable: true, activeMeetingId: null }),
      { action: 'start', endPreviousMeetingId: null },
    )
  })

  it('does not start or stop without an overlay window', () => {
    assert.deepEqual(
      planRecordingToggle({ isRecording: false, overlayAvailable: false, activeMeetingId: null }),
      { action: 'skip', reason: 'no-overlay' },
    )
  })
})
