import { test } from 'node:test'
import assert from 'node:assert/strict'
import { evictOldestChunks, MAX_AUDIO_BUFFER_BYTES } from './evictOldestChunks.ts'

test('leaves chunks unchanged when under the byte cap', () => {
  const a = Buffer.alloc(100, 1)
  const b = Buffer.alloc(100, 2)
  const next = evictOldestChunks([a, b], 1000)
  assert.equal(next.length, 2)
  assert.equal(next[0], a)
  assert.equal(next[1], b)
})

test('drops oldest chunks until the remaining PCM fits', () => {
  const oldest = Buffer.alloc(80, 1)
  const middle = Buffer.alloc(80, 2)
  const newest = Buffer.alloc(50, 3)
  const next = evictOldestChunks([oldest, middle, newest], 100)
  assert.deepEqual([...next[0]], [...newest])
  assert.equal(next.length, 1)
})

test('keeps more than 15s of 16kHz audio (old 60-chunk cap was ~15s)', () => {
  // Historical bug: MAX_CHUNKS=60 at 4096 samples/chunk ≈ 15.36s, but local
  // Whisper aborts only after 30s — so a slow STT call dropped meeting audio.
  const chunkBytes = 4096 * 2
  const thirtySeconds = Buffer.alloc(16000 * 2 * 30)
  const chunkCount = Math.ceil(thirtySeconds.length / chunkBytes)
  const chunks = Array.from({ length: chunkCount }, () => Buffer.alloc(chunkBytes))
  const next = evictOldestChunks(chunks, MAX_AUDIO_BUFFER_BYTES)
  const keptBytes = next.reduce((sum, c) => sum + c.length, 0)
  assert.ok(keptBytes >= 16000 * 2 * 30, `expected >=30s of PCM, kept ${keptBytes} bytes`)
})

test('two minutes of PCM still fits the default cap', () => {
  const twoMinutes = 16000 * 2 * 120
  const chunks = [Buffer.alloc(twoMinutes)]
  const next = evictOldestChunks(chunks, MAX_AUDIO_BUFFER_BYTES)
  assert.equal(next.length, 1)
  assert.equal(next[0].length, twoMinutes)
})
