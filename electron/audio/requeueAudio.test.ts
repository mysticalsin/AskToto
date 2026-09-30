import { test } from 'node:test'
import assert from 'node:assert/strict'
import { requeueAudio } from './requeueAudio.ts'

test('requeues failed PCM at the front of the capture queue', () => {
  const queued = Buffer.from('new')
  const failed = Buffer.from('old')
  const next = requeueAudio([queued], failed, 60)
  assert.equal(next.length, 2)
  assert.equal(next[0].toString(), 'old')
  assert.equal(next[1].toString(), 'new')
})

test('does not enqueue empty PCM', () => {
  const queued = Buffer.from('keep')
  const next = requeueAudio([queued], Buffer.alloc(0), 60)
  assert.equal(next.length, 1)
  assert.equal(next[0].toString(), 'keep')
})

test('honors the ring-buffer cap by dropping newest live chunks', () => {
  const next = requeueAudio(
    [Buffer.from('a'), Buffer.from('b')],
    Buffer.from('retry'),
    2,
  )
  assert.equal(next.length, 2)
  assert.equal(next[0].toString(), 'retry')
  assert.equal(next[1].toString(), 'a')
})
