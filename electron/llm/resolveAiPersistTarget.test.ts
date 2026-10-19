import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { isHistoricalMeetingAsk, resolveAiPersistMeetingId } from './resolveAiPersistTarget.ts'

describe('isHistoricalMeetingAsk', () => {
  it('accepts a positive integer meeting id', () => {
    assert.equal(isHistoricalMeetingAsk(12), true)
  })

  it('rejects missing or invalid ids', () => {
    assert.equal(isHistoricalMeetingAsk(undefined), false)
    assert.equal(isHistoricalMeetingAsk(null), false)
    assert.equal(isHistoricalMeetingAsk(0), false)
    assert.equal(isHistoricalMeetingAsk(-1), false)
    assert.equal(isHistoricalMeetingAsk(1.5), false)
    assert.equal(isHistoricalMeetingAsk('12'), false)
  })
})

describe('resolveAiPersistMeetingId', () => {
  it('writes historical asks to the requested meeting, not the live session', () => {
    assert.equal(resolveAiPersistMeetingId(2, 5), 2)
  })

  it('writes live overlay asks to the active session', () => {
    assert.equal(resolveAiPersistMeetingId(undefined, 5), 5)
  })

  it('skips persistence when there is no target meeting', () => {
    assert.equal(resolveAiPersistMeetingId(undefined, null), null)
    assert.equal(resolveAiPersistMeetingId(0, null), null)
  })

  it('ignores invalid requested ids and falls back to the live session', () => {
    assert.equal(resolveAiPersistMeetingId('2', 5), 5)
    assert.equal(resolveAiPersistMeetingId(NaN, 5), 5)
  })
})
