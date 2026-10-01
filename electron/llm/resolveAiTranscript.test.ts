import assert from 'node:assert/strict'
import { test } from 'node:test'
import { resolveAiTranscript } from './resolveAiTranscript.ts'

test('new recording ignores stale renderer transcript from the previous meeting', () => {
  assert.equal(
    resolveAiTranscript({
      isRecording: true,
      liveTranscript: '',
      rendererTranscript: 'let us discuss the acquisition terms',
    }),
    ''
  )
})

test('active recording uses live speech even if renderer is behind', () => {
  assert.equal(
    resolveAiTranscript({
      isRecording: true,
      liveTranscript: 'hello from meeting B',
      rendererTranscript: 'meeting A leftover',
    }),
    'hello from meeting B'
  )
})

test('after stop, renderer transcript of the ended meeting is used', () => {
  assert.equal(
    resolveAiTranscript({
      isRecording: false,
      liveTranscript: 'ended meeting notes',
      rendererTranscript: 'ended meeting notes',
    }),
    'ended meeting notes'
  )
})

test('after stop with empty renderer, falls back to live buffer', () => {
  assert.equal(
    resolveAiTranscript({
      isRecording: false,
      liveTranscript: 'ended meeting notes',
      rendererTranscript: '',
    }),
    'ended meeting notes'
  )
})
