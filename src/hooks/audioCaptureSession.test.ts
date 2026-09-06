import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { AudioCaptureSession, discardMediaStream } from './audioCaptureSession.ts'

describe('AudioCaptureSession', () => {
  it('keeps a stream that completes before stop', () => {
    const session = new AudioCaptureSession()
    const generation = session.beginStart()
    assert.equal(session.isCurrent(generation), true)
  })

  it('discards a stream that completes after stop', () => {
    const session = new AudioCaptureSession()
    const generation = session.beginStart()
    session.invalidate()
    assert.equal(session.isCurrent(generation), false)
  })

  it('discards the first stream when a second start supersedes it', () => {
    const session = new AudioCaptureSession()
    const first = session.beginStart()
    const second = session.beginStart()
    assert.equal(session.isCurrent(first), false)
    assert.equal(session.isCurrent(second), true)
  })

  it('stop after the second start invalidates both', () => {
    const session = new AudioCaptureSession()
    const first = session.beginStart()
    const second = session.beginStart()
    session.invalidate()
    assert.equal(session.isCurrent(first), false)
    assert.equal(session.isCurrent(second), false)
  })
})

describe('discardMediaStream', () => {
  it('stops every track', () => {
    const stops: string[] = []
    discardMediaStream({
      getTracks: () => [
        { stop: () => stops.push('a') },
        { stop: () => stops.push('b') },
      ],
    })
    assert.deepEqual(stops, ['a', 'b'])
  })
})
