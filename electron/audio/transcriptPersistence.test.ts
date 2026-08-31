import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { persistableTranscriptSegment } from './transcriptPersistence.ts'

describe('persistableTranscriptSegment', () => {
  it('returns the new STT segment, not an accumulated rolling transcript', () => {
    const fullWindow = 'hello team lets begin action items'
    const newSegment = 'action items'
    const persisted = persistableTranscriptSegment(newSegment)

    assert.equal(persisted, 'action items')
    assert.notEqual(persisted, fullWindow)
  })

  it('trims whitespace and rejects empty segments', () => {
    assert.equal(persistableTranscriptSegment('  hello  '), 'hello')
    assert.equal(persistableTranscriptSegment('   '), null)
    assert.equal(persistableTranscriptSegment(''), null)
  })

  it('simulates a multi-interval meeting without duplicating prior text', () => {
    const db: string[] = []
    const segments = ['hello team', 'lets begin', 'action items tomorrow']
    let full = ''

    for (const incoming of segments) {
      full = full ? `${full} ${incoming}` : incoming
      const persist = persistableTranscriptSegment(incoming)
      if (persist) db.push(persist)
    }

    assert.deepEqual(db, segments)
    assert.equal(db.join(' '), full)
    assert.ok(!db.some((row) => row === full && db.length > 1))
  })
})
