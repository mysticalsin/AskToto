import { test } from 'node:test'
import assert from 'node:assert/strict'
import { sttResultBelongsToSession } from './sttResultGuard.ts'

test('accepts an STT result from the current recording session', () => {
  assert.equal(sttResultBelongsToSession(3, 3), true)
})

test('rejects a late STT result after a new recording starts', () => {
  const meetingAEpoch = 1
  const meetingBEpoch = meetingAEpoch + 1
  assert.equal(sttResultBelongsToSession(meetingAEpoch, meetingBEpoch), false)
})

test('rejects a result after two session boundaries (stop then start)', () => {
  assert.equal(sttResultBelongsToSession(1, 3), false)
})
